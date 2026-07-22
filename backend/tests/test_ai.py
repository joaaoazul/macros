"""AI analyze-meal tests com AsyncAnthropic mockado — nenhuma chamada real à Anthropic."""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import anthropic
import httpx
import pytest

from app.ai.router import ai_rate_limit
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio

FAKE_KEY = "sk-ant-test-0123456789abcdef"

FOODS_JSON = {
    "foods": [
        {
            "name": "Arroz branco",
            "emoji": "🍚",
            "grams": 150,
            "unit": "g",
            "kcal": 195,
            "protein": 4.1,
            "carbs": 42,
            "fat": 0.5,
        }
    ],
    "notes": "Porção estimada.",
}


def _fake_response(text: str) -> SimpleNamespace:
    return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)])


def _fake_client(create_side_effect=None, create_return=None):
    client = SimpleNamespace()
    client.messages = SimpleNamespace(
        create=AsyncMock(side_effect=create_side_effect, return_value=create_return)
    )
    client.close = AsyncMock()
    return client


def _api_error(cls, status_code: int):
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    response = httpx.Response(status_code, request=request)
    return cls(message="err", response=response, body=None)


@pytest.fixture(autouse=True)
def _reset_ai_buckets():
    ai_rate_limit._buckets.clear()


async def test_requires_auth(client):
    resp = await client.post(
        "/api/v1/ai/analyze-meal", json={"description": "arroz", "apiKey": FAKE_KEY}
    )
    assert resp.status_code == 401


async def test_requires_description_or_image(client):
    await register_user(client)
    resp = await client.post("/api/v1/ai/analyze-meal", json={"apiKey": FAKE_KEY})
    assert resp.status_code == 422


async def test_happy_path(client):
    await register_user(client)
    fake = _fake_client(create_return=_fake_response(json.dumps(FOODS_JSON)))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake) as ctor:
        resp = await client.post(
            "/api/v1/ai/analyze-meal",
            json={"description": "um prato de arroz", "apiKey": FAKE_KEY},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["foods"][0]["name"] == "Arroz branco"
    assert ctor.call_args.kwargs["api_key"] == FAKE_KEY
    fake.close.assert_awaited()


async def test_image_block_precedes_text(client):
    await register_user(client)
    fake = _fake_client(create_return=_fake_response(json.dumps(FOODS_JSON)))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake):
        resp = await client.post(
            "/api/v1/ai/analyze-meal",
            json={"imageBase64": "data:image/jpeg;base64,aGVsbG8=", "apiKey": FAKE_KEY},
        )
    assert resp.status_code == 200
    content = fake.messages.create.call_args.kwargs["messages"][0]["content"]
    assert content[0]["type"] == "image"
    assert content[0]["source"]["data"] == "aGVsbG8="  # prefixo data: removido
    assert content[1]["type"] == "text"


async def test_invalid_anthropic_key_maps_to_401(client):
    await register_user(client)
    fake = _fake_client(create_side_effect=_api_error(anthropic.AuthenticationError, 401))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake):
        resp = await client.post(
            "/api/v1/ai/analyze-meal", json={"description": "arroz", "apiKey": FAKE_KEY}
        )
    assert resp.status_code == 401
    assert "Anthropic" in resp.json()["detail"]


async def test_anthropic_rate_limit_maps_to_429(client):
    await register_user(client)
    fake = _fake_client(create_side_effect=_api_error(anthropic.RateLimitError, 429))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake):
        resp = await client.post(
            "/api/v1/ai/analyze-meal", json={"description": "arroz", "apiKey": FAKE_KEY}
        )
    assert resp.status_code == 429


async def test_per_user_rate_limit(client):
    await register_user(client)
    fake = _fake_client(create_return=_fake_response(json.dumps(FOODS_JSON)))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake):
        for _ in range(10):
            resp = await client.post(
                "/api/v1/ai/analyze-meal", json={"description": "arroz", "apiKey": FAKE_KEY}
            )
            assert resp.status_code == 200
        resp = await client.post(
            "/api/v1/ai/analyze-meal", json={"description": "arroz", "apiKey": FAKE_KEY}
        )
    assert resp.status_code == 429


async def test_giant_image_rejected(client):
    await register_user(client)
    resp = await client.post(
        "/api/v1/ai/analyze-meal",
        json={"imageBase64": "a" * 6_000_001, "apiKey": FAKE_KEY},
    )
    assert resp.status_code == 422


# --- food-tips ---------------------------------------------------------------

TIPS_JSON = {
    "summary": "Rico em proteína e pobre em gordura.",
    "uses": ["Grelhado com salada", "Em wraps"],
    "pairs_with": ["arroz", "brócolos"],
}

TIPS_BODY = {
    "name": "Peito de frango",
    "kcal": 165,
    "protein": 31,
    "carbs": 0,
    "fat": 3.6,
    "unit": "g",
    "apiKey": FAKE_KEY,
}


PANTRY_JSON = {
    "items": [
        {"name": "Frango", "emoji": "🍗", "qty": 2, "shelfLifeDays": 2},
        {"name": "Iogurte natural", "emoji": "🥛", "qty": 4, "shelfLifeDays": 14},
    ],
    "notes": "Havia um pacote tapado que não consegui ler.",
}
PANTRY_BODY = {"imageBase64": "QUJD", "apiKey": FAKE_KEY}


async def test_pantry_requires_auth(client):
    resp = await client.post("/api/v1/ai/analyze-pantry", json=PANTRY_BODY)
    assert resp.status_code == 401


async def test_pantry_happy_path(client):
    await register_user(client)
    fake = _fake_client(create_return=_fake_response(json.dumps(PANTRY_JSON)))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake) as ctor:
        resp = await client.post("/api/v1/ai/analyze-pantry", json=PANTRY_BODY)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert [i["name"] for i in body["items"]] == ["Frango", "Iogurte natural"]
    assert body["items"][0]["shelfLifeDays"] == 2
    assert ctor.call_args.kwargs["api_key"] == FAKE_KEY
    # a foto tem de chegar ao modelo como imagem
    content = fake.messages.create.call_args.kwargs["messages"][0]["content"]
    assert content[0]["type"] == "image"
    fake.close.assert_awaited()


async def test_pantry_strips_data_url_prefix(client):
    await register_user(client)
    fake = _fake_client(create_return=_fake_response(json.dumps(PANTRY_JSON)))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake):
        resp = await client.post(
            "/api/v1/ai/analyze-pantry",
            json={"imageBase64": "data:image/jpeg;base64,QUJD", "apiKey": FAKE_KEY},
        )
    assert resp.status_code == 200
    content = fake.messages.create.call_args.kwargs["messages"][0]["content"]
    assert content[0]["source"]["data"] == "QUJD"


async def test_pantry_invalid_key_maps_to_401(client):
    await register_user(client)
    fake = _fake_client(create_side_effect=_api_error(anthropic.AuthenticationError, 401))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake):
        resp = await client.post("/api/v1/ai/analyze-pantry", json=PANTRY_BODY)
    assert resp.status_code == 401


async def test_buffet_mode_asks_for_a_range(client):
    """No modo buffet o schema exige kcalMin/kcalMax e o sistema é o do buffet."""
    await register_user(client)
    buffet_json = {
        "foods": [
            {
                "name": "Arroz chau chau", "emoji": "🍚", "grams": 200, "unit": "g",
                "kcal": 320, "protein": 6, "carbs": 55, "fat": 8,
                "kcalMin": 240, "kcalMax": 400,
            }
        ],
        "notes": "O molho manda no intervalo.",
    }
    fake = _fake_client(create_return=_fake_response(json.dumps(buffet_json)))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake):
        resp = await client.post(
            "/api/v1/ai/analyze-meal",
            json={"description": "prato de buffet", "mode": "buffet", "apiKey": FAKE_KEY},
        )
    assert resp.status_code == 200, resp.text
    food = resp.json()["foods"][0]
    assert (food["kcalMin"], food["kcalMax"]) == (240, 400)
    kwargs = fake.messages.create.call_args.kwargs
    assert "buffet" in kwargs["system"].lower()
    item = kwargs["output_config"]["format"]["schema"]["properties"]["foods"]["items"]
    assert "kcalMin" in item["required"] and "kcalMax" in item["required"]


async def test_meal_mode_schema_stays_without_range(client):
    """O modo normal não pode ficar contaminado pelo schema do buffet."""
    await register_user(client)
    fake = _fake_client(create_return=_fake_response(json.dumps(FOODS_JSON)))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake):
        resp = await client.post(
            "/api/v1/ai/analyze-meal",
            json={"description": "arroz", "apiKey": FAKE_KEY},
        )
    assert resp.status_code == 200
    item = fake.messages.create.call_args.kwargs["output_config"]["format"]["schema"][
        "properties"
    ]["foods"]["items"]
    assert "kcalMin" not in item["properties"]
    assert resp.json()["foods"][0]["kcalMin"] is None


async def test_food_tips_requires_auth(client):
    resp = await client.post("/api/v1/ai/food-tips", json=TIPS_BODY)
    assert resp.status_code == 401


async def test_food_tips_happy_path(client):
    await register_user(client)
    fake = _fake_client(create_return=_fake_response(json.dumps(TIPS_JSON)))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake) as ctor:
        resp = await client.post("/api/v1/ai/food-tips", json=TIPS_BODY)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["summary"].startswith("Rico")
    assert body["uses"] and body["pairs_with"]
    assert ctor.call_args.kwargs["api_key"] == FAKE_KEY
    fake.close.assert_awaited()


async def test_food_tips_invalid_key_maps_to_401(client):
    await register_user(client)
    fake = _fake_client(create_side_effect=_api_error(anthropic.AuthenticationError, 401))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake):
        resp = await client.post("/api/v1/ai/food-tips", json=TIPS_BODY)
    assert resp.status_code == 401
    assert "Anthropic" in resp.json()["detail"]


async def test_food_tips_bad_json_maps_to_502(client):
    await register_user(client)
    fake = _fake_client(create_return=_fake_response("não é json"))
    with patch("app.ai.router.anthropic.AsyncAnthropic", return_value=fake):
        resp = await client.post("/api/v1/ai/food-tips", json=TIPS_BODY)
    assert resp.status_code == 502
