"""Macros API — FastAPI application factory."""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.admin.router import router as admin_router
from app.ai.router import router as ai_router
from app.auth.router import router as auth_router
from app.config import settings
from app.data.router import router as data_router
from app.gdpr.router import router as gdpr_router
from app.messages.router import router as messages_router
from app.messages.ws import router as ws_router
from app.notifications.router import router as notifications_router
from app.push.router import router as push_router
from app.reminders.router import router as reminders_router
from app.scraper.router import router as scraper_router
from app.social.router import router as social_router

logging.basicConfig(level=settings.LOG_LEVEL)

# Fail-fast: recusa arrancar em produção (cookies seguros) com o JWT_SECRET default.
_DEFAULT_JWT_SECRET = "macros-super-secret-key-change-in-production"
if settings.COOKIE_SECURE and settings.JWT_SECRET == _DEFAULT_JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET está no valor default em produção — define JWT_SECRET no ambiente."
    )

app = FastAPI(
    title="Macros API",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    openapi_url="/api/openapi.json" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-Requested-With", "Authorization"],
)

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@app.middleware("http")
async def ip_blocklist_guard(request: Request, call_next):
    """Rejeita (403) IPs na blocklist. Check O(1) em set in-memory."""
    if request.url.path.startswith("/api/"):
        from app.admin.service import is_blocked
        from app.net import client_ip

        if is_blocked(client_ip(request)):
            return JSONResponse({"detail": "IP bloqueado."}, status_code=403)
    return await call_next(request)


@app.on_event("startup")
async def _load_blocklist_on_startup() -> None:
    from app.admin.service import load_blocklist
    from app.database import async_session_factory

    try:
        async with async_session_factory() as db:
            await load_blocklist(db)
    except Exception:
        logging.getLogger(__name__).warning("não foi possível carregar a blocklist", exc_info=True)


@app.middleware("http")
async def csrf_header_guard(request: Request, call_next):
    """CSRF belt-and-braces: state-changing requests must carry X-Requested-With.

    Custom headers cannot be attached cross-origin without a CORS preflight,
    and CORS is locked to our origins — so this blocks classic form/img CSRF.
    """
    if (
        request.method not in _SAFE_METHODS
        and request.url.path.startswith("/api/")
        and request.headers.get("X-Requested-With") != "fetch"
    ):
        return JSONResponse({"detail": "Missing X-Requested-With header"}, status_code=403)
    return await call_next(request)


app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(data_router)
app.include_router(gdpr_router)
app.include_router(social_router)
app.include_router(messages_router)
app.include_router(ws_router)
app.include_router(push_router)
app.include_router(reminders_router)
app.include_router(scraper_router)
app.include_router(notifications_router)
app.include_router(admin_router)


@app.on_event("startup")
async def _start_reminder_scheduler() -> None:
    """Arranca o loop de fundo que envia lembretes push (single-worker)."""
    import asyncio

    from app.database import async_session_factory
    from app.reminders.service import run_scheduler

    app.state.reminder_task = asyncio.create_task(run_scheduler(async_session_factory))


@app.on_event("shutdown")
async def _stop_reminder_scheduler() -> None:
    task = getattr(app.state, "reminder_task", None)
    if task:
        task.cancel()


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}
