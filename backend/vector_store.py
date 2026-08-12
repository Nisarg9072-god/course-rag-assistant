"""
vector_store.py — ChromaDB persistent vector storage.

On first startup, migrates existing embedding.joblib chunks into ChromaDB
so existing videos are immediately searchable without reprocessing.

Supports:
  - add_chunks(video_id, chunks, embeddings)   — incremental insert
  - search(query_embedding, top_k, video_id)   — cross-course or video-scoped
  - delete_video(video_id)                     — clean reprocessing
  - migrate_from_joblib(df)                    — one-time migration
"""

import os
import json
import threading
from pathlib import Path
from typing import Optional

import numpy as np

BASE_DIR = Path(__file__).parent.parent
COLLECTION_NAME = "course_chunks"
EXPECTED_EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "1024"))
CHROMA_DIR = BASE_DIR / "data" / f"chroma_{EXPECTED_EMBEDDING_DIM}"
MIGRATION_MARKER = BASE_DIR / "data" / ".joblib_migrated"

_client = None
_collection = None
_lock = threading.Lock()


def _embedding_dim(vector) -> int:
    return int(np.array(vector).flatten().shape[0])


def _reset_collection():
    """Drop and recreate the Chroma collection (e.g. after dimension mismatch)."""
    global _client, _collection
    import shutil
    import gc
    with _lock:
        _collection = None
        if _client is not None:
            try:
                _client.delete_collection(COLLECTION_NAME)
            except Exception:
                pass
            _client = None
        gc.collect()
        if CHROMA_DIR.exists():
            shutil.rmtree(CHROMA_DIR, ignore_errors=True)
        os.makedirs(CHROMA_DIR, exist_ok=True)
        import chromadb
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        print(f"[VectorStore] Recreated collection '{COLLECTION_NAME}' at {CHROMA_DIR}")


def _ensure_collection_compatible(sample_embedding) -> bool:
    """Reset collection when stored vectors use a different dimension."""
    expected = _embedding_dim(sample_embedding)
    col = _get_collection()
    if col is None:
        return False
    if col.count() == 0:
        return True
    try:
        peek = col.get(limit=1, include=["embeddings"])
        existing = peek.get("embeddings") or []
        if existing and _embedding_dim(existing[0]) != expected:
            print(
                f"[VectorStore] Embedding dimension mismatch "
                f"(stored={_embedding_dim(existing[0])}, expected={expected}) — resetting index"
            )
            _reset_collection()
    except Exception as e:
        print(f"[VectorStore] Collection check failed ({e}) — resetting index")
        _reset_collection()
    return True


def _get_collection():
    """Lazily initialize ChromaDB client and collection (thread-safe)."""
    global _client, _collection
    if _collection is not None:
        return _collection
    with _lock:
        if _collection is not None:
            return _collection
        try:
            import chromadb
            os.makedirs(CHROMA_DIR, exist_ok=True)
            _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
            _collection = _client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
            print(f"[VectorStore] ChromaDB ready — {_collection.count()} chunks indexed")
        except ImportError:
            print("[VectorStore] WARNING: chromadb not installed. Run: pip install chromadb")
            _collection = None
    return _collection


def is_available() -> bool:
    return _get_collection() is not None


def add_chunks(video_id: str, chunks: list[dict], embeddings: list[list[float]]):
    """
    Add transcript chunks for a video to ChromaDB.

    chunks: list of {number, title, start, end, text, chunk_index}
    embeddings: parallel list of embedding vectors
    """
    if not embeddings:
        return
    _ensure_collection_compatible(embeddings[0])

    col = _get_collection()
    if col is None:
        return

    ids         = [f"{video_id}_chunk_{i}" for i in range(len(chunks))]
    documents   = [c["text"] for c in chunks]
    metadatas   = [
        {
            "video_id":    video_id,
            "number":      int(c.get("number", 0)),
            "title":       str(c.get("title", "")),
            "start":       float(c.get("start", 0)),
            "end":         float(c.get("end", 0)),
            "chunk_index": int(c.get("chunk_index", i)),
        }
        for i, c in enumerate(chunks)
    ]

    # Delete existing chunks for this video (for reprocessing)
    try:
        col.delete(where={"video_id": video_id})
    except Exception:
        pass

    try:
        col.add(
            ids=ids,
            embeddings=[list(e) for e in embeddings],
            documents=documents,
            metadatas=metadatas,
        )
    except Exception as e:
        if "dimension" in str(e).lower():
            print(f"[VectorStore] Dimension mismatch on add — resetting collection")
            _reset_collection()
            col = _get_collection()
            if col is None:
                raise
            col.add(
                ids=ids,
                embeddings=[list(e) for e in embeddings],
                documents=documents,
                metadatas=metadatas,
            )
        else:
            raise
    print(f"[VectorStore] Added {len(chunks)} chunks for {video_id}")


def search(
    query_embedding: list[float],
    top_k: int = 30,
    video_id: Optional[str] = None,
) -> list[dict]:
    """
    Semantic search across indexed chunks.

    Returns list of dicts compatible with the existing RAG response format:
      {number, title, start, end, text, similarity}
    """
    col = _get_collection()
    if col is None:
        return []

    where = {"video_id": video_id} if video_id else None

    try:
        results = col.query(
            query_embeddings=[list(query_embedding)],
            n_results=min(top_k, col.count()),
            where=where,
            include=["documents", "metadatas", "distances"],
        )
    except Exception as e:
        print(f"[VectorStore] Search error: {e}")
        return []

    hits = []
    metadatas = results.get("metadatas", [[]])[0]
    documents = results.get("documents", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for meta, doc, dist in zip(metadatas, documents, distances):
        # ChromaDB cosine distance → similarity: sim = 1 - dist
        similarity = max(0.0, 1.0 - float(dist))
        hits.append({
            "number":     meta.get("number", 0),
            "title":      meta.get("title", ""),
            "start":      meta.get("start", 0),
            "end":        meta.get("end", 0),
            "text":       doc,
            "similarity": round(similarity, 4),
            "videoUrl":   f"/api/videos/{meta.get('number', 0)}/stream",
        })

    # Sort by similarity descending
    hits.sort(key=lambda x: x["similarity"], reverse=True)
    return hits


def delete_video(video_id: str):
    """Remove all chunks for a video (used before reprocessing)."""
    col = _get_collection()
    if col is None:
        return
    try:
        col.delete(where={"video_id": video_id})
        print(f"[VectorStore] Deleted chunks for {video_id}")
    except Exception as e:
        print(f"[VectorStore] Delete error: {e}")


def get_chunk_count(video_id: Optional[str] = None) -> int:
    col = _get_collection()
    if col is None:
        return 0
    if video_id:
        try:
            r = col.get(where={"video_id": video_id})
            return len(r.get("ids", []))
        except Exception:
            return 0
    return col.count()


def migrate_from_joblib(df) -> bool:
    """
    One-time migration: insert all existing joblib embeddings into ChromaDB.
    Returns True if migration was performed, False if already done or skipped.
    """
    if MIGRATION_MARKER.exists():
        return False  # Already migrated

    rows = df.to_dict("records")
    if not rows:
        return False

    # Fresh migration: wipe any stale index (e.g. test vectors with wrong dimension).
    _reset_collection()

    col = _get_collection()
    if col is None:
        return False

    if col.count() > 0:
        # Already has compatible data — mark as migrated and skip
        MIGRATION_MARKER.touch()
        return False

    print(f"[VectorStore] Migrating {len(df)} chunks from embedding.joblib to ChromaDB...")

    BATCH = 500

    for start in range(0, len(rows), BATCH):
        batch = rows[start: start + BATCH]
        ids, embeddings, documents, metadatas = [], [], [], []

        for row in batch:
            vid_num  = int(row.get("number", 0))
            video_id = f"video_{vid_num}"
            chunk_i  = int(row.get("chunk_id", start))

            ids.append(f"{video_id}_chunk_{chunk_i}")
            embeddings.append(list(np.array(row["embedding"]).flatten().tolist()))
            documents.append(str(row.get("text", "")))
            metadatas.append({
                "video_id":    video_id,
                "number":      vid_num,
                "title":       str(row.get("title", "")),
                "start":       float(row.get("start", 0)),
                "end":         float(row.get("end", 0)),
                "chunk_index": chunk_i,
            })

        col.add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
        print(f"  Migrated batch {start // BATCH + 1}/{(len(rows) + BATCH - 1) // BATCH}")

    MIGRATION_MARKER.touch()
    print(f"[VectorStore] Migration complete - {col.count()} total chunks")
    return True
