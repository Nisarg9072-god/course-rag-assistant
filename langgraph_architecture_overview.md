# 🧠 Course RAG Assistant — Architecture & Pipeline Diagrams

> Visual workflow documentation for the **Course RAG Assistant** project.  
> Powered by: `bge-m3` · `LLaMA 3.2` · `Whisper large-v2` · `Ollama` · `scikit-learn`

---

## 1. 🗺️ LangGraph Architecture Overview

> This diagram shows how the system would be modeled as a **LangGraph state machine** — each node is a discrete processing step, and edges represent conditional or sequential transitions.

```mermaid
flowchart TD
    START(["🟢 START"]):::start

    subgraph INGESTION["📥 Ingestion Pipeline (Offline — run once)"]
        direction TB
        A["🎬 video_to_mp3\n─────────────\nConvert .mp4 → .mp3\nvia FFmpeg subprocess"]:::node
        B["🎙️ mp3_to_json\n─────────────\nWhisper large-v2\nHindi → English\nSegmented JSON chunks"]:::node
        C["🧮 read_chunks\n─────────────\nbge-m3 Embedding\nBatched (32/call)\nvia Ollama API"]:::node
        D[("💾 embedding.joblib\n─────────────\nPandas DataFrame\n~83 MB on disk")]:::store
        A --> B --> C --> D
    end

    subgraph QUERY["💬 Enquiry Pipeline (Online — per question)"]
        direction TB
        E["📝 receive_question\n─────────────\nCapture user input\nvia stdin"]:::node
        F["🔢 embed_question\n─────────────\nbge-m3 via Ollama\nReturns 1024-dim vector"]:::node
        G["🔍 similarity_search\n─────────────\nCosine similarity\nover all stored chunks\nscikit-learn"]:::node
        H["📋 retrieve_top_k\n─────────────\nSelect Top-30\nmost similar chunks\nby score"]:::node
        I{"🤔 is_relevant?\n─────────────\nChunks above\nthreshold?"}:::decision
        J["🚫 off_topic_reply\n─────────────\nTell user question\nis not course-related"]:::warn
        K["✍️ build_prompt\n─────────────\nInject chunks JSON\n(title, number, text, start)\ninto prompt template"]:::node
        L["🦙 llm_inference\n─────────────\nLLaMA 3.2 via Ollama\nstream: false"]:::node
        M["📤 format_response\n─────────────\nHuman-friendly answer\nwith video title\n& timestamp"]:::node
        N["💬 return_to_user\n─────────────\nPrint to console\nSave to response.txt"]:::node

        E --> F --> G --> H --> I
        I -- "✅ Relevant" --> K --> L --> M --> N
        I -- "❌ Off-topic" --> J
    end

    END(["🔴 END"]):::endd

    START --> INGESTION
    INGESTION --> QUERY
    D --> G
    N --> END
    J --> END

    classDef start fill:#22c55e,color:#fff,stroke:#16a34a,font-weight:bold
    classDef endd fill:#ef4444,color:#fff,stroke:#dc2626,font-weight:bold
    classDef node fill:#1e40af,color:#fff,stroke:#1d4ed8,rx:8
    classDef store fill:#7c3aed,color:#fff,stroke:#6d28d9
    classDef decision fill:#d97706,color:#fff,stroke:#b45309
    classDef warn fill:#dc2626,color:#fff,stroke:#b91c1c
```

---

## 2. 📥 External Ingestion Pipeline (Detailed)

> Step-by-step flow of how raw course videos become a searchable embedding database.

```mermaid
flowchart LR
    subgraph INPUT["🎬 Raw Input"]
        V1["Video #1\nInstalling VS Code\n.mp4"]
        V2["Video #18\nCSS Box Model\n.mp4"]
        VN["Video #N\n...\n.mp4"]
    end

    subgraph STAGE1["⚙️ Stage 1 — video_to_mp3.py"]
        direction TB
        P1["Parse filename\nExtract #number & title"]
        P2["FFmpeg subprocess\n-i Video/file.mp4\n→ audios/N_title.mp3"]
        P1 --> P2
    end

    subgraph STAGE2["🎙️ Stage 2 — mp3_to_json.py"]
        direction TB
        W1["Load Whisper\nlarge-v2 model"]
        W2["model.transcribe()\nlanguage='hi'\ntask='translate'"]
        W3["Split into segments\n{start, end, text}"]
        W4["Build chunk objects\n{number, title,\nstart, end, text}"]
        W5["Save JSON\njson/N_title.mp3.json"]
        W1 --> W2 --> W3 --> W4 --> W5
    end

    subgraph STAGE3["🧮 Stage 3 — read_chunks.py"]
        direction TB
        R1["List json/ directory"]
        R2["Load each .json"]
        R3["Batch texts\n32 per call"]
        R4["POST /api/embed\nbge-m3 via Ollama\n→ 1024-dim vector"]
        R5["Attach embedding\nto each chunk dict"]
        R6["Build DataFrame\nall videos combined"]
        R7["joblib.dump(df,\n'embedding.joblib')"]
        R1 --> R2 --> R3 --> R4 --> R5 --> R6 --> R7
    end

    subgraph OUTPUT["💾 Output"]
        DB[("embedding.joblib\n────────────\nColumns:\nnumber · title\nstart · end\ntext · chunk_id\nembedding (1024d)")]
    end

    INPUT --> STAGE1
    STAGE1 --> STAGE2
    STAGE2 --> STAGE3
    STAGE3 --> OUTPUT

    style INPUT fill:#0f172a,color:#94a3b8,stroke:#334155
    style STAGE1 fill:#1e3a5f,color:#bfdbfe,stroke:#3b82f6
    style STAGE2 fill:#1a2e1a,color:#bbf7d0,stroke:#22c55e
    style STAGE3 fill:#2d1b4e,color:#e9d5ff,stroke:#a855f7
    style OUTPUT fill:#1c1917,color:#fed7aa,stroke:#f97316
```

---

## 3. 💬 Enquiry Pipeline — Query Graph (Detailed)

> What happens when a student asks a question, end-to-end.

```mermaid
sequenceDiagram
    actor Student
    participant CLI as 🖥️ CLI (process_question.py)
    participant Ollama_Embed as 🔢 Ollama<br/>(bge-m3)
    participant VectorStore as 💾 embedding.joblib<br/>(Pandas + numpy)
    participant SimilarityEngine as 🔍 Cosine Similarity<br/>(scikit-learn)
    participant Prompt as ✍️ Prompt Builder
    participant Ollama_LLM as 🦙 Ollama<br/>(LLaMA 3.2)
    participant Files as 📁 prompt.txt<br/>response.txt

    Student->>CLI: "What is the CSS box model?"
    
    CLI->>Ollama_Embed: POST /api/embed<br/>{"model": "bge-m3", "input": [question]}
    Ollama_Embed-->>CLI: 1024-dimensional vector

    CLI->>VectorStore: Load embedding.joblib
    VectorStore-->>CLI: DataFrame (all chunks + embeddings)

    CLI->>SimilarityEngine: cosine_similarity(<br/>  question_vec vs all_chunk_vecs<br/>)
    SimilarityEngine-->>CLI: similarity scores array

    CLI->>CLI: argsort()[::-1][0:30]<br/>→ Top-30 chunk indices

    CLI->>Prompt: Inject top-30 chunks<br/>as JSON into template<br/>(title, number, text, start)
    Prompt-->>Files: Save to prompt.txt

    CLI->>Ollama_LLM: POST /api/generate<br/>{"model": "llama3.2",<br/>"stream": false,<br/>"prompt": ...}
    Ollama_LLM-->>CLI: Human-readable answer<br/>with video & timestamp

    CLI->>Files: Save to response.txt
    CLI-->>Student: ✅ "The CSS Box Model is covered in<br/>Video 18 at ~7 min 22 sec..."
```

---

## 4. 🔄 Full System State Machine (LangGraph Nodes & Edges)

```mermaid
stateDiagram-v2
    [*] --> Idle

    state "📥 Ingestion Mode" as Ingestion {
        [*] --> ConvertVideo
        ConvertVideo --> TranscribeAudio : FFmpeg success
        TranscribeAudio --> GenerateEmbeddings : Whisper done
        GenerateEmbeddings --> PersistStore : bge-m3 complete
        PersistStore --> [*] : Saved embedding.joblib
    }

    state "💬 Query Mode" as Query {
        [*] --> ReceiveQuestion
        ReceiveQuestion --> EmbedQuestion
        EmbedQuestion --> SearchStore
        SearchStore --> EvaluateRelevance

        state EvaluateRelevance <<choice>>
        EvaluateRelevance --> BuildPrompt : Relevant chunks found
        EvaluateRelevance --> OffTopicResponse : No relevant content

        BuildPrompt --> CallLLM
        CallLLM --> FormatResponse
        FormatResponse --> ReturnAnswer
        OffTopicResponse --> ReturnAnswer
        ReturnAnswer --> [*]
    }

    Idle --> Ingestion : Run read_chunks.py
    Idle --> Query : Run process_question.py
    Ingestion --> Idle : Embeddings ready
    Query --> Idle : Answer delivered
```

---

## 5. 📊 Data Flow & Transformation Summary

```mermaid
flowchart TD
    A["🎬 .mp4 Video Files\n/Video/"]
    B["🎵 .mp3 Audio Files\n/audios/"]
    C["📄 Subtitle JSON Chunks\n/json/\n{number, title, start, end, text}"]
    D["🔢 Embedded Chunks\nembedding.joblib\n+ 1024-dim vector per chunk"]
    E["❓ User Question\nRaw string"]
    F["🔢 Question Embedding\n1024-dim vector"]
    G["📊 Similarity Scores\nFloat array len(all_chunks)"]
    H["📋 Top-30 Chunks\nFiltered DataFrame"]
    I["📝 Filled Prompt\nprompt.txt"]
    J["💬 LLM Response\nresponse.txt"]

    A -->|"FFmpeg\nvideo_to_mp3.py"| B
    B -->|"Whisper large-v2\nmp3_to_json.py\nHi→En translation"| C
    C -->|"bge-m3 Ollama\nread_chunks.py\nbatch=32"| D

    E -->|"bge-m3 Ollama\nprocess_question.py"| F
    D & F -->|"cosine_similarity\nscikit-learn"| G
    G -->|"argsort top-30"| H
    H -->|"f-string template\nprompt.txt"| I
    I -->|"LLaMA 3.2\nOllama stream=false"| J

    style A fill:#1e293b,color:#94a3b8
    style B fill:#0c4a6e,color:#7dd3fc
    style C fill:#14532d,color:#86efac
    style D fill:#3b0764,color:#d8b4fe
    style E fill:#7c2d12,color:#fed7aa
    style F fill:#92400e,color:#fde68a
    style G fill:#064e3b,color:#6ee7b7
    style H fill:#1e1b4b,color:#a5b4fc
    style I fill:#4a1942,color:#f0abfc
    style J fill:#1c1917,color:#fef3c7
```
