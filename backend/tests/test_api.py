"""Backend unit tests for auth, validation, and API security."""

import os
import sys
import tempfile
import unittest
from pathlib import Path

# Ensure backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("ADMIN_PASSWORD", "testpass")
os.environ.setdefault("FLASK_DEBUG", "false")

from auth import create_token, verify_password, validate_token, revoke_token  # noqa: E402


class AuthTests(unittest.TestCase):
    def test_verify_password(self):
        self.assertTrue(verify_password("testpass"))
        self.assertFalse(verify_password("wrong"))

    def test_token_lifecycle(self):
        token = create_token()
        self.assertTrue(validate_token(token))
        revoke_token(token)
        self.assertFalse(validate_token(token))


class ApiValidationTests(unittest.TestCase):
    def setUp(self):
        import api as api_module
        self.app = api_module.app
        self.client = self.app.test_client()

    def test_unauthenticated_upload_rejected(self):
        res = self.client.post("/api/videos/upload")
        self.assertEqual(res.status_code, 401)

    def test_unauthenticated_delete_rejected(self):
        res = self.client.delete("/api/videos/99")
        self.assertEqual(res.status_code, 401)

    def test_unauthenticated_retry_rejected(self):
        res = self.client.post("/api/jobs/00000000-0000-0000-0000-000000000000/retry")
        self.assertEqual(res.status_code, 401)

    def test_public_videos_list(self):
        res = self.client.get("/api/videos")
        self.assertEqual(res.status_code, 200)

    def test_invalid_job_id_format(self):
        token = create_token()
        res = self.client.get(
            "/api/jobs/not-a-uuid",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(res.status_code, 400)

    def test_legacy_video_route_removed(self):
        res = self.client.get("/videos/sample.mp4")
        self.assertEqual(res.status_code, 404)


class Mp4ValidationTests(unittest.TestCase):
    def test_is_valid_mp4(self):
        import api as api_module
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(b"\x00\x00\x00\x18ftypisom\x00\x00\x00\x00")
            path = f.name
        try:
            self.assertTrue(api_module._is_valid_mp4(path))
        finally:
            os.remove(path)

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(b"not an mp4 file")
            path = f.name
        try:
            self.assertFalse(api_module._is_valid_mp4(path))
        finally:
            os.remove(path)


class VectorStoreDedupTests(unittest.TestCase):
    def test_stable_chunk_ids(self):
        """add_chunks deletes existing video chunks before insert."""
        import vector_store
        if not vector_store.is_available():
            self.skipTest("ChromaDB not installed")

        dim = vector_store.EXPECTED_EMBEDDING_DIM
        chunks = [
            {"number": 9999, "title": "Test", "start": 0, "end": 5, "text": "hello", "chunk_index": 0},
        ]
        embeddings = [[0.0] * dim]
        vector_store.add_chunks("video_9999", chunks, embeddings)
        count1 = vector_store.get_chunk_count("video_9999")
        vector_store.add_chunks("video_9999", chunks, embeddings)
        count2 = vector_store.get_chunk_count("video_9999")
        vector_store.delete_video("video_9999")
        self.assertEqual(count1, 1)
        self.assertEqual(count2, 1)


if __name__ == "__main__":
    unittest.main()
