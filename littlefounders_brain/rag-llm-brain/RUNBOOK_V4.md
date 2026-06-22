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

Valida el loop v4 COMPLETO en datos reales con el saldo existente (~$5-15). **Una celda:**
```bash
./.venv/bin/python knowledge/tools/build_dataset.py --only us/taxes/income_tax --max-docs 2
# inspeccionar los .es/.en.md generados; correr el verificador atómico sobre ellos:
./.venv/bin/python knowledge/tools/atomic_verify.py us/taxes/income_tax --verify llm --model glm-4.6
./.venv/bin/python knowledge/tools/gate_kb.py us/taxes/income_tax --strict-facts
```
**MEDIR y decidir:** (a) **$/doc real** por proveedor (extrapolar a 7,950 → fija los caps); (b) **factscore**
(¿la prosa nueva SÍ se funda en evidencia, a diferencia del legacy 100% unverifiable?); (c) **varianza del
juez** (¿discrimina o satura a 5/5?); (d) **near-dup**. Si los tres salen bien → recargar; si no → ajustar
prompts/umbral ANTES de gastar.

---

## 4. FASE 2 — Corrida masiva (tras validar Fase 1 y recargar saldos)

1. **Subir los caps** en `_meta/build_policy.yaml → wise_use.budget_usd` a la proyección validada
   (orientativo: `glm: 800`, `qwen: 300`, `deepseek: 15`) y **recargar** esas APIs.
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
- `run_kb_eval.py --strict-recall` → Suite B (fuga) verde y DEMOSTRATIVA; golden/frescura verde; decontam limpio.
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

---

## 8. Limitaciones honestas (qué NO garantiza el $0)

- El **factscore real** de la prosa solo se conoce tras la Fase 1 (en datos nuevos). El corpus legacy da
  100% unverifiable porque se escribió de memoria — por eso la Fase 1 es obligatoria.
- La **evidencia** `evidence/` está parcialmente **mezclada de jurisdicción** (us/taxes contiene fuentes
  MX); el firewall de `evidence_rag.py` lo filtra en recuperación, pero conviene re-ingerir evidencia con
  disciplina de jurisdicción (`build_evidence.py`) para máxima densidad por celda.
- La **doble pista practitioner** (D2) está definida en `ARCHITECTURE_V4.md` pero el `concept_map` aún es
  5-18; poblar los tiers profesionales requiere una regeneración del mapa (barata, DeepSeek) antes de su corrida.
- "100% exitoso" de una corrida LLM de ~$1k no se garantiza desde $0: se de-riesga con preflight + Fase 1 +
  resume. El preflight es el GO técnico; la Fase 1 es el GO económico.
