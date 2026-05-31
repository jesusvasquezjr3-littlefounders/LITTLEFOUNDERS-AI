from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, model_validator


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
    description: str | None = None
    duration: str | None = None
    difficulty: str
    age_range: str | None = None
    level_id: str | None = None
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
    description: str | None = None
    age_range: str | None = None
    order_index: int = 0
    theme_color: str | None = None
    background_scene: str | None = None
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
    description: str | None = None
    order_index: int = 0
    icon: str | None = None
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
    description: str | None = None

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
    pause_at_ms: int | None = None
    content: dict
    correct_answer: dict | None = None
    feedback: dict | None = None
    points: int
    audio: dict | None = None  # Audio segment si existe


# Lesson Play Response (para /api/lessons/{code}/play)
class LessonMeta(BaseModel):
    estimated_duration_seconds: int
    points_reward: int
    xp_reward: int


class LessonPlayResponse(BaseModel):
    """Respuesta completa para reproducir una lección"""
    lesson: dict
    meta: LessonMeta
    timeline: list[ExerciseInTimeline]


# Lesson Complete Request
class LessonCompleteRequest(BaseModel):
    score: int = 100  # User's score (0-100)
    time_spent_seconds: int = 180  # Time spent on lesson
    exercises_results: list[dict] | None = None  # [{exercise_id, status, attempts}]
    local_date: str | None = None  # User's local YYYY-MM-DD for timezone-aware streak tracking


# User Stats for Dashboard
class AdventureProgress(BaseModel):
    adventure_id: int
    adventure_title: str
    adventure_code: str
    total_lessons: int
    completed_lessons: int
    progress_percent: float
    current_saga: str | None = None


class UserLessonStats(BaseModel):
    adventure_progress: list[AdventureProgress]
    total_xp: int
    current_streak: int
    lessons_this_week: int
    average_accuracy: float
    lessons_needing_review: int
