import requests
import json
import os
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import joblib

def create_embedding(text_lists):
    r = requests.post("http://localhost:11434/api/embed", json={
        "model": "bge-m3",
        "input": text_lists
    }, timeout=120)

    if not r.ok:
        raise RuntimeError(f"Ollama API error {r.status_code}: {r.text}")

    data = r.json()

    if "embeddings" not in data:
        raise KeyError(f"'embeddings' key not found in response. Full response: {data}")

    vecs = data["embeddings"]
    if isinstance(vecs, dict):
        # Some Ollama versions return {"0": [...], "1": [...]} instead of a list
        vecs = [vecs[str(i)] for i in range(len(vecs))]
    if not isinstance(vecs, list):
        raise TypeError(f"Expected embeddings list, got {type(vecs)}: {data}")
    if len(vecs) != len(text_lists):
        raise RuntimeError(
            f"Embedding count mismatch: got {len(vecs)} vectors for {len(text_lists)} texts"
        )

    return vecs


BATCH_SIZE = 32

def batch_embed(texts, max_batches=None):
    """Embed texts in batches to avoid overwhelming the Ollama model runner.
    max_batches: if set, stop after this many batches (for testing).
    """
    all_embeddings = []
    n_total = (len(texts) + BATCH_SIZE - 1) // BATCH_SIZE
    for batch_num, start in enumerate(range(0, len(texts), BATCH_SIZE)):
        if max_batches is not None and batch_num >= max_batches:
            print(f"  [TEST] Stopped after {max_batches} batches.")
            break
        batch = texts[start: start + BATCH_SIZE]
        print(f"  Batch {batch_num + 1}/{n_total} ({len(batch)} chunks)...")
        all_embeddings.extend(create_embedding(batch))
    return all_embeddings


jsons = sorted(f for f in os.listdir("json") if f.endswith(".json"))

my_dicts = []
chunk_id = 0

for json_file in jsons:
    try:
        with open(f"json/{json_file}", encoding="utf-8") as f:
            content = json.load(f)
        chunks = content.get("chunks", [])
        if not chunks:
            print(f"  Skipping {json_file} — no chunks")
            continue

        print(f"creating Embeddings for {json_file}")
        embeddings = batch_embed([c["text"] for c in chunks], max_batches=None)

        for i, chunk in enumerate(chunks):
            chunk["chunk_id"] = chunk_id
            chunk["embedding"] = embeddings[i]
            chunk_id += 1
            my_dicts.append(chunk)

        print(f"completed {json_file}")
    except Exception as e:
        print(f"ERROR processing {json_file}: {e}")
        raise

df = pd.DataFrame.from_records(my_dicts)
# save this dataframe
joblib.dump(df, "embedding.joblib")


