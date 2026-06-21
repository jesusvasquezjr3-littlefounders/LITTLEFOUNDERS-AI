# CLAUDE.md — LittleFounders AI Operating Rules

> **Última actualización:** 2026-06-21
> **Propósito:** Reglas operativas no negociables para agentes AI.

---

## 1. Autoridad de Documentación

1. `CLAUDE.md` — este archivo (máxima autoridad). **Nota importante:** `AGENTS.md` debe mantener siempre exactamente las mismas indicaciones y contenido que este archivo, dado que ambos sirven como contexto base para los agentes de IA.
2. `AGENTS.md` — espejo exacto de `CLAUDE.md` (reglas del proyecto, doc map, instrucciones).
3. `ROADMAP.md` — plan de arquitectura y sprints
4. `GLOSSARY.md` — terminología canónica
5. `repo_map.md` — mapa de código (auto-generado)
6. `frontend/DESIGN_SYSTEM.md` — estándar visual "corp" (autoritativo sobre estilos de Frontend)
7. `WALKTHROUGH.md` — snapshot informativo
8. `RUNBOOK.md` — respuesta a incidentes
9. Código fuente — descriptivo, no autoritativo

---

## 2. Requisitos Pre-Commit

Antes de hacer commit, verificar (checklist unificado):

**Calidad de código:**
- [ ] `npm run type-check` (o `tsc -b`) pasa en `frontend/`
- [ ] `npm run lint` pasa en `frontend/` (sin errores)
- [ ] `ruff check .` pasa en `backend/` (o `python3 -m ruff check .`)
- [ ] `npm test` pasa en `frontend/`
- [ ] Tests agregados para lógica nueva
- [ ] Sin `any` en TypeScript sin justificación en PR
- [ ] Mobile-first: clases base para móvil, breakpoints para desktop
- [ ] i18n: todo texto visible pasa por `t()`

**Seguridad:**
- [ ] Sin PII en logs o payloads externos
- [ ] Migraciones SQL pasan `supabase db reset` dos veces seguidas
- [ ] Sin secrets commiteados (`.env` en `.gitignore`)

**Documentación (ver AGENTS.md §12):**
- [ ] Cambios sustanciales reflejados en `*.md` (arquitectura, API, deploy, etc.)
- [ ] `repo_map.md` regenerado si cambió estructura de directorios
- [ ] Workflows CI/CD actualizados si aplica

---

## 3. Convenciones de Código

### Frontend (TypeScript/React)
- **Mobile-first:** clases base para móvil, `sm:`, `lg:` para desktop
- **i18n obligatorio:** todo texto visible por `t()`
- **Sin `any`:** usar tipos concretos; justificar excepciones en PR
- **`strict: true`** en tsconfig — no relajar sin aprobación
- **Tailwind utility classes:** sin valores raw hex/pixel
- **Estándar visual "corp":** toda vista de "chrome serio" (marketing, auth, cuenta, admin, utilitarias) usa las clases `corp-*` y sigue `frontend/DESIGN_SYSTEM.md`. Prohibido `liquid-glass`/`GlassPanel` y estilos ad-hoc por página. Las vistas de niños (juegos/lecciones) siguen el sub-estándar "Playful" (§9 de ese doc).
- **Sin Prettier:** formateo vía ESLint + convenciones

### Backend (Python/FastAPI)
- **Async/await:** sin mezclar con `.then()` o callbacks
- **IO externo con timeout:** 30s AI, 10s DB, 60s uploads
- **Routes thin:** parse request → call ONE service → format response
- **Services:** toda la lógica de negocio (sin HTTP concerns)
- **Migraciones idempotentes:** `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
- **Nunca editar migración commiteada** — escribir delta migration

---

## 4. Skills de Diseño para Agentes AI

El proyecto incluye **skills** especializadas en `.claude/skills/` que los agentes AI DEBEN invocar al trabajar en tareas Frontend/UI. Estas skills elevan la calidad visual y de interacción del producto.

### 4.1 Catálogo de Skills

| Skill | Cuándo invocarla | Ubicación |
|-------|-----------------|-----------|
| **agave** | Al crear, revisar o modificar UI. Da instintos de senior product designer: jerarquía visual, color con intención, tipografía estructural, ritmo de espaciado, restricción, consistencia y personalidad. | `.claude/skills/agave/` |
| **emil-design-eng** | Al construir interfaces, escribir animaciones, revisar código de motion o tomar decisiones de design engineering. Basada en la filosofía de Emil Kowalski (Vercel/Linear). | `.claude/skills/emil-design-eng/` |
| **impeccable** | Al diseñar, rediseñar, auditar, pulir, animar o mejorar cualquier interfaz frontend. Cubre landing pages, dashboards, formularios, onboarding, empty states, etc. Tiene subcomandos: `craft`, `shape`, `audit`, `polish`, `animate`, `bolder`, `quieter`, `harden`, `delight`, `live`, etc. | `.claude/skills/impeccable/` |
| **review-animations** | **Solo** al revisar código de animación/motion (CSS o JS). Revisa contra un estándar alto de craft. Por defecto marca problemas; la aprobación se gana. No para review general. | `.claude/skills/review-animations/` |
| **customize-opencode** | **Solo** para configuración de opencode (opencode.json, plugins, MCP servers, permisos). No para código de la aplicación. | Built-in (no en `.claude/skills/`) |

### 4.2 Reglas de Uso

1. **Toda tarea Frontend/UI DEBE considerar las skills** `agave`, `emil-design-eng` o `impeccable` según el caso antes de generar código.
2. **Animaciones/motion:** usar `emil-design-eng` para escribir y `review-animations` para revisar.
3. **Diseño nuevo o rediseños:** usar `impeccable craft` o `impeccable shape` para planear antes de codificar.
4. **Las skills NO aplican** a tareas de Backend o lógica no-UI.
5. **Las skills complementan, NO reemplazan** el estándar visual `corp-*` de `DESIGN_SYSTEM.md`. Las skills refinan la ejecución; el design system define los tokens y clases.

---

## 5. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | FastAPI + Python 3.11+ |
| DB | PostgreSQL (Supabase) |
| Auth | JWT propio + Supabase Auth |
| Testing (FE) | Vitest + Testing Library + jsdom |
| Testing (BE) | pytest + httpx + pytest-asyncio |
| Linting (FE) | ESLint flat config + typescript-eslint |
| Linting (BE) | ruff |
| CI | GitHub Actions (2 workflows) |
| Deploy FE | Vercel |
| Deploy BE | Railway |

---

## 6. Seguridad

- `.env` en `.gitignore` — nunca comitear secrets
- JWT expira en 30 min, firmado HS256, `sub` = email
- CORS whitelist explícita en `config.py`
- Rate limiting: slowapi global (60 req/min)
- Supabase Service Role Key solo en Edge Functions

---

## 7. Testing

- **Frontend:** `npm test` (Vitest) en `frontend/`
- **Backend:** `pytest -v` en `backend/`
- Tests contra DB local (no Cloud Supabase)
- Cubrir al menos: middleware, validación Zod, casos happy + sad path

---

## 8. Documentación

### 8.1 Cómo navegar la documentación

Ver `AGENTS.md §10` (Mapa de Documentación) y `§11` (repo_map.md).

### 8.2 Regla de oro

> **Todo cambio sustancial debe documentarse.** Un cambio es sustancial si afecta arquitectura, API, entorno, build, dependencias, estructura de directorios, auth o convenciones. Ver checklist detallado en `AGENTS.md §12.3`.

### 8.3 repo_map.md — Mapa de código

- Archivo auto-generado en raíz del proyecto: `repo_map.md`
- Contiene árbol de directorios + primeras 15 líneas de cada archivo
- **Nunca incluir en su totalidad en el prompt** — solo la sección relevante
- Regenerar con: `python3 scripts/generate_repo_map.py`

### 8.4 Orden de lectura recomendado

1. `AGENTS.md` — panorama completo
2. `repo_map.md` — árbol + previews de archivos
3. `CLAUDE.md` — reglas operativas (este archivo)
4. `WALKTHROUGH.md` — estado actual + deuda técnica
5. `BACKEND_GUIDE.md` o `frontend/FRONTEND_GUIDE.md` según el área
6. `frontend/DESIGN_SYSTEM.md` — estándar visual antes de tocar UI de Frontend
