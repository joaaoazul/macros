"""Social tests: username, pesquisa, ciclo de amizade, privacidade do perfil."""

import pytest

from tests.conftest import register_user

pytestmark = pytest.mark.asyncio


async def make_social_user(client, email, username, name="User"):
    await register_user(client, email=email, password="password-forte-123", name=name)
    resp = await client.put("/api/v1/social/me", json={"username": username, "avatar": "🦁"})
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_social_me_starts_without_username(client):
    await register_user(client)
    resp = await client.get("/api/v1/social/me")
    assert resp.status_code == 200
    assert resp.json()["username"] is None


async def test_username_validation_and_uniqueness(client):
    await make_social_user(client, "ana@example.com", "ana_fit")

    # inválido (maiúsculas/curto)
    for bad in ["AB", "Nome Maiúsculo", "a"]:
        resp = await client.put("/api/v1/social/me", json={"username": bad, "avatar": "🙂"})
        assert resp.status_code == 422, bad

    # segunda conta não pode usar o mesmo username
    client.cookies.clear()
    await register_user(client, email="rui@example.com")
    resp = await client.put("/api/v1/social/me", json={"username": "ana_fit", "avatar": "🙂"})
    assert resp.status_code == 409


async def test_search_excludes_self_and_no_username(client):
    await make_social_user(client, "ana@example.com", "ana_fit", name="Ana")
    client.cookies.clear()
    await register_user(client, email="semnome@example.com")  # sem username

    client.cookies.clear()
    await make_social_user(client, "rui@example.com", "ana_rui")
    resp = await client.get("/api/v1/social/search?q=ana")
    assert resp.status_code == 200
    usernames = [r["username"] for r in resp.json()]
    assert "ana_fit" in usernames
    assert "ana_rui" not in usernames  # o próprio nunca aparece
    assert len(usernames) == 1  # o user sem username é invisível


async def test_friendship_lifecycle(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    ana_cookies = dict(client.cookies)
    client.cookies.clear()
    await make_social_user(client, "rui@example.com", "rui_gains")

    # rui não pode adicionar-se a si próprio
    resp = await client.post("/api/v1/social/friends/requests", json={"username": "rui_gains"})
    assert resp.status_code == 422

    # rui → ana: pedido
    resp = await client.post("/api/v1/social/friends/requests", json={"username": "ana_fit"})
    assert resp.status_code == 201
    fid = resp.json()["id"]

    # duplicado
    resp = await client.post("/api/v1/social/friends/requests", json={"username": "ana_fit"})
    assert resp.status_code == 409

    # ana vê o pedido e aceita
    rui_cookies = dict(client.cookies)
    client.cookies.clear()
    for k, v in ana_cookies.items():
        client.cookies.set(k, v)
    resp = await client.get("/api/v1/social/friends")
    assert resp.json()["incoming"][0]["user"]["username"] == "rui_gains"
    resp = await client.post(f"/api/v1/social/friends/requests/{fid}/accept")
    assert resp.status_code == 200

    # feed tem friend_joined
    resp = await client.get("/api/v1/social/feed")
    kinds = [e["kind"] for e in resp.json()]
    assert "friend_joined" in kinds

    # remover amizade
    client.cookies.clear()
    for k, v in rui_cookies.items():
        client.cookies.set(k, v)
    friends = (await client.get("/api/v1/social/friends")).json()["friends"]
    other_id = friends[0]["user"]["userId"]
    resp = await client.delete(f"/api/v1/social/friends/{other_id}")
    assert resp.status_code == 204
    assert (await client.get("/api/v1/social/friends")).json()["friends"] == []


async def test_reverse_pending_auto_accepts(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    ana_cookies = dict(client.cookies)
    client.cookies.clear()
    await make_social_user(client, "rui@example.com", "rui_gains")
    await client.post("/api/v1/social/friends/requests", json={"username": "ana_fit"})

    client.cookies.clear()
    for k, v in ana_cookies.items():
        client.cookies.set(k, v)
    resp = await client.post("/api/v1/social/friends/requests", json={"username": "rui_gains"})
    assert resp.status_code == 201
    assert resp.json()["status"] == "accepted"


async def test_update_profile_photo_and_bio(client):
    await register_user(client)
    resp = await client.put(
        "/api/v1/social/me",
        json={
            "username": "ana_fit",
            "avatar": "🦁",
            "avatarPhoto": "data:image/jpeg;base64,aGVsbG8=",
            "bio": "  Amo treinar 💪  ",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["avatarPhoto"] == "aGVsbG8="  # prefixo data: removido
    assert body["bio"] == "Amo treinar 💪"  # strip


async def test_bio_too_long_rejected(client):
    await register_user(client)
    resp = await client.put(
        "/api/v1/social/me",
        json={"username": "ana_fit", "avatar": "🙂", "bio": "x" * 301},
    )
    assert resp.status_code == 422


async def test_photo_too_large_rejected(client):
    await register_user(client)
    resp = await client.put(
        "/api/v1/social/me",
        json={"username": "ana_fit", "avatar": "🙂", "avatarPhoto": "a" * 400_001},
    )
    assert resp.status_code == 422


async def test_friend_sees_photo_and_bio(client):
    # ana define foto+bio; bruno adiciona-a e vê o perfil dela
    await make_social_user(client, "ana@example.com", "ana_fit")
    await client.put(
        "/api/v1/social/me",
        json={"username": "ana_fit", "avatar": "🦁", "avatarPhoto": "aGVsbG8=", "bio": "olá"},
    )
    await client.post("/api/v1/auth/logout")

    await make_social_user(client, "bruno@example.com", "bruno_fit")
    resp = await client.get("/api/v1/social/users/ana_fit")
    assert resp.status_code == 200
    body = resp.json()
    assert body["avatarPhoto"] == "aGVsbG8="
    assert body["bio"] == "olá"


async def test_public_profile_hides_raw_nutrition_data(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    resp = await client.get("/api/v1/social/users/ana_fit")
    assert resp.status_code == 200
    body = resp.json()
    text = str(body).lower()
    for forbidden in ["kcal", "weight", "peso", "diary", "protein"]:
        assert forbidden not in text, f"perfil público expõe '{forbidden}'"
    assert body["stats"] == {"streak": 0, "daysOnPlan7d": 0}
    assert body["friendship"] == "self"
