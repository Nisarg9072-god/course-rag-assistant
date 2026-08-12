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

## 🗂️ Project Structure

```
Project RAG/
├── backend/
│   └── api.py              ← Flask REST API (run this)
├── frontend/
│   ├── src/                ← React + TypeScript source
│   └── package.json
├── json/                   ← Whisper transcripts (JSON chunks)
├── Video/                  ← Your actual MP4 course videos
├── embedding.joblib        ← Pre-computed embeddings (generated once)
└── read_chunks.py          ← Embedding pipeline script
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

The frontend `.env` file controls mock vs real mode:

```env
# File: frontend/.env

VITE_API_URL=http://localhost:5000     # Flask backend URL
VITE_USE_MOCK=true                     # true = demo mode (no backend needed)
                                       # false = connects to real Flask API
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

## 🎬 Video Playback

Videos are served from the `Video/` folder via:
```
GET /api/videos/18/stream
```

The backend automatically finds the correct MP4 file by scanning for `Tutorial #18` in the filename. No configuration needed.

---

## 🔁 Regenerating Embeddings

If you add new transcripts to `json/`, regenerate the embeddings:

```bash
cd "c:\Users\nisar\Desktop\DATA SCIENCE\Project RAG"
python read_chunks.py
```

This creates/updates `embedding.joblib`. Restart the Flask backend after.

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
