"""Envio de Web Push via pywebpush. No-op se VAPID não estiver configurado."""

import json
import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.push.models import DbPushSubscription

logger = logging.getLogger(__name__)


def push_enabled() -> bool:
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


async def send_push(db: AsyncSession, user_id: int, title: str, body: str, url: str = "/") -> None:
    """Envia a notificação a todas as subscrições do utilizador; limpa as obsoletas (404/410)."""
    if not push_enabled():
        return

    from pywebpush import WebPushException, webpush

    subs = (
        await db.execute(select(DbPushSubscription).where(DbPushSubscription.user_id == user_id))
    ).scalars().all()
    if not subs:
        return

    data = json.dumps({"title": title, "body": body, "url": url})
    stale: list[str] = []
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=data,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
                timeout=10,
            )
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                stale.append(sub.endpoint)
            else:
                logger.warning("web push falhou (user=%s status=%s)", user_id, status)
        except Exception:
            logger.warning("web push erro inesperado (user=%s)", user_id, exc_info=True)

    if stale:
        await db.execute(
            delete(DbPushSubscription).where(DbPushSubscription.endpoint.in_(stale))
        )
