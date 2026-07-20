"""Data endpoint tests: day upsert round-trip, import idempotency, export, deletion."""

import pytest

from tests.conftest import register_user

pytestmark = pytest.mark.asyncio

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

ENTRY = {
    "id": "abc123",
    "meal": "lunch",
    "foodName": "Arroz",
    "emoji": "🍚",
    "grams": 150,
    "unit": "g",
    "kcal": 195,
    "protein": 4.1,
    "carbs": 42,
    "fat": 0.5,
}

EXERCISE = {"id": "ex1", "name": "Corrida", "kcal": 300}

FOOD = {
    "id": "cf1",
    "name": "Batido caseiro",
    "emoji": "🥤",
    "kcal": 120,
    "protein": 10,
    "carbs": 15,
    "fat": 2,
    "unit": "ml",
    "custom": True,
    "brand": None,
}


async def test_data_requires_auth(client):
    resp = await client.get("/api/v1/data/all")
    assert resp.status_code == 401


async def test_profile_and_day_round_trip(client):
    await register_user(client)

    resp = await client.put("/api/v1/profile", json=PROFILE)
    assert resp.status_code == 200

    resp = await client.put(
        "/api/v1/days/2026-07-11",
        json={"entries": [ENTRY], "waterMl": 750, "exercises": [EXERCISE]},
    )
    assert resp.status_code == 200

    data = (await client.get("/api/v1/data/all")).json()
    assert data["profile"]["name"] == "Ana"
    assert data["profile"]["targets"]["waterMl"] == 2000
    assert data["diary"]["2026-07-11"][0]["foodName"] == "Arroz"
    assert data["water"]["2026-07-11"] == 750
    assert data["exercise"]["2026-07-11"][0]["name"] == "Corrida"


async def test_profile_birthdate_and_body_fat_round_trip(client):
    await register_user(client)
    body = {**PROFILE, "birthdate": "1994-03-15", "bodyFatPct": 18.5}
    resp = await client.put("/api/v1/profile", json=body)
    assert resp.status_code == 200

    data = (await client.get("/api/v1/data/all")).json()
    assert data["profile"]["birthdate"] == "1994-03-15"
    assert data["profile"]["bodyFatPct"] == 18.5


async def test_profile_omitting_new_fields_keeps_them_null(client):
    await register_user(client)
    resp = await client.put("/api/v1/profile", json=PROFILE)
    assert resp.status_code == 200
    data = (await client.get("/api/v1/data/all")).json()
    assert data["profile"]["birthdate"] is None
    assert data["profile"]["bodyFatPct"] is None


async def test_day_upsert_replaces_only_provided_sections(client):
    await register_user(client)
    await client.put("/api/v1/days/2026-07-11", json={"entries": [ENTRY], "waterMl": 500})

    # Update only water — entries must survive
    await client.put("/api/v1/days/2026-07-11", json={"waterMl": 1000})
    data = (await client.get("/api/v1/data/all")).json()
    assert data["water"]["2026-07-11"] == 1000
    assert len(data["diary"]["2026-07-11"]) == 1

    # Empty entries list clears the day
    await client.put("/api/v1/days/2026-07-11", json={"entries": []})
    data = (await client.get("/api/v1/data/all")).json()
    assert "2026-07-11" not in data["diary"]


async def test_day_upsert_is_idempotent(client):
    await register_user(client)
    for _ in range(2):
        resp = await client.put("/api/v1/days/2026-07-11", json={"entries": [ENTRY]})
        assert resp.status_code == 200
    data = (await client.get("/api/v1/data/all")).json()
    assert len(data["diary"]["2026-07-11"]) == 1


async def test_invalid_date_rejected(client):
    await register_user(client)
    resp = await client.put("/api/v1/days/not-a-date", json={"waterMl": 100})
    assert resp.status_code == 422


async def test_duplicate_entry_ids_are_deduped_not_500(client):
    """Um payload com ids repetidos (replay/glitch) não deve rebentar com 500."""
    await register_user(client)
    dup = {**ENTRY, "foodName": "Arroz (edição nova)", "kcal": 250}
    resp = await client.put("/api/v1/days/2026-07-11", json={"entries": [ENTRY, dup]})
    assert resp.status_code == 200, resp.text

    data = (await client.get("/api/v1/data/all")).json()
    day = data["diary"]["2026-07-11"]
    assert len(day) == 1  # deduplicado por id
    assert day[0]["kcal"] == 250  # última ocorrência ganha


async def test_duplicate_custom_food_ids_are_deduped_not_500(client):
    await register_user(client)
    dup = {**FOOD, "name": "Batido v2", "kcal": 200}
    resp = await client.put("/api/v1/custom-foods", json=[FOOD, dup])
    assert resp.status_code == 200, resp.text
    data = (await client.get("/api/v1/data/all")).json()
    assert len(data["customFoods"]) == 1
    assert data["customFoods"][0]["name"] == "Batido v2"


async def test_custom_foods_replace_all(client):
    await register_user(client)
    await client.put("/api/v1/custom-foods", json=[FOOD])
    await client.put("/api/v1/custom-foods", json=[FOOD])  # idempotent
    data = (await client.get("/api/v1/data/all")).json()
    assert len(data["customFoods"]) == 1
    assert data["customFoods"][0]["custom"] is True


async def test_import_fills_gaps_but_server_wins(client):
    await register_user(client)
    await client.put("/api/v1/days/2026-07-10", json={"entries": [ENTRY]})

    other_entry = {**ENTRY, "id": "zzz999", "foodName": "Massa"}
    payload = {
        "profile": PROFILE,
        "diary": {"2026-07-10": [other_entry], "2026-07-09": [other_entry]},
        "water": {"2026-07-09": 400},
        "exercise": {},
        "customFoods": [FOOD],
    }
    resp = await client.post("/api/v1/data/import", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    # Existing day untouched (server wins), missing day imported
    assert data["diary"]["2026-07-10"][0]["foodName"] == "Arroz"
    assert data["diary"]["2026-07-09"][0]["foodName"] == "Massa"
    assert data["water"]["2026-07-09"] == 400
    assert data["profile"]["name"] == "Ana"

    # Re-import is a no-op
    resp = await client.post("/api/v1/data/import", json=payload)
    assert len(resp.json()["diary"]["2026-07-10"]) == 1


async def test_gdpr_export_shape(client):
    await register_user(client)
    await client.put("/api/v1/profile", json=PROFILE)
    resp = await client.get("/api/v1/gdpr/export")
    assert resp.status_code == 200
    assert "attachment" in resp.headers["content-disposition"]
    body = resp.json()
    assert body["account"]["email"] == "ana@example.com"
    assert body["profile"]["name"] == "Ana"
    assert set(body) >= {"account", "profile", "diary", "water", "exercise", "customFoods"}


async def test_delete_account_requires_password_and_cascades(client):
    await register_user(client)
    await client.put("/api/v1/days/2026-07-11", json={"entries": [ENTRY]})

    resp = await client.request(
        "DELETE", "/api/v1/gdpr/account", json={"password": "password-errada-1"}
    )
    assert resp.status_code == 401

    resp = await client.request(
        "DELETE", "/api/v1/gdpr/account", json={"password": "password-forte-123"}
    )
    assert resp.status_code == 200

    # Session gone and account unusable
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401
    resp = await client.post(
        "/api/v1/auth/login", json={"email": "ana@example.com", "password": "password-forte-123"}
    )
    assert resp.status_code == 401
