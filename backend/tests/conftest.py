"""Test fixtures: in-memory SQLite + httpx async client with cookie support."""

import os

# Ambiente de teste ANTES de instanciar Settings: cookies não-secure (dev/test) e
# JWT_SECRET próprio, para não disparar o guard de produção em app.main.
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.main import app
from app.models_base import Base

# Register all models with Base.metadata
from app.audit import AuditLog  # noqa: F401
from app.auth.models import EmailToken, RevokedToken, User  # noqa: F401
from app.data.models import (  # noqa: F401
    DbCustomFood,
    DbDiaryEntry,
    DbExercise,
    DbProfile,
    DbRecipe,
    DbWater,
    DbWeight,
)
from app.admin.models import IpBlocklist  # noqa: F401
from app.messages.models import Message  # noqa: F401
from app.push.models import DbPushSubscription  # noqa: F401
from app.social.models import FeedEvent, Friendship, LeaderboardRank  # noqa: F401


@pytest_asyncio.fixture()
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture()
async def client(db_engine):
    factory = async_sessionmaker(db_engine, expire_on_commit=False)

    async def override_get_db():
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={"X-Requested-With": "fetch"},
    ) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _fast_and_isolated(monkeypatch):
    """Insecure cookies over test http; reset in-memory rate limiter buckets."""
    from app.auth.rate_limit import _RateLimiter
    from app.config import settings

    monkeypatch.setattr(settings, "COOKIE_SECURE", False)
    _RateLimiter._buckets.clear()


async def register_user(client, email="ana@example.com", password="password-forte-123", name="Ana"):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": name},
    )
    assert resp.status_code == 201, resp.text
    return resp
