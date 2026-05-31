from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_serializer, field_validator


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    birth_date: str | None = None
    gender: str | None = None
    avatar_config: dict | None = None
    username: str | None = None
    preferred_language: str | None = None

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if v is None or v == '':
            return None  # Treat empty string as None
        # Convert to lowercase and strip whitespace
        v = v.lower().strip()
        if not v:  # After strip, it's empty
            return None
        # Validate format: only lowercase letters, numbers, -, _
        if not re.match(r'^[a-z0-9_-]{3,30}$', v):
            raise ValueError('El usuario debe tener 3-30 caracteres, solo letras, números, - y _')
        return v


class UserResponse(BaseModel):
    public_id: UUID
    name: str
    email: str
    user_type: str
    created_at: datetime
    lessons_completed: int | None = 0
    minutes_studied: int | None = 0
    points_earned: int | None = 0
    current_streak: int | None = 0
    max_streak: int | None = 0
    balance: float | None = 0.0
    avatar_config: dict | None = None
    username: str | None = None
    preferred_language: str | None = 'es'
    auth_provider: str | None = 'email'
    birth_date: datetime | None = None
    gender: str | None = None
    # YYYY-MM-DD of the user's most recent streak activity.
    # Used by the frontend to derive streak visual state: zero / inactive / active.
    last_activity_date: str | None = None

    @field_serializer('public_id')
    def serialize_public_id(self, v: UUID) -> str:
        return str(v)

    class Config:
        from_attributes = True


class SupabaseAuthRequest(BaseModel):
    access_token: str


class GuestMergeRequest(BaseModel):
    name: str | None = None
    age: int | None = None
    interests: list | None = None
    experience_level: str | None = None
    preferred_language: str | None = None
    xp: int | None = 0
    current_streak: int | None = 0
    steps_completed: int | None = 0
