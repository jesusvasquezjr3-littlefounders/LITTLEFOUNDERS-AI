"""
Notification endpoints:
  /notifications/*        — user-facing (get, read, dismiss)
  /admin/notifications/*  — admin management (CRUD)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, case
from typing import List, Optional
from datetime import datetime, timezone

from database import get_db
from models import (
    Notification, UserNotification, User,
    NotificationType, NotificationTargetType, NotificationStatus, NotificationPriority
)
from auth.endpoints import get_current_user_from_token
from admin.permissions import require_admin
from .schemas import (
    NotificationOut, UnreadCountOut,
    NotificationCreate, NotificationUpdate, NotificationAdminOut
)

router = APIRouter(tags=["Notifications"])


# ─────────────────────────────────────────────
# HELPER: build the base query for a user's visible notifications
# ─────────────────────────────────────────────

def _user_notifications_query(db: Session, user: User):
    """
    Returns notifications visible to this user:
    - target_type='all' (broadcast)
    - target_type='user_type' where target_value matches user.user_type
    - target_type='specific_user' where target_value matches user.public_id
    All must be status=active and not expired.
    """
    now = datetime.now(timezone.utc)
    return db.query(Notification).filter(
        Notification.status == NotificationStatus.ACTIVE,
        or_(Notification.scheduled_at.is_(None), Notification.scheduled_at <= now),
        or_(Notification.expires_at.is_(None), Notification.expires_at > now),
        or_(
            Notification.target_type == NotificationTargetType.ALL,
            and_(
                Notification.target_type == NotificationTargetType.USER_TYPE,
                Notification.target_value == user.user_type,
            ),
            and_(
                Notification.target_type == NotificationTargetType.SPECIFIC_USER,
                Notification.target_value == str(user.public_id),
            ),
        )
    )


def _resolve_language(notif: Notification, lang: str):
    """Pick title/body based on user's preferred language."""
    if lang == "en":
        return notif.title_en, notif.body_en
    return notif.title_es, notif.body_es


# ─────────────────────────────────────────────
# USER ENDPOINTS
# ─────────────────────────────────────────────

@router.get("/notifications", response_model=List[NotificationOut])
async def get_my_notifications(
    limit: int = Query(30, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    """Get the current user's notifications, newest first."""
    base = _user_notifications_query(db, current_user)
    notifications = base.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()

    # Fetch existing UserNotification records for read state
    notif_ids = [n.id for n in notifications]
    user_notifs = {}
    if notif_ids:
        records = db.query(UserNotification).filter(
            UserNotification.user_id == current_user.id,
            UserNotification.notification_id.in_(notif_ids),
        ).all()
        user_notifs = {un.notification_id: un for un in records}

    lang = current_user.preferred_language or "es"
    result = []
    for n in notifications:
        # Skip dismissed notifications
        un = user_notifs.get(n.id)
        if un and un.dismissed_at:
            continue

        title, body = _resolve_language(n, lang)
        result.append(NotificationOut(
            public_id=str(n.public_id),
            type=n.type,
            priority=n.priority,
            title=title,
            body=body,
            media_url=n.media_url,
            action_url=n.action_url,
            metadata=n.metadata,
            read_at=un.read_at if un else None,
            created_at=n.created_at,
        ))
    return result


@router.get("/notifications/unread-count", response_model=UnreadCountOut)
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    """Get the count of unread notifications for the badge."""
    base = _user_notifications_query(db, current_user)
    all_notifs = base.all()

    notif_ids = [n.id for n in all_notifs]
    if not notif_ids:
        return UnreadCountOut(count=0)

    # Get UserNotification records
    user_notifs = {}
    records = db.query(UserNotification).filter(
        UserNotification.user_id == current_user.id,
        UserNotification.notification_id.in_(notif_ids),
    ).all()
    user_notifs = {un.notification_id: un for un in records}

    count = 0
    for n in all_notifs:
        un = user_notifs.get(n.id)
        if un and (un.read_at or un.dismissed_at):
            continue
        count += 1

    return UnreadCountOut(count=count)


@router.post("/notifications/{public_id}/read")
async def mark_notification_read(
    public_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    """Mark a single notification as read."""
    notif = db.query(Notification).filter(Notification.public_id == public_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    un = db.query(UserNotification).filter(
        UserNotification.user_id == current_user.id,
        UserNotification.notification_id == notif.id,
    ).first()

    now = datetime.now(timezone.utc)
    if un:
        if not un.read_at:
            un.read_at = now
    else:
        un = UserNotification(user_id=current_user.id, notification_id=notif.id, read_at=now)
        db.add(un)

    db.commit()
    return {"message": "Marked as read"}


@router.post("/notifications/read-all")
async def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    """Mark all of the user's notifications as read."""
    base = _user_notifications_query(db, current_user)
    all_notifs = base.all()
    now = datetime.now(timezone.utc)

    notif_ids = [n.id for n in all_notifs]
    if not notif_ids:
        return {"message": "No notifications"}

    existing = db.query(UserNotification).filter(
        UserNotification.user_id == current_user.id,
        UserNotification.notification_id.in_(notif_ids),
    ).all()
    existing_map = {un.notification_id: un for un in existing}

    for nid in notif_ids:
        un = existing_map.get(nid)
        if un:
            if not un.read_at:
                un.read_at = now
        else:
            db.add(UserNotification(user_id=current_user.id, notification_id=nid, read_at=now))

    db.commit()
    return {"message": "All marked as read"}


@router.post("/notifications/{public_id}/dismiss")
async def dismiss_notification(
    public_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token),
):
    """Dismiss (hide) a notification for the current user."""
    notif = db.query(Notification).filter(Notification.public_id == public_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    un = db.query(UserNotification).filter(
        UserNotification.user_id == current_user.id,
        UserNotification.notification_id == notif.id,
    ).first()

    now = datetime.now(timezone.utc)
    if un:
        un.dismissed_at = now
        if not un.read_at:
            un.read_at = now
    else:
        un = UserNotification(user_id=current_user.id, notification_id=notif.id, read_at=now, dismissed_at=now)
        db.add(un)

    db.commit()
    return {"message": "Notification dismissed"}


# ─────────────────────────────────────────────
# ADMIN ENDPOINTS
# ─────────────────────────────────────────────

@router.get("/admin/notifications", response_model=List[NotificationAdminOut])
async def admin_list_notifications(
    status_filter: Optional[str] = Query(None, alias="status"),
    type_filter: Optional[str] = Query(None, alias="type"),
    target_filter: Optional[str] = Query(None, alias="target"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all notifications with optional filters (admin only)."""
    query = db.query(Notification)

    if status_filter:
        query = query.filter(Notification.status == status_filter)
    if type_filter:
        query = query.filter(Notification.type == type_filter)
    if target_filter:
        query = query.filter(Notification.target_type == target_filter)

    notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for n in notifications:
        # Count reads
        read_count = db.query(UserNotification).filter(
            UserNotification.notification_id == n.id,
            UserNotification.read_at.isnot(None),
        ).count()

        # Estimate total recipients
        if n.target_type == NotificationTargetType.ALL:
            total = db.query(User).filter(User.is_active == True).count()
        elif n.target_type == NotificationTargetType.USER_TYPE:
            total = db.query(User).filter(User.is_active == True, User.user_type == n.target_value).count()
        else:
            total = 1

        result.append(NotificationAdminOut(
            public_id=str(n.public_id),
            type=n.type,
            priority=n.priority,
            status=n.status,
            title_es=n.title_es,
            title_en=n.title_en,
            body_es=n.body_es,
            body_en=n.body_en,
            media_url=n.media_url,
            action_url=n.action_url,
            target_type=n.target_type,
            target_value=n.target_value,
            metadata=n.metadata,
            created_by_name=n.creator.name if n.creator else None,
            read_count=read_count,
            total_recipients=total,
            scheduled_at=n.scheduled_at,
            expires_at=n.expires_at,
            created_at=n.created_at,
        ))
    return result


@router.post("/admin/notifications", response_model=NotificationAdminOut, status_code=201)
async def admin_create_notification(
    data: NotificationCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a new notification (admin only)."""
    notif = Notification(
        type=data.type,
        priority=data.priority,
        status=data.status,
        title_es=data.title_es,
        title_en=data.title_en,
        body_es=data.body_es,
        body_en=data.body_en,
        media_url=data.media_url,
        action_url=data.action_url,
        target_type=data.target_type,
        target_value=data.target_value,
        metadata=data.metadata,
        created_by=admin.id,
        scheduled_at=data.scheduled_at,
        expires_at=data.expires_at,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # For specific_user targets, create the UserNotification eagerly
    if data.target_type == NotificationTargetType.SPECIFIC_USER and data.target_value:
        target_user = db.query(User).filter(User.public_id == data.target_value).first()
        if target_user:
            db.add(UserNotification(user_id=target_user.id, notification_id=notif.id))
            db.commit()

    # Estimate recipients
    if notif.target_type == NotificationTargetType.ALL:
        total = db.query(User).filter(User.is_active == True).count()
    elif notif.target_type == NotificationTargetType.USER_TYPE:
        total = db.query(User).filter(User.is_active == True, User.user_type == notif.target_value).count()
    else:
        total = 1

    return NotificationAdminOut(
        public_id=str(notif.public_id),
        type=notif.type,
        priority=notif.priority,
        status=notif.status,
        title_es=notif.title_es,
        title_en=notif.title_en,
        body_es=notif.body_es,
        body_en=notif.body_en,
        media_url=notif.media_url,
        action_url=notif.action_url,
        target_type=notif.target_type,
        target_value=notif.target_value,
        metadata=notif.metadata,
        created_by_name=admin.name,
        read_count=0,
        total_recipients=total,
        scheduled_at=notif.scheduled_at,
        expires_at=notif.expires_at,
        created_at=notif.created_at,
    )


@router.put("/admin/notifications/{public_id}", response_model=NotificationAdminOut)
async def admin_update_notification(
    public_id: str,
    data: NotificationUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update an existing notification (admin only)."""
    notif = db.query(Notification).filter(Notification.public_id == public_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "metadata":
            setattr(notif, "metadata", value)
        else:
            setattr(notif, key, value)

    db.commit()
    db.refresh(notif)

    read_count = db.query(UserNotification).filter(
        UserNotification.notification_id == notif.id,
        UserNotification.read_at.isnot(None),
    ).count()

    if notif.target_type == NotificationTargetType.ALL:
        total = db.query(User).filter(User.is_active == True).count()
    elif notif.target_type == NotificationTargetType.USER_TYPE:
        total = db.query(User).filter(User.is_active == True, User.user_type == notif.target_value).count()
    else:
        total = 1

    return NotificationAdminOut(
        public_id=str(notif.public_id),
        type=notif.type,
        priority=notif.priority,
        status=notif.status,
        title_es=notif.title_es,
        title_en=notif.title_en,
        body_es=notif.body_es,
        body_en=notif.body_en,
        media_url=notif.media_url,
        action_url=notif.action_url,
        target_type=notif.target_type,
        target_value=notif.target_value,
        metadata=notif.metadata,
        created_by_name=notif.creator.name if notif.creator else None,
        read_count=read_count,
        total_recipients=total,
        scheduled_at=notif.scheduled_at,
        expires_at=notif.expires_at,
        created_at=notif.created_at,
    )


@router.delete("/admin/notifications/{public_id}")
async def admin_delete_notification(
    public_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Archive (soft delete) a notification. Sets status to 'archived'."""
    notif = db.query(Notification).filter(Notification.public_id == public_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.status = NotificationStatus.ARCHIVED
    db.commit()
    return {"message": "Notification archived"}


@router.get("/admin/notifications/users", response_model=list)
async def admin_search_users_for_targeting(
    q: str = Query("", min_length=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Search users for notification targeting (admin only)."""
    if not q or len(q) < 2:
        return []

    term = f"%{q.lower()}%"
    users = db.query(User).filter(
        or_(
            func.lower(User.name).like(term),
            func.lower(User.email).like(term),
            func.lower(User.username).like(term),
        ),
        User.is_active == True,
    ).limit(20).all()

    return [
        {
            "public_id": str(u.public_id),
            "name": u.name,
            "email": u.email,
            "username": u.username,
            "user_type": u.user_type,
            "preferred_language": u.preferred_language,
        }
        for u in users
    ]
