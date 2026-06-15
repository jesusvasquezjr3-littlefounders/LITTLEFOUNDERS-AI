# AGENTS.md — LittleFounders AI

> **Última actualización:** 2026-05-31
> **Audiencia:** Agentes de coding AI que no conocen el proyecto.
> **Idioma principal del proyecto:** Español (documentación, comentarios, guías de desarrollo).

---

## 1. Resumen del Proyecto

LittleFounders AI es una **plataforma educativa de alfabetización financiera para niños y familias**. El stack es full-stack JavaScript/Python con despliegue dividido:

- **Frontend:** SPA React 18 + Vite + TypeScript + Tailwind CSS, desplegado en **Vercel**.
- **Backend:** API REST con **FastAPI** (Python 3.11+), desplegado en **Railway** (migrado desde Render en 2026-06).
- **Base de datos:** PostgreSQL gestionada por **Supabase** (pooler en puerto 6543).
- **Auth:** Sistema dual — FastAPI maneja JWT propios (email/password, Google OAuth, Discord OAuth) y también se integra con Supabase Auth.
- **Almacenamiento:** Supabase Storage para audio e imágenes.
- **i18n:** Bilingüe español/inglés.

---

## 2. Estructura del Repositorio

```
├── frontend/           # React SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── pages/           # Páginas de alto nivel (Login, Lessons, Admin, etc.)
│   │   ├── components/
│   │   │   ├── ui/          # shadcn/ui primitives (~50 componentes)
│   │   │   ├── auth/        # ProtectedRoute, AdminProtectedRoute, etc.
│   │   │   ├── dashboard/   # Layouts, KPIs, charts
│   │   │   ├── lessons/     # Lesson engine (AdventureCard, LessonPath, LessonRunner)
│   │   │   ├── landing/     # Secciones de marketing
│   │   │   └── characters/  # Personajes narrativos (Dina, Dino, DrRho, ZaraVex)
│   │   ├── games/           # 6 juegos standalone, cada uno con reducer propio
│   │   ├── features/placement/  # Examen de ubicación
│   │   ├── hooks/           # useAuth, useAdmin*, useLanguage, use-toast
│   │   ├── lib/             # cn(), Supabase client, analytics, streak utils
│   │   ├── contexts/        # SoundContext
│   │   ├── i18n/            # Setup i18next + namespaces
│   │   └── utils/           # accountSync, errorUtils, gestureMapper
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.app.json
│
├── backend/            # FastAPI REST API
│   ├── main.py              # App factory: routers, middleware, CORS
│   ├── config.py            # Pydantic Settings (lee .env)
│   ├── database.py          # SQLAlchemy engine, SessionLocal, get_db
│   ├── models.py            # Todos los modelos ORM en un solo archivo
│   ├── schemas.py           # Schemas Pydantic compartidos
│   ├── requirements.txt
│   ├── railway.json         # Railway: builder Nixpacks, healthcheck /health, startCommand
│   ├── nixpacks.toml        # Railway: pin Python 3.11 + uvicorn main:app --port $PORT
│   ├── .railwayignore       # Excluye *.md, tests/, caches del contexto de build
│   ├── auth/                # JWT, OAuth, guest merge, permisos familiares
│   ├── dashboard/           # Estadísticas de usuario
│   ├── lesson_engine/       # Motor de lecciones: endpoints API + 2,461 lecciones JSON
│   ├── lesson_factory/      # Generador IA de lecciones (DeepSeek + curriculum)
│   ├── admin/               # CRUD de lecciones, ejercicios, usuarios, reportes
│   ├── reports/             # Feedback/bugs con rate limiting
│   ├── social/              # Sistema de follows y perfiles públicos
│   ├── notifications/       # Notificaciones broadcast y dirigidas
│   ├── assets/              # Proxy de signed URLs para Supabase Storage
│   ├── utils/               # limiter (slowapi), gesture_mapper
│   └── scripts/             # Utilidades de importación, audio, verificación
│
├── api/                # Wrapper serverless para Vercel (legacy, actualmente ignorado por .vercelignore)
│   └── index.py
│
├── supabase/
│   └── functions/
│       └── verify-password/index.ts   # Edge Function Deno para verificar passwords
│
├── dist/               # Build estático pre-generado (desactualizado)
├── vercel.json         # Config de deploy en Vercel
├── package.json        # Root: solo orquesta build del frontend para Vercel
└── .vercelignore       # Ignora /backend/, /api/, *.md, *.sql
```

**Nota:** No es un monorepo real (no hay pnpm workspaces, Turborepo ni Nx). El `package.json` raíz solo existe para que Vercel sepa cómo construir el frontend.

---

## 3. Stack Tecnológico

### Frontend
- **Framework:** React 18.3 + TypeScript 5.5 (strict: true)
- **Build tool:** Vite 5.4 con `@vitejs/plugin-react-swc`
- **Routing:** React Router v6
- **Estilos:** Tailwind CSS 3.4 + PostCSS + Autoprefixer
- **UI components:** shadcn/ui (50+ primitives basados en Radix UI)
- **State server:** TanStack Query (React Query) v5
- **Auth:** `@supabase/supabase-js` + JWT propio
- **i18n:** i18next + react-i18next + browser-language-detector
- **3D / Media:** Three.js, `@react-three/fiber`, `@react-three/drei`, Remotion
- **Gráficos:** Recharts
- **Sonido:** Howler
- **Animaciones:** Canvas Confetti, Tailwind Animate, keyframes CSS custom
- **Temas:** next-themes (dark/light/system)
- **Analytics & SEO:** Vercel Analytics, Google Analytics (G-0XH7S80Q2), Microsoft Clarity, JSON-LD Schema (WebSite/EducationalOrganization)

### Backend
- **Framework:** FastAPI 0.110+ (async)
- **Servidor:** Uvicorn 0.27+
- **ORM:** SQLAlchemy 2.0+ (declarative base)
- **Driver DB:** psycopg2-binary
- **Validación:** Pydantic v2 + pydantic-settings
- **Auth:** python-jose (JWT HS256, 30 min expiración)
- **Rate limiting:** slowapi
- **Storage/Auth externo:** Supabase Python client
- **HTTP:** requests

### Base de datos
- **Motor:** PostgreSQL (Supabase)
- **Conexión:** Pooler Supabase (puerto 6543)
- **Config de pool:** `pool_pre_ping=True`, `pool_recycle=300`, `connect_timeout=10`, timezone UTC

---

## 4. Comandos de Build y Desarrollo

### Desarrollo local (full stack)

**Terminal 1 — Backend:**
```bash
cd backend
pip install -r requirements.txt
pip install -r requirements-dev.txt   # solo local/CI
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev          # Puerto 8080 (configurado en vite.config.ts)
```

**Alternativa — Ambos con un solo comando (desde frontend):**
```bash
cd frontend
npm run start:all    # concurrently "npm run dev" "npm run backend"
```

### URLs locales
- Frontend: http://localhost:8080
- API docs (Swagger): http://localhost:8000/docs
- Health check: http://localhost:8000/health

### Build de producción (frontend)
```bash
cd frontend
npm run build        # tsc -b && vite build
```

Desde la raíz (como lo hace Vercel):
```bash
npm run build        # cd frontend && npm install && npm run build && cp -r dist/* ../dist
```

### Preview del build
```bash
cd frontend
npm run preview      # vite preview
```

---

## 5. Convenciones de Código

### Frontend

1. **Mobile-first:** Las clases base deben ser para móvil; usar `sm:`, `lg:` para desktop.
2. **i18n obligatorio:** NUNCA dejar texto hardcodeado en español o inglés. Todo debe pasar por `t()`.
   ```tsx
   const { t } = useTranslation(["common", "lessons", "admin"]);
   t("common:app_name")
   t("lessons:learn.page_title")
   ```
3. **Namespaces disponibles:** `common`, `auth`, `landing`, `lessons`, `games`, `admin`, `dashboard`, `avatar`, `settings`, `profile`, `placement`, `reports`, `errors`, `onboarding`.
4. **Path alias:** `@/` apunta a `src/`. Usar siempre para imports internos.
5. **Estilos:** Tailwind utility classes. Para variantes de componentes usar `class-variance-authority` (CVA). `cn()` (clsx + tailwind-merge) está disponible en `src/lib/utils.ts`.
6. **Tipos:** TypeScript con `strict: true` (configurado en `tsconfig.app.json` y `tsconfig.node.json`). No hay tests.

### Backend

1. **Estructura modular:** Cada feature es un paquete Python con su `endpoints.py`, `schemas.py`, y helpers propios.
2. **Routers:** Se registran en `main.py` con su prefijo correspondiente.
3. **Dependencias de DB:** Usar `get_db()` como dependencia de FastAPI; nunca instanciar `SessionLocal` manualmente en endpoints.
4. **Modelos ORM:** Todos viven en `backend/models.py` (monolito intencional).
5. **Schemas Pydantic:** `backend/schemas.py` para schemas compartidos; cada módulo puede tener su propio `schemas.py`.
6. **Auth:** Endpoints públicos no requieren token; endpoints protegidos usan `get_current_user` o `get_current_user_optional`.
7. **Rate limiting:** `slowapi` global (60/min). Algunos endpoints (`/reports`, `/assets`) tienen limiters adicionales en memoria.
8. **Headers de seguridad:** El middleware en `main.py` agrega COOP, X-Content-Type-Options, X-Frame-Options, HSTS, Permissions-Policy.
9. **No crear tablas en startup:** `models.Base.metadata.create_all(bind=engine)` está comentado en `main.py` porque corre en serverless; las tablas deben existir previamente en Supabase.

---

## 6. Testing

### Frontend (`vitest` + `@testing-library/react`)
```bash
cd frontend
npm test             # vitest run (una vez)
npm run test:watch   # vitest (modo watch)
```
- Framework: **Vitest** con `jsdom`
- Component tests: `@testing-library/react` + `@testing-library/jest-dom`
- Config: `vitest.config.ts` con alias `@/` resuelto

### Backend (`pytest` + `httpx`)
```bash
cd backend
pytest -v            # tests con output verbose
pytest -x            # parar al primer fallo
```
- Framework: **pytest** con `pytest-asyncio` (modo `asyncio_mode = auto`)
- HTTP testing: `httpx` con ASGI transport (sin servidor real)
- DB: usa base de datos local (no Cloud Supabase)
- Config: `pyproject.toml` → `[tool.pytest.ini_options]`
- Setup: `conftest.py` con fixtures `client` y `test_db_url`

### Linting
```bash
# Frontend (ESLint)
cd frontend && npm run lint

# Backend (ruff)
cd backend && python3 -m ruff check .
```

---

## 7. Seguridad

### Variables de entorno críticas (backend `.env`)
- `DATABASE_HOSTNAME`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- `SECRET_KEY` (para JWT HS256)
- `SUPABASE_URL`, `SUPABASE_KEY`
- `CORS_ORIGINS` (opcional, override comma-separated para el dashboard de Railway)

### Consideraciones de seguridad
1. **Nunca commitear `.env`:** Está en `.gitignore`. El backend tiene `.env` con secrets.
2. **JWT:** Tokens con expiración de 30 minutos, firmados con HS256. El claim `sub` es el email del usuario.
3. **CORS:** Whitelist explícita en `config.py`. Puede sobreescribirse con la variable de entorno `CORS_ORIGINS`.
4. **Rate limiting:** slowapi global + limiters custom en `/reports` y `/assets`.
5. **Headers:** COOP varía según la ruta (`same-origin-allow-popups` para OAuth, `same-origin` para el resto).
6. **IDs públicos:** Todas las entidades principales usan `public_id` (UUID generado por PostgreSQL) expuesto al frontend, mientras que los `id` internos (enteros) se usan solo para joins.
7. **Supabase Service Role Key:** Se usa solo en el Edge Function `verify-password` (nunca en el frontend).
8. **Vercel ignore:** `.vercelignore` ignora explícitamente `/backend/` y `/api/` para que el código del backend no se exponga en el build estático.

---

## 8. Despliegue

### Frontend → Vercel
- Configurado por `vercel.json`.
- `buildCommand`: `cd frontend && npm install && npm run build`
- `outputDirectory`: `frontend/dist`
- **Routing y SEO:** `vercel.json` tiene una regla de `rewrites` que rutea todo el tráfico de `en.littlefounders.ai` hacia `/index-en.html`.
- SPA rewrite: todo a `index.html` (o `index-en.html` si aplica) excepto rutas que empiecen con `/api/`.
- **Build (Vite):** `vite.config.ts` tiene configurado `rollupOptions.input` para construir tanto `index.html` como `index-en.html`, asegurando metadatos (Open Graph) correctos por idioma.
- Node engine: `24.x`.

### Backend → Railway
- **Plataforma:** Railway (proyecto `littlefounders-backend`, workspace `littlefounders.ai`). URL: `https://littlefounders-backend-production.up.railway.app`.
- **Config-as-code:** `backend/railway.json` (builder Nixpacks, `healthcheckPath: /health`, restart on-failure) + `backend/nixpacks.toml` (pin Python 3.11, `startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT`).
- **Root Directory = `backend`** en el servicio: el contexto de build es solo `backend/`.
- Se conecta a Supabase PostgreSQL via pooler (puerto 6543).
- `CORS_ORIGINS` debe configurarse en las Variables de Railway si el dominio de Vercel cambia.
- **App Sleeping (serverless) activado:** el servicio escala a cero en ocioso (~$0 idle) y despierta con el primer request (~1s de wake; el startup es no-bloqueante, ver §9 Backend).
- ⚠️ **No configurar Watch Paths en Railway.** Como el deploy sube el snapshot con raíz = `backend/`, un patrón `backend/**` nunca coincide y Railway hace skip ("no changes detected"). El gating solo-backend lo hace el `if` del workflow de CD.

### Vercel Serverless Wrapper (legacy)
- `api/index.py` existe como fallback pero `.vercelignore` lo ignora actualmente. El backend real corre en Railway.

### Docker (frontend)
- `frontend/Dockerfile.frontend` existe pero referencia `docker/nginx-frontend.conf` que **no existe** en el repo. No usar sin crear primero ese archivo.

### CI/CD — GitHub Actions
Hay 3 workflows en `.github/workflows/`:
- **`backend-ci.yml`** (Backend CI): en push/PR que toque `backend/**` → ruff + pytest contra Postgres de servicio.
- **`frontend-ci.yml`** (Frontend CI): en push/PR que toque `frontend/**` → type-check + lint + test + build.
- **`cd.yml`** (CD — Deploy): se dispara vía `workflow_run` al completar un CI en `main`:
  - `deploy-vercel` → POST a `secrets.VERCEL_DEPLOY_HOOK_URL`.
  - `deploy-railway` → instala la Railway CLI y corre `railway up --service littlefounders-backend --ci` (auth con `secrets.RAILWAY_TOKEN`). Gated a `workflow_run.name == 'Backend CI'` para no rebuildear el backend en cambios solo de frontend.

**Secrets de repositorio requeridos:** `RAILWAY_TOKEN` (project token de Railway, environment production), `VERCEL_DEPLOY_HOOK_URL`.

---

## 9. Patrones Arquitectónicos Clave

### Frontend
- **Game reducer pattern:** Cada juego en `src/games/` tiene su propio `gameReducer.ts` con acciones tipadas y fases de juego.
- **Lesson engine:** Contenido jerárquico: Adventure → Saga → Topic → Lesson. Las lecciones se cargan desde el backend y se renderizan con componentes dinámicos según el tipo de ejercicio (~50+ tipos, con validación centralizada en `useLessonState.ts`). LessonRunner usa una máquina de estados (`IDLE → PLAYING → WAITING_INPUT → CHECKING → FEEDBACK_SUCCESS/ERROR → COMPLETED`) con sistema de vidas (5 por lección).
- **Auth wrappers:** `ProtectedRoute`, `ParentProtectedRoute`, `ChildProtectedRoute`, `AdminProtectedRoute` manejan redirecciones según el tipo de usuario.
- **Guest merge:** El frontend soporta usuarios anónimos; al autenticarse, `/auth/merge-guest` transfiere el progreso.

### Backend
- **Optional auth:** Muchos endpoints del lesson engine son públicos (jugables sin login), usando `get_current_user_optional`.
- **Streaks:** Lógica de rachas diarias usa la fecha local (`YYYY-MM-DD`) enviada por el frontend para evitar problemas de timezone.
- **Audio pipeline:** Admin genera TTS via "LF Audio Engine" (`scripts/lf_audio_client.py`) y sube a Supabase Storage. Las lecciones inyectan un mapa de audio en la timeline con granularidad por sub-elemento (`target_field`: `main`, `statement`, `question`, `instruction`, `feedback_success`, `feedback_error`).
- **Lesson Factory:** `lesson_factory/generate.py` usa DeepSeek API con currículum estructurado y reglas pedagógicas para generar las 2,461 lecciones bilingües. El validador en `validate.py` verifica esquema, tipos de ejercicio y diversidad de objetivos.
- **Audit trail:** El admin registra todo cambio en `ContentEditHistory` con soporte para rollback.
- **Startup no-bloqueante:** El diagnóstico de `@app.on_event("startup")` (chequeo de DB + Supabase) corre en un thread fire-and-forget (`asyncio.to_thread`), así uvicorn queda disponible de inmediato. Clave para minimizar el cold start con App Sleeping en Railway. No metas IO de red bloqueante en el path de arranque.

---

## 10. Mapa de Documentación

> **Propósito:** Navegación eficiente entre todos los archivos `*.md` del proyecto.
> Cada documento enumera sus dependencias y documentos relacionados para que un agente AI
> pueda localizar contexto relevante sin leer archivos innecesarios.

### 10.1 Documentos Raíz (en `/`)

| Documento | Contenido | Relaciones |
|---|---|---|
| **`AGENTS.md`** (este) | Fuente de verdad para agentes AI. Resumen del proyecto, stack, comandos, convenciones, despliegue. | → `CLAUDE.md` (§1 autoridad), → `repo_map.md` (navegación de código), → cada doc abajo |
| **`CLAUDE.md`** | Reglas operativas no negociables. Jerarquía de autoridad de documentación. Pre-commit checklist técnico. | Padre de todos los docs (§1). Referencia: `AGENTS.md`, `ROADMAP.md`, `GLOSSARY.md`, `WALKTHROUGH.md`, `RUNBOOK.md` |
| **`GLOSSARY.md`** | Términos canónicos del proyecto (Adventure, Saga, Topic, Lesson, Exercise, etc.). | Usado por: `AGENTS.md`, `BACKEND_GUIDE.md`, `RULES.md`, `repo_map.md` |
| **`ROADMAP.md`** | Plan de arquitectura, sprints completados/pendientes, API contract resumido. | → `WALKTHROUGH.md` (deuda técnica), → `CLAUDE.md` (§6 testing), → `AGENTS.md` (§8 despliegue) |
| **`WALKTHROUGH.md`** | Snapshot del estado actual, progreso, decisiones recientes, deuda técnica conocida. | → `ROADMAP.md` (sprints), → `AGENTS.md` (stack), → `RUNBOOK.md` (incidentes) |
| **`RUNBOOK.md`** | Procedimientos de respuesta a incidentes (backend caído, frontend caído, DB lenta, rate limiting, rollback). | → `AGENTS.md` (§8 Railway, §7 seguridad), → `BACKEND_GUIDE.md` (§14 middleware) |
| **`ANALYTICS_ONBOARDING_EVENTS.md`** | Referencia de eventos GA4 para el funnel de onboarding + placement. Códigos de evento, parámetros, triggers. | → `frontend/src/lib/analytics.ts`, → `frontend/src/components/analytics/GoogleAnalytics.tsx`, → `frontend/index.html` (gtag) |
| **`INSTRUCCIONES_LOCAL.md`** | Guía rápida en español para levantar backend y frontend localmente. Prerrequisitos, troubleshooting. | → `AGENTS.md` (§4 comandos), → `BACKEND_GUIDE.md` (§3 getting started) |
| **`repo_map.md`** | **Auto-generado.** Índice completo del repositorio: árbol de directorios + primeras 15 líneas de cada archivo de código. | → `scripts/generate_repo_map.py` (generador), → todos los archivos del proyecto |

### 10.2 Documentos del Backend (en `backend/`)

| Documento | Contenido | Relaciones |
|---|---|---|
| **`BACKEND_GUIDE.md`** | 1,700+ líneas. Guía técnica completa del backend: arquitectura, estructura, config, DB, modelos ORM, auth, API endpoints, lesson engine, admin, social, reports, dashboard, middleware, deployment. | → `AGENTS.md` (§3 stack, §5 backend conventions), → `models.py` (ORM), → `main.py` (routers), → `config.py` (settings), → `database.py` (engine) |
| **`audio_factory/AUDIO_ENGINE.md`** | Documentación maestra del pipeline TTS. Estado: ✅ completo, ⏸️ pendiente análisis de costes. 40+ tipos de ejercicio, 4 personajes, ES/EN. | → `audio_factory/*.py` (código), → `scripts/lf_audio_client.py` (cliente), → `AGENTS.md` (§9 audio pipeline backend), → `GLOSSARY.md` (Audio Factory) |
| **`lesson_factory/RULES.md`** | Estándares de calidad pedagógica para creación de lecciones. Principios, adaptación por edad, estructura cognitiva, criterios de precisión, métricas. | → `lesson_factory/generate.py`, → `lesson_factory/validate.py`, → `AGENTS.md` (§9 Lesson Factory), → `GLOSSARY.md` (Lesson, Exercise) |
| **`lesson_factory/GENERATION_LOG.md`** | Log técnico de la generación masiva de 2,461 lecciones vía DeepSeek. Arquitectura del pipeline, resultados, calidad y lecciones aprendidas. | → `lesson_factory/RULES.md`, → `lesson_factory/generate.py`, → `lesson_engine/littlefounders_lessons/` (datos generados), → `lesson_factory/curriculum/*.json` (currículos) |

### 10.3 Documentos del Frontend (en `frontend/`)

| Documento | Contenido | Relaciones |
|---|---|---|
| **`FRONTEND_GUIDE.md`** | Guía técnica completa del frontend (~600 líneas). Arquitectura, routing completo, páginas, componentes, hooks, juegos, lesson engine, auth, contextos, build, testing. | → `AGENTS.md` (§3 stack, §5 frontend conventions), → `src/` (código fuente), → `src/i18n/README.md`, → `DESIGN_SYSTEM.md` |
| **`DESIGN_SYSTEM.md`** | **Estándar visual "corp"** (autoritativo sobre estilos de Frontend). Catálogo de clases `corp-*`, tokens, roots canónicos, patrones, checklist de migración, y el sub-estándar "Playful" para vistas de niños. Reemplaza el legacy `liquid-glass`/`GlassPanel`. | → `src/index.css` (definiciones CSS), → `CLAUDE.md` (§1 autoridad, §3 convenciones), → `FRONTEND_GUIDE.md` |
| **`src/i18n/README.md`** | Guía de internacionalización. Idiomas soportados, estructura de archivos, uso en componentes, convenciones, troubleshooting. | → `src/i18n/index.ts`, → `src/i18n/locales/{es,en}/*.json`, → `AGENTS.md` (§5 frontend i18n obligatorio) |

### 10.4 Mapa de Navegación Rápida para Agentes AI

```
Problema/Situación                                          → Documento a leer primero
──────────────────────────────────────────────────────────────────────────────
"No sé por dónde empezar"                                   → repo_map.md + AGENTS.md (§1-3)
"Necesito entender la arquitectura del backend"             → BACKEND_GUIDE.md (§1-2, §8)
"Error en producción / incidente"                           → RUNBOOK.md
"Qué reglas debo seguir como AI agent"                      → CLAUDE.md + AGENTS.md
"Qué terminología usar"                                     → GLOSSARY.md
"Qué sigue en el roadmap"                                   → ROADMAP.md + WALKTHROUGH.md
"Estado actual y deuda técnica"                             → WALKTHROUGH.md
"Cómo generar/validar lecciones"                            → lesson_factory/RULES.md + GENERATION_LOG.md
"Cómo funciona el audio TTS"                                → audio_factory/AUDIO_ENGINE.md
"Cómo usar i18n en frontend"                                → src/i18n/README.md
"Eventos de analytics / onboarding"                         → ANALYTICS_ONBOARDING_EVENTS.md
"Cómo levantar localmente"                                  → INSTRUCCIONES_LOCAL.md + AGENTS.md (§4)
"Qué archivos de código existen y dónde están"              → repo_map.md (árbol + previews)
```

---

## 11. repo_map.md — Sistema de Navegación de Código

**Archivo:** `repo_map.md` (raíz del proyecto)
**Generador:** `scripts/generate_repo_map.py`

### 11.1 ¿Qué contiene?

- **Árbol de directorios** completo (excluye `node_modules/`, `.git/`, `dist/`, `__pycache__/`, `.vercel/`, lecciones JSON de datos).
- **Primeras 15 líneas de cada archivo de código** y configuración (461 archivos total):
  - `Code` (438): `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.css`, `.html`
  - `Config` (23): `.toml`, `.yaml`, `.yml`, `.json` (package.json, tsconfig, railway, etc.)

### 11.2 Cómo usar `repo_map.md`

1. **Encuentra la ruta** del archivo que buscas usando el árbol de directorios o el índice de archivos.
2. **Lee el preview** de las primeras 15 líneas (imports, interfaces, clases, funciones principales).
3. **Decide si necesitas el archivo completo** — si sí, usa `Read` sobre la ruta exacta.
4. **Nunca** incluyas `repo_map.md` en su totalidad en el contexto — solo la sección relevante.

### 11.3 Regeneración

Si agregas, eliminas o renombras archivos de código, regenera el mapa:

```bash
python3 scripts/generate_repo_map.py
```

Esto actualiza automáticamente el árbol y todos los previews.

---

## 12. Instrucciones para Agentes AI — Mantenimiento de Documentación

### 12.1 Principio Fundamental

> **Todo cambio sustancial en el proyecto debe reflejarse en al menos un archivo de documentación.**

Un cambio es "sustancial" si:
- Modifica la arquitectura (nuevo módulo, cambio de framework, nuevo servicio externo)
- Agrega o elimina endpoints API
- Cambia variables de entorno requeridas
- Modifica comandos de build, test o deploy
- Agrega o elimina dependencias principales
- Cambia la estructura de directorios
- Modifica el flujo de onboarding, auth o datos críticos
- Introduce nuevas convenciones de código

### 12.2 Documentos a Actualizar según el Cambio

| Tipo de Cambio | Documentos a Actualizar |
|---|---|
| **Arquitectura / Stack** | `AGENTS.md` (§1-3), `CLAUDE.md` (§4), `WALKTHROUGH.md`, `ROADMAP.md` |
| **Comandos / Build** | `AGENTS.md` (§4), `INSTRUCCIONES_LOCAL.md` |
| **Convenciones de código** | `AGENTS.md` (§5), `CLAUDE.md` (§3) |
| **Testing / CI** | `AGENTS.md` (§6), `ROADMAP.md`, `CLAUDE.md` (§6) |
| **Seguridad / Auth** | `AGENTS.md` (§7), `CLAUDE.md` (§5) |
| **Despliegue** | `AGENTS.md` (§8), `RUNBOOK.md`, `CLAUDE.md` (§4) |
| **Endpoints API** | `BACKEND_GUIDE.md` (§8), `ROADMAP.md` (API contract) |
| **Modelos ORM / DB** | `BACKEND_GUIDE.md` (§5-6), `models.py` (código) |
| **Lesson Engine / Lecciones** | `BACKEND_GUIDE.md` (§9), `lesson_factory/RULES.md`, `GENERATION_LOG.md` |
| **Audio Factory** | `audio_factory/AUDIO_ENGINE.md` |
| **i18n / Traducciones** | `src/i18n/README.md` |
| **Analytics / Eventos** | `ANALYTICS_ONBOARDING_EVENTS.md` |
| **Términos / Conceptos** | `GLOSSARY.md` |
| **Estructura de archivos** | `repo_map.md` (ejecutar `scripts/generate_repo_map.py`) |

### 12.3 Checklist Post-Cambio

Después de implementar un cambio sustancial, verifica:

- [ ] ¿El cambio afecta la arquitectura descrita en `AGENTS.md` (§1-3)? → Actualizar.
- [ ] ¿Cambian los comandos de build/test/deploy? → Actualizar `AGENTS.md` (§4) y/o `INSTRUCCIONES_LOCAL.md`.
- [ ] ¿Se modificaron convenciones de código? → Actualizar `AGENTS.md` (§5) y `CLAUDE.md` (§3).
- [ ] ¿Hay nuevos endpoints o cambios en los existentes? → Actualizar `BACKEND_GUIDE.md` (§8) y `ROADMAP.md` (API contract).
- [ ] ¿Se agregaron/eliminaron variables de entorno? → Actualizar `AGENTS.md` (§7) y `.env.example`.
- [ ] ¿Cambió la estructura de directorios? → Regenerar `repo_map.md` (`python3 scripts/generate_repo_map.py`).
- [ ] ¿Se introdujeron nuevos términos? → Actualizar `GLOSSARY.md`.
- [ ] ¿Cambió el despliegue o la infraestructura? → Actualizar `AGENTS.md` (§8), `RUNBOOK.md`, y `CLAUDE.md` (§4).
- [ ] ¿El cambio genera nueva deuda técnica? → Actualizar `WALKTHROUGH.md` (sección de deuda técnica).
- [ ] ¿Cambia el roadmap o sprints? → Actualizar `ROADMAP.md`.

### 12.4 Orden de Lectura Recomendado para Agentes Nuevos

1. `AGENTS.md` — panorama completo del proyecto (este archivo)
2. `repo_map.md` — árbol de directorios + preview de archivos
3. `CLAUDE.md` — reglas operativas no negociables
4. `WALKTHROUGH.md` — estado actual y deuda técnica
5. `BACKEND_GUIDE.md` (si trabajas en backend) o documentación específica del módulo

---

## 13. Checklist Pre-Commit (Frontend)

Antes de hacer `git commit`, revisa:

- [ ] **Mobile-first:** ¿Las clases base son para móvil y usas breakpoints para desktop?
- [ ] **i18n:** ¿Todo texto visible pasa por `t()`? ¿No hay strings hardcodeados?
- [ ] **TypeScript:** ¿`tsc -b` pasa sin errores?
- [ ] **Test:** ¿`npm test` pasa?
- [ ] **ruff:** ¿`python3 -m ruff check .` está limpio?
- [ ] **CI:** ¿Los workflows de GitHub Actions están actualizados?
- [ ] **Build:** ¿`vite build` genera el bundle sin errores?
- [ ] **Documentación:** ¿Los cambios sustanciales están reflejados en los documentos `*.md`? (ver §12.3)
- [ ] **repo_map.md:** ¿Se regeneró si cambió la estructura de directorios? (`python3 scripts/generate_repo_map.py`)

---

*Este documento es la fuente de verdad para agentes AI. Si cambias la arquitectura, el stack, los comandos de build, o la documentación del proyecto, actualiza este archivo y regenera `repo_map.md`.*
