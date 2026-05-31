import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load Env
load_dotenv(Path(__file__).parent.parent / ".env")

DATABASE_URL = f"postgresql://{os.environ.get('DATABASE_USERNAME')}:{os.environ.get('DATABASE_PASSWORD')}@{os.environ.get('DATABASE_HOSTNAME')}:{os.environ.get('DATABASE_PORT')}/{os.environ.get('DATABASE_NAME')}"

def migrate():
    print("🔥 INICIANDO REESTRUCTURACIÓN DE LA BASE DE DATOS DE LECCIONES...")
    print("⚠️ ESTO BORRARÁ TODAS LAS LECCIONES Y EL PROGRESO.")

    engine = create_engine(DATABASE_URL)

    sql_commands = """
    -- 1. DROP OLD TABLES (Cascading deletion)
    DROP TABLE IF EXISTS user_exercise_progress CASCADE;
    DROP TABLE IF EXISTS exercise_translations CASCADE;
    DROP TABLE IF EXISTS exercises CASCADE;
    DROP TABLE IF EXISTS audio_segment_translations CASCADE;
    DROP TABLE IF EXISTS lesson_audio_segments CASCADE;
    DROP TABLE IF EXISTS lesson_translations CASCADE;
    DROP TABLE IF EXISTS user_lesson_progress CASCADE;
    DROP TABLE IF EXISTS lessons CASCADE;
    DROP TABLE IF EXISTS sagas CASCADE;
    DROP TABLE IF EXISTS adventures CASCADE;

    -- 2. CREATE NEW LESSONS TABLE
    CREATE TABLE lessons (
        id SERIAL PRIMARY KEY,
        lesson_code VARCHAR(50) UNIQUE NOT NULL, -- Identificador "1-1-1-1"

        -- Internationalized Metadata
        title_es VARCHAR(200) NOT NULL,
        title_en VARCHAR(200) NOT NULL,
        description_es TEXT,
        description_en TEXT,

        -- Metadata
        duration INTEGER, -- Minutos
        age_rate VARCHAR(20), -- Edad sugerida
        points_reward INTEGER DEFAULT 10,

        -- Hierarchy Levels (Integers)
        adventure_level INTEGER NOT NULL,
        saga_level INTEGER NOT NULL,
        topic_level INTEGER NOT NULL,
        lesson_number INTEGER NOT NULL,

        -- Content (Localized JSONs)
        content_es JSONB NOT NULL,
        content_en JSONB NOT NULL,

        -- Timestamps
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Indexes for hierarchy
    CREATE INDEX idx_lessons_adventure ON lessons(adventure_level);
    CREATE INDEX idx_lessons_hierarchy ON lessons(adventure_level, saga_level, topic_level);

    -- 3. CREATE NEW PROGRESS TABLE
    CREATE TABLE user_lesson_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,

        completed BOOLEAN DEFAULT FALSE,
        progress INTEGER DEFAULT 0, -- Porcentaje 0-100
        score INTEGER DEFAULT 0, -- Puntos obtenidos en esta sesión

        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE UNIQUE INDEX idx_user_lesson_progress_unique ON user_lesson_progress(user_id, lesson_id);

    """

    with engine.connect() as conn:
        conn.execute(text(sql_commands))
        conn.commit()

    print("✅ REESTRUCTURACION COMPLETADA EXITOSAMENTE.")

if __name__ == "__main__":
    confirm = input("¿Estás seguro de destruir y reconstruir la estructura de lecciones? (yes/no): ")
    if confirm.lower() == "yes":
        migrate()
    else:
        print("Cancelado.")
