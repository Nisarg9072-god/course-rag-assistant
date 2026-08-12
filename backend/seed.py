"""
Seed SQLite from existing json/ + Video/ course content on first startup.
"""

from __future__ import annotations

import glob
import json
import os
import re
from pathlib import Path

from database import init_db, list_videos, save_transcript_chunks, upsert_video_from_legacy

BASE_DIR = Path(__file__).parent.parent
JSON_DIR = BASE_DIR / "json"


def _find_video_file(number: int, video_dir: Path) -> str | None:
    if not video_dir.is_dir():
        return None
    primary = re.compile(rf"Tutorial #0*{number}[\s\[\.]", re.IGNORECASE)
    fallback = re.compile(rf"#0*{number}[\s\[]", re.IGNORECASE)
    upload_pat = re.compile(rf"^#0*{number}\s", re.IGNORECASE)

    for fname in os.listdir(video_dir):
        if not fname.lower().endswith(".mp4"):
            continue
        if primary.search(fname) or upload_pat.match(fname):
            return fname
        if number == 21 and fname == "sample.mp4":
            return fname
        if fallback.search(fname):
            return fname
    return None


def _extract_title_from_filename(filename: str) -> str:
    name = os.path.splitext(filename)[0]
    parts = re.split(r"\s*[｜|]\s*", name)
    if parts:
        # Upload format: "#19 CSS Positioning"
        m = re.match(r"^#\d+\s+(.+)$", parts[0].strip())
        if m:
            return m.group(1).strip()
        return parts[0].strip()
    return name.strip()


def seed_from_legacy(video_dir: Path | None = None) -> int:
    """Import existing course videos into SQLite. Returns count seeded."""
    init_db()
    if list_videos():
        return 0

    video_dir = video_dir or (BASE_DIR / "Video")
    count = 0

    for path in sorted(glob.glob(str(JSON_DIR / "*.json"))):
        fname = os.path.basename(path)
        match = re.match(r"^(\d+)_(.+?)\.mp3\.json$", fname)
        if not match:
            continue

        number = int(match.group(1))
        json_title = match.group(2)

        try:
            with open(path, encoding="utf-8") as f:
                content = json.load(f)
            chunks = content.get("chunks", [])
            duration = chunks[-1]["end"] if chunks else 0
            chunk_count = len(chunks)
        except Exception:
            duration = 0
            chunk_count = 0
            chunks = []

        actual_file = _find_video_file(number, video_dir)
        title = _extract_title_from_filename(actual_file) if actual_file else json_title

        video = upsert_video_from_legacy(
            number, title, actual_file, duration, chunk_count
        )
        if chunks:
            save_transcript_chunks(video["id"], [
                {"start": c["start"], "end": c["end"], "text": c["text"]}
                for c in chunks
            ])
        count += 1

    if count:
        print(f"[Seed] Imported {count} existing videos into database")
    return count
