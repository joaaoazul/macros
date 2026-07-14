"""Message schemas."""

from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.social.schemas import PublicProfileLite

# ~300KB de foto em base64 (downscaled p/ ~1024px JPEG no cliente)
MAX_IMAGE_CHARS = 400_000

ALLOWED_MESSAGE_REACTIONS = ("❤️", "👍", "😂", "🔥", "😮", "😢")


class MessageReactionOut(BaseModel):
    userId: int
    emoji: str


class MessageOut(BaseModel):
    id: int
    senderId: int
    recipientId: int
    body: str
    image: str | None = None
    createdAt: datetime
    readAt: datetime | None
    reactions: list[MessageReactionOut] = []


class SendMessage(BaseModel):
    body: str = Field(default="", max_length=2000)
    image: str | None = Field(default=None, max_length=MAX_IMAGE_CHARS)

    @model_validator(mode="after")
    def _check(self) -> "SendMessage":
        self.body = self.body.strip()
        if self.image and self.image.startswith("data:"):
            self.image = self.image.split(",", 1)[-1]
        if not self.body and not self.image:
            raise ValueError("Mensagem vazia.")
        return self


class ReactMessage(BaseModel):
    emoji: str = Field(min_length=1, max_length=8)


class ConversationOut(BaseModel):
    user: PublicProfileLite
    lastMessage: MessageOut | None
    unread: int


class UnreadOut(BaseModel):
    total: int
