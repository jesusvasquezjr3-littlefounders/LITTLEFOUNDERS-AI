# RUNBOOK_V4.md — Corrida MASIVA del cerebro (generación completa, con presupuesto)

> **Autoridad operativa.** Esta es la guía CANÓNICA para ejecutar la generación masiva del corpus con el
> pipeline **v4** (RAG-to-write + verificación atómica). Diseño: [`ARCHITECTURE_V4.md`](ARCHITECTURE_V4.md).
> Supera la guía v2 de `knowledge/DATASET_BUILD_RUNBOOK.md` y el TL;DR de [`PLAN_V3_EXECUTION.md`](PLAN_V3_EXECUTION.md).
>
> **Regla de oro:** NO se recarga saldo grande hasta que el **SMOKE de Fase 1** (1 celda, ~$5-15) valide
> en datos REALES el $/doc, el factscore y la varianza del juez. El preflight da GO-para-arrancar; el
> smoke da GO-para-gastar.

---

## 0. Números canónicos (fuente única de verdad — 2026-06-22)

| Métrica | Valor |
|---------|-------|
| Tabla canónica `facts.yaml` | **67** hechos (66 verified, **56 enforce**) |
| Espinazo `concept_map.yaml` | **257** celdas · **7,950** temas |
| Corpus actual (legacy v3) | 40 archivos = 20 temas (22 published, 18 review) |
| Evidencia curada (NotebookLM) | **657** archivos en `evidence/` (gitignored) |
| Embedder de producción | `paraphrase-multilingual-mpnet-base-v2` (768d); fallback MiniLM (384d) |
| Modelos | planner **DeepSeek V4** · autor **Qwen-Plus** · juez+atómico **GLM/z.ai** |
| **Costo proyectado corrida completa (v4)** | **~$964 USD** (GLM ~$703 · Qwen ~$261) — ver `cost_projection.py` |

> ⚠️ **ALCANCE de la corrida actual:** el `concept_map` cubre tiers **5-18** (7,950 temas). La **doble pista
> practitioner (D2)** (mercados, valuación, derivados, nivel CFA/Series-7) NO está en el mapa — financiar la
> corrida ahora genera el mapa 5-18, no la cobertura "cero-a-practitioner". Para esa promesa: regenerar el
> `concept_map` con tiers profesionales (barato, DeepSeek) ANTES de su corrida. Ver `ARCHITECTURE_V4.md §2.4`.

---

## 1. El pipeline v4 (qué hace distinto a v3)

```
PLANNER(mapa, DeepSeek) → AUTOR(Qwen, RAG-to-write: evidencia recuperada POR-TEMA + jurisdiction-firewall)
  → ENSAMBLE(código) → GATE(determinista: id-discipline, valor canónico, paridad ES/EN, firewall, vocab edad)
  → JUEZ(GLM: pedagogía/coherencia/jurisdicción) → VERIFICADOR ATÓMICO(GLM NLI: cada afirmación vs evidencia)
  → review / draft   [BREADTH-FIRST: pasadas 2→5→todo el mapa · STOP por cobertura VERIFICADA]
```

Las 5 mejoras que hacen la corrida **exitosa y fundamentada** (no "lavado de conocimiento"):
1. **RAG-to-write** (`evidence_rag.py`): el autor escribe DESDE evidencia real recuperada por-tema (léxico
   TF-IDF, robusto, con firewall de jurisdicción en el insumo), no de memoria.
2. **Verificación atómica** (`atomic_verify.py`, `quality_bar.atomic_verify`): cada afirmación se verifica
   por NLI contra la evidencia; `contradicted>0` o `factscore<0.80` o `>50%` no-verificable ⇒ revise.
3. **Disciplina de ids en el gate** (`gate_kb.py`): un `@fact` off-table que duplica una cifra canónica ⇒
   HARD-FAIL; `--strict-facts` = todo volátil off-table es HARD. Reporta el ratio anclado.
4. **Proyección de costo** (`cost_projection.py`, cableada al preflight): rehúsa la falsa sensación de
   "STOP por cobertura" si los caps no cubren la corrida completa.
5. **Cobertura sobre docs VERIFICADOS** (no drafts) + **firewall eval able-to-fail** + embedder real.

---

## 2. Pre-run: GO/NO-GO (todo a $0)

```bash
cd littlefounders_brain/rag-llm-brain
./.venv/bin/python knowledge/tools/test_pipeline.py            # invariantes (11/11)
./.venv/bin/python knowledge/tools/cost_projection.py          # ¿los caps cubren la corrida completa?
./.venv/bin/python knowledge/tools/preflight.py                # GO/NO-GO (env, pings, gate, facts, costo)
./.venv/bin/python knowledge/tools/gate_kb.py --strict-facts   # disciplina de ids dura
```
**No arrancar la corrida masiva si:** el preflight da NO-GO, o `cost_projection` dice "INSUFICIENTE", o el
gate está rojo por contenido nuevo. (El gate rojo sobre el corpus *legacy* es ESPERADO: esos 18 docs en
`review` usan ids off-table y se regeneran en la corrida.)

---

## 3. FASE 1 — Smoke pagado mínimo (OBLIGATORIO antes de recargar)

> **✅ EJECUTADO 2026-06-22** — ver métricas reales abajo. El smoke VALIDÓ el loop v4 y encontró 2 defectos
> (cerrados: `extract_claims` perdía valores `@fact`; CLI usaba evidencia distinta a `build_topic`).

Validida el loop v4 COMPLETO en datos reales con el saldo existente (~$5-15). **Una celda:**
```bash
./.venv/bin/python knowledge/tools/build_dataset.py --only us/taxes/income_tax --max-docs 3
# inspeccionar los .es/.en.md generados; correr el verificador atómico sobre ellos:
./.venv/bin/python knowledge/tools/atomic_verify.py us/taxes/income_tax --verify llm --model glm-4.6
./.venv/bin/python knowledge/tools/gate_kb.py us/taxes/income_tax --strict-facts
```
**MEDIR y decidir:** (a) **$/doc real** por proveedor (extrapolar a 7,950 → fija los caps); (b) **factscore**
(¿la prosa nueva SÍ se funda en evidencia, a diferencia del legacy 100% unverifiable?); (c) **varianza del
juez** (¿discrimina o satura a 5/5?); (d) **near-dup**. Si los tres salen bien → recargar; si no → ajustar
prompts/umbral ANTES de gastar.

### Resultados reales del smoke (2026-06-22 · iteración 2: 6 docs, distribución medida)

| Métrica | Valor medido | Comentario |
|---------|-------------|------------|
| Gate `--strict-facts` | ✅ VERDE · 28/28 anclados (100%) · 0 off-table | doc NUEVO vs legacy 17% |
| Factscore atómico (LLM-NLI) | **1.0** (definition: 3/3) Y **n/a** (gross-income: 0/0, 8 unverifiable) | **H1 confirmado:** factscore es "teatro" — o 1.0 (pocos claims coinciden) o n/a (todo unverifiable). NO es señal fiable |
| Tasa de no-verificables | 89–100% (advisory) | el NLI no cubre la prosa pedagógica (RAG-to-write léxico ≠ entailment) |
| Varianza del juez (cache-bypass) | worked_example **3 vs 5**; verdict **revise vs publish** | **SM2:** el juez es RUIDOSO en pedagogía; satura 5/5 en factual. Mismo doc → pass o fail |
| $/doc real (D2, por rol) | **$0.067** (autor $0.014 + juez $0.049 + verif $0.004) | GLM = **79%** del costo (juez = cuello de botella). 7,950 docs ≈ **$533** |
| Throughput | **4.5 min/doc** (1 worker) | con 8 workers: ~107 docs/h → 7,950 docs ≈ 5 días |
| Near-dup | **0** (6 docs nuevos, todos únicos) | `is_near_dup` funciona; 0 falsos positivos |
| D1 numerales no-anclados | **50** en doc MX (umbrales/tasas ISR) + 14 en docs US | riesgo H2 detectado determinísticamente (advisory; `--strict-numerals` → HARD) |
| Auditoría de contenido (H2) | **CONFIRMADO y corregido:** doc US usaba tramo 2024 ($11,600) en doc 2026 → aritmética con 6 cifras erróneas. Fix: tramo 2026 ($12,400, Rev. Proc. 2025-32). MX doc (que-es-isr): tarifa 2025 en corpus 2026 + cálculo ISR erróneo → juez lo degradó a draft ✓ |

**Veredicto iteración 2:** el loop v4 FUNCIONA end-to-end PERO las métricas de proceso (factscore, juez 5/5) NO prueban corrección del contenido. **H2 confirmado:** un doc con factscore 1.0/juez 5/5 contenía 6 cifras del año equivocado (2024 bracket en doc 2026) — detectado SOLO por auditoría manual + D1, no por factscore/NLI. El gate (SALT cap $10k→$40k) y el juez (cálculo ISR) SÍ atraparon errores en otros docs → degradados a draft. **D1/D2 cerran los blind spots:** D1 detecta numerales oficiales no-anclados (50 en un doc); D2 loguea gasto GLM por-doc (antes invisible). **NO certificar "listo para corrida completa" hasta:** (a) anclar tramos ISR/brackets a facts.yaml (SME), (b) calibrar la barra del juez con su varianza medida, (c) subir `atomic_unverifiable_blocking` solo si la evidencia mejora.


---

## 4. FASE 2 — Corrida masiva (tras validar Fase 1 y recargar saldos)

1. **Subir los caps** en `_meta/build_policy.yaml → wise_use.budget_usd` a la proyección validada
   (orientativo: `glm: 800`, `qwen: 300`, `deepseek: 15`) y **recargar** esas APIs.
   > **v4.1 — guard duro:** `--run` (corrida MASIVA, sin `--max-docs`) **rehúsa arrancar** si los caps NO
   > cubren la proyección completa (GO-para-TERMINAR, no sólo GO-para-arrancar). Si quieres avanzar con caps
   > bajos (corte limpio y reanudable al agotar), añade `--i-accept-underbudget`. El gasto del verificador
   > atómico (GLM) ahora cuenta en el presupuesto.
2. **Lanzar** (background, reanudable):
   ```bash
   nohup ./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 \
         > knowledge/build_v4.log 2>&1 &
   ./.venv/bin/python knowledge/tools/build_dataset.py --status     # progreso/cobertura/grounding/drafts
   ```
3. **Resume gratis** tras corte por budget/interrupción: recargar, subir caps, re-lanzar el MISMO comando
   (salta lo hecho por existencia de archivo + caché LLM). `--retry-drafts` regenera los draft.

---

## 5. Post-run: curación → índice → eval → SME

```bash
./.venv/bin/python knowledge/tools/semdedup.py --embedder fastembed --demote   # dedup semántico cross-cell
./.venv/bin/python knowledge/tools/decontaminate.py --strict                    # no eval-circular
./.venv/bin/python knowledge/tools/build_index.py --production --embedder fastembed   # índice servible (rechaza hash)
./.venv/bin/python knowledge/eval/run_kb_eval.py --db knowledge/index/kb.db --strict-recall   # golden+FUGA+competency+frescura
```
Luego: **revisión SME por triaje de `grounding_tier`** (auto-confiar `anchored`; muestrear `llm_reviewed`)
→ promover `review → published`. **Nada se auto-publica.**

---

## 6. Definición de ÉXITO de la corrida (acceptance gates)

- `coverage_report.py` → cobertura del concept_map = objetivo, **medida sobre docs verificados**.
- `gate_kb.py --strict-facts` → 0 HARD; ratio anclado ≥ objetivo (90% de cifras volátiles canónicas).
- `atomic_verify` (muestra) → factscore ≥ 0.80; 0 contradicted en la muestra.
- `run_kb_eval.py --strict-recall --require-production` → índice servible (fastembed + normalizado + modelo
  de policy); Suite B (fuga) verde y DEMOSTRATIVA (no todo-inconcluso); golden/frescura verde; decontam limpio.
- `cost_projection.py` → la corrida cabe en los caps recargados.

---

## 7. Robustez (por qué la corrida NO se pierde a mitad)

| Mecanismo | Garantía |
|-----------|----------|
| Escritura atómica (`.tmp`+rename) | un corte no deja un doc corrupto |
| Resume por existencia + `build_state.json` | re-lanzar continúa donde quedó |
| Caché LLM content-addressed | el resume NO re-paga las llamadas hechas |
| `continue_on_subdomain_error` | un subdominio que falle no tumba la corrida |
| Backoff de red 429/5xx + degradación de búsqueda | tolera baches de API |
| Topes de presupuesto por proveedor + alerta de saldo | corte LIMPIO y reanudable, no runaway a tarjeta |
| RAG-to-write léxico (sin model-load en hot-path) | sin OOM por embeddings en la generación |
| **v4.1** autor/verificador GUARDADOS en `build_topic` | una respuesta mala cuesta 1 doc (→draft), no la celda de hasta 37 temas |
| **v4.1** `cache_validator` anti-poison en `json()` | una respuesta JSON truncada NO se cachea ni re-sirve (no envenena el doc en cada resume) |
| **v4.1** guard de costo en `--run` masivo | rehúsa arrancar bajo presupuesto (no morir a mitad); gasto del verificador contabilizado |
| **v4.1** `run_gate` distingue crash vs fallo; gate lee `sources.yaml` tolerante a torn-read | un crash concurrente no quema una ronda pagada del autor |

> **Calibración atómica (v4.1):** el disparo DURO por defecto es `contradicted>0` (señal fiable: la evidencia
> dice OTRA cosa). `factscore` bloquea sólo con señal suficiente (`checkable ≥ min_checkable_for_factscore`) y
> la tasa de no-verificables (que EXCLUYE ejemplos `illustrative`) es **advisory** hasta que la **Fase 1** mida
> factscore en datos v4 reales; recién entonces se suben umbrales/flags (`build_policy.yaml → quality_bar`).

---

## 8. Limitaciones honestas (qué NO garantiza el $0)

- ~~El **factscore real** de la prosa solo se conoce tras la Fase 1~~ → **MEDIDO (Fase 1 smoke,
  2026-06-22):** factscore **1.0** (3/3 claims con valores verificables = supported; 0 contradicted) sobre
  docs NUEVOS del loop v4. La tasa de no-verificables (89%) es **advisory** y esperada (paráfrasis
  pedagógica ≠ entailment de evidencia regulatoria IRS). El corpus legacy sigue 100% unverifiable — se
  regenera en la corrida. **Pendiente:** medir varianza del juez (2-3 docs más) antes de fijar umbrales.
- La **evidencia** `evidence/` está parcialmente **mezclada de jurisdicción** (us/taxes contiene fuentes
  MX); el firewall de `evidence_rag.py` lo filtra en recuperación, pero conviene re-ingerir evidencia con
  disciplina de jurisdicción (`build_evidence.py`) para máxima densidad por celda.
- La **doble pista practitioner** (D2) está definida en `ARCHITECTURE_V4.md` pero el `concept_map` aún es
  5-18; poblar los tiers profesionales requiere una regeneración del mapa (barata, DeepSeek) antes de su corrida.
- "100% exitoso" de una corrida LLM de ~$1k no se garantiza desde $0: se de-riesga con preflight + Fase 1 +
  resume. El preflight es el GO técnico; la Fase 1 es el GO económico. **La Fase 1 YA se ejecutó** y dio GO.
