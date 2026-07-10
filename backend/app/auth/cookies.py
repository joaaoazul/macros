"""httpOnly auth cookie helpers."""

from fastapi import Response

from app.config import settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
_REFRESH_PATH = "/api/v1/auth/refresh"


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        max_age=settings.JWT_ACCESS_EXPIRE_MINUTES * 60,
        path="/api",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        max_age=settings.JWT_REFRESH_EXPIRE_DAYS * 86400,
        path=_REFRESH_PATH,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/api")
    response.delete_cookie(REFRESH_COOKIE, path=_REFRESH_PATH)
