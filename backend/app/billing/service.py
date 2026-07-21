"""Regra de acesso (entitlement) — a ÚNICA fonte de verdade sobre quem pode usar a app.

Falha aberto de propósito: se o Stripe não estiver configurado (self-host, dev, ou
uma má configuração em produção) `billing_enabled()` é False e toda a gente tem
acesso. Assim uma falha de billing nunca tranca um utilizador pagante à porta.
"""

from datetime import datetime, timezone

import stripe
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.config import settings

ACTIVE_STATUSES = frozenset({"active", "trialing"})


def billing_enabled() -> bool:
    """Billing só está ligado quando há uma chave secreta do Stripe."""
    return bool(settings.STRIPE_SECRET_KEY)


def has_access(user: User, now: datetime | None = None) -> bool:
    """True se o utilizador pode usar a app: billing desligado, convidado (comped),
    trial a decorrer, ou subscrição ativa."""
    if not billing_enabled():
        return True
    if user.comped:
        return True
    moment = now or datetime.now(timezone.utc)
    if user.trial_ends_at is not None and user.trial_ends_at > moment:
        return True
    return user.subscription_status in ACTIVE_STATUSES


# ── Stripe ──────────────────────────────────────────────────────────────────
# O SDK do Stripe é síncrono; corremos as chamadas num threadpool para não
# bloquear o event loop.


def _price_id(plan: str) -> str:
    return settings.STRIPE_PRICE_ANNUAL if plan == "annual" else settings.STRIPE_PRICE_MONTHLY


async def create_checkout_session(user: User, plan: str, success_url: str, cancel_url: str) -> str:
    """Cria uma sessão de Checkout (mode=subscription) e devolve o URL alojado."""
    stripe.api_key = settings.STRIPE_SECRET_KEY
    params: dict = {
        "mode": "subscription",
        "line_items": [{"price": _price_id(plan), "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": str(user.id),
        "metadata": {"user_id": str(user.id)},
        "allow_promotion_codes": True,
    }
    # reaproveita o cliente Stripe se já existir; senão pré-preenche o email
    if user.stripe_customer_id:
        params["customer"] = user.stripe_customer_id
    else:
        params["customer_email"] = user.email
    session = await run_in_threadpool(lambda: stripe.checkout.Session.create(**params))
    return session.url


async def create_portal_session(user: User, return_url: str) -> str:
    """URL do Customer Portal (gerir/cancelar). Requer cliente Stripe já criado."""
    stripe.api_key = settings.STRIPE_SECRET_KEY
    session = await run_in_threadpool(
        lambda: stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id, return_url=return_url
        )
    )
    return session.url


def verify_webhook(payload: bytes, signature: str) -> dict:
    """Valida a assinatura do webhook; lança se for inválida."""
    return stripe.Webhook.construct_event(payload, signature, settings.STRIPE_WEBHOOK_SECRET)


async def apply_webhook_event(db: AsyncSession, event: dict) -> None:
    """Aplica um evento do Stripe ao utilizador. Idempotente — reprocessar o
    mesmo evento deixa o mesmo estado. Eventos sem utilizador conhecido são
    ignorados em silêncio (podem chegar fora de ordem)."""
    kind = event.get("type", "")
    obj = event.get("data", {}).get("object", {})

    if kind == "checkout.session.completed":
        user_id = obj.get("client_reference_id")
        customer = obj.get("customer")
        if user_id and customer:
            user = await db.get(User, int(user_id))
            if user is not None:
                user.stripe_customer_id = customer
                user.subscription_status = "active"
        return

    if kind in ("customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"):
        customer = obj.get("customer")
        if not customer:
            return
        user = (
            await db.execute(select(User).where(User.stripe_customer_id == customer))
        ).scalar_one_or_none()
        if user is None:
            return
        user.subscription_status = "canceled" if kind.endswith("deleted") else obj.get("status", "canceled")
        period_end = obj.get("current_period_end")
        if period_end:
            user.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
