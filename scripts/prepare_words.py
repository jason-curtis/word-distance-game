#!/usr/bin/env python3
"""
GloVe Word Embeddings Processor for Semantle Game

This script downloads and processes GloVe embeddings to create a curated word list
for the word distance game. It handles:
1. Downloading GloVe embeddings (Wikipedia 2024)
2. Filtering to common, meaningful words
3. Stemming/deduplication of similar words
4. Outputting a compact JSON file for the web app

Word Deduplication Strategy:
- We use Porter stemming to group words with the same stem
- For each group, we select the most "canonical" word form (typically the shortest
  or most common one)
- The vector for the group is the vector of the selected canonical word
- This reduces redundancy (run/runs/running -> run) while preserving semantic diversity

Alternative approaches considered:
1. Average vectors in group - loses precision, creates artificial vectors
2. Max-pooling vectors - mathematically complex, less interpretable
3. Keep all forms - too many near-duplicates hurt gameplay
4. Lemmatization - slower, requires more dependencies

The chosen approach (keep canonical form) is simple, fast, and produces
intuitive results for the game.
"""

import os
import sys
import json
import gzip
import zipfile
import urllib.request
from collections import defaultdict
from pathlib import Path
import re
from tqdm import tqdm

# Try to import nltk for word validation and lemmatization
try:
    from nltk.stem import PorterStemmer, WordNetLemmatizer
    from nltk.corpus import words as nltk_words
    import nltk
    NLTK_AVAILABLE = True

    # Download required NLTK data if not present
    try:
        nltk.data.find('corpora/words.zip')
    except LookupError:
        print("Downloading NLTK words corpus...")
        nltk.download('words', quiet=True)

    try:
        nltk.data.find('corpora/wordnet.zip')
    except LookupError:
        print("Downloading NLTK wordnet...")
        nltk.download('wordnet', quiet=True)

except ImportError:
    NLTK_AVAILABLE = False
    print("NLTK not available. Install with: pip install nltk")
    print("Warning: Without NLTK, word filtering will be less effective")

# Configuration - Using GloVe 2024 Wikipedia+Gigaword embeddings (50d)
# Available at: https://nlp.stanford.edu/projects/glove/
GLOVE_URL = "https://nlp.stanford.edu/data/wordvecs/glove.2024.wikigiga.50d.zip"
OUTPUT_FILE = "src/data/words.json"
TARGET_WORD_COUNT = 15000  # Aim for ~15k words after filtering
MIN_WORD_LENGTH = 2
MAX_WORD_LENGTH = 15
VECTOR_DIMENSIONS = 50

# Words to exclude (profanity, slurs, very obscure terms)
EXCLUDE_WORDS = {
    # Add any words you want to exclude here
    'xxx', 'etc'
}

# Common word suffixes for simple stemming fallback
COMMON_SUFFIXES = ['ing', 'ed', 'er', 'est', 'ly', 's', 'es', 'ment', 'ness', 'tion', 'sion']


def simple_stem(word):
    """Simple stemming fallback when NLTK is not available."""
    word = word.lower()
    for suffix in sorted(COMMON_SUFFIXES, key=len, reverse=True):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[:-len(suffix)]
    return word


def edit_distance(s1, s2):
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return edit_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]


def cosine_similarity(v1, v2):
    """Compute cosine similarity between two vectors."""
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = sum(a * a for a in v1) ** 0.5
    norm2 = sum(b * b for b in v2) ** 0.5
    if norm1 == 0 or norm2 == 0:
        return 0
    return dot / (norm1 * norm2)


def download_glove(data_dir):
    """Download GloVe embeddings if not already present."""
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    import zipfile

    # Derive zip filename from URL
    zip_name = GLOVE_URL.split('/')[-1]
    zip_path = data_dir / zip_name

    # Download if needed
    if not zip_path.exists():
        print(f"Downloading from {GLOVE_URL}...")

        def progress_hook(block_num, block_size, total_size):
            if total_size > 0:
                downloaded = block_num * block_size
                percent = min(100, downloaded * 100 / total_size)
                sys.stdout.write(f"\rProgress: {percent:.1f}% ({downloaded // (1024*1024)}MB / {total_size // (1024*1024)}MB)")
                sys.stdout.flush()

        urllib.request.urlretrieve(GLOVE_URL, zip_path, progress_hook)
        print("\nDownload complete!")

    # Find and extract the txt file from the zip
    print(f"Opening {zip_path}...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # List contents and find the txt file
        txt_files = [f for f in zip_ref.namelist() if f.endswith('.txt')]
        if not txt_files:
            raise ValueError(f"No .txt file found in {zip_path}")

        txt_name = txt_files[0]
        txt_path = data_dir / txt_name

        if not txt_path.exists():
            print(f"Extracting {txt_name}...")
            zip_ref.extract(txt_name, data_dir)
            print("Extraction complete!")
        else:
            print(f"Already extracted: {txt_path}")

    return txt_path


def is_valid_word(word, valid_words_set=None):
    """Check if a word should be included in the game."""
    # Must be alphabetic (allow hyphens for compound words)
    if not re.match(r'^[a-z]+(-[a-z]+)?$', word):
        return False

    # Length constraints
    if len(word) < MIN_WORD_LENGTH or len(word) > MAX_WORD_LENGTH:
        return False

    # Not in exclude list
    if word in EXCLUDE_WORDS:
        return False

    # If we have NLTK, validate against English word list
    if valid_words_set and word not in valid_words_set:
        return False

    return True


def load_glove_embeddings(glove_path, max_words=None, valid_words_set=None):
    """Load GloVe embeddings from file."""
    print(f"Loading GloVe embeddings from {glove_path}...")

    embeddings = {}
    with open(glove_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if max_words and i >= max_words:
                break

            parts = line.strip().split()
            if len(parts) < 2:
                continue

            word = parts[0].lower()

            if is_valid_word(word, valid_words_set):
                try:
                    vector = [float(x) for x in parts[1:]]
                    # Accept vectors of the expected dimension or close to it
                    if len(vector) >= VECTOR_DIMENSIONS:
                        embeddings[word] = vector[:VECTOR_DIMENSIONS]
                except ValueError:
                    continue

            if (i + 1) % 100000 == 0:
                print(f"  Processed {i + 1:,} lines, kept {len(embeddings):,} words...")

    print(f"Loaded {len(embeddings):,} valid word embeddings")
    return embeddings


def create_word_variants_mapping(embeddings):
    """
    Create a mapping from word variants to their canonical forms in the word list.
    This allows users to type variants that get mapped to words in the game.

    For example: "rescuer" -> "rescue", "running" -> "run" (if only "rescue"/"run" exist)
    But if both "rescuer" and "rescue" exist, no mapping is created.
    """
    print("Creating word variant mappings...")

    variants = {}
    word_set = set(embeddings.keys())

    if not NLTK_AVAILABLE:
        print("  Skipping variant mapping (NLTK not available)")
        return variants

    stemmer = PorterStemmer()
    lemmatizer = WordNetLemmatizer()

    # For each word that exists in embeddings, find related forms
    for word in embeddings.keys():
        # Generate potential variants using common suffixes
        potential_variants = set()

        # Plural/singular forms
        if word.endswith('s') and len(word) > 3:
            potential_variants.add(word[:-1])  # Remove 's'
        if not word.endswith('s'):
            potential_variants.add(word + 's')
            if word.endswith('y') and len(word) > 3:
                potential_variants.add(word[:-1] + 'ies')  # city -> cities
            elif word.endswith(('s', 'x', 'z', 'ch', 'sh')):
                potential_variants.add(word + 'es')

        # Verb forms
        if not word.endswith('ing'):
            potential_variants.add(word + 'ing')
            if word.endswith('e'):
                potential_variants.add(word[:-1] + 'ing')  # make -> making

        if not word.endswith('ed'):
            potential_variants.add(word + 'ed')
            if word.endswith('e'):
                potential_variants.add(word[:-1] + 'ed')  # make -> maked (not valid but filtered later)
            if len(word) > 3 and word[-1] not in 'aeiou' and word[-2] in 'aeiou':
                potential_variants.add(word + word[-1] + 'ed')  # run -> runned (filtered later)

        # Comparative/superlative
        if not word.endswith('er') and len(word) > 3:
            potential_variants.add(word + 'er')
            if word.endswith('e'):
                potential_variants.add(word + 'r')
        if not word.endswith('est') and len(word) > 3:
            potential_variants.add(word + 'est')

        # Add variants that DON'T exist in word list as mappings to this word
        for variant in potential_variants:
            if variant not in word_set and len(variant) >= MIN_WORD_LENGTH:
                # Only add if stem matches
                if stemmer.stem(variant) == stemmer.stem(word):
                    variants[variant] = word

    print(f"  Created {len(variants):,} variant mappings")
    if variants:
        examples = list(variants.items())[:10]
        print("  Examples:")
        for variant, canonical in examples:
            print(f"    {variant} -> {canonical}")

    return variants


def deduplicate_by_stem(embeddings):
    """
    DEPRECATED: Use smart_deduplicate instead which preserves common word forms.

    Group words by their stem and select a canonical representative.
    """
    print("Deduplicating words by stem...")

    if NLTK_AVAILABLE:
        stemmer = PorterStemmer()
        stem_func = stemmer.stem
    else:
        stem_func = simple_stem

    # Group words by stem
    stem_groups = defaultdict(list)
    for word in embeddings:
        stem = stem_func(word)
        stem_groups[stem].append(word)

    # Select canonical word from each group
    canonical_words = {}
    for stem, words in stem_groups.items():
        # Sort by length (prefer shorter), then alphabetically
        words.sort(key=lambda w: (len(w), w))
        canonical = words[0]
        canonical_words[canonical] = embeddings[canonical]

    print(f"Reduced from {len(embeddings):,} to {len(canonical_words):,} words after deduplication")

    # Show some examples of deduplication
    print("\nDeduplication examples:")
    examples_shown = 0
    for stem, words in stem_groups.items():
        if len(words) > 2 and examples_shown < 5:
            selected = sorted(words, key=lambda w: (len(w), w))[0]
            removed = [w for w in words if w != selected][:5]
            print(f"  Kept '{selected}', removed: {removed}")
            examples_shown += 1

    return canonical_words


def smart_deduplicate(embeddings, valid_words_set=None):
    """
    Smart deduplication that keeps common word forms but removes obscure variants.

    Strategy:
    1. Keep base words and their common variants (run, runs, running, runner)
    2. Remove near-duplicates that are very close in spelling and meaning
    3. Validate all words against dictionary to ensure they're real words
    4. Prefer keeping multiple forms over aggressive stemming
    """
    print("Smart deduplication - keeping common word forms...")

    if not NLTK_AVAILABLE or not valid_words_set:
        print("  Using basic deduplication (NLTK not available)")
        return deduplicate_by_similarity(embeddings)

    # First, remove any words that aren't in the dictionary
    filtered = {w: v for w, v in embeddings.items() if w in valid_words_set}
    print(f"  Filtered to {len(filtered):,} dictionary words (from {len(embeddings):,})")

    # Use similarity-based deduplication but with relaxed parameters
    # Only merge words that are VERY similar in both spelling AND meaning
    result = deduplicate_by_similarity(filtered, spelling_threshold=1, semantic_threshold=0.95)

    return result


def deduplicate_by_similarity(embeddings, spelling_threshold=2, semantic_threshold=0.85):
    """
    Merge words that are similar in BOTH spelling AND meaning.

    Uses n-gram blocking for efficient candidate generation - only compares
    words that share character bigrams, which is required for low edit distance.
    """
    print(f"Deduplicating by spelling+meaning similarity...")
    print(f"  Spelling threshold: edit distance <= {spelling_threshold}")
    print(f"  Semantic threshold: cosine similarity >= {semantic_threshold}")

    words = list(embeddings.keys())
    vectors = [embeddings[w] for w in words]
    n = len(words)

    # Track which words to merge (using Union-Find)
    parent = list(range(n))

    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py

    # Build bigram index - words with edit distance ≤ 2 must share bigrams
    print("  Building bigram index...")
    bigram_index = defaultdict(set)
    word_bigrams = {}

    for i, word in enumerate(words):
        # Get all character bigrams (including start/end markers)
        padded = f"^{word}$"
        bigrams = {padded[j:j+2] for j in range(len(padded) - 1)}
        word_bigrams[i] = bigrams
        for bg in bigrams:
            bigram_index[bg].add(i)

    # Find similar pairs using bigram blocking
    merge_count = 0
    checked = 0
    seen_pairs = set()

    for i in tqdm(range(n), desc="  Deduplicating", unit="words"):
        word1 = words[i]
        vec1 = vectors[i]
        len1 = len(word1)
        bg1 = word_bigrams[i]

        # Get candidates: words sharing at least one bigram
        # (words with edit dist ≤ 2 must share at least len-3 bigrams for len > 3)
        candidates = set()
        for bg in bg1:
            candidates.update(bigram_index[bg])

        for j in candidates:
            if j <= i:
                continue

            # Skip if already checked
            pair = (i, j) if i < j else (j, i)
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)

            word2 = words[j]

            # Quick length filter
            if abs(len1 - len(word2)) > spelling_threshold:
                continue

            # Bigram overlap filter - need sufficient overlap for low edit distance
            bg2 = word_bigrams[j]
            overlap = len(bg1 & bg2)
            min_required = max(1, min(len(bg1), len(bg2)) - spelling_threshold - 1)
            if overlap < min_required:
                continue

            checked += 1

            # Check spelling similarity
            edit_dist = edit_distance(word1, word2)
            if edit_dist > spelling_threshold:
                continue

            # Check semantic similarity
            sim = cosine_similarity(vec1, vectors[j])
            if sim >= semantic_threshold:
                union(i, j)
                merge_count += 1

    print(f"  Checked {checked:,} candidate pairs, found {merge_count:,} merges")

    # Group words by their root
    groups = defaultdict(list)
    for i in range(n):
        root = find(i)
        groups[root].append(i)

    # Select canonical word from each group (shortest, then alphabetically first)
    canonical_words = {}
    examples = []

    for root, indices in groups.items():
        group_words = [words[i] for i in indices]
        group_words.sort(key=lambda w: (len(w), w))
        canonical = group_words[0]
        canonical_words[canonical] = embeddings[canonical]

        if len(group_words) > 1 and len(examples) < 10:
            examples.append((canonical, group_words[1:]))

    print(f"Reduced from {len(embeddings):,} to {len(canonical_words):,} words")

    if examples:
        print("\nMerge examples:")
        for kept, removed in examples[:5]:
            print(f"  Kept '{kept}', merged: {removed[:5]}")

    return canonical_words


def select_top_words(embeddings, target_count):
    """
    Select the top N words based on their position in GloVe (frequency proxy).

    GloVe words are roughly ordered by frequency, so taking the first N
    gives us more common words.
    """
    print(f"Selecting top {target_count:,} words...")

    # Convert to list to maintain order
    word_list = list(embeddings.keys())[:target_count]

    return {word: embeddings[word] for word in word_list}


def normalize_vectors(embeddings):
    """Normalize all vectors to unit length for consistent cosine similarity."""
    print("Normalizing vectors...")

    normalized = {}
    for word, vector in embeddings.items():
        magnitude = sum(x ** 2 for x in vector) ** 0.5
        if magnitude > 0:
            normalized[word] = [x / magnitude for x in vector]
        else:
            normalized[word] = vector

    return normalized


def reduce_precision(embeddings, decimal_places=4):
    """Reduce vector precision to save space in JSON output."""
    print(f"Reducing precision to {decimal_places} decimal places...")

    reduced = {}
    for word, vector in embeddings.items():
        reduced[word] = [round(x, decimal_places) for x in vector]

    return reduced


def save_to_json(embeddings, output_path, variants=None):
    """Save embeddings to JSON format for the web app."""
    print(f"Saving to {output_path}...")

    # Convert to the format expected by the web app
    words = list(embeddings.keys())
    vectors = [embeddings[word] for word in words]

    data = {
        "words": words,
        "vectors": vectors
    }

    # Add variant mappings if provided
    if variants:
        data["variants"] = variants
        print(f"  Including {len(variants):,} word variant mappings")

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))  # Compact JSON

    # Calculate file size
    file_size = output_path.stat().st_size / (1024 * 1024)
    print(f"Saved {len(words):,} words to {output_path} ({file_size:.2f} MB)")


def verify_output(output_path):
    """Verify the output file can be loaded correctly."""
    print("Verifying output...")

    with open(output_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    words = data['words']
    vectors = data['vectors']

    print(f"  Words count: {len(words):,}")
    print(f"  Vectors count: {len(vectors):,}")
    print(f"  Vector dimensions: {len(vectors[0])}")
    print(f"  Sample words: {words[:10]}")

    # Quick sanity check on a similarity
    def cosine_sim(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        return dot  # Vectors are already normalized

    if 'king' in words and 'queen' in words:
        king_idx = words.index('king')
        queen_idx = words.index('queen')
        similarity = cosine_sim(vectors[king_idx], vectors[queen_idx])
        print(f"  king-queen similarity: {similarity:.4f}")

    print("Verification complete!")


def main():
    """Main entry point."""
    print("=" * 60)
    print("GloVe Word Embeddings Processor for Semantle Game")
    print("Using 2024 Wikipedia embeddings with improved word filtering")
    print("=" * 60)

    # Determine paths
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    data_dir = project_dir / "data" / "glove"
    output_path = project_dir / OUTPUT_FILE

    # Step 0: Load valid English words dictionary
    valid_words_set = None
    if NLTK_AVAILABLE:
        print("\nLoading English dictionary...")
        try:
            word_list = nltk_words.words()
            valid_words_set = {w.lower() for w in word_list if re.match(r'^[a-z]+$', w.lower())}
            print(f"  Loaded {len(valid_words_set):,} valid English words")
        except Exception as e:
            print(f"  Warning: Could not load NLTK words: {e}")
            valid_words_set = None

    # Step 1: Download GloVe
    glove_path = download_glove(data_dir)

    # Step 2: Load embeddings with dictionary validation
    # Only keep top 150k (GloVe is ~frequency sorted) to make processing faster
    embeddings = load_glove_embeddings(glove_path, max_words=150000, valid_words_set=valid_words_set)

    # Step 3: Select top words FIRST to reduce deduplication work
    embeddings = select_top_words(embeddings, TARGET_WORD_COUNT * 3)  # 45k words

    # Step 4: Smart deduplication - keeps common forms, removes only true duplicates
    embeddings = smart_deduplicate(embeddings, valid_words_set)

    # Step 5: Trim to final target count
    embeddings = select_top_words(embeddings, TARGET_WORD_COUNT)

    # Step 6: Create variant mappings for words NOT in the final list
    variants = create_word_variants_mapping(embeddings)

    # Step 7: Normalize vectors
    embeddings = normalize_vectors(embeddings)

    # Step 8: Reduce precision for smaller file size
    embeddings = reduce_precision(embeddings, decimal_places=4)

    # Step 9: Save to JSON with variants
    save_to_json(embeddings, output_path, variants)

    # Step 10: Verify
    verify_output(output_path)

    print("\n" + "=" * 60)
    print("Processing complete!")
    print(f"Final word list: {len(embeddings):,} words")
    print(f"Variant mappings: {len(variants):,} words")
    print("=" * 60)


if __name__ == "__main__":
    main()
