from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from database import get_db
from models import User, UserType
from auth.schemas import (
    FamilyRegistration,
    UserLogin,
    UserResponse,
    Token
)
from auth.utils import verify_password, get_password_hash, create_access_token
from config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=dict)
async def register_family(registration_data: FamilyRegistration, db: Session = Depends(get_db)):
    """
    Register a complete family (tutor, child, and optionally sponsor)
    """
    try:
        # Check if tutor email already exists
        existing_tutor = db.query(User).filter(User.email == registration_data.tutor.email).first()
        if existing_tutor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tutor email already registered"
            )
        
        # Check if child email already exists
        existing_child = db.query(User).filter(User.email == registration_data.child.email).first()
        if existing_child:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Child email already registered"
            )
        
        # Create tutor user
        tutor_birth_date = None
        if registration_data.tutor.birth_date:
            try:
                tutor_birth_date = datetime.fromisoformat(registration_data.tutor.birth_date)
            except:
                pass
        
        tutor_user = User(
            name=registration_data.tutor.name,
            email=registration_data.tutor.email,
            password_hash=get_password_hash(registration_data.tutor.password),
            user_type=UserType.TUTOR,
            birth_date=tutor_birth_date,
            gender=registration_data.tutor.gender,
        )
        db.add(tutor_user)
        db.flush()  # Get the tutor_user.id
        
        # Create child user with reference to tutor
        child_birth_date = None
        if registration_data.child.birth_date:
            try:
                child_birth_date = datetime.fromisoformat(registration_data.child.birth_date)
            except:
                pass
        
        child_user = User(
            name=registration_data.child.name,
            email=registration_data.child.email,
            password_hash=get_password_hash(registration_data.child.password),
            user_type=UserType.CHILD,
            birth_date=child_birth_date,
            gender=registration_data.child.gender,
            tutor_id=tutor_user.id,  # Link to tutor via ID
            lessons_completed=0,
            minutes_studied=0,
            points_earned=0,
            balance=0.0
        )
        db.add(child_user)
        db.flush()  # Get the child_user.id
        
        # Create sponsor if provided
        sponsor_user = None
        if registration_data.sponsor:
            existing_sponsor = db.query(User).filter(User.email == registration_data.sponsor.email).first()
            if existing_sponsor:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Sponsor email already registered"
                )
            
            sponsor_birth_date = None
            if registration_data.sponsor.birth_date:
                try:
                    sponsor_birth_date = datetime.fromisoformat(registration_data.sponsor.birth_date)
                except:
                    pass
            
            sponsor_user = User(
                name=registration_data.sponsor.name,
                email=registration_data.sponsor.email,
                password_hash=get_password_hash(registration_data.sponsor.password),
                user_type=UserType.SPONSOR,
                birth_date=sponsor_birth_date,
                gender=registration_data.sponsor.gender,
                sponsored_child_id=child_user.id,  # Link to child via ID
            )
            db.add(sponsor_user)
        
        db.commit()
        db.refresh(tutor_user)
        db.refresh(child_user)
        if sponsor_user:
            db.refresh(sponsor_user)
        
        response = {
            "message": "Family registration successful",
            "tutor": {
                "id": tutor_user.id,
                "name": tutor_user.name,
                "email": tutor_user.email,
                "user_type": tutor_user.user_type.value
            },
            "child": {
                "id": child_user.id,
                "name": child_user.name,
                "email": child_user.email,
                "user_type": child_user.user_type.value
            }
        }
        
        if sponsor_user:
            response["sponsor"] = {
                "id": sponsor_user.id,
                "name": sponsor_user.name,
                "email": sponsor_user.email,
                "user_type": sponsor_user.user_type.value
            }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register family"
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
        "user_type": user.user_type.value,
        "created_at": user.created_at.isoformat(),
        "birth_date": user.birth_date.isoformat() if user.birth_date else None,
    }
    
    # Add child-specific fields if user is a child
    if user.user_type == UserType.CHILD:
        user_data.update({
            "lessons_completed": user.lessons_completed,
            "minutes_studied": user.minutes_studied,
            "points_earned": user.points_earned,
            "balance": user.balance,
            "current_streak": user.current_streak,
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
            "user_type": user.user_type.value,
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
            "user_type": user.user_type.value
        },
        "tutor": None,
        "children": [],
        "sponsors": []
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
                    "user_type": tutor.user_type.value
                }
        
        # Get sponsors
        sponsors = db.query(User).filter(
            User.sponsored_child_id == user_id,
            User.user_type == UserType.SPONSOR
        ).all()
        family_data["sponsors"] = [
            {
                "id": sponsor.id,
                "name": sponsor.name,
                "email": sponsor.email,
                "user_type": sponsor.user_type.value
            }
            for sponsor in sponsors
        ]
    
    # If user is a TUTOR, get their children
    elif user.user_type == UserType.TUTOR:
        children = db.query(User).filter(User.tutor_id == user_id).all()
        family_data["children"] = [
            {
                "id": child.id,
                "name": child.name,
                "email": child.email,
                "user_type": child.user_type.value,
                "balance": child.balance,
                "points_earned": child.points_earned
            }
            for child in children
        ]
    
    # If user is a SPONSOR, get the sponsored child and their tutor
    elif user.user_type == UserType.SPONSOR:
        if user.sponsored_child_id:
            child = db.query(User).filter(User.id == user.sponsored_child_id).first()
            if child:
                family_data["children"] = [{
                    "id": child.id,
                    "name": child.name,
                    "email": child.email,
                    "user_type": child.user_type.value,
                    "balance": child.balance,
                    "points_earned": child.points_earned
                }]
                
                # Get the child's tutor
                if child.tutor_id:
                    tutor = db.query(User).filter(User.id == child.tutor_id).first()
                    if tutor:
                        family_data["tutor"] = {
                            "id": tutor.id,
                            "name": tutor.name,
                            "email": tutor.email,
                            "user_type": tutor.user_type.value
                        }
    
    return family_data
