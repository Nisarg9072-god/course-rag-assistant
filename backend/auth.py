"""
Minimal admin authentication for instructor-only API routes.

Set ADMIN_PASSWORD in the environment. Clients obtain a bearer token via
POST /api/admin/login and send Authorization: Bearer <token> on admin requests.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import threading
import time
from functools import wraps

from flask import jsonify, request

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "changeme")
TOKEN_TTL_SECONDS = int(os.environ.get("ADMIN_TOKEN_TTL", str(24 * 3600)))


def _configured_password() -> str:
    return os.environ.get("ADMIN_PASSWORD", ADMIN_PASSWORD)

_tokens: dict[str, float] = {}
_lock = threading.Lock()


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str) -> bool:
    expected = _configured_password()
    if not expected:
        return False
    return hmac.compare_digest(password, expected)


def create_token() -> str:
    token = secrets.token_urlsafe(32)
    expires = time.time() + TOKEN_TTL_SECONDS
    with _lock:
        _purge_expired_unlocked()
        _tokens[token] = expires
    return token


def validate_token(token: str | None) -> bool:
    if not token:
        return False
    now = time.time()
    with _lock:
        _purge_expired_unlocked(now)
        exp = _tokens.get(token)
        if exp is None or exp < now:
            _tokens.pop(token, None)
            return False
        return True


def revoke_token(token: str | None):
    if not token:
        return
    with _lock:
        _tokens.pop(token, None)


def _purge_expired_unlocked(now: float | None = None):
    now = now if now is not None else time.time()
    expired = [t for t, exp in _tokens.items() if exp < now]
    for t in expired:
        del _tokens[t]


def get_bearer_token() -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return None


def require_admin(f):
    """Reject unauthenticated requests to instructor-only endpoints."""

    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_bearer_token()
        if not validate_token(token):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)

    return decorated
