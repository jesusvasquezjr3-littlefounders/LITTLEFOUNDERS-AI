from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, field_validator

# ── Request Schemas ────────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    """Schema para crear un nuevo reporte desde el formulario."""
    reporter_email: EmailStr
    report_type: str = "other"  # bug | abuse | suggestion | content | other
    subject: str
    reported_url: str | None = None
    context: str
    evidence_url: str | None = None
    report_metadata: dict | None = {}

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
    public_id: Any  # UUID
    report_type: str
    subject: str
    reported_url: str | None
    context: str
    evidence_url: str | None
    status: str
    priority: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReportAdminResponse(ReportResponse):
    """Schema extendido para admin (incluye notas, user_id, metadata)."""
    reporter_email: str
    reporter_public_id: str | None = None
    admin_notes: str | None = None
    report_metadata: dict | None
    updated_at: datetime | None
    resolved_at: datetime | None

    class Config:
        from_attributes = True


class ReportStatusUpdate(BaseModel):
    """Para que admin actualice status/prioridad/notas."""
    status: str | None = None
    priority: str | None = None
    admin_notes: str | None = None

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
