# 🧠 LittleFounders Brain — Knowledge Corpus

> **Autoridad vigente:** el diseño de principio a fin es [`../ARCHITECTURE_V4.md`](../ARCHITECTURE_V4.md)
> y la guía de la corrida masiva es [`../RUNBOOK_V4.md`](../RUNBOOK_V4.md). Los diseños v3
> ([`../ARCHITECTURE_V3.md`](../ARCHITECTURE_V3.md), [`../PLAN_V3_EXECUTION.md`](../PLAN_V3_EXECUTION.md),
> [`../PIPELINE.md`](../PIPELINE.md)) son **históricos pero válidos donde v4 no los reemplaza**. Este
> README describe la estructura del corpus y el ciclo de trabajo; ante conflicto, manda v4.

Base de conocimiento (RAG) sobre emprendimiento, finanzas, administración, contaduría, impuestos y
economía para **México** y **Estados Unidos** (diferenciados), bilingüe ES/EN, edades 5→18+.
Alimenta la generación de lecciones y, a futuro, un chatbot. Estrategia completa:
[`../BRAIN_STRATEGY.md`](../BRAIN_STRATEGY.md).

> **El markdown es la fuente de verdad.** El índice (`index/kb.db`) es un artefacto DERIVADO,
> gitignoreado y regenerable. Esta carpeta se abre también como **vault de Obsidian**.

## Estructura

```
knowledge/
├── _meta/        contrato: taxonomy · sources · volatility_policy · schema.json · build_policy.yaml
│                 · facts.yaml (tabla canónica) · concept_map.yaml (espinazo enciclopédico)
├── shared/       conceptos jurisdicción-neutros (qué es un impuesto, matemática del dinero)
├── mx/           México   — {domain}/{subdomain}/{slug}.{es,en}.md
├── us/           EE.UU.   — idem
├── tools/        gate_kb · build_index · retriever · kb_common · facts_table · build_dataset
│                 · evidence_rag · atomic_verify · cost_projection · preflight · coverage_report …
├── eval/         golden_qa.json · leakage_tests.json · competency_questions.json · run_kb_eval.py
├── evidence/     (gitignored) caché de fulltext curado por tema (RAG-to-write)
└── index/        (gitignored) kb.db — el índice semántico real (mpnet)
```

- **`_meta/facts.yaml`** — tabla canónica: **67 cifras** (66 verificadas, 56 enforce). El autor copia
  id+valor; el gate compara el valor (mismatch o duplicado off-table de una cifra canónica = **HARD-FAIL**).
- **`_meta/concept_map.yaml`** — espinazo enciclopédico: **257 celdas / 7,950 temas**. Define el espacio
  EXHAUSTIVo de temas; la cobertura es MEDIBLE (docs verificados / temas) y el STOP se da **por cobertura**.

Cada doc lleva frontmatter (país, dominio, subdominio, tiers de edad, volatilidad, fuentes, fecha
"as of"), secciones por tier de edad (`<!-- age_band: -->`) y sentinels `@fact` con provenance.

## Ciclo de trabajo

> La construcción autónoma del corpus (planner → autor RAG-to-write → gate → juez → verificación atómica)
> vive en `tools/build_dataset.py` y se opera con [`../RUNBOOK_V4.md`](../RUNBOOK_V4.md). Aquí abajo solo
> el ciclo de validación/consulta de un corpus ya generado.

```bash
cd littlefounders_brain/rag-llm-brain
# 1) Validar el contrato (frontmatter, citas, anti-fuga, vocabulario por edad, VALOR canónico, disciplina de ids)
./.venv/bin/python knowledge/tools/gate_kb.py

# 2) Construir el índice semántico real PROD (mpnet 768d; rechaza embedder 'hash')
./.venv/bin/python knowledge/tools/build_index.py --production --embedder fastembed

# 3) Consultar (pre-filtro DURO por país/idioma)
./.venv/bin/python knowledge/tools/retriever.py --country mx --language es "¿cuánto es el IVA?"

# 4) Evaluar (golden Q&A + fuga de jurisdicción + competency + frescura)
./.venv/bin/python knowledge/eval/run_kb_eval.py
```

En v4 el autor escribe desde **evidencia recuperada por tema** (`tools/evidence_rag.py`, TF-IDF léxico +
firewall de jurisdicción sobre la entrada), y cada afirmación en prosa se **verifica atómicamente** contra
esa evidencia (`tools/atomic_verify.py`, NLI 3-vías: supported/contradicted/unverifiable). El juez GLM ya
no es el único garante factual. `tools/cost_projection.py` está cableado en `preflight.py`: niega el GO si
los topes de presupuesto no alcanzan para terminar toda la corrida.

## Reglas de oro

- **País + idioma son filtro DURO**, nunca un sesgo de ranking. Un query US jamás recupera un chunk MX.
- **`shared/` solo para lo genuinamente neutro.** En la duda, duplicar en `mx/` y `us/`.
- **Hechos volátiles fechados.** `volatility: high` → re-verificar cada 3 meses; cita ≥1 fuente primaria.
- **Nada se pega de fuentes con copyright.** Se redacta original y se cita el primario (`.gov`, DOF/leyes).

Estado: **corpus actual = 40 archivos / 20 temas** (22 published, 18 review). El piloto fue el dominio
`impuestos` (MX + US + shared). La meta NO es por MB: el STOP es **por cobertura** — generar contra el
`concept_map.yaml` (257 celdas / 7,950 temas) hasta cubrirlo, contando solo docs **verificados** (no
borradores). Guía de la corrida masiva: [`../RUNBOOK_V4.md`](../RUNBOOK_V4.md).
