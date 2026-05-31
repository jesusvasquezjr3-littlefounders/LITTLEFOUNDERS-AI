from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# ── User-facing schemas ──

class NotificationOut(BaseModel):
    public_id: str
    type: str
    priority: str
    title: str  # resolved by user's language
    body: str | None = None
    media_url: str | None = None
    action_url: str | None = None
    metadata: dict | None = None
    read_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadCountOut(BaseModel):
    count: int


# ── Admin schemas ──

class NotificationCreate(BaseModel):
    type: str = "admin_broadcast"
    priority: str = "normal"
    status: str = "active"
    title_es: str = Field(..., min_length=1, max_length=300)
    title_en: str = Field(..., min_length=1, max_length=300)
    body_es: str | None = None
    body_en: str | None = None
    media_url: str | None = None
    action_url: str | None = None
    target_type: str = "all"
    target_value: str | None = None
    metadata: dict | None = None
    scheduled_at: datetime | None = None
    expires_at: datetime | None = None


class NotificationUpdate(BaseModel):
    type: str | None = None
    priority: str | None = None
    status: str | None = None
    title_es: str | None = None
    title_en: str | None = None
    body_es: str | None = None
    body_en: str | None = None
    media_url: str | None = None
    action_url: str | None = None
    target_type: str | None = None
    target_value: str | None = None
    metadata: dict | None = None
    scheduled_at: datetime | None = None
    expires_at: datetime | None = None


class NotificationAdminOut(BaseModel):
    public_id: str
    type: str
    priority: str
    status: str
    title_es: str
    title_en: str
    body_es: str | None = None
    body_en: str | None = None
    media_url: str | None = None
    action_url: str | None = None
    target_type: str
    target_value: str | None = None
    metadata: dict | None = None
    created_by_name: str | None = None
    read_count: int = 0
    total_recipients: int = 0
    scheduled_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True
