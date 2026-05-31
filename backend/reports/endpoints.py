from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth.endpoints import get_current_user_from_token
from database import get_db
from models import PlatformReport, User
from reports.schemas import ReportAdminResponse, ReportCreate, ReportResponse, ReportStatusUpdate

router = APIRouter(prefix="/reports", tags=["Reports"])

# ── In-memory rate limiter (lightweight, no decorator needed) ──────────────────
# Format: { key: [timestamp, ...] }
_rate_store: dict = defaultdict(list)

def _check_rate_limit(key: str, max_requests: int, window_seconds: int = 60):
    """Simple sliding-window rate limiter. Raises 429 if limit exceeded."""
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=window_seconds)
    # Purge old requests
    timestamps = [t for t in _rate_store[key] if t > cutoff]
    _rate_store[key] = timestamps

    if len(timestamps) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiadas solicitudes. Por favor espera un momento e intenta de nuevo."
        )
    _rate_store[key].append(now)

# ── Helper ─────────────────────────────────────────────────────────────────────

def _require_admin(current_user: User):
    """Raise 403 if user is not admin."""
    if current_user.user_type != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador"
        )

def _validate_evidence_url(url: str | None):
    """Ensure evidence URL belongs to our Supabase domain to prevent malicious link injection."""
    if not url:
        return
    supabase_url = os.getenv("VITE_SUPABASE_URL", "supabase.co")
    domain = supabase_url.replace("https://", "").replace("http://", "").split("/")[0]

    if "supabase.co" in url or (domain and domain in url) or url.startswith("[attached:"):
        return

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="URL de evidencia no válida. Solo se permiten archivos subidos a la plataforma oficial."
    )


# ── Public Endpoints ───────────────────────────────────────────────────────────

@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_data: ReportCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Crear un nuevo reporte/queja/sugerencia.
    No requiere autenticación (accesible para usuarios sin sesión).
    Si hay token de sesión válido, el user_id se asocia automáticamente.
    """
    # Rate limit by IP: 5 per minute
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"ip:{client_ip}", max_requests=5, window_seconds=60)

    # Try to get authenticated user (optional)
    user_id: int | None = None
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            from auth.utils import verify_token
            token = auth_header.split(" ", 1)[1]
            credentials_exception = Exception("Invalid token")
            email = verify_token(token, credentials_exception)
            if email:
                user = db.query(User).filter(User.email == email).first()
                if user:
                    user_id = user.id
    except Exception:
        pass  # No auth — continue as anonymous report

    # Additional rate limit by User ID (if authenticated): 3 per minute
    if user_id:
        _check_rate_limit(f"user:{user_id}", max_requests=3, window_seconds=60)

    # Security: Validate evidence URL domain
    _validate_evidence_url(report_data.evidence_url)

    # Build metadata with browser/platform context from request
    extra_meta = dict(report_data.report_metadata or {})
    extra_meta.setdefault("user_agent", request.headers.get("User-Agent", ""))
    extra_meta.setdefault("ip", client_ip)

    new_report = PlatformReport(
        user_id=user_id,
        reporter_email=str(report_data.reporter_email),
        report_type=report_data.report_type,
        subject=report_data.subject,
        reported_url=report_data.reported_url,
        context=report_data.context,
        evidence_url=report_data.evidence_url,
        report_metadata=extra_meta,
        status="pending",
        priority="low",
    )

    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    return new_report


# ── Admin Endpoints ────────────────────────────────────────────────────────────

@router.get("/", response_model=list[ReportAdminResponse])
async def list_reports(
    skip: int = 0,
    limit: int = 50,
    report_status: str | None = None,
    report_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    """
    Listar todos los reportes — solo para admins.
    Permite filtrar por status y tipo.
    """
    _require_admin(current_user)

    query = db.query(PlatformReport)

    if report_status:
        query = query.filter(PlatformReport.status == report_status)
    if report_type:
        query = query.filter(PlatformReport.report_type == report_type)

    reports = (
        query
        .order_by(PlatformReport.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return reports


@router.get("/stats")
async def get_report_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    """Estadísticas rápidas de reportes — solo para admins."""
    _require_admin(current_user)

    # Optimized aggregate queries
    status_counts = db.query(PlatformReport.status, func.count(PlatformReport.id)).group_by(PlatformReport.status).all()
    type_counts = db.query(PlatformReport.report_type, func.count(PlatformReport.id)).group_by(PlatformReport.report_type).all()

    # Map results
    stats_data = {
        "total": sum(c[1] for c in status_counts),
        "by_status": {
            "pending": 0, "in_review": 0, "resolved": 0, "closed": 0
        },
        "by_type": {
            "bug": 0, "abuse": 0, "suggestion": 0, "content": 0, "other": 0
        }
    }

    for s, count in status_counts:
        if s in stats_data["by_status"]:
            stats_data["by_status"][s] = count

    for t, count in type_counts:
        if t in stats_data["by_type"]:
            stats_data["by_type"][t] = count

    return stats_data


@router.get("/{report_id}", response_model=ReportAdminResponse)
async def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    """Ver detalle de un reporte — solo para admins."""
    _require_admin(current_user)

    report = db.query(PlatformReport).filter(PlatformReport.public_id == report_id).first()
    if not report:
        # Fallback to internal ID if it's a number (for backward compatibility during migration)
        if report_id.isdigit():
            report = db.query(PlatformReport).filter(PlatformReport.id == int(report_id)).first()

        if not report:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return report


@router.patch("/{report_id}", response_model=ReportAdminResponse)
async def update_report(
    report_id: str,
    update_data: ReportStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    """Actualizar status, prioridad y notas de un reporte — solo para admins."""
    _require_admin(current_user)

    report = db.query(PlatformReport).filter(PlatformReport.public_id == report_id).first()
    if not report:
        # Fallback to internal ID if it's a number
        if report_id.isdigit():
            report = db.query(PlatformReport).filter(PlatformReport.id == int(report_id)).first()

        if not report:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")

    if update_data.status is not None:
        report.status = update_data.status
        if update_data.status == "resolved":
            report.resolved_at = datetime.utcnow()
    if update_data.priority is not None:
        report.priority = update_data.priority
    if update_data.admin_notes is not None:
        report.admin_notes = update_data.admin_notes

    db.commit()
    db.refresh(report)
    return report
