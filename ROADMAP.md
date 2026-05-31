# ROADMAP.md — Plan de Arquitectura y Sprints

> **Última actualización:** 2026-05-31

---

## Sprint Actual: Calidad y Testing

**Objetivo:** Establecer infraestructura de calidad (testing, CI, linting, strict mode).

### Completado ✓
- [x] TypeScript strict mode activado
- [x] ESLint con reglas más estrictas
- [x] ruff para Python linting
- [x] Vitest + Testing Library para frontend
- [x] pytest + httpx para backend
- [x] GitHub Actions CI (2 workflows)
- [x] Environment files (.env.example, .env.test)
- [x] Supabase CLI config local

### Próximo Sprint — Testing Real
- [ ] Escribir tests para endpoints críticos (auth, health, lessons)
- [ ] Escribir tests para componentes frontend clave
- [ ] Configurar cobertura mínima (80%)
- [ ] Migración Supabase: dump + versionar schema

### Futuro — Automatización
- [ ] Pre-commit hooks (ruff + eslint + type-check)
- [ ] E2E tests con Playwright o Cypress
- [ ] Despliegue automatizado (CD)
- [ ] Docker compose para dev local

---

## API Contract (Backend → Frontend)

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/auth/*` | * | * | Auth endpoints |
| `/dashboard/*` | GET | Sí | Estadísticas |
| `/lesson-engine/*` | * | Optional | Contenido educativo |
| `/admin/*` | * | Admin | CRUD admin |
| `/reports/*` | POST | Sí | Reportes/bugs |
| `/social/*` | * | Sí | Red social |
| `/notifications/*` | * | Sí | Notificaciones |
| `/assets/*` | GET | Optional | Archivos multimedia |
