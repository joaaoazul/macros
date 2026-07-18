"""Importar um alimento a partir de um link (scraper JSON-LD, guardado contra SSRF)."""

import time
from collections import defaultdict
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.data.schemas import Food
from app.exceptions import ValidationError
from app.net import safe_outbound_url
from app.scraper.parser import parse

router = APIRouter(prefix="/api/v1/foods", tags=["scraper"])

MAX_BYTES = 2 * 1024 * 1024  # 2 MB
MAX_REDIRECTS = 3
TIMEOUT_SECONDS = 8.0
_ALLOWED_SCHEMES = ("http", "https")

# rate limit por utilizador: 10 importações/min
_RATE_MAX, _RATE_WINDOW = 10, 60
_buckets: dict[int, list[float]] = defaultdict(list)


def _check_rate(user_id: int) -> bool:
    now = time.monotonic()
    bucket = [t for t in _buckets[user_id] if t > now - _RATE_WINDOW]
    if len(bucket) >= _RATE_MAX:
        _buckets[user_id] = bucket
        return False
    bucket.append(now)
    _buckets[user_id] = bucket
    return True


class ScrapeRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


class ScrapeResponse(BaseModel):
    food: Food | None = None
    source: str  # recipe | product | title | none


async def _fetch(url: str) -> str:
    """GET com redireccionamentos manuais (revalida SSRF a cada salto) e limite de tamanho."""
    current = url
    async with httpx.AsyncClient(
        timeout=TIMEOUT_SECONDS, follow_redirects=False, headers={"User-Agent": "MacrosBot/1.0"}
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            safe = safe_outbound_url(current, _ALLOWED_SCHEMES)
            if safe is None:
                raise ValidationError("URL não permitido.")
            resp = await client.get(safe)
            if resp.is_redirect:
                location = resp.headers.get("location")
                if not location:
                    break
                current = str(httpx.URL(safe).join(location))
                continue
            resp.raise_for_status()
            chunks: list[bytes] = []
            total = 0
            async for chunk in resp.aiter_bytes():
                total += len(chunk)
                if total > MAX_BYTES:
                    raise ValidationError("Página demasiado grande.")
                chunks.append(chunk)
            raw = b"".join(chunks)
            return raw.decode(resp.encoding or "utf-8", errors="replace")
    raise ValidationError("Demasiados redireccionamentos.")


@router.post("/scrape", response_model=ScrapeResponse)
async def scrape(
    body: ScrapeRequest,
    user: User = Depends(get_current_user),
) -> ScrapeResponse:
    if safe_outbound_url(body.url, _ALLOWED_SCHEMES) is None:
        raise ValidationError("Indica um link http(s) válido e público.")
    if not _check_rate(user.id):
        raise ValidationError("Demasiadas importações. Aguarda um pouco.")

    try:
        html = await _fetch(body.url)
    except ValidationError:
        raise
    except httpx.HTTPError:
        raise ValidationError("Não consegui ler essa página.")

    result = parse(html)
    food_dict = result.get("food")
    food = None
    if food_dict:
        food_dict["id"] = f"scraped-{uuid4().hex[:12]}"
        food_dict["custom"] = True
        food = Food.model_validate(food_dict)
    return ScrapeResponse(food=food, source=result.get("source", "none"))
