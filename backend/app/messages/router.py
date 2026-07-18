"""Message REST endpoints: conversations (DM + grupos), histórico, envio, leitura, partilhas."""

from uuid import uuid4

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.data.models import DbCustomFood, DbRecipe
from app.data.schemas import Food, Recipe
from app.database import get_db
from app.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.messages.manager import manager
from app.messages.models import Conversation, ConversationMember, Message, MessageReaction
from app.messages.schemas import (
    ALLOWED_MESSAGE_REACTIONS,
    AddMembers,
    ConversationOut,
    CreateGroup,
    MessageOut,
    MessageReactionOut,
    PatchGroup,
    ReactMessage,
    ReplyPreview,
    SaveShareOut,
    SendMessage,
    Share,
    ShareFoodPayload,
    ShareRecipePayload,
    UnreadOut,
)
from app.messages.service import (
    MAX_GROUP_MEMBERS,
    check_message_rate,
    create_group,
    find_dm,
    get_or_create_dm,
    members_of,
    membership,
    unread_in,
    unread_total,
)
from app.social.schemas import PublicProfileLite
from app.social.service import are_friends, friend_ids

router = APIRouter(prefix="/api/v1/messages", tags=["messages"])

MAX_CUSTOM_FOODS = 2000
MAX_RECIPES = 200


def _preview(m: Message) -> ReplyPreview:
    """Resumo de uma linha da mensagem citada — sem arrastar a foto em base64."""
    if m.share:
        name = (m.share.get("payload") or {}).get("name") or ""
        kind = "share"
        text = f"{'🧾' if m.share.get('kind') == 'recipe' else '🍎'} {name}".strip()
    elif m.image and not m.body:
        kind, text = "image", "📷 Foto"
    else:
        kind, text = "text", m.body
    return ReplyPreview(
        id=m.id, senderId=m.sender_id, kind=kind, text=text[:120]  # type: ignore[arg-type]
    )


def _out(
    m: Message,
    reactions: list[MessageReactionOut] | None = None,
    replies: dict[int, Message] | None = None,
) -> MessageOut:
    quoted = replies.get(m.reply_to_id) if (replies and m.reply_to_id) else None
    return MessageOut(
        id=m.id,
        senderId=m.sender_id,
        conversationId=m.conversation_id,
        body=m.body,
        image=m.image,
        share=m.share,
        replyTo=_preview(quoted) if quoted else None,
        createdAt=m.created_at,
        reactions=reactions or [],
    )


async def _load_replies(db: AsyncSession, msgs: list[Message]) -> dict[int, Message]:
    """Carrega de uma vez as mensagens citadas (evita uma query por bolha)."""
    ids = {m.reply_to_id for m in msgs if m.reply_to_id}
    if not ids:
        return {}
    rows = (await db.execute(select(Message).where(Message.id.in_(ids)))).scalars()
    return {m.id: m for m in rows}


def _lite(u: User) -> PublicProfileLite:
    return PublicProfileLite(userId=u.id, username=u.username or "?", avatar=u.avatar, name=u.name)


async def _load_reactions(
    db: AsyncSession, message_ids: list[int]
) -> dict[int, list[MessageReactionOut]]:
    if not message_ids:
        return {}
    rows = (
        await db.execute(
            select(MessageReaction).where(MessageReaction.message_id.in_(message_ids))
        )
    ).scalars()
    out: dict[int, list[MessageReactionOut]] = {}
    for r in rows:
        out.setdefault(r.message_id, []).append(MessageReactionOut(userId=r.user_id, emoji=r.emoji))
    return out


def _share_preview(share: dict | None) -> str | None:
    if not share:
        return None
    name = (share.get("payload") or {}).get("name") or ""
    return f"🧾 Receita: {name}" if share.get("kind") == "recipe" else f"🍎 Alimento: {name}"


async def persist_and_push(
    db: AsyncSession,
    sender: User,
    conversation: Conversation,
    body: str,
    image: str | None = None,
    share: dict | None = None,
    reply_to_id: int | None = None,
) -> Message:
    """Valida, persiste e faz fan-out da mensagem a todos os membros. REST e WS."""
    quoted: Message | None = None
    if reply_to_id is not None:
        quoted = (
            await db.execute(select(Message).where(Message.id == reply_to_id))
        ).scalar_one_or_none()
        # citar só dentro da mesma conversa: senão dava para puxar texto de
        # threads onde não se participa
        if quoted is None or quoted.conversation_id != conversation.id:
            raise NotFoundError("Mensagem citada")

    members = await members_of(db, conversation.id)
    other_ids = [m.user_id for m in members if m.user_id != sender.id]
    if conversation.type == "dm":
        if not other_ids or not await are_friends(db, sender.id, other_ids[0]):
            raise ForbiddenError("Só podes enviar mensagens a amigos.")
    if not check_message_rate(sender.id):
        raise ValidationError("Demasiadas mensagens. Aguarda um pouco.")

    message = Message(
        sender_id=sender.id,
        # legado: DMs continuam a preencher recipient_id
        recipient_id=other_ids[0] if conversation.type == "dm" and len(other_ids) == 1 else None,
        conversation_id=conversation.id,
        body=body,
        image=image,
        share=share,
        reply_to_id=reply_to_id,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)  # created_at do servidor

    replies = {quoted.id: quoted} if quoted else None
    payload = {"type": "message", "message": _out(message, None, replies).model_dump(mode="json")}
    sender_name = sender.name or (f"@{sender.username}" if sender.username else "Alguém")
    preview = body if body else (_share_preview(share) or "📷 Foto")
    if len(preview) > 120:
        preview = preview[:117] + "…"
    if conversation.type == "group":
        push_title = conversation.title or "Grupo"
        push_body = f"{sender_name}: {preview}"
    else:
        push_title, push_body = sender_name, preview

    from app.notifications.service import push_allowed
    from app.push.service import send_push

    for uid in other_ids:
        await manager.send_to(uid, payload)
        await manager.send_to(uid, {"type": "unread", "total": await unread_total(db, uid)})
        # push só se o membro estiver offline E aceitar notificações de mensagens
        if not manager.is_online(uid) and await push_allowed(db, uid, "messages"):
            await send_push(db, uid, push_title, push_body, url="/")
    return message


async def _conversation_out(
    db: AsyncSession, conversation: Conversation, me: ConversationMember
) -> ConversationOut:
    members = await members_of(db, conversation.id)
    users_result = await db.execute(select(User).where(User.id.in_([m.user_id for m in members])))
    users = {u.id: u for u in users_result.scalars()}
    lites = [_lite(users[m.user_id]) for m in members if m.user_id in users]

    partner = None
    partner_read = None
    if conversation.type == "dm":
        for m in members:
            if m.user_id != me.user_id:
                partner = _lite(users[m.user_id]) if m.user_id in users else None
                partner_read = m.last_read_message_id
    last = (
        await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return ConversationOut(
        id=conversation.id,
        type=conversation.type,
        title=conversation.title,
        emoji=conversation.emoji,
        user=partner,
        members=lites,
        role=me.role,
        unread=await unread_in(db, conversation.id, me),
        lastMessage=_out(last) if last else None,
        partnerReadUpTo=partner_read,
        myReadUpTo=me.last_read_message_id,
    )


async def _broadcast_conversation_changed(db: AsyncSession, user_ids: list[int], conversation_id: int) -> None:
    """Avisa os clientes que a lista de conversas mudou (criação/membros/título)."""
    for uid in user_ids:
        await manager.send_to(uid, {"type": "conversation", "conversationId": conversation_id})


# ---------- conversas ----------


@router.get("/conversations", response_model=list[ConversationOut])
async def conversations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ConversationOut]:
    memberships = list(
        (
            await db.execute(
                select(ConversationMember).where(ConversationMember.user_id == user.id)
            )
        ).scalars()
    )
    out: list[ConversationOut] = []
    for me in memberships:
        conversation = await db.get(Conversation, me.conversation_id)
        if conversation is None:
            continue
        out.append(await _conversation_out(db, conversation, me))
    # mais recentes primeiro; conversas sem mensagens ordenam pela criação
    out.sort(key=lambda c: (c.lastMessage.id if c.lastMessage else 0, c.id), reverse=True)
    return out


@router.post("/dm/{user_id}", response_model=ConversationOut)
async def open_dm(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConversationOut:
    conversation = await get_or_create_dm(db, user, user_id)
    _, me = await membership(db, conversation.id, user.id)
    return await _conversation_out(db, conversation, me)


@router.get("/unread-count", response_model=UnreadOut)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UnreadOut:
    return UnreadOut(total=await unread_total(db, user.id))


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def conversation_history(
    conversation_id: int,
    before: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MessageOut]:
    await membership(db, conversation_id, user.id)
    query = select(Message).where(Message.conversation_id == conversation_id)
    if before is not None:
        query = query.where(Message.id < before)
    query = query.order_by(Message.id.desc()).limit(limit)
    msgs = list((await db.execute(query)).scalars())
    reactions = await _load_reactions(db, [m.id for m in msgs])
    replies = await _load_replies(db, msgs)
    return [_out(m, reactions.get(m.id, []), replies) for m in msgs]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageOut, status_code=201)
async def send_to_conversation(
    conversation_id: int,
    body: SendMessage,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOut:
    conversation, _ = await membership(db, conversation_id, user.id)
    share = body.share.model_dump(mode="json") if body.share else None
    message = await persist_and_push(db, user, conversation, body.body, body.image, share, body.replyToId)
    return _out(message, None, await _load_replies(db, [message]))


async def mark_conversation_read(
    db: AsyncSession, conversation: Conversation, me: ConversationMember
) -> None:
    """Avança o cursor de leitura e avisa os outros membros (read receipt)."""
    last_id = (
        await db.execute(
            select(func.max(Message.id)).where(Message.conversation_id == conversation.id)
        )
    ).scalar_one()
    if last_id is None or (me.last_read_message_id or 0) >= last_id:
        return
    me.last_read_message_id = last_id
    for m in await members_of(db, conversation.id):
        if m.user_id != me.user_id:
            await manager.send_to(
                m.user_id,
                {"type": "read", "conversationId": conversation.id, "by": me.user_id, "upToId": last_id},
            )
    # atualiza o badge do próprio noutras tabs
    await manager.send_to(me.user_id, {"type": "unread", "total": await unread_total(db, me.user_id)})


@router.post("/conversations/{conversation_id}/read", status_code=204)
async def mark_read(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    conversation, me = await membership(db, conversation_id, user.id)
    await mark_conversation_read(db, conversation, me)


# ---------- grupos ----------


@router.post("/groups", response_model=ConversationOut, status_code=201)
async def create_group_endpoint(
    body: CreateGroup,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConversationOut:
    conversation = await create_group(db, user, body.title, body.emoji, body.memberIds)
    members = await members_of(db, conversation.id)

    from app.notifications.service import notify

    owner_name = user.name or (f"@{user.username}" if user.username else "Alguém")
    for m in members:
        if m.user_id != user.id:
            await notify(
                db,
                m.user_id,
                "group_added",
                f"{owner_name} adicionou-te ao grupo «{conversation.title}»",
                actor_id=user.id,
            )
    await _broadcast_conversation_changed(db, [m.user_id for m in members], conversation.id)
    _, me = await membership(db, conversation.id, user.id)
    return await _conversation_out(db, conversation, me)


@router.patch("/groups/{conversation_id}", response_model=ConversationOut)
async def patch_group(
    conversation_id: int,
    body: PatchGroup,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConversationOut:
    conversation, me = await membership(db, conversation_id, user.id)
    if conversation.type != "group":
        raise NotFoundError("Grupo")
    if me.role != "owner":
        raise ForbiddenError("Só o dono pode editar o grupo.")
    if body.title is not None:
        conversation.title = body.title
    if body.emoji is not None:
        conversation.emoji = body.emoji
    members = await members_of(db, conversation_id)
    await _broadcast_conversation_changed(db, [m.user_id for m in members], conversation_id)
    return await _conversation_out(db, conversation, me)


@router.post("/groups/{conversation_id}/members", response_model=ConversationOut)
async def add_group_members(
    conversation_id: int,
    body: AddMembers,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConversationOut:
    conversation, me = await membership(db, conversation_id, user.id)
    if conversation.type != "group":
        raise NotFoundError("Grupo")
    if me.role != "owner":
        raise ForbiddenError("Só o dono pode adicionar membros.")

    members = await members_of(db, conversation_id)
    current = {m.user_id for m in members}
    new_ids = [uid for uid in dict.fromkeys(body.memberIds) if uid not in current]
    if not new_ids:
        return await _conversation_out(db, conversation, me)
    if len(current) + len(new_ids) > MAX_GROUP_MEMBERS:
        raise ValidationError(f"Máximo de {MAX_GROUP_MEMBERS} membros por grupo.")
    friends = set(await friend_ids(db, user.id))
    if not set(new_ids) <= friends:
        raise ForbiddenError("Só podes adicionar amigos ao grupo.")

    for uid in new_ids:
        db.add(ConversationMember(conversation_id=conversation_id, user_id=uid))
    await db.flush()

    from app.notifications.service import notify

    owner_name = user.name or (f"@{user.username}" if user.username else "Alguém")
    for uid in new_ids:
        await notify(
            db,
            uid,
            "group_added",
            f"{owner_name} adicionou-te ao grupo «{conversation.title}»",
            actor_id=user.id,
        )
    await _broadcast_conversation_changed(db, list(current | set(new_ids)), conversation_id)
    return await _conversation_out(db, conversation, me)


@router.delete("/groups/{conversation_id}/members/{member_user_id}", status_code=204)
async def remove_group_member(
    conversation_id: int,
    member_user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Dono expulsa um membro, ou o próprio sai (member_user_id == eu)."""
    conversation, me = await membership(db, conversation_id, user.id)
    if conversation.type != "group":
        raise NotFoundError("Grupo")
    if member_user_id == user.id:
        target = me
    else:
        if me.role != "owner":
            raise ForbiddenError("Só o dono pode remover membros.")
        target = (
            await db.execute(
                select(ConversationMember).where(
                    ConversationMember.conversation_id == conversation_id,
                    ConversationMember.user_id == member_user_id,
                )
            )
        ).scalar_one_or_none()
        if target is None:
            raise NotFoundError("Membro")

    was_owner = target.role == "owner"
    await db.delete(target)
    await db.flush()

    remaining = await members_of(db, conversation_id)
    if not remaining:
        await db.delete(conversation)
        await db.flush()
    elif was_owner:
        remaining[0].role = "owner"  # promove o membro mais antigo

    await _broadcast_conversation_changed(
        db, [m.user_id for m in remaining] + [member_user_id], conversation_id
    )


# ---------- reações ----------


async def _message_in_my_conversation(
    db: AsyncSession, message_id: int, user_id: int
) -> tuple[Message, Conversation]:
    message = (
        await db.execute(select(Message).where(Message.id == message_id))
    ).scalar_one_or_none()
    if message is None or message.conversation_id is None:
        raise NotFoundError("Mensagem")
    conversation, _ = await membership(db, message.conversation_id, user_id)
    return message, conversation


@router.put("/{message_id}/react", status_code=204)
async def react_message(
    message_id: int,
    body: ReactMessage,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Adiciona/troca a reação a uma mensagem de uma conversa em que participo."""
    if body.emoji not in ALLOWED_MESSAGE_REACTIONS:
        raise ValidationError("Reação inválida.")
    message, conversation = await _message_in_my_conversation(db, message_id, user.id)

    existing = (
        await db.execute(
            select(MessageReaction).where(
                MessageReaction.message_id == message_id, MessageReaction.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.emoji = body.emoji
    else:
        db.add(MessageReaction(message_id=message_id, user_id=user.id, emoji=body.emoji))

    event = {
        "type": "reaction",
        "conversationId": conversation.id,
        "messageId": message_id,
        "userId": user.id,
        "emoji": body.emoji,
    }
    for m in await members_of(db, conversation.id):
        await manager.send_to(m.user_id, event)


@router.delete("/{message_id}/react", status_code=204)
async def unreact_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    message, conversation = await _message_in_my_conversation(db, message_id, user.id)
    await db.execute(
        delete(MessageReaction).where(
            MessageReaction.message_id == message_id, MessageReaction.user_id == user.id
        )
    )
    event = {
        "type": "reaction",
        "conversationId": conversation.id,
        "messageId": message_id,
        "userId": user.id,
        "emoji": None,
    }
    for m in await members_of(db, conversation.id):
        await manager.send_to(m.user_id, event)


# ---------- partilhas ----------


@router.post("/{message_id}/save-share", response_model=SaveShareOut)
async def save_share(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SaveShareOut:
    """Copia o snapshot partilhado para os meus alimentos/receitas (id novo)."""
    message, _ = await _message_in_my_conversation(db, message_id, user.id)
    if not message.share:
        raise ValidationError("Esta mensagem não tem partilha.")
    share = Share.model_validate(message.share)
    new_id = f"shared-{uuid4().hex[:12]}"

    # conquista para quem partilhou (não para quem guarda o próprio)
    if message.sender_id != user.id:
        from app.social.service import award_sharer

        await award_sharer(db, message.sender_id)

    if share.kind == "food":
        count = (
            await db.execute(
                select(func.count(DbCustomFood.id)).where(DbCustomFood.user_id == user.id)
            )
        ).scalar_one()
        if count >= MAX_CUSTOM_FOODS:
            raise ValidationError("Limite de alimentos atingido.")
        f = ShareFoodPayload.model_validate(share.payload)
        db.add(
            DbCustomFood(
                user_id=user.id,
                food_id=new_id,
                name=f.name,
                emoji=f.emoji,
                kcal=f.kcal,
                protein=f.protein,
                carbs=f.carbs,
                fat=f.fat,
                unit=f.unit,
                brand=f.brand,
                fiber=f.fiber,
                sugar=f.sugar,
                saturates=f.saturates,
                salt=f.salt,
                portions=[p.model_dump() for p in f.portions] if f.portions else None,
            )
        )
        await db.flush()
        out = Food(id=new_id, custom=True, **f.model_dump())
        return SaveShareOut(kind="food", food=out)

    count = (
        await db.execute(select(func.count(DbRecipe.id)).where(DbRecipe.user_id == user.id))
    ).scalar_one()
    if count >= MAX_RECIPES:
        raise ValidationError("Limite de receitas atingido.")
    p = ShareRecipePayload.model_validate(share.payload)
    db.add(
        DbRecipe(
            user_id=user.id,
            recipe_id=new_id,
            name=p.name,
            emoji=p.emoji,
            auto=False,
            items=[i.model_dump() for i in p.items],
        )
    )
    await db.flush()
    return SaveShareOut(
        kind="recipe",
        recipe=Recipe(id=new_id, name=p.name, emoji=p.emoji, auto=False, items=p.items),
    )


# ---------- legado 1:1 (wrappers finos sobre DMs) ----------


@router.get("/with/{user_id}", response_model=list[MessageOut])
async def history_legacy(
    user_id: int,
    before: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MessageOut]:
    conversation = await find_dm(db, user.id, user_id)
    if conversation is None:
        if await are_friends(db, user.id, user_id):
            return []
        raise NotFoundError("Conversa")
    return await conversation_history(conversation.id, before, limit, db, user)


@router.post("/with/{user_id}", response_model=MessageOut, status_code=201)
async def send_message_legacy(
    user_id: int,
    body: SendMessage,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOut:
    conversation = await get_or_create_dm(db, user, user_id)
    share = body.share.model_dump(mode="json") if body.share else None
    message = await persist_and_push(db, user, conversation, body.body, body.image, share, body.replyToId)
    return _out(message, None, await _load_replies(db, [message]))


@router.post("/with/{user_id}/read", status_code=204)
async def mark_read_legacy(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    conversation = await find_dm(db, user.id, user_id)
    if conversation is None:
        return
    _, me = await membership(db, conversation.id, user.id)
    await mark_conversation_read(db, conversation, me)
