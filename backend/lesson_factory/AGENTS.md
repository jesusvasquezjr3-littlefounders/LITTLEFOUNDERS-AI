# Lesson Factory — Contexto general

> **Espejo obligatorio:** `CLAUDE.md` y `AGENTS.md` de esta carpeta deben mantener **contenido idéntico** y se referencian mutuamente. Si editas uno, replica EXACTAMENTE el cambio en el otro. (Mismo principio que el par raíz del repo.)

> **Alcance:** Este archivo cubre SOLO esta carpeta (`backend/lesson_factory/`). No duplica la documentación general del proyecto; para el contexto amplio, ver la documentación raíz del repo.

---

## Qué es esta carpeta

`backend/lesson_factory/` es el **Lesson Factory**: el sistema que **genera las lecciones** de LittleFounders (educación financiera, edades 5→18+). Produce lecciones como JSON validado que luego se importan a la base de datos (Supabase/Postgres) y consume el frontend React.

**Principio rector:** *definir bien "las reglas del juego"* — esquema, contratos de render, rúbrica, gate determinista y contexto indexado en `skills/` — para que la generación sea de **alta calidad y automatizable, incluso con modelos económicos**, sin caer en el sesgo de un solo proveedor.

## Mapa rápido de la carpeta

- `skills/` — contexto/documentación indexada por petición (caché de reglas y APIs externas; p. ej. `notebooklm-py` para grounding con NotebookLM).
- `schema/` — esquema fuente única (`lesson_v2.py`) + registro de tipos + contratos de render.
- `eval/` — gate, rúbrica, golden sets y arnés de evaluación.
- `curriculum/` — currículo fuente (aventuras 1-6).
- `*.py` — scripts de generación/validación (en reestructuración: cambiarán de nombre/proceso).
- `*.md` — documentación (estrategia, runbook, reglas, log).

## Reglas mínimas

- **Nada se publica a la BD sin revisión.** Generación local y supervisada; solo se suben resultados aprobados.
- **No comitear credenciales.** Las credenciales de Google/NotebookLM y el `.venv/` están cubiertos por el `.gitignore` de esta carpeta.
- **i18n:** las lecciones se generan bilingües (ES→EN); el vocabulario controlado (tipos, fases) nunca se traduce.
