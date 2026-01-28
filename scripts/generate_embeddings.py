#!/usr/bin/env python3
"""
Generate word embeddings using OpenRouter API.

This script:
1. Loads the TWL-filtered word list
2. Fetches embeddings from OpenRouter (MiniLM by default)
3. Saves to JSON for the web app

Usage:
    uv run python scripts/generate_embeddings.py

Requires OPENROUTER_API_KEY in .env file.
"""

import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()

# Configuration
MODEL = "sentence-transformers/all-MiniLM-L6-v2"  # 384 dims, 100% on tests
BATCH_SIZE = 100  # OpenRouter limit per request
OUTPUT_FILE = "src/data/words.json"
OPENROUTER_URL = "https://openrouter.ai/api/v1/embeddings"


def load_current_words() -> list[str]:
    """Load current word list (already filtered by TWL)."""
    with open("src/data/words.json") as f:
        data = json.load(f)
    return data["words"]


def get_embeddings_batch(words: list[str], api_key: str) -> dict[str, list[float]]:
    """Fetch embeddings for a batch of words."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": MODEL,
        "input": words,
    }

    response = requests.post(OPENROUTER_URL, headers=headers, json=payload)
    response.raise_for_status()

    data = response.json()

    result = {}
    for i, item in enumerate(data["data"]):
        result[words[i]] = item["embedding"]

    return result


def normalize_and_round(vector: list[float], decimals: int = 4) -> list[float]:
    """Normalize to unit length and round for smaller file size."""
    magnitude = sum(x ** 2 for x in vector) ** 0.5
    if magnitude > 0:
        return [round(x / magnitude, decimals) for x in vector]
    return vector


def main():
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("ERROR: OPENROUTER_API_KEY not found in .env")
        sys.exit(1)

    print("=" * 60)
    print(f"Generating embeddings with {MODEL}")
    print("=" * 60)

    # Load words
    print("\nLoading word list...")
    words = load_current_words()
    print(f"  {len(words):,} words to process")

    # Fetch embeddings in batches
    print(f"\nFetching embeddings (batch size {BATCH_SIZE})...")
    all_embeddings = {}

    for i in tqdm(range(0, len(words), BATCH_SIZE), desc="Batches"):
        batch = words[i:i + BATCH_SIZE]

        try:
            embeddings = get_embeddings_batch(batch, api_key)
            all_embeddings.update(embeddings)
        except requests.exceptions.HTTPError as e:
            print(f"\nERROR at batch {i}: {e}")
            print(f"Response: {e.response.text[:500]}")
            sys.exit(1)

        # Small delay to avoid rate limiting
        time.sleep(0.1)

    print(f"\nGot {len(all_embeddings):,} embeddings")
    dims = len(next(iter(all_embeddings.values())))
    print(f"  Dimensions: {dims}")

    # Normalize vectors
    print("\nNormalizing vectors...")
    for word in all_embeddings:
        all_embeddings[word] = normalize_and_round(all_embeddings[word])

    # Save
    output_path = Path(OUTPUT_FILE)
    print(f"\nSaving to {output_path}...")

    # Maintain word order from original list
    vectors = [all_embeddings[w] for w in words]

    data = {
        "words": words,
        "vectors": vectors,
        "model": MODEL,
        "dimensions": dims,
    }

    with open(output_path, "w") as f:
        json.dump(data, f, separators=(",", ":"))

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"  Saved {len(words):,} words ({size_mb:.2f} MB)")

    # Verify
    print("\nVerification:")
    print(f"  First 5 words: {words[:5]}")
    print(f"  Last 5 words: {words[-5:]}")

    # Quick similarity test
    def cosine_sim(a, b):
        return sum(x * y for x, y in zip(a, b))

    if "king" in all_embeddings and "queen" in all_embeddings:
        sim = cosine_sim(all_embeddings["king"], all_embeddings["queen"])
        print(f"  king-queen similarity: {sim:.4f}")

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()
