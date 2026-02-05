"""
Enduntos del Nuevo Motor de Lecciones (v2 - Flat i18n)
LittleFounders - 2026
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict
from datetime import datetime

from database import get_db
from models import (
    Lesson, Character, CharacterGesture,
    User, UserLessonProgress, UserExerciseProgress
)
from schemas import (
    AdventureResponse, AdventureWithProgress,
    SagaResponse, SagaWithProgress,
    CharacterResponse, GestureResponse,
    LessonPlayResponse, LessonCompleteRequest,
    AdventureProgress, UserLessonStats
)

router = APIRouter(prefix="/lesson-engine", tags=["Lesson Engine"])

# HARDCODED ADVENTURE DATA (Since tables were dropped for flattening)
ADVENTURES_DATA = [
    {
        "id": 1,
        "code": "archipielago",
        "title": "El Archipiélago de los Ahorros",
        "description": "Una aventura mágica para aprender a guardar tesoros.",
        "age_range": "5-8",
        "theme_color": "#4dd0e1",
        "background_scene": "archipelago"
    },
    {
        "id": 2,
        "code": "cosmos",
        "title": "Cosmos Financiero",
        "description": "Explora el universo del dinero.",
        "age_range": "8-10",
        "theme_color": "#7e57c2",
        "background_scene": "cosmos"
    }
]

# HARDCODED SAGA DATA (Example mapping)
SAGAS_DATA = {
    1: [ # For Adventure 1
         {"id": 1, "code": "detectives", "title": "Detectives del Tesoro", "icon": "🔍"},
         {"id": 2, "code": "mercaderes", "title": "Mercaderes Mágicos", "icon": "🛒"}
    ]
}

# =====================================================
# ADVENTURES ENDPOINTS (Adapted for new Schema)
# =====================================================

@router.get("/adventures", response_model=List[AdventureWithProgress])
async def get_adventures(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Obtener aventuras (Datos estáticos + Progreso real de lecciones).
    """
    result = []
    
    for adv in ADVENTURES_DATA:
        # Count lessons for this adventure level (using level as ID)
        adv_lessons = db.query(Lesson).filter(Lesson.adventure_level == adv['id']).all()
        total_lessons = len(adv_lessons)
        
        completed_lessons = 0
        if user_id:
            # Efficient query? Maybe.
            # Get IDs of lessons in this adventure
            lesson_ids = [l.id for l in adv_lessons]
            if lesson_ids:
                completed_count = db.query(UserLessonProgress).filter(
                    UserLessonProgress.user_id == user_id,
                    UserLessonProgress.lesson_id.in_(lesson_ids),
                    UserLessonProgress.completed == True
                ).count()
                completed_lessons = completed_count
        
        progress_percent = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0
        
        result.append(AdventureWithProgress(
            id=adv['id'],
            code=adv['code'],
            title=adv['title'],
            description=adv['description'],
            age_range=adv['age_range'],
            order_index=adv['id'],
            theme_color=adv['theme_color'],
            background_scene=adv['background_scene'],
            is_active=True,
            created_at=datetime.now(),
            total_sagas=len(SAGAS_DATA.get(adv['id'], [])),
            completed_sagas=0, 
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
    """Sagas Mocked but with real lesson progress"""
    # Find adventure ID
    adv = next((a for a in ADVENTURES_DATA if a['code'] == code), None)
    if not adv:
        raise HTTPException(status_code=404, detail="Adventure not found")
        
    sagas_list = SAGAS_DATA.get(adv['id'], [])
    
    result = []
    for saga in sagas_list:
        # Get lessons for this saga level
        lessons = db.query(Lesson).filter(
            Lesson.adventure_level == adv['id'],
            Lesson.saga_level == saga['id']
        ).all()
        
        total_lessons = len(lessons)
        completed_lessons = 0
        
        if user_id and lessons:
            lesson_ids = [l.id for l in lessons]
            completed_lessons = db.query(UserLessonProgress).filter(
                UserLessonProgress.user_id == user_id,
                UserLessonProgress.lesson_id.in_(lesson_ids),
                UserLessonProgress.completed == True
            ).count()
            
        progress_percent = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0
        
        result.append(SagaWithProgress(
            id=saga['id'],
            adventure_id=adv['id'],
            code=saga['code'],
            title=saga['title'],
            description="Saga description",
            order_index=saga['id'],
            icon=saga['icon'],
            is_active=True,
            created_at=datetime.now(),
            total_lessons=total_lessons,
            completed_lessons=completed_lessons,
            progress_percent=round(progress_percent, 1)
        ))
        
    return result

# =====================================================
# LESSONS ENDPOINTS (UPDATED FOR i18n JSON)
# =====================================================

@router.get("/lessons/{code}/play")
async def get_lesson_for_play(
    code: str,
    lang: str = "es",
    db: Session = Depends(get_db)
):
    """
    Retorna el JSON de la lección leyendo 'content_es' o 'content_en'.
    Adapta la respuesta para que LessonRunner la consuma.
    """
    lesson = db.query(Lesson).filter(Lesson.lesson_code == code).first()
    if not lesson:
        # Try finding by old lesson_id column if distinct? No, verified model uses lesson_code
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    # Select language content
    if lang == 'en':
        title = lesson.title_en
        description = lesson.description_en
        content_array = lesson.content_en
    else:
        title = lesson.title_es
        description = lesson.description_es
        content_array = lesson.content_es
        
    # Build Timeline from JSON array
    timeline = []
    if content_array and isinstance(content_array, list):
        for idx, ex in enumerate(content_array):
            # Inject ID and Order if missing
            ex_data = {
                "id": idx + 1, # Fake ID for frontend key
                "type": ex.get('type', 'unknown'),
                "character_code": ex.get('character_code'),  # Pass explicit character if defined (e.g. dina)
                "order_index": idx,
                "start_time_ms": 0, # Flat timeline
                "pause_at_ms": None,
                "points": 5, # Default pts
                "content": ex.get('content', {}),
                "correct_answer": ex.get('correct_answer'),
                "feedback": ex.get('feedback'),
                "audio": None # Generated lessons don't define audio segments yet
            }
            # Add audio placeholder if structure exists in content (custom logic)
            # content.audioUrl ? 
            
            timeline.append(ex_data)
            
    # Mock Saga/Adventure Info for display
    # We could look this up in ADVENTURES_DATA
    adv = next((a for a in ADVENTURES_DATA if a['id'] == lesson.adventure_level), {})
    
    return {
        "lesson": {
            "id": lesson.id,
            "code": lesson.lesson_code,
            "title": title,
            "description": description,
            "saga": "Saga " + str(lesson.saga_level),
            "adventure": adv.get('title', 'Aventura'),
            "adventure_code": adv.get('code', 'archipielago'),
            "language": lang
        },
        "meta": {
            "estimated_duration_seconds": lesson.duration * 60 if lesson.duration else 180,
            "points_reward": lesson.points_reward or 10,
            "xp_reward": 25
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
    """Marcar lección completada en nueva tabla user_lesson_progress"""
    lesson = db.query(Lesson).filter(Lesson.lesson_code == code).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check progress
    progress = db.query(UserLessonProgress).filter(
        UserLessonProgress.user_id == user_id,
        UserLessonProgress.lesson_id == lesson.id
    ).first()
    
    first_time = not progress or not progress.completed
    
    if not progress:
        progress = UserLessonProgress(
            user_id=user_id,
            lesson_id=lesson.id,
            completed=True,
            progress=100,
            score=lesson.points_reward,
            completed_at=datetime.now()
        )
        db.add(progress)
    else:
        progress.completed = True
        progress.progress = 100
        progress.completed_at = datetime.now()
        
    # Award Points (Only once? Or every time? Rules say once usually)
    points_earned = 0
    xp_earned = 0
    if first_time:
        points_earned = lesson.points_reward or 10
        xp_earned = 25
        user.lessons_completed += 1
        user.minutes_studied += request.time_spent_seconds // 60
        user.points_earned += points_earned
        
    db.commit()
    
    return {
        "message": "Lesson Completed",
        "points_earned": points_earned,
        "xp_earned": xp_earned,
        "total_lessons_completed": user.lessons_completed,
        "achievements_unlocked": []
    }

# =====================================================
# CHARACTERS (Kept compatible)
# =====================================================
@router.get("/characters", response_model=List[CharacterResponse])
async def get_characters(db: Session = Depends(get_db)):
    """Obtener todos los personajes activos."""
    characters = db.query(Character).filter(Character.is_active == True).all()
    return characters

@router.get("/characters/{code}")
async def get_character(code: str, db: Session = Depends(get_db)):
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
        "description": character.description,
        "gestures": [
            {"code": g.gesture_code, "duration_ms": g.duration_ms}
            for g in gestures
        ]
    }

# =====================================================
# USER STATS (Dashboard)
# =====================================================
@router.get("/users/{user_id}/stats")
async def get_user_lesson_stats(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Mock adventure progress
    adventure_progress = []
    for adv in ADVENTURES_DATA:
        # Count lessons
        adv_lessons = db.query(Lesson).filter(Lesson.adventure_level == adv['id']).all()
        total = len(adv_lessons)
        comp = 0
        if total > 0:
            l_ids = [l.id for l in adv_lessons]
            comp = db.query(UserLessonProgress).filter(
                UserLessonProgress.user_id == user_id,
                UserLessonProgress.lesson_id.in_(l_ids),
                UserLessonProgress.completed == True
            ).count()
        
        pct = (comp / total * 100) if total > 0 else 0
        adventure_progress.append({
            "adventure_id": adv['id'],
            "adventure_title": adv['title'],
            "adventure_code": adv['code'],
            "total_lessons": total,
            "completed_lessons": comp,
            "progress_percent": round(pct, 1),
            "current_saga": "In Progress"
        })

    return {
        "adventure_progress": adventure_progress,
        "total_xp": user.points_earned,
        "current_streak": user.current_streak,
        "lessons_this_week": 0,
        "average_accuracy": 0.0,
        "lessons_needing_review": 0
    }
