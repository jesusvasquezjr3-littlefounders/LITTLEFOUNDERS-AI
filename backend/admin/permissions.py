"""
backend/admin/permissions.py
Dependency de FastAPI que restringe acceso solo a usuarios ADMIN.
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User, UserType
from auth.endpoints import get_current_user_from_token


async def require_admin(
    current_user: User = Depends(get_current_user_from_token),
) -> User:
    """
    Dependency que verifica que el usuario autenticado sea ADMIN.
    Retorna HTTP 403 si no lo es.
    Usar en todos los endpoints /admin/*.
    """
    if current_user.user_type != UserType.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requiere rol de administrador."
        )
    return current_user
