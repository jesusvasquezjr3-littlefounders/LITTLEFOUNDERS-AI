# Lesson Factory — Contexto general

> **Espejo obligatorio:** `CLAUDE.md` y `AGENTS.md` de esta carpeta deben mantener **contenido idéntico** y se referencian mutuamente. Si editas uno, replica EXACTAMENTE el cambio en el otro.

> **Alcance:** Este archivo cubre SOLO `littlefounders_brain/lesson_factory/` (el generador de lecciones). El **cerebro de conocimiento (RAG)** vive aparte en `littlefounders_brain/rag-llm-brain/` y tiene su propia documentación — **no mezclar**.

---

## Qué es esta carpeta

`littlefounders_brain/lesson_factory/` es el **Lesson Factory**: el sistema que **genera las lecciones** de LittleFounders (educación financiera, edades 5→18+). Produce lecciones como JSON validado que luego se importan a la base de datos (Supabase/Postgres) y consume el frontend React.

**Principio rector:** *definir bien "las reglas del juego"* — esquema, contratos de render, rúbrica, gate determinista y contexto indexado en `skills/` — para que la generación sea de **alta calidad y automatizable, incluso con modelos económicos**, sin caer en el sesgo de un solo proveedor.

> El **grounding con fuentes** y la base de conocimiento RAG ya NO viven aquí: son del cerebro (`../rag-llm-brain/`). El Lesson Factory consumirá ese cerebro como contexto de grounding en una fase posterior.

## Mapa rápido de la carpeta

- `schema/` — esquema fuente única (`lesson_v2.py`) + registro de tipos (`exercise_registry.json`) + contratos de render + `gen_frontend_types.py`.
- `eval/` — gate, rúbrica, golden sets y arnés de evaluación de lecciones.
- `curriculum/` — currículo fuente (aventuras 1-6).
- `concept_taxonomy.json`, `abstraction_ceiling.json`, `pedagogy_rules.json` — taxonomía espiral, techo Piaget por banda, reglas pedagógicas por edad.
- `generate.py`, `generate_v2.py`, `gate.py`, `validate.py` — scripts de generación/validación (en reestructuración).
- `*.md` — documentación del Lesson Factory (`V2_STRATEGY.md`, `RULES.md`, `GENERATION_LOG.md`, `MASS_GENERATION_RUNBOOK.md`).

## Catálogo de skills (`skills/`)

Contexto indexable por petición para generación pedagógica de alta calidad. Cada carpeta contiene el **contenido completo y verbatim** del repo de origen + un `_SOURCE.md` con fuente, licencia y fecha.

| Skill | Para qué sirve | Licencia origen |
|-------|----------------|-----------------|
| `instructional-design-toolkit/` | Bloom práctico (memorizar→aplicar→analizar→crear) + plantilla de lección (CONTEXT→CONCEPT→BUILD→SHIP→REFLECT) + evaluación Kirkpatrick. | BSL-1.1 ⚠️ |
| `learning-notes/` | Psicología infantil/adolescente: cerebro emocional vs lógico, "name it to tame it", regulación de frustración, motivación. Para tono, feedback y manejo de frustración. | sin licencia OSS ⚠️ |

> ⚠️ = la fuente tiene **licencia restrictiva o sin licencia OSS** y aquí está su **copia verbatim completa**. **Uso interno como contexto del agente solamente; NO redistribuir** este contenido en el producto sin revisar su licencia (ver `_SOURCE.md`/`LICENSE` de cada carpeta).
>
> Las skills de RAG/grounding (`notebooklm-py`, `lightrag`, `knowledge-nexus`, `obsidian-second-brain`) se movieron al cerebro: `../rag-llm-brain/skills/`.

## Reglas mínimas

- **Nada se publica a la BD sin revisión.** Generación local y supervisada; solo se suben resultados aprobados.
- **i18n:** las lecciones se generan bilingües (ES→EN); el vocabulario controlado (tipos, fases) nunca se traduce.
- **No editar migraciones commiteadas**; escribir delta migrations (ver reglas raíz del repo).
