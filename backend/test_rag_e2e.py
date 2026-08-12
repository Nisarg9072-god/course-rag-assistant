import requests

BASE = "http://localhost:5002"
TESTS = [
    ("ask me the question from video 1", "QUIZ"),
    ("What is video 1 about?", "SUMMARY"),
    ("What is HTML?", "VIDEO_QA"),
    ("Summarize video 1", "SUMMARY"),
    ("Give me a quiz question from video 1", "QUIZ"),
]

for q, expected in TESTS:
    r = requests.post(f"{BASE}/api/ask", json={"question": q}, timeout=180)
    d = r.json()
    intent = d.get("intent")
    ok = "OK" if intent == expected else f"EXPECTED {expected}"
    print("=" * 50)
    print("Q:", q)
    print("Intent:", intent, ok)
    ans = (d.get("answer") or d.get("error", ""))[:250].replace("\n", " ")
    print("Answer:", ans)
    src = d.get("sources") or []
    if src:
        s = src[0]
        print(f"Source: #{s.get('number')} @{s.get('start')}s | {s.get('text', '')[:80]}")
    else:
        print("Sources: none")
