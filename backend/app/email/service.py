"""Email delivery via Resend REST API. No-op (with warning) when RESEND_API_KEY is empty."""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_RESEND_URL = "https://api.resend.com/emails"


def email_enabled() -> bool:
    return bool(settings.RESEND_API_KEY)


async def _send(to: str, subject: str, html: str) -> bool:
    if not email_enabled():
        logger.warning("Email disabled (RESEND_API_KEY empty) — would send %r to %s", subject, to)
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _RESEND_URL,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={"from": settings.EMAIL_FROM, "to": [to], "subject": subject, "html": html},
            )
        if resp.status_code >= 400:
            logger.error("Resend error %s: %s", resp.status_code, resp.text)
            return False
        return True
    except httpx.HTTPError:
        logger.exception("Failed to send email to %s", to)
        return False


def _layout(body: str) -> str:
    return (
        '<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;'
        'margin:0 auto;padding:24px">'
        '<h2 style="margin:0 0 16px">🥗 Macros</h2>'
        f"{body}"
        '<p style="color:#888;font-size:12px;margin-top:32px">Se não fizeste este pedido, '
        "podes ignorar este email.</p></div>"
    )


async def send_verification_email(to: str, token: str) -> bool:
    url = f"{settings.APP_URL}/verificar-email?token={token}"
    return await _send(
        to,
        "Confirma o teu email — Macros",
        _layout(
            "<p>Bem-vindo ao Macros! Confirma o teu email para concluir o registo:</p>"
            f'<p><a href="{url}" style="display:inline-block;background:#0a84ff;color:#fff;'
            'padding:12px 20px;border-radius:12px;text-decoration:none">Confirmar email</a></p>'
            f'<p style="font-size:13px;color:#666">Ou abre este link: {url}</p>'
        ),
    )


async def send_reset_email(to: str, token: str) -> bool:
    url = f"{settings.APP_URL}/repor-password?token={token}"
    return await _send(
        to,
        "Repor a tua password — Macros",
        _layout(
            "<p>Recebemos um pedido para repor a tua password:</p>"
            f'<p><a href="{url}" style="display:inline-block;background:#0a84ff;color:#fff;'
            'padding:12px 20px;border-radius:12px;text-decoration:none">Repor password</a></p>'
            f'<p style="font-size:13px;color:#666">O link expira em '
            f"{settings.EMAIL_TOKEN_EXPIRE_HOURS} horas. Ou abre: {url}</p>"
        ),
    )
