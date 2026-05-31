# 🚀 Instrucciones para Iniciar el Proyecto Localmente (Full Stack)

> **Versión:** 2026-05-31
> **Python requerido:** 3.11+ (el proyecto usa PEP 604 union types)
> **Node requerido:** 20+ (CI usa Node 24)

---

## 1. Prerrequisitos

```bash
# Verificar versiones
python3 --version    # Debe ser 3.11+
node --version       # Debe ser 20+
npm --version

# Si tienes Python 3.9, instalar Python 3.11:
brew install python@3.11

# Verificar que exists pip para Python 3.11
python3.11 -m pip --version
```

---

## 2. Backend (Python/FastAPI) — Puerto 8000

### 2.1 Instalar dependencias

```bash
cd backend

# Con Python 3.11 (recomendado):
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# O con Python por defecto (si es 3.11+):
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2.2 Configurar variables de entorno

Copia el archivo de ejemplo y ajústalo:

```bash
cp .env.example .env
# Editar .env con tus credenciales de Supabase y SECRET_KEY
```

Para desarrollo local con Postgres local:

```bash
# Usar .env.test como referencia
# Los valores por defecto apuntan a localhost:5432
```

### 2.3 Iniciar servidor

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2.4 Verificar

```bash
curl http://localhost:8000/health
# {"status":"ok","database":"connected"} (o "error" si no hay DB local)
```

### 2.5 Linting y Tests

```bash
# Linting con ruff
python3 -m ruff check .
python3 -m ruff check --fix .  # Auto-fix

# Tests
pytest -v
pytest -x  # Parar al primer fallo
```

---

## 3. Frontend (React/Vite) — Puerto 8080

### 3.1 Instalar dependencias

```bash
cd frontend
npm install
```

### 3.2 Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
```

### 3.3 Iniciar servidor de desarrollo

```bash
npm run dev
# Abrir http://localhost:8080
```

### 3.4 TypeScript, Linting, Tests y Build

```bash
npm run type-check    # TypeScript strict mode
npm run lint          # ESLint (0 errores, 0 warnings requerido)
npm test              # Vitest (tests unitarios)
npm run build         # Build de producción
```

---

## 4. Full Stack (ambos servidores a la vez)

```bash
cd frontend
npm run start:all  # Lanza frontend (vite) + backend (uvicorn) simultáneamente
```

---

## 5. URLs Locales

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:8080 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Health Check | http://localhost:8000/health |

---

## 6. Pre-commit Checklist

Antes de hacer commit:

```bash
# Frontend
cd frontend && npm run type-check && npm run lint && npm test && npm run build

# Backend
cd backend && python3 -m ruff check . && pytest -v

# Verificar que no hay secrets en el diff
git diff --staged | grep -i "password\|secret\|key" | wc -l
```

---

## 7. CI/CD

El proyecto tiene pipelines de CI en GitHub Actions:

| Workflow | Evento | Acciones |
|----------|--------|---------|
| **Frontend CI** | Push/PR a `main` (paths: `frontend/**`) | type-check → lint → test → build |
| **Backend CI** | Push/PR a `main` (paths: `backend/**`) | ruff lint → pytest (con PostgreSQL) |

**Deployment** (manual vía Git):
- **Frontend → Vercel:** Integración Git automática en `main`
- **Backend → Render:** Integración Git automática en `main`

---

## 8. Supabase Local (opcional)

```bash
# Instalar Supabase CLI
brew install supabase/tap/supabase

# Iniciar servicios locales
supabase start

# Detener
supabase stop

# Reset DB + migraciones
supabase db reset

# Estado
supabase status
```

---

## 9. Troubleshooting

### Error: `TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'`
**Causa:** Python < 3.10 no soporta `str | None` syntax.
**Solución:** Usar Python 3.11+ o instalar `eval-type-backport`.

### Error: `ImportError: cannot import name 'UTC' from 'datetime'`
**Causa:** `datetime.UTC` requiere Python 3.11+.
**Solución:** Usar Python 3.11+.

### Error: `Module not found` al importar del backend
**Causa:** El PYTHONPATH no incluye `backend/`.
**Solución:** Ejecutar desde `backend/` o agregar `backend/` al path.

### Tests de backend fallan por DB
**Causa:** Los tests necesitan PostgreSQL local.
**Solución:** Instalar Postgres local o usar Supabase CLI (`supabase start`).
