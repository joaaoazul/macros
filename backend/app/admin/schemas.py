"""Schemas do SOC admin."""

from datetime import datetime

from pydantic import BaseModel


class AdminMe(BaseModel):
    userId: int
    email: str
    isAdmin: bool


class DailyPoint(BaseModel):
    date: str
    success: int
    failed: int
    registrations: int


class TopIp(BaseModel):
    ip: str
    failed: int
    lastSeen: datetime | None = None


class SecuritySummary(BaseModel):
    failedLogins24h: int
    failedLogins7d: int
    lockouts7d: int
    firstSeenIps7d: int
    activeSessionsApprox: int
    pushSubscriptions: int
    blockedIps: int
    daily: list[DailyPoint]
    topFailingIps: list[TopIp]


class InviteCreateIn(BaseModel):
    maxUses: int = 1
    expiresInDays: int | None = None


class InviteRow(BaseModel):
    id: int
    code: str
    maxUses: int
    usedCount: int
    expiresAt: datetime | None
    createdAt: datetime


class AuditRow(BaseModel):
    id: int
    userId: int | None
    action: str
    severity: str
    detail: str
    ip: str
    userAgent: str
    createdAt: datetime


class AuditPage(BaseModel):
    rows: list[AuditRow]
    total: int


class AdminUserRow(BaseModel):
    id: int
    email: str
    username: str | None
    name: str
    isAdmin: bool
    isActive: bool
    emailVerified: bool
    failedLoginAttempts: int
    lockedUntil: datetime | None
    createdAt: datetime


class IpInfo(BaseModel):
    ip: str
    events: int
    failed: int
    firstSeen: datetime | None
    lastSeen: datetime | None
    anomaly: bool
    blocked: bool
    geo: str | None = None


class BlocklistRow(BaseModel):
    id: int
    ip: str
    reason: str
    createdAt: datetime


class BlockIpIn(BaseModel):
    ip: str
    reason: str = ""
