"""Message + conversation schemas."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.data.schemas import Food, Portion, Recipe, RecipeItem, Unit
from app.social.schemas import PublicProfileLite

# ~300KB de foto em base64 (downscaled p/ ~1024px JPEG no cliente)
MAX_IMAGE_CHARS = 400_000

ALLOWED_MESSAGE_REACTIONS = ("❤️", "👍", "😂", "🔥", "😮", "😢")


class ShareFoodPayload(BaseModel):
    """Snapshot de um alimento partilhado (sem id — é regenerado ao guardar)."""

    name: str = Field(max_length=255)
    emoji: str = Field(default="", max_length=16)
    kcal: float = Field(ge=0, le=10000)
    protein: float = Field(ge=0, le=1000)
    carbs: float = Field(ge=0, le=1000)
    fat: float = Field(ge=0, le=1000)
    unit: Unit
    brand: str | None = Field(default=None, max_length=255)
    fiber: float | None = Field(default=None, ge=0, le=1000)
    sugar: float | None = Field(default=None, ge=0, le=1000)
    saturates: float | None = Field(default=None, ge=0, le=1000)
    salt: float | None = Field(default=None, ge=0, le=1000)
    portions: list[Portion] | None = Field(default=None, max_length=12)


class ShareRecipePayload(BaseModel):
    """Snapshot de uma receita partilhada (não referencia a original)."""

    name: str = Field(max_length=120)
    emoji: str = Field(default="🍽️", max_length=16)
    items: list[RecipeItem] = Field(min_length=1, max_length=40)


class Share(BaseModel):
    """Cartão partilhado numa mensagem: um alimento ou uma receita (snapshot)."""

    kind: Literal["food", "recipe"]
    payload: dict

    @model_validator(mode="after")
    def _validate_payload(self) -> "Share":
        if self.kind == "food":
            self.payload = ShareFoodPayload.model_validate(self.payload).model_dump(mode="json", exclude_none=True)
        else:
            self.payload = ShareRecipePayload.model_validate(self.payload).model_dump(mode="json")
        return self


class MessageReactionOut(BaseModel):
    userId: int
    emoji: str


class ReplyPreview(BaseModel):
    """Citação leve: nunca leva a foto em base64 da mensagem original."""

    id: int
    senderId: int
    text: str  # já resumido para caber numa linha
    kind: Literal["text", "image", "share"] = "text"


class MessageOut(BaseModel):
    id: int
    senderId: int
    conversationId: int | None = None
    body: str
    image: str | None = None
    share: dict | None = None
    replyTo: ReplyPreview | None = None
    createdAt: datetime
    reactions: list[MessageReactionOut] = []


class SendMessage(BaseModel):
    body: str = Field(default="", max_length=2000)
    image: str | None = Field(default=None, max_length=MAX_IMAGE_CHARS)
    share: Share | None = None
    replyToId: int | None = None

    @model_validator(mode="after")
    def _check(self) -> "SendMessage":
        self.body = self.body.strip()
        if self.image and self.image.startswith("data:"):
            self.image = self.image.split(",", 1)[-1]
        if not self.body and not self.image and self.share is None:
            raise ValueError("Mensagem vazia.")
        return self


class ReactMessage(BaseModel):
    emoji: str = Field(min_length=1, max_length=8)


class CreateGroup(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    emoji: str = Field(default="👥", max_length=8)
    memberIds: list[int] = Field(min_length=1, max_length=19)

    @model_validator(mode="after")
    def _strip(self) -> "CreateGroup":
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("O grupo precisa de um nome.")
        return self


class PatchGroup(BaseModel):
    title: str | None = Field(default=None, max_length=60)
    emoji: str | None = Field(default=None, min_length=1, max_length=8)

    @model_validator(mode="after")
    def _strip(self) -> "PatchGroup":
        if self.title is not None:
            self.title = self.title.strip()
            if not self.title:
                raise ValueError("O grupo precisa de um nome.")
        return self


class AddMembers(BaseModel):
    memberIds: list[int] = Field(min_length=1, max_length=19)


class ConversationOut(BaseModel):
    id: int
    type: Literal["dm", "group"]
    title: str | None = None
    emoji: str = "💬"
    user: PublicProfileLite | None = None  # o outro membro, só em DMs
    members: list[PublicProfileLite] = []
    role: Literal["owner", "member"] = "member"
    unread: int = 0
    lastMessage: MessageOut | None = None
    # cursor de leitura do parceiro (DMs): mensagens minhas com id <= isto foram lidas
    partnerReadUpTo: int | None = None
    # o MEU cursor: serve para desenhar a linha "novas mensagens" ao abrir
    myReadUpTo: int | None = None


class CreateChallenge(BaseModel):
    kind: Literal["days_on_plan"] = "days_on_plan"
    target: int = Field(ge=1, le=30)  # dias no plano por pessoa
    days: int = Field(default=7, ge=1, le=30)  # duração da janela


class ChallengeOut(BaseModel):
    """PRIVACIDADE: só total agregado + o meu número.

    Os membros de um grupo não são necessariamente amigos uns dos outros, e dias
    no plano é um dado derivado — mostrar o detalhe por pessoa exporia isso a
    quem não é amigo.
    """

    id: int
    kind: str
    target: int  # por pessoa
    startsOn: date
    endsOn: date
    participants: int
    groupTarget: int  # target * participantes
    groupProgress: int  # soma dos dias no plano de todos
    myProgress: int
    done: bool


class UnreadOut(BaseModel):
    total: int


class SaveShareOut(BaseModel):
    kind: Literal["food", "recipe"]
    food: Food | None = None
    recipe: Recipe | None = None
