"""Social domain logic: plan adherence, streaks, friendships, feed evaluation."""

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.models import DbDiaryEntry, DbExercise, DbProfile, DbWater
from app.social.models import FeedEvent, Friendship, LeaderboardRank

logger = logging.getLogger(__name__)

_LISBON = ZoneInfo("Europe/Lisbon")

# Um dia conta como "no plano" se |net kcal − meta| ≤ 10% da meta
PLAN_TOLERANCE = 0.10
STREAK_MILESTONES = (3, 7, 14, 30)
_STREAK_SCAN_CAP = 60  # dias


def lisbon_today() -> date:
    """Data atual em Lisboa — usar SEMPRE isto, nunca date.today() (container é UTC)."""
    return datetime.now(_LISBON).date()


def week_window(today: date) -> tuple[date, date]:
    """Semana ISO (segunda a domingo) que contém `today`."""
    monday = today - timedelta(days=today.isoweekday() - 1)
    return monday, monday + timedelta(days=6)


def iso_week_key(today: date) -> str:
    year, week, _ = today.isocalendar()
    return f"{year}-W{week:02d}"


@dataclass
class DayStats:
    on_plan: bool
    bonus: int


async def compute_plan_days(
    db: AsyncSession, user_ids: list[int], start: date, end: date
) -> dict[int, dict[date, DayStats]]:
    """Adesão ao plano por utilizador/dia na janela [start, end].

    3 queries agregadas + fold em Python contra profiles.targets.
    """
    if not user_ids:
        return {}

    targets_rows = await db.execute(
        select(DbProfile.user_id, DbProfile.targets).where(DbProfile.user_id.in_(user_ids))
    )
    targets = {uid: t for uid, t in targets_rows.all()}

    kcal_rows = await db.execute(
        select(DbDiaryEntry.user_id, DbDiaryEntry.date, func.sum(DbDiaryEntry.kcal))
        .where(
            DbDiaryEntry.user_id.in_(user_ids),
            DbDiaryEntry.date >= start,
            DbDiaryEntry.date <= end,
        )
        .group_by(DbDiaryEntry.user_id, DbDiaryEntry.date)
    )
    consumed: dict[tuple[int, date], float] = {(u, d): k for u, d, k in kcal_rows.all()}

    exercise_rows = await db.execute(
        select(DbExercise.user_id, DbExercise.date, func.sum(DbExercise.kcal))
        .where(
            DbExercise.user_id.in_(user_ids),
            DbExercise.date >= start,
            DbExercise.date <= end,
        )
        .group_by(DbExercise.user_id, DbExercise.date)
    )
    burned: dict[tuple[int, date], float] = {(u, d): k for u, d, k in exercise_rows.all()}

    water_rows = await db.execute(
        select(DbWater.user_id, DbWater.date, DbWater.ml).where(
            DbWater.user_id.in_(user_ids), DbWater.date >= start, DbWater.date <= end
        )
    )
    water: dict[tuple[int, date], int] = {(u, d): ml for u, d, ml in water_rows.all()}

    result: dict[int, dict[date, DayStats]] = {uid: {} for uid in user_ids}
    for (uid, day), kcal in consumed.items():
        t = targets.get(uid)
        if not t or not t.get("kcal"):
            continue
        net = kcal - burned.get((uid, day), 0.0)
        on_plan = abs(net - t["kcal"]) <= PLAN_TOLERANCE * t["kcal"]
        bonus = 0
        if water.get((uid, day), 0) >= t.get("waterMl", 0) > 0:
            bonus += 1
        if (uid, day) in burned:
            bonus += 1
        result[uid][day] = DayStats(on_plan=on_plan, bonus=bonus)
    return result


async def streak_ending_at(db: AsyncSession, user_id: int, day: date) -> int:
    """Dias consecutivos 'no plano' a terminar em `day` (scan limitado a 60 dias)."""
    start = day - timedelta(days=_STREAK_SCAN_CAP)
    stats = (await compute_plan_days(db, [user_id], start, day)).get(user_id, {})
    streak = 0
    cursor = day
    while stats.get(cursor) and stats[cursor].on_plan:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


async def derived_stats(db: AsyncSession, user_id: int) -> dict:
    """Stats públicas derivadas — nunca expõe valores nutricionais em bruto."""
    today = lisbon_today()
    stats = (await compute_plan_days(db, [user_id], today - timedelta(days=6), today)).get(user_id, {})
    days_on_plan_7d = sum(1 for s in stats.values() if s.on_plan)
    streak = await streak_ending_at(db, user_id, today)
    if streak == 0:
        # streak "viva": se hoje ainda não fechou, conta a terminar ontem
        streak = await streak_ending_at(db, user_id, today - timedelta(days=1))
    return {"streak": streak, "daysOnPlan7d": days_on_plan_7d}


# --- amizades ---


def _pair_filter(a: int, b: int):
    return or_(
        (Friendship.requester_id == a) & (Friendship.addressee_id == b),
        (Friendship.requester_id == b) & (Friendship.addressee_id == a),
    )


async def get_friendship(db: AsyncSession, a: int, b: int) -> Friendship | None:
    result = await db.execute(select(Friendship).where(_pair_filter(a, b)))
    return result.scalar_one_or_none()


async def are_friends(db: AsyncSession, a: int, b: int) -> bool:
    f = await get_friendship(db, a, b)
    return f is not None and f.status == "accepted"


async def friend_ids(db: AsyncSession, user_id: int) -> list[int]:
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
        )
    )
    return [
        f.addressee_id if f.requester_id == user_id else f.requester_id
        for f in result.scalars()
    ]


# --- feed ---


async def _upsert_event(
    db: AsyncSession, user_id: int, kind: str, ref_date: date, payload: dict | None = None
) -> None:
    """Insert idempotente (unique user/kind/ref_date), dialect-aware p/ Postgres e SQLite."""
    dialect = db.get_bind().dialect.name
    values = {"user_id": user_id, "kind": kind, "ref_date": ref_date, "payload": payload or {}}
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        stmt = pg_insert(FeedEvent).values(**values).on_conflict_do_nothing()
    else:
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        stmt = sqlite_insert(FeedEvent).values(**values).on_conflict_do_nothing()
    await db.execute(stmt)


async def emit_friend_joined(db: AsyncSession, a: int, b: int, day: date) -> None:
    await _upsert_event(db, a, "friend_joined", day, {"friendId": b})
    await _upsert_event(db, b, "friend_joined", day, {"friendId": a})


async def evaluate_day_events(db: AsyncSession, user_id: int, day: date) -> None:
    """Avalia conquistas do dia após uma escrita. NUNCA pode partir a gravação do diário."""
    try:
        today = lisbon_today()
        if day > today:
            return

        stats = (await compute_plan_days(db, [user_id], day, day)).get(user_id, {})
        day_stats = stats.get(day)

        if day_stats and day_stats.on_plan:
            await _upsert_event(db, user_id, "day_on_plan", day)
            streak = await streak_ending_at(db, user_id, day)
            if streak in STREAK_MILESTONES:
                await _upsert_event(db, user_id, "streak", day, {"days": streak})
        else:
            # edição tirou o dia do plano — remover eventos que deixaram de ser verdade
            await db.execute(
                delete(FeedEvent).where(
                    FeedEvent.user_id == user_id,
                    FeedEvent.ref_date == day,
                    FeedEvent.kind.in_(["day_on_plan", "streak"]),
                )
            )

        await _maybe_rank_up(db, user_id, today)
    except Exception:
        logger.exception("evaluate_day_events falhou (user=%s day=%s)", user_id, day)


async def compute_leaderboard(db: AsyncSession, user_id: int, today: date | None = None) -> list[dict]:
    """Classificação da semana atual entre o utilizador e os amigos."""
    from app.auth.models import User

    today = today or lisbon_today()
    start, end = week_window(today)
    ids = [user_id, *await friend_ids(db, user_id)]
    plan = await compute_plan_days(db, ids, start, min(end, today))

    users_result = await db.execute(select(User).where(User.id.in_(ids)))
    users = {u.id: u for u in users_result.scalars()}

    rows = []
    for uid in ids:
        days = plan.get(uid, {})
        rows.append(
            {
                "userId": uid,
                "username": users[uid].username or "?",
                "avatar": users[uid].avatar,
                "daysOnPlan": sum(1 for s in days.values() if s.on_plan),
                "bonus": sum(s.bonus for s in days.values()),
                "isMe": uid == user_id,
            }
        )
    rows.sort(key=lambda r: (-r["daysOnPlan"], -r["bonus"], r["username"]))
    for i, row in enumerate(rows):
        row["rank"] = i + 1
    return rows


async def _maybe_rank_up(db: AsyncSession, user_id: int, today: date) -> None:
    """Compara o rank atual com o último visto; emite rank_up se melhorou na mesma semana."""
    rows = await compute_leaderboard(db, user_id, today)
    if len(rows) < 2:
        return
    my_rank = next(r["rank"] for r in rows if r["isMe"])
    week = iso_week_key(today)

    existing = (
        await db.execute(select(LeaderboardRank).where(LeaderboardRank.user_id == user_id))
    ).scalar_one_or_none()
    if existing is None:
        db.add(LeaderboardRank(user_id=user_id, iso_week=week, rank=my_rank))
        return
    improved = existing.iso_week == week and my_rank < existing.rank
    existing.iso_week = week
    existing.rank = my_rank
    if improved:
        await _upsert_event(db, user_id, "rank_up", today, {"rank": my_rank})
