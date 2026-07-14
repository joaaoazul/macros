"""Planeador de refeições + despensa: persistência, load-all e caps."""

import pytest

from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


def item(name: str, grams: float, protein: float = 10) -> dict:
    return {
        "foodName": name, "emoji": "🍽", "grams": grams, "unit": "g",
        "kcal": 150, "protein": protein, "carbs": 10, "fat": 5,
    }


def plan_entry(eid: str, day: int, meal: str) -> dict:
    return {
        "id": eid, "day": day, "meal": meal, "name": "Frango com arroz",
        "emoji": "🍗", "servings": 2, "items": [item("Frango", 200), item("Arroz", 100)],
    }


async def test_meal_plan_roundtrip_and_load_all(client):
    await register_user(client)

    body = [plan_entry("p1", 0, "lunch"), plan_entry("p2", 0, "dinner")]
    resp = await client.put("/api/v1/meal-plan", json=body)
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    data = (await client.get("/api/v1/data/all")).json()
    assert len(data["mealPlan"]) == 2
    assert {m["meal"] for m in data["mealPlan"]} == {"lunch", "dinner"}
    assert data["mealPlan"][0]["items"][0]["foodName"] in ("Frango", "Arroz")

    # substituição total (PUT é replace-all)
    resp = await client.put("/api/v1/meal-plan", json=[plan_entry("p3", 3, "lunch")])
    assert resp.status_code == 200
    data = (await client.get("/api/v1/data/all")).json()
    assert len(data["mealPlan"]) == 1 and data["mealPlan"][0]["id"] == "p3"


async def test_meal_plan_rejects_bad_meal_or_day(client):
    await register_user(client)
    bad_meal = {**plan_entry("x", 0, "breakfast")}
    assert (await client.put("/api/v1/meal-plan", json=[bad_meal])).status_code == 422
    bad_day = {**plan_entry("x", 9, "lunch")}
    assert (await client.put("/api/v1/meal-plan", json=[bad_day])).status_code == 422


async def test_meal_plan_dedupes_repeated_ids(client):
    await register_user(client)
    dup = [plan_entry("same", 0, "lunch"), plan_entry("same", 1, "dinner")]
    resp = await client.put("/api/v1/meal-plan", json=dup)
    assert resp.status_code == 200
    data = (await client.get("/api/v1/data/all")).json()
    assert len(data["mealPlan"]) == 1  # última ocorrência ganha


async def test_pantry_roundtrip(client):
    await register_user(client)
    body = [
        {"id": "s1", "kind": "have", "name": "Azeite", "emoji": "🫒"},
        {"id": "r1", "kind": "recurring", "name": "Aveia", "emoji": "🥣", "grams": 700, "unit": "g"},
    ]
    resp = await client.put("/api/v1/pantry", json=body)
    assert resp.status_code == 200

    data = (await client.get("/api/v1/data/all")).json()
    kinds = {p["kind"] for p in data["pantry"]}
    assert kinds == {"have", "recurring"}
    recurring = next(p for p in data["pantry"] if p["kind"] == "recurring")
    assert recurring["grams"] == 700 and recurring["unit"] == "g"


async def test_pantry_rejects_bad_kind(client):
    await register_user(client)
    resp = await client.put("/api/v1/pantry", json=[{"id": "x", "kind": "misc", "name": "?"}])
    assert resp.status_code == 422


async def test_import_fills_meal_plan_and_pantry(client):
    await register_user(client)
    payload = {
        "diary": {}, "water": {}, "exercise": {}, "customFoods": [], "recipes": [],
        "mealPlan": [plan_entry("ip1", 2, "dinner")],
        "pantry": [{"id": "ip2", "kind": "have", "name": "Sal", "emoji": "🧂"}],
    }
    data = (await client.post("/api/v1/data/import", json=payload)).json()
    assert len(data["mealPlan"]) == 1 and data["mealPlan"][0]["id"] == "ip1"
    assert len(data["pantry"]) == 1 and data["pantry"][0]["name"] == "Sal"
