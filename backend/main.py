from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from utils.limiter import limiter
import hashlib
import json
import os

from config import settings
from database import engine
import models

# Import routers
from auth.endpoints import router as auth_router
from dashboard.endpoints import router as dashboard_router

from lesson_engine.endpoints import router as lesson_engine_router
from admin.endpoints import router as admin_router
from reports.endpoints import router as reports_router
from social.endpoints import router as social_router
from notifications.endpoints import router as notifications_router

# Create database tables
# DISABLED for Vercel: Tables should already exist in Supabase
# In serverless environments, this fails because it runs on every cold start
# models.Base.metadata.create_all(bind=engine)

# Rate limiter is configured in utils.limiter

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Custom exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Log validation errors for debugging
    print(f"[VALIDATION ERROR] {request.method} {request.url.path}: {len(exc.errors())} error(s)")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

# Request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    method = request.method
    path = request.url.path
    print(f"[REQUEST] {method} {path}")
    response = await call_next(request)
    print(f"[RESPONSE] {response.status_code}")
    return response

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    # COOP: OAuth routes need popup support; everything else is same-origin
    if request.url.path.startswith("/auth/") or request.url.path.startswith("/api/auth/"):
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    else:
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"

    # Standard security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response

# Include routers
app.include_router(auth_router)
app.include_router(dashboard_router)

app.include_router(lesson_engine_router)
app.include_router(admin_router)
app.include_router(reports_router)

app.include_router(social_router)
app.include_router(notifications_router)

@app.get("/")
async def root():
    return {
        "message": "LittleFounders API",
        "version": settings.api_version,
        "status": "online",
        "doc_url": "/docs"  # Hint for user
    }

@app.get("/health")
async def health_check():
    """Health check endpoint to verify backend is running"""
    try:
        from database import get_db
        from sqlalchemy import text
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "error"

    return {
        "status": "ok",
        "database": db_status,
    }

# Legacy file-based auth code removed for Vercel/Supabase migration


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)