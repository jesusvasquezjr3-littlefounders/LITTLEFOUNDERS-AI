# Lesson Factory — Contexto general

> **Espejo obligatorio:** `CLAUDE.md` y `AGENTS.md` de esta carpeta deben mantener **contenido idéntico** y se referencian mutuamente. Si editas uno, replica EXACTAMENTE el cambio en el otro. (Mismo principio que el par raíz del repo.)

> **Alcance:** Este archivo cubre SOLO esta carpeta (`backend/lesson_factory/`). No duplica la documentación general del proyecto; para el contexto amplio, ver la documentación raíz del repo.

---

## Qué es esta carpeta

`backend/lesson_factory/` es el **Lesson Factory**: el sistema que **genera las lecciones** de LittleFounders (educación financiera, edades 5→18+). Produce lecciones como JSON validado que luego se importan a la base de datos (Supabase/Postgres) y consume el frontend React.

**Principio rector:** *definir bien "las reglas del juego"* — esquema, contratos de render, rúbrica, gate determinista y contexto indexado en `skills/` — para que la generación sea de **alta calidad y automatizable, incluso con modelos económicos**, sin caer en el sesgo de un solo proveedor.

## Mapa rápido de la carpeta

- `skills/` — contexto/documentación indexada por petición. Incluye `notebooklm-py/` (grounding con NotebookLM): `SKILL.md` = referencia autoritativa empaquetada (versión-matcheada, v0.7.2); `README.md` = uso específico del proyecto + credenciales.
- `schema/` — esquema fuente única (`lesson_v2.py`) + registro de tipos + contratos de render.
- `eval/` — gate, rúbrica, golden sets y arnés de evaluación.
- `curriculum/` — currículo fuente (aventuras 1-6).
- `*.py` — scripts de generación/validación (en reestructuración: cambiarán de nombre/proceso).
- `*.md` — documentación (estrategia, runbook, reglas, log).

## Catálogo de skills (`skills/`)

Contexto indexable por petición para generación de alta calidad. Cargar el/los relevante(s) según la tarea; cada skill trae su `SKILL.md` con detalle, fuente y licencia.

| Skill | Para qué sirve | Licencia origen |
|-------|----------------|-----------------|
| `notebooklm-py/` | Grounding con NotebookLM (API no oficial). `SKILL.md` autoritativo + `README.md` del proyecto. | herramienta (ver doc) |
| `master-instructional-design/` | Arquitecto de aprendizaje veterano: diseño emocional, seguridad psicológica, Bloom, Gagné (9 eventos), Merrill, arco emocional. Estructurar temarios, mapas de empatía, escenarios no aburridos. | CC BY-NC-ND 4.0 ⚠️ |
| `instructional-design-toolkit/` | Bloom práctico (memorizar→aplicar→analizar→crear) + plantilla de lección (CONTEXT→CONCEPT→BUILD→SHIP→REFLECT) + evaluación Kirkpatrick. | BSL-1.1 ⚠️ |
| `awesome-fsrs/` | Algoritmo FSRS de repaso espaciado: modelo DSR (Dificultad/Estabilidad/Recuperabilidad) + fórmulas para programar el repaso justo antes del olvido. | CC0 (dominio público) |
| `spaced-repetition-learning/` | Arquitectura SR agnóstica de materia: rating 1-5 de fricción cognitiva → intervalo/dificultad/maestría adaptativos. | MIT |
| `brain-lift/` | NASA-TLX: medir/estimar carga mental (6 subescalas) y frustración por actividad; presupuestos por banda de edad. | © all rights reserved ⚠️ |
| `learning-notes/` | Psicología infantil/adolescente: cerebro emocional vs lógico, "name it to tame it", regulación de frustración, motivación. Para tono, feedback y manejo de frustración. | sin licencia OSS ⚠️ |

> ⚠️ = la fuente original tiene **licencia restrictiva o sin licencia OSS**. El contenido se destiló como **referencia interna** (no copia verbatim), con atribución en cada `SKILL.md`. **Uso interno solamente; no redistribuir** el contenido derivado en el producto sin revisar la licencia. FSRS (CC0) y spaced-repetition-learning (MIT) son de uso libre con atribución.

## Reglas mínimas

- **Nada se publica a la BD sin revisión.** Generación local y supervisada; solo se suben resultados aprobados.
- **No comitear credenciales.** Las cookies de sesión de Google/NotebookLM viven en `~/.notebooklm/` y en una copia local `.notebooklm/storage_state.json`; ambas + `.venv/` están gitignored. Cómo usarlas/refrescarlas: ver `skills/notebooklm-py/README.md`.
- **i18n:** las lecciones se generan bilingües (ES→EN); el vocabulario controlado (tipos, fases) nunca se traduce.
