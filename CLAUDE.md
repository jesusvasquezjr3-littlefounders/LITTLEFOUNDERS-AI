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
6. `frontend/DESIGN.md` — documento Director de Frontend, estándar visual "corp" (autoritativo sobre estilos de Frontend)
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
- [ ] Animación: sin `transition: all` — solo propiedades exactas; `scale(0.96)` en press; `prefers-reduced-motion` respetado; `will-change` solo en `transform`/`opacity`/`filter`
- [ ] Tipografía: `text-balance` en headings; `text-pretty` en body; `tabular-nums` en números dinámicos
- [ ] Superficies: radio concéntrico en elementos anidados; ≥44×44px hit area; imágenes solo con bordes redondeados, sin marcos/outlines

**Seguridad:**
- [ ] Sin PII en logs o payloads externos
- [ ] Migraciones SQL pasan `supabase db reset` dos veces seguidas
- [ ] Sin secrets commiteados (`.env` en `.gitignore`)

**Documentación (ver §8):**
- [ ] Cambios sustanciales reflejados en `*.md` (arquitectura, API, deploy, etc.)
- [ ] `repo_map.md` regenerado si cambió estructura de directorios
- [ ] Workflows CI/CD actualizados si aplica
- [ ] **Graphify ejecutado:** `graphify .` para actualizar knowledge graph
- [ ] **repo_map.md regenerado:** `python3 scripts/generate_repo_map.py`

---

## 3. Convenciones de Código

### Frontend (TypeScript/React)
- **Mobile-first:** clases base para móvil, `sm:`, `lg:` para desktop
- **i18n obligatorio:** todo texto visible por `t()`
- **Sin `any`:** usar tipos concretos; justificar excepciones en PR
- **`strict: true`** en tsconfig — no relajar sin aprobación
- **Tailwind utility classes:** sin valores raw hex/pixel
- **Estándar visual "corp" (Island / Brilliant Style):** toda vista de "chrome serio" (marketing, auth, cuenta, admin, utilitarias) usa el patrón de "islas" (fondos `slate-50` limpios con contenedores `bg-white rounded-[2.5rem] shadow-sm`) y botones `rounded-full`. Sigue `frontend/DESIGN.md`. Las vistas de niños (juegos/lecciones) siguen el sub-estándar "Playful" (§9 de ese doc). **Antes de escribir cualquier código UI, todo agente debe ejecutar el Checklist Pre-Vuelo en `frontend/DESIGN.md §0`.**
- **Animación y Motion:** reglas codificadas en `frontend/DESIGN.md §11`. Sin `transition: all`, scale press = `0.96`, `prefers-reduced-motion` obligatorio, `will-change` solo en `transform/opacity/filter`. CSS transitions para interactivos, keyframes solo para one-shot. Framer Motion para animaciones complejas.
- **Superficies y pulido:** reglas codificadas en `frontend/DESIGN.md §4.4–§4.5`. Radio concéntrico en elementos anidados, sombras sobre bordes para elevación, imágenes solo con bordes redondeados sin marcos, ≥44×44px hit area, alineación óptica en botones icono+texto.
- **Clases tipográficas obligatorias:** todo texto en vistas Corp debe usar las clases `corp-*` del catálogo centralizado (`corp-h1`–`corp-h4`, `corp-subtitle-*`, `corp-body-*`, `corp-number-*`). Prohibido componer tamaños ad-hoc con utilidades Tailwind (`text-sm font-semibold text-slate-600`, etc.). Ver `frontend/DESIGN.md §4.2.5` como autoridad.
- **Lesson Engine Layout (Regla de Oro):** Todos los componentes de ejercicio (personaje, burbuja de diálogo, tarjetas interactiva, excluyendo la barra de progreso superior) DEBEN estar perfectamente centrados en el punto (0,0) de los ejes X y Y dentro del contenedor dinámico de la página (`items-center justify-center flex-1`), tanto en Mobile (`flex-col`) como en Desktop (`lg:flex-row`). Prohibido usar offsets `sticky`, paddings superiores asimétricos o `items-start` que desfacen la alineación.
- **Sin Prettier:** formateo vía ESLint + convenciones

### Backend (Python/FastAPI)
- **Async/await:** sin mezclar con `.then()` o callbacks
- **IO externo con timeout:** 30s AI, 10s DB, 60s uploads
- **Routes thin:** parse request → call ONE service → format response
- **Services:** toda la lógica de negocio (sin HTTP concerns)
- **Migraciones idempotentes:** `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
- **Nunca editar migración commiteada** — escribir delta migration

---

## 4. Skills para Agentes AI

El proyecto incluye **skills** especializadas en `.claude/skills/` que los agentes AI DEBEN invocar según el tipo de tarea.

### 4.0 Regla de Doble Instalación

**Toda skill instalada en `.claude/skills/` DEBE existir también en `.github/skills/`.** Esto garantiza que los agentes de GitHub Actions y CI/CD tengan acceso a las mismas skills que los agentes locales. Si agregas una skill, debes copiarla a ambos directorios.

### 4.1 Catálogo de Skills

#### Diseño y UI

| Skill | Cuándo invocarla | Ubicación |
|-------|-----------------|-----------|
| **agave** | Al crear, revisar o modificar UI. Da instintos de senior product designer: jerarquía visual, color con intención, tipografía estructural, ritmo de espaciado, restricción, consistencia y personalidad. | `.claude/skills/agave/` y `.github/skills/agave/` |
| **emil-design-eng** | Al construir interfaces, escribir animaciones, revisar código de motion o tomar decisiones de design engineering. Basada en la filosofía de Emil Kowalski (Vercel/Linear). | `.claude/skills/emil-design-eng/` y `.github/skills/emil-design-eng/` |
| **impeccable** | Al diseñar, rediseñar, auditar, pulir, animar o mejorar cualquier interfaz frontend. Cubre landing pages, dashboards, formularios, onboarding, empty states, etc. Tiene subcomandos: `craft`, `shape`, `audit`, `polish`, `animate`, `bolder`, `quieter`, `harden`, `delight`, `live`, etc. | `.claude/skills/impeccable/` y `.github/skills/impeccable/` |
| **review-animations** | **Solo** al revisar código de animación/motion (CSS o JS). Revisa contra un estándar alto de craft. Por defecto marca problemas; la aprobación se gana. No para review general. | `.claude/skills/review-animations/` y `.github/skills/review-animations/` |
| **design-md** | Al documentar o auditar el sistema de diseño. Basada en la especificación de Google Labs para archivos DESIGN.md con tokens YAML front matter. | `.claude/skills/design-md/` y `.github/skills/design-md/` |
| **make-interfaces-feel-better** | Al aplicar principios de design engineering: text-balance, text-pretty, tabular-nums, radio concéntrico, sombras sobre bordes, hit areas 44×44px. | `.claude/skills/make-interfaces-feel-better/` y `.github/skills/make-interfaces-feel-better/` |
| **react-bits** | Al implementar componentes animados de React: text animations, backgrounds, micro-interactions, enter/exit transitions. | `.claude/skills/react-bits/` y `.github/skills/react-bits/` |
| **customize-opencode** | **Solo** para configuración de opencode (opencode.json, plugins, MCP servers, permisos). No para código de la aplicación. | Built-in (no en `.claude/skills/`) |

#### Productividad y Código

| Skill | Cuándo invocarla | Ubicación |
|-------|-----------------|-----------|
| **ponytail** | **OBLIGATORIO en toda sesión de desarrollo.** Invócala SIEMPRE antes de escribir código. Reduce ~54% el código generado manteniendo 100% de seguridad. Filosofía "lazy senior dev": YAGNI, reutilización, stdlib, features nativas, dependencias instaladas, one-liners. De [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail). | `.claude/skills/ponytail/` y `.github/skills/ponytail/` |
| **graphify** | **OBLIGATORIO antes de cada commit.** Ejecuta `graphify .` para generar el knowledge graph del proyecto. Crea `graphify-out/` con grafo interactivo, vault Obsidian, wiki, y `GRAPH_REPORT.md`. Facilita recuperación de contexto y mapeo de estructura. De [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify). | `.claude/skills/graphify/` y `.github/skills/graphify/` |
| **ecc** | **Context Engineering para memoria persistente.** Sistema de agentes con skills, instincts, memory optimization, continuous learning, security scanning. Trabaja con múltiples harnesses (Codex, Claude Code, Cursor, OpenCode, Gemini, Zed, GitHub Copilot). De [affaan-m/ecc](https://github.com/affaan-m/ecc). | `.claude/skills/ecc/` y `.github/skills/ecc/` |

#### Legal

| Skill | Cuándo invocarla | Ubicación |
|-------|-----------------|-----------|
| **claude-for-legal** | Al trabajar cualquier tema legal en la plataforma: revisión de contratos, NDAs, términos SaaS, privacidad (DPA, DSAR, PIA), empleo, propiedad intelectual, litigio, regulación, gobernanza de IA, cumplimiento corporativo, diligence M&A, y más. Suite completa de [anthropics/claude-for-legal](https://github.com/anthropics/claude-for-legal). **Todos los outputs son borradores para revisión de abogado, no asesoría legal.** | `.claude/skills/claude-for-legal/` y `.github/skills/claude-for-legal/` |
| **claude-for-legal-mexico** | Extensión de `claude-for-legal` con plugins específicos para jurisdicción mexicana. Incluye 10 plugins México (AGPLv3+) para derecho corporativo, laboral, fiscal, privacidad (LFPDPPP), litigación, propiedad intelectual (IMPI/INDAUTOR), gobernanza de IA, regulatorio (DOF/SNIF) y seguros (CNSF). Úsalo para cualquier tema legal con elementos de jurisdicción mexicana. De [wariomx/claude-for-legal-mexico](https://github.com/wariomx/claude-for-legal-mexico). **Todos los outputs son borradores para revisión de abogado, no asesoría legal.** | `.claude/skills/claude-for-legal-mexico/` y `.github/skills/claude-for-legal-mexico/` |

### 4.2 Reglas de Uso — Diseño y UI

1. **Toda tarea Frontend/UI DEBE considerar las skills** `agave`, `emil-design-eng` o `impeccable` según el caso antes de generar código.
2. **Animaciones/motion:** usar `emil-design-eng` para escribir y `review-animations` para revisar.
3. **Diseño nuevo o rediseños:** usar `impeccable craft` o `impeccable shape` para planear antes de codificar.
4. **Las skills NO aplican** a tareas de Backend o lógica no-UI.
5. **Las skills complementan, NO reemplazan** el estándar visual `corp-*` de `DESIGN.md`. Las skills refinan la ejecución; el design system define los tokens y clases.

### 4.3 Reglas de Uso — Legal

1. **Invocar `claude-for-legal`** ante cualquier tarea que involucre análisis legal, revisión de documentos legales, redacción de cláusulas, evaluación de riesgo regulatorio, o cumplimiento normativo.
2. **Invocar `claude-for-legal-mexico`** cuando el asunto involucre jurisdicción mexicana (derecho corporativo, laboral/LFT, fiscal/SAT, privacidad/LFPDPPP, litigación, PI/IMPI-INDAUTOR, regulatorio/DOF-SNIF, seguros/CNSF).
3. **Plugins disponibles (upstream):** `commercial-legal`, `corporate-legal`, `employment-legal`, `privacy-legal`, `product-legal`, `regulatory-legal`, `ai-governance-legal`, `ip-legal`, `litigation-legal`, `legal-clinic`, `law-student`, `legal-builder-hub`.
4. **Plugins México:** `corporativo-legal-mexico`, `laboral-legal-mexico`, `fiscal-legal-mexico`, `privacidad-legal-mexico`, `litigacion-legal-mexico`, `propiedad-intelectual-legal-mexico`, `regulatorio-legal-mexico`, `ia-governanza-legal-mexico`, `seguros-legal-mexico`, `conectores-legal-mexico`.
5. **Primer uso:** ejecutar `/<plugin>:cold-start-interview` para configurar el perfil de práctica del plugin.
6. **Todos los outputs son borradores** para revisión de abogado — no constituyen asesoría legal ni sustituyen el criterio profesional de un abogado licenciado.
7. **Citas no verificadas** se marcan con `[verify]` — conectar una herramienta de investigación (CourtListener, etc.) para citas verificadas.
8. **Skills instaladas en** `.claude/skills/` y `.github/skills/`: `claude-for-legal/` y `claude-for-legal-mexico/`.

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

Ver `AGENTS.md §1` (Autoridad de Documentación) y `§8.3` (repo_map.md).

### 8.2 Regla de oro

> **Todo cambio sustancial debe documentarse.** Un cambio es sustancial si afecta arquitectura, API, entorno, build, dependencias, estructura de directorios, auth o convenciones. Ver checklist detallado en `§2` (Requisitos Pre-Commit).

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
5. `backend/BACKEND_GUIDE.md` o `frontend/FRONTEND_GUIDE.md` según el área
6. `frontend/DESIGN.md` — documento Director de Frontend; leer antes de tocar UI
