from __future__ import annotations

from datetime import datetime, timedelta

from jose import JWTError, jwt

from config import settings


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=15)

    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def verify_token(token: str, credentials_exception):
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        return email
    except JWTError:
        raise credentials_exception


def get_token_issued_at(token: str) -> datetime | None:
    """Extract the issued-at timestamp from a JWT without full verification."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        iat = payload.get("iat")
        if iat:
            return datetime.utcfromtimestamp(iat)
    except JWTError:
        pass
    return None
