#!/usr/bin/env python3
"""
Script de migración para agregar campos de activación de banca digital
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from config import settings
import sys

def migrate_banking_activation():
    """Agregar campos de activación de banca digital a la tabla users"""
    
    # Crear URL de la base de datos
    DATABASE_URL = f"postgresql://{settings.database_username}:{settings.database_password}@{settings.database_hostname}:{settings.database_port}/{settings.database_name}"
    
    # Crear conexión a la base de datos
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    try:
        with engine.connect() as connection:
            # Verificar si las columnas ya existen
            result = connection.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name IN ('banking_activated', 'banking_activated_at', 'banking_activated_by')
            """))
            
            existing_columns = [row[0] for row in result]
            
            # Agregar banking_activated si no existe
            if 'banking_activated' not in existing_columns:
                print("Agregando columna banking_activated...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN banking_activated BOOLEAN DEFAULT FALSE
                """))
                connection.commit()
                print("[OK] Columna banking_activated agregada")
            else:
                print("[INFO] Columna banking_activated ya existe")
            
            # Agregar banking_activated_at si no existe
            if 'banking_activated_at' not in existing_columns:
                print("Agregando columna banking_activated_at...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN banking_activated_at TIMESTAMP WITH TIME ZONE
                """))
                connection.commit()
                print("[OK] Columna banking_activated_at agregada")
            else:
                print("[INFO] Columna banking_activated_at ya existe")
            
            # Agregar banking_activated_by si no existe
            if 'banking_activated_by' not in existing_columns:
                print("Agregando columna banking_activated_by...")
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN banking_activated_by INTEGER REFERENCES users(id)
                """))
                connection.commit()
                print("[OK] Columna banking_activated_by agregada")
            else:
                print("[INFO] Columna banking_activated_by ya existe")
            
            # Sincronizar banking_activated con has_virtual_card para usuarios existentes
            print("Sincronizando banking_activated con has_virtual_card...")
            connection.execute(text("""
                UPDATE users 
                SET banking_activated = has_virtual_card 
                WHERE banking_activated IS NULL OR banking_activated = FALSE
            """))
            connection.commit()
            print("[OK] Sincronización completada")
            
            print("\n[SUCCESS] Migración completada exitosamente!")
            
    except Exception as e:
        print(f"[ERROR] Error durante la migración: {e}")
        sys.exit(1)

if __name__ == "__main__":
    migrate_banking_activation()
