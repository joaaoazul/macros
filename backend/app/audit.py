"""Minimal audit log for security-relevant events."""

import logging
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.models_base import Base

logger = logging.getLogger("audit")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    detail: Mapped[str] = mapped_column(String(500), nullable=False, default="", server_default="")
    ip: Mapped[str] = mapped_column(String(64), nullable=False, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


async def write_audit_log(
    db: AsyncSession,
    action: str,
    user_id: int | None = None,
    detail: str = "",
    ip: str = "",
) -> None:
    """Persist an audit event. Caller commits (or relies on get_db commit)."""
    db.add(AuditLog(user_id=user_id, action=action, detail=detail[:500], ip=ip[:64]))
    logger.info("audit action=%s user_id=%s ip=%s %s", action, user_id, ip, detail)
