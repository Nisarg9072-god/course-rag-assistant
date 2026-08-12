# 🎓 Course RAG Assistant

AI-powered course search and Q&A — ask questions about your web development course, get AI answers with exact video timestamps, and jump directly to the relevant moment.

---

## ⚡ Quick Start (3 steps)

### Step 1 — Prerequisites

Make sure you have these installed:

| Tool | Version | Install |
|---|---|---|
| Python | 3.10+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |
| Ollama | latest | https://ollama.com |

---

### Step 2 — Start Ollama + Download Models

Open a terminal and run:

```bash
# 1. Start Ollama (keep this running in background)
ollama serve

# 2. Download the embedding model
ollama pull bge-m3

# 3. Download the LLM
ollama pull llama3.2
```

> **Note:** `bge-m3` is ~570 MB. `llama3.2` is ~2 GB. Download once, reuse forever.

---

### Step 3 — Run the Backend (Flask API)

Open a **new terminal**:

```bash
cd "c:\Users\nisar\Desktop\DATA SCIENCE\Project RAG"

# Install Python dependencies (first time only)
pip install flask flask-cors requests pandas numpy scikit-learn joblib

# Start the API server
python backend/api.py
```

You should see:
```
[API] Loaded embeddings: XXXX chunks
[API] Starting on http://localhost:5000
```

> **If you see "Embeddings not loaded"** — you need to run the embedding pipeline first. See [Regenerating Embeddings](#regenerating-embeddings) below.

---

### Step 4 — Run the Frontend (React)

Open another **new terminal**:

```bash
cd "c:\Users\nisar\Desktop\DATA SCIENCE\Project RAG\frontend"

# Install Node dependencies (first time only)
npm install

# Start the dev server
npm run dev
```

You should see:
```
VITE v8.x.x  ready in XXX ms
➜  Local:   http://localhost:5173/
```

---

### Step 5 — Open the App

Go to: **http://localhost:5173**

---

## 🎓 Dynamic Course Platform (Instructor)

Instructors can add videos from the **Instructor** section in the sidebar:

| Route | Purpose |
|---|---|
| `/admin` | Dashboard stats (videos, chunks, indexed %) |
| `/admin/videos` | Manage all videos |
| `/admin/videos/add` | Upload MP4 or add YouTube source |
| `/admin/jobs` | Track background processing jobs |

**Adding a video (automatic pipeline):**
```
Upload MP4 → Background job → FFmpeg audio → Whisper → Chunks → bge-m3 → ChromaDB → Ready
```

No need to run `video_to_mp3.py`, `mp3_to_json.py`, or `read_chunks.py` manually for new uploads.

**Install full backend dependencies:**
```bash
pip install -r backend/requirements.txt
```

Requires **ffmpeg** on PATH for audio extraction.

---

## 🗂️ Project Structure

```
Project RAG/
├── backend/
│   ├── api.py              ← Flask REST API
│   ├── database.py         ← SQLite (videos, jobs, transcripts)
│   ├── vector_store.py     ← ChromaDB incremental vectors
│   ├── processor.py        ← Background ingestion pipeline
│   └── seed.py             ← Migrates existing 21 videos on first run
├── data/
│   ├── course_rag.db       ← SQLite database (auto-created)
│   └── chroma/             ← ChromaDB vector index (auto-created)
├── frontend/
│   ├── src/                ← React + TypeScript source
│   └── package.json
├── json/                   ← Whisper transcripts (legacy + new uploads)
├── Video/                  ← MP4 course videos
├── embedding.joblib        ← Legacy embeddings (migrated to ChromaDB on startup)
└── read_chunks.py          ← Manual embedding script (legacy)
```

---

## 🔌 What Runs Where

| Service | Command | URL | Purpose |
|---|---|---|---|
| Ollama | `ollama serve` | http://localhost:11434 | AI models (bge-m3 + llama3.2) |
| Flask API | `python backend/api.py` | http://localhost:5000 | RAG backend + video streaming |
| React frontend | `npm run dev` | http://localhost:5173 | Web UI |

---

## 📁 Environment Variables

### Backend (`backend/api.py`)

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | `changeme` | Instructor login password |
| `FRONTEND_URL` | `http://localhost:5173` | Primary CORS origin |
| `CORS_ORIGINS` | `FRONTEND_URL` + `:5174,:5175` | Comma-separated allowed origins |
| `FLASK_DEBUG` | `true` | Set `false` in production |
| `PORT` | `5000` | API port |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API |
| `MAX_UPLOAD_MB` | `2048` | Max MP4 upload size |

### Frontend (`frontend/.env`)

The frontend `.env` file controls mock vs real mode:

```env
# File: frontend/.env

VITE_API_URL=http://localhost:5000     # Flask backend URL
VITE_USE_MOCK=false                    # false = real backend + video playback (recommended)
                                       # true = demo mode (no backend needed)
```

**To use real AI + real videos:**
```env
VITE_USE_MOCK=false
```

**To demo without backend:**
```env
VITE_USE_MOCK=true
```

---

## 🔐 Admin Authentication

Instructor-only actions (upload, delete, retry, reprocess) require authentication.

1. Set a strong password before starting the backend:
   ```bash
   set ADMIN_PASSWORD=your-secure-password
   python backend/api.py
   ```
2. Open `/admin/login` in the app and sign in.
3. Unauthenticated API calls to protected endpoints return **401 Unauthorized**.

Students can still use Ask AI, view course videos, and read transcripts without logging in.

---

## 🎬 Video Playback

Videos are served from the `Video/` folder via:
```
GET /api/videos/18/stream
```

The backend automatically finds the correct MP4 file by scanning for `Tutorial #18` in the filename. No configuration needed.

---

## 🔁 Regenerating Embeddings (Legacy)

For the original 21 videos, embeddings are migrated from `embedding.joblib` → ChromaDB on backend startup.

To regenerate all legacy embeddings manually:
```bash
python read_chunks.py
```

**New videos added via `/admin/videos/add` are embedded incrementally** — only the new video is processed.

---

## ❓ Troubleshooting

### "Cannot connect to Ollama"
```bash
# Check if Ollama is running
ollama list

# If not running, start it
ollama serve
```

### "Embeddings not loaded"
```bash
python read_chunks.py   # from project root
```

### Video not loading (blank player)
1. Make sure `VITE_USE_MOCK=false` in `frontend/.env`
2. Make sure Flask backend is running on port 5000
3. Check that `Video/` folder has your `.mp4` files
4. Visit `http://localhost:5000/api/videos/18` — you should see JSON with `videoUrl`

### Port already in use
```bash
# Flask on different port
set PORT=5001
python backend/api.py

# Update frontend/.env
VITE_API_URL=http://localhost:5001
```

### Frontend shows "Video not available in demo mode"
→ Set `VITE_USE_MOCK=false` in `frontend/.env` and restart `npm run dev`

---

## 🚀 Full Production Build

```bash
cd frontend
npm run build
# Output in frontend/dist/
```

---

## 📋 Complete Checklist

```
□ Ollama running             (ollama serve)
□ bge-m3 model downloaded    (ollama pull bge-m3)
□ llama3.2 model downloaded  (ollama pull llama3.2)
□ embedding.joblib exists    (python read_chunks.py)
□ Flask API running          (python backend/api.py)
□ VITE_USE_MOCK=false        (frontend/.env)
□ Frontend running           (npm run dev in frontend/)
□ Open http://localhost:5173
```
