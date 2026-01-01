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
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description
)

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
        "status": "running"
    }

# Legacy file-based auth code removed for Vercel/Supabase migration


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)