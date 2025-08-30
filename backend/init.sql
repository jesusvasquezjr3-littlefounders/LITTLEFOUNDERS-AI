-- Script de inicialización para PostgreSQL local
-- Se ejecuta automáticamente cuando se crea el contenedor

-- Crear usuario si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'littlefounders_user') THEN
        CREATE USER littlefounders_user WITH PASSWORD 'password123';
    END IF;
END
$$;

-- Otorgar permisos
GRANT ALL PRIVILEGES ON DATABASE littlefounders_db TO littlefounders_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO littlefounders_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO littlefounders_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO littlefounders_user;

-- Configurar permisos por defecto para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO littlefounders_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO littlefounders_user;