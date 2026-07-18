"""Partilhas: enviar snapshot food/recipe numa mensagem e guardar (id novo)."""

import pytest

from tests.test_messages import make_friends, switch

pytestmark = pytest.mark.asyncio

FOOD_SHARE = {
    "kind": "food",
    "payload": {
        "name": "Skyr Baunilha",
        "emoji": "🥛",
        "kcal": 63,
        "protein": 10,
        "carbs": 4,
        "fat": 0.2,
        "unit": "g",
    },
}

RECIPE_SHARE = {
    "kind": "recipe",
    "payload": {
        "name": "Bowl proteico",
        "emoji": "🥣",
        "items": [
            {"foodName": "Skyr", "emoji": "🥛", "grams": 150, "unit": "g", "kcal": 95, "protein": 15, "carbs": 6, "fat": 0.3},
            {"foodName": "Aveia", "emoji": "🌾", "grams": 40, "unit": "g", "kcal": 150, "protein": 5, "carbs": 27, "fat": 3},
        ],
    },
}


async def _dm(client, ana_c, rui_id):
    switch(client, ana_c)
    return (await client.post(f"/api/v1/messages/dm/{rui_id}")).json()["id"]


async def test_send_and_save_food_share(client):
    ana_c, rui_c, _, rui_id = await make_friends(client)
    gid = await _dm(client, ana_c, rui_id)

    resp = await client.post(
        f"/api/v1/messages/conversations/{gid}/messages", json={"share": FOOD_SHARE}
    )
    assert resp.status_code == 201
    msg = resp.json()
    assert msg["share"]["kind"] == "food"

    # rui guarda → aparece nos custom foods dele com id 'shared-…'
    switch(client, rui_c)
    save = await client.post(f"/api/v1/messages/{msg['id']}/save-share")
    assert save.status_code == 200
    body = save.json()
    assert body["kind"] == "food"
    assert body["food"]["id"].startswith("shared-")
    assert body["food"]["name"] == "Skyr Baunilha"

    foods = (await client.get("/api/v1/data/all")).json()["customFoods"]
    assert any(f["id"] == body["food"]["id"] for f in foods)


async def test_send_and_save_recipe_share(client):
    ana_c, rui_c, _, rui_id = await make_friends(client)
    gid = await _dm(client, ana_c, rui_id)

    msg = (
        await client.post(
            f"/api/v1/messages/conversations/{gid}/messages", json={"share": RECIPE_SHARE}
        )
    ).json()

    switch(client, rui_c)
    body = (await client.post(f"/api/v1/messages/{msg['id']}/save-share")).json()
    assert body["kind"] == "recipe"
    assert body["recipe"]["id"].startswith("shared-")
    assert len(body["recipe"]["items"]) == 2
    assert body["recipe"]["auto"] is False

    recipes = (await client.get("/api/v1/data/all")).json()["recipes"]
    assert any(r["id"] == body["recipe"]["id"] for r in recipes)


async def test_empty_body_allowed_with_share(client):
    ana_c, _, _, rui_id = await make_friends(client)
    gid = await _dm(client, ana_c, rui_id)
    resp = await client.post(
        f"/api/v1/messages/conversations/{gid}/messages", json={"body": "", "share": FOOD_SHARE}
    )
    assert resp.status_code == 201


async def test_non_member_cannot_save_share(client):
    ana_c, rui_c, _, rui_id = await make_friends(client)
    gid = await _dm(client, ana_c, rui_id)
    msg = (
        await client.post(
            f"/api/v1/messages/conversations/{gid}/messages", json={"share": FOOD_SHARE}
        )
    ).json()

    # um terceiro sem relação não pode guardar
    client.cookies.clear()
    from tests.test_social import make_social_user

    await make_social_user(client, "zed@example.com", "zed_lifts")
    assert (await client.post(f"/api/v1/messages/{msg['id']}/save-share")).status_code == 404


async def test_share_rejects_bad_payload(client):
    ana_c, _, _, rui_id = await make_friends(client)
    gid = await _dm(client, ana_c, rui_id)
    bad = {"kind": "food", "payload": {"name": "x"}}  # faltam macros obrigatórias
    resp = await client.post(
        f"/api/v1/messages/conversations/{gid}/messages", json={"share": bad}
    )
    assert resp.status_code == 422
