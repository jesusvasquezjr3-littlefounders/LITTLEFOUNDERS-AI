from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy.orm import Session

from config import settings
from models import RefreshToken

COOKIE_NAME = "lf_refresh_token"


def _hash_token(token: str) -> str:
    """SHA-256 hash — raw tokens are never stored in the DB."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_refresh_token() -> tuple[str, str]:
    """Returns (raw_token, token_hash)."""
    raw = secrets.token_urlsafe(64)
    return raw, _hash_token(raw)


def create_refresh_token_family(db: Session, user_id: int) -> str:
    """Create the first token in a new family. Returns the raw token (to set in cookie)."""
    raw, token_hash = generate_refresh_token()
    family_id = uuid4()
    expires_at = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)

    rt = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        family_id=family_id,
        expires_at=expires_at,
    )
    db.add(rt)
    db.commit()
    return raw


def rotate_refresh_token(db: Session, old_token_raw: str) -> tuple[str, int] | None:
    """
    Validate + rotate a refresh token (atomic rotation).

    Returns (new_raw_token, user_id) on success, or None if the token is
    invalid / expired / reused (reuse triggers full family revocation).
    """
    old_hash = _hash_token(old_token_raw)

    rt = db.query(RefreshToken).filter(
        RefreshToken.token_hash == old_hash
    ).first()

    if not rt:
        return None

    if rt.revoked_at is not None:
        _revoke_family(db, rt.family_id)
        db.commit()
        return None

    if rt.expires_at < datetime.utcnow():
        rt.revoked_at = datetime.utcnow()
        db.commit()
        return None

    rt.revoked_at = datetime.utcnow()

    new_raw, new_hash = generate_refresh_token()
    new_rt = RefreshToken(
        user_id=rt.user_id,
        token_hash=new_hash,
        family_id=rt.family_id,
        parent_token_hash=old_hash,
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days),
    )
    rt.replaced_by = new_hash

    db.add(new_rt)
    db.commit()

    return new_raw, rt.user_id


def _revoke_family(db: Session, family_id: str) -> None:
    """Revoke every token in a family (used on reuse detection)."""
    db.query(RefreshToken).filter(
        RefreshToken.family_id == family_id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": datetime.utcnow()})


def revoke_all_user_tokens(db: Session, user_id: int) -> None:
    """Revoke every active refresh token for a user (used on logout / password change)."""
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": datetime.utcnow()})
    db.commit()


def lookup_user_id_from_token(db: Session, token_raw: str) -> int | None:
    """Look up the user_id for a refresh token WITHOUT rotating it.
    Used by logout to identify the user before revoking all tokens."""
    token_hash = _hash_token(token_raw)
    rt = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at >= datetime.utcnow(),
    ).first()
    return rt.user_id if rt else None


def extract_refresh_token_from_cookie(cookie_header: str | None) -> str | None:
    """Extract the raw refresh token from the 'Cookie' header."""
    if not cookie_header:
        return None
    for part in cookie_header.split(";"):
        kv = part.strip().split("=", 1)
        if len(kv) == 2 and kv[0] == COOKIE_NAME:
            return kv[1]
    return None
