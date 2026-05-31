from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class UserPublicProfile(BaseModel):
    public_id: str
    username: str
    name: str | None = None
    avatar_config: dict | None = None
    lessons_completed: int = 0
    points_earned: int = 0
    current_streak: int = 0
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False
    follow_status: str | None = None

    class Config:
        from_attributes = True

class FollowActionResponse(BaseModel):
    message: str
    status: str

class FollowRequestResponse(BaseModel):
    public_id: str
    username: str
    name: str | None = None
    avatar_config: dict | None = None
    requested_at: datetime

    class Config:
        from_attributes = True
