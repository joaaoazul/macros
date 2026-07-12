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
    severity: Mapped[str] = mapped_column(
        String(10), nullable=False, default="info", server_default="info", index=True
    )  # info | warning | critical
    detail: Mapped[str] = mapped_column(String(500), nullable=False, default="", server_default="")
    ip: Mapped[str] = mapped_column(String(64), nullable=False, default="", server_default="")
    user_agent: Mapped[str] = mapped_column(String(256), nullable=False, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


# Acções que são sempre sensíveis (disparam alerta mesmo com severidade info).
SENSITIVE_ACTIONS = {
    "admin_login",
    "admin_access",
    "admin_force_logout",
    "admin_disable_user",
    "admin_enable_user",
    "admin_reset_password",
    "admin_blocklist_add",
    "refresh_reuse_detected",
    "brute_force_detected",
}


async def write_audit_log(
    db: AsyncSession,
    action: str,
    user_id: int | None = None,
    detail: str = "",
    ip: str = "",
    severity: str = "info",
    user_agent: str = "",
) -> None:
    """Persiste um evento de auditoria, emite-o ao feed admin e dispara alerta se relevante."""
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            severity=severity,
            detail=detail[:500],
            ip=ip[:64],
            user_agent=user_agent[:256],
        )
    )
    logger.info(
        "audit action=%s severity=%s user_id=%s ip=%s %s", action, severity, user_id, ip, detail
    )

    event = {
        "action": action,
        "severity": severity,
        "user_id": user_id,
        "ip": ip,
        "detail": detail[:500],
    }
    # Broadcast ao feed admin (import tardio evita ciclos).
    try:
        from app.admin.feed import admin_feed

        await admin_feed.broadcast(event)
    except Exception:  # o feed nunca pode partir a gravação
        pass

    # Alerta externo (ntfy) para severidade elevada ou acções sensíveis.
    if severity in ("warning", "critical") or action in SENSITIVE_ACTIONS:
        try:
            from app.admin.alerts import send_alert

            await send_alert(
                title=f"[{severity.upper()}] {action}",
                body=(detail or action) + (f" · IP {ip}" if ip else ""),
                priority="high" if severity == "critical" else "default",
                tags="rotating_light" if severity == "critical" else "warning",
            )
        except Exception:
            pass
