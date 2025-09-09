from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración de la base de datos PostgreSQL para GCP
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    # Formato para Google Cloud SQL: postgresql://usuario:contraseña@ip_publica/nombre_db
    "postgresql://littlefounders_user:password@127.0.0.1:5432/littlefounders_db"
)

# Crear el engine de SQLAlchemy
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=True  # Cambiar a False en producción
)

# Crear SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Crear Base class
Base = declarative_base()

# Dependencia para obtener la sesión de base de datos
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
