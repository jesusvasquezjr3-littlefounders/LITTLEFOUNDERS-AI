from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from database import get_db
from models import User, UserType
from auth.schemas import (
    UserRegister,
    UserLogin,
    UserUpdate,
    UserResponse,
    Token,
    GoogleLoginRequest
)
import requests
from auth.utils import verify_password, get_password_hash, create_access_token, verify_token
from config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


async def get_current_user_from_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    email = verify_token(token, credentials_exception)
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


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
            name=user_data.name or "Nuevo Usuario",
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


@router.post("/google", response_model=dict)
async def google_login(request: GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    Login or Register with Google
    """
    try:
        # Verify token using Google UserInfo Endpoint
        # Since we receive an access_token from frontend (implicit flow),
        # we validate it by calling Google's API directly.
        
        userinfo_url = f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={request.token}"
        response = requests.get(userinfo_url)
        
        if response.status_code != 200:
            raise ValueError("Invalid access token")
            
        id_info = response.json()
        
        # Validate that the token is valid (optional extra check: call tokeninfo)
        # But userinfo is usually enough if it returns data.
        
        email = id_info.get('email')
        if not email:
            raise ValueError("Email not found in Google account")
            
        email_verified = id_info.get('email_verified', False)
        if not email_verified:
            # Optionally strict checking
            pass

        name = id_info.get('name', '')
        google_id = id_info.get('sub')
        picture = id_info.get('picture', '')
        
        # Check if user exists
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            # Create new user - Default to UNIVERSAL
            user = User(
                email=email,
                name=name,
                password_hash="GOOGLE_AUTH_NO_PASSWORD", # Placeholder
                user_type=UserType.UNIVERSAL.value,
                auth_provider="google",
                google_id=google_id,
                is_active=True,
                balance=0.0,
                points_earned=0
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # Update existing user with google_id if missing
            if not user.google_id:
                user.google_id = google_id
                # Only update provider if it was email before and now they use google
                if user.auth_provider == 'email':
                    user.auth_provider = "google" 
                db.commit()
        
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
            "picture": picture # Send back picture from Google if available in frontend we can use it?
        }
        
        # Add Common fields
        if hasattr(user, 'lessons_completed'):
            user_data["lessons_completed"] = user.lessons_completed
        if hasattr(user, 'points_earned'):
            user_data["points_earned"] = user.points_earned
            
        # Add child-specific fields if user is a child
        if user.user_type == UserType.CHILD:
            user_data.update({
                "balance": user.balance if hasattr(user, 'balance') else 0.0,
                "has_virtual_card": user.has_virtual_card if hasattr(user, 'has_virtual_card') else False
            })
        elif user.user_type == UserType.UNIVERSAL:
             user_data.update({
                "balance": user.balance if hasattr(user, 'balance') else 0.0,
             })

        
        return {
            "message": "Google Login successful",
            "user": user_data,
            "access_token": access_token,
            "token_type": "bearer"
        }
        
    except ValueError as e:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google Token: {str(e)}"
        )
    except Exception as e:
        print(f"Google Auth Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google Authentication Failed"
        )


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
async def get_current_user(current_user: User = Depends(get_current_user_from_token)):
    """
    Get current user information
    """
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_user_profile(
    user_update: UserUpdate, 
    current_user: User = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Update user profile information (name, birth_date, gender)
    """
    # specific fields to update
    if user_update.name is not None:
        current_user.name = user_update.name
    if user_update.birth_date is not None:
        current_user.birth_date = datetime.strptime(user_update.birth_date, "%Y-%m-%d") if user_update.birth_date else None
    if user_update.gender is not None:
        current_user.gender = user_update.gender
        
    db.commit()
    db.refresh(current_user)
    return current_user


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


# =====================================================
# LANGUAGE PREFERENCE ENDPOINTS
# =====================================================

from pydantic import BaseModel

class LanguagePreference(BaseModel):
    language: str  # 'es' or 'en'

SUPPORTED_LANGUAGES = ['es', 'en']


@router.get("/preferences/language")
async def get_language_preference(
    current_user: User = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Get the current user's language preference.
    Returns the preferred language code ('es' or 'en').
    """
    # Return stored preference or default to 'es'
    preferred_language = getattr(current_user, 'preferred_language', 'es') or 'es'
    
    return {
        "language": preferred_language,
        "supported_languages": SUPPORTED_LANGUAGES
    }


@router.put("/preferences/language")
async def update_language_preference(
    preference: LanguagePreference,
    current_user: User = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Update the current user's language preference.
    Accepts: 'es' (Spanish) or 'en' (English)
    """
    # Validate language code
    if preference.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid language. Supported languages: {', '.join(SUPPORTED_LANGUAGES)}"
        )
    
    try:
        # Update user's language preference
        current_user.preferred_language = preference.language
        db.commit()
        
        return {
            "message": "Language preference updated",
            "language": preference.language
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update language preference"
        )
