"""
database.py — SQLite persistence for video metadata and processing jobs.

Tables:
  videos           — canonical video records
  processing_jobs  — background job tracking
  transcript_chunks — transcript chunk metadata (embeddings are in ChromaDB)
"""

import sqlite3
import os
import json
import threading
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "data" / "course_rag.db"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    """Return a thread-local SQLite connection with row factory."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


_db_lock = threading.Lock()


def init_db():
    """Create tables if they don't exist. Safe to call multiple times."""
    os.makedirs(DB_PATH.parent, exist_ok=True)
    with _db_lock:
        conn = get_connection()
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS videos (
            id               TEXT PRIMARY KEY,           -- e.g. "video_18"
            number           INTEGER UNIQUE NOT NULL,
            title            TEXT NOT NULL,
            source_type      TEXT NOT NULL DEFAULT 'upload',  -- 'upload' | 'youtube'
            source_url       TEXT,
            youtube_video_id TEXT,
            filename         TEXT,
            file_hash        TEXT,
            duration         REAL DEFAULT 0,
            status           TEXT NOT NULL DEFAULT 'queued',
            chunk_count      INTEGER DEFAULT 0,
            created_at       TEXT NOT NULL,
            updated_at       TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS processing_jobs (
            id          TEXT PRIMARY KEY,
            video_id    TEXT NOT NULL REFERENCES videos(id),
            status      TEXT NOT NULL DEFAULT 'queued',
            stage       TEXT DEFAULT 'queued',
            progress    INTEGER DEFAULT 0,          -- 0-100
            error_msg   TEXT,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transcript_chunks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id    TEXT NOT NULL REFERENCES videos(id),
            chunk_index INTEGER NOT NULL,
            start_time  REAL NOT NULL,
            end_time    REAL NOT NULL,
            text        TEXT NOT NULL,
            created_at  TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chunks_video ON transcript_chunks(video_id);
        CREATE INDEX IF NOT EXISTS idx_jobs_video   ON processing_jobs(video_id);
        CREATE INDEX IF NOT EXISTS idx_videos_num   ON videos(number);
        CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
        """)
        conn.commit()
        _migrate_columns(conn)
        conn.close()


def _migrate_columns(conn: sqlite3.Connection):
    """Add columns introduced after initial schema."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(videos)").fetchall()}
    if "youtube_video_id" not in cols:
        conn.execute("ALTER TABLE videos ADD COLUMN youtube_video_id TEXT")
    if "file_hash" not in cols:
        conn.execute("ALTER TABLE videos ADD COLUMN file_hash TEXT")
    conn.commit()


# ── Video CRUD ─────────────────────────────────────────────────────────────────

def create_video(number: int, title: str, filename: str | None = None,
                 source_type: str = "upload", source_url: str | None = None,
                 youtube_video_id: str | None = None,
                 file_hash: str | None = None) -> dict:
    """Insert a new video record. Returns the created dict."""
    vid_id = f"video_{number}"
    now = _now()
    with _db_lock:
        conn = get_connection()
        try:
            conn.execute(
                """INSERT INTO videos
                   (id, number, title, source_type, source_url, youtube_video_id,
                    filename, file_hash, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)""",
                (vid_id, number, title, source_type, source_url, youtube_video_id,
                 filename, file_hash, now, now),
            )
            conn.commit()
        finally:
            conn.close()
    return get_video_by_id(vid_id)


def get_video_by_id(video_id: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_video_by_number(number: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM videos WHERE number = ?", (number,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_videos(status: str | None = None) -> list[dict]:
    conn = get_connection()
    if status:
        rows = conn.execute("SELECT * FROM videos WHERE status = ? ORDER BY number", (status,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM videos ORDER BY number").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_video_status(video_id: str, status: str, **kwargs):
    fields = {"status": status, "updated_at": _now()}
    fields.update(kwargs)
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [video_id]
    with _db_lock:
        conn = get_connection()
        conn.execute(f"UPDATE videos SET {set_clause} WHERE id = ?", values)
        conn.commit()
        conn.close()


def delete_video(video_id: str):
    with _db_lock:
        conn = get_connection()
        conn.execute("DELETE FROM transcript_chunks WHERE video_id = ?", (video_id,))
        conn.execute("DELETE FROM processing_jobs WHERE video_id = ?", (video_id,))
        conn.execute("DELETE FROM videos WHERE id = ?", (video_id,))
        conn.commit()
        conn.close()


def video_number_exists(number: int) -> bool:
    conn = get_connection()
    row = conn.execute("SELECT 1 FROM videos WHERE number = ?", (number,)).fetchone()
    conn.close()
    return row is not None


def find_by_file_hash(file_hash: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM videos WHERE file_hash = ?", (file_hash,)).fetchone()
    conn.close()
    return dict(row) if row else None


def find_by_youtube_id(youtube_video_id: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM videos WHERE youtube_video_id = ?", (youtube_video_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def upsert_video_from_legacy(number: int, title: str, filename: str | None,
                             duration: float, chunk_count: int) -> dict:
    """Seed or update an existing course video marked as ready."""
    existing = get_video_by_number(number)
    now = _now()
    vid_id = f"video_{number}"
    with _db_lock:
        conn = get_connection()
        if existing:
            conn.execute(
                """UPDATE videos SET title=?, filename=?, duration=?, chunk_count=?,
                   status='ready', updated_at=? WHERE number=?""",
                (title, filename, duration, chunk_count, now, number),
            )
        else:
            conn.execute(
                """INSERT INTO videos
                   (id, number, title, source_type, filename, duration, chunk_count,
                    status, created_at, updated_at)
                   VALUES (?, ?, ?, 'upload', ?, ?, ?, 'ready', ?, ?)""",
                (vid_id, number, title, filename, duration, chunk_count, now, now),
            )
        conn.commit()
        conn.close()
    return get_video_by_number(number)


# ── Transcript chunks ──────────────────────────────────────────────────────────

def save_transcript_chunks(video_id: str, chunks: list[dict]):
    """Bulk insert transcript chunks (replaces any existing for this video)."""
    now = _now()
    with _db_lock:
        conn = get_connection()
        conn.execute("DELETE FROM transcript_chunks WHERE video_id = ?", (video_id,))
        conn.executemany(
            """INSERT INTO transcript_chunks
               (video_id, chunk_index, start_time, end_time, text, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [
                (video_id, i, c["start"], c["end"], c["text"], now)
                for i, c in enumerate(chunks)
            ],
        )
        conn.commit()
        conn.close()


def get_transcript_chunks(video_id: str) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM transcript_chunks WHERE video_id = ? ORDER BY chunk_index",
        (video_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Processing jobs ────────────────────────────────────────────────────────────

def create_job(video_id: str) -> dict:
    import uuid
    job_id = str(uuid.uuid4())
    now = _now()
    with _db_lock:
        conn = get_connection()
        conn.execute(
            """INSERT INTO processing_jobs (id, video_id, status, stage, progress, created_at, updated_at)
               VALUES (?, ?, 'queued', 'queued', 0, ?, ?)""",
            (job_id, video_id, now, now),
        )
        conn.commit()
        conn.close()
    return get_job(job_id)


def get_job(job_id: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM processing_jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_latest_job_for_video(video_id: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM processing_jobs WHERE video_id = ? ORDER BY created_at DESC LIMIT 1",
        (video_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def list_jobs(limit: int = 50) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM processing_jobs ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_job(job_id: str, **kwargs):
    kwargs["updated_at"] = _now()
    set_clause = ", ".join(f"{k} = ?" for k in kwargs)
    values = list(kwargs.values()) + [job_id]
    with _db_lock:
        conn = get_connection()
        conn.execute(f"UPDATE processing_jobs SET {set_clause} WHERE id = ?", values)
        conn.commit()
        conn.close()


def has_active_job(video_id: str) -> bool:
    conn = get_connection()
    row = conn.execute(
        """SELECT 1 FROM processing_jobs
           WHERE video_id = ? AND status IN ('queued', 'processing')
           LIMIT 1""",
        (video_id,),
    ).fetchone()
    conn.close()
    return row is not None


def recover_stale_jobs(max_age_seconds: int = 7200) -> int:
    """
    Mark in-flight jobs as failed when the server restarted or a worker died.
    Returns the number of jobs recovered.
    """
    from datetime import datetime, timezone, timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=max_age_seconds)).isoformat()
    with _db_lock:
        conn = get_connection()
        stale = conn.execute(
            """SELECT id, video_id, stage FROM processing_jobs
               WHERE status IN ('queued', 'processing')
               AND updated_at < ?""",
            (cutoff,),
        ).fetchall()
        count = 0
        for row in stale:
            conn.execute(
                """UPDATE processing_jobs
                   SET status='failed', stage=?, error_msg=?, updated_at=?
                   WHERE id=?""",
                (
                    row["stage"] or "failed",
                    "Processing timed out or was interrupted. Please retry.",
                    _now(),
                    row["id"],
                ),
            )
            conn.execute(
                "UPDATE videos SET status='failed', updated_at=? WHERE id=? AND status='processing'",
                (_now(), row["video_id"]),
            )
            count += 1
        conn.commit()
        conn.close()
    return count


def get_admin_stats() -> dict:
    conn = get_connection()
    total   = conn.execute("SELECT COUNT(*) FROM videos").fetchone()[0]
    ready   = conn.execute("SELECT COUNT(*) FROM videos WHERE status='ready'").fetchone()[0]
    proc    = conn.execute("SELECT COUNT(*) FROM videos WHERE status='processing'").fetchone()[0]
    failed  = conn.execute("SELECT COUNT(*) FROM videos WHERE status='failed'").fetchone()[0]
    chunks  = conn.execute("SELECT COUNT(*) FROM transcript_chunks").fetchone()[0]
    conn.close()
    return {
        "totalVideos": total,
        "readyVideos": ready,
        "processingVideos": proc,
        "failedVideos": failed,
        "totalChunks": chunks,
    }
