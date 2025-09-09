from fastapi import FastAPI, HTTPException, status, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
from datetime import datetime, timedelta

from database import get_db, engine
from models import Base, TaskStatus, User as UserModel
import models
import schemas
import crud

# Crear todas las tablas
Base.metadata.create_all(bind=engine)

app = FastAPI(title="LittleFounders API v2", version="2.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directorio para uploads
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Endpoints básicos
@app.get("/")
async def root():
    return {"message": "LittleFounders API v2 - PostgreSQL", "version": "2.0.0"}

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        # Test database connection
        db.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(e)}"
        )

# Endpoints de Autenticación
@app.post("/auth/register", response_model=schemas.FamilyRegistrationResponse)
async def register_family(registration_data: schemas.FamilyRegistration, db: Session = Depends(get_db)):
    """Registrar una familia completa (tutor, child, optional sponsor)"""
    
    try:
        # Verificar que los emails no existan
        if crud.get_user_by_email(db, registration_data.tutor.email):
            raise HTTPException(status_code=400, detail="Email del tutor ya registrado")
        
        if crud.get_user_by_email(db, registration_data.child.email):
            raise HTTPException(status_code=400, detail="Email del niño ya registrado")
        
        if registration_data.sponsor and crud.get_user_by_email(db, registration_data.sponsor.email):
            raise HTTPException(status_code=400, detail="Email del patrocinador ya registrado")
        
        # Configurar las relaciones
        registration_data.child.tutor_email = registration_data.tutor.email
        if registration_data.sponsor:
            registration_data.sponsor.child_email = registration_data.child.email
        
        # Crear usuarios
        tutor = crud.create_user(db, registration_data.tutor)
        child = crud.create_user(db, registration_data.child)
        sponsor = None
        
        if registration_data.sponsor:
            sponsor = crud.create_user(db, registration_data.sponsor)
        
        # Crear configuración familiar por defecto
        family_settings = schemas.FamilySettingsCreate()
        crud.create_family_settings(db, tutor.id, family_settings)
        
        return schemas.FamilyRegistrationResponse(
            tutor=tutor,
            child=child,
            sponsor=sponsor,
            message="Familia registrada exitosamente"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al registrar familia: {str(e)}")

@app.post("/auth/login", response_model=schemas.Token)
async def login_user(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """Login de usuario"""
    
    user = crud.authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )
    
    # En una implementación real, aquí generarías un JWT token
    # Por ahora devolvemos un token simple
    return schemas.Token(
        access_token=f"token_{user.id}",
        token_type="bearer",
        user=user
    )

@app.get("/users/summary")
async def get_users_summary(db: Session = Depends(get_db)):
    """Obtener resumen de usuarios (para debugging)"""
    return crud.get_users_summary(db)

# Endpoints de Tareas
@app.post("/tasks", response_model=schemas.TaskResponse)
async def create_task(
    task: schemas.TaskCreate, 
    assigned_by_id: str,  # En una implementación real, esto vendría del JWT
    db: Session = Depends(get_db)
):
    """Crear una nueva tarea"""
    try:
        db_task = crud.create_task(db, task, assigned_by_id)
        return db_task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear tarea: {str(e)}")

@app.get("/tasks/assigned-by/{user_id}", response_model=List[schemas.TaskResponse])
async def get_tasks_assigned_by_user(
    user_id: str, 
    status: Optional[TaskStatus] = None, 
    db: Session = Depends(get_db)
):
    """Obtener tareas asignadas por un usuario (padre/patrocinador)"""
    tasks = crud.get_tasks_assigned_by_user(db, user_id, status)
    return tasks

@app.get("/tasks/assigned-to/{user_id}", response_model=List[schemas.TaskResponse])
async def get_tasks_assigned_to_user(
    user_id: str, 
    status: Optional[TaskStatus] = None, 
    db: Session = Depends(get_db)
):
    """Obtener tareas asignadas a un usuario (niño)"""
    tasks = crud.get_tasks_assigned_to_user(db, user_id, status)
    return tasks

@app.get("/tasks/{task_id}", response_model=schemas.TaskResponse)
async def get_task(task_id: str, db: Session = Depends(get_db)):
    """Obtener una tarea específica"""
    task = crud.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return task

@app.put("/tasks/{task_id}", response_model=schemas.TaskResponse)
async def update_task(
    task_id: str, 
    task_update: schemas.TaskUpdate, 
    user_id: str,  # En una implementación real, esto vendría del JWT
    db: Session = Depends(get_db)
):
    """Actualizar una tarea"""
    # Verificar que el usuario sea quien asignó la tarea
    task = crud.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    if task.assigned_by_id != user_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar esta tarea")
    
    updated_task = crud.update_task(db, task_id, task_update)
    if not updated_task:
        raise HTTPException(status_code=404, detail="No se pudo actualizar la tarea")
    
    return updated_task

@app.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str, 
    user_id: str,  # En una implementación real, esto vendría del JWT
    db: Session = Depends(get_db)
):
    """Eliminar una tarea"""
    success = crud.delete_task(db, task_id, user_id)
    if not success:
        raise HTTPException(
            status_code=404, 
            detail="Tarea no encontrada o no tienes permiso para eliminarla"
        )
    return {"message": "Tarea eliminada exitosamente"}

@app.post("/tasks/{task_id}/complete", response_model=schemas.TaskResponse)
async def complete_task(
    task_id: str,
    completion_data: schemas.TaskComplete,
    user_id: str,  # En una implementación real, esto vendría del JWT
    db: Session = Depends(get_db)
):
    """Marcar una tarea como completada (por el niño)"""
    completed_task = crud.complete_task(db, task_id, user_id, completion_data)
    if not completed_task:
        raise HTTPException(
            status_code=404, 
            detail="Tarea no encontrada o no tienes permiso para completarla"
        )
    return completed_task

@app.post("/tasks/{task_id}/approve", response_model=schemas.TaskResponse)
async def approve_reject_task(
    task_id: str,
    approval_data: schemas.TaskApproval,
    user_id: str,  # En una implementación real, esto vendría del JWT
    db: Session = Depends(get_db)
):
    """Aprobar o rechazar una tarea (por padre/patrocinador)"""
    task = crud.approve_reject_task(db, task_id, user_id, approval_data)
    if not task:
        raise HTTPException(
            status_code=404, 
            detail="Tarea no encontrada o no tienes permiso para aprobarla"
        )
    return task

@app.post("/tasks/{task_id}/reassign", response_model=schemas.TaskResponse)
async def reassign_task(
    task_id: str,
    notes: Optional[str] = None,
    user_id: str = "",  # En una implementación real, esto vendría del JWT
    db: Session = Depends(get_db)
):
    """Reasignar una tarea rechazada"""
    new_task = crud.reassign_task(db, task_id, user_id, notes)
    if not new_task:
        raise HTTPException(
            status_code=404, 
            detail="Tarea no encontrada o no tienes permiso para reasignarla"
        )
    return new_task

@app.post("/tasks/{task_id}/upload-photo")
async def upload_photo_evidence(
    task_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Subir foto de evidencia para una tarea"""
    
    # Verificar que la tarea existe
    task = crud.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    # Verificar tipo de archivo
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos de imagen")
    
    # Verificar tamaño del archivo (5MB máximo)
    if file.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo es demasiado grande (máximo 5MB)")
    
    # Crear nombre único para el archivo
    file_extension = file.filename.split(".")[-1] if file.filename else "jpg"
    unique_filename = f"task_{task_id}_{int(datetime.now().timestamp())}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Guardar archivo
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Actualizar la tarea con la URL de la foto
        task_update = schemas.TaskUpdate(photo_evidence_url=f"/uploads/{unique_filename}")
        crud.update_task(db, task_id, task_update)
        
        return {"message": "Foto subida exitosamente", "photo_url": f"/uploads/{unique_filename}"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir archivo: {str(e)}")

# Endpoints de Estadísticas
@app.get("/statistics/{user_id}", response_model=schemas.TaskStatistics)
async def get_user_statistics(user_id: str, db: Session = Depends(get_db)):
    """Obtener estadísticas de tareas de un usuario"""
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return crud.get_task_statistics(db, user_id, user.user_type)

@app.get("/progress/{child_id}", response_model=schemas.ChildProgress)
async def get_child_progress(child_id: str, db: Session = Depends(get_db)):
    """Obtener progreso completo de un niño"""
    try:
        return crud.get_child_progress(db, child_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# Endpoints de Familia
@app.get("/family/children/{tutor_email}", response_model=List[schemas.UserResponse])
async def get_tutor_children(tutor_email: str, db: Session = Depends(get_db)):
    """Obtener todos los niños de un tutor"""
    children = crud.get_children_by_tutor(db, tutor_email)
    return children

@app.get("/family/child/{sponsor_email}", response_model=schemas.UserResponse)
async def get_sponsored_child(sponsor_email: str, db: Session = Depends(get_db)):
    """Obtener el niño patrocinado por un sponsor"""
    child = crud.get_child_by_sponsor(db, sponsor_email)
    if not child:
        raise HTTPException(status_code=404, detail="Niño patrocinado no encontrado")
    return child

# Endpoints de Configuración Familiar
@app.post("/family/settings", response_model=schemas.FamilySettingsResponse)
async def create_family_settings(
    settings: schemas.FamilySettingsCreate,
    tutor_id: str,  # En una implementación real, esto vendría del JWT
    db: Session = Depends(get_db)
):
    """Crear configuración familiar"""
    return crud.create_family_settings(db, tutor_id, settings)

@app.get("/family/settings/{tutor_id}", response_model=schemas.FamilySettingsResponse)
async def get_family_settings(tutor_id: str, db: Session = Depends(get_db)):
    """Obtener configuración familiar"""
    settings = crud.get_family_settings(db, tutor_id)
    if not settings:
        raise HTTPException(status_code=404, detail="Configuración familiar no encontrada")
    return settings

@app.put("/family/settings/{tutor_id}", response_model=schemas.FamilySettingsResponse)
async def update_family_settings(
    tutor_id: str,
    settings_update: schemas.FamilySettingsUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar configuración familiar"""
    updated_settings = crud.update_family_settings(db, tutor_id, settings_update)
    if not updated_settings:
        raise HTTPException(status_code=404, detail="Configuración familiar no encontrada")
    return updated_settings

# Endpoints de Recompensas
@app.get("/rewards/{child_id}", response_model=List[schemas.RewardResponse])
async def get_child_rewards(child_id: str, db: Session = Depends(get_db)):
    """Obtener todas las recompensas de un niño"""
    rewards = crud.get_rewards_by_child(db, child_id)
    return rewards

# Endpoints de Historial
@app.get("/tasks/{task_id}/history", response_model=List[schemas.TaskHistoryResponse])
async def get_task_history(task_id: str, db: Session = Depends(get_db)):
    """Obtener historial de una tarea"""
    history = crud.get_task_history(db, task_id)
    return history

# Endpoints para migración desde el sistema anterior
@app.post("/migrate/users")
async def migrate_users_from_txt(db: Session = Depends(get_db)):
    """Migrar usuarios desde users.txt al nuevo sistema PostgreSQL"""
    
    try:
        # Importar función del sistema anterior
        import json
        
        if not os.path.exists("users.txt"):
            return {"message": "No hay archivo users.txt para migrar"}
        
        migrated_count = 0
        with open("users.txt", 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        user_data = json.loads(line)
                        
                        # Verificar si el usuario ya existe
                        if crud.get_user_by_email(db, user_data['email']):
                            continue
                        
                        # Convertir formato anterior al nuevo
                        user_create = schemas.UserCreate(
                            name=user_data['name'],
                            email=user_data['email'],
                            password=user_data['password'],  # Ya está hasheada
                            user_type=user_data['user_type'],
                            birth_date=user_data.get('birth_date'),
                            gender=user_data.get('gender'),
                            tutor_email=user_data.get('tutor_email'),
                            child_email=user_data.get('child_email')
                        )
                        
                        # Crear usuario en PostgreSQL
                        db_user = UserModel(
                            id=user_data['id'],
                            name=user_create.name,
                            email=user_create.email,
                            password=user_data['password'],  # Usar password ya hasheada
                            user_type=user_create.user_type,
                            birth_date=user_create.birth_date,
                            gender=user_create.gender,
                            tutor_email=user_create.tutor_email,
                            child_email=user_create.child_email,
                            lessons_completed=user_data.get('lessons_completed', 0),
                            minutes_studied=user_data.get('minutes_studied', 0),
                            points_earned=user_data.get('points_earned', 0),
                            created_at=datetime.fromisoformat(user_data['created_at'])
                        )
                        
                        db.add(db_user)
                        migrated_count += 1
                        
                    except json.JSONDecodeError:
                        continue
                    except Exception as e:
                        print(f"Error migrando usuario: {e}")
                        continue
        
        db.commit()
        return {"message": f"Migrados {migrated_count} usuarios exitosamente"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en migración: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
