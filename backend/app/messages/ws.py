"""WebSocket endpoint: real-time messaging.

Auth: cookie access_token no handshake (same-origin envia cookies). accept() →
validar → close(4401) se inválido. Socket fecha no exp do token (cliente faz
refresh e reconecta). Origin check porque o middleware CSRF só cobre HTTP.
"""

import asyncio
import logging
from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.auth.dependencies import resolve_user_from_token
from app.auth.security import decode_token
from app.config import settings
from app.database import async_session_factory
from app.exceptions import ForbiddenError, UnauthorizedError, ValidationError
from app.messages.manager import manager
from app.messages.router import persist_and_push
from app.messages.schemas import SendMessage

logger = logging.getLogger(__name__)

router = APIRouter()

CLOSE_AUTH = 4401


def _origin_allowed(ws: WebSocket) -> bool:
    origin = ws.headers.get("origin")
    if not origin:
        return True  # clientes não-browser (testes) não enviam Origin
    allowed = set(settings.CORS_ORIGINS) | {str(settings.APP_URL).rstrip("/")}
    return origin.rstrip("/") in allowed


@router.websocket("/api/v1/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()

    if not _origin_allowed(ws):
        await ws.close(code=CLOSE_AUTH)
        return

    token = ws.cookies.get("access_token")
    if not token:
        auth = ws.headers.get("authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        await ws.close(code=CLOSE_AUTH)
        return

    try:
        payload = decode_token(token)
        exp: int = payload["exp"]
        async with async_session_factory() as db:
            user = await resolve_user_from_token(token, db)
    except (jwt.InvalidTokenError, UnauthorizedError, KeyError):
        await ws.close(code=CLOSE_AUTH)
        return

    user_id = user.id
    manager.connect(user_id, ws)

    # fecha o socket quando o access token expira → cliente refresca e reconecta
    seconds_left = exp - datetime.now(timezone.utc).timestamp()
    expiry_task = asyncio.create_task(_close_at_expiry(ws, seconds_left))

    try:
        # unread inicial (mensagens + notificações)
        async with async_session_factory() as db:
            from app.messages.router import _unread_total
            from app.notifications.service import unread_count as notif_unread

            await ws.send_json({"type": "unread", "total": await _unread_total(db, user_id)})
            await ws.send_json({"type": "notif_unread", "total": await notif_unread(db, user_id)})

        while True:
            data = await ws.receive_json()
            await _handle(ws, user_id, data)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Erro no WebSocket (user=%s)", user_id)
        try:
            await ws.close(code=1011)
        except Exception:
            pass
    finally:
        expiry_task.cancel()
        manager.disconnect(user_id, ws)


async def _close_at_expiry(ws: WebSocket, seconds: float) -> None:
    try:
        await asyncio.sleep(max(seconds, 0))
        await ws.close(code=CLOSE_AUTH)
    except asyncio.CancelledError:
        pass
    except Exception:
        pass


async def _handle(ws: WebSocket, user_id: int, data: dict) -> None:
    msg_type = data.get("type")
    client_id = data.get("clientId")

    if msg_type == "ping":
        await ws.send_json({"type": "pong"})
        return

    if msg_type == "read":
        other_id = data.get("from")
        if isinstance(other_id, int):
            from app.messages.router import mark_conversation_read

            async with async_session_factory() as db:
                try:
                    await mark_conversation_read(db, user_id, other_id)
                    await db.commit()
                except Exception:
                    await db.rollback()
                    raise
        return

    if msg_type == "send":
        to = data.get("to")
        body_raw = data.get("body")
        if not isinstance(to, int) or not isinstance(body_raw, str):
            await ws.send_json({"type": "error", "code": "bad_request", "clientId": client_id})
            return
        try:
            body = SendMessage(body=body_raw).body
        except ValueError:
            await ws.send_json({"type": "error", "code": "too_long", "clientId": client_id})
            return

        async with async_session_factory() as db:
            try:
                from app.auth.models import User
                from sqlalchemy import select

                sender = (await db.execute(select(User).where(User.id == user_id))).scalar_one()
                message = await persist_and_push(db, sender, to, body)
                await db.commit()
            except ForbiddenError:
                await db.rollback()
                await ws.send_json({"type": "error", "code": "not_friends", "clientId": client_id})
                return
            except ValidationError:
                await db.rollback()
                await ws.send_json({"type": "error", "code": "rate_limited", "clientId": client_id})
                return
            except Exception:
                await db.rollback()
                logger.exception("Falha a enviar mensagem via WS")
                await ws.send_json({"type": "error", "code": "bad_request", "clientId": client_id})
                return

        # eco para o remetente (todas as tabs, incluindo esta, com clientId)
        from app.messages.router import _out

        await manager.send_to(
            user_id,
            {"type": "message", "message": _out(message).model_dump(mode="json"), "clientId": client_id},
        )
        return

    await ws.send_json({"type": "error", "code": "bad_request", "clientId": client_id})
