"""Social schemas. PRIVACY: only derived stats — never kcal/weight/diary raw values."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class DerivedStats(BaseModel):
    streak: int
    daysOnPlan7d: int


class PublicProfileLite(BaseModel):
    userId: int
    username: str
    avatar: str
    name: str


class PublicProfile(PublicProfileLite):
    stats: DerivedStats
    friendship: Literal["none", "friends", "incoming", "outgoing", "self"]
    friendshipId: int | None = None


class SocialMe(BaseModel):
    userId: int
    username: str | None
    avatar: str
    name: str


class SocialMeUpdate(BaseModel):
    username: str = Field(min_length=3, max_length=20, pattern=r"^[a-z0-9_]+$")
    avatar: str = Field(min_length=1, max_length=16)


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


class FeedEventOut(BaseModel):
    id: int
    kind: str
    refDate: date
    payload: dict
    user: PublicProfileLite
    createdAt: datetime
