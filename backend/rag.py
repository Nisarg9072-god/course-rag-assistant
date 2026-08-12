"""
RAG retrieval quality — intent detection, chunk filtering, and context selection.
"""

from __future__ import annotations

import json
import re
from typing import Literal

Intent = Literal["VIDEO_QA", "QUIZ", "SUMMARY"]

_LOW_QUALITY_PATTERNS = [
    re.compile(p, re.I)
    for p in [
        r"\bcomment section\b",
        r"\bcomment below\b",
        r"\blike (this video|and subscribe|the video)\b",
        r"\bsubscribe\b",
        r"\bput here video\b",
        r"\bvideo \d+\.mp4\b",
        r"^video #?\d+\.?\s*$",
        r"\btell me in the comment\b",
        r"\bask (your )?doubts\b",
        r"\bsee you in the next\b",
        r"\bshare (this video|with your friends)\b",
        r"\bdon'?t forget to like\b",
        r"^thanks\.?\s*$",
        r"^(okay|ok|yes|no|so|hi|hello|hey)\.?\s*$",
        r"\bi put here\b",
        r"\bthat video is playing\b",
        r"^hey this is html\.?\s*$",
        r"^html\.?\s*$",
        r"^using html\.?\s*$",
        r"^html is\.?\s*$",
    ]
]

_EDU_KEYWORDS = frozenset([
    "html", "css", "javascript", "website", "web site", "browser", "code",
    "element", "tag", "structure", "frontend", "front-end", "backend",
    "back-end", "server", "vscode", "vs code", "install", "developer",
    "programming", "markup", "hypertext", "domain", "http", "url",
    "html5", "syntax", "attribute", "document", "render", "client",
])

_QUIZ_PATTERNS = [
    re.compile(p, re.I) for p in [
        r"\bask me (a )?question\b",
        r"\bquiz me\b",
        r"\bgive me (a )?question\b",
        r"\btest me\b",
        r"\bask me something\b",
        r"\bquestion from (this )?(video|lesson)\b",
        r"\bask (me )?(a )?question from\b",
    ]
]

_SUMMARY_PATTERNS = [
    re.compile(p, re.I) for p in [
        r"\bsummarize\b",
        r"\bsummary of\b",
        r"\bwhat is video #?\d+ about\b",
        r"\bwhat is (this |the )?(video|lesson) about\b",
        r"\bwhat did (i learn|they teach|the instructor explain)\b",
        r"\bmain (topics|concepts|points)\b",
        r"\bwhat (did|does) .* teach\b",
        r"\bexplain what i learned\b",
        r"\bkey topics\b",
        r"\boverview of (this |the )?(video|lesson)\b",
    ]
]

_VIDEO_REF_PATTERN = re.compile(
    r"\b(?:video|lesson|tutorial)\s*#?\s*(\d+)\b", re.I
)

MIN_SIMILARITY = 0.42
CANDIDATE_POOL = 25
MAX_CONTEXT_CHUNKS = 8
MAX_SOURCE_CHUNKS = 5
MIN_QUALITY_SCORE = 0.25


def extract_video_number(question: str) -> int | None:
    m = _VIDEO_REF_PATTERN.search(question)
    return int(m.group(1)) if m else None


def detect_intent(question: str) -> Intent:
    q = question.strip()
    for pat in _QUIZ_PATTERNS:
        if pat.search(q):
            return "QUIZ"
    for pat in _SUMMARY_PATTERNS:
        if pat.search(q):
            return "SUMMARY"
    return "VIDEO_QA"


def is_low_quality_chunk(text: str) -> bool:
    t = (text or "").strip()
    if len(t) < 20:
        return True
    lower = t.lower()
    for pat in _LOW_QUALITY_PATTERNS:
        if pat.search(lower):
            return True
    words = t.split()
    if len(words) < 5 and not any(k in lower for k in _EDU_KEYWORDS):
        return True
    return False


def chunk_quality_score(text: str) -> float:
    t = (text or "").strip()
    if not t:
        return 0.0
    if is_low_quality_chunk(t):
        return 0.05
    lower = t.lower()
    score = min(1.0, len(t) / 100.0)
    word_count = len(t.split())
    if word_count >= 8:
        score += 0.2
    if word_count >= 15:
        score += 0.15
    edu_hits = sum(1 for k in _EDU_KEYWORDS if k in lower)
    score += min(0.4, edu_hits * 0.12)
    return min(1.0, score)


def combined_score(hit: dict) -> float:
    sim = float(hit.get("similarity", 0))
    quality = chunk_quality_score(hit.get("text", ""))
    return sim * (0.55 + 0.45 * quality)


def rewrite_query(question: str, intent: Intent, video_title: str = "") -> str:
    if intent == "QUIZ":
        title_bit = f' titled "{video_title}"' if video_title else ""
        return (
            f"Important web development concepts, definitions, and explanations "
            f"taught in this course video lesson{title_bit}. "
            f"Technical topics suitable for a quiz question."
        )
    if intent == "SUMMARY":
        title_bit = f' titled "{video_title}"' if video_title else ""
        return (
            f"Main topics, concepts, and learning objectives explained "
            f"throughout this course video lesson{title_bit}."
        )
    q = question.strip()
    q = _VIDEO_REF_PATTERN.sub("", q)
    q = re.sub(r"\b(from|in|about|on)\s+(this|the)\s+(video|lesson)\b", "", q, flags=re.I)
    q = re.sub(r"\s+", " ", q).strip()
    if len(q) < 8:
        return f"Educational content and concepts explained in {video_title or 'this video lesson'}"
    return q


def filter_and_rank_hits(
    hits: list[dict],
    intent: Intent,
    min_similarity: float = MIN_SIMILARITY,
) -> list[dict]:
    filtered = []
    for h in hits:
        sim = float(h.get("similarity", 0))
        if sim < min_similarity:
            continue
        if is_low_quality_chunk(h.get("text", "")):
            continue
        quality = chunk_quality_score(h.get("text", ""))
        if quality < MIN_QUALITY_SCORE:
            continue
        entry = dict(h)
        entry["_quality"] = quality
        entry["_combined"] = combined_score(h)
        filtered.append(entry)
    filtered.sort(key=lambda x: x["_combined"], reverse=True)
    return filtered


def select_diverse_chunks(ranked: list[dict], max_chunks: int = MAX_CONTEXT_CHUNKS) -> list[dict]:
    if len(ranked) <= max_chunks:
        return ranked
    selected: list[dict] = []
    used_starts: list[float] = []
    for h in ranked:
        start = float(h.get("start", 0))
        if any(abs(start - s) < 30 for s in used_starts):
            continue
        selected.append(h)
        used_starts.append(start)
        if len(selected) >= max_chunks:
            break
    if len(selected) < max_chunks:
        for h in ranked:
            if h not in selected:
                selected.append(h)
            if len(selected) >= max_chunks:
                break
    selected.sort(key=lambda x: float(x.get("start", 0)))
    return selected


def select_context_chunks(ranked: list[dict], intent: Intent) -> list[dict]:
    if not ranked:
        return []
    if intent == "SUMMARY":
        return select_diverse_chunks(ranked, MAX_CONTEXT_CHUNKS)
    return ranked[:MAX_CONTEXT_CHUNKS]


def build_prompt(
    intent: Intent,
    question: str,
    chunks: list[dict],
    video_num: int,
    video_title: str,
) -> str:
    chunks_json = [
        {"start": c["start"], "end": c.get("end", c["start"] + 10), "text": c["text"]}
        for c in chunks
    ]
    ctx = json.dumps(chunks_json, ensure_ascii=False)
    base_rules = (
        "Use ONLY the transcript context below.\n"
        "Do NOT use irrelevant chunks.\n"
        "Do NOT infer information not supported by the transcript.\n"
        "Never invent timestamps or video numbers.\n"
    )
    if intent == "QUIZ":
        return f"""You are a course instructor generating a quiz question from Video #{video_num}: "{video_title}".

{base_rules}
Generate ONE meaningful educational question based ONLY on the instructional content below.
Do NOT generate questions about comments, likes, subscriptions, or generic commentary.
Prefer concepts actually taught in the lesson.

Transcript context:
{ctx}

Student request: "{question}"

Respond with:
Question: [your question here]

Then one line: "Answer when you're ready, or watch the source section to review."
"""
    if intent == "SUMMARY":
        return f"""You are summarizing Video #{video_num}: "{video_title}" for a student.

{base_rules}
Provide a structured summary of what this video actually teaches.
Use bullet points for key topics.
Only include topics present in the transcript context.

Transcript context:
{ctx}

Student request: "{question}"

Give a clear summary with key topics covered in this video.
"""
    return f"""You are helping a student with Video #{video_num}: "{video_title}".

{base_rules}
If the context does not contain enough information to answer, say clearly:
"I couldn't find enough information about that in Video #{video_num}."

Transcript context:
{ctx}

Question: "{question}"

Give a clear, accurate answer based only on this video's transcript. Mention timestamps when relevant.
"""


def no_context_message(intent: Intent, video_num: int, video_title: str) -> str:
    if intent == "QUIZ":
        return (
            f"I couldn't find enough instructional content in Video #{video_num} "
            f"({video_title}) to generate a meaningful quiz question."
        )
    if intent == "SUMMARY":
        return f"I couldn't find enough content to summarize Video #{video_num} ({video_title})."
    return f"I couldn't find enough information about that in Video #{video_num}."


def format_debug_chunk(h: dict) -> dict:
    text = h.get("text", "")
    return {
        "videoNumber": h.get("number"),
        "start": h.get("start"),
        "end": h.get("end"),
        "similarity": round(float(h.get("similarity", 0)), 4),
        "quality": round(float(h.get("_quality", chunk_quality_score(text))), 4),
        "combined": round(float(h.get("_combined", combined_score(h))), 4),
        "textPreview": text[:150],
    }


def run_video_rag(
    question: str,
    video_num: int,
    video_title: str,
    video_db_id: str,
    *,
    embed_fn,
    search_fn,
    llm_fn=None,
    debug: bool = False,
) -> dict:
    """
    Full video-scoped RAG pipeline with intent detection and quality filtering.

    embed_fn(text) -> embedding vector
    search_fn(embedding, top_k, video_id) -> list of hit dicts
    llm_fn(prompt) -> answer string (optional; skip for debug-only retrieval)
    """
    intent = detect_intent(question)
    search_query = rewrite_query(question, intent, video_title)
    q_embedding = embed_fn(search_query)

    candidates = search_fn(q_embedding, top_k=CANDIDATE_POOL, video_id=video_db_id)

    # Assert video scope
    for h in candidates:
        if int(h.get("number", -1)) != video_num:
            print(f"[RAG WARNING] Cross-video leak: expected #{video_num}, got #{h.get('number')}")

    raw_debug = [format_debug_chunk(h) for h in candidates[:15]] if debug else None

    ranked = filter_and_rank_hits(candidates, intent)
    context_chunks = select_context_chunks(ranked, intent)
    source_chunks = context_chunks[:MAX_SOURCE_CHUNKS]

    result: dict = {
        "intent": intent,
        "searchQuery": search_query,
        "videoId": video_num,
    }

    if debug:
        result["debug"] = {
            "query": question,
            "intent": intent,
            "videoId": video_num,
            "searchQuery": search_query,
            "candidates": raw_debug,
            "filtered": [format_debug_chunk(h) for h in ranked[:15]],
            "finalContext": [format_debug_chunk(h) for h in context_chunks],
        }
        print(f"\n[RAG DEBUG] query={question!r} intent={intent} video={video_num}")
        print(f"[RAG DEBUG] search_query={search_query!r}")
        for i, h in enumerate(candidates[:8], 1):
            print(
                f"  cand {i}. sim={h.get('similarity', 0):.3f} "
                f"q={chunk_quality_score(h.get('text', '')):.2f} "
                f"@{h.get('start', 0):.0f}s | {h.get('text', '')[:80]}"
            )
        for i, h in enumerate(context_chunks[:5], 1):
            print(
                f"  ctx  {i}. combined={h.get('_combined', 0):.3f} "
                f"@{h.get('start', 0):.0f}s | {h.get('text', '')[:80]}"
            )

    if not context_chunks:
        msg = no_context_message(intent, video_num, video_title)
        result["answer"] = msg
        result["sources"] = []
        result["intent"] = intent
        return result

    if llm_fn is None:
        result["sources"] = source_chunks
        return result

    prompt = build_prompt(intent, question, context_chunks, video_num, video_title)
    answer = llm_fn(prompt)
    result["answer"] = answer
    result["sources"] = source_chunks
    result["intent"] = intent
    return result
