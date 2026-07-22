"""Lógica dos lembretes: defaults, leitura e o agendador que envia os push devidos."""

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.reminders.models import DbReminder

logger = logging.getLogger(__name__)

_LISBON = ZoneInfo("Europe/Lisbon")

# ordem = ordem de apresentação; hora/estado default de cada lembrete
DEFAULTS: list[tuple[str, str, bool]] = [
    ("water", "11:00", False),
    ("breakfast", "09:00", False),
    ("lunch", "13:00", False),
    ("dinner", "20:00", False),
    ("weigh_in", "08:00", False),
    ("expiry", "09:00", False),
]

# Itens de stock a ≤ estes dias da validade entram no aviso diário (igual ao frontend).
EXPIRY_SOON_DAYS = 3
_DEFAULT_ORDER = {kind: i for i, (kind, _, _) in enumerate(DEFAULTS)}

# conteúdo do push por tipo de lembrete
MESSAGES: dict[str, tuple[str, str, str]] = {
    "water": ("💧 Hora de beber água", "Não te esqueças de te hidratar.", "/app"),
    "breakfast": ("🌅 Pequeno-almoço", "Regista o teu pequeno-almoço.", "/app"),
    "lunch": ("🍽️ Almoço", "Já registaste o almoço?", "/app"),
    "dinner": ("🌙 Jantar", "Regista o teu jantar.", "/app"),
    "weigh_in": ("⚖️ Pesagem", "Regista o teu peso de hoje.", "/app"),
}


async def _expiring_names(db: AsyncSession, user_id: int, today) -> list[str]:
    """Nomes dos itens de stock do user que expiram em ≤ EXPIRY_SOON_DAYS (ou já expiraram)."""
    from datetime import timedelta

    from app.data.models import DbPantryItem

    cutoff = (today + timedelta(days=EXPIRY_SOON_DAYS)).isoformat()
    rows = list(
        (
            await db.execute(
                select(DbPantryItem).where(
                    DbPantryItem.user_id == user_id,
                    DbPantryItem.kind == "stock",
                    DbPantryItem.expires_on.is_not(None),
                    DbPantryItem.expires_on <= cutoff,
                )
            )
        ).scalars()
    )
    rows.sort(key=lambda p: p.expires_on or "")
    return [p.name for p in rows]


async def get_or_create(db: AsyncSession, user_id: int) -> list[DbReminder]:
    """Garante que existe uma linha por tipo default e devolve-as ordenadas."""
    rows = list(
        (await db.execute(select(DbReminder).where(DbReminder.user_id == user_id))).scalars()
    )
    have = {r.kind for r in rows}
    for kind, hhmm, enabled in DEFAULTS:
        if kind not in have:
            row = DbReminder(user_id=user_id, kind=kind, hhmm=hhmm, enabled=enabled)
            db.add(row)
            rows.append(row)
    rows.sort(key=lambda r: _DEFAULT_ORDER.get(r.kind, 99))
    return rows


async def _tick(db: AsyncSession) -> int:
    """Envia os lembretes cujo horário == agora (Lisboa) e ainda não dispararam hoje.

    Devolve o nº de lembretes enviados (usado nos testes).
    """
    from app.push.service import push_enabled, send_push

    if not push_enabled():
        return 0

    now = datetime.now(_LISBON)
    hhmm = now.strftime("%H:%M")
    today = now.date()

    due = list(
        (
            await db.execute(
                select(DbReminder).where(
                    DbReminder.enabled.is_(True),
                    DbReminder.hhmm == hhmm,
                )
            )
        ).scalars()
    )
    sent = 0
    for r in due:
        if r.last_fired_on == today:
            continue  # já enviado neste dia
        if r.kind == "expiry":
            # Push agregado com o que está a expirar; sem nada devido, não carimba
            # last_fired_on — volta a avaliar amanhã à mesma hora.
            names = await _expiring_names(db, r.user_id, today)
            if not names:
                continue
            shown = ", ".join(names[:4]) + ("…" if len(names) > 4 else "")
            title = f"🕓 {len(names)} alimento{'s' if len(names) != 1 else ''} a expirar"
            await send_push(db, r.user_id, title, f"Usa antes que estrague: {shown}", "/app")
            r.last_fired_on = today
            sent += 1
            continue
        title, body, url = MESSAGES.get(r.kind, ("Macros", "Lembrete", "/app"))
        await send_push(db, r.user_id, title, body, url)
        r.last_fired_on = today
        sent += 1
    return sent


async def run_scheduler(session_factory, interval_seconds: int = 60) -> None:
    """Loop de fundo: a cada minuto verifica e envia os lembretes devidos.

    Requer single-worker (tal como o ConnectionManager). Nunca deixa uma
    exceção parar o loop.
    """
    logger.info("agendador de lembretes iniciado (intervalo=%ss)", interval_seconds)
    while True:
        try:
            async with session_factory() as db:
                sent = await _tick(db)
                if sent:
                    await db.commit()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.warning("tick do agendador de lembretes falhou", exc_info=True)
        await asyncio.sleep(interval_seconds)
