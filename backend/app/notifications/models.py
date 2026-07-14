"""In-app notifications (inbox) + per-category push preferences."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models_base import Base


class DbNotification(Base):
    """One inbox entry. Drives the bell badge; also mirrored to a web push."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(24), nullable=False)  # friend_request|friend_accepted|reaction|nudge|badge|message_reaction
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(String(300), nullable=False, default="", server_default="")
    url: Mapped[str] = mapped_column(String(120), nullable=False, default="/app", server_default="/app")
    actor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class DbNotificationPref(Base):
    """Per-user push category switches. One row per user (get-or-create)."""

    __tablename__ = "notification_prefs"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    messages: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    friends: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    social: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
