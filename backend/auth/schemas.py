from pydantic import BaseModel, EmailStr, field_validator, field_serializer
from typing import Optional
from datetime import datetime
from uuid import UUID
import re


# Auth Schemas
class UserBase(BaseModel):
    email: EmailStr
    name: str
    birth_date: Optional[str] = None
    gender: Optional[str] = None


class UserRegister(BaseModel):
    name: Optional[str] = None
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
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


# Legacy scheamas kept for backward compatibility if needed, 
# but we are moving to UserRegister for the main flow
class TutorRegister(UserBase):
    password: str


class ChildRegister(UserBase):
    password: str


class FamilyRegistration(BaseModel):
    tutor: TutorRegister
    child: ChildRegister


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    public_id: UUID  # SQLAlchemy returns uuid.UUID object — Pydantic v2 accepts it natively
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
        return str(v)  # Always output as string to frontend
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str



class TokenData(BaseModel):
    email: Optional[str] = None


class GoogleLoginRequest(BaseModel):
    token: str
    mode: Optional[str] = "mixed" # 'login', 'register', or 'mixed'


class DiscordLoginRequest(BaseModel):
    code: str
    mode: Optional[str] = "mixed" # 'login', 'register', or 'mixed'


class SupabaseAuthRequest(BaseModel):
    access_token: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str
    
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('La contraseña debe tener al menos 8 caracteres')
        return v
    
    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v, info):
        if 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError('Las contraseñas no coinciden')
        return v
