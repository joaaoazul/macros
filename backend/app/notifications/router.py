"""Notification inbox, unread badge, read receipts, category prefs and a test push."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database import get_db
from app.notifications.models import DbNotification
from app.notifications.schemas import (
    MarkReadIn,
    NotificationOut,
    NotificationPrefs,
    TestResult,
)
from app.notifications.service import get_prefs, mark_read, notify, out, unread_count

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    before: int | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[NotificationOut]:
    query = select(DbNotification).where(DbNotification.user_id == user.id)
    if before is not None:
        query = query.where(DbNotification.id < before)
    query = query.order_by(DbNotification.id.desc()).limit(limit)
    return [out(n) for n in (await db.execute(query)).scalars()]


@router.get("/unread-count")
async def notifications_unread(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return {"total": await unread_count(db, user.id)}


@router.post("/read", status_code=204)
async def read_notifications(
    body: MarkReadIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    await mark_read(db, user.id, body.upToId)


@router.get("/prefs", response_model=NotificationPrefs)
async def get_notification_prefs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NotificationPrefs:
    p = await get_prefs(db, user.id)
    return NotificationPrefs(messages=p.messages, friends=p.friends, social=p.social)


@router.put("/prefs", response_model=NotificationPrefs)
async def update_notification_prefs(
    body: NotificationPrefs,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NotificationPrefs:
    p = await get_prefs(db, user.id)
    p.messages, p.friends, p.social = body.messages, body.friends, body.social
    return NotificationPrefs(messages=p.messages, friends=p.friends, social=p.social)


@router.post("/test", response_model=TestResult)
async def test_notification(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TestResult:
    """Store a test inbox entry and, if VAPID is configured, deliver a real push now
    (even while online) so the user can confirm end-to-end delivery."""
    from app.push.service import push_enabled, send_push

    await notify(
        db,
        user.id,
        "test",
        "🔔 Notificação de teste",
        "Se estás a ver isto, as notificações estão a funcionar!",
        push=False,
    )
    pushed = False
    if push_enabled():
        await send_push(
            db, user.id, "🔔 Macros", "Notificação de teste — está tudo a funcionar!", "/app"
        )
        pushed = True
    return TestResult(pushConfigured=push_enabled(), pushed=pushed)
