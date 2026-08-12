import os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
for line in Path(__file__).parent.joinpath(".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, _, v = line.partition("=")
        os.environ[k.strip()] = v.strip()

import joblib
import vector_store
import api as api_module
from database import init_db, get_video_by_number, get_transcript_chunks

init_db()
api_module.load_embeddings()
df = api_module.df

v1_joblib = df[df["number"].astype(int) == 1] if df is not None else None
print("joblib chunks video 1:", len(v1_joblib) if v1_joblib is not None else 0)
print("chroma total:", vector_store.get_chunk_count())
print("chroma video_1:", vector_store.get_chunk_count("video_1"))

v = get_video_by_number(1)
db_chunks = get_transcript_chunks(v["id"]) if v else []
print("sqlite transcript chunks:", len(db_chunks))

# Sample educational chunks from joblib (middle of video)
if v1_joblib is not None and len(v1_joblib) > 0:
    mid = v1_joblib.iloc[len(v1_joblib)//3]
    print("sample mid chunk:", mid["start"], mid["text"][:120])
