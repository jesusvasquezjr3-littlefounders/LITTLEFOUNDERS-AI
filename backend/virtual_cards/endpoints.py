from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import User, UserType

router = APIRouter(prefix="/virtual-cards", tags=["virtual-cards"])


# Schemas
class VirtualCardGenerateRequest(BaseModel):
    child_id: int


class VirtualCardInfo(BaseModel):
    id: int
    name: str
    email: str
    has_virtual_card: bool
    balance: float


class VirtualCardStatusResponse(BaseModel):
    has_card: bool
    message: str


# Endpoints
@router.post("/generate/{parent_id}")
async def generate_virtual_card(
    parent_id: int,
    request: VirtualCardGenerateRequest,
    db: Session = Depends(get_db)
):
    """
    Genera una tarjeta virtual para un child. 
    Solo puede ser ejecutado por un tutor o sponsor relacionado con el child.
    """
    # Verificar que el parent existe
    parent = db.query(User).filter(User.id == parent_id).first()
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    
    # Verificar que el parent es tutor o sponsor
    if parent.user_type not in [UserType.TUTOR, UserType.SPONSOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tutors and sponsors can generate virtual cards"
        )
    
    # Verificar que el child existe
    child = db.query(User).filter(User.id == request.child_id).first()
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Child not found"
        )
    
    # Verificar que es un child
    if child.user_type != UserType.CHILD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a child"
        )
    
    # Verificar relación familiar
    is_related = False
    if parent.user_type == UserType.TUTOR:
        # Verificar si el child tiene al parent como tutor
        if child.tutor_id == parent_id:
            is_related = True
    elif parent.user_type == UserType.SPONSOR:
        # Verificar si el sponsor está patrocinando a este child
        if parent.sponsored_child_id == request.child_id:
            is_related = True
    
    if not is_related:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not related to this child"
        )
    
    # Verificar si ya tiene tarjeta
    if child.has_virtual_card:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Child already has a virtual card"
        )
    
    # Generar tarjeta virtual y activar banca digital
    child.has_virtual_card = True
    child.banking_activated = True
    child.banking_activated_at = datetime.now()
    child.banking_activated_by = parent_id
    db.commit()
    db.refresh(child)
    
    return {
        "success": True,
        "message": "Virtual card generated successfully",
        "child_id": child.id,
        "child_name": child.name,
        "has_virtual_card": child.has_virtual_card
    }


@router.post("/generate-for-self/{user_id}")
async def generate_virtual_card_for_self(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Genera una tarjeta virtual para el propio usuario (tutor o sponsor).
    """
    # Verificar que el usuario existe
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verificar que el usuario es tutor o sponsor
    if user.user_type not in [UserType.TUTOR, UserType.SPONSOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tutors and sponsors can generate cards for themselves"
        )
    
    # Verificar si ya tiene tarjeta
    if user.has_virtual_card:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has a virtual card"
        )
    
    # Generar tarjeta virtual y activar banca digital
    user.has_virtual_card = True
    user.banking_activated = True
    user.banking_activated_at = datetime.now()
    user.banking_activated_by = user_id  # Self-activated
    db.commit()
    db.refresh(user)
    
    return {
        "success": True,
        "message": "Virtual card generated successfully for yourself",
        "user_id": user.id,
        "user_name": user.name,
        "has_virtual_card": user.has_virtual_card
    }


@router.get("/status/{user_id}")
async def get_virtual_card_status(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtiene el estado de la tarjeta virtual de un usuario.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Si es tutor o sponsor, devolver información de sus children y propia
    if user.user_type in [UserType.TUTOR, UserType.SPONSOR]:
        children = []
        
        if user.user_type == UserType.TUTOR:
            # Obtener children del tutor
            children_list = db.query(User).filter(
                User.tutor_id == user_id,
                User.user_type == UserType.CHILD
            ).all()
            children = [
                {
                    "id": child.id,
                    "name": child.name,
                    "email": child.email,
                    "has_virtual_card": child.has_virtual_card,
                    "banking_activated": child.banking_activated,
                    "banking_activated_at": child.banking_activated_at.isoformat() if child.banking_activated_at else None,
                    "balance": child.balance
                }
                for child in children_list
            ]
        
        elif user.user_type == UserType.SPONSOR:
            # Obtener el child patrocinado
            if user.sponsored_child_id:
                child = db.query(User).filter(User.id == user.sponsored_child_id).first()
                if child:
                    children = [{
                        "id": child.id,
                        "name": child.name,
                        "email": child.email,
                        "has_virtual_card": child.has_virtual_card,
                        "banking_activated": child.banking_activated,
                        "banking_activated_at": child.banking_activated_at.isoformat() if child.banking_activated_at else None,
                        "balance": child.balance
                    }]
        
        return {
            "user_type": user.user_type.value,
            "has_card": user.has_virtual_card,
            "banking_activated": user.banking_activated,
            "balance": user.balance,
            "children": children,
            "message": "Parent information retrieved successfully"
        }
    
    # Si es child, devolver su propio estado
    elif user.user_type == UserType.CHILD:
        return {
            "user_type": user.user_type.value,
            "has_card": user.has_virtual_card,
            "banking_activated": user.banking_activated,
            "banking_activated_at": user.banking_activated_at.isoformat() if user.banking_activated_at else None,
            "balance": user.balance,
            "message": "Banca digital activada" if user.banking_activated else "Banca digital no activada"
        }
    
    return {
        "user_type": user.user_type.value,
        "has_card": False,
        "message": "Unknown user type"
    }


@router.delete("/revoke/{parent_id}/{child_id}")
async def revoke_virtual_card(
    parent_id: int,
    child_id: int,
    db: Session = Depends(get_db)
):
    """
    Revoca la tarjeta virtual de un child.
    Solo puede ser ejecutado por un tutor relacionado con el child.
    """
    # Verificar que el parent existe
    parent = db.query(User).filter(User.id == parent_id).first()
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    
    # Verificar que el parent es tutor
    if parent.user_type != UserType.TUTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tutors can revoke virtual cards"
        )
    
    # Verificar que el child existe
    child = db.query(User).filter(User.id == child_id).first()
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Child not found"
        )
    
    # Verificar relación familiar
    if child.tutor_id != parent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the tutor of this child"
        )
    
    # Verificar si tiene tarjeta
    if not child.has_virtual_card:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Child doesn't have a virtual card"
        )
    
    # Revocar tarjeta virtual y desactivar banca digital
    child.has_virtual_card = False
    child.banking_activated = False
    child.banking_activated_at = None
    child.banking_activated_by = None
    db.commit()
    db.refresh(child)
    
    return {
        "success": True,
        "message": "Virtual card revoked successfully",
        "child_id": child.id,
        "child_name": child.name,
        "has_virtual_card": child.has_virtual_card
    }


@router.get("/children-without-card/{parent_id}")
async def get_children_without_card(
    parent_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtiene la lista de children sin tarjeta virtual.
    """
    parent = db.query(User).filter(User.id == parent_id).first()
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found"
        )
    
    if parent.user_type not in [UserType.TUTOR, UserType.SPONSOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only parents can access this endpoint"
        )
    
    children = []
    
    if parent.user_type == UserType.TUTOR:
        children_list = db.query(User).filter(
            User.tutor_id == parent_id,
            User.user_type == UserType.CHILD,
            User.has_virtual_card == False
        ).all()
        children = [
            {
                "id": child.id,
                "name": child.name,
                "email": child.email,
                "balance": child.balance
            }
            for child in children_list
        ]
    
    elif parent.user_type == UserType.SPONSOR:
        if parent.sponsored_child_id:
            child = db.query(User).filter(
                User.id == parent.sponsored_child_id,
                User.has_virtual_card == False
            ).first()
            if child:
                children = [{
                    "id": child.id,
                    "name": child.name,
                    "email": child.email,
                    "balance": child.balance
                }]
    
    return {
        "success": True,
        "children": children,
        "count": len(children)
    }

