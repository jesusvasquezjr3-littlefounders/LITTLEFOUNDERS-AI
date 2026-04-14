from pydantic import BaseModel, EmailStr, model_validator
from typing import Optional, List
from datetime import datetime


# Dashboard Schemas
class DashboardStats(BaseModel):
    lessons_completed: int
    minutes_studied: int
    points_earned: int
    current_streak: int
    balance: float


# Lesson Schemas
class LessonResponse(BaseModel):
    id: int
    lesson_id: str
    title: str
    description: Optional[str] = None
    duration: Optional[str] = None
    difficulty: str
    age_range: Optional[str] = None
    level_id: Optional[str] = None
    points_reward: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LessonComplete(BaseModel):
    lesson_id: int
    time_spent: int


# =====================================================
# MOTOR DE LECCIONES - SCHEMAS ACTIVOS
# =====================================================

# Adventure Schemas
class AdventureResponse(BaseModel):
    id: int
    code: str
    title: str
    description: Optional[str] = None
    age_range: Optional[str] = None
    order_index: int = 0
    theme_color: Optional[str] = None
    background_scene: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AdventureWithProgress(AdventureResponse):
    theme: str = ""  # Frontend theme name (archipelago, forest, etc.)
    total_sagas: int = 0
    completed_sagas: int = 0
    total_lessons: int = 0
    completed_lessons: int = 0
    progress_percent: float = 0.0


# Saga Schemas
class SagaResponse(BaseModel):
    id: int
    code: str
    title: str
    description: Optional[str] = None
    order_index: int = 0
    icon: Optional[str] = None
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
class CharacterResponse(BaseModel):
    """Personaje para LF Audio Engine"""
    id: str    # public_id serialized as string (not internal integer)
    code: str  # Used by LF Audio Engine: liruf, dina, dr_rho, zara_vex
    name: str
    description: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def extract_public_id(cls, data):
        if hasattr(data, 'public_id'):
            return {
                'id': str(data.public_id),
                'code': data.code,
                'name': data.name,
                'description': getattr(data, 'description', None),
            }
        return data

    class Config:
        from_attributes = True


class GestureResponse(BaseModel):
    gesture_code: str
    duration_ms: int

    class Config:
        from_attributes = True


# Exercise Schemas (used internally by LessonPlayResponse)
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
    score: int = 100  # User's score (0-100)
    time_spent_seconds: int = 180  # Time spent on lesson
    exercises_results: Optional[List[dict]] = None  # [{exercise_id, status, attempts}]
    local_date: Optional[str] = None  # User's local YYYY-MM-DD for timezone-aware streak tracking


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
