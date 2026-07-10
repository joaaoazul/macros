"""Auth flow tests: register, login, lockout, refresh rotation, logout, reset."""

import pytest

from app.config import settings
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio

PASSWORD = "password-forte-123"


async def test_register_sets_cookies_and_returns_user(client):
    resp = await register_user(client)
    body = resp.json()
    assert body["email"] == "ana@example.com"
    assert body["name"] == "Ana"
    # Email disabled in tests → auto-verified
    assert body["email_verified"] is True
    assert "access_token" in resp.cookies
    assert "refresh_token" in resp.cookies


async def test_register_duplicate_email_conflicts(client):
    await register_user(client)
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "ana@example.com", "password": PASSWORD},
    )
    assert resp.status_code == 409


@pytest.mark.parametrize("bad", ["curta", "1234567890123"])
async def test_password_policy(client, bad):
    resp = await client.post(
        "/api/v1/auth/register", json={"email": "x@example.com", "password": bad}
    )
    assert resp.status_code == 422


async def test_login_and_me(client):
    await register_user(client)
    await client.post("/api/v1/auth/logout")
    client.cookies.clear()

    resp = await client.post(
        "/api/v1/auth/login", json={"email": "ana@example.com", "password": PASSWORD}
    )
    assert resp.status_code == 200
    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "ana@example.com"


async def test_login_wrong_password_and_lockout(client):
    await register_user(client)
    client.cookies.clear()

    for _ in range(settings.MAX_LOGIN_ATTEMPTS):
        resp = await client.post(
            "/api/v1/auth/login", json={"email": "ana@example.com", "password": "errada-errada-1"}
        )
        assert resp.status_code == 401

    # Locked now — even the correct password is rejected
    resp = await client.post(
        "/api/v1/auth/login", json={"email": "ana@example.com", "password": PASSWORD}
    )
    assert resp.status_code == 401
    assert "bloqueada" in resp.json()["detail"]


async def test_me_requires_auth(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_csrf_header_required(client):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "a@b.pt", "password": PASSWORD},
        headers={"X-Requested-With": ""},
    )
    assert resp.status_code == 403


async def test_refresh_rotates_and_revokes_old(client):
    await register_user(client)
    old_refresh = client.cookies["refresh_token"]

    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 200
    assert client.cookies["refresh_token"] != old_refresh

    # Reusing the old refresh token must fail (rotation + reuse detection)
    client.cookies.set("refresh_token", old_refresh, path="/api/v1/auth/refresh")
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 401


async def test_logout_revokes_access_token(client):
    await register_user(client)
    access = client.cookies["access_token"]
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200

    client.cookies.set("access_token", access, path="/api")
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_forgot_password_unavailable_without_email(client):
    resp = await client.post("/api/v1/auth/forgot-password", json={"email": "ana@example.com"})
    assert resp.status_code == 422  # email sending not configured in tests


async def test_reset_password_flow_with_mocked_email(client, monkeypatch):
    sent: dict = {}

    async def fake_send_reset(to, token):
        sent["token"] = token
        return True

    monkeypatch.setattr(settings, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr("app.auth.router.send_reset_email", fake_send_reset)
    # Verification email also fires on register when email is "enabled"
    async def fake_send_verify(to, token):
        return True

    monkeypatch.setattr("app.auth.router.send_verification_email", fake_send_verify)

    await register_user(client)
    client.cookies.clear()

    resp = await client.post("/api/v1/auth/forgot-password", json={"email": "ana@example.com"})
    assert resp.status_code == 200
    assert "token" in sent

    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": sent["token"], "new_password": "outra-password-456"},
    )
    assert resp.status_code == 200

    # Old password no longer works; new one does
    resp = await client.post(
        "/api/v1/auth/login", json={"email": "ana@example.com", "password": PASSWORD}
    )
    assert resp.status_code == 401
    resp = await client.post(
        "/api/v1/auth/login", json={"email": "ana@example.com", "password": "outra-password-456"}
    )
    assert resp.status_code == 200

    # Token is single-use
    resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": sent["token"], "new_password": "mais-outra-789xyz"},
    )
    assert resp.status_code == 422
