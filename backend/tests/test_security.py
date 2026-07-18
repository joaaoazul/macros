"""Testes dos fixes de hardening: IP fiável, SSRF do push, caps de inserts."""

from unittest.mock import patch

import pytest

from app.net import client_ip
from app.push.service import safe_push_endpoint
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


class _FakeReq:
    def __init__(self, headers, host="127.0.0.1"):
        self.headers = headers
        self.client = type("C", (), {"host": host})()


def test_client_ip_prefers_x_real_ip_ignores_xff():
    # X-Forwarded-For é appendável pelo cliente → NÃO deve ser usado
    req = _FakeReq({"X-Forwarded-For": "1.2.3.4", "X-Real-IP": "9.9.9.9"}, host="10.0.0.1")
    assert client_ip(req) == "9.9.9.9"


def test_client_ip_falls_back_to_peer_without_real_ip():
    req = _FakeReq({"X-Forwarded-For": "1.2.3.4"}, host="10.0.0.1")
    # sem X-Real-IP, cai no peer directo — nunca no XFF spoofável
    assert client_ip(req) == "10.0.0.1"


def test_ssrf_guard_blocks_private_and_non_https():
    assert safe_push_endpoint("http://push.example.com/x") is False  # não-https
    with patch("app.net.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 443))]):
        assert safe_push_endpoint("https://evil.example.com/x") is False  # resolve p/ loopback
    with patch("app.net.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("10.0.0.5", 443))]):
        assert safe_push_endpoint("https://evil.example.com/x") is False  # RFC1918
    with patch("app.net.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("142.250.185.14", 443))]):
        assert safe_push_endpoint("https://fcm.googleapis.com/x") is True  # público ok


async def test_subscribe_rejects_unsafe_endpoint(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "pub")
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "priv")
    await register_user(client)
    resp = await client.post(
        "/api/v1/push/subscribe",
        json={"endpoint": "http://169.254.169.254/latest", "keys": {"p256dh": "k", "auth": "a"}},
    )
    assert resp.status_code == 422  # não-https / metadata endpoint


async def test_put_day_caps_entries(client):
    await register_user(client)
    entry = {
        "id": "x", "meal": "lunch", "foodName": "A", "emoji": "🍚",
        "grams": 1, "unit": "g", "kcal": 1, "protein": 0, "carbs": 0, "fat": 0,
    }
    resp = await client.put("/api/v1/days/2026-07-12", json={"entries": [entry] * 201})
    assert resp.status_code == 422  # acima do cap de 200
