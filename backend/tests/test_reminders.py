"""Lembretes: defaults, atualização e agendador (push mockado, sem envios reais)."""

from datetime import datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

import app.reminders.service as service
from app.reminders.models import DbReminder
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


async def test_reminders_requires_auth(client):
    resp = await client.get("/api/v1/reminders")
    assert resp.status_code == 401


async def test_get_creates_defaults_all_disabled(client):
    await register_user(client)
    rows = (await client.get("/api/v1/reminders")).json()
    kinds = {r["kind"] for r in rows}
    assert kinds == {
        "water", "breakfast", "lunch", "dinner", "weigh_in", "expiry", "plan_lunch", "plan_dinner",
    }
    assert all(r["enabled"] is False for r in rows)


async def test_update_persists(client):
    await register_user(client)
    await client.get("/api/v1/reminders")  # cria defaults
    resp = await client.put(
        "/api/v1/reminders",
        json=[{"kind": "water", "hhmm": "10:30", "enabled": True}],
    )
    assert resp.status_code == 200, resp.text
    water = next(r for r in resp.json() if r["kind"] == "water")
    assert water == {"kind": "water", "hhmm": "10:30", "enabled": True}

    # persistiu
    again = next(r for r in (await client.get("/api/v1/reminders")).json() if r["kind"] == "water")
    assert again["enabled"] is True and again["hhmm"] == "10:30"


async def test_update_rejects_bad_time(client):
    await register_user(client)
    resp = await client.put(
        "/api/v1/reminders", json=[{"kind": "water", "hhmm": "25:99", "enabled": True}]
    )
    assert resp.status_code == 422


def _freeze(monkeypatch, hhmm: str):
    """Congela datetime.now() do service numa hora local fixa (HH:MM)."""
    h, m = (int(x) for x in hhmm.split(":"))

    class _Fixed(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 7, 13, h, m, tzinfo=tz)

    monkeypatch.setattr(service, "datetime", _Fixed)


async def test_scheduler_fires_due_reminder_once_per_day(client, db_engine, monkeypatch):
    await register_user(client)
    await client.get("/api/v1/reminders")
    await client.put("/api/v1/reminders", json=[{"kind": "water", "hhmm": "11:00", "enabled": True}])

    sent: list[tuple[int, str]] = []

    async def fake_send(db, user_id, title, body, url="/"):
        sent.append((user_id, title))

    monkeypatch.setattr("app.push.service.push_enabled", lambda: True)
    monkeypatch.setattr("app.push.service.send_push", fake_send)
    _freeze(monkeypatch, "11:00")

    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        assert await service._tick(db) == 1
        await db.commit()
    assert len(sent) == 1

    # segundo tick no mesmo minuto/dia não reenvia (last_fired_on guarda o dia)
    async with factory() as db:
        assert await service._tick(db) == 0
    assert len(sent) == 1

    async with factory() as db:
        row = (await db.execute(select(DbReminder).where(DbReminder.kind == "water"))).scalar_one()
        assert row.last_fired_on is not None


async def test_scheduler_skips_when_disabled_or_wrong_time(client, db_engine, monkeypatch):
    await register_user(client)
    await client.get("/api/v1/reminders")
    await client.put("/api/v1/reminders", json=[{"kind": "water", "hhmm": "11:00", "enabled": True}])

    async def fake_send(db, user_id, title, body, url="/"):
        raise AssertionError("não devia enviar")

    monkeypatch.setattr("app.push.service.push_enabled", lambda: True)
    monkeypatch.setattr("app.push.service.send_push", fake_send)
    _freeze(monkeypatch, "09:30")  # hora diferente

    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        assert await service._tick(db) == 0


async def test_plan_check_fires_only_when_planned_and_unlogged(client, db_engine, monkeypatch):
    """plan_lunch: com plano p/ hoje e almoço vazio → push; depois de registar → nada."""
    from sqlalchemy import select as _select

    await register_user(client)
    await client.get("/api/v1/reminders")
    await client.put("/api/v1/reminders", json=[{"kind": "plan_lunch", "hhmm": "14:00", "enabled": True}])

    sent: list[str] = []

    async def fake_send(db, user_id, title, body, url="/"):
        sent.append(body)

    monkeypatch.setattr("app.push.service.push_enabled", lambda: True)
    monkeypatch.setattr("app.push.service.send_push", fake_send)
    _freeze(monkeypatch, "14:00")  # 2026-07-13 é segunda → weekday 0

    plan_item = {
        "id": "p1", "day": 0, "meal": "lunch", "name": "Frango com arroz", "emoji": "🍗",
        "servings": 1,
        "items": [{"foodName": "Frango", "emoji": "🍗", "grams": 150, "unit": "g",
                   "kcal": 248, "protein": 46.5, "carbs": 0, "fat": 5.4}],
    }
    resp = await client.put("/api/v1/meal-plan", json=[plan_item])
    assert resp.status_code == 200, resp.text

    from sqlalchemy.ext.asyncio import async_sessionmaker

    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        assert await service._tick(db) == 1
        await db.commit()
    assert sent and "Frango com arroz" in sent[0]

    # dia seguinte não testável aqui; mas com o almoço registado o push não sai
    async with factory() as db:
        row = (await db.execute(_select(DbReminder).where(DbReminder.kind == "plan_lunch"))).scalar_one()
        row.last_fired_on = None  # simula um novo dia
        await db.commit()
    day = {
        "entries": [{"id": "e1", "meal": "lunch", "foodName": "Frango", "emoji": "🍗",
                     "grams": 150, "unit": "g", "kcal": 248, "protein": 46.5, "carbs": 0, "fat": 5.4}],
    }
    resp = await client.put("/api/v1/days/2026-07-13", json=day)
    assert resp.status_code == 200, resp.text
    async with factory() as db:
        assert await service._tick(db) == 0
    assert len(sent) == 1


async def test_scheduler_noop_when_push_disabled(client, db_engine, monkeypatch):
    await register_user(client)
    await client.get("/api/v1/reminders")
    await client.put("/api/v1/reminders", json=[{"kind": "water", "hhmm": "11:00", "enabled": True}])

    monkeypatch.setattr("app.push.service.push_enabled", lambda: False)
    _freeze(monkeypatch, "11:00")

    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        assert await service._tick(db) == 0
