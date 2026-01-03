from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from database import get_db
from models import User, UserType
from auth.schemas import (
    UserRegister,
    UserLogin,
    UserResponse,
    Token
)
from auth.utils import verify_password, get_password_hash, create_access_token
from config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=dict)
async def register_user(user_data: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user (Simplified Flow)
    Creates a 'Universal' user with just name, email, and password.
    """
    try:
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create universal user
        new_user = User(
            name=user_data.name,
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            user_type=UserType.UNIVERSAL.value,
            # Demographic fields are now optional and handled later
            birth_date=None,
            gender=None,
            # Initialize default values
            balance=0.0,
            points_earned=0
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Create access token for immediate login
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": new_user.email}, expires_delta=access_token_expires
        )
        
        return {
            "message": "Registration successful",
            "user": {
                "id": new_user.id,
                "name": new_user.name,
                "email": new_user.email,
                "user_type": new_user.user_type
            },
            "access_token": access_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user"
        )


@router.post("/login", response_model=dict)
async def login_user(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Login a user and return user data with access token
    """
    # Find user by email
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    # Prepare user response
    user_data = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "user_type": user.user_type,
        "created_at": user.created_at.isoformat(),
        "birth_date": user.birth_date.isoformat() if user.birth_date else None,
        "lessons_completed": user.lessons_completed,
        "minutes_studied": user.minutes_studied,
        "points_earned": user.points_earned,
        "current_streak": user.current_streak,
    }
    
    # Add child-specific fields if user is a child
    if user.user_type == UserType.CHILD:
        user_data.update({
            "balance": user.balance,
            "has_virtual_card": user.has_virtual_card if hasattr(user, 'has_virtual_card') else False
        })
    
    return {
        "message": "Login successful",
        "user": user_data,
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.get("/users")
async def get_all_users(db: Session = Depends(get_db)):
    """
    Get all users (for development/debugging - should be removed in production)
    """
    users = db.query(User).all()
    
    safe_users = []
    for user in users:
        safe_user = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "user_type": user.user_type,
            "created_at": user.created_at.isoformat()
        }
        
        if user.user_type == UserType.CHILD:
            safe_user.update({
                "lessons_completed": user.lessons_completed,
                "minutes_studied": user.minutes_studied,
                "points_earned": user.points_earned,
                "balance": user.balance
            })
        
        safe_users.append(safe_user)
    
    return {"users": safe_users, "count": len(safe_users)}


@router.get("/me", response_model=UserResponse)
async def get_current_user(db: Session = Depends(get_db)):
    """
    Get current user information
    """
    # This would normally use the JWT token to identify the user
    # For now, it's a placeholder
    pass


@router.get("/family/{user_id}")
async def get_user_family(user_id: int, db: Session = Depends(get_db)):
    """
    Get complete family information for a user (tutor, child, sponsors)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    family_data = {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "user_type": user.user_type
        },
        "tutor": None,
        "children": []
    }
    
    # If user is a CHILD, get their tutor and sponsors
    if user.user_type == UserType.CHILD:
        if user.tutor_id:
            tutor = db.query(User).filter(User.id == user.tutor_id).first()
            if tutor:
                family_data["tutor"] = {
                    "id": tutor.id,
                    "name": tutor.name,
                    "email": tutor.email,
                    "user_type": tutor.user_type
                }
    
    # If user is a TUTOR, get their children
    elif user.user_type == UserType.TUTOR:
        children = db.query(User).filter(User.tutor_id == user_id).all()
        family_data["children"] = [
            {
                "id": child.id,
                "name": child.name,
                "email": child.email,
                "user_type": child.user_type,
                "balance": child.balance,
                "points_earned": child.points_earned
            }
            for child in children
        ]
    
    return family_data
