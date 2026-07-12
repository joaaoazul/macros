"""Testes de combinações/receitas: replace, list, isolamento, import, export GDPR."""

import pytest

from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


def _item(name="Pão", grams=60.0, kcal=160.0):
    return {
        "foodName": name,
        "emoji": "🍞",
        "grams": grams,
        "unit": "g",
        "kcal": kcal,
        "protein": 6.0,
        "carbs": 30.0,
        "fat": 1.0,
    }


RECIPE = {
    "id": "r1",
    "name": "Sandes mista",
    "emoji": "🥪",
    "auto": False,
    "items": [_item("Pão"), _item("Fiambre", 30, 45), _item("Queijo", 20, 60)],
}
AUTO_COMBO = {"id": "r2", "name": None, "emoji": "🍽️", "auto": True, "items": [_item("Skyr", 150, 90)]}


async def test_recipes_require_auth(client):
    resp = await client.put("/api/v1/recipes", json=[RECIPE])
    assert resp.status_code == 401


async def test_put_and_load_recipes(client):
    await register_user(client)

    resp = await client.put("/api/v1/recipes", json=[RECIPE, AUTO_COMBO])
    assert resp.status_code == 200, resp.text

    data = (await client.get("/api/v1/data/all")).json()
    ids = {r["id"] for r in data["recipes"]}
    assert ids == {"r1", "r2"}
    named = next(r for r in data["recipes"] if r["id"] == "r1")
    assert named["name"] == "Sandes mista"
    assert len(named["items"]) == 3
    assert named["auto"] is False


async def test_put_replaces_whole_list(client):
    await register_user(client)
    await client.put("/api/v1/recipes", json=[RECIPE, AUTO_COMBO])
    resp = await client.put("/api/v1/recipes", json=[AUTO_COMBO])
    assert resp.status_code == 200

    data = (await client.get("/api/v1/data/all")).json()
    assert [r["id"] for r in data["recipes"]] == ["r2"]


async def test_recipe_requires_at_least_one_item(client):
    await register_user(client)
    resp = await client.put("/api/v1/recipes", json=[{**RECIPE, "items": []}])
    assert resp.status_code == 422


async def test_isolation_between_users(client):
    await register_user(client)
    await client.put("/api/v1/recipes", json=[RECIPE])
    await client.post("/api/v1/auth/logout")

    await register_user(client, email="bruno@example.com", name="Bruno")
    data = (await client.get("/api/v1/data/all")).json()
    assert data["recipes"] == []


async def test_import_fills_missing_recipes(client):
    await register_user(client)
    await client.put("/api/v1/recipes", json=[RECIPE])
    # import traz r1 (existente, ignorado) + r2 (novo)
    resp = await client.post("/api/v1/data/import", json={"recipes": [RECIPE, AUTO_COMBO]})
    assert resp.status_code == 200
    ids = {r["id"] for r in resp.json()["recipes"]}
    assert ids == {"r1", "r2"}


async def test_gdpr_export_includes_recipes(client):
    await register_user(client)
    await client.put("/api/v1/recipes", json=[RECIPE])
    resp = await client.get("/api/v1/gdpr/export")
    assert resp.status_code == 200
    assert [r["id"] for r in resp.json()["recipes"]] == ["r1"]
