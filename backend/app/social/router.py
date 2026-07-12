"""Social endpoints: profile, search, friends, leaderboard, feed."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.auth.rate_limit import _RateLimiter
from app.database import get_db
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.social.models import FeedEvent, Friendship
from app.social.schemas import (
    FeedEventOut,
    FriendRequestIn,
    FriendshipOut,
    FriendsList,
    LeaderboardOut,
    LeaderboardRow,
    PublicProfile,
    PublicProfileLite,
    SearchResult,
    SocialMe,
    SocialMeUpdate,
    WeekInfo,
)
from app.social.service import (
    compute_leaderboard,
    derived_stats,
    emit_friend_joined,
    friend_ids,
    get_friendship,
    lisbon_today,
    week_window,
)

router = APIRouter(prefix="/api/v1/social", tags=["social"])

search_rate_limit = _RateLimiter("social_search", max_calls=30, window_seconds=60)
friend_req_rate_limit = _RateLimiter("friend_req", max_calls=10, window_seconds=3600)

MAX_PENDING_OUTGOING = 20

_RESERVED_USERNAMES = {"admin", "macros", "suporte", "support", "api", "sistema"}


def _display(u: User) -> str:
    return u.name or (f"@{u.username}" if u.username else "Alguém")


async def _push_friend(db: AsyncSession, user_id: int, text: str) -> None:
    """Notificação push de amizade (no-op se VAPID desativado)."""
    from app.push.service import send_push

    await send_push(db, user_id, "Macros", text, url="/")


def _lite(u: User) -> PublicProfileLite:
    return PublicProfileLite(
        userId=u.id,
        username=u.username or "?",
        avatar=u.avatar,
        avatarPhoto=u.avatar_photo,
        bio=u.bio,
        name=u.name,
    )


def _me(u: User) -> SocialMe:
    return SocialMe(
        userId=u.id,
        username=u.username,
        avatar=u.avatar,
        avatarPhoto=u.avatar_photo,
        bio=u.bio,
        name=u.name,
    )


@router.get("/me", response_model=SocialMe)
async def social_me(user: User = Depends(get_current_user)) -> SocialMe:
    return _me(user)


@router.put("/me", response_model=SocialMe)
async def update_social_me(
    body: SocialMeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SocialMe:
    username = body.username.lower()
    if username in _RESERVED_USERNAMES:
        raise ConflictError("Esse nome de utilizador não está disponível.")
    taken = await db.execute(select(User).where(User.username == username, User.id != user.id))
    if taken.scalar_one_or_none():
        raise ConflictError("Esse nome de utilizador já está ocupado.")
    user.username = username
    user.avatar = body.avatar
    user.avatar_photo = body.avatarPhoto
    user.bio = (body.bio or "").strip() or None
    db.add(user)
    return _me(user)


async def _friendship_status(db: AsyncSession, me: int, other: int) -> tuple[str, int | None]:
    f = await get_friendship(db, me, other)
    if f is None:
        return "none", None
    if f.status == "accepted":
        return "friends", f.id
    return ("outgoing", f.id) if f.requester_id == me else ("incoming", f.id)


@router.get("/search", response_model=list[SearchResult])
async def search_users(
    q: str = Query(min_length=3, max_length=20),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: None = Depends(search_rate_limit),
) -> list[SearchResult]:
    prefix = q.lower().strip()
    result = await db.execute(
        select(User)
        .where(User.username.is_not(None), User.username.like(f"{prefix}%"), User.id != user.id)
        .order_by(User.username)
        .limit(10)
    )
    out = []
    for u in result.scalars():
        status, _fid = await _friendship_status(db, user.id, u.id)
        out.append(
            SearchResult(
                userId=u.id,
                username=u.username or "?",
                avatar=u.avatar,
                name=u.name,
                friendship=status if status != "self" else "none",  # type: ignore[arg-type]
            )
        )
    return out


@router.get("/users/{username}", response_model=PublicProfile)
async def public_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PublicProfile:
    result = await db.execute(select(User).where(User.username == username.lower()))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundError("Utilizador")
    stats = await derived_stats(db, target.id)
    if target.id == user.id:
        status, fid = "self", None
    else:
        status, fid = await _friendship_status(db, user.id, target.id)
    return PublicProfile(
        userId=target.id,
        username=target.username or "?",
        avatar=target.avatar,
        avatarPhoto=target.avatar_photo,
        bio=target.bio,
        name=target.name,
        stats=stats,  # type: ignore[arg-type]
        friendship=status,  # type: ignore[arg-type]
        friendshipId=fid,
    )


@router.post("/friends/requests", response_model=FriendshipOut, status_code=201)
async def send_friend_request(
    body: FriendRequestIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: None = Depends(friend_req_rate_limit),
) -> FriendshipOut:
    result = await db.execute(select(User).where(User.username == body.username.lower()))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundError("Utilizador")
    if target.id == user.id:
        raise ValidationError("Não podes adicionar-te a ti próprio.")

    existing = await get_friendship(db, user.id, target.id)
    if existing:
        if existing.status == "accepted":
            raise ConflictError("Já são amigos.")
        if existing.requester_id == user.id:
            raise ConflictError("Pedido já enviado.")
        # pedido inverso pendente → auto-aceitar
        existing.status = "accepted"
        existing.accepted_at = datetime.now(timezone.utc)
        await emit_friend_joined(db, user.id, target.id, lisbon_today())
        return FriendshipOut(id=existing.id, user=_lite(target), status="accepted")

    pending_count = await db.execute(
        select(Friendship).where(Friendship.requester_id == user.id, Friendship.status == "pending")
    )
    if len(pending_count.scalars().all()) >= MAX_PENDING_OUTGOING:
        raise ValidationError("Demasiados pedidos pendentes.")

    friendship = Friendship(requester_id=user.id, addressee_id=target.id, status="pending")
    db.add(friendship)
    await db.flush()
    await _push_friend(db, target.id, f"{_display(user)} enviou-te um pedido de amizade")
    return FriendshipOut(id=friendship.id, user=_lite(target), status="pending", direction="outgoing")


@router.post("/friends/requests/{friendship_id}/accept", response_model=FriendshipOut)
async def accept_friend_request(
    friendship_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FriendshipOut:
    result = await db.execute(
        select(Friendship).where(
            Friendship.id == friendship_id,
            Friendship.addressee_id == user.id,
            Friendship.status == "pending",
        )
    )
    friendship = result.scalar_one_or_none()
    if not friendship:
        raise NotFoundError("Pedido de amizade")
    friendship.status = "accepted"
    friendship.accepted_at = datetime.now(timezone.utc)
    await emit_friend_joined(db, friendship.requester_id, friendship.addressee_id, lisbon_today())
    other = (await db.execute(select(User).where(User.id == friendship.requester_id))).scalar_one()
    await _push_friend(db, other.id, f"{_display(user)} aceitou o teu pedido de amizade")
    return FriendshipOut(id=friendship.id, user=_lite(other), status="accepted")


@router.delete("/friends/requests/{friendship_id}", status_code=204)
async def cancel_or_decline_request(
    friendship_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(
        select(Friendship).where(
            Friendship.id == friendship_id,
            Friendship.status == "pending",
            or_(Friendship.requester_id == user.id, Friendship.addressee_id == user.id),
        )
    )
    friendship = result.scalar_one_or_none()
    if not friendship:
        raise NotFoundError("Pedido de amizade")
    await db.delete(friendship)


@router.get("/friends", response_model=FriendsList)
async def list_friends(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FriendsList:
    result = await db.execute(
        select(Friendship).where(
            or_(Friendship.requester_id == user.id, Friendship.addressee_id == user.id)
        )
    )
    friendships = result.scalars().all()
    other_ids = {
        f.addressee_id if f.requester_id == user.id else f.requester_id for f in friendships
    }
    users = {}
    if other_ids:
        users_result = await db.execute(select(User).where(User.id.in_(other_ids)))
        users = {u.id: u for u in users_result.scalars()}

    friends, incoming, outgoing = [], [], []
    for f in friendships:
        other_id = f.addressee_id if f.requester_id == user.id else f.requester_id
        other = users.get(other_id)
        if not other:
            continue
        if f.status == "accepted":
            friends.append(FriendshipOut(id=f.id, user=_lite(other), status="accepted"))
        elif f.requester_id == user.id:
            outgoing.append(FriendshipOut(id=f.id, user=_lite(other), status="pending", direction="outgoing"))
        else:
            incoming.append(FriendshipOut(id=f.id, user=_lite(other), status="pending", direction="incoming"))
    return FriendsList(friends=friends, incoming=incoming, outgoing=outgoing)


@router.delete("/friends/{user_id}", status_code=204)
async def remove_friend(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    friendship = await get_friendship(db, user.id, user_id)
    if not friendship or friendship.status != "accepted":
        raise NotFoundError("Amizade")
    await db.delete(friendship)


@router.get("/leaderboard", response_model=LeaderboardOut)
async def leaderboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LeaderboardOut:
    today = lisbon_today()
    start, end = week_window(today)
    rows = await compute_leaderboard(db, user.id, today)
    return LeaderboardOut(
        week=WeekInfo(start=start, end=end),
        rows=[LeaderboardRow(**r) for r in rows],
    )


@router.get("/feed", response_model=list[FeedEventOut])
async def feed(
    before: int | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[FeedEventOut]:
    ids = [user.id, *await friend_ids(db, user.id)]
    query = select(FeedEvent, User).join(User, User.id == FeedEvent.user_id).where(
        FeedEvent.user_id.in_(ids)
    )
    if before is not None:
        query = query.where(FeedEvent.id < before)
    query = query.order_by(FeedEvent.id.desc()).limit(limit)
    result = await db.execute(query)
    return [
        FeedEventOut(
            id=e.id,
            kind=e.kind,
            refDate=e.ref_date,
            payload=e.payload,
            user=_lite(u),
            createdAt=e.created_at,
        )
        for e, u in result.all()
    ]
