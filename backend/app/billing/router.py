"""Estado do billing para o frontend (paywall + banner de trial).

Só o /status por agora — checkout, portal e webhook do Stripe entram na fatia
seguinte. Usa get_current_user (não require_access) para NUNCA devolver 402:
o frontend precisa de ler este estado justamente para mostrar o paywall."""

from datetime import datetime
from typing import Literal

import stripe
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.billing.service import (
    apply_webhook_event,
    billing_enabled,
    create_checkout_session,
    create_portal_session,
    has_access,
    verify_webhook,
)
from app.config import settings
from app.database import get_db
from app.exceptions import ValidationError

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


class BillingStatus(BaseModel):
    access: bool
    status: str  # none|trialing|active|past_due|canceled
    comped: bool
    trialEndsAt: datetime | None = None
    currentPeriodEnd: datetime | None = None
    billingEnabled: bool


@router.get("/status", response_model=BillingStatus)
async def status(user: User = Depends(get_current_user)) -> BillingStatus:
    return BillingStatus(
        access=has_access(user),
        status=user.subscription_status,
        comped=user.comped,
        trialEndsAt=user.trial_ends_at,
        currentPeriodEnd=user.current_period_end,
        billingEnabled=billing_enabled(),
    )


class CheckoutRequest(BaseModel):
    plan: Literal["monthly", "annual"]


class UrlOut(BaseModel):
    url: str


@router.post("/checkout", response_model=UrlOut)
async def checkout(body: CheckoutRequest, user: User = Depends(get_current_user)) -> UrlOut:
    if not billing_enabled():
        raise ValidationError("Os pagamentos ainda não estão ativos.")
    url = await create_checkout_session(
        user,
        body.plan,
        success_url=f"{settings.APP_URL}/app?sub=ok",
        cancel_url=f"{settings.APP_URL}/app?sub=cancel",
    )
    return UrlOut(url=url)


@router.post("/portal", response_model=UrlOut)
async def portal(user: User = Depends(get_current_user)) -> UrlOut:
    if not user.stripe_customer_id:
        raise ValidationError("Ainda não tens uma subscrição para gerir.")
    url = await create_portal_session(user, return_url=f"{settings.APP_URL}/app")
    return UrlOut(url=url)


@router.post("/webhook")
async def webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Endpoint do Stripe (sem auth — validado por assinatura)."""
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    try:
        event = verify_webhook(payload, signature)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise ValidationError("Assinatura do webhook inválida.")
    await apply_webhook_event(db, event)
    return {"received": True}
