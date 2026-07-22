"""Auth request/response schemas."""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)
    name: str = Field(default="", max_length=120)
    # Código de convite opcional — válido dá conta comped (grátis); vazio dá trial normal.
    invite_code: str | None = Field(default=None, max_length=24)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    email_verified: bool
    is_admin: bool = False

    model_config = {"from_attributes": True}


class TokenBody(BaseModel):
    token: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=256)


class MessageOut(BaseModel):
    message: str
