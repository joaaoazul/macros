"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All config loaded from environment / .env file."""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://macros:macros@db:5432/macros"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://macros:macros@db:5432/macros"

    # JWT
    JWT_SECRET: str = "macros-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_EXPIRE_DAYS: int = 30

    # Brute-force protection
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 15

    # Cookies
    COOKIE_SECURE: bool = True  # set false only for plain-http local dev

    # CORS — same-origin in production (nginx proxies /api), dev server origin for local
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "https://macros.joaoazul.dev"]

    # Email (Resend). Empty API key = email features disabled:
    # registration auto-verifies, password reset returns a friendly error.
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Macros <macros@joaoazul.dev>"
    APP_URL: str = "https://macros.joaoazul.dev"
    EMAIL_TOKEN_EXPIRE_HOURS: int = 24

    # Web Push (VAPID). Chaves vazias = push desativado (subscribe devolve 503, envio é no-op).
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:joaoazul74@gmail.com"

    # Alertas SOC via ntfy. Vazio = alertas desativados.
    ALERT_NTFY_URL: str = ""

    # Stripe. Chave secreta vazia = billing DESATIVADO (billing_enabled()==False):
    # toda a gente tem acesso, para dev e self-host não ficarem trancados.
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_MONTHLY: str = ""
    STRIPE_PRICE_ANNUAL: str = ""
    # Dias de teste grátis dados a cada conta nova.
    TRIAL_DAYS: int = 14

    DEBUG: bool = False  # true enables /api/docs and /api/redoc
    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
