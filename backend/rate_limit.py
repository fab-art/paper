"""Single-instance, per-IP rate limiting for the Render compute service.

The current Render deployment runs one application instance. Before scaling the
service horizontally, replace this process-local store with a shared Redis store.
"""
from __future__ import annotations

from threading import Lock
import time

WINDOW_SECONDS = 60
LIMITS = {"generate-plot": 20, "compile-latex": 4}
_counts: dict[tuple[str, str, int], int] = {}
_lock = Lock()


def reset_rate_limits() -> None:
    """Clear counters; intended for deterministic tests."""
    with _lock:
        _counts.clear()


def consume_rate_limit(path: str, ip: str, now: float | None = None) -> dict[str, int | bool]:
    limit = LIMITS.get(path)
    if limit is None:
        return {"allowed": True, "limit": 0, "remaining": 0, "retry_after": 0}

    current = time.monotonic() if now is None else now
    bucket = int(current // WINDOW_SECONDS)
    key = (path, ip, bucket)
    with _lock:
        count = _counts.get(key, 0) + 1
        _counts[key] = count
        if len(_counts) > 10000:
            oldest_bucket = bucket - 1
            stale = [entry for entry in _counts if entry[2] < oldest_bucket]
            for entry in stale:
                _counts.pop(entry, None)

    remaining = max(0, limit - count)
    retry_after = max(1, int(WINDOW_SECONDS - (current % WINDOW_SECONDS)))
    return {
        "allowed": count <= limit,
        "limit": limit,
        "remaining": remaining,
        "retry_after": retry_after,
    }
