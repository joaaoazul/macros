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
