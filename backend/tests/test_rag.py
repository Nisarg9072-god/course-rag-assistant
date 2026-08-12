"""Tests for RAG intent detection and chunk quality filtering."""
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag import (
    detect_intent,
    extract_video_number,
    is_low_quality_chunk,
    filter_and_rank_hits,
    rewrite_query,
    chunk_quality_score,
)


class IntentTests(unittest.TestCase):
    def test_quiz_intent(self):
        self.assertEqual(detect_intent("ask me the question from video 1"), "QUIZ")
        self.assertEqual(detect_intent("quiz me on video 1"), "QUIZ")
        self.assertEqual(detect_intent("give me a question from this video"), "QUIZ")

    def test_summary_intent(self):
        self.assertEqual(detect_intent("what is video 1 about?"), "SUMMARY")
        self.assertEqual(detect_intent("summarize video 1"), "SUMMARY")
        self.assertEqual(detect_intent("main topics of this lesson"), "SUMMARY")

    def test_video_qa_intent(self):
        self.assertEqual(detect_intent("What is HTML?"), "VIDEO_QA")
        self.assertEqual(detect_intent("Explain the box model"), "VIDEO_QA")

    def test_extract_video_number(self):
        self.assertEqual(extract_video_number("ask me from video 1"), 1)
        self.assertEqual(extract_video_number("video #18 content"), 18)
        self.assertIsNone(extract_video_number("What is HTML?"))


class ChunkQualityTests(unittest.TestCase):
    def test_low_quality_meta_chunks(self):
        self.assertTrue(is_low_quality_chunk("I put here video 1."))
        self.assertTrue(is_low_quality_chunk("Tell me in the comment section."))
        self.assertTrue(is_low_quality_chunk("Video 1.mp4."))

    def test_educational_chunks_not_filtered(self):
        text = "HTML stands for HyperText Markup Language and is used to structure web pages."
        self.assertFalse(is_low_quality_chunk(text))
        self.assertGreater(chunk_quality_score(text), 0.5)

    def test_filter_removes_meta_chunks(self):
        hits = [
            {"number": 1, "start": 1250, "end": 1251, "text": "I put here video 1.", "similarity": 0.69},
            {"number": 1, "start": 120, "end": 140,
             "text": "HTML stands for HyperText Markup Language used to structure content on websites.",
             "similarity": 0.55},
            {"number": 1, "start": 260, "end": 270, "text": "Tell me in the comment section.", "similarity": 0.62},
        ]
        ranked = filter_and_rank_hits(hits, "QUIZ")
        texts = [h["text"] for h in ranked]
        self.assertNotIn("I put here video 1.", texts)
        self.assertNotIn("Tell me in the comment section.", texts)
        self.assertTrue(any("HTML" in t for t in texts))

    def test_quiz_query_rewrite(self):
        q = rewrite_query("ask me a question from video 1", "QUIZ", "Installing VS Code")
        self.assertIn("concepts", q.lower())
        self.assertNotIn("ask me", q.lower())


if __name__ == "__main__":
    unittest.main()
