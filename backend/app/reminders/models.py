"""Lembretes push por utilizador. Uma linha por (user, kind). Cascade com o user."""

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models_base import Base


class DbReminder(Base):
    __tablename__ = "reminders"
    __table_args__ = (UniqueConstraint("user_id", "kind"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # water|weigh_in|breakfast|lunch|dinner
    hhmm: Mapped[str] = mapped_column(String(5), nullable=False)  # "08:30" hora local (Lisboa)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    # dia em que disparou pela última vez — evita reenviar no mesmo minuto/dia
    last_fired_on: Mapped[date | None] = mapped_column(Date, nullable=True)
