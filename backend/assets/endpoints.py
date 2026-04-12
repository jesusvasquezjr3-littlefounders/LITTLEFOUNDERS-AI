"""
Assets proxy endpoints — generates signed URLs for game-assets bucket.
Accessible by authenticated AND anonymous (guest) users.
Rate-limited to prevent abuse.
"""
from fastapi import APIRouter, HTTPException, Request, status
from supabase import create_client
from config import settings
import time
from collections import defaultdict

router = APIRouter(prefix="/assets", tags=["Assets"])

BUCKET = "game-assets"
TTL_SECONDS = 3600  # 1 hour
MAX_REQUESTS_PER_MINUTE_ANON = 30

# Simple in-memory rate limiter (per IP)
_rate_store: dict = defaultdict(list)


def _check_rate_limit(ip: str, limit: int = MAX_REQUESTS_PER_MINUTE_ANON) -> None:
    now = time.time()
    window = 60  # seconds
    _rate_store[ip] = [t for t in _rate_store[ip] if t > now - window]
    if len(_rate_store[ip]) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please wait a moment."
        )
    _rate_store[ip].append(now)


@router.get("/signed-url")
async def get_signed_url(path: str, request: Request):
    """
    Generate a Supabase signed URL for a game asset.
    Accessible without authentication (supports guest users).

    Query params:
        path: Asset path within the game-assets bucket (e.g. "2-nam-vs-yum-game/pictures/game.gif")
    """
    # Rate limit by IP
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    # Validate path — no directory traversal
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid asset path.")

    try:
        supabase = create_client(settings.supabase_url, settings.supabase_key)
        result = supabase.storage.from_(BUCKET).create_signed_url(path, TTL_SECONDS)

        if not result or not result.get("signedURL"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset not found: {path}"
            )

        return {"url": result["signedURL"], "expires_in": TTL_SECONDS}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate signed URL: {str(e)}"
        )
