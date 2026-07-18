"""Conversation helpers: membership, DMs, groups and cursor-based unread."""

import time
from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.messages.models import Conversation, ConversationMember, Message
from app.social.service import are_friends, friend_ids

MAX_GROUP_MEMBERS = 20
MAX_GROUPS_PER_USER = 30

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


async def membership(
    db: AsyncSession, conversation_id: int, user_id: int
) -> tuple[Conversation, ConversationMember]:
    """Conversa + linha de membro do utilizador, ou 404 se não participa."""
    conversation = await db.get(Conversation, conversation_id)
    member = (
        await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if conversation is None or member is None:
        raise NotFoundError("Conversa")
    return conversation, member


async def members_of(db: AsyncSession, conversation_id: int) -> list[ConversationMember]:
    rows = await db.execute(
        select(ConversationMember)
        .where(ConversationMember.conversation_id == conversation_id)
        .order_by(ConversationMember.id)
    )
    return list(rows.scalars())


async def find_dm(db: AsyncSession, a: int, b: int) -> Conversation | None:
    in_a = select(ConversationMember.conversation_id).where(ConversationMember.user_id == a)
    in_b = select(ConversationMember.conversation_id).where(ConversationMember.user_id == b)
    return (
        await db.execute(
            select(Conversation).where(
                Conversation.type == "dm", Conversation.id.in_(in_a), Conversation.id.in_(in_b)
            )
        )
    ).scalar_one_or_none()


async def get_or_create_dm(db: AsyncSession, user: User, other_id: int) -> Conversation:
    """DM existente entre os dois, ou cria uma nova (só entre amigos)."""
    if other_id == user.id:
        raise ValidationError("Não podes conversar contigo próprio.")
    existing = await find_dm(db, user.id, other_id)
    if existing is not None:
        return existing
    if not await are_friends(db, user.id, other_id):
        raise ForbiddenError("Só podes enviar mensagens a amigos.")
    conversation = Conversation(type="dm")
    db.add(conversation)
    await db.flush()
    db.add(ConversationMember(conversation_id=conversation.id, user_id=user.id))
    db.add(ConversationMember(conversation_id=conversation.id, user_id=other_id))
    await db.flush()
    return conversation


async def create_group(
    db: AsyncSession, owner: User, title: str, emoji: str, member_ids: list[int]
) -> Conversation:
    """Cria um grupo. Todos os membros têm de ser amigos do dono."""
    ids = sorted(set(member_ids) - {owner.id})
    if not ids:
        raise ValidationError("Um grupo precisa de pelo menos mais uma pessoa.")
    if len(ids) + 1 > MAX_GROUP_MEMBERS:
        raise ValidationError(f"Máximo de {MAX_GROUP_MEMBERS} membros por grupo.")

    owned = (
        await db.execute(
            select(func.count(ConversationMember.id))
            .join(Conversation, Conversation.id == ConversationMember.conversation_id)
            .where(
                ConversationMember.user_id == owner.id,
                ConversationMember.role == "owner",
                Conversation.type == "group",
            )
        )
    ).scalar_one()
    if owned >= MAX_GROUPS_PER_USER:
        raise ValidationError("Limite de grupos atingido.")

    friends = set(await friend_ids(db, owner.id))
    if not set(ids) <= friends:
        raise ForbiddenError("Só podes adicionar amigos ao grupo.")

    conversation = Conversation(type="group", title=title, emoji=emoji, created_by=owner.id)
    db.add(conversation)
    await db.flush()
    db.add(ConversationMember(conversation_id=conversation.id, user_id=owner.id, role="owner"))
    for uid in ids:
        db.add(ConversationMember(conversation_id=conversation.id, user_id=uid))
    await db.flush()
    return conversation


async def unread_in(db: AsyncSession, conversation_id: int, member: ConversationMember) -> int:
    """Mensagens dos outros depois do cursor de leitura do membro."""
    return (
        await db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id == conversation_id,
                Message.sender_id != member.user_id,
                Message.id > (member.last_read_message_id or 0),
            )
        )
    ).scalar_one()


async def unread_total(db: AsyncSession, user_id: int) -> int:
    """Total de mensagens por ler em todas as conversas do utilizador."""
    return (
        await db.execute(
            select(func.count(Message.id))
            .join(
                ConversationMember,
                ConversationMember.conversation_id == Message.conversation_id,
            )
            .where(
                ConversationMember.user_id == user_id,
                Message.sender_id != user_id,
                Message.id > func.coalesce(ConversationMember.last_read_message_id, 0),
            )
        )
    ).scalar_one()
