from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserPublicProfile(BaseModel):
    public_id: str
    username: str
    name: Optional[str] = None
    avatar_config: Optional[dict] = None
    lessons_completed: int = 0
    points_earned: int = 0
    current_streak: int = 0
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False
    follow_status: Optional[str] = None 
    
    class Config:
        from_attributes = True

class FollowActionResponse(BaseModel):
    message: str
    status: str

class FollowRequestResponse(BaseModel):
    public_id: str
    username: str
    name: Optional[str] = None
    avatar_config: Optional[dict] = None
    requested_at: datetime
    
    class Config:
        from_attributes = True
