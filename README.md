# 🎓 Course RAG Assistant

A RAG pipeline that answers student questions using video subtitle embeddings — returns relevant video titles & timestamps. Powered by Ollama (bge-m3 + LLaMA 3.2).

## 🚀 What It Does

- Converts course videos → audio (MP3) → subtitle JSON chunks
- Embeds all subtitle chunks using **bge-m3** (via Ollama)
- When a student asks a question, it finds the most relevant video chunks using **cosine similarity**
- Passes those chunks to **LLaMA 3.2** to generate a human-friendly answer with video title & timestamp

## 🛠️ Tech Stack

- **Embedding Model:** `bge-m3` (via Ollama)
- **LLM:** `llama3.2` (via Ollama)
- **Similarity Search:** `scikit-learn` cosine similarity
- **Data:** `pandas`, `joblib`, `numpy`
- **Audio Processing:** `moviepy`, `whisper` (or similar)

## 📂 Project Structure

```
├── video_to_mp3.py       # Convert video files to MP3
├── mp3_to_json.py        # Transcribe MP3 → subtitle JSON chunks
├── read_chunks.py        # Embed all chunks and save to embedding.joblib
├── process_question.py   # Accept user question → find chunks → LLM response
├── json/                 # Subtitle JSON files per video
└── .gitignore
```

## ⚙️ Setup & Usage

### 1. Install Dependencies
```bash
pip install requests pandas numpy scikit-learn joblib moviepy
```

### 2. Start Ollama & Pull Models
```bash
ollama pull bge-m3
ollama pull llama3.2
```

### 3. Process Videos
```bash
python video_to_mp3.py    # Convert videos to audio
python mp3_to_json.py     # Transcribe audio to JSON chunks
```

### 4. Generate Embeddings
```bash
python read_chunks.py
```

### 5. Ask Questions
```bash
python process_question.py
```

## 💬 Example

```
Ask a Question: What is the CSS box model?

Answer: The CSS Box Model is covered in Video 18 - "CSS Box Model - Margin, Padding & Borders".
You can find it starting at around 7 minutes 22 seconds (442s) into the video...
```

## 📌 Notes

- `embedding.joblib` is excluded from git (too large). Run `read_chunks.py` to regenerate it.
- Make sure Ollama is running locally on `http://localhost:11434` before executing scripts.
