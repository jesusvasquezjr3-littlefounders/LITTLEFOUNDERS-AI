"""
Helper functions to create automatic notifications (follow, streak, achievements, etc.)
Import and call these from other modules (social, lesson_engine, etc.)
"""
from sqlalchemy.orm import Session
from models import (
    Notification, UserNotification, User,
    NotificationType, NotificationTargetType, NotificationStatus, NotificationPriority
)


def create_notification_for_user(
    db: Session,
    recipient: User,
    notif_type: str,
    title_es: str,
    title_en: str,
    body_es: str = None,
    body_en: str = None,
    action_url: str = None,
    metadata: dict = None,
    priority: str = NotificationPriority.NORMAL,
):
    """Create a notification targeted at a specific user and its UserNotification record."""
    notif = Notification(
        type=notif_type,
        priority=priority,
        status=NotificationStatus.ACTIVE,
        title_es=title_es,
        title_en=title_en,
        body_es=body_es,
        body_en=body_en,
        action_url=action_url,
        target_type=NotificationTargetType.SPECIFIC_USER,
        target_value=str(recipient.public_id),
        metadata=metadata,
    )
    db.add(notif)
    db.flush()

    user_notif = UserNotification(
        user_id=recipient.id,
        notification_id=notif.id,
    )
    db.add(user_notif)
    return notif


def notify_follow_request(db: Session, follower: User, target: User):
    """Notify target that follower wants to follow them."""
    create_notification_for_user(
        db, target,
        notif_type=NotificationType.FOLLOW_REQUEST,
        title_es=f"@{follower.username} quiere seguirte",
        title_en=f"@{follower.username} wants to follow you",
        body_es="Tienes una nueva solicitud de seguimiento.",
        body_en="You have a new follow request.",
        action_url="/profile",
        metadata={"follower_username": follower.username, "follower_public_id": str(follower.public_id)},
    )


def notify_new_follower(db: Session, follower: User, target: User):
    """Notify target that follower started following them (auto-accepted)."""
    create_notification_for_user(
        db, target,
        notif_type=NotificationType.NEW_FOLLOWER,
        title_es=f"@{follower.username} te ha seguido",
        title_en=f"@{follower.username} started following you",
        body_es="Tienes un nuevo seguidor.",
        body_en="You have a new follower.",
        action_url=f"/u/{follower.username}",
        metadata={"follower_username": follower.username, "follower_public_id": str(follower.public_id)},
    )


def notify_follow_accepted(db: Session, accepted_by: User, requester: User):
    """Notify the requester that their follow request was accepted."""
    create_notification_for_user(
        db, requester,
        notif_type=NotificationType.FOLLOW_ACCEPTED,
        title_es=f"@{accepted_by.username} aceptó tu solicitud",
        title_en=f"@{accepted_by.username} accepted your follow request",
        body_es="Ahora sigues a este usuario.",
        body_en="You are now following this user.",
        action_url=f"/u/{accepted_by.username}",
        metadata={"accepted_by_username": accepted_by.username, "accepted_by_public_id": str(accepted_by.public_id)},
    )


def notify_streak_milestone(db: Session, user: User, streak_count: int):
    """Notify user about a streak milestone."""
    create_notification_for_user(
        db, user,
        notif_type=NotificationType.STREAK,
        title_es=f"Racha de {streak_count} dias!",
        title_en=f"{streak_count}-day streak!",
        body_es=f"Llevas {streak_count} dias seguidos aprendiendo. ¡Sigue asi!",
        body_en=f"You've been learning for {streak_count} days in a row. Keep it up!",
        action_url="/dashboard",
        metadata={"streak_count": streak_count},
        priority=NotificationPriority.HIGH,
    )


def notify_achievement(db: Session, user: User, achievement_name_es: str, achievement_name_en: str):
    """Notify user about a new achievement."""
    create_notification_for_user(
        db, user,
        notif_type=NotificationType.ACHIEVEMENT,
        title_es=f"Logro desbloqueado: {achievement_name_es}",
        title_en=f"Achievement unlocked: {achievement_name_en}",
        body_es="¡Felicitaciones por tu progreso!",
        body_en="Congratulations on your progress!",
        action_url="/profile",
        metadata={"achievement_name_es": achievement_name_es, "achievement_name_en": achievement_name_en},
    )


def notify_lesson_completed(db: Session, user: User, lesson_title: str, points: int):
    """Notify user about a completed lesson."""
    create_notification_for_user(
        db, user,
        notif_type=NotificationType.LESSON,
        title_es=f"Leccion completada: {lesson_title}",
        title_en=f"Lesson completed: {lesson_title}",
        body_es=f"Ganaste {points} puntos.",
        body_en=f"You earned {points} points.",
        action_url="/lessons",
        metadata={"lesson_title": lesson_title, "points": points},
    )
