# Word Embeddings: Design Decisions

This document explains the choices around word embeddings, dictionaries, and vector math for the word distance game.

## The Goal

Create a word game where:
1. Players guess words based on semantic similarity to a target
2. Vector math feels intuitive (e.g., concepts can be combined meaningfully)
3. The word list contains only recognizable English words

## Current State (as of Jan 2025)

**Embedding**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
**Dictionary**: TWL (Scrabble Tournament Word List)
**Word count**: 15,000 words
**File size**: 41 MB (JSON with 4 decimal precision)

This configuration scored 100% on all our semantic tests (see below).

## Embedding Options Comparison

### Static Word Embeddings (ship with app)

| Model | Year | Dims | ~Size (15k words) | Pros | Cons |
|-------|------|------|-------------------|------|------|
| **GloVe** | 2014 | 50-300 | 5-30 MB | Fast, small, famous "king-queen" demo | Trained on co-occurrence, not semantics |
| **Word2Vec** | 2013 | 300 | 18 MB | Original analogy model | Similar limitations to GloVe |
| **FastText** | 2016 | 300 | 18 MB | Handles word variants (singer/singers) | Same era as above |
| **ConceptNet Numberbatch** | 2019 | 300 | 18 MB | Built for common-sense reasoning | Last updated 2019, may be stale |

### Modern API-Based Embeddings (pre-compute once, ship result)

| Model | Dims | ~Size (15k words) | Cost to generate | Pros | Cons |
|-------|------|-------------------|------------------|------|------|
| **OpenAI text-embedding-3-small** | 512-1536 | 30-90 MB | ~$0.02 | High quality, modern | Large file, API dependency |
| **OpenAI text-embedding-3-large** | 3072 | 180 MB | ~$0.13 | Best quality | Very large file |
| **Cohere embed-v3** | 1024 | 60 MB | Similar | Good quality | API dependency |
| **Voyage AI** | 1024 | 60 MB | Similar | Strong performer | API dependency |

### Open-Source Modern Options (run locally, pre-compute)

| Model | Dims | Notes |
|-------|------|-------|
| **all-MiniLM-L6-v2** | 384 | Fast, small, good quality |
| **all-mpnet-base-v2** | 768 | Higher accuracy |
| **BGE/E5/GTE** | 768-1024 | State-of-art open source |

### OpenRouter Access

OpenRouter provides access to 22+ embedding models via unified API, including:
- OpenAI models
- Cohere models
- Various open-source options

This could simplify pre-computation by using one API for multiple model comparisons.

## The "Vector Algebra" Question

### What the user expects
```
singer ≈ person + music
king - man + woman = queen
```

### What actually works
The famous analogies work on **differences**, not addition:
```
king - man + woman = queen   ✓ (gender transformation)
paris - france + italy = rome ✓ (capital city transformation)
singer - sing + dance = dancer ✓ (action transformation)
```

But `singer = person + instrument` doesn't work because embeddings capture **co-occurrence patterns**, not compositional semantics.

### Which embeddings are best for this?

1. **Word2Vec/GloVe** - The original analogy demos used these
2. **ConceptNet Numberbatch** - Explicitly trained on relations like "IsA", "RelatedTo"
3. **Modern LLM embeddings** - Good at similarity, less tested for algebra

**Reality check**: Classic embeddings (Word2Vec, GloVe) get 40-60% on analogy benchmarks. Modern embeddings do much better - see our test results below.

## Dictionary Options

### Current: NLTK Words Corpus
- ~230k words
- Includes obscure/technical terms
- Includes romanizations of foreign words (wei, yu, wu, etc.)
- Too permissive for a word game

### Better Options

| Dictionary | Words | Pros | Cons |
|------------|-------|------|------|
| **NLTK words** | 230k | Large | Too permissive |
| **Scrabble TWL** | 180k | Game-focused | May lack common words |
| **Google 10k/20k** | 10-20k | Common words only | May be too restrictive |
| **Wordnik common** | Variable | Frequency-based | Requires API |
| **Custom curated** | 15k | Full control | Manual effort |

### Recommended Approach
1. Start with a frequency-based list (Google 10k, or top of GloVe by position)
2. Filter against a permissive dictionary (ensure words are real)
3. Manually review and remove problematic entries
4. Add missing common words

## Recommendations

### Short-term (fix current issues)
1. Switch to Google 10k/20k word list for dictionary validation
2. Keep GloVe 50d for now (small, fast, "good enough")
3. Add exclusion list for problematic words

### Medium-term (better embeddings)
1. Pre-compute embeddings using OpenAI or Sentence Transformers
2. Use `text-embedding-3-small` with 512 dimensions (good balance)
3. Or use `all-MiniLM-L6-v2` (384 dims, open source, no API needed)

### Long-term (best quality)
1. Fine-tune embeddings on word game data
2. Or use hybrid: fast static for gameplay + LLM for hints/explanations

## File Size Considerations

The game needs to ship embeddings with the app. Current budget: ~5-30MB.

| Configuration | Size |
|---------------|------|
| 15k words × 50 dims × 4 bytes | 3 MB |
| 15k words × 300 dims × 4 bytes | 18 MB |
| 15k words × 768 dims × 4 bytes | 46 MB |
| 15k words × 1536 dims × 4 bytes | 92 MB |

Can reduce with:
- Float16 instead of Float32 (halves size)
- Quantization (4-bit = 1/8 size)
- Dimensionality reduction (PCA)

## References

- [Comparing Embedding Models](https://dev.to/simplr_sh/comparing-popular-embedding-models-choosing-the-right-one-for-your-use-case-43p1)
- [OpenAI vs Sentence-Transformers](https://markaicode.com/embedding-models-comparison-openai-sentence-transformers/)
- [Static Word Embeddings Research (2025)](https://arxiv.org/abs/2506.04624)
- [State of Embedding Technologies](https://medium.com/@adnanmasood/the-state-of-embedding-technologies-for-large-language-models-trends-taxonomies-benchmarks-and-95e5ec303f67)
- [Top Embedding Models 2025](https://artsmart.ai/blog/top-embedding-models-in-2025/)

## Our Benchmark Results (Jan 2025)

We tested embedding models via OpenRouter API on three criteria:

1. **Similarity**: Do related words score higher than unrelated ones?
2. **Analogies**: Does `king - man + woman = queen` work?
3. **Clusters**: Are semantic groups (colors, animals, emotions) coherent?

### Test Results

| Model | Dims | Similarity | Analogy | Cluster | Overall | File Size (15k) |
|-------|------|-----------|---------|---------|---------|-----------------|
| **all-MiniLM-L6-v2** | 384 | 100% | 100% | 100% | **100%** | ~23 MB |
| qwen/qwen3-embedding-4b | 2560 | 100% | 100% | 100% | 100% | ~150 MB |
| qwen/qwen3-embedding-8b | 4096 | 100% | 100% | 100% | 100% | ~240 MB |
| openai/text-embedding-3-large | 3072 | 100% | 100% | 100% | 100% | ~180 MB |
| openai/text-embedding-3-small | 1536 | 95% | 94% | 100% | 96% | ~90 MB |
| GloVe 50d (previous) | 50 | ~80%* | ~60%* | ~90%* | ~77%* | 5 MB |

*GloVe estimates based on known limitations, not formally tested.

### Analogy Test Details

All models except text-embedding-3-small got these right:

```
man:king :: woman:? → queen ✓
france:paris :: italy:? → rome ✓
slow:slower :: fast:? → faster ✓
walk:walking :: run:? → running ✓
big:bigger :: small:? → smaller ✓
sing:singer :: write:? → writer ✓
dog:puppy :: cat:? → kitten ✓
```

### Why We Chose MiniLM

- **Same quality** as models 10x larger
- **384 dimensions** vs 2560-4096 for others
- **~23 MB file** vs 150-240 MB
- **Open source** model (Sentence Transformers)
- Available via OpenRouter for easy generation

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-01-26 | Switch to MiniLM embeddings | 100% on tests, 6x smaller than alternatives |
| 2025-01-26 | Switch to TWL dictionary | Removes proper nouns, Chinese romanizations |
| 2025-01-26 | Skip 2-letter words | Too many obscure Scrabble words |
| 2025-01 | ~~Using GloVe 50d~~ | ~~Small file size, quick start~~ (superseded) |
| 2025-01 | ~~NLTK dictionary~~ | ~~Easy to use, but too permissive~~ (superseded) |
