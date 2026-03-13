from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Any
from datetime import datetime


# ── Request Schemas ────────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    """Schema para crear un nuevo reporte desde el formulario."""
    reporter_email: EmailStr
    report_type: str = "other"  # bug | abuse | suggestion | content | other
    subject: str
    reported_url: Optional[str] = None
    context: str
    evidence_url: Optional[str] = None
    report_metadata: Optional[dict] = {}

    @field_validator("report_type")
    @classmethod
    def validate_type(cls, v):
        valid = {"bug", "abuse", "suggestion", "content", "other"}
        if v not in valid:
            raise ValueError(f"report_type must be one of: {valid}")
        return v

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, v):
        v = v.strip()
        if not v or len(v) < 3:
            raise ValueError("El asunto debe tener al menos 3 caracteres")
        return v

    @field_validator("context")
    @classmethod
    def validate_context(cls, v):
        v = v.strip()
        if not v or len(v) < 10:
            raise ValueError("El contexto debe tener al menos 10 caracteres")
        return v


# ── Response Schemas ───────────────────────────────────────────────────────────

class ReportResponse(BaseModel):
    """Schema de respuesta pública para un reporte."""
    id: int
    reporter_email: str
    report_type: str
    subject: str
    reported_url: Optional[str]
    context: str
    evidence_url: Optional[str]
    status: str
    priority: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReportAdminResponse(ReportResponse):
    """Schema extendido para admin (incluye notas, user_id, metadata)."""
    reporter_public_id: Optional[str]
    admin_notes: Optional[str]
    report_metadata: Optional[dict]
    updated_at: Optional[datetime]
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReportStatusUpdate(BaseModel):
    """Para que admin actualice status/prioridad/notas."""
    status: Optional[str] = None
    priority: Optional[str] = None
    admin_notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            valid = {"pending", "in_review", "resolved", "closed"}
            if v not in valid:
                raise ValueError(f"status must be one of: {valid}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v is not None:
            valid = {"low", "medium", "high", "critical"}
            if v not in valid:
                raise ValueError(f"priority must be one of: {valid}")
        return v
