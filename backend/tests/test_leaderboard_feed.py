"""Leaderboard + feed: matemática de adesão, idempotência e visibilidade."""

from datetime import date, timedelta

import pytest

import app.social.service as social_service
from tests.conftest import register_user
from tests.test_social import make_social_user

pytestmark = pytest.mark.asyncio

TODAY = date(2026, 7, 8)  # quarta-feira → semana 2026-07-06..12

PROFILE = {
    "name": "Ana",
    "sex": "F",
    "age": 30,
    "heightCm": 165,
    "weightKg": 60,
    "activity": 1.375,
    "goal": "maintain",
    "targets": {"kcal": 2000, "protein": 108, "carbs": 238, "fat": 56, "waterMl": 2000},
}


def entry(entry_id: str, kcal: float) -> dict:
    return {
        "id": entry_id,
        "meal": "lunch",
        "foodName": "Comida",
        "emoji": "🍽",
        "grams": 100,
        "unit": "g",
        "kcal": kcal,
        "protein": 10,
        "carbs": 10,
        "fat": 10,
    }


@pytest.fixture(autouse=True)
def freeze_today(monkeypatch):
    monkeypatch.setattr(social_service, "lisbon_today", lambda: TODAY)


async def seed_day(client, iso: str, kcal: float, water: int = 0, exercise_kcal: float = 0):
    body: dict = {"entries": [entry(f"e-{iso}", kcal)]}
    if water:
        body["waterMl"] = water
    if exercise_kcal:
        body["exercises"] = [{"id": f"x-{iso}", "name": "Treino", "kcal": exercise_kcal}]
    resp = await client.put(f"/api/v1/days/{iso}", json=body)
    assert resp.status_code == 200, resp.text


async def test_on_plan_boundary_and_net_kcal(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    await client.put("/api/v1/profile", json=PROFILE)

    await seed_day(client, "2026-07-06", 2200)  # exatamente +10% → no plano
    await seed_day(client, "2026-07-07", 2201)  # +10% e um pouco → fora
    # 2500 consumidas − 400 de exercício = 2100 net → no plano (+ bónus exercício)
    await seed_day(client, "2026-07-08", 2500, exercise_kcal=400)

    rows = (await client.get("/api/v1/social/leaderboard")).json()["rows"]
    assert rows[0]["daysOnPlan"] == 2
    assert rows[0]["bonus"] >= 1  # exercício de dia 8


async def test_leaderboard_ranking_and_tiebreak(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    await client.put("/api/v1/profile", json=PROFILE)
    await seed_day(client, "2026-07-06", 2000, water=2500)  # no plano + bónus água
    ana_cookies = dict(client.cookies)

    client.cookies.clear()
    await make_social_user(client, "rui@example.com", "rui_gains")
    await client.put("/api/v1/profile", json=PROFILE)
    await seed_day(client, "2026-07-06", 2000)  # no plano, sem bónus

    # tornar amigos
    await client.post("/api/v1/social/friends/requests", json={"username": "ana_fit"})
    rui_cookies = dict(client.cookies)
    client.cookies.clear()
    for k, v in ana_cookies.items():
        client.cookies.set(k, v)
    fid = (await client.get("/api/v1/social/friends")).json()["incoming"][0]["id"]
    await client.post(f"/api/v1/social/friends/requests/{fid}/accept")

    board = (await client.get("/api/v1/social/leaderboard")).json()
    assert board["week"] == {"start": "2026-07-06", "end": "2026-07-12"}
    rows = board["rows"]
    assert len(rows) == 2
    # empate a 1 dia; ana ganha pelo bónus de água
    assert rows[0]["username"] == "ana_fit" and rows[0]["rank"] == 1
    assert rows[1]["username"] == "rui_gains" and rows[1]["rank"] == 2

    client.cookies.clear()
    for k, v in rui_cookies.items():
        client.cookies.set(k, v)
    rows_rui = (await client.get("/api/v1/social/leaderboard")).json()["rows"]
    assert [r["isMe"] for r in rows_rui] == [False, True]


async def test_day_on_plan_event_idempotent_and_removed(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    await client.put("/api/v1/profile", json=PROFILE)

    for _ in range(3):  # PUTs repetidos → 1 evento
        await seed_day(client, "2026-07-08", 2000)
    feed = (await client.get("/api/v1/social/feed")).json()
    on_plan = [e for e in feed if e["kind"] == "day_on_plan"]
    assert len(on_plan) == 1

    # editar o dia para fora do plano remove o evento
    await seed_day(client, "2026-07-08", 3500)
    feed = (await client.get("/api/v1/social/feed")).json()
    assert not any(e["kind"] == "day_on_plan" for e in feed)


async def test_streak_milestone(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    await client.put("/api/v1/profile", json=PROFILE)
    for i in range(3):
        iso = (TODAY - timedelta(days=2 - i)).isoformat()
        await seed_day(client, iso, 2000)
    feed = (await client.get("/api/v1/social/feed")).json()
    streaks = [e for e in feed if e["kind"] == "streak"]
    assert len(streaks) == 1
    assert streaks[0]["payload"] == {"days": 3}


async def test_feed_only_shows_friends(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    await client.put("/api/v1/profile", json=PROFILE)
    await seed_day(client, "2026-07-08", 2000)

    # estranho (sem amizade) não vê os eventos da ana
    client.cookies.clear()
    await make_social_user(client, "x@example.com", "estranho")
    feed = (await client.get("/api/v1/social/feed")).json()
    assert feed == []
