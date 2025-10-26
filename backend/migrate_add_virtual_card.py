"""
Script de migración para agregar el campo has_virtual_card a usuarios existentes
"""

from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import User
import models

# Crear tablas si no existen
models.Base.metadata.create_all(bind=engine)

def migrate():
    db = SessionLocal()
    try:
        # Actualizar todos los usuarios existentes para agregar el campo has_virtual_card
        users = db.query(User).all()
        
        print(f"Migrando {len(users)} usuarios...")
        
        for user in users:
            # Por defecto, establecer has_virtual_card en False
            # Si quieres que algunos usuarios ya tengan tarjeta, puedes cambiar la lógica aquí
            if not hasattr(user, 'has_virtual_card') or user.has_virtual_card is None:
                user.has_virtual_card = False
        
        db.commit()
        print(f"✅ Migración completada: {len(users)} usuarios actualizados")
        
        # Mostrar resumen
        users_with_card = db.query(User).filter(User.has_virtual_card == True).count()
        users_without_card = db.query(User).filter(User.has_virtual_card == False).count()
        
        print(f"\nResumen:")
        print(f"  Usuarios con tarjeta: {users_with_card}")
        print(f"  Usuarios sin tarjeta: {users_without_card}")
        
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Iniciando migración para agregar campo has_virtual_card...")
    migrate()
    print("Migración finalizada")

