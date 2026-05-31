from __future__ import annotations

import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


# Enums
class UserType(str, enum.Enum):
    TUTOR = "tutor"
    CHILD = "child"
    UNIVERSAL = "universal"
    ADMIN = "admin"


class Gender(str, enum.Enum):
    MASCULINO = "masculino"
    FEMENINO = "femenino"
    OTRO = "otro"






class FollowStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


# =====================================================

# NUEVO MOTOR DE LECCIONES - MODELOS (REDISEÑADO)
# =====================================================

class Lesson(Base):
    """
    Nuevo modelo de lecciones con soporte i18n nativo y estructura plana.
    Reemplaza la antigua jerarquía Adventure > Saga > Lesson.
    """
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(PG_UUID(as_uuid=True), unique=True, index=True, nullable=False, server_default=func.gen_random_uuid())
    lesson_code = Column(String(50), unique=True, nullable=False)  # "1-1-1-1"

    # Metadatos Internacionalizados
    title_es = Column(String(200), nullable=False)
    title_en = Column(String(200), nullable=False)
    description_es = Column(Text)
    description_en = Column(Text)

    # Detalles
    duration = Column(Integer)  # En minutos
    age_rate = Column(String(20))
    points_reward = Column(Integer, default=10)

    # Jerarquía (Niveles)
    adventure_level = Column(Integer, nullable=False)
    saga_level = Column(Integer, nullable=False)
    topic_level = Column(Integer, nullable=False)
    lesson_number = Column(Integer, nullable=False)

    # Contenido (JSON completo por idioma)
    # Contiene array de ejercicios y configuración
    content_es = Column(JSON, nullable=False)
    content_en = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    progress = relationship("UserLessonProgress", back_populates="lesson", cascade="all, delete-orphan")


class UserLessonProgress(Base):
    """
    Progreso simplificado de usuario en lecciones
    """
    __tablename__ = "user_lesson_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)

    completed = Column(Boolean, default=False)
    progress = Column(Integer, default=0)  # 0-100
    score = Column(Integer, default=0)
    points_earned = Column(Integer, default=0)  # Points earned from this lesson
    time_spent_seconds = Column(Integer, default=0)  # Time spent in seconds

    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    lesson = relationship("Lesson", back_populates="progress")
    # user relationship defined in User model


class Character(Base):
    """Personajes narradores (Liruf, Dina, Dr. Rho, Zara Vex)"""
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(PG_UUID(as_uuid=True), unique=True, index=True, nullable=False, server_default=func.gen_random_uuid())
    code = Column(String(50), unique=True, nullable=False)  # e.g., "liruf", "dina", "dr_rho", "zara_vex"
    name = Column(String(100), nullable=False)
    default_appearance = Column(JSON)  # Configuración visual base
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    gestures = relationship("CharacterGesture", back_populates="character", cascade="all, delete-orphan")


class CharacterGesture(Base):
    """Gestos disponibles para cada personaje"""
    __tablename__ = "character_gestures"

    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    gesture_code = Column(String(50), nullable=False)  # e.g., "wave", "celebrate"
    animation_data = Column(JSON)  # Datos de animación
    duration_ms = Column(Integer, default=1000)

    # Relationships
    character = relationship("Character", back_populates="gestures")


# User Model
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(PG_UUID(as_uuid=True), unique=True, index=True, nullable=False, server_default=func.gen_random_uuid())
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    user_type = Column(String, nullable=False)
    birth_date = Column(DateTime)
    gender = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)

    # Family Relationships - Foreign Keys
    tutor_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # SQLAlchemy Relationships
    children = relationship(
        "User",
        foreign_keys=[tutor_id],
        back_populates="tutor",
        remote_side=[id]
    )
    tutor = relationship(
        "User",
        foreign_keys=[tutor_id],
        back_populates="children"
    )

    # Stats
    lessons_completed = Column(Integer, default=0)
    minutes_studied = Column(Integer, default=0)
    points_earned = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)

    # Virtual balance
    balance = Column(Float, default=0.0)

    # Preferences
    preferred_language = Column(String(10), default='es')
    auth_provider = Column(String(20), default='email')

    avatar_config = Column(JSON, nullable=True)
    username = Column(String(30), nullable=True, unique=True)
    max_streak = Column(Integer, default=0)  # Historical max streak
    password_changed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    learning_streaks = relationship("UserLearningStreak", back_populates="user", cascade="all, delete-orphan")
    followers = relationship(
        "Follow",
        foreign_keys="[Follow.followed_id]",
        back_populates="followed",
        cascade="all, delete-orphan"
    )
    following = relationship(
        "Follow",
        foreign_keys="[Follow.follower_id]",
        back_populates="follower",
        cascade="all, delete-orphan"
    )

class Follow(Base):
    __tablename__ = "follows"

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    followed_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default=FollowStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (UniqueConstraint('follower_id', 'followed_id', name='uq_follower_followed'),)

    # Relationships
    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    followed = relationship("User", foreign_keys=[followed_id], back_populates="followers")

class UserLearningStreak(Base):
    """Daily learning activity tracking for streak calculation"""
    __tablename__ = "user_learning_streaks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, nullable=False)  # Date of activity (stored as DATE)
    lessons_completed = Column(Integer, default=0)
    minutes_studied = Column(Integer, default=0)
    points_earned = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="learning_streaks")





# =====================================================
# ADMIN PANEL - MODELOS
# =====================================================

class ContentEditHistory(Base):
    """Historial de ediciones del panel de administración"""
    __tablename__ = "content_edit_history"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(PG_UUID(as_uuid=True), unique=True, index=True, nullable=False, server_default=func.gen_random_uuid())
    editor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    entity_type = Column(String(50), nullable=False)    # lesson, character, gesture, audio
    entity_id = Column(Integer, nullable=False)
    entity_public_id = Column(String(100), nullable=True)
    action = Column(String(20), nullable=False)          # create, update, delete, reorder, rollback
    field_changed = Column(String(100), nullable=True)
    previous_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    edit_metadata = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    editor = relationship("User", foreign_keys=[editor_user_id])

    @property
    def editor_public_id(self) -> str | None:
        return str(self.editor.public_id) if self.editor else None


class LessonAudioSegment(Base):
    """Segmentos de audio para lecciones"""
    __tablename__ = "lesson_audio_segments"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(PG_UUID(as_uuid=True), unique=True, index=True, nullable=False, server_default=func.gen_random_uuid())
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=True)
    exercise_id = Column(Integer, nullable=True)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=True)
    audio_url = Column(String(500), nullable=True)
    transcript = Column(Text, nullable=True)
    emotion = Column(String(30), default='neutral')
    order_index = Column(Integer, default=0)
    duration_ms = Column(Integer, nullable=True)
    language_code = Column(String(10), default='es')
    # target_field identifica qué sub-elemento del ejercicio representa este audio:
    # 'main' (narración/transcript), 'statement', 'question', 'instruction',
    # 'feedback_success', 'feedback_error'
    target_field = Column(String(50), default='main')
    # Campos extendidos para Admin Panel
    tags = Column(JSON, default=[])
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    source = Column(String(20), default='generated')  # 'generated' (TTS) o 'uploaded'
    is_active = Column(Boolean, default=True)

    # Relationships
    lesson = relationship("Lesson", foreign_keys=[lesson_id])
    character = relationship("Character", foreign_keys=[character_id])


# =====================================================
# PLATFORM REPORTS
# =====================================================

class ReportType(str, enum.Enum):
    BUG = "bug"
    ABUSE = "abuse"
    SUGGESTION = "suggestion"
    CONTENT = "content"
    OTHER = "other"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    IN_REVIEW = "in_review"
    RESOLVED = "resolved"
    CLOSED = "closed"


class ReportPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class PlatformReport(Base):
    """Reportes/quejas/sugerencias enviadas por usuarios de la plataforma"""
    __tablename__ = "platform_reports"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(PG_UUID(as_uuid=True), unique=True, index=True, nullable=False, server_default=func.gen_random_uuid())
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reporter_email = Column(String(255), nullable=False, index=True)
    report_type = Column(String(20), nullable=False, default="other", index=True)
    subject = Column(String(200), nullable=False)
    reported_url = Column(String(500), nullable=True)
    context = Column(Text, nullable=False)
    evidence_url = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    priority = Column(String(20), nullable=False, default="low")
    report_metadata = Column("report_metadata", JSON, nullable=True, default=dict)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    @property
    def reporter_public_id(self) -> str | None:
        return str(self.user.public_id) if self.user else None


# =====================================================
# NOTIFICATIONS
# =====================================================

class NotificationType(str, enum.Enum):
    SYSTEM = "system"
    FOLLOW_REQUEST = "follow_request"
    FOLLOW_ACCEPTED = "follow_accepted"
    NEW_FOLLOWER = "new_follower"
    STREAK = "streak"
    ACHIEVEMENT = "achievement"
    ADMIN_BROADCAST = "admin_broadcast"
    REMINDER = "reminder"
    LESSON = "lesson"


class NotificationTargetType(str, enum.Enum):
    ALL = "all"
    USER_TYPE = "user_type"
    SPECIFIC_USER = "specific_user"


class NotificationStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class NotificationPriority(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class Notification(Base):
    """
    Notifications that can target all users, a user type, or a specific user.
    Created by admins (broadcasts) or automatically (follow, streak, etc.).
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(PG_UUID(as_uuid=True), unique=True, index=True, nullable=False, server_default=func.gen_random_uuid())

    # Type & classification
    type = Column(String(30), nullable=False, default=NotificationType.SYSTEM, index=True)
    priority = Column(String(10), nullable=False, default=NotificationPriority.NORMAL)
    status = Column(String(10), nullable=False, default=NotificationStatus.ACTIVE, index=True)

    # Multilingual content
    title_es = Column(String(300), nullable=False)
    title_en = Column(String(300), nullable=False)
    body_es = Column(Text, nullable=True)
    body_en = Column(Text, nullable=True)

    # Media & actions
    media_url = Column(String(500), nullable=True)
    action_url = Column(String(500), nullable=True)

    # Targeting
    target_type = Column(String(20), nullable=False, default=NotificationTargetType.ALL)
    target_value = Column(String(100), nullable=True)  # user public_id or user_type value

    # Metadata
    notif_metadata = Column("notif_metadata", JSON, nullable=True)  # Extra data (e.g. follower username, streak count)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    user_notifications = relationship("UserNotification", back_populates="notification", cascade="all, delete-orphan")


class UserNotification(Base):
    """
    Junction table: tracks per-user read/dismissed state for each notification.
    Created lazily when a user fetches notifications, or eagerly for targeted ones.
    """
    __tablename__ = "user_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    notification_id = Column(Integer, ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    dismissed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'notification_id', name='uq_user_notification'),
        Index('ix_user_notif_user_read', 'user_id', 'read_at'),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    notification = relationship("Notification", back_populates="user_notifications")
