# Visualization Iteration Notes

## Overview
This document tracks our iterations on the semantic word visualization for the Semantle-style word guessing game.

---

## Iteration 1: Random Angles
**Approach**: Distance from center = log(rank), angle = random per word

**Problem**: Angles had no meaning - words just scattered randomly around the bullseye.

---

## Iteration 2: PCA on Raw Embeddings
**Approach**: Apply PCA to the raw word vectors, use PC1/PC2 for x/y positioning

**Problem**: All words clustered on a line (x ≈ y or x ≈ -y). This happens because word embeddings tend to cluster in a region of high-dimensional space, so PCA finds the main axis of that cluster rather than meaningful semantic directions.

---

## Iteration 3: PCA on Difference Vectors
**Approach**: Compute (guess_vector - target_vector) for each guess, then PCA on those difference vectors. This captures "how each word differs from the target."

**Insight from user**: "We should be mapping the raw embeddings directly... goals: 1. distance from the target word is meaningful. 2. guesses are naturally grouped in a way that explains how they relate to the target word."

**Result**: Better spread, but angles still don't have intuitive meaning for the player.

---

## Iteration 4: Log-scale Bullseye with PCA Angles
**Approach**:
- Distance from center = log(rank) - puts similar words near center
- Angle = derived from PCA projection of difference vectors
- Colored rings show rank thresholds (Top 10, 100, 1000, 5000)

**Current state**: This is working. The bullseye gives clear visual feedback on rank. Angles cluster semantically similar guesses together.

---

## Iteration 5: 3D Mode with Auto-Rotation
**Approach**: Extend to 3 principal components, render as rotating 3D sphere

**Features**:
- Auto-rotation with gentle wobble
- Pause/play button, drag to manually rotate
- Wireframe great circles for rank boundaries
- Depth lines, glow effects, depth-based sizing
- Z-sorting for proper occlusion

**Problem noted**: When rotating, projected distance to center changes, breaking the "distance = rank" invariant. User suggested this is okay for eye candy if it auto-rotates.

**Future consideration**: Three.js would be cleaner for proper 3D, but sticking with SVG/D3 for now.

---

## Iteration 6: Smooth Transitions
**Approach**: Refactored D3 rendering to use proper data joins with enter/update/exit pattern

**Features**:
- New guesses animate from center (or previous position) to new position
- Fast transitions in 3D rotation mode, slower for new guesses
- Points smoothly reposition when PCA axes shift

---

---

## Iteration 7: "Hot Pairs" Combination Hints
**Observation**: When target is "singers", guesses like "person" and "instrument" are both far from target but close to each other in angle (20° apart). Intuitively, "singers" is a combination of person + instrument concepts.

**Implementation**:
- For each pair of guesses, compute the midpoint of their embedding vectors
- Check if midpoint has higher cosine similarity to target than either guess
- If improvement > 0.02, mark as a "hot pair"
- Draw curved arcs between hot pairs, curving toward the center
- Arrow on arc points toward center, suggesting "try something in this direction"
- Toggle with "Hints" button (amber colored)

**Visual Design**:
- Dashed amber arcs with glow effect
- Arc curves toward center (control point pulled toward origin)
- Small arrow at midpoint of arc pointing toward target
- Opacity decreases for lower-ranked pairs (top 5 shown)

---

## Open Questions / Future Ideas

### Additional Combination Visualizations
1. **Centroid marker**: Show the centroid/average of all guesses - does it point toward the target?
2. **Vector field**: Show arrows indicating "direction toward closer words" based on the embedding gradient
3. **Convex hull**: Draw the hull of guesses, indicate if target is likely inside/outside
4. **Connecting lines**: Draw lines between guesses that are semantically close to each other (not just to target), revealing clusters
5. **"Hot/cold" regions**: Heat map showing interpolated "closeness to target" across the visible space

### Alternative Dimensionality Reduction
- **MDS (Multidimensional Scaling)**: Preserve pairwise distances between all words including target
- **t-SNE / UMAP**: Non-linear projections that might reveal clusters better
- **Custom projection**: Project onto the plane defined by two guess vectors

### Visual Polish
- Better sphere rendering (consider three.js for WebGL)
- Particle effects for new guesses
- Trails showing guess history
- Animated "pulse" on closest guess

---

## Technical Notes

### PCA Implementation
Using power iteration to find eigenvectors of covariance matrix:
1. Compute difference vectors (guess - target)
2. Center the differences
3. Compute covariance matrix
4. Power iteration with deflation for PC1, PC2, PC3
5. Gram-Schmidt orthogonalization ensures orthogonal components

### Log Scale for Rank
```
radius = (log10(rank) / log10(totalWords)) * maxRadius
```
This spreads out low ranks (close words) and compresses high ranks (distant words).

### Data Flow
1. `useGame` hook provides: guesses, rankings, targetWord, wordVectors
2. `plotPoints` memo computes 3D positions from PCA
3. `screenPoints` memo applies rotation and projects to 2D
4. D3 renders with data joins for smooth transitions
