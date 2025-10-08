"""
Helper functions for family-based access control
These functions ensure data integrity and prevent users from accessing
data from other families
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session
from models import User, UserType
from typing import Optional


def verify_family_access(
    db: Session,
    requester_id: int,
    target_user_id: int,
    allow_self: bool = True
) -> bool:
    """
    Verify if requester has permission to access target user's data
    
    Rules:
    - TUTOR can access their children's data
    - SPONSOR can access their sponsored child's data
    - CHILD can only access their own data
    - Users can always access their own data (if allow_self=True)
    
    Args:
        db: Database session
        requester_id: ID of the user making the request
        target_user_id: ID of the user whose data is being accessed
        allow_self: Whether to allow access to own data
    
    Returns:
        bool: True if access is allowed
    
    Raises:
        HTTPException: If access is denied or users not found
    """
    # Same user accessing their own data
    if allow_self and requester_id == target_user_id:
        return True
    
    # Get users
    requester = db.query(User).filter(User.id == requester_id).first()
    if not requester:
        raise HTTPException(status_code=404, detail="Requester not found")
    
    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    # TUTOR can access their children's data
    if requester.user_type == UserType.TUTOR:
        if target_user.tutor_id == requester_id:
            return True
    
    # SPONSOR can access their sponsored child's data
    elif requester.user_type == UserType.SPONSOR:
        if requester.sponsored_child_id == target_user_id:
            return True
    
    # CHILD can only access their own data (already handled above)
    elif requester.user_type == UserType.CHILD:
        pass
    
    # Access denied
    raise HTTPException(
        status_code=403,
        detail="Access denied: You can only view data from your registered family members"
    )


def get_authorized_children(db: Session, user_id: int) -> list[int]:
    """
    Get list of child IDs that a user is authorized to view/manage
    
    Args:
        db: Database session
        user_id: ID of the user (tutor, sponsor, or child)
    
    Returns:
        list[int]: List of child user IDs that the user can access
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return []
    
    authorized_children = []
    
    # If user is TUTOR, get all their children
    if user.user_type == UserType.TUTOR:
        children = db.query(User).filter(User.tutor_id == user_id).all()
        authorized_children = [child.id for child in children]
    
    # If user is SPONSOR, get their sponsored child
    elif user.user_type == UserType.SPONSOR:
        if user.sponsored_child_id:
            authorized_children = [user.sponsored_child_id]
    
    # If user is CHILD, only themselves
    elif user.user_type == UserType.CHILD:
        authorized_children = [user_id]
    
    return authorized_children


def get_authorized_parents(db: Session, child_id: int) -> list[int]:
    """
    Get list of parent (tutor + sponsor) IDs that can manage a child
    
    Args:
        db: Database session
        child_id: ID of the child user
    
    Returns:
        list[int]: List of parent user IDs (tutors and sponsors)
    """
    child = db.query(User).filter(User.id == child_id).first()
    if not child or child.user_type != UserType.CHILD:
        return []
    
    authorized_parents = []
    
    # Add tutor
    if child.tutor_id:
        authorized_parents.append(child.tutor_id)
    
    # Add sponsors
    sponsors = db.query(User).filter(
        User.sponsored_child_id == child_id,
        User.user_type == UserType.SPONSOR
    ).all()
    authorized_parents.extend([sponsor.id for sponsor in sponsors])
    
    return authorized_parents


def verify_ownership(
    db: Session,
    user_id: int,
    resource_user_id: int,
    resource_name: str = "resource"
) -> bool:
    """
    Verify that a resource belongs to the specified user
    Used for operations that modify data (create, update, delete)
    
    Args:
        db: Database session
        user_id: ID of the user making the request
        resource_user_id: user_id field in the resource
        resource_name: Name of the resource for error messages
    
    Returns:
        bool: True if user owns the resource
    
    Raises:
        HTTPException: If ownership verification fails
    """
    if user_id != resource_user_id:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: This {resource_name} does not belong to you"
        )
    return True


def get_family_member_ids(db: Session, user_id: int) -> list[int]:
    """
    Get all family member IDs for a user (includes self, tutor, children, sponsors)
    
    Args:
        db: Database session
        user_id: ID of the user
    
    Returns:
        list[int]: List of all family member IDs
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return []
    
    family_ids = [user_id]  # Include self
    
    if user.user_type == UserType.CHILD:
        # Add tutor
        if user.tutor_id:
            family_ids.append(user.tutor_id)
        
        # Add sponsors
        sponsors = db.query(User).filter(
            User.sponsored_child_id == user_id,
            User.user_type == UserType.SPONSOR
        ).all()
        family_ids.extend([sponsor.id for sponsor in sponsors])
    
    elif user.user_type == UserType.TUTOR:
        # Add children
        children = db.query(User).filter(User.tutor_id == user_id).all()
        family_ids.extend([child.id for child in children])
        
        # Add sponsors of children
        for child in children:
            sponsors = db.query(User).filter(
                User.sponsored_child_id == child.id,
                User.user_type == UserType.SPONSOR
            ).all()
            family_ids.extend([sponsor.id for sponsor in sponsors])
    
    elif user.user_type == UserType.SPONSOR:
        # Add sponsored child
        if user.sponsored_child_id:
            family_ids.append(user.sponsored_child_id)
            
            # Add child's tutor
            child = db.query(User).filter(User.id == user.sponsored_child_id).first()
            if child and child.tutor_id:
                family_ids.append(child.tutor_id)
    
    return list(set(family_ids))  # Remove duplicates

