from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


# Enums
class UserType(str, enum.Enum):
    TUTOR = "tutor"
    CHILD = "child"
    SPONSOR = "sponsor"


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


class LessonDifficulty(str, enum.Enum):
    FACIL = "Fácil"
    INTERMEDIO = "Intermedio"
    AVANZADO = "Avanzado"


# User Model
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    user_type = Column(Enum(UserType), nullable=False)
    birth_date = Column(DateTime)
    gender = Column(Enum(Gender))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    
    # Family Relationships - Foreign Keys
    # For CHILD: reference to their tutor
    tutor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # For SPONSOR: reference to the child they sponsor
    sponsored_child_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # SQLAlchemy Relationships
    # Children of this tutor (if user is TUTOR) - ONE tutor has MANY children
    children = relationship(
        "User",
        foreign_keys=[tutor_id],
        back_populates="tutor",
        remote_side=[id]  # This is the "one" side
    )
    # Tutor of this child (if user is CHILD) - MANY children have ONE tutor
    tutor = relationship(
        "User",
        foreign_keys=[tutor_id],
        back_populates="children"
        # No remote_side here - this is the "many" side
    )
    
    # Sponsors of this child (if user is CHILD) - ONE child has MANY sponsors
    sponsors = relationship(
        "User",
        foreign_keys=[sponsored_child_id],
        back_populates="sponsored_child"
        # No remote_side here - this is the "many" side
    )
    # Child that this sponsor supports (if user is SPONSOR) - MANY sponsors have ONE child
    sponsored_child = relationship(
        "User",
        foreign_keys=[sponsored_child_id],
        back_populates="sponsors",
        remote_side=[id]  # This is the "one" side
    )
    
    # Child specific fields
    lessons_completed = Column(Integer, default=0)
    minutes_studied = Column(Integer, default=0)
    points_earned = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    
    # Virtual balance
    balance = Column(Float, default=0.0)
    
    # Virtual card status
    has_virtual_card = Column(Boolean, default=False)
    
    # Digital banking activation status
    banking_activated = Column(Boolean, default=False)
    banking_activated_at = Column(DateTime(timezone=True), nullable=True)
    banking_activated_by = Column(Integer, ForeignKey("users.id"), nullable=True)


# Lesson Models
class Lesson(Base):
    __tablename__ = "lessons"
    
    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(String(50), unique=True, nullable=False)  # e.g., "1.1", "2.3"
    title = Column(String(200), nullable=False)
    description = Column(Text)
    content = Column(Text)
    duration = Column(String(20))  # e.g., "30 min"
    difficulty = Column(Enum(LessonDifficulty), default=LessonDifficulty.FACIL)
    age_range = Column(String(20))  # e.g., "8-10"
    level_id = Column(String(50))  # e.g., "nivel-1"
    activities = Column(JSON)  # List of activities
    points_reward = Column(Integer, default=10)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class UserLessonProgress(Base):
    __tablename__ = "user_lesson_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    progress = Column(Integer, default=0)  # 0-100
    completed = Column(Boolean, default=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    time_spent = Column(Integer, default=0)  # in minutes


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
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # Who created the goal (tutor/child/sponsor)
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
