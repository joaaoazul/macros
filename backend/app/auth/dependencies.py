"""Auth FastAPI dependencies: current user extraction from cookie (or Bearer for tests)."""

from datetime import datetime, timezone

import jwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.cookies import ACCESS_COOKIE
from app.auth.models import User
from app.auth.security import decode_token
from app.auth.token_blocklist import is_token_revoked
from app.database import get_db
from app.exceptions import UnauthorizedError


def _extract_token(request: Request) -> str | None:
    token = request.cookies.get(ACCESS_COOKIE)
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


async def resolve_user_from_token(token: str, db: AsyncSession) -> User:
    """Valida um access token e devolve o utilizador. Partilhado por HTTP e WebSocket."""
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise UnauthorizedError("Invalid token type")
        user_id = int(str(payload["sub"]))
        jti: str = payload["jti"]
        iat: int = payload["iat"]
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise UnauthorizedError("Invalid or expired token")

    if await is_token_revoked(jti, db):
        raise UnauthorizedError("Token has been revoked")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedError("User not found or deactivated")

    token_iat = datetime.fromtimestamp(iat, tz=timezone.utc)
    invalidated_at = (
        user.sessions_invalidated_at
        if user.sessions_invalidated_at.tzinfo is not None
        else user.sessions_invalidated_at.replace(tzinfo=timezone.utc)
    )
    if token_iat < invalidated_at:
        raise UnauthorizedError("Session has been invalidated. Please log in again.")

    return user


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _extract_token(request)
    if not token:
        raise UnauthorizedError("Not authenticated")
    return await resolve_user_from_token(token, db)


async def require_admin(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Exige um utilizador com is_admin; audita cada acesso admin."""
    from app.audit import write_audit_log
    from app.exceptions import ForbiddenError
    from app.net import client_ip

    if not user.is_admin:
        await write_audit_log(
            db,
            "admin_access_denied",
            user_id=user.id,
            detail=f"{request.method} {request.url.path}",
            ip=client_ip(request),
            severity="warning",
            user_agent=request.headers.get("User-Agent", ""),
        )
        raise ForbiddenError("Acesso restrito a administradores.")
    return user
