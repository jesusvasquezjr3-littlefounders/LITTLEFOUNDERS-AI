from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import DashboardStats
from auth.permissions import verify_family_access

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _resolve(db: Session, public_id: str) -> User:
    """Resolve a public UUID to a User object"""
    user = db.query(User).filter(User.public_id == public_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/stats/{public_id}", response_model=DashboardStats)
async def get_user_stats(public_id: str, requester_public_id: str, db: Session = Depends(get_db)):
    """Get dashboard statistics for a user (with family access control)"""
    user = _resolve(db, public_id)
    requester = _resolve(db, requester_public_id)
    
    # Verify family access using internal IDs
    verify_family_access(db, requester.id, user.id, allow_self=True)
    
    return DashboardStats(
        lessons_completed=user.lessons_completed or 0,
        minutes_studied=user.minutes_studied or 0,
        points_earned=user.points_earned or 0,
        current_streak=user.current_streak or 0,
        balance=user.balance or 0.0
    )



