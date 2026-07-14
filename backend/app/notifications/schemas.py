"""Notification inbox + preferences schemas."""

from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    kind: str
    title: str
    body: str
    url: str
    actorId: int | None
    read: bool
    createdAt: datetime


class NotificationPrefs(BaseModel):
    messages: bool
    friends: bool
    social: bool


class MarkReadIn(BaseModel):
    upToId: int | None = None


class TestResult(BaseModel):
    pushConfigured: bool
    pushed: bool
