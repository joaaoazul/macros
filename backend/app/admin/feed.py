"""Feed admin em tempo real: broadcast de eventos de auditoria a consolas SOC abertas.

In-memory, single-worker (mesmo requisito do ConnectionManager das mensagens).
"""

import asyncio
import logging

logger = logging.getLogger(__name__)


class AdminFeedManager:
    def __init__(self) -> None:
        self._queues: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._queues.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._queues.discard(q)

    async def broadcast(self, event: dict) -> None:
        for q in list(self._queues):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass  # consola lenta — descarta em vez de bloquear a gravação


admin_feed = AdminFeedManager()
