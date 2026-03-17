from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, Enum, JSON, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum
import uuid
from typing import Optional


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






class TaskCategory(str, enum.Enum):
    CHORES = "chores"
    EDUCATION = "education"
    SOCIAL = "social"
    BONUS = "bonus"


class TaskDifficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class TransactionType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    REWARD = "reward"
    PURCHASE = "purchase"


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
    password_hash = Column(String(255), nullable=False)
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
    has_virtual_card = Column(Boolean, default=False)
    
    # Digital banking
    banking_activated = Column(Boolean, default=False)
    banking_activated_at = Column(DateTime(timezone=True), nullable=True)
    banking_activated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Preferences
    preferred_language = Column(String(10), default='es')
    auth_provider = Column(String(20), default='email')
    google_id = Column(String(100), nullable=True, unique=True)
    discord_id = Column(String(100), nullable=True, unique=True)
    
    avatar_config = Column(JSON, nullable=True)
    username = Column(String(30), nullable=True, unique=True)
    max_streak = Column(Integer, default=0)  # Historical max streak
    
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





# Task Models
class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(Enum(TaskCategory), default=TaskCategory.CHORES)
    difficulty = Column(Enum(TaskDifficulty), default=TaskDifficulty.EASY)
    reward = Column(Float, nullable=False)  # Money reward
    time_estimate = Column(Integer)  # in minutes
    due_date = Column(DateTime)
    is_first_dibs = Column(Boolean, default=False)  # Special/urgent task
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class UserTask(Base):
    __tablename__ = "user_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    is_completed = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=None, nullable=True)
    photo_evidence = Column(String(500))  # URL to photo
    completed_date = Column(DateTime(timezone=True))
    approval_date = Column(DateTime(timezone=True))
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())


# Savings Models
class SavingsGoal(Base):
    __tablename__ = "savings_goals"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Owner of the goal
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # Who created the goal (tutor/child)
    assigned_to = Column(Integer, ForeignKey("users.id"))  # For tutors assigning goals to children
    title = Column(String(200), nullable=False)
    description = Column(Text)
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0)
    category = Column(String(50), default='other')  # toy, education, experience, electronics, other
    deadline = Column(DateTime)
    image_url = Column(String(500))
    parent_match_percentage = Column(Integer, default=0)  # Porcentaje de match del tutor
    round_up_enabled = Column(Boolean, default=False)  # Redondeo automático
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    transaction_type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String(300))
    category = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# Store Models
class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    category = Column(String(50))
    image_url = Column(String(500))
    rating = Column(Float, default=0.0)
    in_stock = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Purchase(Base):
    __tablename__ = "purchases"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=1)
    total_price = Column(Float, nullable=False)
    purchased_at = Column(DateTime(timezone=True), server_default=func.now())


# Achievement and Badge Models
class Achievement(Base):
    __tablename__ = "achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon = Column(String(50))  # Icon name
    color = Column(String(50))  # Color class
    rarity = Column(String(20))  # common, rare, epic, legendary
    requirement_type = Column(String(50))  # lessons_completed, points_earned, etc.
    requirement_value = Column(Integer)
    is_active = Column(Boolean, default=True)


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    achievement_id = Column(Integer, ForeignKey("achievements.id"), nullable=False)
    earned_date = Column(DateTime(timezone=True), server_default=func.now())


# Investment Game Models (Lemonade Stand)
class GameSession(Base):
    __tablename__ = "game_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    game_type = Column(String(50))  # "lemonade_stand", etc.
    day_number = Column(Integer, default=1)
    cash = Column(Float, default=50.0)
    inventory = Column(JSON)  # Ingredients inventory: {lemons, sugar, cups, ice}
    recipe = Column(JSON)  # Recipe settings: {lemonsPerCup, sugarPerCup, icePerCup, price}
    weather = Column(String(20))  # Current weather: sunny, cloudy, rainy, cold
    temperature = Column(Integer)  # Temperature
    location = Column(String(50))  # Location: park, school, mall, beach
    weather_forecast = Column(JSON)  # Weather predictions
    decisions = Column(JSON)  # Daily decisions
    daily_stats = Column(JSON)  # Daily statistics: {cupsSold, revenue, profit, customersServed}
    achievements = Column(JSON)  # Array of achievement IDs
    reputation = Column(Integer, default=50)  # Customer reputation (0-100)
    experience = Column(Integer, default=0)  # XP points
    level = Column(Integer, default=1)  # Player level
    score = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True))


# =====================================================
# ADMIN PANEL - MODELOS
# =====================================================

class ContentEditHistory(Base):
    """Historial de ediciones del panel de administración"""
    __tablename__ = "content_edit_history"

    id = Column(Integer, primary_key=True, index=True)
    editor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    entity_type = Column(String(50), nullable=False)    # lesson, character, gesture, audio
    entity_id = Column(Integer, nullable=False)
    action = Column(String(20), nullable=False)          # create, update, delete, reorder, rollback
    field_changed = Column(String(100), nullable=True)
    previous_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    edit_metadata = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    editor = relationship("User", foreign_keys=[editor_user_id])

    @property
    def editor_public_id(self) -> Optional[str]:
        return str(self.editor.public_id) if self.editor else None


class LessonAudioSegment(Base):
    """Segmentos de audio para lecciones"""
    __tablename__ = "lesson_audio_segments"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=True)
    exercise_id = Column(Integer, nullable=True)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=True)
    audio_url = Column(String(500), nullable=True)
    transcript = Column(Text, nullable=True)
    emotion = Column(String(30), default='neutral')
    order_index = Column(Integer, default=0)
    duration_ms = Column(Integer, nullable=True)
    language_code = Column(String(10), default='es')
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
    def reporter_public_id(self) -> Optional[str]:
        return str(self.user.public_id) if self.user else None
