"""Web Push: chave pública VAPID, subscrever e cancelar subscrição."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.config import settings
from app.database import get_db
from app.push.models import DbPushSubscription
from app.push.schemas import PushSubscriptionIn, PushUnsubscribeIn, VapidKeyOut
from app.push.service import push_enabled

router = APIRouter(prefix="/api/v1/push", tags=["push"])


@router.get("/vapid-public-key", response_model=VapidKeyOut)
async def vapid_public_key() -> VapidKeyOut:
    if not push_enabled():
        raise HTTPException(status_code=503, detail="Notificações push não estão disponíveis.")
    return VapidKeyOut(key=settings.VAPID_PUBLIC_KEY)


@router.post("/subscribe", status_code=204)
async def subscribe(
    body: PushSubscriptionIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    if not push_enabled():
        raise HTTPException(status_code=503, detail="Notificações push não estão disponíveis.")
    existing = (
        await db.execute(
            select(DbPushSubscription).where(DbPushSubscription.endpoint == body.endpoint)
        )
    ).scalar_one_or_none()
    if existing:
        existing.user_id = user.id
        existing.p256dh = body.keys.p256dh
        existing.auth = body.keys.auth
    else:
        db.add(
            DbPushSubscription(
                user_id=user.id,
                endpoint=body.endpoint,
                p256dh=body.keys.p256dh,
                auth=body.keys.auth,
            )
        )


@router.post("/unsubscribe", status_code=204)
async def unsubscribe(
    body: PushUnsubscribeIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    await db.execute(
        delete(DbPushSubscription).where(
            DbPushSubscription.endpoint == body.endpoint,
            DbPushSubscription.user_id == user.id,
        )
    )
