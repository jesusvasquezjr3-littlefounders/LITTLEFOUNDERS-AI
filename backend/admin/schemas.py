"""
backend/admin/schemas.py
Schemas para request/response de todos los endpoints admin.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime


# ──── LECCIONES ────

class LessonMetadataUpdate(BaseModel):
    """Para crear o actualizar metadata de una lección."""
    lesson_code: str = Field(..., pattern=r'^\d+-\d+-\d+-\d+$')
    title_es: str = Field(..., min_length=1, max_length=200)
    title_en: str = Field(..., min_length=1, max_length=200)
    description_es: Optional[str] = None
    description_en: Optional[str] = None
    duration: Optional[int] = Field(None, ge=1, le=3600)
    age_rate: Optional[str] = None
    points_reward: int = Field(10, ge=1, le=1000)
    adventure_level: int = Field(..., ge=1, le=6)
    saga_level: int = Field(..., ge=1, le=10)
    topic_level: int = Field(..., ge=1, le=20)
    lesson_number: int = Field(..., ge=1, le=50)


class LessonContentUpdate(BaseModel):
    """Para actualizar el contenido completo de ejercicios."""
    content_es: List[dict]
    content_en: List[dict]


class LessonFullCreate(LessonMetadataUpdate):
    """Combinación de metadata + contenido para crear lección."""
    content_es: List[dict] = Field(default_factory=list)
    content_en: List[dict] = Field(default_factory=list)


class LessonFullUpdate(BaseModel):
    """Para actualizar una lección existente (todos los campos opcionales)."""
    lesson_code: Optional[str] = Field(None, pattern=r'^\d+-\d+-\d+-\d+$')
    title_es: Optional[str] = Field(None, min_length=1, max_length=200)
    title_en: Optional[str] = Field(None, min_length=1, max_length=200)
    description_es: Optional[str] = None
    description_en: Optional[str] = None
    duration: Optional[int] = Field(None, ge=1, le=3600)
    age_rate: Optional[str] = None
    points_reward: Optional[int] = Field(None, ge=1, le=1000)
    adventure_level: Optional[int] = Field(None, ge=1, le=6)
    saga_level: Optional[int] = Field(None, ge=1, le=10)
    topic_level: Optional[int] = Field(None, ge=1, le=20)
    lesson_number: Optional[int] = Field(None, ge=1, le=50)
    content_es: Optional[List[dict]] = None
    content_en: Optional[List[dict]] = None


class LessonResponse(BaseModel):
    public_id: str
    lesson_code: str
    title_es: str
    title_en: str
    description_es: Optional[str] = None
    description_en: Optional[str] = None
    duration: Optional[int] = None
    age_rate: Optional[str] = None
    points_reward: int
    adventure_level: int
    saga_level: int
    topic_level: int
    lesson_number: int
    content_es: List[dict]
    content_en: List[dict]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

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
    duration: Optional[int] = None
    exercise_count_es: int = 0
    exercise_count_en: int = 0
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LessonListResponse(BaseModel):
    items: List[LessonListItem]
    total: int
    page: int
    page_size: int


# ──── EJERCICIOS ────

class ExerciseCreate(BaseModel):
    """Para agregar un ejercicio a una lección."""
    type: str
    content: dict
    correct_answer: Optional[dict] = None
    feedback: Optional[dict] = None
    character_code: Optional[str] = None


class ExerciseUpdate(BaseModel):
    """Para actualizar un ejercicio existente."""
    type: Optional[str] = None
    content: Optional[dict] = None
    correct_answer: Optional[dict] = None
    feedback: Optional[dict] = None
    character_code: Optional[str] = None


class ExerciseReorder(BaseModel):
    """Para reordenar ejercicios."""
    new_order: List[int]


# ──── PERSONAJES ────

class CharacterCreate(BaseModel):
    code: str = Field(..., pattern=r'^[a-z_]{2,30}$')
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    default_appearance: Optional[dict] = None


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_appearance: Optional[dict] = None
    is_active: Optional[bool] = None


class CharacterResponse(BaseModel):
    public_id: str
    code: str
    name: str
    description: Optional[str] = None
    default_appearance: Optional[dict] = None
    is_active: bool
    gestures: List[dict] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GestureCreate(BaseModel):
    gesture_code: str
    animation_data: Optional[dict] = None
    duration_ms: int = Field(1000, ge=100, le=30000)


class GestureUpdate(BaseModel):
    gesture_code: Optional[str] = None
    animation_data: Optional[dict] = None
    duration_ms: Optional[int] = Field(None, ge=100, le=30000)


# ──── AUDIO ────

class AudioGenerateRequest(BaseModel):
    """Para generar audio con el LF Audio Engine (TTS)."""
    text: str = Field(..., min_length=1, max_length=5000)
    character_code: str
    emotion: str = "neutral"
    language_code: str = "es"
    lesson_public_id: Optional[str] = None  # lesson public UUID or lesson_code
    exercise_index: Optional[int] = None


class AudioResponse(BaseModel):
    public_id: str
    lesson_code: Optional[str] = None
    exercise_id: Optional[int] = None
    character_code: Optional[str] = None
    audio_url: Optional[str] = None
    transcript: Optional[str] = None
    emotion: Optional[str] = None
    language_code: str = "es"
    source: str = "generated"
    tags: list = []
    is_active: bool = True

    class Config:
        from_attributes = True


# ──── HISTORIAL ────

class HistoryEntry(BaseModel):
    public_id: str = Field(alias="id")  # We map public_id to 'id' for frontend compatibility
    editor_public_id: Optional[str] = None
    editor_name: Optional[str] = None
    entity_type: str
    entity_public_id: Optional[str] = Field(None, alias="entity_id") # Map public_id to entity_id
    action: str
    field_changed: Optional[str] = None
    previous_value: Optional[Any] = None
    new_value: Optional[Any] = None
    metadata: Optional[dict] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HistoryListResponse(BaseModel):
    items: List[HistoryEntry]
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
    recent_edits: List[HistoryEntry]
    lessons_by_adventure: Dict[str, int]


# ──── USUARIOS ADMIN ────

class AdminUserResponse(BaseModel):
    public_id: str
    name: str
    email: str
    user_type: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
