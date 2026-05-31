"""
backend/admin/schemas.py
Schemas para request/response de todos los endpoints admin.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# ──── LECCIONES ────

class LessonMetadataUpdate(BaseModel):
    """Para crear o actualizar metadata de una lección."""
    lesson_code: str = Field(..., pattern=r'^\d+-\d+-\d+-\d+$')
    title_es: str = Field(..., min_length=1, max_length=200)
    title_en: str = Field(..., min_length=1, max_length=200)
    description_es: str | None = None
    description_en: str | None = None
    duration: int | None = Field(None, ge=1, le=3600)
    age_rate: str | None = None
    points_reward: int = Field(10, ge=1, le=1000)
    adventure_level: int = Field(..., ge=1, le=6)
    saga_level: int = Field(..., ge=1, le=10)
    topic_level: int = Field(..., ge=1, le=20)
    lesson_number: int = Field(..., ge=1, le=50)


class LessonContentUpdate(BaseModel):
    """Para actualizar el contenido completo de ejercicios."""
    content_es: list[dict]
    content_en: list[dict]


class LessonFullCreate(LessonMetadataUpdate):
    """Combinación de metadata + contenido para crear lección."""
    content_es: list[dict] = Field(default_factory=list)
    content_en: list[dict] = Field(default_factory=list)


class LessonFullUpdate(BaseModel):
    """Para actualizar una lección existente (todos los campos opcionales)."""
    lesson_code: str | None = Field(None, pattern=r'^\d+-\d+-\d+-\d+$')
    title_es: str | None = Field(None, min_length=1, max_length=200)
    title_en: str | None = Field(None, min_length=1, max_length=200)
    description_es: str | None = None
    description_en: str | None = None
    duration: int | None = Field(None, ge=1, le=3600)
    age_rate: str | None = None
    points_reward: int | None = Field(None, ge=1, le=1000)
    adventure_level: int | None = Field(None, ge=1, le=6)
    saga_level: int | None = Field(None, ge=1, le=10)
    topic_level: int | None = Field(None, ge=1, le=20)
    lesson_number: int | None = Field(None, ge=1, le=50)
    content_es: list[dict] | None = None
    content_en: list[dict] | None = None


class LessonResponse(BaseModel):
    public_id: str
    lesson_code: str
    title_es: str
    title_en: str
    description_es: str | None = None
    description_en: str | None = None
    duration: int | None = None
    age_rate: str | None = None
    points_reward: int
    adventure_level: int
    saga_level: int
    topic_level: int
    lesson_number: int
    content_es: list[dict]
    content_en: list[dict]
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class LessonListItem(BaseModel):
    """Versión ligera para listados (sin content)."""
    public_id: str
    lesson_code: str
    title_es: str
    title_en: str
    adventure_level: int
    saga_level: int
    topic_level: int
    lesson_number: int
    points_reward: int
    duration: int | None = None
    exercise_count_es: int = 0
    exercise_count_en: int = 0
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class LessonListResponse(BaseModel):
    items: list[LessonListItem]
    total: int
    page: int
    page_size: int


# ──── EJERCICIOS ────

class ExerciseCreate(BaseModel):
    """Para agregar un ejercicio a una lección."""
    type: str
    content: dict
    correct_answer: dict | None = None
    feedback: dict | None = None
    character_code: str | None = None


class ExerciseUpdate(BaseModel):
    """Para actualizar un ejercicio existente."""
    type: str | None = None
    content: dict | None = None
    correct_answer: dict | None = None
    feedback: dict | None = None
    character_code: str | None = None


class ExerciseReorder(BaseModel):
    """Para reordenar ejercicios."""
    new_order: list[int]


# ──── PERSONAJES ────

class CharacterCreate(BaseModel):
    code: str = Field(..., pattern=r'^[a-z_]{2,30}$')
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    default_appearance: dict | None = None


class CharacterUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    default_appearance: dict | None = None
    is_active: bool | None = None


class CharacterResponse(BaseModel):
    public_id: str
    code: str
    name: str
    description: str | None = None
    default_appearance: dict | None = None
    is_active: bool
    gestures: list[dict] = []
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class GestureCreate(BaseModel):
    gesture_code: str
    animation_data: dict | None = None
    duration_ms: int = Field(1000, ge=100, le=30000)


class GestureUpdate(BaseModel):
    gesture_code: str | None = None
    animation_data: dict | None = None
    duration_ms: int | None = Field(None, ge=100, le=30000)


# ──── AUDIO ────

class AudioGenerateRequest(BaseModel):
    """Para generar audio con el LF Audio Engine (TTS)."""
    text: str = Field(..., min_length=1, max_length=5000)
    character_code: str
    emotion: str = "neutral"
    language_code: str = "es"
    lesson_public_id: str | None = None  # lesson public UUID or lesson_code
    exercise_index: int | None = None
    target_field: str = "main"  # main, statement, question, instruction, feedback_success, feedback_error


class AudioResponse(BaseModel):
    public_id: str
    lesson_code: str | None = None
    exercise_id: int | None = None
    target_field: str = "main"  # main, statement, question, instruction, feedback_success, feedback_error
    character_code: str | None = None
    audio_url: str | None = None
    transcript: str | None = None
    emotion: str | None = None
    language_code: str = "es"
    source: str = "generated"
    tags: list = []
    is_active: bool = True

    class Config:
        from_attributes = True


# ──── HISTORIAL ────

class HistoryEntry(BaseModel):
    public_id: str = Field(alias="id")  # We map public_id to 'id' for frontend compatibility
    editor_public_id: str | None = None
    editor_name: str | None = None
    entity_type: str
    entity_public_id: str | None = Field(None, alias="entity_id") # Map public_id to entity_id
    action: str
    field_changed: str | None = None
    previous_value: Any | None = None
    new_value: Any | None = None
    metadata: dict | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class HistoryListResponse(BaseModel):
    items: list[HistoryEntry]
    total: int
    page: int
    page_size: int


class RollbackRequest(BaseModel):
    """Confirmar rollback de una edición."""
    confirm: bool = True


# ──── DASHBOARD ADMIN ────

class AdminStats(BaseModel):
    total_lessons: int
    total_exercises: int
    total_characters: int
    total_audio_segments: int
    recent_edits: list[HistoryEntry]
    lessons_by_adventure: dict[str, int]


# ──── USUARIOS ADMIN ────

class AdminUserResponse(BaseModel):
    public_id: str
    name: str
    email: str
    user_type: str
    is_active: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True
