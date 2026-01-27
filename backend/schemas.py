from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# Base Schemas
class ResponseBase(BaseModel):
    success: bool
    message: str


# Dashboard Schemas
class DashboardStats(BaseModel):
    lessons_completed: int
    minutes_studied: int
    points_earned: int
    current_streak: int
    balance: float


# Lesson Schemas
class LessonBase(BaseModel):
    lesson_id: str
    title: str
    description: Optional[str] = None
    duration: Optional[str] = None
    difficulty: str
    age_range: Optional[str] = None
    level_id: Optional[str] = None


class LessonCreate(LessonBase):
    content: Optional[str] = None
    activities: Optional[List[str]] = None
    points_reward: Optional[int] = 10


class LessonResponse(LessonBase):
    id: int
    points_reward: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class LessonProgressUpdate(BaseModel):
    lesson_id: int
    progress: int
    time_spent: Optional[int] = 0


class LessonComplete(BaseModel):
    lesson_id: int
    time_spent: int


# Task Schemas
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    difficulty: str
    reward: float
    time_estimate: Optional[int] = None
    due_date: Optional[datetime] = None
    is_first_dibs: Optional[bool] = False


class TaskCreate(TaskBase):
    assigned_to: Optional[int] = None


class TaskResponse(TaskBase):
    id: int
    created_by: int
    assigned_to: Optional[int] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class TaskComplete(BaseModel):
    task_id: int
    photo_evidence: Optional[str] = None


class TaskApproval(BaseModel):
    user_task_id: int
    is_approved: bool


# Savings Schemas
class SavingsGoalBase(BaseModel):
    title: str
    description: Optional[str] = None
    target_amount: float
    category: Optional[str] = "other"
    deadline: Optional[datetime] = None
    image_url: Optional[str] = None
    parent_match_percentage: Optional[int] = 0
    round_up_enabled: Optional[bool] = False


class SavingsGoalCreate(SavingsGoalBase):
    assigned_to: Optional[int] = None  # For tutors assigning goals to children


class SavingsGoalUpdate(BaseModel):
    current_amount: Optional[float] = None
    is_active: Optional[bool] = None
    category: Optional[str] = None
    parent_match_percentage: Optional[int] = None
    round_up_enabled: Optional[bool] = None


class SavingsGoalResponse(SavingsGoalBase):
    id: int
    user_id: int
    created_by: int
    assigned_to: Optional[int] = None
    current_amount: float
    is_active: bool
    created_at: datetime
    user_name: Optional[str] = None  # Nombre del usuario propietario
    
    class Config:
        from_attributes = True


class TransactionCreate(BaseModel):
    transaction_type: str
    amount: float
    description: Optional[str] = None
    category: Optional[str] = None


class TransactionResponse(BaseModel):
    id: int
    user_id: int
    transaction_type: str
    amount: float
    description: Optional[str] = None
    category: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Store Schemas
class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: Optional[str] = None
    image_url: Optional[str] = None
    rating: Optional[float] = 0.0
    in_stock: Optional[int] = 0


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class PurchaseItem(BaseModel):
    product_id: int
    quantity: int


class PurchaseCreate(BaseModel):
    items: List[PurchaseItem]


class PurchaseResponse(BaseModel):
    id: int
    user_id: int
    product_id: int
    quantity: int
    total_price: float
    purchased_at: datetime
    
    class Config:
        from_attributes = True


# Achievement Schemas
class AchievementBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    rarity: str
    requirement_type: str
    requirement_value: int


class AchievementResponse(AchievementBase):
    id: int
    is_active: bool
    
    class Config:
        from_attributes = True


class UserAchievementResponse(BaseModel):
    id: int
    user_id: int
    achievement_id: int
    earned_date: datetime
    achievement: Optional[AchievementResponse] = None
    
    class Config:
        from_attributes = True


# Game Session Schemas
class GameSessionCreate(BaseModel):
    game_type: str


class GameSessionUpdate(BaseModel):
    day_number: Optional[int] = None
    cash: Optional[float] = None
    inventory: Optional[dict] = None
    recipe: Optional[dict] = None
    weather: Optional[str] = None
    temperature: Optional[int] = None
    location: Optional[str] = None
    weather_forecast: Optional[dict] = None
    decisions: Optional[dict] = None
    daily_stats: Optional[dict] = None
    achievements: Optional[list] = None
    reputation: Optional[int] = None
    experience: Optional[int] = None
    level: Optional[int] = None
    score: Optional[int] = None


class GameSessionResponse(BaseModel):
    id: int
    user_id: int
    game_type: str
    day_number: int
    cash: float
    inventory: Optional[dict] = None
    recipe: Optional[dict] = None
    weather: Optional[str] = None
    temperature: Optional[int] = None
    location: Optional[str] = None
    weather_forecast: Optional[dict] = None
    decisions: Optional[dict] = None
    daily_stats: Optional[dict] = None
    achievements: Optional[list] = None
    reputation: Optional[int] = None
    experience: Optional[int] = None
    level: Optional[int] = None
    score: int
    is_active: bool
    started_at: datetime
    ended_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# =====================================================
# NUEVO MOTOR DE LECCIONES - SCHEMAS
# =====================================================

# Adventure Schemas
class AdventureBase(BaseModel):
    code: str
    title: str
    description: Optional[str] = None
    age_range: Optional[str] = None
    order_index: int = 0
    theme_color: Optional[str] = None
    background_scene: Optional[str] = None


class AdventureResponse(AdventureBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class AdventureWithProgress(AdventureResponse):
    total_sagas: int = 0
    completed_sagas: int = 0
    total_lessons: int = 0
    completed_lessons: int = 0
    progress_percent: float = 0.0


# Saga Schemas
class SagaBase(BaseModel):
    code: str
    title: str
    description: Optional[str] = None
    order_index: int = 0
    icon: Optional[str] = None


class SagaResponse(SagaBase):
    id: int
    adventure_id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class SagaWithProgress(SagaResponse):
    total_lessons: int = 0
    completed_lessons: int = 0
    progress_percent: float = 0.0


# Character Schemas
class CharacterVoiceResponse(BaseModel):
    """Voz de personaje por idioma"""
    id: int
    character_id: int
    language: str
    elevenlabs_voice_id: str
    voice_name: Optional[str] = None
    is_primary: bool = False
    
    class Config:
        from_attributes = True


class CharacterResponse(BaseModel):
    id: int
    code: str
    name: str
    elevenlabs_voice_id: Optional[str] = None  # Legacy, para retrocompatibilidad
    voices: Optional[List[CharacterVoiceResponse]] = None  # Voces por idioma
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


class GestureResponse(BaseModel):
    gesture_code: str
    duration_ms: int
    
    class Config:
        from_attributes = True


# Exercise Schemas
class ExerciseContent(BaseModel):
    """Contenido de un ejercicio en el timeline"""
    question: Optional[str] = None
    characterCode: Optional[str] = None
    gesture: Optional[str] = None
    emotion: Optional[str] = None
    transcript: Optional[str] = None
    options: Optional[List] = None


class ExerciseInTimeline(BaseModel):
    id: int
    type: str
    order_index: int
    start_time_ms: int
    pause_at_ms: Optional[int] = None
    content: dict
    correct_answer: Optional[dict] = None
    feedback: Optional[dict] = None
    points: int
    audio: Optional[dict] = None  # Audio segment si existe


# Lesson Play Response (para /api/lessons/{code}/play)
class LessonMeta(BaseModel):
    estimated_duration_seconds: int
    points_reward: int
    xp_reward: int


class LessonPlayResponse(BaseModel):
    """Respuesta completa para reproducir una lección"""
    lesson: dict
    meta: LessonMeta
    timeline: List[ExerciseInTimeline]


# Lesson Complete Request
class LessonCompleteRequest(BaseModel):
    time_spent_seconds: int
    exercises_results: Optional[List[dict]] = None  # [{exercise_id, status, attempts}]


class LessonCompleteResponse(BaseModel):
    message: str
    points_earned: int
    xp_earned: int
    total_lessons_completed: int
    achievements_unlocked: Optional[List[dict]] = None


# User Stats for Dashboard
class AdventureProgress(BaseModel):
    adventure_id: int
    adventure_title: str
    adventure_code: str
    total_lessons: int
    completed_lessons: int
    progress_percent: float
    current_saga: Optional[str] = None


class UserLessonStats(BaseModel):
    adventure_progress: List[AdventureProgress]
    total_xp: int
    current_streak: int
    lessons_this_week: int
    average_accuracy: float
    lessons_needing_review: int
