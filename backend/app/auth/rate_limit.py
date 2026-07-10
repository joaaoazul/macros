"""Simple in-memory rate limiter — no external dependencies."""

import time
from collections import defaultdict
from typing import ClassVar

from fastapi import HTTPException, Request


class _RateLimiter:
    _buckets: ClassVar[dict[str, list[float]]] = defaultdict(list)

    def __init__(self, name: str, max_calls: int, window_seconds: int) -> None:
        self.name = name
        self.max_calls = max_calls
        self.window = window_seconds

    def __call__(self, request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        key = f"{self.name}:{ip}"
        now = time.monotonic()
        cutoff = now - self.window
        self._buckets[key] = [t for t in self._buckets[key] if t > cutoff]
        if len(self._buckets[key]) >= self.max_calls:
            raise HTTPException(
                status_code=429,
                detail="Demasiadas tentativas. Aguarda antes de tentar novamente.",
                headers={"Retry-After": str(self.window)},
            )
        self._buckets[key].append(now)


auth_rate_limit = _RateLimiter("auth", max_calls=10, window_seconds=60)
forgot_rate_limit = _RateLimiter("forgot", max_calls=3, window_seconds=900)
