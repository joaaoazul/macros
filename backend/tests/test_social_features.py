"""Ronda 6: reações no feed, toques (nudges), badges, reações/fotos em mensagens
e o centro de notificações in-app."""

from datetime import date, timedelta

import pytest

import app.social.router as social_router
import app.social.service as social_service
from tests.test_messages import make_friends, switch
from tests.test_social import make_social_user

pytestmark = pytest.mark.asyncio

TODAY = date(2026, 7, 8)

PROFILE = {
    "name": "Ana",
    "sex": "F",
    "age": 30,
    "heightCm": 165,
    "weightKg": 60,
    "activity": 1.375,
    "goal": "maintain",
    "targets": {"kcal": 2000, "protein": 108, "carbs": 238, "fat": 56, "waterMl": 2000},
}


def entry(entry_id: str, kcal: float) -> dict:
    return {
        "id": entry_id, "meal": "lunch", "foodName": "Comida", "emoji": "🍽",
        "grams": 100, "unit": "g", "kcal": kcal, "protein": 10, "carbs": 10, "fat": 10,
    }


async def seed_day(client, iso: str, kcal: float = 2000):
    resp = await client.put(f"/api/v1/days/{iso}", json={"entries": [entry(f"e-{iso}", kcal)]})
    assert resp.status_code == 200, resp.text


@pytest.fixture(autouse=True)
def freeze_today(monkeypatch):
    monkeypatch.setattr(social_service, "lisbon_today", lambda: TODAY)
    monkeypatch.setattr(social_router, "lisbon_today", lambda: TODAY)


# --- notificações in-app ---


async def test_friend_request_creates_notification(client):
    ana = await make_social_user(client, "ana@example.com", "ana_fit")
    ana_cookies = dict(client.cookies)
    client.cookies.clear()
    await make_social_user(client, "rui@example.com", "rui_gains")
    await client.post("/api/v1/social/friends/requests", json={"username": "ana_fit"})

    switch(client, ana_cookies)
    assert (await client.get("/api/v1/notifications/unread-count")).json()["total"] == 1
    notes = (await client.get("/api/v1/notifications")).json()
    assert notes[0]["kind"] == "friend_request" and notes[0]["read"] is False
    assert ana["userId"]  # sanity

    # marcar lidas zera o contador
    await client.post("/api/v1/notifications/read", json={})
    assert (await client.get("/api/v1/notifications/unread-count")).json()["total"] == 0


async def test_notification_prefs_roundtrip(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    prefs = (await client.get("/api/v1/notifications/prefs")).json()
    assert prefs == {"messages": True, "friends": True, "social": True}
    resp = await client.put(
        "/api/v1/notifications/prefs", json={"messages": False, "friends": True, "social": False}
    )
    assert resp.json()["messages"] is False
    assert (await client.get("/api/v1/notifications/prefs")).json()["social"] is False


async def test_test_notification_endpoint_without_vapid(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    resp = await client.post("/api/v1/notifications/test")
    assert resp.status_code == 200
    assert resp.json() == {"pushConfigured": False, "pushed": False}
    # cria uma entrada in-app na mesma
    assert (await client.get("/api/v1/notifications")).json()[0]["kind"] == "test"


# --- reações no feed ---


async def test_feed_reactions(client):
    ana_cookies, rui_cookies, ana_id, _rui_id = await make_friends(client)

    # ana precisa de perfil + um dia no plano para gerar um evento
    switch(client, ana_cookies)
    await client.put("/api/v1/profile", json=PROFILE)
    await seed_day(client, "2026-07-08")

    # rui vê o evento da ana e reage
    switch(client, rui_cookies)
    feed = (await client.get("/api/v1/social/feed")).json()
    event = next(e for e in feed if e["kind"] == "day_on_plan")
    assert event["reactions"]["total"] == 0

    resp = await client.put(f"/api/v1/social/feed/{event['id']}/react", json={"emoji": "🔥"})
    assert resp.status_code == 200
    assert resp.json() == {"counts": {"🔥": 1}, "total": 1, "mine": "🔥"}

    # trocar a reação não duplica
    resp = await client.put(f"/api/v1/social/feed/{event['id']}/react", json={"emoji": "👏"})
    assert resp.json() == {"counts": {"👏": 1}, "total": 1, "mine": "👏"}

    # emoji não permitido → 422
    assert (await client.put(f"/api/v1/social/feed/{event['id']}/react", json={"emoji": "💩"})).status_code == 422

    # ana recebe notificação de reação
    switch(client, ana_cookies)
    kinds = [n["kind"] for n in (await client.get("/api/v1/notifications")).json()]
    assert "reaction" in kinds
    my_feed = (await client.get("/api/v1/social/feed")).json()
    assert next(e for e in my_feed if e["kind"] == "day_on_plan")["reactions"]["total"] == 1

    # remover reação
    switch(client, rui_cookies)
    resp = await client.delete(f"/api/v1/social/feed/{event['id']}/react")
    assert resp.json()["total"] == 0


async def test_cannot_react_to_stranger_event(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    await client.put("/api/v1/profile", json=PROFILE)
    await seed_day(client, "2026-07-08")
    event_id = next(
        e for e in (await client.get("/api/v1/social/feed")).json() if e["kind"] == "day_on_plan"
    )["id"]

    client.cookies.clear()
    await make_social_user(client, "x@example.com", "estranho")
    resp = await client.put(f"/api/v1/social/feed/{event_id}/react", json={"emoji": "🔥"})
    assert resp.status_code == 404


# --- toques (nudges) ---


async def test_nudge_friend_and_cooldown(client):
    ana_cookies, rui_cookies, ana_id, rui_id = await make_friends(client)

    switch(client, ana_cookies)
    resp = await client.post("/api/v1/social/nudge", json={"userId": rui_id, "kind": "train"})
    assert resp.status_code == 201

    # cooldown: segundo toque imediato → 409
    resp = await client.post("/api/v1/social/nudge", json={"userId": rui_id, "kind": "water"})
    assert resp.status_code == 409

    # rui recebeu a notificação
    switch(client, rui_cookies)
    kinds = [n["kind"] for n in (await client.get("/api/v1/notifications")).json()]
    assert "nudge" in kinds


async def test_nudge_requires_friendship(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    ana_cookies = dict(client.cookies)
    client.cookies.clear()
    rui = await make_social_user(client, "rui@example.com", "rui_gains")

    switch(client, ana_cookies)
    resp = await client.post("/api/v1/social/nudge", json={"userId": rui["userId"], "kind": "cheer"})
    assert resp.status_code == 403


# --- badges ---


async def test_badges_awarded_on_streak(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    await client.put("/api/v1/profile", json=PROFILE)
    for i in range(7):
        await seed_day(client, (TODAY - timedelta(days=6 - i)).isoformat())

    me = (await client.get("/api/v1/social/me")).json()
    assert "streak_7" in me["badges"]

    # catálogo disponível
    catalog = (await client.get("/api/v1/social/badges/catalog")).json()
    assert any(b["kind"] == "streak_7" and b["emoji"] for b in catalog)

    # aparece como evento no feed
    feed_kinds = [e["kind"] for e in (await client.get("/api/v1/social/feed")).json()]
    assert "badge_streak_7" in feed_kinds


# --- mensagens: reações + fotos ---


async def test_message_reactions(client):
    ana_cookies, rui_cookies, ana_id, rui_id = await make_friends(client)

    switch(client, ana_cookies)
    msg = (await client.post(f"/api/v1/messages/with/{rui_id}", json={"body": "olá!"})).json()

    switch(client, rui_cookies)
    resp = await client.put(f"/api/v1/messages/{msg['id']}/react", json={"emoji": "❤️"})
    assert resp.status_code == 204

    hist = (await client.get(f"/api/v1/messages/with/{ana_id}")).json()
    reacted = next(m for m in hist if m["id"] == msg["id"])
    assert reacted["reactions"] == [{"userId": rui_id, "emoji": "❤️"}]

    # emoji inválido → 422; estranho não pode reagir → 404
    assert (await client.put(f"/api/v1/messages/{msg['id']}/react", json={"emoji": "🚀"})).status_code == 422

    # remover reação
    assert (await client.delete(f"/api/v1/messages/{msg['id']}/react")).status_code == 204
    hist = (await client.get(f"/api/v1/messages/with/{ana_id}")).json()
    assert next(m for m in hist if m["id"] == msg["id"])["reactions"] == []


async def test_photo_message(client):
    ana_cookies, rui_cookies, ana_id, rui_id = await make_friends(client)

    switch(client, ana_cookies)
    resp = await client.post(
        f"/api/v1/messages/with/{rui_id}", json={"body": "", "image": "ABC123base64=="}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["image"] == "ABC123base64==" and body["body"] == ""

    # mensagem totalmente vazia → 422
    resp = await client.post(f"/api/v1/messages/with/{rui_id}", json={"body": "  ", "image": None})
    assert resp.status_code == 422
