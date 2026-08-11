"""httpOnly auth cookie helpers."""

from fastapi import Request, Response

from app.config import settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
_REFRESH_PATH = "/api/v1/auth/refresh"


def is_native_origin(request: Request) -> bool:
    """True para pedidos vindos do shell nativo (WebView do Capacitor).

    O APK serve os assets em `https://localhost`, por isso a API é cross-site
    para ele — e cookies `SameSite=lax` não seguiriam. A web continua
    same-origin e mantém o `lax`.
    """
    origin = (request.headers.get("origin") or "").rstrip("/")
    return bool(origin) and origin in settings.NATIVE_ORIGINS


def _attrs(cross_site: bool) -> dict:
    # SameSite=None só é aceite pelos browsers com Secure — daí o forçar aqui.
    if cross_site:
        return {"samesite": "none", "secure": True}
    return {"samesite": "lax", "secure": settings.COOKIE_SECURE}


def set_auth_cookies(response: Response, access: str, refresh: str, *, cross_site: bool = False) -> None:
    attrs = _attrs(cross_site)
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        max_age=settings.JWT_ACCESS_EXPIRE_MINUTES * 60,
        path="/api",
        httponly=True,
        **attrs,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        max_age=settings.JWT_REFRESH_EXPIRE_DAYS * 86400,
        path=_REFRESH_PATH,
        httponly=True,
        **attrs,
    )


def clear_auth_cookies(response: Response, *, cross_site: bool = False) -> None:
    # os atributos têm de bater certo com os do set, senão o browser não apaga
    attrs = _attrs(cross_site)
    response.delete_cookie(ACCESS_COOKIE, path="/api", httponly=True, **attrs)
    response.delete_cookie(REFRESH_COOKIE, path=_REFRESH_PATH, httponly=True, **attrs)
