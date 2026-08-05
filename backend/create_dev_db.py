"""Cria as tabelas da BD de desenvolvimento (SQLite) a partir dos modelos.

Uso local/dev apenas — em produção usa-se Postgres + Alembic (ver alembic/).
"""
import asyncio

from sqlalchemy.ext.asyncio import create_async_engine

from app.models_base import Base

# Regista todos os modelos em Base.metadata (mesmo import que tests/conftest.py)
from app.audit import AuditLog  # noqa: F401
from app.auth.models import EmailToken, InviteCode, RevokedToken, User  # noqa: F401
from app.data.models import (  # noqa: F401
    DbCustomFood,
    DbDiaryEntry,
    DbExercise,
    DbMealPlanEntry,
    DbPantryItem,
    DbProfile,
    DbRecipe,
    DbWater,
    DbWeight,
)
from app.admin.models import IpBlocklist  # noqa: F401
from app.messages.models import Message, MessageReaction  # noqa: F401
from app.notifications.models import DbNotification, DbNotificationPref  # noqa: F401
from app.push.models import DbPushSubscription  # noqa: F401
from app.reminders.models import DbReminder  # noqa: F401
from app.social.models import (  # noqa: F401
    Badge,
    FeedEvent,
    FeedReaction,
    Friendship,
    LeaderboardRank,
    Nudge,
)


async def main() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///./dev.db")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("dev.db pronta.")


if __name__ == "__main__":
    asyncio.run(main())
