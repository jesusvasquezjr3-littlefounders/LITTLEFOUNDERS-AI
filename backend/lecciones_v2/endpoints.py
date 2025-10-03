from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Lesson, UserLessonProgress, User
from ..schemas import LessonResponse, LessonProgressUpdate, LessonComplete

router = APIRouter(prefix="/lecciones-v2", tags=["Lecciones V2"])


# Los endpoints son similares a lecciones pero con framework científico
# Reutilizamos la misma estructura de base de datos

@router.get("/", response_model=List[LessonResponse])
async def get_all_lessons_v2(age_range: str = None, db: Session = Depends(get_db)):
    """Get all lessons v2 (framework mode)"""
    query = db.query(Lesson).filter(Lesson.is_active == True)
    
    if age_range:
        query = query.filter(Lesson.age_range == age_range)
    
    lessons = query.all()
    return lessons


@router.get("/progress/{user_id}")
async def get_user_progress_v2(user_id: int, db: Session = Depends(get_db)):
    """Get lesson progress for v2 framework"""
    progress_records = db.query(UserLessonProgress, Lesson).join(Lesson).filter(
        UserLessonProgress.user_id == user_id
    ).all()
    
    return {
        "progress": [
            {
                "lesson_id": lesson.id,
                "lesson_title": lesson.title,
                "progress": progress.progress,
                "completed": progress.completed,
                "time_spent": progress.time_spent
            }
            for progress, lesson in progress_records
        ]
    }


@router.post("/progress/update")
async def update_lesson_progress_v2(
    progress_update: LessonProgressUpdate,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Update progress for v2 lesson"""
    progress = db.query(UserLessonProgress).filter(
        UserLessonProgress.user_id == user_id,
        UserLessonProgress.lesson_id == progress_update.lesson_id
    ).first()
    
    if not progress:
        progress = UserLessonProgress(
            user_id=user_id,
            lesson_id=progress_update.lesson_id,
            progress=progress_update.progress,
            time_spent=progress_update.time_spent
        )
        db.add(progress)
    else:
        progress.progress = progress_update.progress
        progress.time_spent += progress_update.time_spent
    
    db.commit()
    return {"message": "Progress updated (v2)", "progress": progress_update.progress}
