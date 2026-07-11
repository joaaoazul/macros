"""Macros API — FastAPI application factory."""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.ai.router import router as ai_router
from app.auth.router import router as auth_router
from app.config import settings
from app.data.router import router as data_router
from app.gdpr.router import router as gdpr_router
from app.messages.router import router as messages_router
from app.messages.ws import router as ws_router
from app.social.router import router as social_router

logging.basicConfig(level=settings.LOG_LEVEL)

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


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}
