# rag-llm-brain — Cerebro de conocimiento (RAG) de LittleFounders

> **Espejo obligatorio:** `CLAUDE.md` y `AGENTS.md` de esta carpeta deben mantener **contenido idéntico**.
> **Alcance:** SOLO el cerebro RAG (`littlefounders_brain/rag-llm-brain/`). El **Lesson Factory** vive aparte
> en `littlefounders_brain/lesson_factory/` y tiene su propia documentación — **no mezclar**.
>
> **Pipeline vigente: v3** (fact-anchored · Qwen autor + GLM juez · breadth-first). Diseño autoritativo en
> [`ARCHITECTURE_V3.md`](ARCHITECTURE_V3.md); cómo ejecutarlo/reanudarlo en [`PLAN_V3_EXECUTION.md`](PLAN_V3_EXECUTION.md).

---

## Qué es esta carpeta

El **cerebro de conocimiento**: un dataset RAG de alta densidad y rigor sobre emprendimiento, finanzas,
administración, contaduría, impuestos y economía para **México y Estados Unidos** (diferenciados, sin
fuga de jurisdicción), bilingüe ES/EN, edades 5→18+. Construido **autónomamente** por un pipeline que
no consume tokens de Claude: **Qwen** redacta, **GLM (z.ai)** juzga **con búsqueda web**, una **tabla
canónica** (`_meta/facts.yaml`) ancla las cifras volátiles, **NotebookLM** funda en fuentes primarias
curadas, y un **gate determinista** hace cumplir los invariantes (incluyendo el valor de cada cifra).
Alimentará la generación de lecciones y, a futuro, un chatbot.

Prioridad de diseño: **AMPLITUD antes que profundidad** — cubrir TODO el espectro de conocimiento antes
de profundizar ningún tema. Estrategia base: [`BRAIN_STRATEGY.md`](BRAIN_STRATEGY.md).

## Mapa de la carpeta

```
rag-llm-brain/
├── ARCHITECTURE_V3.md · PLAN_V3_EXECUTION.md   diseño v3 + plan de ejecución/resume (autoritativos)
├── BRAIN_STRATEGY.md          estrategia base y decisiones
├── skills/                    contexto indexado (notebooklm-py, lightrag, knowledge-nexus, obsidian-second-brain)
├── .venv/ .notebooklm/ .env   infra (gitignored): venv, cookies NotebookLM, creds Qwen + z.ai
└── knowledge/                 EL CEREBRO
    ├── _meta/                 contrato: taxonomy · sources · volatility_policy · schema.json · build_policy · facts(canónica)
    ├── shared/ mx/ us/        corpus markdown (fuente de verdad)
    ├── tools/                 gate_kb · facts_table · build_dataset · llm_qwen · preflight · update_facts · build_evidence · build_index · retriever · kb_common
    ├── eval/                  golden_qa · leakage_tests · run_kb_eval
    ├── evidence/              (gitignored) caché de fulltext curado de NotebookLM
    ├── index/                 (gitignored) índice SQLite + llm_cache/ + build_state.json + build_log.jsonl
    ├── README.md  DATASET_BUILD_RUNBOOK.md
```

## El pipeline v3 (resumen)

```
build_evidence.py (NotebookLM)   → ingiere fuentes primarias por (país,dominio) → caché evidence/
facts.yaml (tabla canónica)      → 30 cifras de oro MX/US verificadas (verdad de base)
build_dataset.py (Qwen + GLM)    → PLANNER(Qwen) → AUTHOR(Qwen+canon+evidencia+search?) → ENSAMBLE
                                   → GATE(código: schema·firewall·vocab·citas·VALOR canónico·paridad ES/EN)
                                   → JUDGE(GLM z.ai + búsqueda web, recibe evidencia) → revise-loop
                                   → review · draft si no converge   [BREADTH-FIRST: pasadas cap 2→4→8]
```
- **Roles:** autor = **Qwen-Plus**; juez = **GLM (z.ai), proveedor INDEPENDIENTE + búsqueda web**
  (DeepSeek retirado: no tenía búsqueda). El planner = Qwen-Flash.
- **Verdad de cifras = `facts.yaml`** (no consenso de LLMs): el autor copia id+valor; el gate los compara.
- **Uso sabio:** caché de respuestas LLM, búsqueda solo si falta evidencia, el juez no re-checa cifras canónicas.
- **STOP** (`_meta/build_policy.yaml`): tamaño ≥ meta ∧ cobertura de amplitud ∧ eval verde.

## Comandos

```bash
cd littlefounders_brain/rag-llm-brain
./.venv/bin/python knowledge/tools/preflight.py                              # auditoría GO/NO-GO (antes de --run)
nohup ./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 > knowledge/build_v3.log 2>&1 &
./.venv/bin/python knowledge/tools/build_dataset.py --status                 # progreso (tamaño/amplitud/drafts)
./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 --retry-drafts   # resume regenerando drafts
./.venv/bin/python knowledge/tools/facts_table.py --verified                 # cifras canónicas exigidas
./.venv/bin/python knowledge/tools/update_facts.py --due                     # cifras vencidas (frescura)
./.venv/bin/python knowledge/tools/gate_kb.py                                # invariantes (incluye valor canónico)
./.venv/bin/python knowledge/tools/build_index.py --embedder fastembed       # índice (NO 'hash' en prod)
./.venv/bin/python knowledge/eval/run_kb_eval.py                             # golden + FUGA + frescura
```

## Reglas mínimas

- **País + idioma son filtro DURO** en la recuperación; un query US jamás recupera un chunk MX.
- **Las cifras volátiles viven en `facts.yaml`** (verdad de base). No inventar números en los docs: usar el
  id canónico; el gate compara el valor (mismatch = HARD-FAIL). Las cifras nuevas las confirma `update_facts.py`/SME.
- **Nada se publica solo.** El pipeline escribe `status: review` (o `draft`); humano aprueba → `published`.
- **No comitear credenciales ni evidencia.** `.env` (Qwen+z.ai), `.notebooklm/`, `.venv/`, `evidence/` e
  `index/` están **gitignored**. La evidencia es texto con copyright (insumo, NO producto); el corpus se
  **redacta original y se cita**.
- **i18n:** ES canónico, EN traducción verificada (el gate exige paridad de `@fact` ES/EN).

## Skills (`skills/`)

| Skill | Para qué |
|-------|----------|
| `notebooklm-py/` | Grounding con NotebookLM (API no oficial). Auth/creds: ver su `SKILL.md`. |
| `lightrag/` | Motor RAG grafo+vector (en repisa; ver BRAIN_STRATEGY §0 por qué no se usa de motor). |
| `knowledge-nexus/` | Mecánica de ingest→chunk (metadata-en-embedding). |
| `obsidian-second-brain/` | Esquema markdown+frontmatter AI-first (base del esquema del corpus). |
