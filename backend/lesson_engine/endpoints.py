"""
Endpoints del Nuevo Motor de Lecciones
LittleFounders - 2026
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import (
    Adventure, Saga, Lesson, Exercise, LessonAudioSegment,
    Character, CharacterGesture,
    User, UserLessonProgress, UserExerciseProgress
)
from schemas import (
    AdventureResponse, AdventureWithProgress,
    SagaResponse, SagaWithProgress,
    CharacterResponse, GestureResponse,
    ExerciseInTimeline, LessonMeta, LessonPlayResponse,
    LessonCompleteRequest, LessonCompleteResponse,
    AdventureProgress, UserLessonStats
)

router = APIRouter(prefix="/lesson-engine", tags=["Lesson Engine"])


# =====================================================
# ADVENTURES ENDPOINTS
# =====================================================

@router.get("/adventures", response_model=List[AdventureWithProgress])
async def get_adventures(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Obtener todas las aventuras activas con progreso del usuario (si se proporciona).
    """
    adventures = db.query(Adventure).filter(
        Adventure.is_active == True
    ).order_by(Adventure.order_index).all()
    
    result = []
    for adventure in adventures:
        # Contar sagas y lecciones
        sagas = db.query(Saga).filter(
            Saga.adventure_id == adventure.id,
            Saga.is_active == True
        ).all()
        
        total_lessons = 0
        completed_lessons = 0
        
        for saga in sagas:
            saga_lessons = db.query(Lesson).filter(
                Lesson.saga_id == saga.id,
                Lesson.is_active == True
            ).all()
            total_lessons += len(saga_lessons)
            
            if user_id:
                for lesson in saga_lessons:
                    progress = db.query(UserLessonProgress).filter(
                        UserLessonProgress.user_id == user_id,
                        UserLessonProgress.lesson_id == lesson.id,
                        UserLessonProgress.completed == True
                    ).first()
                    if progress:
                        completed_lessons += 1
        
        progress_percent = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0
        
        result.append(AdventureWithProgress(
            id=adventure.id,
            code=adventure.code,
            title=adventure.title,
            description=adventure.description,
            age_range=adventure.age_range,
            order_index=adventure.order_index,
            theme_color=adventure.theme_color,
            background_scene=adventure.background_scene,
            is_active=adventure.is_active,
            created_at=adventure.created_at,
            total_sagas=len(sagas),
            completed_sagas=0,  # TODO: calcular
            total_lessons=total_lessons,
            completed_lessons=completed_lessons,
            progress_percent=round(progress_percent, 1)
        ))
    
    return result


@router.get("/adventures/{code}/sagas", response_model=List[SagaWithProgress])
async def get_adventure_sagas(
    code: str,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Obtener todas las sagas de una aventura con progreso.
    """
    adventure = db.query(Adventure).filter(Adventure.code == code).first()
    if not adventure:
        raise HTTPException(status_code=404, detail="Adventure not found")
    
    sagas = db.query(Saga).filter(
        Saga.adventure_id == adventure.id,
        Saga.is_active == True
    ).order_by(Saga.order_index).all()
    
    result = []
    for saga in sagas:
        lessons = db.query(Lesson).filter(
            Lesson.saga_id == saga.id,
            Lesson.is_active == True
        ).all()
        
        completed_lessons = 0
        if user_id:
            for lesson in lessons:
                progress = db.query(UserLessonProgress).filter(
                    UserLessonProgress.user_id == user_id,
                    UserLessonProgress.lesson_id == lesson.id,
                    UserLessonProgress.completed == True
                ).first()
                if progress:
                    completed_lessons += 1
        
        total = len(lessons)
        progress_percent = (completed_lessons / total * 100) if total > 0 else 0
        
        result.append(SagaWithProgress(
            id=saga.id,
            adventure_id=saga.adventure_id,
            code=saga.code,
            title=saga.title,
            description=saga.description,
            order_index=saga.order_index,
            icon=saga.icon,
            is_active=saga.is_active,
            created_at=saga.created_at,
            total_lessons=total,
            completed_lessons=completed_lessons,
            progress_percent=round(progress_percent, 1)
        ))
    
    return result


# =====================================================
# LESSONS ENDPOINTS (Para LessonRunner)
# =====================================================

@router.get("/lessons/{code}/play")
async def get_lesson_for_play(
    code: str,
    db: Session = Depends(get_db)
):
    """
    Obtener JSON completo de una lección para el LessonRunner.
    Este es el endpoint principal que consume el frontend.
    """
    lesson = db.query(Lesson).filter(Lesson.lesson_id == code).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Obtener información de saga y aventura
    saga = db.query(Saga).filter(Saga.id == lesson.saga_id).first() if lesson.saga_id else None
    adventure = db.query(Adventure).filter(Adventure.id == saga.adventure_id).first() if saga else None
    
    # Obtener todos los ejercicios ordenados
    exercises = db.query(Exercise).filter(
        Exercise.lesson_id == lesson.id,
        Exercise.is_active == True
    ).order_by(Exercise.order_index).all()
    
    # Construir timeline con audio segments
    timeline = []
    for exercise in exercises:
        # Buscar audio segment asociado
        audio_segment = db.query(LessonAudioSegment).filter(
            LessonAudioSegment.exercise_id == exercise.id
        ).first()
        
        audio_data = None
        if audio_segment:
            character = db.query(Character).filter(
                Character.id == audio_segment.character_id
            ).first() if audio_segment.character_id else None
            
            audio_data = {
                "url": audio_segment.audio_url,
                "characterId": audio_segment.character_id,
                "characterCode": character.code if character else None,
                "gesture": audio_segment.emotion,  # Usamos emotion como gesto por ahora
                "emotion": audio_segment.emotion,
                "transcript": audio_segment.transcript,
                "duration_ms": audio_segment.duration_ms
            }
        
        timeline.append({
            "id": exercise.id,
            "type": exercise.exercise_type,
            "order_index": exercise.order_index,
            "character_code": getattr(exercise, 'character_code', 'liruf'),  # Añadido para soportar Dina
            "start_time_ms": exercise.start_time_ms,
            "pause_at_ms": exercise.pause_at_ms,
            "content": exercise.content,
            "correct_answer": exercise.correct_answer,
            "feedback": exercise.feedback,
            "points": exercise.points,
            "audio": audio_data
        })
    
    # Construir respuesta
    return {
        "lesson": {
            "id": lesson.id,
            "code": lesson.lesson_id,
            "title": lesson.title,
            "description": lesson.description,
            "saga": saga.title if saga else None,
            "saga_code": saga.code if saga else None,
            "adventure": adventure.title if adventure else None,
            "adventure_code": adventure.code if adventure else None
        },
        "meta": {
            "estimated_duration_seconds": lesson.estimated_duration_seconds or 180,
            "points_reward": lesson.points_reward or 10,
            "xp_reward": lesson.xp_reward or 25
        },
        "timeline": timeline
    }


@router.post("/lessons/{code}/complete")
async def complete_lesson(
    code: str,
    user_id: int,
    request: LessonCompleteRequest,
    db: Session = Depends(get_db)
):
    """
    Marcar una lección como completada y actualizar progreso del usuario.
    """
    lesson = db.query(Lesson).filter(Lesson.lesson_id == code).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Actualizar o crear progreso de lección
    progress = db.query(UserLessonProgress).filter(
        UserLessonProgress.user_id == user_id,
        UserLessonProgress.lesson_id == lesson.id
    ).first()
    
    first_time = not progress or not progress.completed
    
    if not progress:
        progress = UserLessonProgress(
            user_id=user_id,
            lesson_id=lesson.id,
            progress=100,
            completed=True,
            completed_at=datetime.now(),
            time_spent=request.time_spent_seconds // 60,  # Convertir a minutos
            attempts=1
        )
        db.add(progress)
    else:
        progress.progress = 100
        progress.completed = True
        progress.completed_at = datetime.now()
        progress.time_spent += request.time_spent_seconds // 60
        progress.attempts += 1
    
    # Actualizar progreso de ejercicios individuales si se proporcionan
    if request.exercises_results:
        for ex_result in request.exercises_results:
            ex_progress = db.query(UserExerciseProgress).filter(
                UserExerciseProgress.user_id == user_id,
                UserExerciseProgress.exercise_id == ex_result.get("exercise_id")
            ).first()
            
            if not ex_progress:
                ex_progress = UserExerciseProgress(
                    user_id=user_id,
                    exercise_id=ex_result.get("exercise_id"),
                    status=ex_result.get("status", "correct"),
                    attempts=ex_result.get("attempts", 1),
                    last_attempt_at=datetime.now()
                )
                db.add(ex_progress)
            else:
                ex_progress.status = ex_result.get("status", "correct")
                ex_progress.attempts += ex_result.get("attempts", 1)
                ex_progress.last_attempt_at = datetime.now()
    
    # Solo dar puntos/XP si es primera vez completando
    points_earned = 0
    xp_earned = 0
    if first_time:
        points_earned = lesson.points_reward or 10
        xp_earned = lesson.xp_reward or 25
        user.lessons_completed += 1
        user.minutes_studied += request.time_spent_seconds // 60
        user.points_earned += points_earned
    
    db.commit()
    
    return {
        "message": "¡Lección completada!" if first_time else "Lección repasada",
        "points_earned": points_earned,
        "xp_earned": xp_earned,
        "total_lessons_completed": user.lessons_completed,
        "first_time": first_time,
        "achievements_unlocked": []  # TODO: implementar sistema de logros
    }


# =====================================================
# CHARACTERS ENDPOINTS
# =====================================================

@router.get("/characters", response_model=List[CharacterResponse])
async def get_characters(db: Session = Depends(get_db)):
    """Obtener todos los personajes activos."""
    characters = db.query(Character).filter(Character.is_active == True).all()
    return characters


@router.get("/characters/{code}")
async def get_character(code: str, db: Session = Depends(get_db)):
    """Obtener un personaje con sus gestos."""
    character = db.query(Character).filter(Character.code == code).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    gestures = db.query(CharacterGesture).filter(
        CharacterGesture.character_id == character.id
    ).all()
    
    return {
        "id": character.id,
        "code": character.code,
        "name": character.name,
        "elevenlabs_voice_id": character.elevenlabs_voice_id,
        "description": character.description,
        "gestures": [
            {"code": g.gesture_code, "duration_ms": g.duration_ms}
            for g in gestures
        ]
    }


# =====================================================
# USER STATS ENDPOINT (Para Dashboard)
# =====================================================

@router.get("/users/{user_id}/stats")
async def get_user_lesson_stats(user_id: int, db: Session = Depends(get_db)):
    """
    Obtener estadísticas de lecciones para el dashboard de un usuario.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Obtener progreso por aventura
    adventures = db.query(Adventure).filter(Adventure.is_active == True).all()
    
    adventure_progress = []
    for adventure in adventures:
        sagas = db.query(Saga).filter(Saga.adventure_id == adventure.id).all()
        
        total_lessons = 0
        completed_lessons = 0
        current_saga = None
        
        for saga in sagas:
            saga_lessons = db.query(Lesson).filter(
                Lesson.saga_id == saga.id,
                Lesson.is_active == True
            ).all()
            total_lessons += len(saga_lessons)
            
            saga_completed = 0
            for lesson in saga_lessons:
                progress = db.query(UserLessonProgress).filter(
                    UserLessonProgress.user_id == user_id,
                    UserLessonProgress.lesson_id == lesson.id,
                    UserLessonProgress.completed == True
                ).first()
                if progress:
                    saga_completed += 1
            
            completed_lessons += saga_completed
            
            # Determinar saga actual (primera saga no completada)
            if not current_saga and saga_completed < len(saga_lessons):
                current_saga = saga.title
        
        progress_percent = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0
        
        adventure_progress.append({
            "adventure_id": adventure.id,
            "adventure_title": adventure.title,
            "adventure_code": adventure.code,
            "total_lessons": total_lessons,
            "completed_lessons": completed_lessons,
            "progress_percent": round(progress_percent, 1),
            "current_saga": current_saga
        })
    
    # Contar lecciones que necesitan repaso (strength < 0.5)
    lessons_needing_review = db.query(UserLessonProgress).filter(
        UserLessonProgress.user_id == user_id,
        UserLessonProgress.strength < 0.5
    ).count()
    
    return {
        "adventure_progress": adventure_progress,
        "total_xp": user.points_earned,  # Usamos points como XP por ahora
        "current_streak": user.current_streak,
        "lessons_this_week": 0,  # TODO: calcular
        "average_accuracy": 0.0,  # TODO: calcular
        "lessons_needing_review": lessons_needing_review
    }
