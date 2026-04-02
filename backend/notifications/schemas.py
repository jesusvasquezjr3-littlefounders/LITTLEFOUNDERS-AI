from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── User-facing schemas ──

class NotificationOut(BaseModel):
    public_id: str
    type: str
    priority: str
    title: str  # resolved by user's language
    body: Optional[str] = None
    media_url: Optional[str] = None
    action_url: Optional[str] = None
    metadata: Optional[dict] = None
    read_at: Optional[datetime] = None
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
    body_es: Optional[str] = None
    body_en: Optional[str] = None
    media_url: Optional[str] = None
    action_url: Optional[str] = None
    target_type: str = "all"
    target_value: Optional[str] = None
    metadata: Optional[dict] = None
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class NotificationUpdate(BaseModel):
    type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    title_es: Optional[str] = None
    title_en: Optional[str] = None
    body_es: Optional[str] = None
    body_en: Optional[str] = None
    media_url: Optional[str] = None
    action_url: Optional[str] = None
    target_type: Optional[str] = None
    target_value: Optional[str] = None
    metadata: Optional[dict] = None
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class NotificationAdminOut(BaseModel):
    public_id: str
    type: str
    priority: str
    status: str
    title_es: str
    title_en: str
    body_es: Optional[str] = None
    body_en: Optional[str] = None
    media_url: Optional[str] = None
    action_url: Optional[str] = None
    target_type: str
    target_value: Optional[str] = None
    metadata: Optional[dict] = None
    created_by_name: Optional[str] = None
    read_count: int = 0
    total_recipients: int = 0
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
