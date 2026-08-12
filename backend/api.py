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

import numpy as np
import pandas as pd
import requests as http_requests
from flask import Flask, request, jsonify, send_from_directory, abort, Response
from flask_cors import CORS
from sklearn.metrics.pairwise import cosine_similarity
import joblib

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_DIR = os.path.join(BASE_DIR, "json")
VIDEO_DIR = os.path.join(BASE_DIR, "Video")
EMBEDDING_PATH = os.path.join(BASE_DIR, "embedding.joblib")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
TOP_RESULTS = 30

app = Flask(__name__)
CORS(app)

# ── Load embeddings once at startup ───────────────────────────────────────────
df_lock = threading.Lock()
df: pd.DataFrame = None  # type: ignore

def load_embeddings():
    global df
    if os.path.exists(EMBEDDING_PATH):
        with df_lock:
            df = joblib.load(EMBEDDING_PATH)
        print(f"[API] Loaded embeddings: {len(df)} chunks")
    else:
        print(f"[API] WARNING: {EMBEDDING_PATH} not found. Run read_chunks.py first.")


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
    # Fallback for padded zeros:  "#01 ", "#1 " variants
    fallback = re.compile(rf"#0*{number}[\s\[]", re.IGNORECASE)

    for fname in os.listdir(VIDEO_DIR):
        if not fname.lower().endswith(".mp4"):
            continue
        if primary.search(fname) or (number == 21 and fname == "sample.mp4"):
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


def find_similar_chunks(question_embedding: list, top_k: int = TOP_RESULTS) -> pd.DataFrame:
    """Return top-k chunks most similar to the question embedding."""
    with df_lock:
        if df is None:
            return pd.DataFrame()
        all_embeddings = np.vstack(df["embedding"].values)
        q_vec = np.array(question_embedding).reshape(1, -1)
        similarities = cosine_similarity(all_embeddings, q_vec).flatten()
        top_indices = similarities.argsort()[::-1][:top_k]
        result = df.loc[top_indices].copy()
        result["similarity"] = similarities[top_indices]
        return result


def parse_video_list() -> list:
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
    """Return transcript chunks for a specific video number."""
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
    videos = parse_video_list()
    total_duration = sum(v["duration"] for v in videos)
    total_chunks = sum(v["chunkCount"] for v in videos)
    return jsonify({
        "videoCount": len(videos),
        "totalDurationSeconds": total_duration,
        "totalDurationHours": round(total_duration / 3600, 1),
        "totalChunks": total_chunks,
        "embeddingsLoaded": df is not None,
    })


@app.route("/api/videos", methods=["GET"])
def list_videos():
    """List all course videos."""
    return jsonify(parse_video_list())


@app.route("/api/videos/<int:video_id>", methods=["GET"])
def get_video(video_id: int):
    """Get a single video with its transcript."""
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
    Body: { "question": "What is the CSS box model?" }
    """
    body = request.get_json(force=True)
    question = (body.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    if df is None:
        return jsonify({"error": "Embeddings not loaded. Run read_chunks.py first."}), 503

    try:
        # Step 1: embed the question
        q_embedding = create_embedding(question)

        # Step 2: find similar chunks
        similar = find_similar_chunks(q_embedding, top_k=TOP_RESULTS)

        # Step 3: build sources list
        sources = []
        for _, row in similar.iterrows():
            vid_num = int(row["number"])
            actual_file = find_video_file(vid_num)
            sources.append({
                "number": vid_num,
                "title": row["title"],
                "start": float(row["start"]),
                "end": float(row.get("end", row["start"] + 10)),
                "text": row["text"],
                "similarity": float(row.get("similarity", 0)),
                # Include the streaming URL so the frontend never has to guess
                "videoUrl": f"/api/videos/{vid_num}/stream" if actual_file else None,
            })

        # Step 4: build prompt
        chunks_json = similar[["title", "number", "text", "start"]].to_json(orient="records")
        prompt = f"""I am teaching web development using the Sigma Web Development course. Here are video subtitle chunks containing video title, video number, start time in seconds, and the text:

{chunks_json}

------------------------------------
"{question}"

The user asked this question related to the video chunks. Answer in a human-friendly way — tell them where and at what timestamp this content is covered, and guide them to the specific video. If the question is unrelated to the course, politely say you can only answer course-related questions."""

        # Step 5: generate answer
        answer = llm_generate(prompt)

        return jsonify({"answer": answer, "sources": sources[:10]})

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

    if df is None:
        return jsonify({"error": "Embeddings not loaded."}), 503

    try:
        q_embedding = create_embedding(q)
        similar = find_similar_chunks(q_embedding, top_k=20)
        results = []
        for _, row in similar.iterrows():
            vid_num = int(row["number"])
            actual_file = find_video_file(vid_num)
            results.append({
                "number": vid_num,
                "title": row["title"],
                "start": float(row["start"]),
                "end": float(row.get("end", row["start"] + 10)),
                "text": row["text"],
                "similarity": float(row.get("similarity", 0)),
                "videoUrl": f"/api/videos/{vid_num}/stream" if actual_file else None,
            })
        return jsonify({"query": q, "results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Legacy video serve (kept for backward compatibility) ──────────────────────
@app.route("/videos/<path:filename>", methods=["GET"])
def serve_video(filename: str):
    """Serve video files from the Video/ folder (legacy route)."""
    if not os.path.exists(VIDEO_DIR):
        abort(404, description="Video directory not found")
    return send_from_directory(VIDEO_DIR, filename)


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "Course RAG Assistant API"})


# ── Entry ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    load_embeddings()
    port = int(os.environ.get("PORT", 5000))
    print(f"[API] Starting on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
