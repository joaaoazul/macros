"""Scraper de alimentos: parsing JSON-LD, fallback og:title, SSRF, endpoint."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.net import safe_outbound_url
from app.scraper.parser import parse
from tests.test_social import make_social_user

pytestmark = pytest.mark.asyncio

RECIPE_HTML = """
<html><head>
<script type="application/ld+json">
{"@type":"Recipe","name":"Panquecas de Aveia",
 "nutrition":{"@type":"NutritionInformation","calories":"250 kcal",
   "proteinContent":"12 g","carbohydrateContent":"30 g","fatContent":"8 g",
   "servingSize":"100 g"}}
</script></head><body>...</body></html>
"""

PRODUCT_HTML = """
<html><head>
<script type="application/ld+json">
{"@graph":[{"@type":"Product","name":"Barrinha Proteica","brand":{"name":"FitCo"},
 "nutrition":{"@type":"NutritionInformation","calories":"180 kcal","proteinContent":"20 g"}}]}
</script></head><body></body></html>
"""

TITLE_ONLY_HTML = '<html><head><meta property="og:title" content="Bolo de Cenoura"></head></html>'

RECIPE_WITH_INGREDIENTS_HTML = """
<html><head>
<script type="application/ld+json">
{"@type":"Recipe","name":"Massa à Bolonhesa","recipeYield":"4 doses",
 "recipeIngredient":["400 g de massa","500 g de carne picada","2 cebolas","",100],
 "nutrition":{"@type":"NutritionInformation","calories":"620 kcal","proteinContent":"35 g"}}
</script></head><body></body></html>
"""


def test_parse_recipe_with_ingredients():
    r = parse(RECIPE_WITH_INGREDIENTS_HTML)
    assert r["source"] == "recipe"
    assert r["food"] is None
    rec = r["recipe"]
    assert rec["name"] == "Massa à Bolonhesa"
    assert rec["servings"] == 4
    # linhas vazias/não-string são descartadas, não silenciosamente convertidas
    assert rec["ingredients"] == ["400 g de massa", "500 g de carne picada", "2 cebolas"]
    assert rec["nutritionPerServing"]["kcal"] == 620


def test_parse_recipe_scales_to_per_100g():
    r = parse(RECIPE_HTML)
    assert r["source"] == "recipe"
    f = r["food"]
    assert f["name"] == "Panquecas de Aveia"
    # 100g de dose → por 100g é igual
    assert f["kcal"] == 250 and f["protein"] == 12 and f["carbs"] == 30
    assert f["portions"] == [{"label": "dose", "grams": 100.0}]


def test_parse_product_with_brand():
    r = parse(PRODUCT_HTML)
    assert r["source"] == "product"
    assert r["food"]["name"] == "Barrinha Proteica"
    assert r["food"]["brand"] == "FitCo"
    assert r["food"]["protein"] == 20


def test_parse_title_fallback():
    r = parse(TITLE_ONLY_HTML)
    assert r["source"] == "title"
    assert r["food"]["name"] == "Bolo de Cenoura"
    assert r["food"]["kcal"] == 0  # utilizador preenche à mão


def test_parse_none_when_empty():
    assert parse("<html></html>")["source"] == "none"


def test_ssrf_blocks_private_and_scheme():
    assert safe_outbound_url("ftp://x/y", ("http", "https")) is None
    with patch("app.net.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 80))]):
        assert safe_outbound_url("http://evil.local/x", ("http", "https")) is None
    with patch("app.net.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 443))]):
        assert safe_outbound_url("https://example.com/x", ("http", "https")) == "https://example.com/x"


async def _aiter(data: bytes, chunk: int = 4096):
    for i in range(0, len(data), chunk):
        yield data[i : i + chunk]


class _FakeStream:
    """Context manager devolvido por client.stream('GET', url)."""

    def __init__(self, resp):
        self._resp = resp

    async def __aenter__(self):
        return self._resp

    async def __aexit__(self, *_):
        return False


class _FakeStreamInfo:
    """Simula resp.extensions['network_stream'] com o peer realmente ligado."""

    def __init__(self, peer_ip: str):
        self._peer = (peer_ip, 443)

    def get_extra_info(self, name: str):
        return self._peer if name == "server_addr" else None


def _fake_client(html: str, headers: dict | None = None, peer_ip: str = "93.184.216.34"):
    resp = SimpleNamespace(
        is_redirect=False,
        encoding="utf-8",
        headers=headers if headers is not None else {"content-type": "text/html"},
        extensions={"network_stream": _FakeStreamInfo(peer_ip)},
        raise_for_status=lambda: None,
        aiter_bytes=lambda: _aiter(html.encode()),
    )
    client = AsyncMock()
    client.stream = lambda method, url: _FakeStream(resp)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    return client


async def test_scrape_endpoint_returns_food(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    with patch("app.scraper.router.safe_outbound_url", side_effect=lambda u, s=("https",): u), patch(
        "app.scraper.router.httpx.AsyncClient", return_value=_fake_client(RECIPE_HTML)
    ):
        resp = await client.post("/api/v1/foods/scrape", json={"url": "https://recipes.example.com/x"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "recipe"
    assert body["food"]["name"] == "Panquecas de Aveia"
    assert body["food"]["id"].startswith("scraped-")
    assert body["recipe"] is None  # esta página não tem lista de ingredientes


async def test_scrape_endpoint_returns_recipe(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    with patch("app.scraper.router.safe_outbound_url", side_effect=lambda u, s=("https",): u), patch(
        "app.scraper.router.httpx.AsyncClient",
        return_value=_fake_client(RECIPE_WITH_INGREDIENTS_HTML),
    ):
        resp = await client.post("/api/v1/foods/scrape", json={"url": "https://recipes.example.com/x"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "recipe"
    assert body["food"] is None
    assert body["recipe"]["name"] == "Massa à Bolonhesa"
    assert body["recipe"]["servings"] == 4
    assert len(body["recipe"]["ingredients"]) == 3


async def test_scrape_blocks_dns_rebinding(client):
    """O host passa na validação de DNS mas a ligação acaba num IP interno."""
    await make_social_user(client, "ana@example.com", "ana_fit")
    for internal in ("127.0.0.1", "10.0.0.5", "169.254.169.254", "::ffff:127.0.0.1"):
        with patch(
            "app.scraper.router.safe_outbound_url", side_effect=lambda u, s=("https",): u
        ), patch(
            "app.scraper.router.httpx.AsyncClient",
            return_value=_fake_client(RECIPE_HTML, peer_ip=internal),
        ):
            resp = await client.post(
                "/api/v1/foods/scrape", json={"url": "https://rebind.example.com/x"}
            )
        assert resp.status_code == 422, f"peer {internal} devia ser recusado"


async def test_scrape_fails_closed_without_peer_info(client):
    """Sem network_stream não dá para validar o destino → recusa."""
    await make_social_user(client, "ana@example.com", "ana_fit")
    fake = _fake_client(RECIPE_HTML)
    with patch("app.scraper.router.safe_outbound_url", side_effect=lambda u, s=("https",): u), patch(
        "app.scraper.router.httpx.AsyncClient", return_value=fake
    ):
        # remove a info do peer que o httpx normalmente fornece
        fake.stream("GET", "x")._resp.extensions = {}
        resp = await client.post("/api/v1/foods/scrape", json={"url": "https://x.example.com/x"})
    assert resp.status_code == 422


async def test_scrape_aborts_oversized_body(client):
    """Regressão: com client.get() o corpo era lido todo p/ memória antes do limite."""
    await make_social_user(client, "ana@example.com", "ana_fit")
    huge = "<html>" + ("x" * (3 * 1024 * 1024)) + "</html>"  # 3 MB > cap de 2 MB
    with patch("app.scraper.router.safe_outbound_url", side_effect=lambda u, s=("https",): u), patch(
        "app.scraper.router.httpx.AsyncClient", return_value=_fake_client(huge)
    ):
        resp = await client.post("/api/v1/foods/scrape", json={"url": "https://big.example.com/x"})
    assert resp.status_code == 422
    assert "grande" in resp.text.lower()


async def test_scrape_rejects_declared_oversize_and_non_html(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    # content-length declarado acima do cap → rejeita antes de ler o corpo
    with patch("app.scraper.router.safe_outbound_url", side_effect=lambda u, s=("https",): u), patch(
        "app.scraper.router.httpx.AsyncClient",
        return_value=_fake_client("<html></html>", {"content-type": "text/html", "content-length": str(9 * 1024 * 1024)}),
    ):
        resp = await client.post("/api/v1/foods/scrape", json={"url": "https://big.example.com/x"})
    assert resp.status_code == 422

    # binário/vídeo → nem vale a pena descarregar
    with patch("app.scraper.router.safe_outbound_url", side_effect=lambda u, s=("https",): u), patch(
        "app.scraper.router.httpx.AsyncClient",
        return_value=_fake_client("...", {"content-type": "video/mp4"}),
    ):
        resp = await client.post("/api/v1/foods/scrape", json={"url": "https://vid.example.com/x"})
    assert resp.status_code == 422


async def test_scrape_endpoint_rejects_unsafe_url(client):
    await make_social_user(client, "ana@example.com", "ana_fit")
    resp = await client.post("/api/v1/foods/scrape", json={"url": "http://127.0.0.1/x"})
    assert resp.status_code in (400, 422)


async def test_scrape_requires_auth(client):
    resp = await client.post("/api/v1/foods/scrape", json={"url": "https://example.com/x"})
    assert resp.status_code == 401
