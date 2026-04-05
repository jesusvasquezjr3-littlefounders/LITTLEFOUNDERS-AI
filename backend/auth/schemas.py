from pydantic import BaseModel, EmailStr, field_validator, field_serializer
from typing import Optional
from datetime import datetime
from uuid import UUID
import re


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    avatar_config: Optional[dict] = None
    username: Optional[str] = None
    preferred_language: Optional[str] = None

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
    lessons_completed: Optional[int] = 0
    minutes_studied: Optional[int] = 0
    points_earned: Optional[int] = 0
    current_streak: Optional[int] = 0
    balance: Optional[float] = 0.0
    avatar_config: Optional[dict] = None
    username: Optional[str] = None
    preferred_language: Optional[str] = 'es'
    auth_provider: Optional[str] = 'email'
    birth_date: Optional[datetime] = None
    gender: Optional[str] = None

    @field_serializer('public_id')
    def serialize_public_id(self, v: UUID) -> str:
        return str(v)

    class Config:
        from_attributes = True


class SupabaseAuthRequest(BaseModel):
    access_token: str
