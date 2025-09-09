from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

# Enums para tipos de datos específicos
class UserType(str, enum.Enum):
    TUTOR = "tutor"
    CHILD = "child"
    SPONSOR = "sponsor"

class TaskCategory(str, enum.Enum):
    CHORES = "chores"
    EDUCATION = "education"
    SOCIAL = "social"
    BONUS = "bonus"

class TaskDifficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class TaskStatus(str, enum.Enum):
    ASSIGNED = "assigned"        # Tarea asignada pero no completada
    PENDING = "pending"          # Completada por el niño, esperando aprobación
    COMPLETED = "completed"      # Aprobada por padre/patrocinador
    REJECTED = "rejected"        # Rechazada por padre/patrocinador

class Gender(str, enum.Enum):
    MASCULINO = "masculino"
    FEMENINO = "femenino"
    OTRO = "otro"

# Modelo de Usuario
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    user_type = Column(SQLEnum(UserType), nullable=False)
    birth_date = Column(String, nullable=True)
    gender = Column(SQLEnum(Gender), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Campos específicos para niños
    tutor_email = Column(String, nullable=True)  # Email del tutor responsable
    lessons_completed = Column(Integer, default=0)
    minutes_studied = Column(Integer, default=0)
    points_earned = Column(Integer, default=0)
    
    # Campos específicos para patrocinadores
    child_email = Column(String, nullable=True)  # Email del niño patrocinado
    
    # Relaciones
    assigned_tasks = relationship("Task", foreign_keys="Task.assigned_by_id", back_populates="assigned_by")
    received_tasks = relationship("Task", foreign_keys="Task.assigned_to_id", back_populates="assigned_to")

# Modelo de Tarea
class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(SQLEnum(TaskCategory), nullable=False)
    difficulty = Column(SQLEnum(TaskDifficulty), nullable=False)
    reward = Column(Float, nullable=False)
    time_estimate = Column(Integer, nullable=False)  # En minutos
    due_date = Column(DateTime, nullable=True)
    is_important = Column(Boolean, default=False)  # isFirstDibs en el frontend
    
    # Estado y fechas
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.ASSIGNED)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    # Asignación
    assigned_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Notas y evidencia
    notes = Column(Text, nullable=True)  # Comentarios de rechazo o aprobación
    photo_evidence_url = Column(String, nullable=True)  # URL de la foto de evidencia
    
    # ID de tarea original (para reasignaciones)
    original_task_id = Column(String, nullable=True)
    
    # Relaciones
    assigned_by = relationship("User", foreign_keys=[assigned_by_id], back_populates="assigned_tasks")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="received_tasks")

# Modelo para Historial de Tareas (para tracking de cambios)
class TaskHistory(Base):
    __tablename__ = "task_history"
    
    id = Column(String, primary_key=True, index=True)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    action = Column(String, nullable=False)  # "created", "completed", "approved", "rejected", "reassigned"
    performed_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    performed_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    
    # Relaciones
    task = relationship("Task")
    performed_by = relationship("User")

# Modelo para Recompensas y Pagos
class Reward(Base):
    __tablename__ = "rewards"
    
    id = Column(String, primary_key=True, index=True)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    child_id = Column(String, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    paid_at = Column(DateTime, default=datetime.utcnow)
    paid_by_id = Column(String, ForeignKey("users.id"), nullable=False)  # Padre o patrocinador
    
    # Relaciones
    task = relationship("Task")
    child = relationship("User", foreign_keys=[child_id])
    paid_by = relationship("User", foreign_keys=[paid_by_id])

# Modelo para Configuración de Familia
class FamilySettings(Base):
    __tablename__ = "family_settings"
    
    id = Column(String, primary_key=True, index=True)
    tutor_id = Column(String, ForeignKey("users.id"), nullable=False)
    weekly_allowance = Column(Float, default=0.0)
    task_completion_goal = Column(Integer, default=5)  # Meta semanal de tareas
    auto_approve_photos = Column(Boolean, default=False)
    require_photo_evidence = Column(Boolean, default=False)
    
    # Relaciones
    tutor = relationship("User")
