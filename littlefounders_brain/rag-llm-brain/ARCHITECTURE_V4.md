# ARCHITECTURE_V4.md — El "Arca de Conocimiento" (RAG-to-write · verificación atómica · doble pista)

> **Estado:** IMPLEMENTADO Y ENDURECIDO (núcleo v4 + hardening v4.1, 2026-06-22). Sucede a
> [`PIPELINE.md`](PIPELINE.md)/[`ARCHITECTURE_V3.md`](ARCHITECTURE_V3.md) donde difiera. Las piezas marcadas
> ✅ están implementadas y probadas a **$0 de API** (smoke determinista, 15/15 invariantes). El **núcleo
> anti-lavado** (RAG-to-write §2.3, verificación atómica integrada §2.2, gobernanza de costo §2.5) **YA
> está construido y cableado** en `build_dataset.py`/`preflight.py` — antes este doc lo marcaba ⏳ por error.
> Lo que sigue ⏳ es la **doble pista practitioner (D2, §2.4)** y los items de ESCALA (re-ingesta de
> evidencia por jurisdicción, CI del índice fastembed). El hardening v4.1 (robustez de la corrida pagada)
> está en **§7**. La validación factscore en datos REALES sigue pendiente de la **Fase 1** (`RUNBOOK_V4.md`).

---

## 0. La meta (north star)

Un **arca de conocimiento**: preservar el dominio COMPLETO de finanzas / economía / contabilidad /
administración / emprendimiento / bolsa / crypto / metales / regulación, con fidelidad suficiente para
llevar a una persona **de cero a nivel practicante** (banquero / corredor / empresario), vía RAG, y
**replicable** a otros dominios del conocimiento.

Esto sube el listón respecto a v3 (educación financiera 5-18, MX/US). Tres decisiones fijadas (2026-06-22):

| # | Decisión | Implicación arquitectónica |
|---|----------|----------------------------|
| **D1** | **Verdad = RAG-para-escribir + verificación atómica** | El autor NO escribe de memoria: redacta desde evidencia REAL recuperada, y cada afirmación atómica se verifica contra esa evidencia (estilo FActScore) antes de aceptarse. Mata el "lavado de conocimiento del modelo". |
| **D2** | **Profundidad = doble pista 5-18 → practitioner** | El concept_map y el contrato de autoría crecen con tiers profesionales (mercados, valuación, derivados, regulación, nivel CFA/Series-7), manteniendo los tiers infantiles. |
| **D3** | **Replicabilidad = endurecer finanzas primero, generalizar después** | Diseñar con costuras limpias (paquete-de-dominio), pero NO abstraer prematuramente: validar sobre finanzas, luego extraer el framework genérico. |

> **Principio rector (sin cambios):** un número equivocado NO puede entrar al corpus, y una afirmación
> sin respaldo en evidencia tampoco. La verificación es por-afirmación y determinista/auditada, no
> "un LLM aprueba a otro LLM".

---

## 1. Qué cambia respecto a v3.1 (el delta)

v3.1 era sólido en mecánica (STOP por cobertura real, draft funcional, firewall) pero la auditoría
adversarial (ver evaluación 2026-06-21) encontró que las **garantías estrella cubrían <20% del contenido**:

- El ancla determinista (`facts.yaml`) solo se comparaba para los @fact cuyo id estuviera en la tabla →
  **9 de 53 ids** del corpus. El autor inventaba ids off-table (`irs.2025.std_deduction.single=$14,600`,
  rancio) y pasaban gate + juez.
- El **juez único saturaba**: dio `factual_accuracy 5/5` a un doc con cifras de 2024.
- El autor escribía **de memoria** ("búscalo en la web" era opcional), con evidencia inyectada como blob
  por-dominio, no recuperada por-tema → **conocimiento paramétrico lavado a markdown**.
- El embedder de producción configurado (`bge-m3`) **no existía en fastembed** → habría reventado.

v4 ataca exactamente eso:

```
v3.1:  PLANNER → AUTOR(memoria + canon + blob evidencia + search?) → GATE(id opt-in) → JUEZ único(5/5) → review
v4:    PLANNER(doble pista) → AUTOR(RAG-to-write: evidencia recuperada POR-TEMA, escribe SOLO de ahí)
        → GATE(id-discipline: off-table = visible/HARD) → VERIFICADOR ATÓMICO(NLI por-afirmación vs evidencia)
        → JUEZ(pedagogía/coherencia/jurisdicción, ya no es el único garante factual) → review/draft
```

---

## 2. Componentes (estado)

### 2.1 Endurecimiento del cimiento — ✅ hecho y probado ($0) esta sesión
| Pieza | Qué | Archivo |
|-------|-----|---------|
| ✅ **Anti-escape de ids** | el gate detecta @fact OFF-TABLE; si DUPLICA exacto una cantidad canónica de la misma jurisdicción con otro id → **HARD-FAIL**; el resto → advisory visible. Reporta ratio `anclados/total`. Flag `--strict-facts` = todo volátil off-table es HARD. | `tools/gate_kb.py` |
| ✅ **`values_match` unit-aware** | `"16%"` ya no iguala a `"16"` (conteo) ni `"$16"` — cierra el falso-positivo unit-blind. | `tools/facts_table.py` |
| ✅ **Cobertura solo cuenta verificados** | `map_coverage` excluye drafts → el STOP-por-cobertura no se satisface con docs no verificados. | `tools/build_dataset.py` |
| ✅ **Embedder real validado** | `bge-m3` NO existe en fastembed 0.8.0 → cambiado a `paraphrase-multilingual-mpnet-base-v2` (768d) verificado; fallback MiniLM (384d). Índice de producción semántico construido (ya no `hash`). | `_meta/build_policy.yaml`, `tools/kb_common.py` |
| ✅ **Purga de andamiaje en el índice** | las secciones `## For future Claude` (en los 40 docs) rankeaban como hit #1 del retrieval → excluidas del chunking. | `tools/kb_common.py` |

### 2.2 Verificación atómica (D1, núcleo anti-lavado) — ✅ construida · ✅ INTEGRADA al loop
`tools/atomic_verify.py`: descompone un doc en afirmaciones atómicas y verifica cada una contra
la EVIDENCIA real. Dos modos:
- **embed ($0):** similitud coseno (mpnet) afirmación↔evidencia. PROXY barato para escanear el corpus.
- **llm (autoritativo):** NLI/entailment en 3 vías (`supported|contradicted|unverifiable`, + `illustrative`
  para ejemplos trabajados) con el **verificador** (`models.verifier`). FACTSCORE = soportadas / verificables.

✅ **Integración (HECHA):** etapa en `build_topic` (`build_dataset.py`, tras el juez): se evalúa el **cuerpo
ENSAMBLADO** (con los `@fact` sustituidos, = la prosa servida) vía `score_text(..., client=_verifier_client())`
→ su gasto se **contabiliza en el presupuesto**. **Calibración v4.1:** el ÚNICO disparo DURO por defecto es
`contradicted>0` (señal fiable); `factscore` bloquea sólo con `checkable ≥ min_checkable_for_factscore`, y la
tasa de no-verificables (que EXCLUYE los `illustrative`) es **advisory** (`atomic_unverifiable_blocking:false`)
hasta calibrar con datos v4 reales — así el gate NO degrada TODO el corpus a draft antes de medir. El juez GLM
deja de ser el único garante factual (pasa a pedagogía/coherencia/jurisdicción).

### 2.3 RAG-para-escribir (D1) — ✅ construido (`evidence_rag.py`, cableado en `build_topic`)
El autor recibe **evidencia recuperada POR-TEMA** (top-k pasajes vía `retrieve_for_topic`, ranking léxico
TF-IDF con **firewall de jurisdicción sobre el insumo**), no el blob por-dominio, y se le instruye: *"escribe
SOLO afirmaciones respaldadas por esta evidencia; un verificador atómico la chequeará afirmación-por-afirmación"*.
La evidencia recuperada es el grounding; la web llena huecos. Esto da al verificador atómico contra-qué-medir.
**Límite honesto:** sobre evidencia top-k LÉXICA, una paráfrasis pedagógica fiel sale `unverifiable` aunque sea
correcta (no está *entailed* en esos k pasajes) → por eso la tasa de no-verificables es advisory (§2.2) hasta
que la Fase 1 mida `factscore` en datos reales.

### 2.4 Doble pista de profundidad (D2) — ⏳ por construir
- `taxonomy.yaml`: añadir tiers practitioner (`tier6_practitioner`, `tier7_professional`) con su techo de
  vocabulario INVERTIDO (aquí SÍ se exige rigor técnico: fórmulas, regulación citada, mecánica de mercado).
- `concept_map.yaml`: por celda, además de los conceptos 5-18, los conceptos de nivel profesional
  (p.ej. `us/investing/derivatives`: griegas, valuación Black-Scholes, márgenes, settlement, regulación).
- contrato de autoría: una sección practitioner por doc cuando el tema lo amerite, con su propia rúbrica.

### 2.5 Gobernanza de costo — ✅ construida (`cost_projection.py` + guard en `--run`)
`cost_projection.py` proyecta **costo/doc observado × temas restantes** vs los caps por proveedor.
**v4.1:** el guard real vive donde importa: `build_dataset.py --run` (corrida MASIVA, sin `--max-docs`)
**REHÚSA arrancar** si algún cap no cubre la proyección completa (`--i-accept-underbudget` lo permite con
corte limpio reanudable). El smoke de Fase 1 (`--only`/`--max-docs`) NO pasa por el guard. Convierte
"GO-para-arrancar" en "GO-para-TERMINAR". (En `preflight.py` la proyección es advisory; el bloqueo duro es
el guard de `--run`.) El verificador atómico ahora **cuenta** en el presupuesto (antes su gasto GLM era invisible).

### 2.6 Anti-redundancia a escala — parcial
`semdedup.py` (cross-cell) ⏳ correr antes de servir · `decontaminate.py` (advisory en CI, BLOQUEANTE
pre-serve) · **tautología del test de fuga ✅ ARREGLADA** (`run_kb_eval.py:suite_leakage` es able-to-fail:
exige que exista contenido opuesto fugable, marca INCONCLUSO si no hay nada que suprimir).

---

## 3. Definición de "HECHO" (acceptance gates antes de servir)

Un corpus es **servible** solo si TODO lo siguiente es verde (medible, no opinión):

1. **Gate determinista** 0 HARD-FAIL, **incluyendo disciplina de ids**: ≥ `min_anchored_ratio` (objetivo
   ≥ 90%) de los @fact volátiles usan id canónico (`--strict-facts`).
2. **FACTSCORE atómico (LLM-NLI)** ≥ `min_factscore` por doc; los que no, quedan en `draft`.
3. **Índice semántico** construido con fastembed (rechaza `hash`); **firewall eval able-to-fail** y verde;
   **decontaminación** bloqueante y limpia; **semdedup** corrido (dup cross-cell < objetivo).
4. **Cobertura** del concept_map medida SOLO sobre docs verificados (review/published).
5. **Proyección de presupuesto** pasa (la corrida puede TERMINAR la cobertura objetivo).
6. **Nada se auto-publica:** `review`/`draft`; un SME promueve a `published` (con triaje por `grounding_tier`).

---

## 4. Protocolo PRE-GASTO (lo que pediste: sólido a la primera, antes de saldos grandes)

```
FASE 0 — $0 (esta sesión, mayormente ✅):
  gate endurecido · atomic_verify embed-scan (baseline) · índice semántico real · smoke retrieval+firewall
  · preflight de costo ⏳
FASE 1 — SMOKE PAGADO MÍNIMO (~$5-15 de saldos existentes, NO recargar):
  generar 1 celda (2-4 docs) con el loop v4 COMPLETO (RAG-to-write + verificación atómica LLM).
  MEDIR: $/doc real · distribución de factscore · varianza del juez · near-dup. → go/no-go + fija los caps.
FASE 2 — BREADTH-PASS-1 (recargar a la proyección validada):
  cap=2 sobre todas las celdas; re-medir; luego pasadas profundas.
```

**Regla:** no se recarga saldo grande hasta que la FASE 1 valide $/doc, factscore y varianza del juez.

---

## 5. Replicabilidad (D3 — diseñar las costuras, generalizar después)

El "paquete de dominio" YA es casi todo config en `_meta/` + prompts. Para clonar a otra área del
conocimiento, lo que cambia es:
- `_meta/taxonomy.yaml` (dominios/subdominios/age_bands), `_meta/facts.yaml` (cifras canónicas del dominio),
  `_meta/sources.yaml` (fuentes), `_meta/concept_map.yaml` (espinazo), y los prompts de planner/autor.
Lo que NO cambia (el motor): gate, atomic_verify, build_dataset, build_index/retriever, dedup/decontam, eval.

⏳ La generalización formal (un `--domain <pkg>` que apunte a otra carpeta `_meta/`) es un refactor
posterior, una vez que finanzas valide el motor. Por eso D3 = "primero finanzas, luego extraer".

---

## 6. Validación de esta sesión (smoke — 2026-06-22)

**A. Persistencia / "se guarda la información" — ✅ PASS.** 40 docs → 98 chunks → SQLite (chunks +
FTS5 + meta + embeddings float32) con embedder SEMÁNTICO real (mpnet 768d, ya no `hash`). Round-trip
write→read→index→retrieve sin pérdida. Firewall de jurisdicción aguanta **3/3** con embeddings reales,
incluida la consulta-trampa US/EN "IVA value added tax rate" → `✅ sin fuga`. Semántica funciona
(recuperó docs de ahorro para "emergency fund" sin keywords exactas).

**B. Gate endurecido — ✅ atrapa el escape de ids.** `irs.2025.std_deduction.single='$14,600'` →
**HARD-FAIL** vs canónico `us.std_deduction.single='16,100 USD'`. Ratio de anclaje del corpus:
**32/178 @fact (17%)** — el 83% off-table ahora VISIBLE (antes silencioso). Tests 11/11.

**C. Verificación atómica (el experimento clave) — diagnóstico cuantificado:**

| Evaluador | Doc de ahorros (autónomo, problemático) |
|-----------|------------------------------------------|
| Juez holístico v3 (GLM) | `factual_accuracy 5/5` ✅ (sello de goma) |
| Proxy embed ($0, umbral 0.50–0.60) | `1.00` (mide TEMA, no VALOR → satura ALTO) |
| LLM-NLI 3-vías v4 (GLM independiente) | **0 supported · 0 contradicted · 7/7 UNVERIFIABLE** |

Contraste con un doc CURADO (income-tax): idéntico patrón — **0 contradicted, 10/10 unverifiable**.

**Veredicto del smoke (honesto):** el corpus actual NO está equivocado (0 contradicciones contra
evidencia) pero está **100% NO-FUNDAMENTADO** — ninguna afirmación de prosa se rastrea a la evidencia
que el sistema tiene. Es la huella del "lavado de conocimiento", ahora MEDIDA. Y confirma la tesis de
v4: **verificación atómica y RAG-to-write son dos mitades de un mismo mecanismo** — un verificador atómico
sobre prosa escrita-de-memoria contra un blob de evidencia genérico da unverifiable≈100% por construcción.
La verificación atómica solo cobra sentido cuando el autor escribe DESDE evidencia recuperada por-tema.

**Hallazgos colaterales atrapados a $0 (antes de gastar):** (1) `bge-m3` no existe en fastembed →
habría reventado la 1ª corrida; (2) disco a ~1GB → bloqueaba el embedder; (3) secciones `## For future
Claude` rankeaban como hit #1 del retrieval (purgadas del índice); (4) cache de modelo corrupto por el
disco lleno (limpiado). Cuatro fallas de "primera ejecución real" cazadas sin tocar las APIs de pago.

**Criterio sobre "¿se guardará toda la información exitosamente?":** la CAPA DE PERSISTENCIA es sólida
(✅ guarda, indexa y recupera sin pérdida, con firewall). La CAPA DE FIDELIDAD todavía no: hoy el
contenido no es verificable contra evidencia. El siguiente paso (FASE 1, §4) es MEDIR factscore sobre docs
nuevos del loop v4 — recién ahí la "información guardada" será además *fundamentada y verificada*, no solo
*persistida*. (RAG-to-write + verificación atómica ya están construidos e integrados; ver §2.2/§2.3.)

---

## 7. Hardening v4.1 — robustez de la corrida PAGADA (2026-06-22)

Auditoría adversarial multi-agente (6 dimensiones, 47 hallazgos confirmados) → se cerraron las fallas que
amenazaban una corrida masiva "sin fallas y útil". Todo probado a **$0** (15/15 invariantes deterministas).

| # | Riesgo cerrado | Cambio | Archivo |
|---|----------------|--------|---------|
| R1 | **Poison-cache:** una respuesta JSON truncada-pero-no-vacía se cacheaba ANTES de validar → se re-servía en cada resume y reventaba el doc PARA SIEMPRE | `json()` valida con `cache_validator`: no cachea ni re-sirve JSON inválido (desaloja el acierto poison) | `llm_qwen.py` |
| R2 | **Una excepción del autor mataba la CELDA entera** (hasta 37 temas) | `q_author` y `score_text` van GUARDADOS en `build_topic` (como el juez): una respuesta mala cuesta SÓLO un doc → draft | `build_dataset.py` |
| R3 | **Gasto GLM del verificador INVISIBLE al presupuesto** (cuello de botella) | verificador con cliente PROPIO (`_verifier_client`) contabilizado en `estimated_cost_by_provider` | `build_dataset.py`, `atomic_verify.py` |
| R4 | **Corrida masiva lanzable BAJO presupuesto** (muere a mitad) | `--run` (sin `--max-docs`) rehúsa si los caps no cubren la proyección completa (`_guard_cost_projection`) | `build_dataset.py` |
| R5 | **Ejemplos ilustrativos (obligatorios) inflaban la tasa de no-verificables** → falsos drafts | `score_text` separa `illustrative`; `unv_rate = unverifiable/(claims−illustrative)`; tasa advisory hasta calibrar | `atomic_verify.py`, `build_dataset.py` |
| R6 | **`factscore` no-op** (checkable colapsaba a 0) + bar única siempre falla | `factscore` bloquea sólo con `checkable ≥ min_checkable`; contradicción = único duro por defecto | `build_dataset.py`, `build_policy.yaml` |
| R7 | **cosine() era producto-punto** sobre embeddings mpnet NO normalizados → retrieval vectorial sesgado | `Embedder.encode` L2-normaliza el branch fastembed | `kb_common.py` |
| R8 | **Crash del gate (torn-read de `sources.yaml`) se confundía con fallo de contenido** → ronda pagada perdida | `run_gate` distingue `gate_crash` y reintenta; el gate lee `sources.yaml` tolerante a torn-read | `build_dataset.py`, `gate_kb.py` |
| R9 | **Dimensión del juez OMITIDA pasaba como OK** (gate por-omisión) | una dim requerida ausente = FALLO (revise), no skip | `build_dataset.py` |
| R10 | **`min_words_per_doc:700` infeasible** (corpus real 444-618) → revise-loops "doc corto" | bajado a 500 (validado vs corpus real) | `build_policy.yaml` |
| R11 | **`models.verifier` era key MUERTA**; verificador == juez (no independiente) | el código HONRA `MODELS['verifier']` (ponlo en otra familia para independencia real) | `build_dataset.py`, `build_policy.yaml` |

**Pendiente (loops siguientes / Fase 1):** doble pista practitioner (D2); `--domain` swap (paquete de dominio
en `_meta/`, hoy hay acoplamiento jurisdiccional en `tools/`); CI que ejercite el índice fastembed real;
re-ingesta de evidencia con disciplina de jurisdicción; calibración de umbrales atómicos con datos v4 reales.
