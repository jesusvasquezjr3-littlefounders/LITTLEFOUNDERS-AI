from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..database import get_db
from ..models import Lesson, UserLessonProgress, User
from ..schemas import (
    LessonCreate,
    LessonResponse,
    LessonProgressUpdate,
    LessonComplete
)

router = APIRouter(prefix="/lecciones", tags=["Lecciones"])


@router.post("/", response_model=LessonResponse)
async def create_lesson(lesson: LessonCreate, db: Session = Depends(get_db)):
    """Create a new lesson"""
    db_lesson = Lesson(
        lesson_id=lesson.lesson_id,
        title=lesson.title,
        description=lesson.description,
        content=lesson.content,
        duration=lesson.duration,
        difficulty=lesson.difficulty,
        age_range=lesson.age_range,
        level_id=lesson.level_id,
        activities=lesson.activities,
        points_reward=lesson.points_reward
    )
    db.add(db_lesson)
    db.commit()
    db.refresh(db_lesson)
    return db_lesson


@router.get("/", response_model=List[LessonResponse])
async def get_all_lessons(age_range: str = None, db: Session = Depends(get_db)):
    """Get all lessons, optionally filtered by age range"""
    query = db.query(Lesson).filter(Lesson.is_active == True)
    
    if age_range:
        query = query.filter(Lesson.age_range == age_range)
    
    lessons = query.all()
    return lessons


@router.get("/{lesson_id}", response_model=LessonResponse)
async def get_lesson(lesson_id: int, db: Session = Depends(get_db)):
    """Get a specific lesson"""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.get("/by-level/{level_id}")
async def get_lessons_by_level(level_id: str, db: Session = Depends(get_db)):
    """Get all lessons for a specific level"""
    lessons = db.query(Lesson).filter(
        Lesson.level_id == level_id,
        Lesson.is_active == True
    ).all()
    return {"lessons": lessons}


@router.get("/progress/{user_id}")
async def get_user_progress(user_id: int, db: Session = Depends(get_db)):
    """Get lesson progress for a user"""
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
                "time_spent": progress.time_spent,
                "started_at": progress.started_at.isoformat() if progress.started_at else None,
                "completed_at": progress.completed_at.isoformat() if progress.completed_at else None
            }
            for progress, lesson in progress_records
        ]
    }


@router.post("/progress/update")
async def update_lesson_progress(
    progress_update: LessonProgressUpdate,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Update progress for a lesson"""
    # Check if progress record exists
    progress = db.query(UserLessonProgress).filter(
        UserLessonProgress.user_id == user_id,
        UserLessonProgress.lesson_id == progress_update.lesson_id
    ).first()
    
    if not progress:
        # Create new progress record
        progress = UserLessonProgress(
            user_id=user_id,
            lesson_id=progress_update.lesson_id,
            progress=progress_update.progress,
            time_spent=progress_update.time_spent
        )
        db.add(progress)
    else:
        # Update existing
        progress.progress = progress_update.progress
        progress.time_spent += progress_update.time_spent
    
    db.commit()
    return {"message": "Progress updated", "progress": progress_update.progress}


@router.post("/complete")
async def complete_lesson(
    lesson_complete: LessonComplete,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Mark a lesson as completed"""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_complete.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update or create progress record
    progress = db.query(UserLessonProgress).filter(
        UserLessonProgress.user_id == user_id,
        UserLessonProgress.lesson_id == lesson_complete.lesson_id
    ).first()
    
    if not progress:
        progress = UserLessonProgress(
            user_id=user_id,
            lesson_id=lesson_complete.lesson_id,
            progress=100,
            completed=True,
            completed_at=datetime.now(),
            time_spent=lesson_complete.time_spent
        )
        db.add(progress)
    else:
        progress.progress = 100
        progress.completed = True
        progress.completed_at = datetime.now()
        progress.time_spent += lesson_complete.time_spent
    
    # Update user stats
    user.lessons_completed += 1
    user.minutes_studied += lesson_complete.time_spent
    user.points_earned += lesson.points_reward
    
    db.commit()
    
    return {
        "message": "Lesson completed!",
        "points_earned": lesson.points_reward,
        "total_lessons_completed": user.lessons_completed
    }


@router.get("/completed/{user_id}")
async def get_completed_lessons(user_id: int, db: Session = Depends(get_db)):
    """Get all completed lessons for a user"""
    completed = db.query(Lesson, UserLessonProgress).join(UserLessonProgress).filter(
        UserLessonProgress.user_id == user_id,
        UserLessonProgress.completed == True
    ).all()
    
    return {
        "completed_lessons": [
            {
                "id": lesson.id,
                "title": lesson.title,
                "completed_at": progress.completed_at.isoformat() if progress.completed_at else None,
                "time_spent": progress.time_spent
            }
            for lesson, progress in completed
        ]
    }
