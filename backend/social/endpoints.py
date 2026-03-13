from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List

from database import get_db
from models import User, Follow, FollowStatus, UserType
from auth.endpoints import get_current_user_from_token
from .schemas import UserPublicProfile, FollowActionResponse, FollowRequestResponse

router = APIRouter(prefix="/social", tags=["Social"])

def get_profile_data(db: Session, target_user: User, current_user: User) -> UserPublicProfile:
    # Get stats
    followers_count = db.query(Follow).filter(
        Follow.followed_id == target_user.id,
        Follow.status == FollowStatus.ACCEPTED
    ).count()
    following_count = db.query(Follow).filter(
        Follow.follower_id == target_user.id,
        Follow.status == FollowStatus.ACCEPTED
    ).count()

    # Check follow status
    follow_record = None
    if current_user:
        follow_record = db.query(Follow).filter(
            Follow.follower_id == current_user.id,
            Follow.followed_id == target_user.id
        ).first()

    is_following = False
    follow_status_val = None
    if follow_record:
        follow_status_val = follow_record.status
        if follow_record.status == FollowStatus.ACCEPTED:
            is_following = True

    return UserPublicProfile(
        public_id=str(target_user.public_id),
        username=target_user.username or "",
        name=target_user.name,
        avatar_config=target_user.avatar_config,
        lessons_completed=target_user.lessons_completed,
        points_earned=target_user.points_earned,
        current_streak=target_user.current_streak,
        followers_count=followers_count,
        following_count=following_count,
        is_following=is_following,
        follow_status=follow_status_val
    )

@router.get("/search", response_model=List[UserPublicProfile])
async def search_users(q: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    if not q or len(q) < 3:
        return []
        
    # Remove @ if present in search query
    search_q = q.lstrip('@')
    term = f"%{search_q.lower()}%"
    users = db.query(User).filter(
        func.lower(User.username).like(term),
        User.id != current_user.id
    ).limit(20).all()
    
    results = []
    for u in users:
        # Ignore users without username
        if not u.username:
            continue
        results.append(get_profile_data(db, u, current_user))
        
    return results

@router.get("/profile/{username}", response_model=UserPublicProfile)
async def get_user_profile(username: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    username = username.lstrip('@')
    target_user = db.query(User).filter(User.username == username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    return get_profile_data(db, target_user, current_user)

@router.post("/follow/{username}", response_model=FollowActionResponse)
async def follow_user(username: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    username = username.lstrip('@')
    target_user = db.query(User).filter(User.username == username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes seguirte a ti mismo")
        
    # Check if already followed
    existing_follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.followed_id == target_user.id
    ).first()
    
    if existing_follow:
        if existing_follow.status == FollowStatus.ACCEPTED:
            return FollowActionResponse(message="Ya sigues a este usuario", status="accepted")
        elif existing_follow.status == FollowStatus.PENDING:
            return FollowActionResponse(message="Solicitud ya enviada", status="pending")
        else:
            db.delete(existing_follow)
            db.commit()
    
    # Determine status
    if target_user.user_type == UserType.UNIVERSAL.value:
        new_status = FollowStatus.ACCEPTED
    else:
        new_status = FollowStatus.PENDING
        
    new_follow = Follow(
        follower_id=current_user.id,
        followed_id=target_user.id,
        status=new_status
    )
    db.add(new_follow)
    db.commit()
    
    return FollowActionResponse(
        message="Siguiendo" if str(new_status) == FollowStatus.ACCEPTED else "Solicitud enviada",
        status=new_status.value if hasattr(new_status, 'value') else new_status
    )

@router.post("/unfollow/{username}", response_model=FollowActionResponse)
async def unfollow_user(username: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    username = username.lstrip('@')
    target_user = db.query(User).filter(User.username == username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    existing_follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.followed_id == target_user.id
    ).first()
    
    if existing_follow:
        db.delete(existing_follow)
        db.commit()
        
    return FollowActionResponse(message="Dejaste de seguir", status="unfollowed")

@router.get("/followers", response_model=List[UserPublicProfile])
async def get_followers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    # People who follow me AND are accepted
    followers = db.query(User).join(Follow, User.id == Follow.follower_id).filter(
        Follow.followed_id == current_user.id,
        Follow.status == FollowStatus.ACCEPTED
    ).all()
    
    return [get_profile_data(db, u, current_user) for u in followers]

@router.get("/following", response_model=List[UserPublicProfile])
async def get_following(db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    # People who I follow AND are accepted
    following = db.query(User).join(Follow, User.id == Follow.followed_id).filter(
        Follow.follower_id == current_user.id,
        Follow.status == FollowStatus.ACCEPTED
    ).all()
    
    return [get_profile_data(db, u, current_user) for u in following]

@router.get("/requests/pending", response_model=List[FollowRequestResponse])
async def get_pending_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    # People who requested to follow me
    pending_follows = db.query(Follow).filter(
        Follow.followed_id == current_user.id,
        Follow.status == FollowStatus.PENDING
    ).all()
    
    results = []
    for f in pending_follows:
        follower = f.follower
        if follower:
            results.append(FollowRequestResponse(
                public_id=str(follower.public_id),
                username=follower.username or "",
                name=follower.name,
                avatar_config=follower.avatar_config,
                requested_at=f.created_at
            ))
            
    return results

@router.post("/requests/accept/{username}", response_model=FollowActionResponse)
async def accept_request(username: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    username = username.lstrip('@')
    follower = db.query(User).filter(User.username == username).first()
    if not follower:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    follow_req = db.query(Follow).filter(
        Follow.follower_id == follower.id,
        Follow.followed_id == current_user.id,
        Follow.status == FollowStatus.PENDING
    ).first()
    
    if not follow_req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        
    follow_req.status = FollowStatus.ACCEPTED
    db.commit()
    
    return FollowActionResponse(message="Solicitud aceptada", status="accepted")

@router.post("/requests/reject/{username}", response_model=FollowActionResponse)
async def reject_request(username: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    username = username.lstrip('@')
    follower = db.query(User).filter(User.username == username).first()
    if not follower:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    follow_req = db.query(Follow).filter(
        Follow.follower_id == follower.id,
        Follow.followed_id == current_user.id,
        Follow.status == FollowStatus.PENDING
    ).first()
    
    if not follow_req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        
    db.delete(follow_req)
    db.commit()
    
    return FollowActionResponse(message="Solicitud rechazada", status="rejected")
