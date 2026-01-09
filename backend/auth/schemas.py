from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


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
    id: int
    name: str
    email: str
    user_type: str
    created_at: datetime
    lessons_completed: Optional[int] = 0
    minutes_studied: Optional[int] = 0
    points_earned: Optional[int] = 0
    balance: Optional[float] = 0.0
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None

