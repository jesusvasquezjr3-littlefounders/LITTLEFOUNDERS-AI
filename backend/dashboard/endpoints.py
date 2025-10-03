from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import User, Task, UserTask, Transaction, UserLessonProgress
from ..schemas import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats/{user_id}", response_model=DashboardStats)
async def get_user_stats(user_id: int, db: Session = Depends(get_db)):
    """Get dashboard statistics for a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return DashboardStats(
        lessons_completed=user.lessons_completed or 0,
        minutes_studied=user.minutes_studied or 0,
        points_earned=user.points_earned or 0,
        current_streak=user.current_streak or 0,
        balance=user.balance or 0.0
    )


@router.get("/recent-activity/{user_id}")
async def get_recent_activity(user_id: int, limit: int = 10, db: Session = Depends(get_db)):
    """Get recent activity for a user"""
    transactions = db.query(Transaction).filter(
        Transaction.user_id == user_id
    ).order_by(Transaction.created_at.desc()).limit(limit).all()
    
    return {
        "transactions": [
            {
                "id": t.id,
                "type": t.transaction_type.value,
                "amount": t.amount,
                "description": t.description,
                "created_at": t.created_at.isoformat()
            }
            for t in transactions
        ]
    }


@router.get("/pending-tasks/{user_id}")
async def get_pending_tasks(user_id: int, db: Session = Depends(get_db)):
    """Get pending tasks for a user"""
    pending_tasks = db.query(Task, UserTask).join(UserTask).filter(
        UserTask.user_id == user_id,
        UserTask.is_completed == False
    ).all()
    
    return {
        "tasks": [
            {
                "id": task.id,
                "title": task.title,
                "category": task.category.value,
                "reward": task.reward,
                "due_date": task.due_date.isoformat() if task.due_date else None
            }
            for task, _ in pending_tasks
        ]
    }
