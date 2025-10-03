#!/usr/bin/env python3
"""
Script para crear las tablas en la base de datos
Ejecutar: python create_tables.py
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base
from models import *  # Importar todos los modelos
import sys

def create_tables():
    """Crear todas las tablas definidas en los modelos"""
    try:
        print("Creando tablas en la base de datos...")
        Base.metadata.create_all(bind=engine)
        print("Tablas creadas exitosamente!")
        print("\nTablas creadas:")
        for table_name in Base.metadata.tables.keys():
            print(f"  - {table_name}")
    except Exception as e:
        print(f"Error al crear las tablas: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_tables()
