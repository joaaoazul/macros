"""SOC admin: dashboard, audit + feed live, gestão de users/sessões, IP intel + blocklist."""

import asyncio
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.feed import admin_feed
from app.admin.models import IpBlocklist
from app.admin.schemas import (
    AdminMe,
    AdminUserRow,
    AuditPage,
    AuditRow,
    BlocklistRow,
    BlockIpIn,
    DailyPoint,
    IpInfo,
    SecuritySummary,
    TopIp,
)
from app.admin.service import _mark_blocked, _unmark_blocked, geo_for_ip, load_blocklist
from app.audit import AuditLog, write_audit_log
from app.auth.dependencies import require_admin
from app.auth.models import User
from app.database import get_db
from app.exceptions import NotFoundError, ValidationError
from app.net import client_ip
from app.push.models import DbPushSubscription

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

FAILED_ACTIONS = ("login_failed", "login_locked")


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/me", response_model=AdminMe)
async def admin_me(admin: User = Depends(require_admin)) -> AdminMe:
    return AdminMe(userId=admin.id, email=admin.email, isAdmin=admin.is_admin)


# ---------------------------------------------------------------- Dashboard
@router.get("/security-summary", response_model=SecuritySummary)
async def security_summary(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> SecuritySummary:
    now = _now()
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)

    async def _count(*conds) -> int:
        return (await db.execute(select(func.count(AuditLog.id)).where(*conds))).scalar_one()

    failed_24h = await _count(AuditLog.action.in_(FAILED_ACTIONS), AuditLog.created_at >= day_ago)
    failed_7d = await _count(AuditLog.action.in_(FAILED_ACTIONS), AuditLog.created_at >= week_ago)
    lockouts_7d = await _count(AuditLog.action == "login_locked", AuditLog.created_at >= week_ago)

    # IPs vistos pela primeira vez nos últimos 7 dias
    first_seen = (
        select(AuditLog.ip, func.min(AuditLog.created_at).label("first"))
        .where(AuditLog.ip != "")
        .group_by(AuditLog.ip)
        .subquery()
    )
    first_seen_7d = (
        await db.execute(
            select(func.count()).select_from(first_seen).where(first_seen.c.first >= week_ago)
        )
    ).scalar_one()

    # Sessões ativas ~ users ativos com atividade recente (aprox. via audit login 30min)
    active_cut = now - timedelta(minutes=30)
    active_sessions = (
        await db.execute(
            select(func.count(func.distinct(AuditLog.user_id))).where(
                AuditLog.action == "login", AuditLog.created_at >= active_cut
            )
        )
    ).scalar_one()

    push_subs = (await db.execute(select(func.count(DbPushSubscription.id)))).scalar_one()
    blocked = (await db.execute(select(func.count(IpBlocklist.id)))).scalar_one()

    # Série diária (14 dias): sucessos, falhas, registos
    daily: list[DailyPoint] = []
    for i in range(13, -1, -1):
        d0 = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        d1 = d0 + timedelta(days=1)
        succ = await _count(AuditLog.action == "login", AuditLog.created_at >= d0, AuditLog.created_at < d1)
        fail = await _count(AuditLog.action.in_(FAILED_ACTIONS), AuditLog.created_at >= d0, AuditLog.created_at < d1)
        regs = await _count(AuditLog.action == "register", AuditLog.created_at >= d0, AuditLog.created_at < d1)
        daily.append(DailyPoint(date=d0.date().isoformat(), success=succ, failed=fail, registrations=regs))

    # Top IPs a falhar (7 dias)
    top_rows = (
        await db.execute(
            select(AuditLog.ip, func.count(AuditLog.id).label("n"), func.max(AuditLog.created_at))
            .where(AuditLog.action.in_(FAILED_ACTIONS), AuditLog.created_at >= week_ago, AuditLog.ip != "")
            .group_by(AuditLog.ip)
            .order_by(func.count(AuditLog.id).desc())
            .limit(10)
        )
    ).all()
    top = [TopIp(ip=r[0], failed=r[1], lastSeen=r[2]) for r in top_rows]

    return SecuritySummary(
        failedLogins24h=failed_24h,
        failedLogins7d=failed_7d,
        lockouts7d=lockouts_7d,
        firstSeenIps7d=first_seen_7d,
        activeSessionsApprox=active_sessions,
        pushSubscriptions=push_subs,
        blockedIps=blocked,
        daily=daily,
        topFailingIps=top,
    )


# ---------------------------------------------------------------- Audit
def _audit_out(a: AuditLog) -> AuditRow:
    return AuditRow(
        id=a.id, userId=a.user_id, action=a.action, severity=a.severity,
        detail=a.detail, ip=a.ip, userAgent=a.user_agent, createdAt=a.created_at,
    )


@router.get("/audit", response_model=AuditPage)
async def audit_page(
    action: str | None = None,
    user_id: int | None = None,
    ip: str | None = None,
    severity: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AuditPage:
    conds = []
    if action:
        conds.append(AuditLog.action == action)
    if user_id is not None:
        conds.append(AuditLog.user_id == user_id)
    if ip:
        conds.append(AuditLog.ip == ip)
    if severity:
        conds.append(AuditLog.severity == severity)
    total = (await db.execute(select(func.count(AuditLog.id)).where(*conds))).scalar_one()
    rows = (
        await db.execute(
            select(AuditLog).where(*conds).order_by(AuditLog.id.desc()).limit(limit).offset(offset)
        )
    ).scalars().all()
    return AuditPage(rows=[_audit_out(a) for a in rows], total=total)


@router.get("/audit/stream")
async def audit_stream(admin: User = Depends(require_admin)) -> StreamingResponse:
    """Server-Sent Events: cada novo evento de auditoria em tempo real."""
    queue = admin_feed.subscribe()

    async def gen():
        try:
            yield ": ok\n\n"  # comentário inicial abre o stream
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            admin_feed.unsubscribe(queue)

    return StreamingResponse(gen(), media_type="text/event-stream")


# ---------------------------------------------------------------- Users & sessões
def _user_out(u: User) -> AdminUserRow:
    return AdminUserRow(
        id=u.id, email=u.email, username=u.username, name=u.name, isAdmin=u.is_admin,
        isActive=u.is_active, emailVerified=u.email_verified,
        failedLoginAttempts=u.failed_login_attempts, lockedUntil=u.locked_until, createdAt=u.created_at,
    )


@router.get("/users", response_model=list[AdminUserRow])
async def list_users(
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> list[AdminUserRow]:
    query = select(User).order_by(User.id.desc()).limit(limit)
    if q:
        like = f"%{q.lower()}%"
        query = select(User).where(
            func.lower(User.email).like(like) | func.lower(func.coalesce(User.username, "")).like(like)
        ).order_by(User.id.desc()).limit(limit)
    rows = (await db.execute(query)).scalars().all()
    return [_user_out(u) for u in rows]


async def _get_target(db: AsyncSession, user_id: int) -> User:
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise NotFoundError("Utilizador")
    return u


@router.get("/users/{user_id}", response_model=AdminUserRow)
async def user_detail(
    user_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
) -> AdminUserRow:
    return _user_out(await _get_target(db, user_id))


async def _audit_admin(db, request: Request, admin: User, action: str, detail: str) -> None:
    await write_audit_log(
        db, action, user_id=admin.id, detail=detail, ip=client_ip(request),
        severity="warning", user_agent=request.headers.get("User-Agent", ""),
    )


@router.post("/users/{user_id}/force-logout", response_model=AdminUserRow)
async def force_logout(
    user_id: int, request: Request, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
) -> AdminUserRow:
    u = await _get_target(db, user_id)
    u.sessions_invalidated_at = _now()
    await _audit_admin(db, request, admin, "admin_force_logout", f"user={user_id}")
    return _user_out(u)


@router.post("/users/{user_id}/disable", response_model=AdminUserRow)
async def disable_user(
    user_id: int, request: Request, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
) -> AdminUserRow:
    u = await _get_target(db, user_id)
    if u.id == admin.id:
        raise ValidationError("Não te podes desativar a ti próprio.")
    u.is_active = False
    u.sessions_invalidated_at = _now()
    await _audit_admin(db, request, admin, "admin_disable_user", f"user={user_id}")
    return _user_out(u)


@router.post("/users/{user_id}/enable", response_model=AdminUserRow)
async def enable_user(
    user_id: int, request: Request, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
) -> AdminUserRow:
    u = await _get_target(db, user_id)
    u.is_active = True
    await _audit_admin(db, request, admin, "admin_enable_user", f"user={user_id}")
    return _user_out(u)


# ---------------------------------------------------------------- IP intel + blocklist
@router.get("/ips", response_model=list[IpInfo])
async def ip_intel(
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> list[IpInfo]:
    week_ago = _now() - timedelta(days=7)
    rows = (
        await db.execute(
            select(
                AuditLog.ip,
                func.count(AuditLog.id),
                func.sum(case((AuditLog.action.in_(FAILED_ACTIONS), 1), else_=0)),
                func.min(AuditLog.created_at),
                func.max(AuditLog.created_at),
            )
            .where(AuditLog.ip != "", AuditLog.created_at >= week_ago)
            .group_by(AuditLog.ip)
            .order_by(func.count(AuditLog.id).desc())
            .limit(limit)
        )
    ).all()
    blocked = set((await db.execute(select(IpBlocklist.ip))).scalars().all())
    out: list[IpInfo] = []
    for ip, events, failed, first, last in rows:
        failed = int(failed or 0)
        out.append(
            IpInfo(
                ip=ip, events=events, failed=failed, firstSeen=first, lastSeen=last,
                anomaly=failed >= 10, blocked=ip in blocked, geo=await geo_for_ip(ip),
            )
        )
    return out


@router.get("/blocklist", response_model=list[BlocklistRow])
async def list_blocklist(
    db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
) -> list[BlocklistRow]:
    rows = (await db.execute(select(IpBlocklist).order_by(IpBlocklist.id.desc()))).scalars().all()
    return [BlocklistRow(id=r.id, ip=r.ip, reason=r.reason, createdAt=r.created_at) for r in rows]


@router.post("/blocklist", response_model=BlocklistRow, status_code=201)
async def block_ip(
    body: BlockIpIn, request: Request, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
) -> BlocklistRow:
    ip = body.ip.strip()
    if not ip:
        raise ValidationError("IP inválido.")
    exists = (await db.execute(select(IpBlocklist).where(IpBlocklist.ip == ip))).scalar_one_or_none()
    if exists:
        raise ValidationError("IP já está bloqueado.")
    row = IpBlocklist(ip=ip, reason=body.reason[:255], created_by=admin.id)
    db.add(row)
    await db.flush()
    _mark_blocked(ip)
    await _audit_admin(db, request, admin, "admin_blocklist_add", f"ip={ip} {body.reason}")
    return BlocklistRow(id=row.id, ip=row.ip, reason=row.reason, createdAt=row.created_at)


@router.delete("/blocklist/{ip}", status_code=204)
async def unblock_ip(
    ip: str, request: Request, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
) -> None:
    await db.execute(delete(IpBlocklist).where(IpBlocklist.ip == ip))
    _unmark_blocked(ip)
    await _audit_admin(db, request, admin, "admin_blocklist_remove", f"ip={ip}")
