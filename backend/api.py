"""
Course RAG Assistant — Flask API Backend
Wraps the existing RAG pipeline and exposes REST endpoints for the frontend.

Run:
    pip install flask flask-cors requests pandas numpy scikit-learn joblib
    python backend/api.py

Endpoints:
    POST /api/ask         — Ask a question, get AI answer + sources
    GET  /api/videos      — List all course videos
    GET  /api/videos/<id> — Get single video + transcript
    GET  /api/search      — Semantic search (returns sources only)
    GET  /api/stats       — Course statistics
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
from flask import Flask, request, jsonify, send_from_directory, abort
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
    """Read all JSON files from json/ and build the video list."""
    videos = []
    json_files = sorted(glob.glob(os.path.join(JSON_DIR, "*.json")))
    for path in json_files:
        fname = os.path.basename(path)
        # Pattern: "01_Title.mp3.json"
        match = re.match(r"^(\d+)_(.+?)\.mp3\.json$", fname)
        if not match:
            continue
        number = int(match.group(1))
        title = match.group(2)
        try:
            with open(path, encoding="utf-8") as f:
                content = json.load(f)
            chunks = content.get("chunks", [])
            duration = chunks[-1]["end"] if chunks else 0
            chunk_count = len(chunks)
        except Exception:
            duration = 0
            chunk_count = 0
        videos.append({
            "number": number,
            "title": title,
            "duration": duration,
            "chunkCount": chunk_count,
            "videoFile": f"{number:02d}_{title}.mp4",
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
            sources.append({
                "number": int(row["number"]),
                "title": row["title"],
                "start": float(row["start"]),
                "end": float(row.get("end", row["start"] + 10)),
                "text": row["text"],
                "similarity": float(row.get("similarity", 0)),
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
            results.append({
                "number": int(row["number"]),
                "title": row["title"],
                "start": float(row["start"]),
                "end": float(row.get("end", row["start"] + 10)),
                "text": row["text"],
                "similarity": float(row.get("similarity", 0)),
            })
        return jsonify({"query": q, "results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/videos/<path:filename>", methods=["GET"])
def serve_video(filename: str):
    """Serve video files from the Video/ folder."""
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
