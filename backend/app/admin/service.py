"""Lógica do SOC: blocklist in-memory, geolocalização de IP e agregações de auditoria."""

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.models import IpBlocklist

logger = logging.getLogger(__name__)

# Blocklist in-memory (single-worker); recarregada no arranque e em cada alteração.
_blocked: set[str] = set()
_loaded = False


async def load_blocklist(db: AsyncSession) -> None:
    global _loaded
    rows = (await db.execute(select(IpBlocklist.ip))).scalars().all()
    _blocked.clear()
    _blocked.update(rows)
    _loaded = True


def is_blocked(ip: str) -> bool:
    return ip in _blocked


def _mark_blocked(ip: str) -> None:
    _blocked.add(ip)


def _unmark_blocked(ip: str) -> None:
    _blocked.discard(ip)


# Cache de geolocalização por IP (best-effort; ip-api.com sem chave, rate-limited).
_geo_cache: dict[str, str | None] = {}


async def geo_for_ip(ip: str) -> str | None:
    if ip in _geo_cache:
        return _geo_cache[ip]
    result: str | None = None
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            r = await client.get(f"http://ip-api.com/json/{ip}?fields=status,country,city")
            if r.status_code == 200:
                d = r.json()
                if d.get("status") == "success":
                    result = ", ".join(x for x in (d.get("city"), d.get("country")) if x) or None
    except Exception:
        result = None
    _geo_cache[ip] = result
    return result
