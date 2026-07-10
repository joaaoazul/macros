"""Token revocation store backed by the database."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import RevokedToken


async def is_token_revoked(jti: str, db: AsyncSession) -> bool:
    result = await db.execute(select(RevokedToken).where(RevokedToken.jti == jti))
    return result.scalar_one_or_none() is not None


async def revoke_token(jti: str, user_id: int, expires_at: datetime, db: AsyncSession) -> None:
    """Add a token to the blocklist. Caller is responsible for committing."""
    db.add(RevokedToken(jti=jti, user_id=user_id, expires_at=expires_at))
