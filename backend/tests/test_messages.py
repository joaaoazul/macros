"""Mensagens: fronteiras de auth/amizade, paginação, unread, read receipts."""

import pytest

from tests.test_social import make_social_user

pytestmark = pytest.mark.asyncio


async def make_friends(client):
    """Cria ana + rui como amigos. Devolve (ana_cookies, rui_cookies, ana_id, rui_id)."""
    ana = await make_social_user(client, "ana@example.com", "ana_fit")
    ana_cookies = dict(client.cookies)
    client.cookies.clear()
    rui = await make_social_user(client, "rui@example.com", "rui_gains")
    resp = await client.post("/api/v1/social/friends/requests", json={"username": "ana_fit"})
    fid = resp.json()["id"]
    rui_cookies = dict(client.cookies)

    client.cookies.clear()
    for k, v in ana_cookies.items():
        client.cookies.set(k, v)
    await client.post(f"/api/v1/social/friends/requests/{fid}/accept")
    return ana_cookies, rui_cookies, ana["userId"], rui["userId"]


def switch(client, cookies):
    client.cookies.clear()
    for k, v in cookies.items():
        client.cookies.set(k, v)


async def test_send_requires_friendship(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    ana_cookies = dict(client.cookies)
    client.cookies.clear()
    rui = await make_social_user(client, "rui@example.com", "rui_gains")

    switch(client, ana_cookies)
    resp = await client.post(f"/api/v1/messages/with/{rui['userId']}", json={"body": "olá!"})
    assert resp.status_code == 403


async def test_message_flow_unread_and_read_receipts(client):
    ana_cookies, rui_cookies, ana_id, rui_id = await make_friends(client)

    # ana → rui
    switch(client, ana_cookies)
    resp = await client.post(f"/api/v1/messages/with/{rui_id}", json={"body": "olá rui!"})
    assert resp.status_code == 201
    resp = await client.post(f"/api/v1/messages/with/{rui_id}", json={"body": "treinas hoje?"})
    assert resp.status_code == 201

    # rui vê 2 por ler
    switch(client, rui_cookies)
    assert (await client.get("/api/v1/messages/unread-count")).json()["total"] == 2
    convs = (await client.get("/api/v1/messages/conversations")).json()
    assert convs[0]["unread"] == 2
    assert convs[0]["lastMessage"]["body"] == "treinas hoje?"

    # histórico paginado (newest-first)
    hist = (await client.get(f"/api/v1/messages/with/{ana_id}?limit=1")).json()
    assert len(hist) == 1 and hist[0]["body"] == "treinas hoje?"
    older = (await client.get(f"/api/v1/messages/with/{ana_id}?before={hist[0]['id']}")).json()
    assert older[0]["body"] == "olá rui!"

    # marcar como lido
    resp = await client.post(f"/api/v1/messages/with/{ana_id}/read")
    assert resp.status_code == 204
    assert (await client.get("/api/v1/messages/unread-count")).json()["total"] == 0

    # do lado da ana, as mensagens aparecem com readAt preenchido
    switch(client, ana_cookies)
    hist = (await client.get(f"/api/v1/messages/with/{rui_id}")).json()
    assert all(m["readAt"] is not None for m in hist if m["senderId"] == ana_id)


async def test_message_validation(client):
    _, rui_cookies, ana_id, _ = await make_friends(client)
    switch(client, rui_cookies)

    resp = await client.post(f"/api/v1/messages/with/{ana_id}", json={"body": "   "})
    assert resp.status_code == 422
    resp = await client.post(f"/api/v1/messages/with/{ana_id}", json={"body": "x" * 2001})
    assert resp.status_code == 422


async def test_removed_friend_blocks_send_keeps_history(client):
    ana_cookies, rui_cookies, ana_id, rui_id = await make_friends(client)

    switch(client, ana_cookies)
    await client.post(f"/api/v1/messages/with/{rui_id}", json={"body": "olá!"})
    await client.delete(f"/api/v1/social/friends/{rui_id}")

    # envio bloqueado nos dois sentidos
    resp = await client.post(f"/api/v1/messages/with/{rui_id}", json={"body": "ainda aí?"})
    assert resp.status_code == 403
    switch(client, rui_cookies)
    resp = await client.post(f"/api/v1/messages/with/{ana_id}", json={"body": "?"})
    assert resp.status_code == 403

    # histórico continua legível
    hist = (await client.get(f"/api/v1/messages/with/{ana_id}")).json()
    assert len(hist) == 1
