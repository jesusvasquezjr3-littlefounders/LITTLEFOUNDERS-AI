from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import GameSession, User
from schemas import GameSessionCreate, GameSessionUpdate, GameSessionResponse
from auth.permissions import verify_family_access

router = APIRouter(prefix="/investment-games", tags=["Investment Games"])


@router.post("/session", response_model=GameSessionResponse)
async def create_game_session(
    session: GameSessionCreate,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Create a new game session (e.g., Lemonade Stand)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if there's an active session for this game
    active_session = db.query(GameSession).filter(
        GameSession.user_id == user_id,
        GameSession.game_type == session.game_type,
        GameSession.is_active == True
    ).first()
    
    if active_session:
        return active_session
    
    # Create new session
    db_session = GameSession(
        user_id=user_id,
        game_type=session.game_type,
        day_number=1,
        cash=50.0,  # Starting cash
        inventory={"lemons": 0, "sugar": 0, "cups": 0},
        weather_forecast={},
        decisions={},
        score=0
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@router.get("/session/{user_id}/{game_type}", response_model=GameSessionResponse)
async def get_active_game_session(
    user_id: int,
    game_type: str,
    db: Session = Depends(get_db)
):
    """Get the active game session for a user"""
    session = db.query(GameSession).filter(
        GameSession.user_id == user_id,
        GameSession.game_type == game_type,
        GameSession.is_active == True
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active game session found")
    
    return session


@router.put("/session/{session_id}", response_model=GameSessionResponse)
async def update_game_session(
    session_id: int,
    session_update: GameSessionUpdate,
    db: Session = Depends(get_db)
):
    """Update game session (progress to next day, update inventory, etc.)"""
    db_session = db.query(GameSession).filter(GameSession.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    if session_update.day_number is not None:
        db_session.day_number = session_update.day_number
    if session_update.cash is not None:
        db_session.cash = session_update.cash
    if session_update.inventory is not None:
        db_session.inventory = session_update.inventory
    if session_update.weather_forecast is not None:
        db_session.weather_forecast = session_update.weather_forecast
    if session_update.decisions is not None:
        db_session.decisions = session_update.decisions
    if session_update.score is not None:
        db_session.score = session_update.score
    
    db.commit()
    db.refresh(db_session)
    return db_session


@router.post("/session/{session_id}/end")
async def end_game_session(session_id: int, db: Session = Depends(get_db)):
    """End a game session"""
    db_session = db.query(GameSession).filter(GameSession.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    db_session.is_active = False
    from datetime import datetime
    db_session.ended_at = datetime.now()
    
    db.commit()
    
    return {
        "message": "Game session ended",
        "final_score": db_session.score,
        "final_cash": db_session.cash,
        "days_played": db_session.day_number
    }


@router.get("/leaderboard/{game_type}")
async def get_game_leaderboard(
    game_type: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get leaderboard for a specific game"""
    sessions = db.query(GameSession, User).join(User).filter(
        GameSession.game_type == game_type,
        GameSession.is_active == False
    ).order_by(GameSession.score.desc()).limit(limit).all()
    
    return {
        "leaderboard": [
            {
                "rank": idx + 1,
                "user_name": user.name,
                "score": session.score,
                "cash": session.cash,
                "days_played": session.day_number
            }
            for idx, (session, user) in enumerate(sessions)
        ]
    }


@router.get("/history/{user_id}")
async def get_user_game_history(user_id: int, requester_id: int, db: Session = Depends(get_db)):
    """Get game history for a user (with family access control)"""
    # Verify family access
    verify_family_access(db, requester_id, user_id, allow_self=True)
    
    sessions = db.query(GameSession).filter(
        GameSession.user_id == user_id
    ).order_by(GameSession.started_at.desc()).all()
    
    return {
        "sessions": [
            {
                "id": session.id,
                "game_type": session.game_type,
                "score": session.score,
                "days_played": session.day_number,
                "started_at": session.started_at.isoformat(),
                "ended_at": session.ended_at.isoformat() if session.ended_at else None,
                "is_active": session.is_active
            }
            for session in sessions
        ]
    }
