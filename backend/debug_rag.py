"""Debug RAG pipeline after quality fixes."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
for line in Path(__file__).parent.joinpath(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, _, v = line.partition("=")
        os.environ[k.strip()] = v.strip()

import api as api_module
from api import get_video_by_number
from database import init_db
import rag as rag_pipeline

init_db()
api_module.load_embeddings()

db_row = get_video_by_number(1)
queries = [
    "ask me the question from video 1",
    "What is video 1 about?",
    "What is HTML?",
    "Summarize video 1",
]

for q in queries:
    print("=" * 60)
    result = rag_pipeline.run_video_rag(
        q, 1, db_row["title"], db_row["id"],
        embed_fn=api_module.create_embedding,
        search_fn=api_module.find_similar_chunks,
        llm_fn=None,
        debug=True,
    )
    print(f"Intent: {result['intent']}")
    print(f"Search query: {result['searchQuery']}")
    print(f"Context chunks: {len(result.get('sources', []))}")
    for i, s in enumerate(result.get("sources", [])[:3], 1):
        print(f"  source {i}. @{s['start']:.0f}s | {s['text'][:90]}")
