"""Convites: geração por admin, registo comped, códigos esgotados/expirados."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.auth.models import InviteCode, User
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


async def _make_admin(client, db_engine, email="admin@example.com"):
    await register_user(client, email=email, name="Admin")
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        u = (await db.execute(select(User).where(User.email == email))).scalar_one()
        u.is_admin = True
        await db.commit()
        return u.id


async def test_invites_require_admin(client):
    await register_user(client)
    assert (await client.get("/api/v1/admin/invites")).status_code == 403
    assert (await client.post("/api/v1/admin/invites", json={"maxUses": 1})).status_code == 403


async def test_admin_generates_and_lists_invites(client, db_engine):
    await _make_admin(client, db_engine)
    resp = await client.post("/api/v1/admin/invites", json={"maxUses": 2, "expiresInDays": 7})
    assert resp.status_code == 201, resp.text
    row = resp.json()
    assert row["maxUses"] == 2 and row["usedCount"] == 0
    assert len(row["code"]) == 9 and "-" in row["code"]  # XXXX-XXXX
    assert row["expiresAt"] is not None

    listed = (await client.get("/api/v1/admin/invites")).json()
    assert any(r["code"] == row["code"] for r in listed)


async def test_register_with_valid_code_is_comped(client, db_engine):
    await _make_admin(client, db_engine)
    code = (await client.post("/api/v1/admin/invites", json={"maxUses": 1})).json()["code"]
    await client.post("/api/v1/auth/logout")

    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "amigo@example.com",
            "password": "password-forte-123",
            "name": "Amigo",
            "invite_code": code.lower(),  # case-insensitive
        },
    )
    assert resp.status_code == 201, resp.text

    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        u = (await db.execute(select(User).where(User.email == "amigo@example.com"))).scalar_one()
        assert u.comped is True
        inv = (await db.execute(select(InviteCode).where(InviteCode.code == code))).scalar_one()
        assert inv.used_count == 1


async def test_register_with_bad_code_fails_clearly(client):
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "x@example.com",
            "password": "password-forte-123",
            "name": "X",
            "invite_code": "NADA-NADA",
        },
    )
    assert resp.status_code == 422
    assert "convite" in resp.text.lower()


async def test_exhausted_and_expired_codes_rejected(client, db_engine):
    await _make_admin(client, db_engine)
    code = (await client.post("/api/v1/admin/invites", json={"maxUses": 1})).json()["code"]

    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        inv = (await db.execute(select(InviteCode).where(InviteCode.code == code))).scalar_one()
        inv.used_count = 1  # esgotado
        db.add(
            InviteCode(
                code="VELH-OOOO",
                created_by=inv.created_by,
                max_uses=5,
                expires_at=datetime.now(timezone.utc) - timedelta(days=1),
            )
        )
        await db.commit()
    await client.post("/api/v1/auth/logout")

    for bad in (code, "VELH-OOOO"):
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"{bad.replace('-', '').lower()}@example.com",
                "password": "password-forte-123",
                "name": "X",
                "invite_code": bad,
            },
        )
        assert resp.status_code == 422, resp.text


async def test_register_without_code_still_trials(client, db_engine):
    await register_user(client, email="normal@example.com")
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as db:
        u = (await db.execute(select(User).where(User.email == "normal@example.com"))).scalar_one()
        assert u.comped is False
        assert u.subscription_status == "trialing"
