"""Despensa em stock: round-trip qty/expiresOn e push diário agregado de validades."""

from datetime import date, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

import app.reminders.service as service
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


def _stock(item_id: str, name: str, expires_on: str | None, qty: float = 1):
    return {"id": item_id, "kind": "stock", "name": name, "emoji": "🧺", "qty": qty, "expiresOn": expires_on}


async def test_pantry_stock_roundtrip(client):
    await register_user(client)
    items = [
        _stock("s1", "Frango", "2026-07-24", qty=2),
        _stock("s2", "Arroz", None),
        {"id": "h1", "kind": "have", "name": "Azeite", "emoji": "✅"},
    ]
    resp = await client.put("/api/v1/pantry", json=items)
    assert resp.status_code == 200, resp.text

    got = (await client.get("/api/v1/data/all")).json()["pantry"]
    frango = next(p for p in got if p["id"] == "s1")
    assert frango["qty"] == 2 and frango["expiresOn"] == "2026-07-24"
    arroz = next(p for p in got if p["id"] == "s2")
    assert arroz["expiresOn"] is None
    azeite = next(p for p in got if p["id"] == "h1")
    assert azeite["qty"] is None and azeite["expiresOn"] is None


async def test_pantry_rejects_bad_kind(client):
    await register_user(client)
    resp = await client.put(
        "/api/v1/pantry", json=[{"id": "x", "kind": "banana", "name": "?", "emoji": ""}]
    )
    assert resp.status_code == 422


def _freeze(monkeypatch, hhmm: str, day: tuple[int, int, int] = (2026, 7, 22)):
    h, m = (int(x) for x in hhmm.split(":"))
    y, mo, d = day

    class _Fixed(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(y, mo, d, h, m, tzinfo=tz)

    monkeypatch.setattr(service, "datetime", _Fixed)


async def _enable_expiry(client):
    await client.get("/api/v1/reminders")
    await client.put("/api/v1/reminders", json=[{"kind": "expiry", "hhmm": "09:00", "enabled": True}])


async def test_expiry_push_aggregates_due_stock(client, db_engine, monkeypatch):
    await register_user(client)
    today = date(2026, 7, 22)
    soon = (today + timedelta(days=2)).isoformat()
    far = (today + timedelta(days=30)).isoformat()
    await client.put(
        "/api/v1/pantry",
        json=[
            _stock("s1", "Frango", soon),
            _stock("s2", "Leite", (today - timedelta(days=1)).isoformat()),  # já expirado
            _stock("s3", "Arroz", far),  # fora da janela — não entra
        ],
    )
    await _enable_expiry(client)

    sent: list[tuple[str, str]] = []

    async def fake_send(db, user_id, title, body, url="/"):
        sent.append((title, body))

    monkeypatch.setattr("app.push.service.push_enabled", lambda: True)
    monkeypatch.setattr("app.push.service.send_push", fake_send)
    _freeze(monkeypatch, "09:00", (2026, 7, 22))

    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        assert await service._tick(db) == 1
        await db.commit()

    assert len(sent) == 1
    title, body = sent[0]
    assert "2" in title  # dois itens agregados num só push
    assert "Frango" in body and "Leite" in body and "Arroz" not in body

    # mesmo dia: não repete
    async with factory() as db:
        assert await service._tick(db) == 0
    assert len(sent) == 1


async def test_expiry_push_skips_without_stamp_when_nothing_due(client, db_engine, monkeypatch):
    await register_user(client)
    far = (date(2026, 7, 22) + timedelta(days=30)).isoformat()
    await client.put("/api/v1/pantry", json=[_stock("s1", "Arroz", far)])
    await _enable_expiry(client)

    sent: list[str] = []

    async def fake_send(db, user_id, title, body, url="/"):
        sent.append(title)

    monkeypatch.setattr("app.push.service.push_enabled", lambda: True)
    monkeypatch.setattr("app.push.service.send_push", fake_send)
    _freeze(monkeypatch, "09:00", (2026, 7, 22))

    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        assert await service._tick(db) == 0
        await db.commit()
    assert sent == []

    # sem carimbo: se amanhã já houver algo a expirar, dispara
    await client.put("/api/v1/pantry", json=[_stock("s1", "Arroz", "2026-07-23")])
    async with factory() as db:
        assert await service._tick(db) == 1
        await db.commit()
    assert len(sent) == 1
