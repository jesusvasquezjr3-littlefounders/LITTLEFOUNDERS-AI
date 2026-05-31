# CLAUDE.md — LittleFounders AI Operating Rules

> **Última actualización:** 2026-05-31
> **Propósito:** Reglas operativas no negociables para agentes AI.

---

## 1. Autoridad de Documentación

1. `CLAUDE.md` — este archivo (máxima autoridad)
2. `AGENTS.md` — reglas del proyecto
3. `ROADMAP.md` — plan de arquitectura y sprints
4. `GLOSSARY.md` — terminología canónica
5. `WALKTHROUGH.md` — snapshot informativo
6. Código fuente — descriptivo, no autoritativo
7. `RUNBOOK.md` — respuesta a incidentes

---

## 2. Requisitos Pre-Commit

Antes de hacer commit, verificar:

- [ ] `npm run type-check` pasa en `frontend/`
- [ ] `npm run lint` pasa en `frontend/` (sin errores)
- [ ] `ruff check` pasa en `backend/`
- [ ] `npm test` pasa en `frontend/`
- [ ] Tests agregados para lógica nueva
- [ ] Sin PII en logs o payloads externos
- [ ] Sin `any` en TypeScript sin justificación en PR
- [ ] Migraciones SQL pasan `supabase db reset` dos veces seguidas

---

## 3. Convenciones de Código

### Frontend (TypeScript/React)
- **Mobile-first:** clases base para móvil, `sm:`, `lg:` para desktop
- **i18n obligatorio:** todo texto visible por `t()`
- **Sin `any`:** usar tipos concretos; justificar excepciones en PR
- **`strict: true`** en tsconfig — no relajar sin aprobación
- **Tailwind utility classes:** sin valores raw hex/pixel
- **Sin Prettier:** formateo vía ESLint + convenciones

### Backend (Python/FastAPI)
- **Async/await:** sin mezclar con `.then()` o callbacks
- **IO externo con timeout:** 30s AI, 10s DB, 60s uploads
- **Routes thin:** parse request → call ONE service → format response
- **Services:** toda la lógica de negocio (sin HTTP concerns)
- **Migraciones idempotentes:** `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
- **Nunca editar migración commiteada** — escribir delta migration

---

## 4. Stack Tecnológico

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
| Deploy BE | Render |

---

## 5. Seguridad

- `.env` en `.gitignore` — nunca comitear secrets
- JWT expira en 30 min, firmado HS256, `sub` = email
- CORS whitelist explícita en `config.py`
- Rate limiting: slowapi global (60 req/min)
- Supabase Service Role Key solo en Edge Functions

---

## 6. Testing

- **Frontend:** `npm test` (Vitest) en `frontend/`
- **Backend:** `pytest -v` en `backend/`
- Tests contra DB local (no Cloud Supabase)
- Cubrir al menos: middleware, validación Zod, casos happy + sad path
