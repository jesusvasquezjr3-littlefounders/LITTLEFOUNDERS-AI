# WALKTHROUGH.md — Estado Actual del Proyecto

> **Última actualización:** 2026-05-31
> **Propósito:** Snapshot del estado actual del proyecto, progreso y decisiones.

---

## Arquitectura Actual

```
littlefounders.ai
├── Frontend (React/Vite) → Vercel
├── Backend (FastAPI) → Render
└── Database (PostgreSQL) → Supabase
```

## Estado por Capa

### Frontend
- React 18 + Vite + TypeScript (strict: true ✓)
- Tailwind CSS + shadcn/ui
- i18n: español/inglés via i18next
- TanStack Query para estado servidor
- 6 juegos standalone con reducers propios
- **Testing:** Vitest configurado ✓ (1 placeholder test)

### Backend
- FastAPI + SQLAlchemy 2.0 + PostgreSQL
- JWT auth + Supabase Auth dual
- Módulos: auth, admin, lesson_engine, dashboard, social, notifications, assets, reports
- **Testing:** pytest configurado ✓ (1 health test placeholder)
- **Linting:** ruff configurado ✓

### CI/CD
- GitHub Actions: Frontend + Backend workflows ✓
- Frontend deploy: Vercel (Git integration)
- Backend deploy: Render (manual via Git)

---

## Decisiones Recientes

| Fecha | Decisión |
|-------|----------|
| 2026-05-31 | TypeScript strict mode activado |
| 2026-05-31 | ESLint endurecido con reglas no-console, no-unused-vars, no-explicit-any |
| 2026-05-31 | ruff agregado para linting Python |
| 2026-05-31 | Vitest configurado para frontend |
| 2026-05-31 | pytest + httpx configurado para backend |
| 2026-05-31 | GitHub Actions CI implementado |
| 2026-05-31 | Supabase config.toml creado para CLI local |
| 2026-05-31 | .env.example + .env.test creados |
| 2026-05-31 | Bugfix: 3 runtime bugs (hooks condicionales, case duplicado) |
| 2026-05-31 | Bugfix: 19 undefined-name F821 en admin/endpoints.py |
| 2026-05-31 | Seguridad: requirements.txt separado (prod) de requirements-dev.txt |
| 2026-05-31 | Seguridad: .vercelignore actualizado con exclusiones de testing |

---

## Deuda Técnica Conocida

1. **~150 variables no usadas** en frontend (TS6133) — `noUnusedLocals` desactivado temporalmente
2. **670 warnings de ESLint** en frontend — pre-existentes, no bloqueantes
3. **Sin Supabase migrations** — dump inicial pendiente (ejecutar `supabase db dump` local)
4. **Sin cobertura de tests reales** — solo placeholder tests
5. **Sin E2E tests** — solo manuales
6. **Sin pre-commit hooks** (husky/lint-staged)
7. **CI necesita configurar secrets** — `VERCEL_DEPLOY_HOOK_URL` y `RENDER_DEPLOY_HOOK_URL` para CD
