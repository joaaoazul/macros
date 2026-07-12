"""Web Push subscription schemas (mirror the browser PushSubscription JSON)."""

from pydantic import BaseModel, Field


class PushKeys(BaseModel):
    p256dh: str = Field(max_length=256)
    auth: str = Field(max_length=256)


class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(max_length=512)
    keys: PushKeys


class PushUnsubscribeIn(BaseModel):
    endpoint: str = Field(max_length=512)


class VapidKeyOut(BaseModel):
    key: str
