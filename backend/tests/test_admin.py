"""Testes do SOC admin: gating, dashboard, audit, users/sessões, blocklist."""

import pytest
from sqlalchemy import select

from app.auth.models import User
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


async def _make_admin(client, db_engine, email="admin@example.com"):
    from sqlalchemy.ext.asyncio import async_sessionmaker

    await register_user(client, email=email, name="Admin")
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        u = (await db.execute(select(User).where(User.email == email))).scalar_one()
        u.is_admin = True
        await db.commit()
        return u.id


async def test_admin_requires_auth(client):
    resp = await client.get("/api/v1/admin/security-summary")
    assert resp.status_code == 401


async def test_non_admin_forbidden(client):
    await register_user(client)
    resp = await client.get("/api/v1/admin/security-summary")
    assert resp.status_code == 403


async def test_admin_me_and_summary(client, db_engine):
    await _make_admin(client, db_engine)
    me = await client.get("/api/v1/admin/me")
    assert me.status_code == 200 and me.json()["isAdmin"] is True

    resp = await client.get("/api/v1/admin/security-summary")
    assert resp.status_code == 200
    body = resp.json()
    assert "failedLogins24h" in body and len(body["daily"]) == 14


async def test_audit_records_failed_login_and_lists(client, db_engine):
    await _make_admin(client, db_engine)
    # gera um login falhado
    await client.post("/api/v1/auth/login", json={"email": "no@one.com", "password": "x" * 12})
    resp = await client.get("/api/v1/admin/audit?action=login_failed")
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
    assert resp.json()["rows"][0]["severity"] == "warning"


async def test_user_management_actions(client, db_engine):
    admin_id = await _make_admin(client, db_engine)
    await client.post("/api/v1/auth/logout")
    # cria alvo
    await register_user(client, email="alvo@example.com", name="Alvo")
    await client.post("/api/v1/auth/logout")
    # volta a entrar como admin
    await client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "password-forte-123"})

    users = (await client.get("/api/v1/admin/users?q=alvo")).json()
    target = next(u for u in users if u["email"] == "alvo@example.com")
    tid = target["id"]

    r = await client.post(f"/api/v1/admin/users/{tid}/disable")
    assert r.status_code == 200 and r.json()["isActive"] is False
    r = await client.post(f"/api/v1/admin/users/{tid}/enable")
    assert r.json()["isActive"] is True

    # admin não se pode desativar a si próprio
    r = await client.post(f"/api/v1/admin/users/{admin_id}/disable")
    assert r.status_code == 422


async def test_blocklist_add_list_remove(client, db_engine):
    await _make_admin(client, db_engine)
    r = await client.post("/api/v1/admin/blocklist", json={"ip": "203.0.113.7", "reason": "abuso"})
    assert r.status_code == 201
    rows = (await client.get("/api/v1/admin/blocklist")).json()
    assert any(x["ip"] == "203.0.113.7" for x in rows)
    r = await client.delete("/api/v1/admin/blocklist/203.0.113.7")
    assert r.status_code == 204
