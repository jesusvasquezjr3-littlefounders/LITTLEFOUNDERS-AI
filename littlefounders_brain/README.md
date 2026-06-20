# littlefounders_brain — subsistema AISLADO (cerebro de conocimiento + Lesson Factory)

> **Punto de entrada de esta carpeta.** Aquí viven DOS subproyectos relacionados pero independientes.
> Empieza por el `CLAUDE.md` del subproyecto que te interese.

> ⚠️ **Subsistema aislado:** `littlefounders_brain/` **NO se despliega** con la plataforma (frontend/Vercel,
> backend/Railway). Es un proceso separado que **se integrará después**. Está excluido de los despliegues:
> el Frontend CI corre solo sobre `frontend/**`, el Backend CI solo sobre `backend/**` (un cambio aquí
> NO dispara CD), Railway despliega desde `./backend/` (esta carpeta queda fuera del snapshot), y
> `.vercelignore` excluye `littlefounders_brain/`. Tiene su propia CI de pruebas (`brain-ci.yml`,
> `lesson-factory-ci.yml`) que **no** despliega nada.

## Los dos subproyectos

| Carpeta | Qué es | Empieza en |
|---------|--------|-----------|
| **`rag-llm-brain/`** | **El cerebro de conocimiento (RAG).** Dataset denso MX/US (emprendimiento, finanzas, impuestos, etc.), bilingüe, construido por un pipeline autónomo (NotebookLM funda en fuentes primarias + Qwen-Flash redacta/juzga). Alimentará la generación de lecciones y un futuro chatbot. | [`rag-llm-brain/CLAUDE.md`](rag-llm-brain/CLAUDE.md) · estrategia [`rag-llm-brain/BRAIN_STRATEGY.md`](rag-llm-brain/BRAIN_STRATEGY.md) · ejecución [`rag-llm-brain/knowledge/DATASET_BUILD_RUNBOOK.md`](rag-llm-brain/knowledge/DATASET_BUILD_RUNBOOK.md) |
| **`lesson_factory/`** | **El generador de lecciones.** Produce las lecciones (JSON validado) que consume el frontend; esquema, currículo, gate y reglas pedagógicas. | [`lesson_factory/CLAUDE.md`](lesson_factory/CLAUDE.md) |

**Relación:** son independientes hoy; el Lesson Factory **consumirá el cerebro como contexto de grounding**
en una fase posterior. Documentación separada a propósito (no mezclar cerebro y generador de lecciones).

## Infra (gitignored, por subproyecto)

- `rag-llm-brain/.venv/` — venv (ver `rag-llm-brain/requirements.txt`).
- `rag-llm-brain/.env` — credenciales Qwen (plantilla: `rag-llm-brain/.env.example`).
- `rag-llm-brain/.notebooklm/` — cookies de sesión de NotebookLM.
- `rag-llm-brain/knowledge/{evidence,index}/` — caché de evidencia + índice (derivados).
