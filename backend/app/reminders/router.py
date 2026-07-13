"""Endpoints dos lembretes: listar (cria defaults) e atualizar em bloco."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database import get_db
from app.exceptions import ValidationError
from app.reminders.schemas import ReminderOut, ReminderUpdate
from app.reminders.service import get_or_create

router = APIRouter(prefix="/api/v1/reminders", tags=["reminders"])


@router.get("", response_model=list[ReminderOut])
async def list_reminders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ReminderOut]:
    rows = await get_or_create(db, user.id)
    return [ReminderOut(kind=r.kind, hhmm=r.hhmm, enabled=r.enabled) for r in rows]


@router.put("", response_model=list[ReminderOut])
async def update_reminders(
    body: list[ReminderUpdate],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ReminderOut]:
    if len(body) > 20:
        raise ValidationError("Demasiados lembretes.")
    rows = await get_or_create(db, user.id)
    by_kind = {r.kind: r for r in rows}
    for upd in body:
        row = by_kind.get(upd.kind)
        if row is None:
            continue  # tipo desconhecido — ignora silenciosamente
        if row.hhmm != upd.hhmm or row.enabled != upd.enabled:
            row.hhmm = upd.hhmm
            row.enabled = upd.enabled
            row.last_fired_on = None  # nova config → pode disparar hoje
    return [ReminderOut(kind=r.kind, hhmm=r.hhmm, enabled=r.enabled) for r in rows]
