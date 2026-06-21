# ENCYCLOPEDIA_STRATEGY.md — Cobertura TOTAL (calidad enciclopedia, sin SME bloqueante)

> **Meta:** un cerebro de **cobertura TOTAL** del sector (finanzas/negocios/economía/admin/contaduría/
> fiscal, MX+US, 5-18+), calidad **enciclopedia**, usable en industria — "almacenamiento de conocimiento
> ante catástrofe". SME = auditoría **posterior**, no bloqueante. Basado en un benchmark de cómo lo hacen
> las grandes orgs (Wikidata/FIBO/CFA, Phi/Cosmopedia/Nemotron, data foundries). Complementa
> [`ARCHITECTURE_V3.md`](ARCHITECTURE_V3.md).

---

## 0. El hallazgo que cambia el marco

**Nadie mide "cobertura total" contra un *todo* absoluto.** Wikidata, FIBO, CFA — TODOS miden completitud
**RELATIVA a un esquema cerrado de referencia** (una taxonomía, un body-of-knowledge, los ítems hermanos).
La pregunta "¿ya está todo?" es irresoluble en abstracto, pero **finita y medible** contra un esquema.

→ Nuestro **`concept_map.yaml` es ese oráculo**: ~251 celdas × ~52 temas = **~13 000 temas-objetivo**. Eso
ES "absolutamente todo" para educación financiera MX+US. "Cobertura total" = ese mapa 100% poblado, **no
megabytes**.

**Escala real (corregida):** ~13k temas × ~10 KB (par es/en, ≥700 palabras) ≈ **núcleo enciclopédico de
~25-60 MB** (con multiplicador audiencia×formato, 100-300 MB, pero eso es *profundidad* selectiva, no
amplitud). El tope de diseño de 18 MB **era demasiado bajo** — por eso el STOP ya no es por MB
(`stop_on: coverage`). Referencias de tamaño de dominio: FIBO=2 446 clases (finanzas *profesionales/
regulatorias*), DBpedia=768, CFA=10 topics/~600 LOS, National Standards=6 topics×grados 4/8/12. Educación
5-18+ cae en **~300-600 nodos-concepto** que, multiplicados por audiencia/formato, dan los ~13k docs.

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
| **Cascada determinista = SME en código** | RefinedWeb, Snorkel | El juicio editorial se codifica en gates en cascada. | dedup → firewall → cardinalidad @fact + valor canónico → juez GLM+búsqueda → (falta) Recoin facetas + plurality-voting. |
| **Decontaminación** | FineWeb/Nemotron | El eval no debe solaparse con el corpus (memorización). | n-grama corpus vs `eval/` antes de reportar CONCEPT_RECALL/golden. |

---

## 2. Qué ya tenemos (sólido) vs qué falta

**Ya construido (este es el 70% de la "calidad enciclopedia sin SME"):**
- ✅ Esquema cerrado (taxonomía 251 celdas) + **concept_map** (espinazo ~13k temas) — *el oráculo*.
- ✅ Orquestador genera CONTRA el mapa; breadth-first 2→5→todo-el-mapa; stop por cobertura.
- ✅ **Medición de cobertura** (`coverage_report.py`): GRID_Φ, GRID_μ (celda peor cubierta), madurez por celda, CONCEPT_RECALL de términos clave + menciones cross-jurisdicción.
- ✅ Verdad de base codificada (`facts.yaml` + gate de valor) — ningún número alucinado entra.
- ✅ Cascada determinista parcial: dedup → firewall país/idioma → @fact (≥4 citados, ≥1 primaria, valor canónico) → juez GLM con búsqueda → revise-loop. 3 proveedores independientes.
- ✅ Frescura (`update_facts.py`), resume, presupuesto por proveedor.

**Lo que falta para "cobertura total medible y defendible" (roadmap §3).**

---

## 3. Roadmap priorizado (impacto / esfuerzo)

| # | Mejora | Impacto | Esfuerzo | Estado |
|---|--------|---------|----------|--------|
| 1 | **Terminar el concept_map a 251 celdas** (planner barato) | alto | bajo | 🟡 en curso |
| 2 | **coverage_report.py** (GRID_Φ/μ, madurez, CONCEPT_RECALL) | alto | bajo | ✅ hecho |
| 3 | **Facetas en el esquema de tema** (`facet`/`source_type`/`edge_case`) → Recoin cuantitativo | alto | medio | ⬜ |
| 4 | **Crosswalk curricular** (National Standards 2021 + CONDUSEF/SEP) → valida schema + poda + define qué-edad | alto | medio | ⬜ |
| 5 | **Competency Questions por subdominio** en `eval/` → cobertura FUNCIONAL (recall sobre CQs) | alto | medio | ⬜ |
| 6 | **Seed-mining** del corpus regulatorio (índices de leyes/Pubs = checklist de scope) | alto | medio | ⬜ |
| 7 | **STOP como conjunción medible** (GRID_Φ=100% ∧ GRID_μ≥k ∧ CONCEPT_RECALL=100% ∧ 2 rondas secas/celda ∧ CELL_PROFILE≥k ∧ MinHash dup<1% ∧ eval verde ∧ presupuesto) | alto | medio | ⬜ |
| 8 | **Anti-colapso medido**: MinHash dup<1% + clustering del índice (mode-collapse) | medio | medio | ⬜ |
| 9 | **CHAO1/mark-recapture**: planner (DeepSeek) y juez (GLM) enumeran huecos por separado; el solapamiento estima el universo → cobertura con intervalo | medio | medio | ⬜ |
| 10 | **plurality-voting** del juez sobre ejemplos numéricos + decontaminación n-grama | medio | bajo | ⬜ |
| 11 | **Embedder real** (bge-m3) + sqlite-vec + reranker (para servir el RAG) | medio | medio | ⬜ |

---

## 4. Calidad enciclopedia SIN SME (cómo se sostiene)

El SME humano se vuelve **auditoría posterior** (muestreo estratificado por celda×tier, calibra umbrales,
no genera ni desbloquea) **solo si** el juicio editorial vive en CÓDIGO. La defensa, en orden:

1. **Dedup near-dup** → no relleno. (MinHash<1% = upgrade.)
2. **Firewall jurisdicción** (gate, HARD) → cero fuga.
3. **Verdad de base** (`facts.yaml` + comparación de valor) → cero cifra alucinada. *Extender el patrón a
   conceptos multi-fuente: contradicción entre primarias = edge-case a documentar, no a descartar.*
4. **Recoin de facetas** → rechaza celdas incompletas (faltó "errores comunes", "trámite"…).
5. **Juez GLM con búsqueda + plurality-voting** → verifica hechos no-canónicos y descarta ejemplos triviales.
6. **Invariantes testeadas** (0 huérfanos, paridad @fact ES/EN, techo Piaget) → el gate ES el SME determinista.
7. **Anti-colapso + decontaminación medidos** → la calidad-a-escala no degrada en silencio.

---

## 5. La métrica de éxito (no son MB)

> **HECHO = `concept_map` 251/251 ∧ GRID_Φ = 100% ∧ CONCEPT_RECALL = 100% ∧ cada celda con sus facetas
> ∧ MinHash dup < 1% ∧ eval (golden+fuga+frescura) verde.**

El tamaño (~25-60 MB núcleo) es **consecuencia**, no objetivo. El presupuesto por proveedor (GLM = cuello
de botella) corta donde toque, pero por diseño **breadth-first**: un corte deja **TODO a baseline** (GRID_Φ
alto) antes que algunos temas profundos. Primero ancho (toda la enciclopedia esbozada), luego hondo.
