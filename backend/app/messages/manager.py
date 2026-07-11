"""In-memory WebSocket connection manager (single-container deploy)."""

import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}

    def connect(self, user_id: int, ws: WebSocket) -> None:
        self._connections.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: int, ws: WebSocket) -> None:
        sockets = self._connections.get(user_id)
        if sockets:
            sockets.discard(ws)
            if not sockets:
                self._connections.pop(user_id, None)

    def is_online(self, user_id: int) -> bool:
        return bool(self._connections.get(user_id))

    async def send_to(self, user_id: int, payload: dict, exclude: WebSocket | None = None) -> None:
        """Envia a todos os sockets do utilizador; remove os mortos silenciosamente."""
        dead = []
        for ws in list(self._connections.get(user_id, ())):
            if ws is exclude:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)


manager = ConnectionManager()
