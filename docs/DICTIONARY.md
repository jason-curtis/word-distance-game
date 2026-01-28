# Dictionary & Word List: Design Decisions

## The Problem

The word list needs to contain words that:
1. Players will recognize and can spell
2. Are unambiguously English
3. Have meaningful semantic relationships
4. Don't include offensive content

## Current Implementation (Jan 2025)

**Dictionary**: TWL06 (Scrabble Tournament Word List, 2006 edition)
**Filter**: Skip 2-letter words
**Ordering**: MiniLM embedding frequency
**Result**: 15,000 clean, playable English words

### TWL06 Provenance

**File**: `data/dictionaries/twl.txt`
**Word count**: 178,691
**MD5**: `2b216f92a5b356b43cdf579c71001456`

**Verification performed Jan 2026:**
- Word count matches [fogleman/TWL06](https://github.com/fogleman/TWL06) exactly (178,691)
- Contains known obscure Scrabble words: CWMS, CRWTH, SYZYGY, TSKTSK, ZYZZYVA ✓
- Correctly excludes EUOUAE (Collins/SOWPODS only, not in TWL) ✓
- Correctly excludes proper nouns: GOOGLE, OBAMA ✓
- Correctly excludes modern slang: BITCOIN, SELFIE, COVID, EMOJI ✓

**Note**: TWL06 is the 2006 Tournament Word List. North American tournament Scrabble
now uses NWL2023, but TWL06 remains suitable for word games as it contains
well-curated, recognizable English words without proper nouns or offensive terms.

### Why TWL Works

- No proper nouns (no "hewitt", "lukashenko", "warhol")
- No Chinese romanizations (no "wei", "zhang", "chen")
- Includes plurals and verb forms (dogs, running, etc.)
- Well-curated for word games

## Previous Issues (NLTK)

Using NLTK's words corpus resulted in:
- Chinese romanizations: wei, yu, wu, xu, liu, li, shu, zhao, feng, yang
- Proper nouns: hewitt, lukashenko, warhol, kristin
- Obscure technical terms
- Archaic words nobody uses

These appeared because NLTK's dictionary is descriptive (documents all words that appear in English texts) rather than prescriptive (common words people should know).

## Dictionary Options

### 1. NLTK Words Corpus (Current)
- **Size**: ~236k words
- **Source**: Various English dictionaries
- **Pros**: Comprehensive, easy to access via Python
- **Cons**: Too permissive, includes foreign words that appear in English texts

### 2. Scrabble Dictionaries (TWL/SOWPODS)
- **Size**: 180k (TWL) / 280k (SOWPODS)
- **Source**: Official Scrabble word lists
- **Pros**: Game-focused, well-curated
- **Cons**: Includes obscure valid Scrabble words, missing some common words

### 3. Google Common Words
- **Size**: 10k / 20k variants available
- **Source**: Google's word frequency analysis
- **Pros**: Only common words, frequency-ranked
- **Cons**: May exclude valid but less common words
- **Link**: Various GitHub repos host these lists

### 4. COCA (Corpus of Contemporary American English)
- **Size**: 60k common words
- **Source**: Academic corpus analysis
- **Pros**: Frequency-based, modern usage
- **Cons**: Requires processing

### 5. Custom Curated List
- **Size**: Whatever we want
- **Source**: Manual curation
- **Pros**: Full control, can optimize for game
- **Cons**: Significant effort

## Recommended Approach

### Two-Stage Filtering

**Stage 1: Frequency Filter**
Use position in GloVe file as frequency proxy (earlier = more common).
Only keep top N words (e.g., 50k candidates).

**Stage 2: Dictionary Validation**
Validate against a strict English dictionary that excludes:
- Proper nouns
- Abbreviations
- Foreign words adopted into English texts
- Single letters

### Exclusion Lists

Maintain explicit exclusion lists for:

```python
# Chinese romanizations that appear in NLTK
CHINESE_ROMANIZATIONS = {
    'wei', 'yu', 'wu', 'xu', 'liu', 'li', 'shu', 'zhao',
    'feng', 'yang', 'wang', 'zhang', 'chen', 'huang',
    'zhou', 'lin', 'zhu', 'sun', 'ma', 'hu', 'guo', 'he',
    'luo', 'zheng', 'liang', 'xie', 'han', 'tang', 'deng',
    # ... etc
}

# Other problematic words
EXCLUDE = {
    'xxx',  # Not a real word
    # Add as discovered
}
```

### Quality Signals

Words are more likely to be good game words if they:
- Are 3-12 letters long
- Contain only a-z (no hyphens, apostrophes)
- Appear in multiple dictionaries
- Have high frequency in modern corpora
- Are not proper nouns

## Implementation Plan

1. **Immediate**: Add exclusion list for known bad words
2. **Short-term**: Switch to Google 20k as primary dictionary
3. **Medium-term**: Build custom curated list with manual review
4. **Ongoing**: Add exclusion rules as problems are discovered

## Testing the Word List

Before finalizing, test by:
1. Spot-checking random samples of 100 words
2. Reviewing words at ranking boundaries (e.g., words #14900-15000)
3. Checking for offensive content
4. Verifying common words are included

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-28 | Verify TWL06 provenance | Confirmed 178,691 words matches fogleman/TWL06 |
| 2025-01-26 | Switch to TWL dictionary | Removes proper nouns, Chinese romanizations |
| 2025-01-26 | Skip 2-letter words | Too many obscure Scrabble words (aa, qi, etc.) |
| 2025-01-26 | ~~Use GloVe ordering~~ | ~~Frequency-based~~ (superseded by MiniLM) |
| 2025-01 | ~~NLTK words~~ | ~~Easy Python access~~ (superseded) |
