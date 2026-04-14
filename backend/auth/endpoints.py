from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from database import get_db
from models import User, UserType
from auth.schemas import (
    UserUpdate,
    UserResponse,
    SupabaseAuthRequest,
    GuestMergeRequest,
)
import requests
from auth.utils import create_access_token, verify_token, get_token_issued_at
from config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Import rate limiter (lazy to avoid circular import)
def _get_limiter():
    from main import limiter
    return limiter

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/supabase")


def resolve_user_by_public_id(db: Session, public_id: str):
    """Resolve a public UUID to a User object"""
    user = db.query(User).filter(User.public_id == public_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

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

    # Reject tokens issued before the last password change
    if user.password_changed_at:
        token_iat = get_token_issued_at(token)
        if token_iat and token_iat < user.password_changed_at.replace(tzinfo=None):
            raise credentials_exception

    return user

async def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """Optional authentication: returns User if valid token present, else None"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.split(" ")[1]
    try:
        email = verify_token(token, None)
        if not email:
            return None
        return db.query(User).filter(User.email == email).first()
    except Exception:
        return None


@router.post("/supabase", response_model=dict)
async def supabase_social_login(request: Request, payload: SupabaseAuthRequest, db: Session = Depends(get_db)):
    """
    Login or Register via Supabase OAuth (Google, Discord, etc.)
    Validates the Supabase access_token by calling the Supabase Auth API,
    then creates or syncs the user in the app database.
    """
    try:
        # Validate token via Supabase /auth/v1/user
        headers = {
            "Authorization": f"Bearer {payload.access_token}",
            "apikey": settings.supabase_key,
        }
        supabase_response = requests.get(
            f"{settings.supabase_url}/auth/v1/user", headers=headers
        )

        if supabase_response.status_code != 200:
            raise ValueError("Invalid or expired Supabase token")

        supabase_user = supabase_response.json()

        email = supabase_user.get("email")
        if not email:
            raise ValueError("Email not found in Supabase user — make sure email scope is granted")

        app_metadata = supabase_user.get("app_metadata", {})
        user_metadata = supabase_user.get("user_metadata", {})

        provider = app_metadata.get("provider", "unknown")
        name = (
            user_metadata.get("full_name")
            or user_metadata.get("name")
            or user_metadata.get("global_name")
            or user_metadata.get("custom_claims", {}).get("global_name")
            or email.split("@")[0]
        )

        # Check if user exists
        user = db.query(User).filter(User.email == email).first()

        if not user:
            user = User(
                email=email,
                name=name,
                user_type=UserType.UNIVERSAL.value,
                auth_provider=provider,
                is_active=True,
                balance=0.0,
                points_earned=0,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            is_new_user = True
        else:
            is_new_user = False
            if user.auth_provider == "email":
                user.auth_provider = provider
                db.commit()

        # Create app access token
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )

        # Refresh user from DB to ensure we have the latest stats
        db.refresh(user)

        user_data = {
            "public_id": str(user.public_id),
            "name": user.name,
            "email": user.email,
            "user_type": user.user_type,
            "created_at": user.created_at.isoformat(),
            "avatar_config": user.avatar_config,
            "username": user.username,
            "preferred_language": user.preferred_language,
            "auth_provider": user.auth_provider,
            "birth_date": user.birth_date.isoformat() if user.birth_date else None,
            "gender": user.gender,
            "lessons_completed": getattr(user, "lessons_completed", 0) or 0,
            "points_earned": getattr(user, "points_earned", 0) or 0,
            "balance": getattr(user, "balance", 0.0) or 0.0,
            "current_streak": getattr(user, "current_streak", 0) or 0,
            "max_streak": getattr(user, "max_streak", 0) or 0,
            "minutes_studied": getattr(user, "minutes_studied", 0) or 0,
        }

        return {
            "message": f"{provider.capitalize()} Login successful",
            "user": user_data,
            "access_token": access_token,
            "token_type": "bearer",
            "is_new_user": is_new_user,
        }

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Supabase Auth Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase Authentication Failed",
        )


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
    Update user profile information (name, birth_date, gender, username, preferred_language)
    """
    try:
        # specific fields to update
        if user_update.email is not None:
            normalized_email = user_update.email.lower().strip()
            if normalized_email != current_user.email.lower():
                existing = db.query(User).filter(
                    User.email == normalized_email,
                    User.id != current_user.id
                ).first()
                if existing:
                    raise HTTPException(status_code=400, detail="Este correo ya está en uso")
                current_user.email = normalized_email

        if user_update.name is not None:
            current_user.name = user_update.name
        if user_update.birth_date is not None:
            current_user.birth_date = datetime.strptime(user_update.birth_date, "%Y-%m-%d") if user_update.birth_date else None
        if user_update.gender is not None:
            current_user.gender = user_update.gender
        if user_update.avatar_config is not None:
            current_user.avatar_config = user_update.avatar_config
        if user_update.preferred_language is not None:
            current_user.preferred_language = user_update.preferred_language
        
        # Handle username update with uniqueness check
        if user_update.username is not None:
            # Check if username is already taken by another user
            existing_user = db.query(User).filter(
                User.username == user_update.username,
                User.id != current_user.id
            ).first()
            if existing_user:
                raise HTTPException(
                    status_code=400, 
                    detail="Este nombre de usuario ya está en uso"
                )
            current_user.username = user_update.username
            
        db.commit()
        db.refresh(current_user)
        return current_user
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ERROR] PATCH /auth/me failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Error al actualizar perfil")


@router.get("/family/{public_id}")
async def get_user_family(
    public_id: str,
    current_user: User = Depends(get_current_user_from_token),
    db: Session = Depends(get_db),
):
    """
    Get complete family information for a user (tutor, child).
    Requires authentication and family-level access.
    """
    from auth.permissions import verify_family_access
    user = resolve_user_by_public_id(db, public_id)
    verify_family_access(db, current_user.id, user.id, allow_self=True)
    
    family_data = {
        "user": {
            "public_id": str(user.public_id),
            "name": user.name,
            "email": user.email,
            "user_type": user.user_type
        },
        "tutor": None,
        "children": []
    }
    
    # If user is a CHILD, get their tutor
    if user.user_type == UserType.CHILD:
        if user.tutor_id:
            tutor = db.query(User).filter(User.id == user.tutor_id).first()
            if tutor:
                family_data["tutor"] = {
                    "public_id": str(tutor.public_id),
                    "name": tutor.name,
                    "email": tutor.email,
                    "user_type": tutor.user_type
                }
    
    # If user is a TUTOR, get their children
    elif user.user_type == UserType.TUTOR:
        children = db.query(User).filter(User.tutor_id == user.id).all()
        family_data["children"] = [
            {
                "public_id": str(child.public_id),
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


@router.post("/merge-guest")
async def merge_guest_data(
    payload: GuestMergeRequest,
    current_user: User = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Merge onboarding data collected from a guest session into the authenticated user's account.
    Called once after registration or OAuth login when lf_guest_profile exists in localStorage.
    Non-destructive: only fills missing fields; never overwrites existing user data.
    """
    try:
        # Only update name if user doesn't already have one
        if payload.name and not getattr(current_user, 'name', None):
            current_user.name = payload.name

        # Store language preference if set by onboarding
        if payload.preferred_language and payload.preferred_language in ('es', 'en'):
            current_user.preferred_language = payload.preferred_language

        # Apply XP — non-destructive: only when user has 0 points (fresh account)
        if payload.xp and payload.xp > 0:
            if not getattr(current_user, 'points_earned', None):
                current_user.points_earned = payload.xp

        # Apply streak — non-destructive: only when user has no active streak
        if payload.current_streak and payload.current_streak > 0:
            if not getattr(current_user, 'current_streak', None):
                current_user.current_streak = payload.current_streak
                current_user.max_streak = max(
                    getattr(current_user, 'max_streak', 0) or 0,
                    payload.current_streak,
                )

        db.commit()

        # Log analytics (best-effort, non-blocking)
        try:
            db.execute(
                """
                INSERT INTO onboarding_analytics
                    (user_id, name_provided, age, interests, experience_level, preferred_language,
                     onboarding_completed_at, steps_completed, converted_to_user)
                VALUES
                    (:uid, :name, :age, :interests::jsonb, :exp, :lang, NOW(), :steps, TRUE)
                """,
                {
                    "uid": current_user.id,
                    "name": payload.name,
                    "age": payload.age,
                    "interests": __import__('json').dumps(payload.interests or []),
                    "exp": payload.experience_level,
                    "lang": payload.preferred_language,
                    "steps": payload.steps_completed or 0,
                }
            )
            db.commit()
        except Exception:
            db.rollback()  # Non-critical — analytics failure should not fail the request

        return {"status": "merged"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to merge guest data: {str(e)}"
        )
