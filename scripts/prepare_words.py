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

# Try to import nltk for stemming, fall back to simple stemming if not available
try:
    from nltk.stem import PorterStemmer
    from nltk.corpus import words as nltk_words
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False
    print("NLTK not available. Using simple stemming. Install with: pip install nltk")

# Configuration - Using 2024 Wikipedia GloVe embeddings
# Available at: https://nlp.stanford.edu/projects/glove/
# Options: 50d, 100d, 200d, 300d
GLOVE_URL = "https://nlp.stanford.edu/data/wordvecs/glove.2024.wikigiga.100d.zip"
GLOVE_FILE = "wiki_giga_2024_100_MFT20_vectors_seed_2024_alpha_0.75_eta_0.05.050_combined.txt"
OUTPUT_FILE = "src/data/words.json"
TARGET_WORD_COUNT = 15000  # Aim for ~15k words after filtering
MIN_WORD_LENGTH = 2
MAX_WORD_LENGTH = 15
VECTOR_DIMENSIONS = 100

# Fallback to 6B (older but reliable) if 2024 isn't available
GLOVE_FALLBACK_URL = "https://nlp.stanford.edu/data/glove.6B.zip"
GLOVE_FALLBACK_FILE = "glove.6B.100d.txt"

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


def download_glove(data_dir):
    """Download GloVe embeddings if not already present."""
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    # Try 2024 embeddings first
    import zipfile
    zip_path = data_dir / "glove.2024.wikigiga.100d.zip"
    txt_path = data_dir / GLOVE_FILE

    if txt_path.exists():
        print(f"GloVe file already exists: {txt_path}")
        return txt_path

    # Try to download 2024 Wikipedia embeddings
    print(f"Attempting to download 2024 Wikipedia+Gigaword GloVe embeddings...")
    try:
        if not zip_path.exists():
            print(f"Downloading from {GLOVE_URL}...")
            print("This may take a while (approx 350MB)...")

            def progress_hook(block_num, block_size, total_size):
                if total_size > 0:
                    downloaded = block_num * block_size
                    percent = min(100, downloaded * 100 / total_size)
                    sys.stdout.write(f"\rProgress: {percent:.1f}% ({downloaded // (1024*1024)}MB / {total_size // (1024*1024)}MB)")
                    sys.stdout.flush()

            urllib.request.urlretrieve(GLOVE_URL, zip_path, progress_hook)
            print("\nDownload complete!")

        print(f"Extracting {GLOVE_FILE}...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extract(GLOVE_FILE, data_dir)
        print("Extraction complete!")
        return txt_path

    except Exception as e:
        print(f"\nFailed to download 2024 embeddings: {e}")
        print("Falling back to GloVe 6B (2014 Wikipedia + Gigaword)...")

        # Fallback to older embeddings
        import zipfile
        zip_path = data_dir / "glove.6B.zip"
        fallback_txt_path = data_dir / GLOVE_FALLBACK_FILE

        if fallback_txt_path.exists():
            print(f"Fallback file already exists: {fallback_txt_path}")
            return fallback_txt_path

        if not zip_path.exists():
            print(f"Downloading from {GLOVE_FALLBACK_URL}...")
            print("This may take a while (862MB)...")

            def progress_hook(block_num, block_size, total_size):
                downloaded = block_num * block_size
                percent = min(100, downloaded * 100 / total_size)
                sys.stdout.write(f"\rProgress: {percent:.1f}% ({downloaded // (1024*1024)}MB / {total_size // (1024*1024)}MB)")
                sys.stdout.flush()

            urllib.request.urlretrieve(GLOVE_FALLBACK_URL, zip_path, progress_hook)
            print("\nDownload complete!")

        print(f"Extracting {GLOVE_FALLBACK_FILE}...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extract(GLOVE_FALLBACK_FILE, data_dir)

        print("Extraction complete!")
        return fallback_txt_path


def is_valid_word(word):
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

    return True


def load_glove_embeddings(glove_path, max_words=None):
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

            if is_valid_word(word):
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


def deduplicate_by_stem(embeddings):
    """
    Group words by their stem and select a canonical representative.

    Strategy: For each stem group, select the shortest word (usually the root form).
    If tied, prefer words that appear earlier in GloVe (more common).
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


def save_to_json(embeddings, output_path):
    """Save embeddings to JSON format for the web app."""
    print(f"Saving to {output_path}...")

    # Convert to the format expected by the web app
    words = list(embeddings.keys())
    vectors = [embeddings[word] for word in words]

    data = {
        "words": words,
        "vectors": vectors
    }

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
    print("Using 2024 Wikipedia embeddings")
    print("=" * 60)

    # Determine paths
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    data_dir = project_dir / "data" / "glove"
    output_path = project_dir / OUTPUT_FILE

    # Step 1: Download GloVe
    glove_path = download_glove(data_dir)

    # Step 2: Load embeddings
    embeddings = load_glove_embeddings(glove_path)

    # Step 3: Deduplicate by stem
    embeddings = deduplicate_by_stem(embeddings)

    # Step 4: Select top words
    embeddings = select_top_words(embeddings, TARGET_WORD_COUNT)

    # Step 5: Normalize vectors
    embeddings = normalize_vectors(embeddings)

    # Step 6: Reduce precision for smaller file size
    embeddings = reduce_precision(embeddings, decimal_places=4)

    # Step 7: Save to JSON
    save_to_json(embeddings, output_path)

    # Step 8: Verify
    verify_output(output_path)

    print("\n" + "=" * 60)
    print("Processing complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
