"""Estado do billing para o frontend (paywall + banner de trial).

Só o /status por agora — checkout, portal e webhook do Stripe entram na fatia
seguinte. Usa get_current_user (não require_access) para NUNCA devolver 402:
o frontend precisa de ler este estado justamente para mostrar o paywall."""

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.billing.service import billing_enabled, has_access

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
