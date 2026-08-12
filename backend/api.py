"""
Course RAG Assistant — Flask API Backend
Wraps the existing RAG pipeline and exposes REST endpoints for the frontend.

Run:
    pip install flask flask-cors requests pandas numpy scikit-learn joblib
    python backend/api.py

Endpoints:
    POST /api/ask                   — Ask a question, get AI answer + sources
    GET  /api/videos                — List all course videos
    GET  /api/videos/<id>           — Get single video + transcript
    GET  /api/videos/<id>/stream    — Stream the actual MP4 (Range-aware)
    GET  /api/search                — Semantic search (returns sources only)
    GET  /api/stats                 — Course statistics
"""

import os
import sys
import json
import glob
import re
import threading
import uuid
from pathlib import Path


def _load_env_files():
    """Load KEY=VALUE pairs from backend/.env and project .env (if present)."""
    base = Path(__file__).resolve().parent
    for path in (base / ".env", base.parent / ".env"):
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                os.environ[key] = value


_load_env_files()

import numpy as np
import pandas as pd
import requests as http_requests
from flask import Flask, request, jsonify, abort, Response
from flask_cors import CORS
from sklearn.metrics.pairwise import cosine_similarity
import joblib

# Local modules (same package when run as python backend/api.py)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import (  # noqa: E402
    init_db, list_videos as db_list_videos, get_video_by_number, get_video_by_id,
    create_video, create_job, get_job, get_latest_job_for_video,
    list_jobs, update_video_status, delete_video as db_delete_video,
    video_number_exists, find_by_file_hash, find_by_youtube_id,
    get_transcript_chunks, get_admin_stats, has_active_job,
    recover_stale_jobs,
)
import vector_store  # noqa: E402
from processor import start_processing, compute_file_hash, extract_youtube_id, is_video_processing  # noqa: E402
from seed import seed_from_legacy  # noqa: E402
from auth import require_admin, verify_password, create_token, revoke_token, get_bearer_token  # noqa: E402
import rag as rag_pipeline  # noqa: E402
from rag import extract_video_number, filter_and_rank_hits, select_context_chunks, detect_intent  # noqa: E402

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(BASE_DIR, "json")
VIDEO_DIR = os.path.join(BASE_DIR, "Video")
AUDIO_DIR = os.path.join(BASE_DIR, "audios")
EMBEDDING_PATH = os.path.join(BASE_DIR, "embedding.joblib")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
TOP_RESULTS = 30
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "2048"))
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get(
        "CORS_ORIGINS", f"{FRONTEND_URL},http://localhost:5174,http://localhost:5175"
    ).split(",") if o.strip()
]

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=True)

# ── Load embeddings once at startup ───────────────────────────────────────────
df_lock = threading.Lock()
df: pd.DataFrame = None  # type: ignore

def _ensure_chroma_populated():
    """Re-migrate joblib → Chroma if the vector index is nearly empty."""
    if df is None or not vector_store.is_available():
        return
    chroma_count = vector_store.get_chunk_count()
    joblib_count = len(df)
    if chroma_count >= joblib_count * 0.9:
        return
    marker = vector_store.MIGRATION_MARKER
    if marker.exists():
        marker.unlink()
    print(f"[API] ChromaDB under-populated ({chroma_count}/{joblib_count}) — re-migrating...")
    vector_store.migrate_from_joblib(df)


def _run_video_rag_response(
    question: str,
    vid_num: int,
    db_row: dict,
    debug: bool = False,
) -> dict:
    result = rag_pipeline.run_video_rag(
        question,
        vid_num,
        db_row["title"],
        db_row["id"],
        embed_fn=create_embedding,
        search_fn=find_similar_chunks,
        llm_fn=llm_generate,
        debug=debug,
    )
    sources = [_format_source(s) for s in result.get("sources", [])]
    sources = _validate_sources(sources)
    # Sources must match context used — use same chunks
    resp = {
        "answer": result["answer"],
        "sources": sources,
        "intent": result.get("intent"),
    }
    if debug and "debug" in result:
        resp["debug"] = result["debug"]
    return resp


def load_embeddings():
    global df
    if os.path.exists(EMBEDDING_PATH):
        with df_lock:
            df = joblib.load(EMBEDDING_PATH)
        print(f"[API] Loaded embeddings: {len(df)} chunks")
    elif vector_store.is_available() and vector_store.get_chunk_count() > 0:
        print(f"[API] Using ChromaDB ({vector_store.get_chunk_count()} chunks)")
    else:
        print(f"[API] WARNING: No embeddings loaded. Run read_chunks.py or add a video via admin.")


# ── Video file discovery ───────────────────────────────────────────────────────

# Cache: {video_number: filename}
_video_file_cache: dict[int, str] = {}
_cache_lock = threading.Lock()


def find_video_file(number: int) -> str | None:
    """
    Scan the Video/ directory and return the filename for a given tutorial number.

    Filenames look like:
      'CSS Box Model - Margin, Padding & Borders ｜ Sigma Web Development Course - Tutorial #18 [Xrxd6cEajhM].mp4'

    Special case: video #21 is 'sample.mp4' (no Tutorial # pattern).
    """
    with _cache_lock:
        if number in _video_file_cache:
            return _video_file_cache[number]

    if not os.path.isdir(VIDEO_DIR):
        return None

    # Primary pattern:  "Tutorial #<N> " or "Tutorial #<N>."  (handles ≥1 digit)
    primary = re.compile(rf"Tutorial #0*{number}[\s\[\.]", re.IGNORECASE)
    # Uploaded videos: "#19 CSS Positioning.mp4"
    upload_pat = re.compile(rf"^#0*{number}\s", re.IGNORECASE)
    # Fallback for padded zeros:  "#01 ", "#1 " variants
    fallback = re.compile(rf"#0*{number}[\s\[]", re.IGNORECASE)

    for fname in os.listdir(VIDEO_DIR):
        if not fname.lower().endswith(".mp4"):
            continue
        if primary.search(fname) or upload_pat.match(fname):
            with _cache_lock:
                _video_file_cache[number] = fname
            return fname
        if number == 21 and fname == "sample.mp4":
            with _cache_lock:
                _video_file_cache[number] = fname
            return fname
        # fallback for files without "Tutorial" keyword
        if fallback.search(fname):
            with _cache_lock:
                _video_file_cache[number] = fname
            return fname

    return None


def extract_title_from_filename(filename: str) -> str:
    """
    Extract a clean title from a full video filename.

    Input:  'CSS Box Model - Margin, Padding & Borders ｜ Sigma Web Development Course - Tutorial #18 [abc].mp4'
    Output: 'CSS Box Model - Margin, Padding & Borders'
    """
    # Remove .mp4
    name = os.path.splitext(filename)[0]
    # Split on ｜ (full-width pipe) or | (normal pipe)
    parts = re.split(r"\s*[｜|]\s*", name)
    return parts[0].strip() if parts else name.strip()


# ── Helpers ───────────────────────────────────────────────────────────────────
def format_time(seconds: float) -> str:
    """Convert seconds to MM:SS string."""
    total = int(seconds)
    m, s = divmod(total, 60)
    return f"{m:02d}:{s:02d}"


def create_embedding(text: str) -> list:
    """Call Ollama bge-m3 to embed a text string."""
    r = http_requests.post(f"{OLLAMA_URL}/api/embed", json={
        "model": "bge-m3",
        "input": [text]
    }, timeout=60)
    r.raise_for_status()
    data = r.json()
    if "embeddings" not in data:
        raise RuntimeError(f"Unexpected Ollama response: {data}")
    return data["embeddings"][0]


def llm_generate(prompt: str) -> str:
    """Call Ollama LLaMA 3.2 to generate a response."""
    r = http_requests.post(f"{OLLAMA_URL}/api/generate", json={
        "model": "llama3.2",
        "prompt": prompt,
        "stream": False
    }, timeout=120)
    r.raise_for_status()
    return r.json().get("response", "")


def find_similar_chunks(question_embedding: list, top_k: int = TOP_RESULTS,
                        video_id: str | None = None) -> list[dict]:
    """Search ChromaDB when available, otherwise fall back to joblib."""
    if vector_store.is_available():
        hits = vector_store.search(question_embedding, top_k=top_k, video_id=video_id)
        if hits:
            for h in hits:
                vid_num = int(h["number"])
                actual_file = find_video_file(vid_num)
                h["videoUrl"] = f"/api/videos/{vid_num}/stream" if actual_file else None
            return hits

    with df_lock:
        if df is None:
            return []
        subset = df
        if video_id:
            vid_num = int(video_id.replace("video_", ""))
            subset = df[df["number"].astype(int) == vid_num]
            if subset.empty:
                return []
        all_embeddings = np.vstack(subset["embedding"].values)
        q_vec = np.array(question_embedding).reshape(1, -1)
        similarities = cosine_similarity(all_embeddings, q_vec).flatten()
        top_indices = similarities.argsort()[::-1][:top_k]
        result = subset.iloc[top_indices].copy()
        result["similarity"] = similarities[top_indices]

    sources = []
    for _, row in result.iterrows():
        vid_num = int(row["number"])
        actual_file = find_video_file(vid_num)
        sources.append({
            "number": vid_num,
            "title": row["title"],
            "start": float(row["start"]),
            "end": float(row.get("end", row["start"] + 10)),
            "text": row["text"],
            "similarity": float(row.get("similarity", 0)),
            "videoUrl": f"/api/videos/{vid_num}/stream" if actual_file else None,
        })
    return sources


def _video_stream_url(number: int, video_row: dict | None = None) -> str | None:
    if video_row and video_row.get("source_type") == "youtube":
        return None
    filename = (video_row or {}).get("filename") or find_video_file(number)
    return f"/api/videos/{number}/stream" if filename else None


def _format_source(hit: dict) -> dict:
    """Normalize search/RAG hit to API response (backward-compatible)."""
    vid_num = int(hit["number"])
    actual_file = find_video_file(vid_num)
    return {
        "videoId": str(vid_num),
        "videoNumber": vid_num,
        "number": vid_num,
        "title": hit["title"],
        "start": float(hit["start"]),
        "end": float(hit.get("end", hit["start"] + 10)),
        "text": hit["text"],
        "similarity": float(hit.get("similarity", 0)),
        "videoUrl": hit.get("videoUrl") or (f"/api/videos/{vid_num}/stream" if actual_file else None),
    }


def _validate_sources(sources: list[dict]) -> list[dict]:
    """Drop sources pointing at missing or non-ready videos."""
    ready = {v["number"]: v for v in parse_video_list(include_processing=False)}
    valid = []
    for s in sources:
        num = int(s.get("number") or s.get("videoNumber") or 0)
        video = ready.get(num)
        if not video:
            continue
        start = max(0.0, float(s["start"]))
        end = float(s.get("end", start + 10))
        duration = float(video.get("duration") or 0)
        if duration > 0 and start > duration:
            continue
        s = dict(s)
        s["start"] = start
        s["end"] = end if end >= start else start + 10
        s["title"] = video.get("title") or s.get("title", "")
        valid.append(s)
    return valid


def _is_valid_mp4(filepath: str) -> bool:
    """Check MP4 magic bytes (ftyp box)."""
    try:
        with open(filepath, "rb") as f:
            header = f.read(12)
        return len(header) >= 8 and header[4:8] == b"ftyp"
    except OSError:
        return False


def _parse_positive_int(value, name: str = "id") -> int | None:
    try:
        n = int(value)
        if n < 1:
            return None
        return n
    except (TypeError, ValueError):
        return None


def _db_video_to_api(v: dict) -> dict:
    number = int(v["number"])
    filename = v.get("filename") or find_video_file(number)
    item = {
        "id": v["id"],
        "number": number,
        "title": v["title"],
        "duration": float(v.get("duration") or 0),
        "chunkCount": int(v.get("chunk_count") or 0),
        "status": v.get("status", "ready"),
        "sourceType": v.get("source_type", "upload"),
        "youtubeVideoId": v.get("youtube_video_id"),
        "sourceUrl": v.get("source_url"),
        "videoFile": filename,
        "videoUrl": _video_stream_url(number, v),
    }
    job = get_latest_job_for_video(v["id"])
    if job:
        item["job"] = {
            "id": job["id"],
            "status": job["status"],
            "stage": job["stage"],
            "progress": job["progress"],
            "errorMessage": job.get("error_msg"),
        }
        if job["status"] in ("queued", "processing", "failed"):
            item["processingStage"] = job["stage"]
    return item


def parse_video_list(include_processing: bool = True) -> list:
    """
    Build video list from SQLite (source of truth) with legacy json/ fallback.
    """
    db_videos = db_list_videos()
    if db_videos:
        items = [_db_video_to_api(v) for v in db_videos]
        if not include_processing:
            items = [v for v in items if v.get("status") == "ready"]
        return items

    # Legacy fallback when DB is empty
    """
    Read all JSON files from json/ and build the video list.
    Tries to resolve the actual MP4 filename from the Video/ directory.
    """
    videos = []
    json_files = sorted(glob.glob(os.path.join(JSON_DIR, "*.json")))
    for path in json_files:
        fname = os.path.basename(path)
        # Pattern: "01_Title.mp3.json"
        match = re.match(r"^(\d+)_(.+?)\.mp3\.json$", fname)
        if not match:
            continue
        number = int(match.group(1))
        json_title = match.group(2)  # e.g. "CSS Box Model - Margin, Padding & Borders"

        try:
            with open(path, encoding="utf-8") as f:
                content = json.load(f)
            chunks = content.get("chunks", [])
            duration = chunks[-1]["end"] if chunks else 0
            chunk_count = len(chunks)
        except Exception:
            duration = 0
            chunk_count = 0

        # Resolve actual video filename
        actual_file = find_video_file(number)
        clean_title = (
            extract_title_from_filename(actual_file) if actual_file else json_title
        )

        videos.append({
            "number": number,
            "title": clean_title,
            "duration": duration,
            "chunkCount": chunk_count,
            # videoFile kept for backwards-compat but may not be the actual name
            "videoFile": actual_file or f"{number:02d}_{json_title}.mp4",
            # Canonical streaming URL — use this in the frontend
            "videoUrl": f"/api/videos/{number}/stream" if actual_file else None,
        })
    return videos


def get_video_transcript(video_number: int) -> list:
    """Return transcript chunks — DB first, then legacy json/."""
    db_row = get_video_by_number(video_number)
    if db_row:
        chunks = get_transcript_chunks(db_row["id"])
        if chunks:
            return [{
                "number": video_number,
                "title": db_row["title"],
                "start": float(c["start_time"]),
                "end": float(c["end_time"]),
                "text": c["text"],
            } for c in chunks]

    json_files = glob.glob(os.path.join(JSON_DIR, f"{video_number:02d}_*.json"))
    if not json_files:
        return []
    try:
        with open(json_files[0], encoding="utf-8") as f:
            content = json.load(f)
        return content.get("chunks", [])
    except Exception:
        return []


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/stats", methods=["GET"])
def stats():
    """Return course statistics."""
    admin = get_admin_stats()
    videos = parse_video_list()
    ready = [v for v in videos if v.get("status", "ready") == "ready"]
    total_duration = sum(v["duration"] for v in ready)
    total_chunks = sum(v["chunkCount"] for v in ready)
    chroma_count = vector_store.get_chunk_count() if vector_store.is_available() else 0
    return jsonify({
        "videoCount": len(ready) or admin.get("readyVideos", len(videos)),
        "totalVideos": admin.get("totalVideos", len(videos)),
        "readyVideos": admin.get("readyVideos", len(ready)),
        "processingVideos": admin.get("processingVideos", 0),
        "failedVideos": admin.get("failedVideos", 0),
        "totalDurationSeconds": total_duration,
        "totalDurationHours": round(total_duration / 3600, 1),
        "totalChunks": total_chunks or admin.get("totalChunks", 0),
        "indexedChunks": chroma_count,
        "embeddingsLoaded": df is not None or vector_store.is_available(),
    })


@app.route("/api/videos", methods=["GET"])
def list_videos():
    """List all course videos."""
    return jsonify(parse_video_list())


@app.route("/api/videos/<int:video_id>", methods=["GET"])
def get_video(video_id: int):
    """Get a single video with its transcript."""
    db_row = get_video_by_number(video_id)
    if db_row:
        video = _db_video_to_api(db_row)
        video["transcript"] = get_video_transcript(video_id)
        job = get_latest_job_for_video(db_row["id"])
        if job:
            video["job"] = {
                "id": job["id"],
                "status": job["status"],
                "stage": job["stage"],
                "progress": job["progress"],
                "errorMessage": job.get("error_msg"),
            }
        return jsonify(video)

    videos = parse_video_list()
    video = next((v for v in videos if v["number"] == video_id), None)
    if not video:
        abort(404, description=f"Video #{video_id} not found")
    video["transcript"] = get_video_transcript(video_id)
    return jsonify(video)


@app.route("/api/videos/<int:video_id>/stream", methods=["GET"])
def stream_video(video_id: int):
    """
    Stream the actual MP4 file for a given video number.
    Supports HTTP Range requests so the browser can seek.

    Security:
    - video_id is an integer — no path traversal possible
    - filename is looked up from our internal mapping (not from user input)
    - os.path.realpath ensures the resolved path stays inside VIDEO_DIR
    """
    filename = find_video_file(video_id)
    db_row = get_video_by_number(video_id)
    if db_row and db_row.get("source_type") == "youtube":
        abort(404, description=f"Video #{video_id} is a YouTube source — use the embedded player")
    if db_row and db_row.get("filename"):
        filename = db_row["filename"]
    if not filename:
        abort(404, description=f"Video file for #{video_id} not found on disk")

    # Absolute path — safe because filename came from our own directory scan
    filepath = os.path.join(VIDEO_DIR, filename)
    real_path = os.path.realpath(filepath)
    real_video_dir = os.path.realpath(VIDEO_DIR)

    # Prevent path traversal (belt-and-suspenders)
    if not real_path.startswith(real_video_dir + os.sep) and real_path != real_video_dir:
        abort(403, description="Access denied")

    if not os.path.isfile(real_path):
        abort(404, description=f"File not found: {filename}")

    file_size = os.path.getsize(real_path)
    range_header = request.headers.get("Range")

    # ── No Range: serve the whole file ────────────────────────────────────
    if not range_header:
        def generate_full():
            with open(real_path, "rb") as fh:
                while True:
                    chunk = fh.read(1024 * 256)  # 256 KB chunks
                    if not chunk:
                        break
                    yield chunk

        return Response(
            generate_full(),
            status=200,
            mimetype="video/mp4",
            headers={
                "Content-Length": str(file_size),
                "Accept-Ranges": "bytes",
                "Content-Disposition": "inline",
            },
        )

    # ── Range request: serve partial content ───────────────────────────────
    # Parse "bytes=start-end"
    range_match = re.match(r"bytes=(\d*)-(\d*)", range_header)
    if not range_match:
        abort(416, description="Invalid Range header")

    start_str, end_str = range_match.group(1), range_match.group(2)
    byte_start = int(start_str) if start_str else 0
    byte_end = int(end_str) if end_str else file_size - 1

    # Clamp
    byte_end = min(byte_end, file_size - 1)
    if byte_start > byte_end or byte_start >= file_size:
        abort(416, description="Range not satisfiable")

    content_length = byte_end - byte_start + 1
    chunk_size = 1024 * 256  # 256 KB

    def generate_partial():
        remaining = content_length
        with open(real_path, "rb") as fh:
            fh.seek(byte_start)
            while remaining > 0:
                data = fh.read(min(chunk_size, remaining))
                if not data:
                    break
                remaining -= len(data)
                yield data

    return Response(
        generate_partial(),
        status=206,
        mimetype="video/mp4",
        headers={
            "Content-Range": f"bytes {byte_start}-{byte_end}/{file_size}",
            "Content-Length": str(content_length),
            "Accept-Ranges": "bytes",
            "Content-Disposition": "inline",
        },
    )


@app.route("/api/ask", methods=["POST"])
def ask():
    """
    Ask a question. Returns AI answer + top source chunks.
    Body: { "question": "What is the CSS box model?", "debug": false }
    """
    body = request.get_json(force=True)
    question = (body.get("question") or "").strip()
    debug = bool(body.get("debug"))
    if not question:
        return jsonify({"error": "question is required"}), 400

    if df is None and not vector_store.is_available():
        return jsonify({"error": "Embeddings not loaded. Run read_chunks.py first."}), 503

    # Route video-specific queries to scoped pipeline
    detected_vid = extract_video_number(question)
    if detected_vid is not None:
        db_row = get_video_by_number(detected_vid)
        if db_row and db_row.get("status") == "ready":
            try:
                return jsonify(_run_video_rag_response(question, detected_vid, db_row, debug=debug))
            except http_requests.exceptions.ConnectionError:
                return jsonify({"error": "Cannot connect to Ollama."}), 503
            except Exception as e:
                return jsonify({"error": str(e)}), 500

    try:
        q_embedding = create_embedding(question)
        similar = find_similar_chunks(q_embedding, top_k=rag_pipeline.CANDIDATE_POOL)
        ready_nums = {v["number"] for v in parse_video_list(include_processing=False)}
        similar = [s for s in similar if s["number"] in ready_nums]

        ranked = filter_and_rank_hits(similar, detect_intent(question))
        context = select_context_chunks(ranked, "VIDEO_QA")[:rag_pipeline.MAX_CONTEXT_CHUNKS]

        if not context:
            return jsonify({
                "answer": "I couldn't find enough relevant course content to answer that question.",
                "sources": [],
                "intent": "VIDEO_QA",
            })

        sources = [_format_source(s) for s in context[:rag_pipeline.MAX_SOURCE_CHUNKS]]
        sources = _validate_sources(sources)

        chunks_json = json.dumps([
            {"title": s["title"], "number": s["number"], "text": s["text"], "start": s["start"]}
            for s in context
        ])
        prompt = f"""You are a course assistant for a web development course.

Use ONLY the transcript chunks below. Do not invent timestamps or content.
If the context is insufficient, say you could not find enough information.

{chunks_json}

Question: "{question}"

Answer clearly and cite which video/timestamp the content comes from."""

        answer = llm_generate(prompt)
        resp = {"answer": answer, "sources": sources, "intent": "VIDEO_QA"}
        return jsonify(resp)

    except http_requests.exceptions.ConnectionError:
        return jsonify({
            "error": "Cannot connect to Ollama. Make sure it is running on http://localhost:11434"
        }), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/search", methods=["GET"])
def search():
    """
    Semantic search — returns matching chunks without LLM answer.
    Query param: ?q=css+box+model
    """
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"error": "q parameter is required"}), 400

    if df is None and not vector_store.is_available():
        return jsonify({"error": "Embeddings not loaded."}), 503

    try:
        q_embedding = create_embedding(q)
        similar = find_similar_chunks(q_embedding, top_k=20)
        ready_nums = {v["number"] for v in parse_video_list(include_processing=False)}
        results = [_format_source(s) for s in similar if s["number"] in ready_nums]
        results = _validate_sources(results)
        return jsonify({"query": q, "results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ask/video", methods=["POST"])
def ask_video():
    """Ask a question scoped to a single video."""
    body = request.get_json(force=True)
    question = (body.get("question") or "").strip()
    video_id_param = body.get("videoId") or body.get("video_id")
    debug = bool(body.get("debug"))
    if not question:
        return jsonify({"error": "question is required"}), 400
    if video_id_param is None:
        return jsonify({"error": "videoId is required"}), 400

    try:
        vid_num = int(video_id_param)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid videoId"}), 400

    db_row = get_video_by_number(vid_num)
    if not db_row:
        abort(404, description=f"Video #{vid_num} not found")
    if db_row.get("status") != "ready":
        return jsonify({"error": "Video is not ready for questions yet"}), 409

    if df is None and not vector_store.is_available():
        return jsonify({"error": "Embeddings not loaded."}), 503

    try:
        return jsonify(_run_video_rag_response(question, vid_num, db_row, debug=debug))
    except http_requests.exceptions.ConnectionError:
        return jsonify({"error": "Cannot connect to Ollama."}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/videos/upload", methods=["POST"])
@require_admin
def upload_video():
    """Upload an MP4 and queue background processing."""
    if "file" not in request.files:
        return jsonify({"error": "file is required"}), 400

    file = request.files["file"]
    title = (request.form.get("title") or "").strip()
    number_raw = request.form.get("number") or request.form.get("videoNumber")

    if not title:
        return jsonify({"error": "title is required"}), 400
    if not number_raw:
        return jsonify({"error": "number is required"}), 400

    try:
        number = int(number_raw)
        if number < 1:
            raise ValueError()
    except ValueError:
        return jsonify({"error": "number must be a positive integer"}), 400

    if not file.filename or not file.filename.lower().endswith(".mp4"):
        return jsonify({"error": "Only MP4 files are supported"}), 400

    if video_number_exists(number):
        return jsonify({"error": f"Video #{number} already exists"}), 409

    os.makedirs(VIDEO_DIR, exist_ok=True)
    safe_title = re.sub(r'[<>:"/\\|?*]', "", title).strip()[:120]
    filename = f"#{number} {safe_title}.mp4"
    filepath = os.path.join(VIDEO_DIR, filename)

    file.save(filepath)

    if not _is_valid_mp4(filepath):
        os.remove(filepath)
        return jsonify({"error": "Invalid MP4 file (unrecognized format)"}), 400

    file_hash = compute_file_hash(Path(filepath))

    existing = find_by_file_hash(file_hash)
    if existing:
        os.remove(filepath)
        return jsonify({"error": "This video already exists", "videoId": existing["number"]}), 409

    video = create_video(number, title, filename=filename, file_hash=file_hash)
    job = create_job(video["id"])
    update_video_status(video["id"], "processing")
    start_processing(job["id"], video["id"])

    return jsonify({
        "video_id": str(number),
        "videoId": number,
        "job_id": job["id"],
        "status": "queued",
    }), 202


@app.route("/api/videos/source", methods=["POST"])
@require_admin
def add_video_source():
    """Register an authorized YouTube source and queue transcript processing."""
    body = request.get_json(force=True)
    url = (body.get("url") or body.get("sourceUrl") or "").strip()
    title = (body.get("title") or "").strip()
    number_raw = body.get("number") or body.get("videoNumber")

    if not url:
        return jsonify({"error": "url is required"}), 400
    if not title:
        return jsonify({"error": "title is required"}), 400
    if not number_raw:
        return jsonify({"error": "number is required"}), 400

    try:
        number = int(number_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "number must be a positive integer"}), 400

    yt_id = extract_youtube_id(url)
    if not yt_id:
        return jsonify({"error": "Invalid YouTube URL"}), 400

    if video_number_exists(number):
        return jsonify({"error": f"Video #{number} already exists"}), 409

    existing = find_by_youtube_id(yt_id)
    if existing:
        return jsonify({"error": "This YouTube video already exists", "videoId": existing["number"]}), 409

    video = create_video(
        number, title, filename=None,
        source_type="youtube", source_url=url, youtube_video_id=yt_id,
    )
    job = create_job(video["id"])
    update_video_status(video["id"], "processing")
    start_processing(job["id"], video["id"])

    return jsonify({
        "video_id": str(number),
        "videoId": number,
        "job_id": job["id"],
        "status": "queued",
    }), 202


@app.route("/api/videos/<int:video_id>", methods=["DELETE"])
@require_admin
def remove_video(video_id: int):
    db_row = get_video_by_number(video_id)
    if not db_row:
        abort(404, description=f"Video #{video_id} not found")

    if vector_store.is_available():
        vector_store.delete_video(db_row["id"])

    filename = db_row.get("filename")
    if filename:
        fpath = os.path.join(VIDEO_DIR, filename)
        if os.path.isfile(fpath):
            try:
                os.remove(fpath)
            except OSError:
                pass

    for path in glob.glob(os.path.join(JSON_DIR, f"{video_id:02d}_*.json")):
        try:
            os.remove(path)
        except OSError:
            pass
    for path in glob.glob(os.path.join(AUDIO_DIR, f"{video_id:02d}_*.mp3")):
        try:
            os.remove(path)
        except OSError:
            pass
    for path in glob.glob(os.path.join(AUDIO_DIR, f"{video_id}_*.mp3")):
        try:
            os.remove(path)
        except OSError:
            pass

    db_delete_video(db_row["id"])
    with _cache_lock:
        _video_file_cache.pop(video_id, None)

    return jsonify({"deleted": True, "videoId": video_id})


@app.route("/api/videos/<int:video_id>/reprocess", methods=["POST"])
@require_admin
def reprocess_video(video_id: int):
    db_row = get_video_by_number(video_id)
    if not db_row:
        abort(404, description=f"Video #{video_id} not found")

    if has_active_job(db_row["id"]) or is_video_processing(db_row["id"]):
        return jsonify({"error": "Video is already being processed"}), 409

    if vector_store.is_available():
        vector_store.delete_video(db_row["id"])

    job = create_job(db_row["id"])
    update_video_status(db_row["id"], "processing")
    start_processing(job["id"], db_row["id"])

    return jsonify({
        "success": True,
        "videoId": video_id,
        "jobId": job["id"],
        "job_id": job["id"],
        "status": "queued",
    }), 202


@app.route("/api/videos/<int:video_id>/transcript", methods=["GET"])
def video_transcript(video_id: int):
    transcript = get_video_transcript(video_id)
    if not transcript:
        abort(404, description="Transcript not found")
    return jsonify({"videoId": video_id, "chunks": transcript})


@app.route("/api/jobs", methods=["GET"])
@require_admin
def jobs_list():
    jobs = list_jobs(limit=int(request.args.get("limit", 50)))
    enriched = []
    for job in jobs:
        v = get_video_by_id(job["video_id"])
        enriched.append({
            "id": job["id"],
            "videoId": v["number"] if v else None,
            "videoTitle": v["title"] if v else None,
            "status": job["status"],
            "stage": job["stage"],
            "progress": job["progress"],
            "errorMessage": job.get("error_msg"),
            "createdAt": job["created_at"],
            "updatedAt": job["updated_at"],
        })
    return jsonify(enriched)


@app.route("/api/jobs/<job_id>", methods=["GET"])
@require_admin
def job_status(job_id: str):
    if not re.fullmatch(r"[0-9a-f-]{36}", job_id):
        abort(400, description="Invalid job ID")
    job = get_job(job_id)
    if not job:
        abort(404, description="Job not found")
    v = get_video_by_id(job["video_id"])
    return jsonify({
        "id": job["id"],
        "videoId": v["number"] if v else None,
        "videoTitle": v["title"] if v else None,
        "status": job["status"],
        "stage": job["stage"],
        "progress": job["progress"],
        "errorMessage": job.get("error_msg"),
        "createdAt": job["created_at"],
        "updatedAt": job["updated_at"],
    })


@app.route("/api/jobs/<job_id>/retry", methods=["POST"])
@require_admin
def retry_job(job_id: str):
    if not re.fullmatch(r"[0-9a-f-]{36}", job_id):
        abort(400, description="Invalid job ID")
    job = get_job(job_id)
    if not job:
        abort(404, description="Job not found")

    video_id = job["video_id"]
    if has_active_job(video_id) or is_video_processing(video_id):
        return jsonify({"error": "Video is already being processed"}), 409

    if vector_store.is_available():
        vector_store.delete_video(video_id)

    new_job = create_job(video_id)
    update_video_status(video_id, "processing")
    start_processing(new_job["id"], video_id)

    v = get_video_by_id(video_id)
    return jsonify({
        "success": True,
        "videoId": v["number"] if v else None,
        "jobId": new_job["id"],
        "job_id": new_job["id"],
        "status": "queued",
    }), 202


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    body = request.get_json(force=True, silent=True) or {}
    password = (body.get("password") or "").strip()
    if not password or not verify_password(password):
        return jsonify({"error": "Invalid password"}), 401
    token = create_token()
    return jsonify({"token": token, "authenticated": True})


@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    revoke_token(get_bearer_token())
    return jsonify({"ok": True})


@app.route("/api/admin/me", methods=["GET"])
def admin_me():
    from auth import validate_token
    if not validate_token(get_bearer_token()):
        return jsonify({"error": "Unauthorized", "authenticated": False}), 401
    return jsonify({"authenticated": True, "role": "admin"})


@app.route("/api/admin/stats", methods=["GET"])
@require_admin
def admin_stats():
    return jsonify(get_admin_stats())


# Legacy route removed — use GET /api/videos/<number>/stream instead.


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "Course RAG Assistant API"})


# ── Entry ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    recovered = recover_stale_jobs()
    if recovered:
        print(f"[API] Recovered {recovered} stale processing job(s)")
    seed_from_legacy()
    load_embeddings()
    _ensure_chroma_populated()
    if df is not None:
        vector_store.migrate_from_joblib(df)
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() in ("1", "true", "yes")
    print(f"[API] Starting on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
