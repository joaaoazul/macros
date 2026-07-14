"""WebSocket: handshake auth, envio em tempo real, erros. Usa o TestClient síncrono."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.testclient import TestClient

# Estes testes usam o TestClient síncrono do Starlette (o httpx ASGITransport não faz WS).
# Para partilhar a base de dados com os pedidos HTTP do mesmo TestClient, usamos um
# ficheiro SQLite temporário e um override sync-friendly do get_db.

from app.database import get_db
from app.main import app
from app.models_base import Base


@pytest.fixture()
def ws_client(tmp_path, monkeypatch):
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.auth.rate_limit import _RateLimiter
    from app.config import settings

    monkeypatch.setattr(settings, "COOKIE_SECURE", False)
    _RateLimiter._buckets.clear()

    db_path = tmp_path / "ws.db"
    async_engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    sync_engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(sync_engine)

    factory = async_sessionmaker(async_engine, expire_on_commit=False)

    async def override_get_db():
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    # ws.py usa async_session_factory diretamente — apontar para a mesma DB
    import app.database as database_module
    import app.messages.ws as ws_module

    monkeypatch.setattr(database_module, "async_session_factory", factory)
    monkeypatch.setattr(ws_module, "async_session_factory", factory)
    import app.messages.router as messages_router_module

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, headers={"X-Requested-With": "fetch"}) as client:
        yield client
    app.dependency_overrides.clear()


PASSWORD = "password-forte-123"


def make_user(client, email, username):
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "name": username},
    )
    assert resp.status_code == 201, resp.text
    resp = client.put("/api/v1/social/me", json={"username": username, "avatar": "🦁"})
    assert resp.status_code == 200
    user = resp.json()
    cookies = dict(client.cookies)
    client.cookies.clear()
    return user, cookies


def switch(client, cookies):
    client.cookies.clear()
    for k, v in cookies.items():
        client.cookies.set(k, v)


def befriend(client, ana_cookies, rui_cookies):
    switch(client, rui_cookies)
    fid = client.post("/api/v1/social/friends/requests", json={"username": "ana_fit"}).json()["id"]
    switch(client, ana_cookies)
    assert client.post(f"/api/v1/social/friends/requests/{fid}/accept").status_code == 200


def test_ws_rejects_unauthenticated(ws_client):
    with ws_client.websocket_connect("/api/v1/ws") as ws:
        # sem cookie: o servidor aceita e fecha com 4401
        from starlette.websockets import WebSocketDisconnect

        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 4401


def test_ws_ping_pong_and_unread_on_connect(ws_client):
    _, cookies = make_user(ws_client, "ana@example.com", "ana_fit")
    switch(ws_client, cookies)
    with ws_client.websocket_connect("/api/v1/ws") as ws:
        assert ws.receive_json() == {"type": "unread", "total": 0}
        assert ws.receive_json() == {"type": "notif_unread", "total": 0}
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong"}


def test_ws_send_delivers_to_recipient_and_echoes(ws_client):
    ana, ana_cookies = make_user(ws_client, "ana@example.com", "ana_fit")
    rui, rui_cookies = make_user(ws_client, "rui@example.com", "rui_gains")
    befriend(ws_client, ana_cookies, rui_cookies)

    switch(ws_client, ana_cookies)
    with ws_client.websocket_connect("/api/v1/ws") as ana_ws:
        ana_ws.receive_json()  # unread inicial
        ana_ws.receive_json()  # notif_unread inicial
        switch(ws_client, rui_cookies)
        with ws_client.websocket_connect("/api/v1/ws") as rui_ws:
            rui_ws.receive_json()  # unread inicial
            rui_ws.receive_json()  # notif_unread inicial

            rui_ws.send_json({"type": "send", "to": ana["userId"], "body": "olá!", "clientId": "c1"})

            # eco ao remetente com clientId
            echo = rui_ws.receive_json()
            assert echo["type"] == "message" and echo["clientId"] == "c1"
            assert echo["message"]["body"] == "olá!"

            # entrega em tempo real à ana (message + unread)
            got = [ana_ws.receive_json(), ana_ws.receive_json()]
            types = {g["type"] for g in got}
            assert types == {"message", "unread"}
            msg = next(g for g in got if g["type"] == "message")
            assert msg["message"]["senderId"] == rui["userId"]


def test_ws_send_to_non_friend_errors(ws_client):
    ana, ana_cookies = make_user(ws_client, "ana@example.com", "ana_fit")
    _, rui_cookies = make_user(ws_client, "rui@example.com", "rui_gains")

    switch(ws_client, rui_cookies)
    with ws_client.websocket_connect("/api/v1/ws") as ws:
        ws.receive_json()  # unread
        ws.receive_json()  # notif_unread
        ws.send_json({"type": "send", "to": ana["userId"], "body": "olá!", "clientId": "c9"})
        err = ws.receive_json()
        assert err == {"type": "error", "code": "not_friends", "clientId": "c9"}
