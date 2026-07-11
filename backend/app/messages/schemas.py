"""Message schemas."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.social.schemas import PublicProfileLite


class MessageOut(BaseModel):
    id: int
    senderId: int
    recipientId: int
    body: str
    createdAt: datetime
    readAt: datetime | None


class SendMessage(BaseModel):
    body: str = Field(min_length=1, max_length=2000)

    @field_validator("body")
    @classmethod
    def strip_and_check(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Mensagem vazia.")
        return v


class ConversationOut(BaseModel):
    user: PublicProfileLite
    lastMessage: MessageOut | None
    unread: int


class UnreadOut(BaseModel):
    total: int
