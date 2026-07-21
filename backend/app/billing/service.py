"""Regra de acesso (entitlement) — a ÚNICA fonte de verdade sobre quem pode usar a app.

Falha aberto de propósito: se o Stripe não estiver configurado (self-host, dev, ou
uma má configuração em produção) `billing_enabled()` é False e toda a gente tem
acesso. Assim uma falha de billing nunca tranca um utilizador pagante à porta.
"""

from datetime import datetime, timezone

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
