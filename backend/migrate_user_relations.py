"""
Script de migración para actualizar las relaciones de usuarios
de email-based a ID-based (Foreign Keys)

Este script:
1. Migra los datos existentes de tutor_email/child_email a tutor_id/sponsored_child_id
2. Elimina las columnas antiguas
3. Crea las nuevas columnas con Foreign Keys

Uso: python migrate_user_relations.py
"""

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import Session
from config import settings
import sys

def migrate_user_relations():
    """Migrar relaciones de usuarios de email a ID"""
    
    # Crear conexión a la base de datos
    engine = create_engine(settings.database_url)
    
    with engine.connect() as connection:
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        print("🔍 Verificando estructura actual de la tabla users...")
        print(f"Columnas actuales: {columns}")
        
        # Verificar si ya se realizó la migración
        if 'tutor_id' in columns and 'sponsored_child_id' in columns:
            print("✅ La migración ya fue aplicada. Las columnas tutor_id y sponsored_child_id ya existen.")
            
            # Verificar si las columnas antiguas todavía existen
            if 'tutor_email' in columns or 'child_email' in columns:
                print("⚠️  Las columnas antiguas (tutor_email, child_email) todavía existen.")
                response = input("¿Deseas eliminar las columnas antiguas? (sí/no): ")
                if response.lower() in ['sí', 'si', 's', 'yes', 'y']:
                    try:
                        if 'tutor_email' in columns:
                            connection.execute(text("ALTER TABLE users DROP COLUMN tutor_email"))
                            print("✅ Columna tutor_email eliminada")
                        if 'child_email' in columns:
                            connection.execute(text("ALTER TABLE users DROP COLUMN child_email"))
                            print("✅ Columna child_email eliminada")
                        connection.commit()
                    except Exception as e:
                        print(f"❌ Error al eliminar columnas antiguas: {e}")
                        connection.rollback()
            return
        
        print("\n🚀 Iniciando migración de relaciones de usuarios...")
        
        try:
            # Paso 1: Agregar nuevas columnas si no existen
            print("\n📝 Paso 1: Agregando nuevas columnas...")
            
            if 'tutor_id' not in columns:
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN tutor_id INTEGER
                """))
                print("✅ Columna tutor_id agregada")
            
            if 'sponsored_child_id' not in columns:
                connection.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN sponsored_child_id INTEGER
                """))
                print("✅ Columna sponsored_child_id agregada")
            
            connection.commit()
            
            # Paso 2: Migrar datos existentes
            print("\n📊 Paso 2: Migrando datos existentes...")
            
            # Migrar tutor_email a tutor_id para usuarios CHILD
            if 'tutor_email' in columns:
                result = connection.execute(text("""
                    UPDATE users AS child
                    SET tutor_id = (
                        SELECT tutor.id 
                        FROM users AS tutor 
                        WHERE tutor.email = child.tutor_email 
                        AND tutor.user_type = 'tutor'
                        LIMIT 1
                    )
                    WHERE child.user_type = 'child' 
                    AND child.tutor_email IS NOT NULL
                """))
                print(f"✅ Migrados {result.rowcount} registros de tutor_email a tutor_id")
            
            # Migrar child_email a sponsored_child_id para usuarios SPONSOR
            if 'child_email' in columns:
                result = connection.execute(text("""
                    UPDATE users AS sponsor
                    SET sponsored_child_id = (
                        SELECT child.id 
                        FROM users AS child 
                        WHERE child.email = sponsor.child_email 
                        AND child.user_type = 'child'
                        LIMIT 1
                    )
                    WHERE sponsor.user_type = 'sponsor' 
                    AND sponsor.child_email IS NOT NULL
                """))
                print(f"✅ Migrados {result.rowcount} registros de child_email a sponsored_child_id")
            
            connection.commit()
            
            # Paso 3: Agregar Foreign Keys
            print("\n🔗 Paso 3: Agregando Foreign Keys...")
            
            try:
                # Para SQLite, necesitamos recrear la tabla con las foreign keys
                # Para PostgreSQL/MySQL, podemos agregar constraints directamente
                
                # Verificar el tipo de base de datos
                db_type = engine.dialect.name
                
                if db_type == 'sqlite':
                    print("⚠️  SQLite detectado. Las Foreign Keys se aplicarán en la próxima recreación de la base de datos.")
                    print("   Ejecuta 'python create_tables.py' para aplicar completamente las Foreign Keys.")
                else:
                    # Para bases de datos que soportan ALTER TABLE ADD CONSTRAINT
                    connection.execute(text("""
                        ALTER TABLE users 
                        ADD CONSTRAINT fk_users_tutor 
                        FOREIGN KEY (tutor_id) REFERENCES users(id)
                    """))
                    
                    connection.execute(text("""
                        ALTER TABLE users 
                        ADD CONSTRAINT fk_users_sponsored_child 
                        FOREIGN KEY (sponsored_child_id) REFERENCES users(id)
                    """))
                    print("✅ Foreign Keys agregadas")
                
                connection.commit()
            except Exception as e:
                print(f"⚠️  Advertencia al agregar Foreign Keys: {e}")
                print("   Las columnas fueron creadas pero sin constraints de Foreign Key.")
                print("   Ejecuta 'python create_tables.py' para recrear la tabla con Foreign Keys completos.")
            
            # Paso 4: Eliminar columnas antiguas (opcional)
            print("\n🗑️  Paso 4: Limpieza de columnas antiguas...")
            
            if 'tutor_email' in columns or 'child_email' in columns:
                response = input("¿Deseas eliminar las columnas antiguas (tutor_email, child_email)? (sí/no): ")
                if response.lower() in ['sí', 'si', 's', 'yes', 'y']:
                    try:
                        if 'tutor_email' in columns:
                            connection.execute(text("ALTER TABLE users DROP COLUMN tutor_email"))
                            print("✅ Columna tutor_email eliminada")
                        if 'child_email' in columns:
                            connection.execute(text("ALTER TABLE users DROP COLUMN child_email"))
                            print("✅ Columna child_email eliminada")
                        connection.commit()
                    except Exception as e:
                        print(f"⚠️  No se pudieron eliminar las columnas antiguas: {e}")
                        print("   Puedes eliminarlas manualmente más tarde.")
                else:
                    print("⚠️  Columnas antiguas mantenidas. Puedes eliminarlas manualmente más tarde.")
            
            print("\n✅ ¡Migración completada exitosamente!")
            print("\n📋 Resumen:")
            print("   - Nuevas columnas: tutor_id, sponsored_child_id")
            print("   - Datos migrados desde tutor_email y child_email")
            print("   - Las relaciones ahora usan IDs en lugar de emails")
            
            print("\n💡 Próximos pasos:")
            print("   1. Verifica que los datos se migraron correctamente")
            print("   2. Prueba el registro de nuevas familias")
            print("   3. Si usas SQLite, considera ejecutar 'python create_tables.py' para aplicar Foreign Keys completos")
            
        except Exception as e:
            print(f"\n❌ Error durante la migración: {e}")
            connection.rollback()
            print("\n🔄 Revertiendo cambios...")
            sys.exit(1)


if __name__ == "__main__":
    print("=" * 60)
    print("  MIGRACIÓN DE RELACIONES DE USUARIOS")
    print("  De email-based a ID-based (Foreign Keys)")
    print("=" * 60)
    print()
    
    response = input("⚠️  Esta operación modificará la estructura de la base de datos.\n¿Deseas continuar? (sí/no): ")
    
    if response.lower() in ['sí', 'si', 's', 'yes', 'y']:
        migrate_user_relations()
    else:
        print("❌ Migración cancelada.")

