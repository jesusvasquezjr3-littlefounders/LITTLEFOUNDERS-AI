#!/usr/bin/env python3
"""
Script para probar la conexión a PostgreSQL antes de ejecutar el servidor
"""

import os
import sys
from dotenv import load_dotenv
import psycopg2
from sqlalchemy import create_engine, text

def test_psycopg2_connection():
    """Probar conexión directa con psycopg2"""
    print("🔍 Probando conexión con psycopg2...")
    
    load_dotenv()
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://littlefounders_user:password@127.0.0.1:5432/littlefounders_db"
    )
    
    try:
        # Parsear URL para psycopg2
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ Conexión psycopg2 exitosa!")
        print(f"📊 Versión PostgreSQL: {version[0]}")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error con psycopg2: {e}")
        return False

def test_sqlalchemy_connection():
    """Probar conexión con SQLAlchemy"""
    print("\n🔍 Probando conexión con SQLAlchemy...")
    
    load_dotenv()
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://littlefounders_user:password@127.0.0.1:5432/littlefounders_db"
    )
    
    try:
        engine = create_engine(database_url)
        with engine.connect() as connection:
            result = connection.execute(text("SELECT current_database(), current_user;"))
            row = result.fetchone()
            print(f"✅ Conexión SQLAlchemy exitosa!")
            print(f"📊 Base de datos: {row[0]}")
            print(f"👤 Usuario: {row[1]}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error con SQLAlchemy: {e}")
        return False

def test_tables_exist():
    """Verificar si las tablas existen"""
    print("\n🔍 Verificando tablas existentes...")
    
    load_dotenv()
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://littlefounders_user:password@127.0.0.1:5432/littlefounders_db"
    )
    
    try:
        engine = create_engine(database_url)
        with engine.connect() as connection:
            result = connection.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """))
            
            tables = [row[0] for row in result.fetchall()]
            
            if tables:
                print(f"✅ Tablas encontradas: {', '.join(tables)}")
            else:
                print("⚠️  No se encontraron tablas. Ejecuta las migraciones:")
                print("   alembic upgrade head")
            
            return len(tables) > 0
        
    except Exception as e:
        print(f"❌ Error verificando tablas: {e}")
        return False

def main():
    """Ejecutar todas las pruebas"""
    print("🚀 Probando Conexión a PostgreSQL - LittleFounders")
    print("=" * 50)
    
    # Verificar variables de entorno
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("⚠️  Variable DATABASE_URL no configurada")
        print("📝 Crea un archivo .env basado en .env.example")
        return False
    
    print(f"🔗 URL de conexión: {database_url.replace(database_url.split('@')[0].split('://')[1], '***')}")
    
    # Ejecutar pruebas
    tests_passed = 0
    total_tests = 3
    
    if test_psycopg2_connection():
        tests_passed += 1
    
    if test_sqlalchemy_connection():
        tests_passed += 1
        
    if test_tables_exist():
        tests_passed += 1
    
    # Resumen
    print("\n" + "=" * 50)
    print(f"📊 Resultados: {tests_passed}/{total_tests} pruebas exitosas")
    
    if tests_passed == total_tests:
        print("🎉 ¡Todo configurado correctamente!")
        print("🚀 Puedes ejecutar el servidor con: python main_v2.py")
        return True
    else:
        print("⚠️  Hay problemas de configuración.")
        print("📖 Revisa la guía en setup_gcp_postgres.md")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)