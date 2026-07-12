"""Testes de Web Push com pywebpush mockado — subscribe/unsubscribe, envio, limpeza."""

from unittest.mock import MagicMock, patch

import pytest

from app.config import settings
from app.push.models import DbPushSubscription
from app.push.service import send_push
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio

SUB = {
    "endpoint": "https://push.example.com/abc",
    "keys": {"p256dh": "BPk_p256dh_key", "auth": "auth_secret"},
}


@pytest.fixture(autouse=True)
def _allow_endpoints(monkeypatch):
    # A validação anti-SSRF faz DNS real; nos testes unitários assumimos endpoint ok.
    monkeypatch.setattr("app.push.router.safe_push_endpoint", lambda _e: True)
    monkeypatch.setattr("app.push.service.safe_push_endpoint", lambda _e: True)


@pytest.fixture()
def _vapid(monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "pub-key")
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "priv-key")


async def test_vapid_key_requires_config(client):
    await register_user(client)
    resp = await client.get("/api/v1/push/vapid-public-key")
    assert resp.status_code == 503  # sem VAPID configurado


async def test_vapid_key_when_enabled(client, _vapid):
    await register_user(client)
    resp = await client.get("/api/v1/push/vapid-public-key")
    assert resp.status_code == 200
    assert resp.json() == {"key": "pub-key"}


async def test_subscribe_and_unsubscribe(client, _vapid):
    await register_user(client)
    resp = await client.post("/api/v1/push/subscribe", json=SUB)
    assert resp.status_code == 204

    # re-subscrever com o mesmo endpoint é idempotente (upsert)
    resp = await client.post("/api/v1/push/subscribe", json=SUB)
    assert resp.status_code == 204

    resp = await client.post("/api/v1/push/unsubscribe", json={"endpoint": SUB["endpoint"]})
    assert resp.status_code == 204


async def test_subscribe_requires_config(client):
    await register_user(client)
    resp = await client.post("/api/v1/push/subscribe", json=SUB)
    assert resp.status_code == 503


async def test_send_push_noop_without_vapid(client):
    # sem VAPID, send_push não deve chamar webpush nem falhar
    with patch("pywebpush.webpush") as webpush:
        # precisa de uma sessão; reutilizamos via um user simples
        from app.database import get_db
        from app.main import app

        gen = app.dependency_overrides[get_db]()
        db = await gen.__anext__()
        await send_push(db, user_id=1, title="t", body="b")
        webpush.assert_not_called()
        await gen.aclose()


async def test_send_push_removes_stale_subscription(client, _vapid, db_engine):
    from pywebpush import WebPushException
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker

    await register_user(client)
    await client.post("/api/v1/push/subscribe", json=SUB)

    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    resp410 = MagicMock(status_code=410)
    with patch("pywebpush.webpush", side_effect=WebPushException("gone", response=resp410)):
        async with factory() as db:
            await send_push(db, user_id=1, title="Ana", body="olá")
            await db.commit()
        async with factory() as db:
            remaining = (await db.execute(select(DbPushSubscription))).scalars().all()
            assert remaining == []  # subscrição obsoleta removida
