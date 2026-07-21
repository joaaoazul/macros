"""Dependência FastAPI que tranca as rotas de dados atrás do entitlement."""

from fastapi import Depends

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.billing.service import has_access
from app.exceptions import PaymentRequiredError


async def require_access(user: User = Depends(get_current_user)) -> User:
    """Deixa passar quem tem acesso; 402 caso contrário (paywall no frontend)."""
    if not has_access(user):
        raise PaymentRequiredError()
    return user
