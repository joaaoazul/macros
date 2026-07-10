"""JWT and password security utilities (PBKDF2 — passlib[bcrypt] breaks on Py3.12)."""

import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings

# OWASP 2023 recommendation for PBKDF2-HMAC-SHA256
_ITERATIONS = 600_000
_HASH_ALG = "sha256"


def hash_password(plain: str) -> str:
    """Hash a plaintext password. Format: <iterations>:<salt_hex>:<dk_hex>."""
    salt = os.urandom(32)
    dk = hashlib.pbkdf2_hmac(_HASH_ALG, plain.encode(), salt, _ITERATIONS)
    return f"{_ITERATIONS}:{salt.hex()}:{dk.hex()}"


def verify_password(plain: str, hashed: str) -> bool:
    try:
        iterations_s, salt_hex, dk_hex = hashed.split(":")
        dk = hashlib.pbkdf2_hmac(_HASH_ALG, plain.encode(), bytes.fromhex(salt_hex), int(iterations_s))
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def validate_password_policy(plain: str) -> str | None:
    """Return an error message (PT) if the password is too weak, else None."""
    if len(plain) < 10:
        return "A password deve ter pelo menos 10 caracteres."
    if plain.isdigit():
        return "A password não pode ser só números."
    return None


def _base_payload() -> dict:
    return {
        "jti": str(uuid.uuid4()),
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }


def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    payload = {**_base_payload(), "sub": str(user_id), "email": email, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    payload = {**_base_payload(), "sub": str(user_id), "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises jwt.InvalidTokenError subclasses on failure."""
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
        options={"require": ["exp", "iat", "jti", "sub", "type"]},
    )


def new_email_token() -> tuple[str, str]:
    """Generate an opaque email token. Returns (plaintext, sha256_hash)."""
    raw = os.urandom(32).hex()
    return raw, hashlib.sha256(raw.encode()).hexdigest()


def hash_email_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
