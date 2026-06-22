# ENCYCLOPEDIA_STRATEGY.md — Cobertura TOTAL (calidad enciclopedia, sin SME bloqueante)

> **🟢 v4 — AUTORIDAD VIGENTE (2026-06-22):** el diseño de principio a fin canónico es ahora
> [`ARCHITECTURE_V4.md`](ARCHITECTURE_V4.md) y la guía operativa de la corrida masiva es
> [`RUNBOOK_V4.md`](RUNBOOK_V4.md). Este documento es **estrategia de cobertura** (metodología) y sigue
> vigente; los diseños v3/v3.1 ([`ARCHITECTURE_V3.md`](ARCHITECTURE_V3.md), [`PIPELINE.md`](PIPELINE.md))
> quedan como **históricos-pero-válidos donde v4 no los supera**. v4 añade: **RAG-to-write por tema**
> (autor escribe desde evidencia recuperada por tema, no de memoria), **verificación atómica de claims**
> (NLI estilo FActScore: supported/contradicted/unverifiable), **disciplina de id en el gate** (un `@fact`
> fuera-de-tabla que duplica una cantidad canónica = HARD-FAIL) y **proyección de costo** que bloquea el GO
> si los caps no terminan la corrida. La cobertura cuenta solo docs **verificados** (no drafts), con índice
> semántico real (mpnet).

> **⚠️ v3.1 — HARDENING (2026-06-21):** referencia canónica del pipeline (histórica) en [`PIPELINE.md`](PIPELINE.md).
> Decisión de diseño CLAVE confirmada por research de parity: para un RAG (no pretraining) NO se multiplica
> el registro/audiencia estilo Cosmopedia (eso fragmenta el embedding e infla el índice) — se mantiene **un
> doc canónico por (país, idioma, tema)** con secciones por edad, la diversidad útil es **cobertura de
> temas + de preguntas** (competency_questions). Calidad nivel-industria = plantilla Investopedia/IRS
> (definición, puntos clave, ejemplo TRABAJADO, fechado, fuentes primarias) + rúbrica ampliada del juez.

> **Meta:** un cerebro de **cobertura TOTAL** del sector (finanzas/negocios/economía/admin/contaduría/
> fiscal, MX+US, 5-18+), calidad **enciclopedia**, usable en industria — "almacenamiento de conocimiento
> ante catástrofe". SME = auditoría **posterior**, no bloqueante. Basado en un benchmark de cómo lo hacen
> las grandes orgs (Wikidata/FIBO/CFA, Phi/Cosmopedia/Nemotron, data foundries). Complementa
> [`ARCHITECTURE_V4.md`](ARCHITECTURE_V4.md) (diseño vigente) y [`ARCHITECTURE_V3.md`](ARCHITECTURE_V3.md) (histórico).

---

## Evaluación crítica del mapa (2026-06-21) — veredicto y correcciones

Evaluación multiagente (auditoría de calidad en 12 celdas + crosswalk vs marcos oficiales + redundancia +
competency questions). **Veredicto: C+ — NO satisfactorio en el estado evaluado; la meta es alcanzable
PERO el mapa NO estaba listo para dirigir generación.** Generar contra él habría fabricado miles de docs
de bajo valor con metadatos no filtrables (rompiendo el pre-filtro DURO). Esto validó posponer la ejecución.

**Fortalezas confirmadas:** cobertura de marco genuina (~90% NS-PFE 2021 US, ~92% CONDUSEF/SEP/SAT-PF MX —
nuestro cerebro es un *superconjunto* del marco mexicano); las celdas que NO tocaron el cap son 4/5
(calidad enciclopédica real); diseño jurisdiccional correcto en celdas de país; `schema.json` estricto.

**Problemas hallados (verificados en disco) y su corrección:**

| Hallazgo (severidad) | Fix aplicado |
|----------------------|--------------|
| `depth_tier` con 54 valores (esquema=3); 11% fuera de enum — rompía filtrado **(alta)** | ✅ `normalize_concept_map.py`: → {intro,intermediate,advanced} |
| `age_bands` con 305 valores (rangos demográficos, "adult"…) — **rompía el pre-filtro DURO** **(alta)** | ✅ normalizado → tier1-5 (4,574 corregidos) |
| `concept_id` 59% no-canónico (códigos opacos, placeholders `missing-*`, colisiones) **(alta)** | ✅ regenerado dotted-determinista `{país.dominio.subdominio.slug}` (100% canónico) |
| Inflado ~2-3× (75 celdas clavadas en cap 60; rellenaba hasta el tope) **(alta)** | ✅ generador: cap 60→35 + parada por SATURACIÓN + prompt anti-relleno |
| Atomización en lista ('Presupuesto para X' ×24) **(media)** | ✅ `collapse_atomization` (−1,848 temas) + regla en el prompt |
| Fuga jurisdiccional en celdas shared (IVA/SAT/401k…) **(media)** | ✅ firewall léxico en shared (−58) + en el generador |
| `errores/FAQ/mitos/tendencias` como temas-doc en 47-65% de celdas **(media)** | ✅ prompt: son SECCIONES dentro del doc, no temas |
| Faltan básicos NS-PFE/CFA: earning_income, time_value_money **(media)** | ✅ añadidos a `taxonomy.yaml` |
| RIF obsoleto (→RESICO) en business_formation; cifras volátiles en títulos **(media)** | ⬜ pendiente (corrección puntual + anclar a facts.yaml) |
| Celdas-puente MX del ENEF (bienestar financiero, defensa CONDUSEF, EACP, trámites SAT-PF) **(baja)** | ⬜ pendiente (enriquecimiento por celda) |

**Resultado de la normalización (cifras congeladas pre-regeneración):** el mapa pasó de ~13k a ~11k temas,
con metadatos 100% en-enum y shared sin fuga. **Tras la regeneración con el generador lean (paso (1) abajo),
el mapa quedó en su forma vigente: `concept_map.yaml` = 257 celdas, 7,950 temas** (el espinazo genuino que
buscaba la metodología). Competency Questions semilla (48 preguntas, 8 celdas) en
`eval/competency_questions.json` (cobertura funcional).

**Lo que falta para "100% útil en industria"** (en orden): (1) ✅ **regenerar el mapa con el generador lean**
(cap 35 + saturación) para bajar de ~11k a un espinazo genuino *—barato, ~$2 DeepSeek—* **(HECHO: 257 celdas,
7,950 temas)**; (2)
correcciones factuales puntuales + anclaje a `facts.yaml`; (3) celdas-puente del ENEF; (4) **ola piloto de
~50-100 conceptos núcleo**, generar y MEDIR densidad/redundancia/fact-accuracy del CONTENIDO real **antes**
de comprometer presupuesto en los miles restantes. La ejecución masiva sigue **pospuesta** hasta validar
esa ola piloto — exactamente la disciplina pedida.

---

## Bake-off de proveedores del planner (2026-06-21) — DeepSeek confirmado

Para elegir el generador del mapa por EVIDENCIA, no por suposición: los 3 proveedores generaron la MISMA
muestra (8 celdas diversas) con el prompt lean + higiene idénticos (`mapgen_bakeoff.py`), luego juez ciego.

**Métricas deterministas (100% fiables, 8/8 celdas):**

| Proveedor | avg temas/celda | suciedad (depth/age) | costo (8 celdas) | latencia/celda |
|-----------|----------------|----------------------|------------------|----------------|
| **deepseek-v4-flash** | 29.9 (saturación natural) | 0/0 | **$0.034** | **84 s** |
| qwen-plus-latest | 28.5 | 0/0 | $0.057 | 100 s |
| glm-4.6 | 35.0 (pegado al cap) | 0/0 | **$0.345 (10×)** | 260 s (3×) |

**Calidad (juez ciego):** de-anonimizado FIABLE solo en 4/8 celdas — **lección metodológica: el juez-LLM
es frágil para de-anonimizar** (la mitad de los agentes alteraron/inventaron los IDs opacos pese a la
instrucción; uno escupió los nombres de proveedor). En el subconjunto fiable + métricas: **DeepSeek 3 wins
(overall 4.75), GLM 1 (4.0, gana en celdas fiscales densas por conceptos genuinos como CUFIN/PTU), Qwen 0
(3.0; redundancia/atomización/micro-nicho).**

**Veredicto: se mantiene DeepSeek V4 como planner** — más barato (10×), más rápido (3×), salida limpia,
saturación natural (no pegado al cap como GLM), y calidad ≥. La exhaustividad marginal de GLM en celdas
densas NO justifica 10× el costo. El bake-off CONFIRMA empíricamente la elección existente (sin cambio de
pipeline). Lección transversal: **liderar con métricas deterministas; el juez-LLM como desempate de calidad,
no como fuente de verdad de identidad.**

---

## 0. El hallazgo que cambia el marco

**Nadie mide "cobertura total" contra un *todo* absoluto.** Wikidata, FIBO, CFA — TODOS miden completitud
**RELATIVA a un esquema cerrado de referencia** (una taxonomía, un body-of-knowledge, los ítems hermanos).
La pregunta "¿ya está todo?" es irresoluble en abstracto, pero **finita y medible** contra un esquema.

→ Nuestro **`concept_map.yaml` es ese oráculo**: **257 celdas × ~31 temas = 7,950 temas-objetivo** (tras la
regeneración lean; las cifras infladas ~13k eran el mapa pre-poda). Eso ES "absolutamente todo" para
educación financiera MX+US. "Cobertura total" = ese mapa 100% poblado, **no megabytes**.

**Escala real (corregida):** ~7,950 temas × ~10 KB (par es/en, ≥700 palabras) ≈ **núcleo enciclopédico de
decenas de MB** (con multiplicador audiencia×formato más, pero eso es *profundidad* selectiva, no
amplitud). El tope de diseño de 18 MB **era demasiado bajo** — por eso el STOP ya no es por MB
(`stop_on: coverage`). Referencias de tamaño de dominio: FIBO=2 446 clases (finanzas *profesionales/
regulatorias*), DBpedia=768, CFA=10 topics/~600 LOS, National Standards=6 topics×grados 4/8/12. Educación
5-18+ cae en **~300-600 nodos-concepto** que, multiplicados por audiencia/formato, dan los **7,950 temas** del mapa vigente.

---

## 1. Qué hacen las grandes empresas (y cómo lo aplicamos)

| Práctica | Quién | Qué es | Cómo la aplicamos |
|----------|-------|--------|-------------------|
| **Esquema cerrado = completeness oracle** | Wikidata, FIBO, KG-completeness | Completitud RELATIVA a un esquema (7 tipos: schema/population/property…). | `taxonomy.yaml` + `concept_map.yaml` ya son el oráculo. Métrica: 0 celdas aplicables vacías. |
| **Recoin** (huecos por hermanos) | Wikidata | Un ítem está incompleto si le faltan propiedades que sus hermanos SÍ tienen → semáforo. | **Facetas por celda** (qué_es, mecánica, ejemplo, errores, trámite, comparativa, cambios): si los hermanos las cubren y esta no = hueco. |
| **Crosswalk a body-of-knowledge** | CFA, National Standards (Jump$tart/CEE) | Marcos curriculares ya derivaron el espacio completo + lo validan por grado. | Mapear nuestras celdas vs **National Standards 2021 (US)** y **CONDUSEF/SEP (MX)**: standard sin celda = hueco; celda sin standard = poda. Sus benchmarks grado-4/8/12 validan nuestra malla age_band×subdominio. |
| **Madurez por nodo** | FIBO (release/provisional/informative) | Completitud gestionada por nodo con estado. | Semáforo **por celda**: rojo=vacía, amarillo=baseline (2), verde=deep (≥8). `require_full_breadth` = cero rojos antes de verdes. |
| **DAG ancho y poco profundo** | DBpedia/Wikidata | 3-4 niveles, amplitud > anidamiento; alcanzable desde raíz. | Validó nuestra taxonomía ancha (rechazo de LightRAG). El gate ya checa alcanzabilidad (0 huérfanos). |
| **Competency Questions** | NeOn (ont. engineering) | La cobertura se prueba por USO: ¿responde las preguntas reales? | CQs por subdominio en `eval/` (derivadas de los Learning Outcomes del crosswalk) → cobertura = recall sobre CQs. |
| **Topic-seed scaling** | Phi (~20k seeds), Cosmopedia (clusters), Nemotron | Expandir un seed-set pequeño a uno exhaustivo, con variación audiencia/formato, sin colapso. | `build_concept_map.py` (enumeración exhaustiva + crítico) **+ seed-mining** del corpus regulatorio (abajo). |
| **Seed-mining del corpus fuente** | Phi/Cosmopedia | Los índices de las leyes/Pubs SON el checklist autoritativo del scope. | NotebookLM/`build_evidence` extrae cada artículo/sección/formato (LISR/LIVA/CFF, RMF, IRS Pub 17/15) como semilla → triangula con el mapa DeepSeek. |
| **Dedup semántica + anti-colapso** | SemDeDup, Cosmopedia (dup<1%) | A escala, la calidad muere por repetición invisible. | `dedup.py` (near-dup ahora); **MinHash + clustering del índice** como upgrade medible. |
| **Cascada determinista = SME en código** | RefinedWeb, Snorkel | El juicio editorial se codifica en gates en cascada. | dedup → firewall → cardinalidad @fact + valor canónico + **disciplina de id (off-table que duplica canónica = HARD-FAIL)** → **verificación atómica NLI estilo FActScore** (`tools/atomic_verify.py`: cada claim de prosa supported/contradicted/unverifiable contra la evidencia; gate `quality_bar.atomic_verify` min_factscore 0.80, max_unverifiable 0.50) → juez GLM+búsqueda → (falta) Recoin facetas + plurality-voting. **v4 cierra el item antes pendiente: la cascada YA contiene un SME factual en código, no solo el juez-LLM.** |
| **Decontaminación** | FineWeb/Nemotron | El eval no debe solaparse con el corpus (memorización). | n-grama corpus vs `eval/` antes de reportar CONCEPT_RECALL/golden. |

---

## 2. Qué ya tenemos (sólido) vs qué falta

**Ya construido (este es el 70% de la "calidad enciclopedia sin SME"):**
- ✅ Esquema cerrado (taxonomía 257 celdas) + **concept_map** (espinazo 7,950 temas) — *el oráculo*.
- ✅ Orquestador genera CONTRA el mapa; breadth-first [2,5,0]→[2,5,13,21,29,37]; stop por cobertura **VERIFICADA** (solo docs verificados, no drafts).
- ✅ **RAG-to-write por tema (v4):** el autor (Qwen) escribe desde evidencia recuperada POR TEMA (`tools/evidence_rag.py`, TF-IDF léxico + firewall jurisdiccional en el insumo), NO de memoria ni de un blob por dominio.
- ✅ **Medición de cobertura** (`coverage_report.py`): GRID_Φ, GRID_μ (celda peor cubierta), madurez por celda, CONCEPT_RECALL de términos clave + menciones cross-jurisdicción. Índice semántico real (mpnet, no hash).
- ✅ Verdad de base codificada (`facts.yaml`, ~67 cifras + gate de valor) — ningún número alucinado entra.
- ✅ **Verificación atómica (v4):** `tools/atomic_verify.py` NLI-verifica cada claim de prosa contra la evidencia (supported/contradicted/unverifiable); el juez GLM ya **no** es el único garante factual.
- ✅ Cascada determinista: dedup → firewall país/idioma → @fact (≥4 citados, ≥1 primaria, valor canónico, **id-discipline**) → verificación atómica → juez GLM con búsqueda → revise-loop. 3 proveedores independientes (planner DeepSeek V4 · autor Qwen-Plus · juez+atomic-verify GLM/z.ai).
- ✅ **Proyección de costo (v4):** `tools/cost_projection.py` cableado en preflight — rechaza GO si los caps por proveedor no alcanzan para terminar la corrida completa (corrida v4 ≈ $964 USD; el cap GLM debe subir de $9 a ~$800).
- ✅ Frescura (`update_facts.py`), resume, presupuesto por proveedor.

**Lo que falta para "cobertura total medible y defendible" (roadmap §3).**

---

## 3. Roadmap priorizado (impacto / esfuerzo)

| # | Mejora | Impacto | Esfuerzo | Estado |
|---|--------|---------|----------|--------|
| 1 | **Terminar el concept_map a 257 celdas** (planner barato) | alto | bajo | ✅ hecho (257 celdas, 7,950 temas) |
| 2 | **coverage_report.py** (GRID_Φ/μ, madurez, CONCEPT_RECALL) | alto | bajo | ✅ hecho |
| 3 | **Facetas en el esquema de tema** (`facet`/`source_type`/`edge_case`) → Recoin cuantitativo | alto | medio | ⬜ |
| 4 | **Crosswalk curricular** (National Standards 2021 + CONDUSEF/SEP) → valida schema + poda + define qué-edad | alto | medio | ⬜ |
| 5 | **Competency Questions por subdominio** en `eval/` → cobertura FUNCIONAL (recall sobre CQs) | alto | medio | ⬜ |
| 6 | **Seed-mining** del corpus regulatorio (índices de leyes/Pubs = checklist de scope) | alto | medio | ⬜ |
| 7 | **STOP como conjunción medible** (GRID_Φ=100% ∧ GRID_μ≥k ∧ CONCEPT_RECALL=100% ∧ 2 rondas secas/celda ∧ CELL_PROFILE≥k ∧ MinHash dup<1% ∧ eval verde ∧ presupuesto) | alto | medio | ⬜ |
| 8 | **Anti-colapso medido**: MinHash dup<1% + clustering del índice (mode-collapse) | medio | medio | ⬜ |
| 9 | **CHAO1/mark-recapture**: planner (DeepSeek) y juez (GLM) enumeran huecos por separado; el solapamiento estima el universo → cobertura con intervalo | medio | medio | ⬜ |
| 10 | **plurality-voting** del juez sobre ejemplos numéricos + decontaminación n-grama | medio | bajo | ⬜ |
| 11 | **Embedder real** (mpnet multilingüe 768d; fallback MiniLM-L12 384d) + sqlite-vec + reranker (para servir el RAG) | medio | medio | ✅ producción |
| 12 | **Verificación atómica NLI estilo FActScore** (`atomic_verify.py`) → SME factual en código, no solo juez-LLM | alto | medio | ✅ v4 |
| 13 | **RAG-to-write por tema** (`evidence_rag.py`) + **proyección de costo** en preflight (`cost_projection.py`) | alto | medio | ✅ v4 |

---

## 4. Calidad enciclopedia SIN SME (cómo se sostiene)

El SME humano se vuelve **auditoría posterior** (muestreo estratificado por celda×tier, calibra umbrales,
no genera ni desbloquea) **solo si** el juicio editorial vive en CÓDIGO. La defensa, en orden:

1. **Dedup near-dup** → no relleno. (MinHash<1% = upgrade.)
2. **Firewall jurisdicción** (gate, HARD) → cero fuga.
3. **Verdad de base** (`facts.yaml` + comparación de valor + **disciplina de id**: off-table que duplica una
   canónica = HARD-FAIL) → cero cifra alucinada. *Extender el patrón a conceptos multi-fuente: contradicción
   entre primarias = edge-case a documentar, no a descartar.*
4. **Verificación atómica NLI estilo FActScore (v4, `atomic_verify.py`)** → cada claim de prosa se contrasta
   con la evidencia (supported/contradicted/unverifiable); **esto realiza el SME factual en código** que
   antes estaba pendiente, y deja de depender solo del juez-LLM.
5. **Recoin de facetas** → rechaza celdas incompletas (faltó "errores comunes", "trámite"…).
6. **Juez GLM con búsqueda + plurality-voting** → verifica hechos no-canónicos y descarta ejemplos triviales.
7. **Invariantes testeadas** (0 huérfanos, paridad @fact ES/EN, techo Piaget) → el gate ES el SME determinista.
8. **Anti-colapso + decontaminación medidos** → la calidad-a-escala no degrada en silencio.

---

## 5. La métrica de éxito (no son MB)

> **HECHO = `concept_map` 257/257 (cobertura VERIFICADA, no drafts) ∧ GRID_Φ = 100% ∧ CONCEPT_RECALL = 100%
> ∧ cada claim atómicamente verificado (factscore ≥ 0.80) ∧ cada celda con sus facetas ∧ MinHash dup < 1%
> ∧ eval (golden+fuga+frescura) verde.**

El tamaño (decenas de MB núcleo) es **consecuencia**, no objetivo. El presupuesto por proveedor (GLM = cuello
de botella) corta donde toque, pero por diseño **breadth-first**: un corte deja **TODO a baseline** (GRID_Φ
alto) antes que algunos temas profundos. Primero ancho (toda la enciclopedia esbozada), luego hondo.
