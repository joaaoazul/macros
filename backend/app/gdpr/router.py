"""GDPR endpoints: full data export and account deletion."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import write_audit_log
from app.auth.cookies import clear_auth_cookies
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.auth.security import verify_password
from app.data.router import _load_all
from app.data.schemas import DeleteAccountRequest
from app.database import get_db
from app.exceptions import UnauthorizedError

router = APIRouter(prefix="/api/v1/gdpr", tags=["gdpr"])


@router.get("/export")
async def export_data(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    """Download all personal data as JSON (GDPR Art. 20 — data portability)."""
    data = await _load_all(db, user.id)
    payload = {
        "account": {
            "email": user.email,
            "name": user.name,
            "createdAt": user.created_at.isoformat(),
            "exportedAt": datetime.now(timezone.utc).isoformat(),
        },
        **data.model_dump(),
    }
    await write_audit_log(db, "gdpr_export", user_id=user.id)
    return JSONResponse(
        payload,
        headers={"Content-Disposition": 'attachment; filename="macros-dados.json"'},
    )


@router.delete("/account")
async def delete_account(
    body: DeleteAccountRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Permanently delete the account and all data (GDPR Art. 17 — right to erasure)."""
    if not verify_password(body.password, user.hashed_password):
        raise UnauthorizedError("Password incorreta.")
    user_id = user.id
    await write_audit_log(db, "account_deleted", user_id=user_id, detail=user.email)
    await db.execute(delete(User).where(User.id == user_id))  # data cascades
    clear_auth_cookies(response)
    return {"message": "Conta eliminada."}
