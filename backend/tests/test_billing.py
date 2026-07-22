"""Entitlement: has_access (fail-open + matriz) e o gate 402 nas rotas de dados."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.billing.service import has_access
from tests.conftest import register_user

pytestmark = pytest.mark.asyncio

NOW = datetime(2026, 7, 21, tzinfo=timezone.utc)


def _user(**kw):
    base = {"comped": False, "trial_ends_at": None, "subscription_status": "none"}
    base.update(kw)
    return SimpleNamespace(**base)


def test_has_access_fails_open_when_billing_disabled(monkeypatch):
    monkeypatch.setattr("app.billing.service.billing_enabled", lambda: False)
    # sem trial nem subscrição, mas billing desligado → acesso na mesma
    assert has_access(_user(), NOW) is True


def test_has_access_matrix_when_billing_enabled(monkeypatch):
    monkeypatch.setattr("app.billing.service.billing_enabled", lambda: True)
    assert has_access(_user(comped=True), NOW) is True
    assert has_access(_user(trial_ends_at=NOW + timedelta(days=1)), NOW) is True
    assert has_access(_user(trial_ends_at=NOW - timedelta(days=1)), NOW) is False
    assert has_access(_user(subscription_status="active"), NOW) is True
    # o caso real pós-registo: status fica "trialing" para sempre, quem manda é o trial_ends_at
    assert has_access(_user(subscription_status="trialing", trial_ends_at=NOW + timedelta(days=1)), NOW) is True
    assert has_access(_user(subscription_status="trialing", trial_ends_at=NOW - timedelta(days=1)), NOW) is False
    assert has_access(_user(subscription_status="trialing"), NOW) is False
    assert has_access(_user(subscription_status="canceled"), NOW) is False
    assert has_access(_user(subscription_status="past_due"), NOW) is False
    assert has_access(_user(), NOW) is False


async def test_data_open_when_billing_disabled(client):
    # billing desligado por omissão nos testes (STRIPE_SECRET_KEY vazio)
    await register_user(client)
    resp = await client.get("/api/v1/data/all")
    assert resp.status_code == 200


async def test_billing_status_shows_trial(client):
    await register_user(client)
    body = (await client.get("/api/v1/billing/status")).json()
    assert body["status"] == "trialing"
    assert body["access"] is True
    assert body["billingEnabled"] is False
    assert body["trialEndsAt"] is not None
    assert body["comped"] is False


async def test_data_402_when_no_access(client, monkeypatch):
    await register_user(client)
    monkeypatch.setattr("app.billing.dependencies.has_access", lambda user, now=None: False)
    resp = await client.get("/api/v1/data/all")
    assert resp.status_code == 402


async def test_billing_status_requires_auth(client):
    resp = await client.get("/api/v1/billing/status")
    assert resp.status_code == 401


# ── Stripe: checkout + webhook ──────────────────────────────────────────────


async def test_checkout_rejected_when_billing_disabled(client):
    await register_user(client)
    resp = await client.post("/api/v1/billing/checkout", json={"plan": "monthly"})
    assert resp.status_code == 422  # pagamentos ainda não ativos


async def test_checkout_returns_url_when_enabled(client, monkeypatch):
    await register_user(client)
    monkeypatch.setattr("app.billing.router.billing_enabled", lambda: True)

    async def fake_checkout(user, plan, success_url, cancel_url):
        assert plan == "annual"
        return "https://checkout.stripe.test/session"

    monkeypatch.setattr("app.billing.router.create_checkout_session", fake_checkout)
    resp = await client.post("/api/v1/billing/checkout", json={"plan": "annual"})
    assert resp.status_code == 200
    assert resp.json()["url"] == "https://checkout.stripe.test/session"


async def test_webhook_activates_then_cancels(client, monkeypatch):
    user_id = (await register_user(client)).json()["id"]

    completed = {
        "type": "checkout.session.completed",
        "data": {"object": {"client_reference_id": str(user_id), "customer": "cus_test"}},
    }
    monkeypatch.setattr("app.billing.router.verify_webhook", lambda payload, sig: completed)
    r = await client.post("/api/v1/billing/webhook", content=b"{}", headers={"stripe-signature": "x"})
    assert r.status_code == 200
    assert (await client.get("/api/v1/billing/status")).json()["status"] == "active"

    deleted = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cus_test", "status": "canceled"}},
    }
    monkeypatch.setattr("app.billing.router.verify_webhook", lambda payload, sig: deleted)
    r2 = await client.post("/api/v1/billing/webhook", content=b"{}", headers={"stripe-signature": "x"})
    assert r2.status_code == 200
    assert (await client.get("/api/v1/billing/status")).json()["status"] == "canceled"


async def test_webhook_without_csrf_header(client, monkeypatch):
    """O Stripe não envia X-Requested-With — o webhook não pode cair no guard CSRF."""
    user_id = (await register_user(client)).json()["id"]
    completed = {
        "type": "checkout.session.completed",
        "data": {"object": {"client_reference_id": str(user_id), "customer": "cus_csrf"}},
    }
    monkeypatch.setattr("app.billing.router.verify_webhook", lambda payload, sig: completed)
    r = await client.post(
        "/api/v1/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "x", "X-Requested-With": ""},
    )
    assert r.status_code == 200


async def test_webhook_bad_signature_rejected(client, monkeypatch):
    def boom(payload, sig):
        raise ValueError("bad signature")

    monkeypatch.setattr("app.billing.router.verify_webhook", boom)
    r = await client.post("/api/v1/billing/webhook", content=b"{}", headers={"stripe-signature": "x"})
    assert r.status_code == 422
