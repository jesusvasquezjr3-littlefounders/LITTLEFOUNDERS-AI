from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings
import os

# Create database URL
try:
    DATABASE_URL = f"postgresql://{settings.database_username}:{settings.database_password}@{settings.database_hostname}:{settings.database_port}/{settings.database_name}"
    
    # Create engine with connection pooling disabled for serverless
    # Vercel functions are stateless and short-lived
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using
        pool_recycle=300,    # Recycle connections after 5 minutes
        connect_args={
            "connect_timeout": 10,
            "options": "-c timezone=utc"
        }
    )
    
    # Create session factory
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create base class for models
    Base = declarative_base()
    
except Exception as e:
    print(f"Database initialization error: {e}")
    print(f"Environment: VERCEL={os.getenv('VERCEL')}")
    print(f"DB Host: {settings.database_hostname if hasattr(settings, 'database_hostname') else 'NOT SET'}")
    raise


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
