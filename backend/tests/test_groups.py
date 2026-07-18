"""Grupos: criação, fan-out de unread por cursor, permissões, sair/expulsar."""

import pytest

from tests.test_messages import switch
from tests.test_social import make_social_user

pytestmark = pytest.mark.asyncio


async def _friend(client, a_cookies, b_cookies, a_username):
    """B pede amizade a A (a_username) e A aceita."""
    switch(client, b_cookies)
    resp = await client.post("/api/v1/social/friends/requests", json={"username": a_username})
    fid = resp.json()["id"]
    switch(client, a_cookies)
    await client.post(f"/api/v1/social/friends/requests/{fid}/accept")


async def make_trio(client):
    """ana (dona) amiga de rui e zed. rui e zed NÃO são amigos entre si."""
    ana = await make_social_user(client, "ana@example.com", "ana_fit")
    ana_c = dict(client.cookies)
    client.cookies.clear()
    rui = await make_social_user(client, "rui@example.com", "rui_gains")
    rui_c = dict(client.cookies)
    client.cookies.clear()
    zed = await make_social_user(client, "zed@example.com", "zed_lifts")
    zed_c = dict(client.cookies)

    await _friend(client, ana_c, rui_c, "ana_fit")
    await _friend(client, ana_c, zed_c, "ana_fit")
    return (ana_c, rui_c, zed_c, ana["userId"], rui["userId"], zed["userId"])


async def test_create_group_and_unread_fanout(client):
    ana_c, rui_c, zed_c, _, rui_id, zed_id = await make_trio(client)

    switch(client, ana_c)
    resp = await client.post(
        "/api/v1/messages/groups",
        json={"title": "Treino", "emoji": "💪", "memberIds": [rui_id, zed_id]},
    )
    assert resp.status_code == 201
    group = resp.json()
    assert group["type"] == "group"
    assert group["role"] == "owner"
    assert len(group["members"]) == 3
    gid = group["id"]

    # ana envia; rui e zed ficam com 1 por ler, ana com 0
    await client.post(f"/api/v1/messages/conversations/{gid}/messages", json={"body": "bora!"})
    assert (await client.get("/api/v1/messages/unread-count")).json()["total"] == 0

    switch(client, rui_c)
    assert (await client.get("/api/v1/messages/unread-count")).json()["total"] == 1
    convs = (await client.get("/api/v1/messages/conversations")).json()
    grp = next(c for c in convs if c["id"] == gid)
    assert grp["unread"] == 1 and grp["title"] == "Treino"

    # rui lê → volta a 0
    await client.post(f"/api/v1/messages/conversations/{gid}/read")
    assert (await client.get("/api/v1/messages/unread-count")).json()["total"] == 0

    switch(client, zed_c)
    assert (await client.get("/api/v1/messages/unread-count")).json()["total"] == 1


async def test_group_members_must_be_friends(client):
    ana_c, _, _, _, _, _ = await make_trio(client)
    client.cookies.clear()
    stranger = await make_social_user(client, "x@example.com", "stranger")
    switch(client, ana_c)
    resp = await client.post(
        "/api/v1/messages/groups",
        json={"title": "X", "emoji": "👥", "memberIds": [stranger["userId"]]},
    )
    assert resp.status_code == 403


async def test_only_owner_manages_and_non_member_forbidden(client):
    ana_c, rui_c, zed_c, _, rui_id, zed_id = await make_trio(client)
    switch(client, ana_c)
    gid = (
        await client.post(
            "/api/v1/messages/groups",
            json={"title": "Treino", "emoji": "💪", "memberIds": [rui_id]},
        )
    ).json()["id"]

    # rui (membro, não dono) não pode renomear
    switch(client, rui_c)
    assert (await client.patch(f"/api/v1/messages/groups/{gid}", json={"title": "Novo"})).status_code == 403

    # zed (não-membro) não vê o histórico
    switch(client, zed_c)
    assert (await client.get(f"/api/v1/messages/conversations/{gid}/messages")).status_code == 404

    # dono adiciona zed (é seu amigo), depois zed já entra
    switch(client, ana_c)
    resp = await client.post(f"/api/v1/messages/groups/{gid}/members", json={"memberIds": [zed_id]})
    assert resp.status_code == 200
    switch(client, zed_c)
    assert (await client.get(f"/api/v1/messages/conversations/{gid}/messages")).status_code == 200


async def test_group_challenge_is_aggregate_only(client):
    """O desafio mostra o total do grupo e o MEU número — nunca o dos outros.

    Membros de um grupo não são forçosamente amigos entre si, e dias no plano é
    um dado derivado: expor por pessoa seria a mesma fuga que o perfil tinha.
    """
    ana_c, rui_c, _, _, rui_id, zed_id = await make_trio(client)

    switch(client, ana_c)
    gid = (
        await client.post(
            "/api/v1/messages/groups",
            json={"title": "Treino", "emoji": "💪", "memberIds": [rui_id, zed_id]},
        )
    ).json()["id"]

    # sem desafio ainda
    assert (await client.get(f"/api/v1/messages/groups/{gid}/challenge")).json() is None

    resp = await client.post(
        f"/api/v1/messages/groups/{gid}/challenge", json={"target": 5, "days": 7}
    )
    assert resp.status_code == 201
    ch = resp.json()
    assert ch["participants"] == 3
    assert ch["groupTarget"] == 15  # 5 por pessoa × 3
    assert ch["groupProgress"] == 0 and ch["myProgress"] == 0 and ch["done"] is False
    # o payload não pode trazer detalhe por pessoa
    assert "members" not in ch and "perUser" not in ch

    # um membro qualquer vê o desafio
    switch(client, rui_c)
    seen = (await client.get(f"/api/v1/messages/groups/{gid}/challenge")).json()
    assert seen["id"] == ch["id"] and seen["myProgress"] == 0

    # mas não o pode criar nem apagar
    assert (
        await client.post(f"/api/v1/messages/groups/{gid}/challenge", json={"target": 3, "days": 7})
    ).status_code == 403
    assert (await client.delete(f"/api/v1/messages/groups/{gid}/challenge")).status_code == 403

    # alvo maior que a duração não faz sentido
    switch(client, ana_c)
    assert (
        await client.post(f"/api/v1/messages/groups/{gid}/challenge", json={"target": 9, "days": 7})
    ).status_code == 422
    assert (await client.delete(f"/api/v1/messages/groups/{gid}/challenge")).status_code == 204


async def test_challenge_hidden_from_non_members(client):
    ana_c, _, _, _, rui_id, _ = await make_trio(client)
    switch(client, ana_c)
    gid = (
        await client.post(
            "/api/v1/messages/groups",
            json={"title": "Treino", "emoji": "💪", "memberIds": [rui_id]},
        )
    ).json()["id"]
    await client.post(f"/api/v1/messages/groups/{gid}/challenge", json={"target": 3, "days": 7})

    client.cookies.clear()
    await make_social_user(client, "outro@example.com", "outro")
    assert (await client.get(f"/api/v1/messages/groups/{gid}/challenge")).status_code == 404


async def test_leave_promotes_oldest_owner(client):
    ana_c, rui_c, _, ana_id, rui_id, zed_id = await make_trio(client)
    switch(client, ana_c)
    gid = (
        await client.post(
            "/api/v1/messages/groups",
            json={"title": "Treino", "emoji": "💪", "memberIds": [rui_id, zed_id]},
        )
    ).json()["id"]

    # dona sai → rui (membro mais antigo) é promovido a dono
    assert (await client.delete(f"/api/v1/messages/groups/{gid}/members/{ana_id}")).status_code == 204

    switch(client, rui_c)
    convs = (await client.get("/api/v1/messages/conversations")).json()
    grp = next(c for c in convs if c["id"] == gid)
    assert grp["role"] == "owner"
