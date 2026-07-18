"""Social schemas. PRIVACY: only derived stats — never kcal/weight/diary raw values."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# ~300KB de foto em base64 (downscaled p/ ~256px JPEG no cliente)
MAX_AVATAR_PHOTO_CHARS = 400_000


class DerivedStats(BaseModel):
    streak: int
    daysOnPlan7d: int


class PublicProfileLite(BaseModel):
    userId: int
    username: str
    avatar: str
    avatarPhoto: str | None = None
    bio: str | None = None
    name: str


class PublicProfile(PublicProfileLite):
    stats: DerivedStats
    friendship: Literal["none", "friends", "incoming", "outgoing", "self"]
    friendshipId: int | None = None
    badges: list[str] = []


class BadgeEarned(BaseModel):
    kind: str
    earnedOn: date


class SocialMe(BaseModel):
    userId: int
    username: str | None
    avatar: str
    avatarPhoto: str | None = None
    bio: str | None = None
    name: str
    badges: list[str] = []
    badgesDetail: list[BadgeEarned] = []
    stats: DerivedStats | None = None


class SocialMeUpdate(BaseModel):
    username: str = Field(min_length=3, max_length=20, pattern=r"^[a-z0-9_]+$")
    avatar: str = Field(min_length=1, max_length=16)
    avatarPhoto: str | None = Field(default=None, max_length=MAX_AVATAR_PHOTO_CHARS)
    bio: str | None = Field(default=None, max_length=300)

    @field_validator("avatarPhoto")
    @classmethod
    def _strip_data_prefix(cls, v: str | None) -> str | None:
        if v and v.startswith("data:"):
            return v.split(",", 1)[-1]
        return v or None


class SearchResult(BaseModel):
    userId: int
    username: str
    avatar: str
    name: str
    friendship: Literal["none", "friends", "incoming", "outgoing"]


class FriendRequestIn(BaseModel):
    username: str = Field(min_length=3, max_length=20)


class FriendshipOut(BaseModel):
    id: int
    user: PublicProfileLite
    status: Literal["pending", "accepted"]
    direction: Literal["incoming", "outgoing"] | None = None


class FriendsList(BaseModel):
    friends: list[FriendshipOut]
    incoming: list[FriendshipOut]
    outgoing: list[FriendshipOut]


class LeaderboardRow(BaseModel):
    userId: int
    username: str
    avatar: str
    daysOnPlan: int
    bonus: int
    rank: int
    isMe: bool


class WeekInfo(BaseModel):
    start: date
    end: date


class LeaderboardOut(BaseModel):
    week: WeekInfo
    rows: list[LeaderboardRow]


class ReactionSummary(BaseModel):
    counts: dict[str, int] = {}
    total: int = 0
    mine: str | None = None


class FeedEventOut(BaseModel):
    id: int
    kind: str
    refDate: date
    payload: dict
    user: PublicProfileLite
    createdAt: datetime
    reactions: ReactionSummary = ReactionSummary()


class ReactionIn(BaseModel):
    emoji: str = Field(min_length=1, max_length=8)


class NudgeIn(BaseModel):
    userId: int
    kind: Literal["train", "water", "log", "cheer"]


class BadgeOut(BaseModel):
    kind: str
    emoji: str
    title: str
    description: str
