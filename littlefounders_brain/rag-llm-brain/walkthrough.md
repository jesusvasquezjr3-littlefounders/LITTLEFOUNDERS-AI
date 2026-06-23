# walkthrough.md — Ruta operativa: de AQUÍ al **Corpus COMPLETO north-star (cero-a-banquero)**

> **Propósito:** checklist VIVO y accionable. Es la **fuente única de "dónde estamos / qué sigue"** hacia el
> corpus completo. Marca `[x]` lo hecho, `[ ]` lo pendiente; actualiza la **§7 Bitácora** cada sesión.
>
> **Para RETOMAR en otra sesión (lee esto primero):** (1) este archivo §0 (snapshot) + §7 (bitácora);
> (2) `ARCHITECTURE_V4.md` §7 (historial de hardening v4.1→migración MiniMax); (3) `RUNBOOK_V4.md` (corrida
> masiva); (4) `CLAUDE.md`/`AGENTS.md` (reglas). Alcance: SOLO `littlefounders_brain/rag-llm-brain/`.
>
> **Última actualización:** 2026-06-22 · commit `ab7bf9c` · branch `feat/lesson-factory-v2`.

---

## 0. Estado actual (snapshot)

| Dimensión | Estado |
|-----------|--------|
| Motor v4 | **Endurecido** · 26/26 tests (`tools/test_pipeline.py`) · preflight **GO** sobre corpus servible |
| Modelos | planner **DeepSeek-v4-flash** · autor **Qwen-plus-latest** · juez+verificador **GLM-4.6** (migración a **MiniMax** ESCENIFICADA, pendiente `MINIMAX_API_KEY`) |
| Corpus | ~27 docs `.es` (11 review · 5 draft · 11 published) · **1 doc v4 real** · cobertura **~0.3%** del mapa |
| Mapa (`concept_map.yaml`) | 257 celdas / **7,950 temas** · tiers **5-18 ÚNICAMENTE** (sin practitioner) |
| `facts.yaml` | 67 cifras (56 enforce) · **faltan brackets US / tramos ISR MX y cifras volátiles de otros dominios** |
| Presupuesto | caps glm $9 / qwen $60 / deepseek $7.5 · proyección completa ~$964 (Tier-1+MiniMax la bajan a ~$400-550) · el guard de `--run` BLOQUEA hasta recargar |

**Bloqueos hoy (NINGUNO es código nuevo):** (1) `facts.yaml` incompleto (SME) · (2) `MINIMAX_API_KEY` ·
(3) presupuesto sin recargar · (4) mapa sin tiers practitioner (para el north-star).

**Commits clave de esta línea de trabajo:** `909e47d` (hardening v4.1) · `125e86d` (regresiones) ·
`62df9c0` (integridad+serve) · `27ede6c` (Fase-1 smoke) · `d6c4da0`+`8792198` (D1+grounding) ·
`b680bcc` (gate servible) · `0d3768a` (juez LEAN) · `e57d780` (judge_bakeoff) · `ab7bf9c` (MiniMax staged).

---

## 1. Las DOS definiciones de "completo" (decisión de alcance)

- **A) Fundacional (5-18):** el `concept_map` actual (7,950 temas). Educación financiera 5-18, MX/US.
- **B) North-star (cero-a-banquero, RC1):** requiere **tiers practitioner (D2)** en el mapa — mercados,
  valuación, derivados, regulación nivel CFA/Series-7 — que **HOY NO EXISTEN**. Es un superconjunto de (A).

**Estrategia recomendada (criterio senior):** hacer **(A) primero** (valida la máquina a escala real,
produce corpus usable, calibra costo/throughput) y **luego (B)** (regenerar mapa practitioner + 2ª corrida).
NO intentar (B) en un solo mega-run sin validar (A) a escala.

---

## 2. CHECKLIST — Fases hacia el north-star

Owner: **[CÓDIGO]** = lo hace el agente · **[SME]** = humano + fuente primaria · **[$]** = gasto/recarga ·
**[DECISIÓN]** = el usuario decide.

### FASE A — Validar la migración GLM→MiniMax  · owner [$]+[CÓDIGO] · ~$0.50
- [ ] Conseguir `MINIMAX_API_KEY` y ponerla en `.env` (+ `MINIMAX_BASE_URL` si la región difiere).
- [ ] Confirmar los **model-ids exactos** en la consola MiniMax (esperado `MiniMax-M3`, `MiniMax-M2.5`).
- [ ] Verificar si MiniMax-M3 expone **web_search** vía tools (si sí → habilitar `search_ok=True` en `llm_qwen.py` para conservar el modo FACTCHECK del juez).
- [ ] Bake-off head-to-head: `./.venv/bin/python knowledge/tools/judge_bakeoff.py us/taxes/income_tax/definition-and-purpose.es.md --models glm-4.6,MiniMax-M2.5,MiniMax-M3 --samples 3` (repetir sobre 3-4 docs distintos).
- [ ] **Gate de salida:** MiniMax **discrimina ≥ GLM** (no satura a 5/5) **Y concuerda en verdict**. Si pasa → flipear en `build_policy.yaml` `judge: MiniMax-M2.5` y `verifier: MiniMax-M3` (dejar GLM comentado como fallback). Si NO pasa → quedarse en GLM y documentarlo. Correr `test_pipeline.py` (26/26) + `preflight.py`.

### FASE B — Completar `facts.yaml`  · owner [SME] · ⚠️ EL LONG POLE (no es código)
- [ ] Generar la lista de cifras faltantes: correr el gate y D1 sobre el corpus para ver qué numerales oficiales aparecen sin anclar → `./.venv/bin/python knowledge/tools/gate_kb.py --strict-numerals` (revisar los "numeral oficial NO-anclado").
- [ ] **SME ancla en `_meta/facts.yaml`**, contra **fuente primaria** del año correcto:
  - [ ] US: brackets federales (Rev. Proc. 2025-32), standard deduction, CTC, SALT cap, SS wage base, FICA.
  - [ ] MX: tramos ISR (Anexo 8 RMF del año), UMA, salario mínimo, IVA, RESICO, subsidio al empleo.
  - [ ] Resto de dominios volátiles que entren en alcance (ver Fase E).
  - Cada entrada: `value` real, `verified: true`, `enforce: true`, `jurisdiction`, fuente primaria, `last_verified`.
- [ ] Validar: `./.venv/bin/python knowledge/tools/facts_table.py --verified` + `preflight.py` (sin PENDING en verified+enforce).
- [ ] **Gate de salida:** las cifras oficiales de los dominios objetivo están ancladas (≥90% de ratio anclado en un slice de prueba) → así D1 deja de mandar a draft los ejemplos trabajados.

### FASE C — Smoke Fase 1 (medir + AUDITAR contenido)  · owner [$]+[CÓDIGO] · ~$5-15
- [ ] Generar un slice real: `./.venv/bin/python knowledge/tools/build_dataset.py --only us/taxes/income_tax --max-docs 3` (y 1-2 celdas más con evidencia).
- [ ] **MEDIR (datos, no telemetría):** factscore distribución, **varianza del juez**, **$/doc real por proveedor**, **draft-rate**, near-dup, throughput. Ver `index/build_log.jsonl` (`spent_by_role`).
- [ ] **AUDITAR (anti-AP8):** LEER 2-3 docs completos y **RE-DERIVAR su aritmética** contra fuente primaria. 0 cifras del año equivocado, 0 numerales no-anclados en ejemplos (`scan_unanchored_numerals`).
- [ ] **Gate de salida:** draft-rate aceptable (los docs anclados llegan a `review`), factscore con señal, contenido aritméticamente correcto. Si draft-rate alto por cifras faltantes → **volver a Fase B**.

### FASE D — Presupuesto (GO-para-TERMINAR)  · owner [$]
- [ ] Recalcular con $/doc real: `./.venv/bin/python knowledge/tools/cost_projection.py`.
- [ ] Recargar APIs a la proyección (con MiniMax: probablemente ~$400-550 total; sin migrar: ~$964). Subir `wise_use.budget_usd` en `build_policy.yaml` a los caps recomendados.
- [ ] **Gate de salida:** `cost_projection.py` dice "✅ los caps cubren la corrida completa" (el guard de `--run` deja arrancar).

### FASE E — Decisión de alcance + (si north-star) preparar el mapa  · owner [DECISIÓN]+[CÓDIGO]
- [ ] **DECISIÓN:** ¿la corrida es **fundacional (5-18)** o **north-star (practitioner)**? (Recomendado: fundacional primero — saltar a Fase F; practitioner después en Fase H.)
- [ ] Si north-star ahora: confirmar que `taxonomy.yaml` cubre TODOS los dominios del north-star (finanzas, economía, administración, emprendimiento, **bolsa**, **crypto**, **metales**, **regulación**, contaduría) — añadir los que falten.
- [ ] Si north-star ahora: ver **Fase H** (regenerar mapa con tiers practitioner) ANTES de la corrida.

### FASE F — Corrida masiva FUNDACIONAL (5-18)  · owner [$]+[CÓDIGO] · ~días
- [ ] Pre-run: `test_pipeline.py` (verde) + `preflight.py` (GO) + `cost_projection.py` (cubre) + `gate_kb.py --exclude-drafts` (servible verde).
- [ ] Lanzar reanudable: `nohup ./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 > knowledge/build_v4.log 2>&1 &`
- [ ] Monitorear: `./.venv/bin/python knowledge/tools/build_dataset.py --status` (cobertura/grounding/drafts).
- [ ] Resume tras corte por budget: recargar, subir caps, re-lanzar el MISMO comando (caché LLM = resume gratis); `--retry-drafts` regenera los draft (incl. los legacy demovidos).
- [ ] **Gate de salida:** `coverage_complete()` = 100% del mapa **sobre docs VERIFICADOS** (no drafts).

### FASE G — Curación + servir + SME  · owner [CÓDIGO]+[SME]
- [ ] `./.venv/bin/python knowledge/tools/semdedup.py --embedder fastembed --demote` (dedup semántico cross-cell).
- [ ] `./.venv/bin/python knowledge/tools/decontaminate.py --strict` (no eval-circular).
- [ ] `./.venv/bin/python knowledge/tools/build_index.py --production --embedder fastembed` (índice servible mpnet).
- [ ] `./.venv/bin/python knowledge/eval/run_kb_eval.py --db knowledge/index/kb.db --strict-recall --require-production` (golden + FUGA demostrativa + competency + frescura + índice de prod).
- [ ] **SME triaje por `grounding_tier`** (auto-confiar `anchored`; muestrear `partially_anchored`/`llm_reviewed`) → promover `review → published`. **Nada se auto-publica.**
- [ ] **Gate de salida (corpus fundacional SERVIBLE):** eval verde + SME firmó. **→ Aquí ya tienes el corpus (A).**

### FASE H — Expansión PRACTITIONER (el delta del north-star)  · owner [CÓDIGO]+[SME]+[$]
- [ ] `taxonomy.yaml`: añadir `tier6_practitioner` / `tier7_professional` con techo de vocabulario INVERTIDO (aquí SÍ se exige rigor técnico: fórmulas, regulación citada, mecánica de mercado).
- [ ] Regenerar el mapa con conceptos profesionales por celda: `./.venv/bin/python knowledge/tools/build_concept_map.py` (DeepSeek, ≈$0) → mercados, valuación (DCF/Black-Scholes), derivados/griegas, márgenes, settlement, regulación (SEC/CNBV), nivel CFA/Series-7. Normalizar/de-bloat (`normalize_concept_map.py`) como en la regeneración previa.
- [ ] **Fase B (de nuevo)** para las cifras practitioner que sean canónicas (umbrales regulatorios, márgenes, límites). [SME]
- [ ] **Fase C (de nuevo)**: smoke sobre 2-3 celdas practitioner → medir factscore/draft-rate del contenido profesional (más exigente).
- [ ] **Fase D**: re-proyectar costo (más temas) + recargar.
- [ ] **Fase F (de nuevo)**: corrida masiva sobre los temas practitioner (la orquestación breadth-first cubre las celdas nuevas; `--retry-drafts` y la caché hacen incremental lo ya hecho).
- [ ] **Fase G (de nuevo)**: curación + índice + eval + SME triaje sobre el corpus ampliado.

### FASE I — Aceptación final NORTH-STAR  · owner [DECISIÓN]+[SME]
- [ ] Cobertura 100% del mapa **practitioner** sobre docs verificados.
- [ ] Eval `--strict-recall --require-production` verde sobre el corpus completo.
- [ ] Validación de competencia: un set de "competency questions" nivel-practitioner se responde con grounding (¿el RAG llevaría a alguien de 0 a nivel banquero/corredor?).
- [ ] **Gate final:** SME firma que el corpus alcanza el estándar profesional en cada dominio del north-star.
- [ ] **→ Corpus COMPLETO north-star (cero-a-banquero) ALCANZADO.**

---

## 3. Comandos de retomada rápida
```bash
cd littlefounders_brain/rag-llm-brain
./.venv/bin/python knowledge/tools/test_pipeline.py                       # invariantes (deben pasar)
./.venv/bin/python knowledge/tools/preflight.py                           # GO/NO-GO (env·gate servible·costo)
./.venv/bin/python knowledge/tools/build_dataset.py --status              # cobertura/grounding/drafts
./.venv/bin/python knowledge/tools/cost_projection.py                     # ¿los caps cubren la corrida?
./.venv/bin/python knowledge/tools/gate_kb.py --exclude-drafts            # gate del corpus SERVIBLE
git log --oneline -12                                                     # historial de esta línea de trabajo
```

## 4. Invariantes / anti-patterns que NO se negocian (carry-forward)
- **País + idioma = filtro DURO** (firewall anti-fuga). Autor=Qwen, juez/verificador ≠ Qwen (independencia).
- **Nada se auto-publica** (`review`/`draft` → SME promueve a `published`).
- **AP1:** ningún claim de calidad sin medición real (tokens pagados). **AP8:** LEER el contenido, no celebrar telemetría (factscore/gate/juez 5/5 ≠ doc correcto).
- **Cifras:** solo de `facts.yaml` (gate determinista). Un numeral oficial no-anclado en ejemplo → draft (D1).
- **NO comitear** `.env` / `evidence/` / `index/` / `.venv/`.
- **Límite honesto:** el verificador atómico es no-op sobre prosa (89% unverifiable = arquitectura, RAG-to-write, NO el modelo). Cambiar GLM→MiniMax NO lo arregla; solo da paridad de capacidad + menor costo.

## 5. Pistas de arquitectura para retomar (qué hace qué)
- Orquestador: `tools/build_dataset.py` (build_topic = autor→gate→juez→verificador atómico; D1 enforcement; cost guard `--run`).
- Gate determinista: `tools/gate_kb.py` (valor canónico, id-discipline, paridad ES/EN, D1 numerales, `--exclude-drafts`).
- Verificación atómica: `tools/atomic_verify.py` (NLI; `score_text`). RAG-to-write: `tools/evidence_rag.py`.
- Cliente LLM multi-proveedor: `tools/llm_qwen.py` (qwen/glm/deepseek/**minimax**). Bake-off juez: `tools/judge_bakeoff.py`.
- Costo: `tools/cost_projection.py`. Preflight: `tools/preflight.py`. Servir: `tools/build_index.py` + `tools/retriever.py` + `eval/run_kb_eval.py`.
- Diseño canónico v4 + historial: `ARCHITECTURE_V4.md` (§7 = hardening). Corrida masiva: `RUNBOOK_V4.md`.

## 6. Pista paralela (NO bloquea el north-star de finanzas)
- **Replicabilidad a otros dominios** (medicina, derecho…): refactor `domain_pack.yaml` (~8 archivos con acoplamiento finanzas-MX-US en `tools/`). Documentado en `ARCHITECTURE_V4.md §5`. Hacer DESPUÉS de validar el motor con finanzas (D3).

## 7. Bitácora de progreso (ACTUALIZAR cada sesión)
| Fecha | Sesión hizo | Fase | Commit |
|-------|-------------|------|--------|
| 2026-06-22 | Hardening v4.1 (11 fixes) + 2 regresiones cerradas + integridad + Fase-1 smoke (1 doc, factscore 1.0) + D1 enforcement + juez LEAN (Tier-1) + gate servible + judge_bakeoff + migración MiniMax escenificada | pre-A | `909e47d`→`ab7bf9c` |
| _(siguiente)_ | _Fase A: validar MiniMax con la key (bake-off) …_ | A | _…_ |
