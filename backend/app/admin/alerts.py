"""Alertas externos via ntfy. No-op se ALERT_NTFY_URL não estiver configurado."""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def alerts_enabled() -> bool:
    return bool(settings.ALERT_NTFY_URL)


async def send_alert(title: str, body: str, priority: str = "default", tags: str = "warning") -> None:
    """Envia um alerta ao tópico ntfy (POST). Silencioso se desativado ou em falha."""
    if not alerts_enabled():
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                settings.ALERT_NTFY_URL,
                content=body.encode("utf-8"),
                headers={
                    "Title": title.encode("ascii", "ignore").decode() or "Macros SOC",
                    "Priority": priority,
                    "Tags": tags,
                },
            )
    except Exception:
        logger.warning("falha a enviar alerta ntfy", exc_info=True)
