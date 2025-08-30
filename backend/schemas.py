from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum

# Enums
class UserTypeEnum(str, Enum):
    TUTOR = "tutor"
    CHILD = "child"
    SPONSOR = "sponsor"

class TaskCategoryEnum(str, Enum):
    CHORES = "chores"
    EDUCATION = "education"
    SOCIAL = "social"
    BONUS = "bonus"

class TaskDifficultyEnum(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class TaskStatusEnum(str, Enum):
    ASSIGNED = "assigned"
    PENDING = "pending"
    COMPLETED = "completed"
    REJECTED = "rejected"

class GenderEnum(str, Enum):
    MASCULINO = "masculino"
    FEMENINO = "femenino"
    OTRO = "otro"

# Schemas para Usuario
class UserBase(BaseModel):
    name: str
    email: EmailStr
    user_type: UserTypeEnum
    birth_date: Optional[str] = None
    gender: Optional[GenderEnum] = None

class UserCreate(UserBase):
    password: str
    tutor_email: Optional[str] = None  # Para niños
    child_email: Optional[str] = None  # Para patrocinadores

class UserUpdate(BaseModel):
    name: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[GenderEnum] = None
    lessons_completed: Optional[int] = None
    minutes_studied: Optional[int] = None
    points_earned: Optional[int] = None

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    user_type: UserTypeEnum
    birth_date: Optional[str] = None
    gender: Optional[GenderEnum] = None
    created_at: datetime
    tutor_email: Optional[str] = None
    child_email: Optional[str] = None
    lessons_completed: Optional[int] = None
    minutes_studied: Optional[int] = None
    points_earned: Optional[int] = None
    
    class Config:
        from_attributes = True

# Schemas para Tareas
class TaskBase(BaseModel):
    title: str
    description: str
    category: TaskCategoryEnum
    difficulty: TaskDifficultyEnum
    reward: float
    time_estimate: int  # En minutos
    due_date: Optional[datetime] = None
    is_important: bool = False

    @validator('reward')
    def validate_reward(cls, v):
        if v <= 0:
            raise ValueError('La recompensa debe ser mayor a 0')
        return v
    
    @validator('time_estimate')
    def validate_time_estimate(cls, v):
        if v <= 0:
            raise ValueError('El tiempo estimado debe ser mayor a 0 minutos')
        return v

class TaskCreate(TaskBase):
    assigned_to_email: str

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[TaskCategoryEnum] = None
    difficulty: Optional[TaskDifficultyEnum] = None
    reward: Optional[float] = None
    time_estimate: Optional[int] = None
    due_date: Optional[datetime] = None
    is_important: Optional[bool] = None
    notes: Optional[str] = None

class TaskComplete(BaseModel):
    photo_evidence_url: Optional[str] = None

class TaskApproval(BaseModel):
    approved: bool
    notes: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    title: str
    description: str
    category: TaskCategoryEnum
    difficulty: TaskDifficultyEnum
    reward: float
    time_estimate: int
    due_date: Optional[datetime] = None
    is_important: bool
    status: TaskStatusEnum
    created_at: datetime
    completed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    assigned_by: UserResponse
    assigned_to: UserResponse
    notes: Optional[str] = None
    photo_evidence_url: Optional[str] = None
    original_task_id: Optional[str] = None
    
    class Config:
        from_attributes = True

# Schema para registro completo de familia
class FamilyRegistration(BaseModel):
    tutor: UserCreate
    child: UserCreate
    sponsor: Optional[UserCreate] = None

class FamilyRegistrationResponse(BaseModel):
    tutor: UserResponse
    child: UserResponse
    sponsor: Optional[UserResponse] = None
    message: str

# Schemas para recompensas
class RewardCreate(BaseModel):
    task_id: str
    amount: float

class RewardResponse(BaseModel):
    id: str
    task_id: str
    child_id: str
    amount: float
    paid_at: datetime
    paid_by_id: str
    
    class Config:
        from_attributes = True

# Schema para configuración familiar
class FamilySettingsCreate(BaseModel):
    weekly_allowance: float = 0.0
    task_completion_goal: int = 5
    auto_approve_photos: bool = False
    require_photo_evidence: bool = False

class FamilySettingsUpdate(BaseModel):
    weekly_allowance: Optional[float] = None
    task_completion_goal: Optional[int] = None
    auto_approve_photos: Optional[bool] = None
    require_photo_evidence: Optional[bool] = None

class FamilySettingsResponse(BaseModel):
    id: str
    tutor_id: str
    weekly_allowance: float
    task_completion_goal: int
    auto_approve_photos: bool
    require_photo_evidence: bool
    
    class Config:
        from_attributes = True

# Schema para historial de tareas
class TaskHistoryResponse(BaseModel):
    id: str
    task_id: str
    action: str
    performed_by: UserResponse
    performed_at: datetime
    notes: Optional[str] = None
    
    class Config:
        from_attributes = True

# Schema para estadísticas
class TaskStatistics(BaseModel):
    total_tasks_assigned: int
    total_tasks_completed: int
    total_tasks_pending: int
    total_tasks_rejected: int
    total_earnings: float
    weekly_earnings: float
    completion_rate: float
    average_completion_time: Optional[float] = None  # En días

class ChildProgress(BaseModel):
    child: UserResponse
    statistics: TaskStatistics
    recent_tasks: List[TaskResponse]

# Schema de login y autenticación
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None