# rag-llm-brain — Cerebro de conocimiento (RAG) de LittleFounders

> **Espejo obligatorio:** `CLAUDE.md` y `AGENTS.md` de esta carpeta deben mantener **contenido idéntico**.
> **Alcance:** SOLO el cerebro RAG (`littlefounders_brain/rag-llm-brain/`). El **Lesson Factory** vive aparte
> en `littlefounders_brain/lesson_factory/` y tiene su propia documentación — **no mezclar**.

---

## Qué es esta carpeta

El **cerebro de conocimiento**: un dataset RAG de alta densidad y rigor sobre emprendimiento, finanzas,
administración, contaduría, impuestos y economía para **México y Estados Unidos** (diferenciados, sin
fuga de jurisdicción), bilingüe ES/EN, edades 5→18+. Construido **autónomamente** por un pipeline que
no consume tokens de Claude: **Qwen** redacta/juzga, **NotebookLM** funda en fuentes primarias curadas,
y un **gate determinista** hace cumplir los invariantes. Alimentará la generación de lecciones y, a
futuro, un chatbot.

Estrategia completa: [`BRAIN_STRATEGY.md`](BRAIN_STRATEGY.md). Runbook de ejecución:
[`knowledge/DATASET_BUILD_RUNBOOK.md`](knowledge/DATASET_BUILD_RUNBOOK.md).

## Mapa de la carpeta

```
rag-llm-brain/
├── BRAIN_STRATEGY.md          estrategia y decisiones
├── skills/                    contexto indexado (notebooklm-py, lightrag, knowledge-nexus, obsidian-second-brain)
├── .venv/ .notebooklm/ .env   infra (gitignored): venv, cookies NotebookLM, creds Qwen
└── knowledge/                 EL CEREBRO
    ├── _meta/                 contrato: taxonomy · sources · volatility_policy · schema.json · build_policy
    ├── shared/ mx/ us/        corpus markdown (fuente de verdad)
    ├── tools/                 gate_kb · build_index · retriever · kb_common · llm_qwen · build_evidence · build_dataset
    ├── eval/                  golden_qa · leakage_tests · run_kb_eval
    ├── evidence/              (gitignored) caché de fulltext curado de NotebookLM
    ├── index/                 (gitignored) índice SQLite-vec/FTS5 derivado
    ├── README.md  DATASET_BUILD_RUNBOOK.md
```

## El pipeline híbrido (resumen)

```
build_evidence.py (NotebookLM)  → ingiere fuentes primarias por (país,dominio) → caché evidence/
build_dataset.py (Qwen-Flash)   → PLANNER → AUTHOR(funda en evidencia + search) → ENSAMBLE determinista
                                  → GATE → JUDGE+VERIFY (revise-loop) → draft si no converge → review
```
- **Roles LLM = Qwen-Flash** (decisión de costo); grounding = **evidencia curada NotebookLM + qwen_search** de respaldo.
- El **código determinista** hace cumplir: schema, **firewall anti-fuga país/idioma**, techo de vocabulario por edad, citas.
- Criterios de **STOP/profundidad** en `_meta/build_policy.yaml` (tamaño ≥ meta ∧ ≥N docs/subdominio ∧ eval verde).

## Comandos

```bash
cd littlefounders_brain/rag-llm-brain
./.venv/bin/python knowledge/tools/build_evidence.py --auth                 # verifica NotebookLM
./.venv/bin/python knowledge/tools/build_evidence.py --all                  # grounding curado (lento)
nohup ./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 > knowledge/build.log 2>&1 &
./.venv/bin/python knowledge/tools/gate_kb.py        # invariantes
./.venv/bin/python knowledge/tools/build_index.py    # índice
./.venv/bin/python knowledge/eval/run_kb_eval.py     # golden + FUGA + frescura
./.venv/bin/python knowledge/tools/retriever.py --country mx --language es "¿cuánto es el IVA?"
```

## Reglas mínimas

- **País + idioma son filtro DURO** en la recuperación; un query US jamás recupera un chunk MX.
- **Nada se publica solo.** El pipeline escribe `status: review`; humano aprueba y promueve a `published`.
- **No comitear credenciales ni evidencia.** `.env` (Qwen), `.notebooklm/` (cookies Google), `.venv/`,
  `evidence/` e `index/` están **gitignored**. La evidencia es texto fuente con copyright (insumo de
  grounding, NO producto); el contenido del corpus se **redacta original y se cita**.
- **i18n:** ES canónico, EN traducción verificada.

## Skills (`skills/`)

| Skill | Para qué |
|-------|----------|
| `notebooklm-py/` | Grounding con NotebookLM (API no oficial). Auth/creds: ver su `SKILL.md`. |
| `lightrag/` | Motor RAG grafo+vector (en repisa; ver BRAIN_STRATEGY §0 por qué no se usa de motor). |
| `knowledge-nexus/` | Mecánica de ingest→chunk (metadata-en-embedding). |
| `obsidian-second-brain/` | Esquema markdown+frontmatter AI-first (base del esquema del corpus). |
