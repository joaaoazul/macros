"""Message REST endpoints: conversations, history, send (fallback), read receipts."""

import time
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database import get_db
from app.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.messages.manager import manager
from app.messages.models import Message
from app.messages.schemas import ConversationOut, MessageOut, SendMessage, UnreadOut
from app.social.schemas import PublicProfileLite
from app.social.service import are_friends, friend_ids

router = APIRouter(prefix="/api/v1/messages", tags=["messages"])

# Rate limit por UTILIZADOR (não IP): 30 mensagens/min
_MSG_MAX, _MSG_WINDOW = 30, 60
_msg_buckets: dict[int, list[float]] = defaultdict(list)


def check_message_rate(user_id: int) -> bool:
    now = time.monotonic()
    bucket = [t for t in _msg_buckets[user_id] if t > now - _MSG_WINDOW]
    if len(bucket) >= _MSG_MAX:
        _msg_buckets[user_id] = bucket
        return False
    bucket.append(now)
    _msg_buckets[user_id] = bucket
    return True


def _out(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id,
        senderId=m.sender_id,
        recipientId=m.recipient_id,
        body=m.body,
        createdAt=m.created_at,
        readAt=m.read_at,
    )


def _pair(a: int, b: int):
    return or_(
        (Message.sender_id == a) & (Message.recipient_id == b),
        (Message.sender_id == b) & (Message.recipient_id == a),
    )


async def persist_and_push(
    db: AsyncSession, sender: User, recipient_id: int, body: str
) -> Message:
    """Valida, persiste e empurra a mensagem via WS. Partilhado por REST e WebSocket."""
    if not await are_friends(db, sender.id, recipient_id):
        raise ForbiddenError("Só podes enviar mensagens a amigos.")
    if not check_message_rate(sender.id):
        raise ValidationError("Demasiadas mensagens. Aguarda um pouco.")

    message = Message(sender_id=sender.id, recipient_id=recipient_id, body=body)
    db.add(message)
    await db.flush()
    await db.refresh(message)  # created_at do servidor

    payload = {"type": "message", "message": _out(message).model_dump(mode="json")}
    await manager.send_to(recipient_id, payload)
    unread = await _unread_total(db, recipient_id)
    await manager.send_to(recipient_id, {"type": "unread", "total": unread})
    return message


async def _unread_total(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(
        select(func.count(Message.id)).where(
            Message.recipient_id == user_id, Message.read_at.is_(None)
        )
    )
    return result.scalar_one()


@router.get("/conversations", response_model=list[ConversationOut])
async def conversations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ConversationOut]:
    # amigos aceites ∪ pessoas com histórico de mensagens
    ids = set(await friend_ids(db, user.id))
    partners = await db.execute(
        select(Message.sender_id, Message.recipient_id).where(
            or_(Message.sender_id == user.id, Message.recipient_id == user.id)
        )
    )
    for s, r in partners.all():
        ids.add(r if s == user.id else s)
    ids.discard(user.id)
    if not ids:
        return []

    users_result = await db.execute(select(User).where(User.id.in_(ids)))
    users = {u.id: u for u in users_result.scalars()}

    out = []
    for other_id in ids:
        other = users.get(other_id)
        if not other:
            continue
        last = (
            await db.execute(
                select(Message).where(_pair(user.id, other_id)).order_by(Message.id.desc()).limit(1)
            )
        ).scalar_one_or_none()
        unread = (
            await db.execute(
                select(func.count(Message.id)).where(
                    Message.sender_id == other_id,
                    Message.recipient_id == user.id,
                    Message.read_at.is_(None),
                )
            )
        ).scalar_one()
        out.append(
            ConversationOut(
                user=PublicProfileLite(
                    userId=other.id, username=other.username or "?", avatar=other.avatar, name=other.name
                ),
                lastMessage=_out(last) if last else None,
                unread=unread,
            )
        )
    # mais recentes primeiro; conversas vazias no fim
    out.sort(key=lambda c: c.lastMessage.id if c.lastMessage else 0, reverse=True)
    return out


@router.get("/unread-count", response_model=UnreadOut)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UnreadOut:
    return UnreadOut(total=await _unread_total(db, user.id))


@router.get("/with/{user_id}", response_model=list[MessageOut])
async def history(
    user_id: int,
    before: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MessageOut]:
    friends = await are_friends(db, user.id, user_id)
    has_history = (
        await db.execute(select(Message.id).where(_pair(user.id, user_id)).limit(1))
    ).scalar_one_or_none() is not None
    if not friends and not has_history:
        raise NotFoundError("Conversa")

    query = select(Message).where(_pair(user.id, user_id))
    if before is not None:
        query = query.where(Message.id < before)
    query = query.order_by(Message.id.desc()).limit(limit)
    result = await db.execute(query)
    return [_out(m) for m in result.scalars()]


@router.post("/with/{user_id}", response_model=MessageOut, status_code=201)
async def send_message_rest(
    user_id: int,
    body: SendMessage,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOut:
    message = await persist_and_push(db, user, user_id, body.body)
    return _out(message)


async def mark_conversation_read(db: AsyncSession, reader_id: int, other_id: int) -> None:
    """Marca como lidas as mensagens de other→reader e envia read receipt via WS."""
    result = await db.execute(
        update(Message)
        .where(
            Message.sender_id == other_id,
            Message.recipient_id == reader_id,
            Message.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    if result.rowcount:
        last_id = (
            await db.execute(select(func.max(Message.id)).where(_pair(reader_id, other_id)))
        ).scalar_one()
        await manager.send_to(other_id, {"type": "read", "by": reader_id, "upToId": last_id})


@router.post("/with/{user_id}/read", status_code=204)
async def mark_read(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    await mark_conversation_read(db, user.id, user_id)
