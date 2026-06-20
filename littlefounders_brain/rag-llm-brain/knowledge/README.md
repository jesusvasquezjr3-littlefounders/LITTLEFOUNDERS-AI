# 🧠 LittleFounders Brain — Knowledge Corpus

Base de conocimiento (RAG) sobre emprendimiento, finanzas, administración, contaduría, impuestos y
economía para **México** y **Estados Unidos** (diferenciados), bilingüe ES/EN, edades 5→18+.
Alimenta la generación de lecciones y, a futuro, un chatbot. Estrategia completa:
[`../BRAIN_STRATEGY.md`](../BRAIN_STRATEGY.md).

> **El markdown es la fuente de verdad.** El índice (`index/kb.db`) es un artefacto DERIVADO,
> gitignoreado y regenerable. Esta carpeta se abre también como **vault de Obsidian**.

## Estructura

```
knowledge/
├── _meta/        contrato: taxonomy.yaml · sources.yaml · volatility_policy.yaml · schema.json
├── shared/       conceptos jurisdicción-neutros (qué es un impuesto, matemática del dinero)
├── mx/           México   — {domain}/{subdomain}/{slug}.{es,en}.md
├── us/           EE.UU.   — idem
├── tools/        gate_kb.py · build_index.py · retriever.py · kb_common.py · discover_notebooklm.py
├── eval/         golden_qa.json · leakage_tests.json · run_kb_eval.py
└── index/        (gitignored) kb.db — el índice
```

Cada doc lleva frontmatter (país, dominio, subdominio, tiers de edad, volatilidad, fuentes, fecha
"as of"), secciones por tier de edad (`<!-- age_band: -->`) y sentinels `@fact` con provenance.

## Ciclo de trabajo

```bash
cd littlefounders_brain/rag-llm-brain
# 1) Validar el contrato (frontmatter, citas, anti-fuga, vocabulario por edad)
./.venv/bin/python knowledge/tools/gate_kb.py

# 2) Construir el índice (embedder sin dependencias por defecto)
./.venv/bin/python knowledge/tools/build_index.py            # o --embedder fastembed

# 3) Consultar (pre-filtro DURO por país/idioma)
./.venv/bin/python knowledge/tools/retriever.py --country mx --language es "¿cuánto es el IVA?"

# 4) Evaluar (golden Q&A + fuga de jurisdicción + frescura)
./.venv/bin/python knowledge/eval/run_kb_eval.py
```

## Reglas de oro

- **País + idioma son filtro DURO**, nunca un sesgo de ranking. Un query US jamás recupera un chunk MX.
- **`shared/` solo para lo genuinamente neutro.** En la duda, duplicar en `mx/` y `us/`.
- **Hechos volátiles fechados.** `volatility: high` → re-verificar cada 3 meses; cita ≥1 fuente primaria.
- **Nada se pega de fuentes con copyright.** Se redacta original y se cita el primario (`.gov`, DOF/leyes).

Estado: **piloto = dominio `impuestos`** (MX + US + shared). Escalar dominio por dominio hasta >10 MB.
