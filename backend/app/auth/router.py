"""Auth endpoints: register, login, refresh, logout, me, email verification, password reset."""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import write_audit_log
from app.auth.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from app.auth.dependencies import get_current_user
from app.auth.models import EmailToken, User
from app.auth.rate_limit import auth_rate_limit, forgot_rate_limit
from app.auth.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageOut,
    RegisterRequest,
    ResetPasswordRequest,
    TokenBody,
    UserOut,
)
from app.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_email_token,
    hash_password,
    new_email_token,
    validate_password_policy,
    verify_password,
)
from app.auth.token_blocklist import is_token_revoked, revoke_token
from app.config import settings
from app.database import get_db
from app.email.service import email_enabled, send_reset_email, send_verification_email
from app.exceptions import ConflictError, UnauthorizedError, ValidationError
from app.net import client_ip as _client_ip  # IP fiável via X-Real-IP (não spoofável)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _issue_session(response: Response, user: User) -> None:
    set_auth_cookies(
        response,
        create_access_token(user.id, user.email),
        create_refresh_token(user.id),
    )


async def _create_email_token(db: AsyncSession, user_id: int, purpose: str) -> str:
    raw, token_hash = new_email_token()
    db.add(
        EmailToken(
            user_id=user_id,
            token_hash=token_hash,
            purpose=purpose,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_TOKEN_EXPIRE_HOURS),
        )
    )
    return raw


async def _consume_email_token(db: AsyncSession, raw: str, purpose: str) -> EmailToken | None:
    result = await db.execute(
        select(EmailToken).where(
            EmailToken.token_hash == hash_email_token(raw),
            EmailToken.purpose == purpose,
            EmailToken.used_at.is_(None),
            EmailToken.expires_at > datetime.now(timezone.utc),
        )
    )
    token = result.scalar_one_or_none()
    if token:
        token.used_at = datetime.now(timezone.utc)
    return token


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(auth_rate_limit),
) -> User:
    if error := validate_password_policy(body.password):
        raise ValidationError(error)

    email = body.email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise ConflictError("Já existe uma conta com este email.")

    user = User(
        email=email,
        hashed_password=hash_password(body.password),
        name=body.name.strip(),
        # Without an email provider we cannot verify — auto-verify so the app is usable.
        email_verified=not email_enabled(),
    )
    db.add(user)
    await db.flush()

    if email_enabled():
        raw = await _create_email_token(db, user.id, "verify")
        await send_verification_email(user.email, raw)

    await write_audit_log(db, "register", user_id=user.id, ip=_client_ip(request))
    _issue_session(response, user)
    return user


@router.post("/login", response_model=UserOut)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(auth_rate_limit),
) -> User:
    email = body.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    ip = _client_ip(request)
    ua = request.headers.get("User-Agent", "")

    invalid = UnauthorizedError("Email ou password inválidos.")
    if not user:
        await write_audit_log(
            db, "login_failed", detail=f"unknown email {email}", ip=ip, severity="warning", user_agent=ua
        )
        await db.commit()  # persist despite the exception rollback in get_db
        raise invalid

    now = datetime.now(timezone.utc)
    if user.locked_until is not None:
        locked_until = (
            user.locked_until if user.locked_until.tzinfo else user.locked_until.replace(tzinfo=timezone.utc)
        )
        if locked_until > now:
            await write_audit_log(db, "login_locked", user_id=user.id, ip=ip, severity="warning", user_agent=ua)
            await db.commit()
            raise UnauthorizedError("Conta temporariamente bloqueada. Tenta novamente mais tarde.")

    if not verify_password(body.password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=settings.LOCKOUT_MINUTES)
            user.failed_login_attempts = 0
            await write_audit_log(db, "lockout", user_id=user.id, ip=ip, severity="critical", user_agent=ua)
        else:
            await write_audit_log(db, "login_failed", user_id=user.id, ip=ip, severity="warning", user_agent=ua)
        await db.commit()  # persist attempt counter despite the exception rollback
        raise invalid

    user.failed_login_attempts = 0
    user.locked_until = None
    severity = "warning" if user.is_admin else "info"
    action = "admin_login" if user.is_admin else "login"
    await write_audit_log(db, action, user_id=user.id, ip=ip, severity=severity, user_agent=ua)
    if user.is_admin:
        await write_audit_log(db, "login", user_id=user.id, ip=ip, user_agent=ua)  # conta p/ dashboard
    _issue_session(response, user)
    return user


@router.post("/refresh", response_model=UserOut)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> User:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise UnauthorizedError("No refresh token")

    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")
        user_id = int(str(payload["sub"]))
        jti: str = payload["jti"]
        exp: int = payload["exp"]
        iat: int = payload["iat"]
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise UnauthorizedError("Invalid or expired refresh token")

    if await is_token_revoked(jti, db):
        # Possible token reuse after rotation — invalidate all sessions defensively.
        await db.execute(
            update(User).where(User.id == user_id).values(sessions_invalidated_at=datetime.now(timezone.utc))
        )
        await write_audit_log(
            db, "refresh_reuse_detected", user_id=user_id, ip=_client_ip(request), severity="critical"
        )
        raise UnauthorizedError("Refresh token has been revoked")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedError("User not found or deactivated")

    invalidated_at = (
        user.sessions_invalidated_at
        if user.sessions_invalidated_at.tzinfo
        else user.sessions_invalidated_at.replace(tzinfo=timezone.utc)
    )
    if datetime.fromtimestamp(iat, tz=timezone.utc) < invalidated_at:
        raise UnauthorizedError("Session has been invalidated. Please log in again.")

    # Rotate: revoke the old refresh token, issue a fresh pair.
    await revoke_token(jti, user.id, datetime.fromtimestamp(exp, tz=timezone.utc), db)
    _issue_session(response, user)
    return user


@router.post("/logout", response_model=MessageOut)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOut:
    for cookie_name in ("access_token", REFRESH_COOKIE):
        token = request.cookies.get(cookie_name)
        if not token:
            continue
        try:
            payload = decode_token(token)
            await revoke_token(
                payload["jti"],
                user.id,
                datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
                db,
            )
        except (jwt.InvalidTokenError, KeyError):
            pass
    clear_auth_cookies(response)
    await write_audit_log(db, "logout", user_id=user.id, ip=_client_ip(request))
    return MessageOut(message="Sessão terminada.")


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/verify-email", response_model=MessageOut)
async def verify_email(
    body: TokenBody,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(auth_rate_limit),
) -> MessageOut:
    token = await _consume_email_token(db, body.token, "verify")
    if not token:
        raise ValidationError("Link inválido ou expirado.")
    await db.execute(update(User).where(User.id == token.user_id).values(email_verified=True))
    await write_audit_log(db, "email_verified", user_id=token.user_id)
    return MessageOut(message="Email confirmado.")


@router.post("/resend-verification", response_model=MessageOut)
async def resend_verification(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: None = Depends(forgot_rate_limit),
) -> MessageOut:
    if user.email_verified:
        return MessageOut(message="O email já está confirmado.")
    if not email_enabled():
        raise ValidationError("O envio de emails não está configurado.")
    raw = await _create_email_token(db, user.id, "verify")
    await send_verification_email(user.email, raw)
    return MessageOut(message="Email de confirmação reenviado.")


@router.post("/forgot-password", response_model=MessageOut)
async def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(forgot_rate_limit),
) -> MessageOut:
    # Always the same response — no user enumeration.
    generic = MessageOut(message="Se o email existir, enviámos instruções para repor a password.")
    if not email_enabled():
        raise ValidationError(
            "A reposição de password por email ainda não está disponível. Contacta o suporte."
        )
    result = await db.execute(
        select(User).where(User.email == body.email.lower().strip(), User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if user:
        raw = await _create_email_token(db, user.id, "reset")
        await send_reset_email(user.email, raw)
        await write_audit_log(db, "password_reset_requested", user_id=user.id, ip=_client_ip(request))
    return generic


@router.post("/reset-password", response_model=MessageOut)
async def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(auth_rate_limit),
) -> MessageOut:
    if error := validate_password_policy(body.new_password):
        raise ValidationError(error)
    token = await _consume_email_token(db, body.token, "reset")
    if not token:
        raise ValidationError("Link inválido ou expirado.")
    await db.execute(
        update(User)
        .where(User.id == token.user_id)
        .values(
            hashed_password=hash_password(body.new_password),
            sessions_invalidated_at=datetime.now(timezone.utc),
            failed_login_attempts=0,
            locked_until=None,
        )
    )
    await write_audit_log(db, "password_reset", user_id=token.user_id, ip=_client_ip(request))
    return MessageOut(message="Password alterada. Podes iniciar sessão.")
