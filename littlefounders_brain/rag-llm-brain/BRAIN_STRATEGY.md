# BRAIN_STRATEGY.md — El Cerebro de Conocimiento de LittleFounders

> ⚠️ **v3.1 — HARDENING (2026-06-21):** referencia CANÓNICA de principio a fin (con mermaid) =
> [`PIPELINE.md`](PIPELINE.md). Tras evaluación crítica: STOP por cobertura real, review→draft funcional,
> claim "100% real" reducido a su alcance (solo ~67 cifras de `facts.yaml`; el resto LLM-revisado con
> `grounding_tier`), embedder de prod fastembed multilingüe, frescura wall-clock, dedup semántico +
> decontaminación. Lo de abajo es estrategia base/histórica.

> ⚠️ **ACTUALIZACIÓN v3 (2026-06-21):** el pipeline evolucionó a **v3** tras un benchmark vs. la industria
> (Phi/Cosmopedia, BloombergGPT/FinPile, SAFE/FActScore, Constitutional AI). Cambios clave: **(1)** verdad
> de base estructurada en `_meta/facts.yaml` (tabla canónica de cifras, el gate compara valores —
> determinista, no consenso de LLMs); **(2)** **juez = GLM (z.ai) con búsqueda web**, proveedor
> independiente del autor Qwen (DeepSeek retirado: no tenía búsqueda); **(3)** orquestación
> **breadth-first** (amplitud antes que profundidad); **(4)** robustez: preflight, resume, escritura
> atómica, presupuesto; **(5)** agente de actualización atómica (`update_facts.py`) para frescura.
> Diseño autoritativo: [`ARCHITECTURE_V3.md`](ARCHITECTURE_V3.md) · ejecución: [`PLAN_V3_EXECUTION.md`](PLAN_V3_EXECUTION.md).
> Lo de abajo es la estrategia base (sigue vigente salvo donde v3 la sustituye).

> **Fecha:** 2026-06-19
> **Estado:** Estrategia aprobada + **PILOTO IMPLEMENTADO** (dominio `impuestos`, MX+US+shared).
> **Hogar:** ya movido a `littlefounders_brain/` (raíz). El corpus vive en `littlefounders_brain/rag-llm-brain/knowledge/`.
>
> **Implementación (2026-06-19):** movimiento backend→raíz hecho y verificado (CI verde: taxonomía DAG,
> esquema, tipos FE en sync). Fase 0 (contrato `_meta/` + `gate_kb.py`), piloto de impuestos (22 docs
> bilingües citados, gate VERDE 0 fails), tooling (`build_index.py` SQLite+FTS5, `retriever.py` con
> pre-filtro duro, `discover_notebooklm.py`), y eval (golden 8/8, **fuga 6/6**, frescura 2/2). CI:
> `.github/workflows/brain-ci.yml`. **Siguiente: evaluar la CALIDAD del contenido generado.**
> **Propósito:** Base de conocimiento (RAG) de alta densidad sobre emprendimiento, finanzas,
> administración, contaduría, impuestos y economía para **México y Estados Unidos** (diferenciados),
> que (a) alimenta la generación de lecciones del Lesson Factory y (b) servirá de "cerebro" para un
> futuro chatbot. Meta de volumen: **>10 MB** de markdown curado y citado.

---

## 0. Decisiones fijadas (no renegociar sin causa)

| # | Decisión | Valor | Razón |
|---|----------|-------|-------|
| D1 | **Motor de recuperación** | **Markdown canónico + SQLite-vec (vectorial) + FTS5 (BM25), híbrido, con pre-filtro DURO `country`+`language`** | Fact-lookup particionado por jurisdicción y atado a citas. Reproducible, en git, ~$0 de ingesta, sin fugas MX↔US por diseño. |
| D2 | **NO LightRAG (por ahora)** | En la repisa | Su grafo inventa relaciones cross-documento = el modo de fallo de fuga que más tememos; sin filtrado nativo por metadata; ingesta cara/no-determinista; artefactos no versionables. Reconsiderar solo si se requiere razonamiento multi-salto. |
| D3 | **Carpeta** | **`littlefounders_brain/`** (raíz) | Marca + alcance de producto explícito. |
| D4 | **Alcance v1** | **Piloto-primero**: dominio `impuestos` × `{mx, us}` × 5 tiers, totalmente citado | "Medir antes de fabricar". Valida pipeline + gates de fuga antes de escalar a los 12 dominios. |
| D5 | **Idioma** | **ES canónico, EN traducción verificada** | Mismo principio que V2_STRATEGY §3. El EN es hermano, no verdad independiente. |
| D6 | **Embeddings** | **Multilingües locales** (`bge-m3` o `multilingual-e5-large`); fallback API `text-embedding-3-small` | $0, sin dependencia frágil, ES/EN en un mismo espacio. |

---

## 1. Arquitectura de dos capas

El cerebro **no es un solo RAG**: son tres responsabilidades separadas. NotebookLM es un **andamio desechable**; el corpus markdown es el **activo durable**; el índice es **derivado regenerable**.

```
   DESCUBRIMIENTO + EXTRACCIÓN              CORPUS (fuente de verdad)            RECUPERACIÓN (el RAG real)
   ─────────────────────────              ──────────────────────────            ─────────────────────────
   NotebookLM (el "buscador")     →        Markdown + frontmatter      →         SQLite-vec + FTS5 (BM25)
   · source add-research --deep            · 1 hecho = 1 doc, citado              · filtro DURO país/idioma
   · source fulltext (texto íntegro)       · ES canónico, EN verificado           · re-ranking por edad (tier)
   · ask --json (respuestas citadas)       · provenance + fecha "as of"           · provenance en cada respuesta
        ↑ frágil, no oficial                    ↑ DURADERO, en git                      ↑ lecciones + chatbot
        ↑ NO se consulta en runtime             ↑ canónico                              ↑ .db gitignoreado
```

**Regla de oro de la capa de extracción:** NotebookLM puede romperse, sus cookies expiran y tiene
rate limits. Por eso **en tiempo de consulta el RAG no depende de NotebookLM**. Se usa una sola vez
para construir el corpus; lo que persiste es markdown + provenance versionado.

### NotebookLM como "buscador" — los tres verbos que importan

| Verbo | Comando | Uso en el pipeline |
|-------|---------|--------------------|
| **Descubrir** | `source add-research "query" --mode deep --no-wait` | Investigación web autónoma; importa 20+ fuentes/consulta (15-30 min). |
| **Extraer** | `source fulltext <id> --json` | Texto íntegro indexado de cada fuente → **evidencia de grounding**. |
| **Preguntar** | `ask "..." --json` | Respuesta fundamentada con `references[].source_id` + `cited_text`. |

> Verbos confiables (siempre funcionan): `create`, `source add/list/fulltext`, `ask`, `research`.
> Verbos no confiables (rate-limited, evitar en el pipeline): `generate audio/video/quiz/...`.
> Auth: `auth check --test --json` debe dar `status:ok` **y** `checks.token_fetch:true`. Mantener
> con `auth refresh --quiet` (cron 15-20 min). Login interactivo necesita un humano una vez.
> Límite de fuentes por notebook según plan: Standard 50 · Plus 100 · Pro 300 · Ultra 600
> → **shardear notebooks por (país, dominio)** para no toparse con el límite.

### Cumplimiento / copyright (importante)

`source fulltext` devuelve **texto fuente con copyright**. El corpus **NO pega ese texto**: el agente
**redacta explicaciones propias y parafraseadas**, usando fulltext/ask como evidencia, y cita el
primario vía `@fact`/`sources`. Leyes mexicanas (DOF, Cámara de Diputados) y obras de gobierno de EE.UU.
(`.gov`) son de dominio público; las fuentes secundarias no. Las skills con licencia restrictiva
(`master-instructional-design`, `instructional-design-toolkit`, `learning-notes`) son **contexto
interno del agente**, nunca se redistribuyen en el producto.

---

## 2. Estructura del corpus: 4 ejes

Todo documento se clasifica por **País × Dominio × Tier-de-edad × Idioma**.

### Folder grammar (rígida)

```
littlefounders_brain/rag-llm-brain/knowledge/
├── README.md                      # entrada humana + Obsidian (Map of Content)
├── _meta/
│   ├── taxonomy.yaml              # vocabulario cerrado: dominios, subdominios, age_bands, tiers
│   ├── sources.yaml               # registro de fuentes (id → cita, url, tier, licencia, jurisdicción)
│   ├── volatility_policy.yaml     # cadencias de re-verificación por volatilidad
│   └── schema.json                # JSON Schema del frontmatter (el gate)
├── shared/                        # SOLO conceptos jurisdicción-neutros (matemática del interés)
├── mx/
│   ├── _country.md                # perfil: MXN, autoridad SAT, etc.
│   ├── taxes/{iva,isr,...}/<slug>.{es,en}.md
│   ├── finance/  accounting/  economics/  entrepreneurship/  banking/  ...
└── us/
    ├── _country.md                # perfil: USD, IRS, sales tax estatal, etc.
    └── taxes/{sales-tax,income-tax,...}/<slug>.{es,en}.md
```

**Reglas del gate:**
- `country ∈ {mx, us, shared}`. `shared/` es la **única** vía de fuga → auditarla agresivamente.
  En la duda, NO es shared: se duplica en `mx/` y `us/`.
- Un tema = dos archivos (`.es.md` + `.en.md`), mismo `doc_id` stem, ligados por traducción.
- `age_band` y `depth_tier` son **frontmatter, no carpetas**. Un doc lleva secciones por tier
  adentro (ver §7), no 5 archivos casi-duplicados.

### Frontmatter (cada doc; el gate rechaza si falta una clave requerida)

```yaml
---
doc_id: mx-taxes-iva-iva-basics          # estable, == path sin lang ni ext
title_es: "El IVA en México"
title_en: "VAT (IVA) in Mexico"
language: es                              # es | en (uno por archivo)
translation_of: null                     # el .en fija el doc_id del .es; el .es = null
country: mx                              # mx | us | shared   ← LLAVE DE FILTRO DURO
jurisdiction: "MX-FED"                    # MX-FED | US-FED | US-CA | US-TX | NONE
domain: taxes                            # vocab cerrado (taxonomy.yaml)
subdomain: iva                           # vocab cerrado por dominio
concept_ids: [tax.consumption.vat]       # ← reusa concept_taxonomy.json
age_bands: [tier3, tier4, tier5]         # qué tiers sirve este doc (multi)
depth_tier: intermediate                 # intro | intermediate | advanced
volatility: high                         # static | low | medium | high  ← cadencia
last_verified_date: 2026-06-19           # la fecha "as of"
verified_by: jesusv
review_due: 2026-09-19                   # computado de volatility_policy
sources: [src_sat_iva_2026]              # ids → _meta/sources.yaml
status: published                        # draft | review | published | stale
currency: MXN                            # MXN | USD | null
schema_version: kb-1.0
---
## For future Claude
Este es un doc de impuestos sobre el IVA en MX, verificado 2026-06-19, jurisdicción federal.
[caveat de vigencia si aplica]
```

### Los 5 tiers de edad (reusan `abstraction_ceiling.json`)

| Tier | Edad | Piaget | Techo (gate DURO) |
|------|------|--------|-------------------|
| tier1 | 5-7 | preoperacional | sin %, interés, ratios, fórmulas. Prohibidas: *porcentaje, interés, inversión, deuda, activo, pasivo* |
| tier2 | 8-10 | concreto temprano | sin %, interés compuesto. Prohibidas: *crédito, inflación, portafolio, hipoteca* |
| tier3 | 11-13 | concreto tardío | %, interés simple, decimales. Banca/inversión/impuestos **arrancan aquí** |
| tier4 | 14-17 | formal temprano | ratios, proporción, fórmulas |
| tier5 | 18+ | formal adulto | sin techo. Impuestos plenos, crédito, nómina, instituciones MX/US, startups/VC |

> Exceder el techo de una banda es **HARD-FAIL** (validez, no dificultad). Cada chunk se etiqueta con
> el tier mínimo permitido. El cerebro comparte `concept_taxonomy.json` + `abstraction_ceiling.json`
> con el Lesson Factory: una lección sobre `tax.consumption.vat` recupera exactamente esos docs.

---

## 3. Chunking + firewall anti-fuga

- **Chunking por estructura, no por ancho fijo.** Cortar en encabezados markdown (`##`/`###`), un
  chunk por sección hoja. Objetivo 300-600 tokens, tope ~800. (Un sliding window separaría una tasa
  de su condición — inaceptable en finanzas/fiscal.)
- **Nunca fusionar chunks entre documentos** (luego, nunca entre países).
- **Metadata denormalizada en CADA chunk** (el firewall): `country, jurisdiction, language, domain,
  subdomain, concept_ids[], age_band, depth_tier, volatility, last_verified_date, review_due,
  source_ids[], heading_path, text`.
- **Pre-filtro obligatorio:** `retrieve(query, *, country, language, ...)` — sin default. Se aplica
  `WHERE country IN (target,'shared') AND language=target` **antes** de la búsqueda vectorial.
  Post-filtrado (recuperar-y-descartar) **prohibido**.

---

## 4. Frescura / provenance / volatilidad

- `last_verified_date` es el "as of" canónico; se propaga a cada chunk y **se muestra en respuestas
  del chatbot** ("Según datos verificados al 19 jun 2026…").
- Hechos volátiles inline con sentinel greppeable (invisible en Obsidian):
  ```markdown
  La tasa general del IVA es **16%**. <!-- @fact id=mx.iva.rate value=16% verified=2026-06-19 src=src_sat_iva_2026 volatility=high -->
  ```
- Fuentes referenciadas por id en `_meta/sources.yaml`. **Gate:** todo doc `volatility ∈ {medium,high}`
  cita ≥1 fuente `tier: primary`.
- **Política de cadencias** (`_meta/volatility_policy.yaml`): `review_due = last_verified_date + cadencia`.

  | Volatilidad | Cadencia | Ejemplos |
  |-------------|----------|----------|
  | `static` | nunca | matemática del interés compuesto |
  | `low` | 2 años | principios contables, definiciones |
  | `medium` | 1 año | conceptos económicos, nombres de programas |
  | `high` | 3 meses | **tasas/brackets, UMA, salario mínimo, límites de aporte, topes de seguro** |

- Un cron lista docs con `review_due < hoy`, marca `status: stale`, y el retriever los **degrada o
  rehúsa** en modo chatbot. Cron, no servicio (respeta "sin servicios frágiles").

---

## 5. Recuperación (dos consumidores, un retriever)

Orden exacto:
1. **Pre-filtro duro** (obligatorio): `country IN (target,'shared') AND language=target`.
2. **Filtros opcionales:** `domain`, `subdomain`, `concept_ids`, `status != 'stale'` (modo chatbot).
3. **Scoring híbrido** sobre los sobrevivientes: vectorial denso + BM25 fusionados con **RRF (k≈60)**.
   (BM25 importa: "IVA", "401(k)", "ISR", "Roth", "UMA" son tokens exactos que el embedding difumina.)
4. **Tier como señal de ranking, NO filtro:** boost a chunks cuyo `age_band` contiene el tier objetivo;
   penalización suave a los que exceden el techo de abstracción.
5. **Siempre devolver provenance** (`source_ids` + `last_verified_date`). El chatbot rehúsa/matiza si
   los chunks top son `stale` + `high`.

| Consumidor | Pasa | Enfatiza |
|-----------|------|----------|
| Generador de lecciones | `concept_ids` + `age_band` | grounding factual; ignora staleness con cortesía |
| Chatbot (futuro) | `country` + `language` de sesión | `status != stale`; cita siempre |

---

## 6. Eval / gates (espejo del `eval/` existente)

Tres suites en `knowledge/eval/`, todas hard-fail en CI:

- **A. Golden Q&A** (60-100 pares verificados, balanceados país × dominio × tier). Falla si la respuesta
  no contiene `expected_fact` o si el set recuperado no incluye `must_cite`.
- **B. Fuga de jurisdicción** (la suite crítica): consultas adversarias diseñadas para jalar el país
  equivocado. `assert all(c.country in (target,'shared') for c in retrieved)`. **Cualquier chunk `mx`
  en un resultado `us` rompe el build.**
- **C. Frescura:** inyectar doc `review_due < hoy` + `high` → el chatbot debe rehusar/marcar, no afirmar.
  Lint estático: todo `high` cita un `primary`; ningún `last_verified_date` futuro o vencido.

> **La suite B debe estar verde antes de escalar contenido.** (Pilar #2 de V2_STRATEGY.)

---

## 7. Dual-uso: RAG-ingestible Y navegable en Obsidian

- **Frontmatter YAML** = Obsidian Properties **y** metadata de chunk. Una sola fuente.
- **`[[wikilinks]]`** = grafo de navegación humana **y** señal de relación opcional para retrieval.
- **MOC** (`README.md`, `_country.md`) = índices curados **y** buenos chunks de alto nivel.
- **Secciones por tier dentro de un doc** (el chunker las separa):
  ```markdown
  ## Para niños (tier1-2)        <!-- age_band: tier1,tier2 -->
  Un impuesto es como compartir una parte de tus dulces...

  ## Para jóvenes (tier3-4)      <!-- age_band: tier3,tier4 -->
  El IVA es un impuesto al consumo del 16%...

  ## Avanzado (tier5)            <!-- age_band: tier5 -->
  El IVA es un impuesto indirecto, no acumulativo...
  ```
  El humano lee de arriba a abajo (andamiado); el chunker emite 3 chunks tier-etiquetados.
- **Markdown = fuente de verdad** para humanos y máquinas. Se gitignorea `.db`, `.venv`, `__pycache__`;
  se commitea markdown + `_meta/` + builders.

---

## 8. Pipeline de construcción (resumible, idempotente, con gate)

| Fase | Qué | Entregable |
|------|-----|------------|
| **0 — Contrato** | `_meta/` (taxonomy, sources, volatility_policy, schema.json) + gate de frontmatter | El contrato congelado, *antes de contenido* |
| **1 — Descubrimiento** | Por `(país, dominio, tier)`: sembrar fuentes `.gov` autoritativas en NotebookLM + `add-research --deep`; `fulltext`/`ask --json` como evidencia | Notebooks sembrados + evidencia citada |
| **2 — Autoría** | El agente **redacta explicaciones propias citadas** (no pega fuente), con `@fact` + provenance | Docs `.es.md` + `.en.md` |
| **3 — Gate + Eval** | Validar frontmatter, citas, **suite de fuga** | Corpus verde |
| **4 — Índice** | `build_index.py` → SQLite-vec + FTS5 (regenerable, gitignoreado) | RAG consultable |

**Manejo de fragilidad de NotebookLM:** pipeline **checkpointed e idempotente** (cada `(país,dominio,tier)`
es una unidad reanudable); `auth refresh` en cron; `--retry`/timeout en cada llamada; degradación
elegante (si un notebook falla, log y continúa). El corpus es el checkpoint durable.

---

## 9. Cobertura de dominios (12) y diferenciación MX vs US

El recon ya produjo **taxonomías completas, listas de fuentes `.gov` y mapas de volatilidad con valores
verificados a 2026-06-19** para ambos países (ver Apéndices A-C). Los 12 dominios, organizados por
**dominio × tier** (no plano):

`finanzas personales · consumo · emprendimiento · admin de empresas · marketing/ventas · contabilidad ·
banca/fintech · impuestos · economía · inversión · gestión de riesgo · seguridad financiera`

**Gradiente de profundidad más pronunciado** (= más carga factual/regulatoria): emprendimiento,
inversión, finanzas personales, impuestos, economía. La carga de grounding factual se concentra en
**tiers 3-6, dominios 8-12**, sobre todo hechos regulatorios MX/US fechados.

**Falsos amigos blindados** (el RAG nunca los cruza — ver Apéndices):

| MX | US |
|----|----|
| SAT · RFC/CURP · CFDI 4.0 · IVA 16% · RESICO · AFORE/SAR · CAT · IPAB (400k UDIS) · CLABE · SPEI/CoDi/DiMo · NIF · CNBV · IMSS · UMA · salario mínimo dual (ZLFN) | IRS · EIN/SSN · 1099/W-2 · sales tax estatal · S-corp/LLC/C-corp · 401(k)/IRA · APR · FDIC ($250k) · routing# · ACH/Zelle · GAAP · SEC · SSA · federal min wage + estatal |

---

## 10. Mover Lesson Factory: `backend/lesson_factory/` → `littlefounders_brain/`

Checklist ordenado (cada punto verificado en el recon de impacto):

1. `git mv backend/lesson_factory littlefounders_brain` (raíz).
2. Corregir profundidad `.parent`: `schema/gen_frontend_types.py` (3→2 `.parent`) y `schema/lesson_v2.py`
   (`CORPUS_DIR`).
3. Repuntar lecturas cross-dir a `backend/`: `audio_factory/.env` (generate_v2.py L64),
   `lesson_engine/littlefounders_lessons` (generate.py L40, validate.py L25, lesson_v2.py L35).
4. CI `lesson-factory-ci.yml`: 2× globs de `paths`, `working-directory`, strings de error, y la
   profundidad `../../frontend` → `../frontend` (L43/45).
5. Actualizar strings de comentario en `gen_frontend_types.py` L40-41 y re-ejecutar; verificar que el
   diff del `.ts` sea solo el header.
6. **Recrear `.venv`** (no moverlo — shebangs absolutos): `rm -rf .venv && python3.11 -m venv .venv &&
   ./.venv/bin/pip install "pydantic>=2" "notebooklm-py[browser]"`. Actualizar paths in-folder en
   `skills/notebooklm-py/SKILL.md`.
7. Regenerar `repo_map.md`; actualizar `BACKEND_GUIDE.md` y `eval/golden_set_v1*.json`.
8. Correr localmente `gate.py`, `check_taxonomy.py`, `lesson_v2.py --validate-corpus`,
   `gen_frontend_types.py` → verde antes de push.

> No es importado como módulo por el FastAPI app (`grep` vacío), así que ningún `import` de la app
> se rompe. El movimiento es seguro con este checklist.

---

## 11. Orden de construcción / próximos pasos

1. **Fase 0 (contrato)** + gate de frontmatter — antes de cualquier contenido.
2. **Piloto:** dominio `impuestos` × `{mx, us}` × 5 tiers, ES+EN, totalmente citado → probar el pipeline.
3. `build_index.py` + retriever con args obligatorios `country`/`language`.
4. `knowledge/eval/` 3 suites en CI; **suite de fuga verde antes de escalar**.
5. Escalar dominio por dominio hasta >10 MB; grounding NotebookLM alimenta la verificación de `@fact`.
6. (Separado) Ejecutar el movimiento de carpeta §10.

---

## Apéndice A — Fuentes autoritativas MX (semillas NotebookLM)

**Tier 1 (gobierno/reguladores):** SAT `sat.gob.mx` · Banxico `banxico.org.mx` · CONDUSEF
`condusef.gob.mx` · CNBV `gob.mx/cnbv` · IPAB `ipab.org.mx` · CONSAR `gob.mx/consar` · IMSS
`imss.gob.mx` · INFONAVIT `infonavit.org.mx` · INEGI `inegi.org.mx` (INPC, UMA, PIB) · Secretaría de
Economía / Tu Empresa `gob.mx/tuempresa`, `sas.economia.gob.mx` · CONASAMI `gob.mx/conasami` · CINIF
`cinif.org.mx` (NIF) · IMPI `gob.mx/impi` · CNSF `gob.mx/cnsf` · DOF `dof.gob.mx` · Cámara de
Diputados `diputados.gob.mx/LeyesBiblio/` (LISR, LIVA, CFF, LFT) · cetesdirecto `cetesdirecto.com`.
**Tier 2 (profesional):** IMCP `imcp.org.mx` · ABM `abm.org.mx` · Buró de Crédito
`burodecredito.com.mx` · Círculo de Crédito `circulodecredito.com.mx`.

## Apéndice B — Fuentes autoritativas US (semillas NotebookLM)

**Impuestos:** IRS `irs.gov` (+ páginas OBBBA 2026, self-employment, forms, EIN, business structures).
**Emprendimiento:** SBA `sba.gov` (choose-business-structure, business-guide) · USPTO `uspto.gov`.
**Finanzas personales:** CFPB `consumerfinance.gov` · FDIC `fdic.gov` · NCUA `ncua.gov` ·
`annualcreditreport.com` · MyMoney `mymoney.gov` · SSA `ssa.gov`.
**Inversión:** Investor.gov `investor.gov` · SEC `sec.gov` · FINRA `finra.org` · SIPC `sipc.org`.
**Economía:** Federal Reserve `federalreserve.gov` · BLS `bls.gov/cpi` · DOL `dol.gov` (min wage
federal + estatal) · Treasury `home.treasury.gov` · BEA `bea.gov`.
**Contabilidad:** FASB `fasb.org` (GAAP) · AICPA `aicpa-cima.com`. **General:** `usa.gov`.

## Apéndice C — Mapa de volatilidad (snapshot 2026-06-19; ver `_meta/volatility_policy.yaml` para vigente)

**MX (re-verificar):** UMA diario **$117.31** (anual) · salario mínimo gral **$315.04/día** / ZLFN
**$440.87/día** (anual, CONASAMI) · RESICO PF límite **$3.5M**, tasa 1-2.5% / PM **$35M** · ISR PM **30%** ·
IVA **16%** gral, **8%** frontera (**decreto expira 31-dic-2026** — alta vigilancia) · CFDI **4.0** /
Carta Porte **3.1** · Anexo 24 **v1.3** (RMF 2026) · NIF **2026** · semanas cotizadas **875** (rampa a
1,000 en 2031) · Banxico tasa objetivo **6.50%** · IPAB **400,000 UDIS** (≈$3.4M MXN).

**US (re-verificar; casi todo trazable a OBBBA, firmada 4-jul-2025):** brackets federales 2026 (7 tramos,
single 10%≤$12,400 … 37%>$640,600) · deducción estándar single **$16,100** / MFJ **$32,200** · 401(k)
**$24,500** (catch-up $8,000) · IRA **$7,500** · tope FICA SS **$184,500** · SE tax **15.3%** · min wage
federal **$7.25** (sin cambio desde 2009) · fed funds **3.50-3.75%** (FOMC 17-jun-2026) · CPI anual **4.2%**
(core 2.9%) · FDIC **$250,000** · CTC **$2,200**/hijo · 1099-K umbral **$20,000 + 200 tx** · 1099-NEC/MISC
umbral **$2,000** (desde 2026) · deducción tips/overtime temporal **2025-2028**.

---

> **Activos reusados del Lesson Factory:** `concept_taxonomy.json`, `abstraction_ceiling.json`,
> `pedagogy_rules.json` (vocab prohibido por banda), patrón de `eval/` (golden + judge), provenance de
> V2_STRATEGY. **Skills relevantes:** `obsidian-second-brain` (esquema/navegabilidad),
> `notebooklm-py` (grounding), `knowledge-nexus` (mecánica de chunking), `lightrag` (en repisa).
