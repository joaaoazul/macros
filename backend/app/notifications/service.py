"""Notification fan-out: store an inbox row, push it over WS, and (if the user is
offline and the category is enabled) mirror it to a Web Push."""

import logging

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.notifications.models import DbNotification, DbNotificationPref
from app.notifications.schemas import NotificationOut

logger = logging.getLogger(__name__)

# kind → pref column that gates the push (in-app inbox row is always stored)
_CATEGORY: dict[str, str] = {
    "friend_request": "friends",
    "friend_accepted": "friends",
    "reaction": "social",
    "nudge": "social",
    "badge": "social",
    "message_reaction": "social",
}


def out(n: DbNotification) -> NotificationOut:
    return NotificationOut(
        id=n.id,
        kind=n.kind,
        title=n.title,
        body=n.body,
        url=n.url,
        actorId=n.actor_id,
        read=n.read_at is not None,
        createdAt=n.created_at,
    )


async def get_prefs(db: AsyncSession, user_id: int) -> DbNotificationPref:
    pref = await db.get(DbNotificationPref, user_id)
    if pref is None:
        pref = DbNotificationPref(user_id=user_id)
        db.add(pref)
        await db.flush()
    return pref


async def push_allowed(db: AsyncSession, user_id: int, category: str) -> bool:
    pref = await get_prefs(db, user_id)
    return bool(getattr(pref, category, True))


async def unread_count(db: AsyncSession, user_id: int) -> int:
    return (
        await db.execute(
            select(func.count(DbNotification.id)).where(
                DbNotification.user_id == user_id, DbNotification.read_at.is_(None)
            )
        )
    ).scalar_one()


async def notify(
    db: AsyncSession,
    user_id: int,
    kind: str,
    title: str,
    body: str = "",
    url: str = "/app",
    actor_id: int | None = None,
    push: bool = True,
) -> DbNotification:
    """Create an inbox notification, broadcast it live, and Web Push it if offline.

    Never raises: a notification failure must not break the action that triggered it.
    """
    n = DbNotification(
        user_id=user_id, kind=kind, title=title, body=body[:300], url=url, actor_id=actor_id
    )
    db.add(n)
    await db.flush()
    await db.refresh(n)

    try:
        from app.messages.manager import manager

        await manager.send_to(user_id, {"type": "notification", "notification": out(n).model_dump(mode="json")})
        await manager.send_to(user_id, {"type": "notif_unread", "total": await unread_count(db, user_id)})

        if push and not manager.is_online(user_id):
            category = _CATEGORY.get(kind, "social")
            if await push_allowed(db, user_id, category):
                from app.push.service import send_push

                await send_push(db, user_id, title, body, url)
    except Exception:
        logger.warning("fan-out da notificação falhou (user=%s kind=%s)", user_id, kind, exc_info=True)
    return n


async def mark_read(db: AsyncSession, user_id: int, up_to_id: int | None = None) -> None:
    stmt = (
        update(DbNotification)
        .where(DbNotification.user_id == user_id, DbNotification.read_at.is_(None))
        .values(read_at=func.now())
    )
    if up_to_id is not None:
        stmt = stmt.where(DbNotification.id <= up_to_id)
    await db.execute(stmt)
    try:
        from app.messages.manager import manager

        await manager.send_to(user_id, {"type": "notif_unread", "total": await unread_count(db, user_id)})
    except Exception:
        pass
