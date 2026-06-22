# rag-llm-brain — Cerebro de conocimiento (RAG) de LittleFounders

> **Espejo obligatorio:** `CLAUDE.md` y `AGENTS.md` de esta carpeta deben mantener **contenido idéntico**.
> **Alcance:** SOLO el cerebro RAG (`littlefounders_brain/rag-llm-brain/`). El **Lesson Factory** vive aparte
> en `littlefounders_brain/lesson_factory/` y tiene su propia documentación — **no mezclar**.
>
> **Pipeline vigente: v3.1 (hardened)** (fact-anchored · Qwen autor + GLM juez · breadth-first · STOP por
> cobertura real · grounding etiquetado · dedup semántico · frescura wall-clock).
> **📖 Referencia CANÓNICA de principio a fin: [`PIPELINE.md`](PIPELINE.md)** (con diagramas mermaid).
> Diseño histórico: [`ARCHITECTURE_V3.md`](ARCHITECTURE_V3.md) · ejecución/resume: [`PLAN_V3_EXECUTION.md`](PLAN_V3_EXECUTION.md)
> · estrategia de cobertura TOTAL: [`ENCYCLOPEDIA_STRATEGY.md`](ENCYCLOPEDIA_STRATEGY.md).

---

## Qué es esta carpeta

El **cerebro de conocimiento**: un dataset RAG de alta densidad y rigor sobre emprendimiento, finanzas,
administración, contaduría, impuestos y economía para **México y Estados Unidos** (diferenciados, sin
fuga de jurisdicción), bilingüe ES/EN, edades 5→18+. Construido **autónomamente** por un pipeline que
no consume tokens de Claude: **DeepSeek V4** planea el currículo, **Qwen** redacta, **GLM (z.ai)** juzga
**con búsqueda web** (3 proveedores independientes), una **tabla canónica** (`_meta/facts.yaml`, ~67 cifras)
ancla las cifras volátiles, **NotebookLM** funda en fuentes primarias curadas, y un **gate determinista**
hace cumplir los invariantes (incluyendo el valor de cada cifra).
Alimentará la generación de lecciones y, a futuro, un chatbot.

> **Claim honesto (no marketing):** esto NO es "datos 100% reales" ni un corpus de *pretraining* tipo
> Cosmopedia. Es una **base de conocimiento RAG curada**: las **cifras canónicas** (`facts.yaml`) están
> **verificadas determinísticamente** (HARD-FAIL si difieren); el resto es **prosa autorada por LLM +
> revisada por un juez LLM con búsqueda**, etiquetada por su `grounding_tier` (anchored | llm_reviewed |
> conceptual) y pendiente de firma SME antes de `published`. Competimos con Investopedia / IRS-SAT / un
> currículo hand-authored — no con corpus de pretraining.

Prioridad de diseño: **AMPLITUD antes que profundidad** — cubrir TODO el espectro de conocimiento antes
de profundizar ningún tema. Estrategia base: [`BRAIN_STRATEGY.md`](BRAIN_STRATEGY.md).

## Mapa de la carpeta

```
rag-llm-brain/
├── ARCHITECTURE_V3.md · PLAN_V3_EXECUTION.md · ENCYCLOPEDIA_STRATEGY.md   diseño v3 + ejecución + cobertura total
├── BRAIN_STRATEGY.md          estrategia base y decisiones
├── skills/                    contexto indexado (notebooklm-py, lightrag, knowledge-nexus, obsidian-second-brain)
├── .venv/ .notebooklm/ .env   infra (gitignored): venv, cookies NotebookLM, creds Qwen + z.ai
└── knowledge/                 EL CEREBRO
    ├── _meta/                 contrato: taxonomy · sources · volatility_policy · schema.json · build_policy · facts(canónica)
    ├── shared/ mx/ us/        corpus markdown (fuente de verdad)
    ├── tools/                 gate_kb · facts_table · build_concept_map · normalize_concept_map · dedup · semdedup · decontaminate · coverage_report · build_dataset · llm_qwen · preflight · update_facts · build_evidence · build_index · retriever · kb_common · test_pipeline
    ├── eval/                  golden_qa · leakage_tests · competency_questions · run_kb_eval
    ├── evidence/              (gitignored) caché de fulltext curado de NotebookLM
    ├── index/                 (gitignored) índice SQLite + llm_cache/ + build_state.json + build_log.jsonl
    ├── README.md  DATASET_BUILD_RUNBOOK.md
```

## El pipeline v3 (resumen)

```
build_evidence.py (NotebookLM)   → ingiere fuentes primarias por (país,dominio) → caché evidence/
facts.yaml (tabla canónica)      → ~67 cifras de oro MX/US verificadas (verdad de base)
concept_map.yaml (espinazo)      → build_concept_map.py (DeepSeek) → ~7,950 temas = "qué es TODO" (enciclopedia)
build_dataset.py (DeepSeek+Qwen+GLM) → PLANNER/mapa(DeepSeek V4) → AUTHOR(Qwen+canon+evidencia+search?) → ENSAMBLE
                                   → GATE(código: schema·firewall·vocab·citas·VALOR canónico·paridad ES/EN·dedup)
                                   → JUDGE(GLM z.ai + búsqueda web, recibe evidencia) → revise-loop
                                   → review · draft si no converge   [BREADTH-FIRST: pasadas 2→5→TODO el mapa]
```
- **Roles (3 proveedores indep.):** planner/crítico/mapa = **DeepSeek V4**; autor = **Qwen-Plus**; juez =
  **GLM (z.ai) + búsqueda web**. Pools de cuota separados → más velocidad + errores no correlacionados.
- **Cobertura enciclopédica = `concept_map.yaml`** (espinazo): define el espacio EXHAUSTIVO de temas (~7,950);
  la cobertura es MEDIBLE (docs/temas) y el orquestador genera CONTRA el mapa. Dedup en 2 niveles (léxico
  inline + semántico `semdedup.py`) evita relleno; el STOP por cobertura PARA al 100% del mapa.
- **Verdad de cifras = `facts.yaml`** (no consenso de LLMs): el autor copia id+valor; el gate los compara.
- **Uso sabio:** caché de respuestas LLM, búsqueda solo si falta evidencia, el juez no re-checa cifras canónicas.
- **STOP por COBERTURA** (`_meta/build_policy.yaml` `stop_on: coverage`): corre hasta cubrir TODO el concept
  map (no por MB). Presupuesto en **$** por proveedor con alerta de saldo bajo corta si se excede.

## Comandos

```bash
cd littlefounders_brain/rag-llm-brain
./.venv/bin/python knowledge/tools/build_concept_map.py --status            # espinazo: cobertura del mapa
./.venv/bin/python knowledge/tools/coverage_report.py                        # GRID_Φ / cobertura / concept-recall
./.venv/bin/python knowledge/tools/test_pipeline.py                          # invariantes del orquestador (deben pasar)
./.venv/bin/python knowledge/tools/preflight.py                              # auditoría GO/NO-GO (antes de --run)
nohup ./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 > knowledge/build_v3.log 2>&1 &
./.venv/bin/python knowledge/tools/build_dataset.py --status                 # progreso (tamaño/amplitud/cobertura/grounding/drafts)
./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 --retry-drafts   # resume regenerando drafts
./.venv/bin/python knowledge/tools/semdedup.py --embedder fastembed --demote          # CURACIÓN: dedup semántico (antes de servir)
./.venv/bin/python knowledge/tools/decontaminate.py --strict                 # no eval-circular (preguntas verbatim en corpus)
./.venv/bin/python knowledge/tools/facts_table.py --verified                 # cifras canónicas exigidas (~67)
./.venv/bin/python knowledge/tools/update_facts.py --due                     # cifras vencidas (frescura, wall-clock)
./.venv/bin/python knowledge/tools/gate_kb.py                                # invariantes (incluye valor canónico)
./.venv/bin/python knowledge/tools/build_index.py --production --embedder fastembed     # índice PROD (rechaza 'hash')
./.venv/bin/python knowledge/eval/run_kb_eval.py --strict-recall             # golden + FUGA + competency + frescura
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

Toda skill tiene un `SKILL.md` que es la fuente de verdad para el agente. **Antes de trabajar en
tareas relacionadas con una skill, leer su `SKILL.md`.**

### Catálogo

| Skill | Para qué | Cuándo invocar | `SKILL.md` |
|-------|----------|----------------|------------|
| `notebooklm-py/` | Grounding con NotebookLM (API no oficial). Descubre fuentes, extrae fulltext, pregunta con citas. | Al trabajar en `build_evidence.py`, ingesta de fuentes primarias, refresh de creds, o cualquier tarea de descubrimiento/grounding. | `skills/notebooklm-py/SKILL.md` |
| `lightrag/` | Motor RAG grafo+vector dual-layer (KG + embeddings). 5 modos de query. **EN REPISA** (decisión D2). | Al evaluar motores RAG alternativos, discutir arquitectura de retrieval, o comparar enfoques grafo-primero vs vector-primero. | `skills/lightrag/SKILL.md` |
| `knowledge-nexus/` | Pipeline ingest→grafo de conocimiento con Neo4j. Patrones de chunking y metadata-en-embedding. | Al trabajar en chunking, pipelines de ingest, metadata denormalizada en chunks, o evaluar patrones de graph-building. | `skills/knowledge-nexus/SKILL.md` |
| `obsidian-second-brain/` | Operador de vault Obsidian: 45+ comandos, research toolkit, AI-first vault rules, esquema markdown+frontmatter. | Al definir/modificar el esquema del corpus markdown, frontmatter, navegabilidad, MOCs, o cualquier aspecto de la estructura de documentos. | `skills/obsidian-second-brain/SKILL.md` |

### Reglas de uso

1. **Toda tarea que involucre chunking, ingest, grounding, esquema de corpus o retrieval DEBE
   consultar el `SKILL.md` de la skill relevante** antes de generar código o modificar el pipeline.
2. **NotebookLM es el andamio de extracción:** leer `skills/notebooklm-py/SKILL.md` antes de tocar
   `build_evidence.py` o cualquier flujo de grounding.
3. **Obsidian-second-brain define el esquema del corpus:** leer `skills/obsidian-second-brain/SKILL.md`
   antes de modificar frontmatter, estructura de carpetas, o patrones de navegabilidad.
4. **Knowledge-Nexus inspira el firewall anti-fuga:** leer `skills/knowledge-nexus/SKILL.md` antes
   de modificar metadata de chunks o el sistema de filtrado.
5. **LightRAG está en repisa:** NO usar como motor de retrieval sin re-evaluar decisión D2 en
   BRAIN_STRATEGY.md. Consultar su `SKILL.md` solo para evaluación comparativa.
6. **Las skills complementan, NO reemplazan** el pipeline canónico definido en `PIPELINE.md` y
   `BRAIN_STRATEGY.md`. Las skills dan contexto de diseño; el pipeline es la autoridad operativa.
