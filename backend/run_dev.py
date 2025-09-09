#!/usr/bin/env python3
"""
Script para ejecutar el servidor de desarrollo con PostgreSQL local
"""

import os
import sys
import subprocess
import time
from pathlib import Path

def check_docker():
    """Verificar si Docker está disponible"""
    try:
        result = subprocess.run(['docker', '--version'], capture_output=True, text=True)
        return result.returncode == 0
    except FileNotFoundError:
        return False

def start_postgres():
    """Iniciar PostgreSQL con Docker Compose"""
    print("🐳 Iniciando PostgreSQL con Docker...")
    
    try:
        # Iniciar PostgreSQL
        subprocess.run(['docker-compose', '-f', 'docker-compose.dev.yml', 'up', '-d', 'postgres'], check=True)
        
        # Esperar a que PostgreSQL esté listo
        print("⏳ Esperando a que PostgreSQL esté listo...")
        time.sleep(10)
        
        # Verificar que esté corriendo
        result = subprocess.run(['docker-compose', '-f', 'docker-compose.dev.yml', 'ps'], 
                              capture_output=True, text=True)
        
        if 'littlefounders_postgres' in result.stdout and 'Up' in result.stdout:
            print("✅ PostgreSQL iniciado exitosamente!")
            return True
        else:
            print("❌ PostgreSQL no se inició correctamente")
            return False
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Error iniciando PostgreSQL: {e}")
        return False

def run_migrations():
    """Ejecutar migraciones de Alembic"""
    print("📄 Ejecutando migraciones...")
    
    try:
        # Configurar PATH
        env = os.environ.copy()
        env['PATH'] = "/home/ubuntu/.local/bin:" + env.get('PATH', '')
        env['DATABASE_URL'] = 'postgresql://littlefounders_user:password123@localhost:5432/littlefounders_db'
        
        # Ejecutar upgrade
        result = subprocess.run(['alembic', 'upgrade', 'head'], 
                              capture_output=True, text=True, env=env)
        
        if result.returncode == 0:
            print("✅ Migraciones ejecutadas exitosamente!")
            return True
        else:
            print(f"❌ Error en migraciones: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Error ejecutando migraciones: {e}")
        return False

def start_server():
    """Iniciar el servidor FastAPI"""
    print("🚀 Iniciando servidor FastAPI...")
    
    try:
        env = os.environ.copy()
        env['PATH'] = "/home/ubuntu/.local/bin:" + env.get('PATH', '')
        
        # Copiar configuración de desarrollo
        if not os.path.exists('.env'):
            subprocess.run(['cp', '.env.dev', '.env'])
            print("📝 Copiada configuración de desarrollo (.env.dev -> .env)")
        
        # Ejecutar servidor
        subprocess.run(['python', 'main_v2.py'], env=env)
        
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido por el usuario")
    except Exception as e:
        print(f"❌ Error ejecutando servidor: {e}")

def main():
    """Función principal"""
    print("🎯 LittleFounders - Setup de Desarrollo")
    print("=" * 40)
    
    # Verificar Docker
    if not check_docker():
        print("❌ Docker no está disponible")
        print("💡 Para desarrollo local, instala Docker o configura PostgreSQL manualmente")
        print("📖 Consulta setup_gcp_postgres.md para más opciones")
        return
    
    # Iniciar PostgreSQL
    if not start_postgres():
        print("❌ No se pudo iniciar PostgreSQL")
        return
    
    # Ejecutar migraciones
    if not run_migrations():
        print("❌ No se pudieron ejecutar las migraciones")
        return
    
    # Iniciar servidor
    start_server()

if __name__ == "__main__":
    main()
