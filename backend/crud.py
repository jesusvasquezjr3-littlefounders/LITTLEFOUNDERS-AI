from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, extract
from typing import List, Optional
from datetime import datetime, timedelta
import hashlib
import uuid

from . import models, schemas

# CRUD para Usuarios
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_id(db: Session, user_id: str):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    # Generar ID único
    user_id = hashlib.md5(user.email.encode()).hexdigest()[:8]
    
    # Hash de la contraseña
    hashed_password = hashlib.sha256(user.password.encode()).hexdigest()
    
    db_user = models.User(
        id=user_id,
        name=user.name,
        email=user.email,
        password=hashed_password,
        user_type=user.user_type,
        birth_date=user.birth_date,
        gender=user.gender,
        tutor_email=user.tutor_email,
        child_email=user.child_email
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: str, user_update: schemas.UserUpdate):
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        return None
    
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

def get_children_by_tutor(db: Session, tutor_email: str) -> List[models.User]:
    return db.query(models.User).filter(
        and_(
            models.User.user_type == models.UserType.CHILD,
            models.User.tutor_email == tutor_email
        )
    ).all()

def get_child_by_sponsor(db: Session, sponsor_email: str) -> Optional[models.User]:
    sponsor = get_user_by_email(db, sponsor_email)
    if not sponsor or not sponsor.child_email:
        return None
    return get_user_by_email(db, sponsor.child_email)

# CRUD para Tareas
def create_task(db: Session, task: schemas.TaskCreate, assigned_by_id: str) -> models.Task:
    # Obtener el usuario asignado
    assigned_to_user = get_user_by_email(db, task.assigned_to_email)
    if not assigned_to_user:
        raise ValueError("Usuario asignado no encontrado")
    
    # Generar ID único
    task_id = str(uuid.uuid4())
    
    db_task = models.Task(
        id=task_id,
        title=task.title,
        description=task.description,
        category=task.category,
        difficulty=task.difficulty,
        reward=task.reward,
        time_estimate=task.time_estimate,
        due_date=task.due_date,
        is_important=task.is_important,
        assigned_by_id=assigned_by_id,
        assigned_to_id=assigned_to_user.id
    )
    
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Crear entrada en el historial
    create_task_history(db, task_id, "created", assigned_by_id, "Tarea creada")
    
    return db_task

def get_task_by_id(db: Session, task_id: str) -> Optional[models.Task]:
    return db.query(models.Task).options(
        joinedload(models.Task.assigned_by),
        joinedload(models.Task.assigned_to)
    ).filter(models.Task.id == task_id).first()

def get_tasks_by_user(db: Session, user_id: str, status: Optional[models.TaskStatus] = None) -> List[models.Task]:
    query = db.query(models.Task).options(
        joinedload(models.Task.assigned_by),
        joinedload(models.Task.assigned_to)
    ).filter(
        or_(
            models.Task.assigned_by_id == user_id,
            models.Task.assigned_to_id == user_id
        )
    )
    
    if status:
        query = query.filter(models.Task.status == status)
    
    return query.order_by(models.Task.created_at.desc()).all()

def get_tasks_assigned_by_user(db: Session, user_id: str, status: Optional[models.TaskStatus] = None) -> List[models.Task]:
    query = db.query(models.Task).options(
        joinedload(models.Task.assigned_by),
        joinedload(models.Task.assigned_to)
    ).filter(models.Task.assigned_by_id == user_id)
    
    if status:
        query = query.filter(models.Task.status == status)
    
    return query.order_by(models.Task.created_at.desc()).all()

def get_tasks_assigned_to_user(db: Session, user_id: str, status: Optional[models.TaskStatus] = None) -> List[models.Task]:
    query = db.query(models.Task).options(
        joinedload(models.Task.assigned_by),
        joinedload(models.Task.assigned_to)
    ).filter(models.Task.assigned_to_id == user_id)
    
    if status:
        query = query.filter(models.Task.status == status)
    
    return query.order_by(models.Task.created_at.desc()).all()

def update_task(db: Session, task_id: str, task_update: schemas.TaskUpdate) -> Optional[models.Task]:
    db_task = get_task_by_id(db, task_id)
    if not db_task:
        return None
    
    update_data = task_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_task, field, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task

def complete_task(db: Session, task_id: str, user_id: str, completion_data: schemas.TaskComplete) -> Optional[models.Task]:
    db_task = get_task_by_id(db, task_id)
    if not db_task or db_task.assigned_to_id != user_id:
        return None
    
    db_task.status = models.TaskStatus.PENDING
    db_task.completed_at = datetime.utcnow()
    db_task.photo_evidence_url = completion_data.photo_evidence_url
    
    db.commit()
    db.refresh(db_task)
    
    # Crear entrada en el historial
    create_task_history(db, task_id, "completed", user_id, "Tarea completada por el niño")
    
    return db_task

def approve_reject_task(db: Session, task_id: str, user_id: str, approval_data: schemas.TaskApproval) -> Optional[models.Task]:
    db_task = get_task_by_id(db, task_id)
    if not db_task or db_task.assigned_by_id != user_id:
        return None
    
    if approval_data.approved:
        db_task.status = models.TaskStatus.COMPLETED
        db_task.approved_at = datetime.utcnow()
        
        # Crear recompensa
        create_reward(db, task_id, db_task.assigned_to_id, db_task.reward, user_id)
        
        # Actualizar puntos del niño
        child = get_user_by_id(db, db_task.assigned_to_id)
        if child:
            child.points_earned = (child.points_earned or 0) + int(db_task.reward * 10)  # 10 puntos por dólar
        
        action = "approved"
        history_notes = f"Tarea aprobada. Recompensa: ${db_task.reward}"
    else:
        db_task.status = models.TaskStatus.REJECTED
        action = "rejected"
        history_notes = f"Tarea rechazada. Motivo: {approval_data.notes or 'Sin motivo especificado'}"
    
    db_task.notes = approval_data.notes
    
    db.commit()
    db.refresh(db_task)
    
    # Crear entrada en el historial
    create_task_history(db, task_id, action, user_id, history_notes)
    
    return db_task

def reassign_task(db: Session, original_task_id: str, user_id: str, notes: Optional[str] = None) -> Optional[models.Task]:
    original_task = get_task_by_id(db, original_task_id)
    if not original_task or original_task.assigned_by_id != user_id:
        return None
    
    # Crear nueva tarea basada en la original
    new_task_id = str(uuid.uuid4())
    new_task = models.Task(
        id=new_task_id,
        title=original_task.title,
        description=original_task.description,
        category=original_task.category,
        difficulty=original_task.difficulty,
        reward=original_task.reward,
        time_estimate=original_task.time_estimate,
        due_date=original_task.due_date,
        is_important=original_task.is_important,
        assigned_by_id=user_id,
        assigned_to_id=original_task.assigned_to_id,
        status=models.TaskStatus.ASSIGNED,
        original_task_id=original_task_id,
        notes=notes
    )
    
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    
    # Crear entrada en el historial
    create_task_history(db, new_task_id, "reassigned", user_id, f"Tarea reasignada. Original: {original_task_id}")
    
    return new_task

def delete_task(db: Session, task_id: str, user_id: str) -> bool:
    db_task = get_task_by_id(db, task_id)
    if not db_task or db_task.assigned_by_id != user_id:
        return False
    
    # Solo se pueden eliminar tareas no completadas
    if db_task.status != models.TaskStatus.ASSIGNED:
        return False
    
    db.delete(db_task)
    db.commit()
    
    # Crear entrada en el historial
    create_task_history(db, task_id, "deleted", user_id, "Tarea eliminada")
    
    return True

# CRUD para Historial de Tareas
def create_task_history(db: Session, task_id: str, action: str, performed_by_id: str, notes: Optional[str] = None):
    history_id = str(uuid.uuid4())
    db_history = models.TaskHistory(
        id=history_id,
        task_id=task_id,
        action=action,
        performed_by_id=performed_by_id,
        notes=notes
    )
    
    db.add(db_history)
    db.commit()
    return db_history

def get_task_history(db: Session, task_id: str) -> List[models.TaskHistory]:
    return db.query(models.TaskHistory).options(
        joinedload(models.TaskHistory.performed_by)
    ).filter(models.TaskHistory.task_id == task_id).order_by(models.TaskHistory.performed_at.desc()).all()

# CRUD para Recompensas
def create_reward(db: Session, task_id: str, child_id: str, amount: float, paid_by_id: str):
    reward_id = str(uuid.uuid4())
    db_reward = models.Reward(
        id=reward_id,
        task_id=task_id,
        child_id=child_id,
        amount=amount,
        paid_by_id=paid_by_id
    )
    
    db.add(db_reward)
    db.commit()
    return db_reward

def get_rewards_by_child(db: Session, child_id: str) -> List[models.Reward]:
    return db.query(models.Reward).filter(models.Reward.child_id == child_id).all()

# CRUD para Configuración Familiar
def create_family_settings(db: Session, tutor_id: str, settings: schemas.FamilySettingsCreate):
    settings_id = str(uuid.uuid4())
    db_settings = models.FamilySettings(
        id=settings_id,
        tutor_id=tutor_id,
        **settings.dict()
    )
    
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings

def get_family_settings(db: Session, tutor_id: str):
    return db.query(models.FamilySettings).filter(models.FamilySettings.tutor_id == tutor_id).first()

def update_family_settings(db: Session, tutor_id: str, settings_update: schemas.FamilySettingsUpdate):
    db_settings = get_family_settings(db, tutor_id)
    if not db_settings:
        return None
    
    update_data = settings_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_settings, field, value)
    
    db.commit()
    db.refresh(db_settings)
    return db_settings

# Funciones de estadísticas
def get_task_statistics(db: Session, user_id: str, user_type: str) -> schemas.TaskStatistics:
    if user_type == "child":
        tasks = get_tasks_assigned_to_user(db, user_id)
    else:
        tasks = get_tasks_assigned_by_user(db, user_id)
    
    total_assigned = len([t for t in tasks if t.status == models.TaskStatus.ASSIGNED])
    total_completed = len([t for t in tasks if t.status == models.TaskStatus.COMPLETED])
    total_pending = len([t for t in tasks if t.status == models.TaskStatus.PENDING])
    total_rejected = len([t for t in tasks if t.status == models.TaskStatus.REJECTED])
    
    total_earnings = sum([t.reward for t in tasks if t.status == models.TaskStatus.COMPLETED])
    
    # Calcular ganancias de esta semana
    week_start = datetime.utcnow() - timedelta(days=7)
    weekly_earnings = sum([
        t.reward for t in tasks 
        if t.status == models.TaskStatus.COMPLETED and t.approved_at and t.approved_at >= week_start
    ])
    
    # Calcular tasa de completado
    total_tasks = len(tasks)
    completion_rate = (total_completed / total_tasks * 100) if total_tasks > 0 else 0
    
    # Calcular tiempo promedio de completado
    completed_tasks_with_dates = [
        t for t in tasks 
        if t.status == models.TaskStatus.COMPLETED and t.created_at and t.completed_at
    ]
    
    average_completion_time = None
    if completed_tasks_with_dates:
        total_days = sum([
            (t.completed_at - t.created_at).days 
            for t in completed_tasks_with_dates
        ])
        average_completion_time = total_days / len(completed_tasks_with_dates)
    
    return schemas.TaskStatistics(
        total_tasks_assigned=total_assigned,
        total_tasks_completed=total_completed,
        total_tasks_pending=total_pending,
        total_tasks_rejected=total_rejected,
        total_earnings=total_earnings,
        weekly_earnings=weekly_earnings,
        completion_rate=completion_rate,
        average_completion_time=average_completion_time
    )

def get_child_progress(db: Session, child_id: str) -> schemas.ChildProgress:
    child = get_user_by_id(db, child_id)
    if not child:
        raise ValueError("Niño no encontrado")
    
    statistics = get_task_statistics(db, child_id, "child")
    recent_tasks = get_tasks_assigned_to_user(db, child_id)[:10]  # Últimas 10 tareas
    
    return schemas.ChildProgress(
        child=child,
        statistics=statistics,
        recent_tasks=recent_tasks
    )

# Utilidades
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user

def get_users_summary(db: Session):
    """Obtener resumen de usuarios para debugging"""
    users = db.query(models.User).all()
    return {
        "total_users": len(users),
        "tutors": len([u for u in users if u.user_type == models.UserType.TUTOR]),
        "children": len([u for u in users if u.user_type == models.UserType.CHILD]),
        "sponsors": len([u for u in users if u.user_type == models.UserType.SPONSOR]),
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "user_type": u.user_type,
                "created_at": u.created_at
            } for u in users
        ]
    }
