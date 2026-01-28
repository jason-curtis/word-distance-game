# Similarity Math: How Word Distance Works

## Core Concept

Each word is represented as a vector (list of numbers). Words with similar meanings have vectors that point in similar directions.

## Cosine Similarity

We use **cosine similarity** to measure how similar two word vectors are:

```
similarity(A, B) = (A · B) / (|A| × |B|)
```

- Range: -1 to +1
- +1 = identical direction (same meaning)
- 0 = perpendicular (unrelated)
- -1 = opposite direction (antonyms, sometimes)

### Example
```
cosine_similarity(king, queen) ≈ 0.80  (very similar)
cosine_similarity(king, apple) ≈ 0.15  (unrelated)
cosine_similarity(hot, cold)   ≈ 0.40  (related but different)
```

Note: Antonyms are often somewhat similar because they appear in similar contexts ("hot" and "cold" both appear near "weather", "temperature", etc.).

## Vector Algebra (Analogies)

The famous Word2Vec demo showed:
```
king - man + woman ≈ queen
```

### How It Works

The idea is that vector differences encode relationships:
- `king - man` = "royalty without maleness"
- Adding `woman` = "royalty with femaleness"
- Result ≈ `queen`

### The Math
```python
# Find word closest to: king - man + woman
target = vectors['king'] - vectors['man'] + vectors['woman']
closest = find_most_similar(target, all_vectors)
# Returns: queen
```

### Reality Check

This works **sometimes** but not always:
- Accuracy on analogy benchmarks: 40-70%
- The "king-queen" example is cherry-picked
- Many analogies fail or return unexpected results

### What Works Well
```
paris - france + italy = rome          ✓ (capitals)
walking - walk + swim = swimming       ✓ (verb forms)
king - man + woman = queen             ✓ (gender)
bigger - big + small = smaller         ✓ (comparatives)
```

### What Doesn't Work
```
singer = person + music                ✗ (not how it works)
doctor = person + medicine             ✗ (same issue)
happy + very = ???                     ✗ (intensifiers don't add)
```

The algebra works on **transformations** (change gender, change country) not on **composition** (combine concepts to make new ones).

## Why "singer ≠ person + music"

Word embeddings learn from **context** (which words appear near each other), not from **compositional semantics** (how concepts combine).

The vector for "singer" is close to: vocalist, musician, performer, artist, songwriter

But `person + music` gives you something like: "a person who is related to music somehow" - which could be listener, fan, producer, or singer.

### To get compositional semantics, you'd need:
- Knowledge graphs (ConceptNet)
- Explicit relation training
- Or a full language model that understands "a person who sings"

## Scoring in the Game

### Current Approach
1. Compute cosine similarity between guess and target
2. Convert to percentage: `score = (similarity + 1) / 2 * 100`
3. Rank against all other words

### Ranking System
Instead of raw similarity, we show rank:
- "Your guess is #42 closest to the target"
- More intuitive than abstract similarity scores
- Creates clear progression toward the answer

## Potential Improvements

### 1. Non-linear Scoring
Similarity differences matter more near the top:
- #1 vs #10 is a big deal
- #5000 vs #5010 doesn't matter
- Could use log scale for ranks

### 2. Hint System Using Vector Math
```python
# "The target is like X but more Y"
hint_direction = target - similar_word
# Find words in that direction
```

### 3. Difficulty Adjustment
- Easy: Target is a common, central word (many close neighbors)
- Hard: Target is specific, fewer close neighbors

## Technical Details

### Vector Normalization
All vectors are normalized to unit length before similarity calculation:
```python
normalized = vector / np.linalg.norm(vector)
```
This ensures cosine similarity equals dot product.

### Precision
Vectors are stored with 4 decimal places to reduce file size:
```python
[0.1234, -0.5678, 0.9012, ...]
```

### Dimensions
- Current: 50 dimensions (GloVe 50d)
- More dimensions = more nuance but larger file
- 300 dimensions is common for better quality
