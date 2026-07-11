"""Weight history tests: upsert/overwrite, list order, delete, isolation, GDPR export."""

import pytest

from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


async def test_weights_require_auth(client):
    resp = await client.get("/api/v1/weights")
    assert resp.status_code == 401


async def test_put_list_ordered(client):
    await register_user(client)

    for iso, kg in [("2026-07-10", 71.2), ("2026-07-08", 71.8), ("2026-07-11", 70.9)]:
        resp = await client.put(f"/api/v1/weights/{iso}", json={"kg": kg})
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"date": iso, "kg": kg}

    resp = await client.get("/api/v1/weights")
    assert resp.status_code == 200
    assert [w["date"] for w in resp.json()] == ["2026-07-08", "2026-07-10", "2026-07-11"]


async def test_put_overwrites_same_date(client):
    await register_user(client)

    await client.put("/api/v1/weights/2026-07-11", json={"kg": 71.0})
    resp = await client.put("/api/v1/weights/2026-07-11", json={"kg": 70.5})
    assert resp.status_code == 200

    weights = (await client.get("/api/v1/weights")).json()
    assert weights == [{"date": "2026-07-11", "kg": 70.5}]


async def test_delete_idempotent(client):
    await register_user(client)

    await client.put("/api/v1/weights/2026-07-11", json={"kg": 71.0})
    resp = await client.delete("/api/v1/weights/2026-07-11")
    assert resp.status_code == 204
    resp = await client.delete("/api/v1/weights/2026-07-11")
    assert resp.status_code == 204

    assert (await client.get("/api/v1/weights")).json() == []


async def test_invalid_date_and_kg(client):
    await register_user(client)

    resp = await client.put("/api/v1/weights/11-07-2026", json={"kg": 71.0})
    assert resp.status_code == 422

    resp = await client.put("/api/v1/weights/2026-07-11", json={"kg": 5})
    assert resp.status_code == 422


async def test_isolation_between_users(client):
    await register_user(client)
    await client.put("/api/v1/weights/2026-07-11", json={"kg": 71.0})
    await client.post("/api/v1/auth/logout")

    await register_user(client, email="bruno@example.com", name="Bruno")
    assert (await client.get("/api/v1/weights")).json() == []


async def test_gdpr_export_includes_weights(client):
    await register_user(client)
    await client.put("/api/v1/weights/2026-07-11", json={"kg": 70.9})

    resp = await client.get("/api/v1/gdpr/export")
    assert resp.status_code == 200
    assert resp.json()["weights"] == [{"date": "2026-07-11", "kg": 70.9}]
