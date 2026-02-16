from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
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

# Create database tables
# DISABLED for Vercel: Tables should already exist in Supabase
# In serverless environments, this fails because it runs on every cold start
# models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description
)

# Custom exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Log validation errors for debugging
    print(f"[VALIDATION ERROR] {request.method} {request.url.path}: {len(exc.errors())} error(s)")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

# Vercel Middleware to strip /api prefix
# When using rewrites in vercel.json, the path passed to FastAPI includes /api
# We need to strip it so authentication routes match (e.g. /api/auth/login -> /auth/login)
@app.middleware("http")
async def strip_api_prefix(request, call_next):
    original_path = request.url.path
    method = request.method
    print(f"[DEBUG] Incoming request: {method} {original_path}")
    
    if original_path.startswith("/api"):
        # Modify the scope directly to strip /api
        new_path = original_path[4:]  # Remove first 4 chars (/api)
        request.scope["path"] = new_path
        print(f"[DEBUG] Path stripped: {original_path} -> {new_path}")
    
    response = await call_next(request)
    print(f"[DEBUG] Response status: {response.status_code}")
    return response

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# Security headers middleware for OAuth flows
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    # OAuth routes need popup support - use unsafe-none for development
    # In production, this should be same-origin-allow-popups
    if request.url.path.startswith("/auth/") or request.url.path.startswith("/api/auth/"):
        response.headers["Cross-Origin-Opener-Policy"] = "unsafe-none"
    else:
        # For non-auth routes, keep it permissive during development
        response.headers["Cross-Origin-Opener-Policy"] = "unsafe-none"

    # Don't enforce COEP for now as it can break OAuth flows
    # response.headers["Cross-Origin-Embedder-Policy"] = settings.coep_policy
    return response

# Include routers
app.include_router(auth_router)
app.include_router(dashboard_router)

app.include_router(lesson_engine_router)
app.include_router(admin_router)

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
        # Test database connection
        from database import get_db
        from sqlalchemy import text
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "ok",
        "database": db_status,
        "environment": "vercel" if os.getenv("VERCEL") else "local",
        "config": {
            "db_host": settings.database_hostname,
            "db_port": settings.database_port,
            "db_name": settings.database_name
        }
    }

# Legacy file-based auth code removed for Vercel/Supabase migration


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)