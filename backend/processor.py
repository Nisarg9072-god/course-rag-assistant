"""
Background video processing pipeline.

Stages: queued → extracting_audio → transcribing → chunking → embedding → indexing → completed
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import threading
from pathlib import Path

import requests

from database import (
    get_video_by_id,
    save_transcript_chunks,
    update_job,
    update_video_status,
)
import vector_store

BASE_DIR = Path(__file__).parent.parent
VIDEO_DIR = BASE_DIR / "Video"
AUDIO_DIR = BASE_DIR / "audios"
JSON_DIR = BASE_DIR / "json"
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
BATCH_SIZE = 32

_whisper_model = None
_whisper_lock = threading.Lock()
_active_jobs: set[str] = set()
_jobs_lock = threading.Lock()

_active_videos: set[str] = set()


def is_video_processing(video_id: str) -> bool:
    with _jobs_lock:
        return video_id in _active_videos


STAGES = [
    ("queued", 0),
    ("uploading", 5),
    ("extracting_audio", 10),
    ("transcribing", 30),
    ("chunking", 50),
    ("embedding", 70),
    ("indexing", 90),
    ("completed", 100),
]


def _stage_progress(stage: str) -> int:
    return next((p for s, p in STAGES if s == stage), 0)


def _set_stage(job_id: str, video_id: str, stage: str, status: str = "processing"):
    progress = _stage_progress(stage)
    update_job(job_id, status=status, stage=stage, progress=progress, error_msg=None)
    video_status = "ready" if stage == "completed" else status
    update_video_status(video_id, video_status)


def _get_whisper():
    global _whisper_model
    with _whisper_lock:
        if _whisper_model is None:
            import whisper
            print("[Processor] Loading Whisper large-v2...")
            _whisper_model = whisper.load_model("large-v2")
        return _whisper_model


def _embed_batch(texts: list[str]) -> list[list[float]]:
    r = requests.post(
        f"{OLLAMA_URL}/api/embed",
        json={"model": "bge-m3", "input": texts},
        timeout=120,
    )
    r.raise_for_status()
    data = r.json()
    vecs = data.get("embeddings")
    if isinstance(vecs, dict):
        vecs = [vecs[str(i)] for i in range(len(vecs))]
    if not isinstance(vecs, list) or len(vecs) != len(texts):
        raise RuntimeError(f"Unexpected Ollama embedding response: {data}")
    return vecs


def _batch_embed_all(texts: list[str]) -> list[list[float]]:
    all_vecs: list[list[float]] = []
    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start: start + BATCH_SIZE]
        all_vecs.extend(_embed_batch(batch))
    return all_vecs


def extract_youtube_id(url: str) -> str | None:
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})",
        r"youtube\.com/shorts/([a-zA-Z0-9_-]{11})",
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    return None


def compute_file_hash(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def _extract_audio(video_path: Path, audio_path: Path):
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(video_path), "-vn", "-acodec", "libmp3lame", str(audio_path)],
        check=True,
        capture_output=True,
    )


def _transcribe(audio_path: Path, number: int, title: str) -> list[dict]:
    model = _get_whisper()
    result = model.transcribe(
        str(audio_path),
        language="hi",
        task="translate",
        word_timestamps=False,
    )
    chunks = []
    for segment in result["segments"]:
        chunks.append({
            "number": number,
            "title": title,
            "start": float(segment["start"]),
            "end": float(segment["end"]),
            "text": segment["text"].strip(),
        })
    return chunks


def _save_json_transcript(number: int, title: str, chunks: list[dict], full_text: str):
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    safe_title = re.sub(r'[<>:"/\\|?*]', "", title)[:80]
    fname = f"{number:02d}_{safe_title}.mp3.json"
    path = JSON_DIR / fname
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"chunks": chunks, "text": full_text}, f, ensure_ascii=False)


def _fetch_youtube_transcript(youtube_id: str) -> list[dict]:
    """Fetch captions when available (authorized public transcripts)."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        transcript = YouTubeTranscriptApi.get_transcript(youtube_id, languages=["en", "hi"])
    except Exception as e:
        raise RuntimeError(f"YouTube transcript unavailable: {e}") from e

    chunks = []
    for i, seg in enumerate(transcript):
        start = float(seg["start"])
        end = start + float(seg.get("duration", 5))
        chunks.append({
            "start": start,
            "end": end,
            "text": seg["text"].strip(),
            "chunk_index": i,
        })
    return chunks


def process_video_job(job_id: str, video_id: str):
    """Run the full ingestion pipeline for one video."""
    with _jobs_lock:
        if job_id in _active_jobs or video_id in _active_videos:
            update_job(job_id, status="failed", stage="failed",
                        error_msg="Video is already being processed")
            return
        _active_jobs.add(job_id)
        _active_videos.add(video_id)

    current_stage = "queued"
    try:
        video = get_video_by_id(video_id)
        if not video:
            update_job(job_id, status="failed", stage="failed", error_msg="Video not found")
            return

        number = int(video["number"])
        title = video["title"]
        source_type = video.get("source_type", "upload")

        update_video_status(video_id, "processing")

        def advance(stage: str):
            nonlocal current_stage
            current_stage = stage
            _set_stage(job_id, video_id, stage)

        advance("queued")
        advance("uploading")

        chunks: list[dict] = []

        if source_type == "youtube":
            yt_id = video.get("youtube_video_id")
            if not yt_id:
                raise RuntimeError("Missing YouTube video ID")
            advance("transcribing")
            raw_chunks = _fetch_youtube_transcript(yt_id)
            for i, c in enumerate(raw_chunks):
                chunks.append({
                    "number": number,
                    "title": title,
                    "start": c["start"],
                    "end": c["end"],
                    "text": c["text"],
                    "chunk_index": i,
                })
        else:
            filename = video.get("filename")
            if not filename:
                raise RuntimeError("Missing video filename")
            video_path = VIDEO_DIR / filename
            if not video_path.is_file():
                raise RuntimeError(f"Video file not found: {filename}")

            safe_title = re.sub(r'[<>:"/\\|?*]', "", title)[:80]
            audio_path = AUDIO_DIR / f"{number:02d}_{safe_title}.mp3"

            advance("extracting_audio")
            _extract_audio(video_path, audio_path)

            advance("transcribing")
            chunks = _transcribe(audio_path, number, title)

        if not chunks:
            raise RuntimeError("No transcript chunks produced")

        advance("chunking")
        duration = chunks[-1]["end"] if chunks else 0
        full_text = " ".join(c["text"] for c in chunks)

        for i, c in enumerate(chunks):
            c["chunk_index"] = i
            c["number"] = number
            c["title"] = title

        save_transcript_chunks(video_id, chunks)
        if source_type != "youtube":
            _save_json_transcript(number, title, chunks, full_text)

        advance("embedding")
        texts = [c["text"] for c in chunks]
        embeddings = _batch_embed_all(texts)

        advance("indexing")
        if vector_store.is_available():
            vector_store.add_chunks(video_id, chunks, embeddings)

        update_video_status(
            video_id, "ready",
            duration=duration,
            chunk_count=len(chunks),
        )
        update_job(job_id, status="completed", stage="completed", progress=100, error_msg=None)
        print(f"[Processor] Video #{number} ready — {len(chunks)} chunks indexed")

    except Exception as e:
        err = str(e)
        print(f"[Processor] Job {job_id} failed at {current_stage}: {err}")
        update_job(job_id, status="failed", stage=current_stage, error_msg=err)
        update_video_status(video_id, "failed")
    finally:
        with _jobs_lock:
            _active_jobs.discard(job_id)
            _active_videos.discard(video_id)


def start_processing(job_id: str, video_id: str):
    """Launch processing in a background thread."""
    t = threading.Thread(
        target=process_video_job,
        args=(job_id, video_id),
        daemon=True,
        name=f"process-{video_id}",
    )
    t.start()
    return t
