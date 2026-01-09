from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
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
from tasks.endpoints import router as tasks_router
from parent_tasks.endpoints import router as parent_tasks_router
from savings.endpoints import router as savings_router
from store.endpoints import router as store_router
from lecciones.endpoints import router as lecciones_router
from investment_games.endpoints import router as investment_games_router
from virtual_cards.endpoints import router as virtual_cards_router

# Create database tables
# DISABLED for Vercel: Tables should already exist in Supabase
# In serverless environments, this fails because it runs on every cold start
# models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description
)

# Vercel Middleware to strip /api prefix
# When using rewrites in vercel.json, the path passed to FastAPI includes /api
# We need to strip it so authentication routes match (e.g. /api/auth/login -> /auth/login)
@app.middleware("http")
async def strip_api_prefix(request, call_next):
    if request.url.path.startswith("/api"):
        # Modify the scope directly to strip /api
        request.scope["path"] = request.url.path[4:]  # Remove first 4 chars (/api)
    response = await call_next(request)
    return response

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# Include routers
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(tasks_router)
app.include_router(parent_tasks_router)
app.include_router(savings_router)
app.include_router(store_router)
app.include_router(lecciones_router)
app.include_router(investment_games_router)
app.include_router(virtual_cards_router)

@app.get("/")
async def root():
    return {
        "message": "LittleFounders API",
        "version": settings.api_version,
        "status": "online",
        "doc_url": "/docs"  # Hint for user
    }

# Legacy file-based auth code removed for Vercel/Supabase migration


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)