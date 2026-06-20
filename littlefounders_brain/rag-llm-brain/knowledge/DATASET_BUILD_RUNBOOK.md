# Runbook — Construcción Autónoma del Dataset (pipeline HÍBRIDO)

> Construye el corpus **solo**, sin tokens de Claude. Grounding **híbrido**: **NotebookLM** ingiere
> fuentes primarias curadas → caché local; **Qwen-Flash** redacta/juzga fundado en esa evidencia (+
> `qwen_search` de respaldo). **Gate determinista** hace cumplir los invariantes. Estrategia:
> [`../BRAIN_STRATEGY.md`](../BRAIN_STRATEGY.md). Rutas relativas a `littlefounders_brain/rag-llm-brain/`.

## 0. Pipeline (por documento)

```
build_evidence.py (NotebookLM)  → por (país,dominio): siembra fuentes .gov + deep-research →
                                  extrae fulltext → caché knowledge/evidence/<país>/<dominio>/
build_dataset.py (Qwen-Flash):
  ① PLANNER     → temas EXHAUSTIVOS por (país,dominio,subdominio)
  ② AUTHOR      → funda en EVIDENCIA CURADA (+ search de respaldo) → cuerpo ES/EN, @fact, fuentes
  ③ ENSAMBLE    → frontmatter determinista + registra fuentes + sentinels @fact   (código, no IA)
  ④ GATE        → schema · firewall país/idioma · vocab por edad · citas → revise loop si falla
  ⑤ JUDGE+VERIFY→ rúbrica + verifica cifras vs fuente → revise loop; si no converge → draft
  ⑥ ESCRIBE status: review (humano aprueba)  + checkpoint (reanudable por archivos)
  ⑦ CRÍTICO completitud (loop-until-dry) → más temas hasta cubrir
  ⑧ STOP = tamaño ≥ meta ∧ ≥N docs/subdominio ∧ eval verde   (en _meta/build_policy.yaml)
```

## 1. Prerrequisitos (VERIFICADOS 2026-06-20)

- venv: `rag-llm-brain/.venv` (notebooklm-py[browser] + pyyaml + pydantic + chromium). Lesson Factory
  usa `../rag-llm-brain/.venv/bin/python`.
- Qwen: `rag-llm-brain/.env` (gitignored) con `QWEN_API_KEY`/`QWEN_BASE_URL`. Modelos = **qwen-flash**
  (todos los roles) en `_meta/build_policy.yaml`.
- NotebookLM: `rag-llm-brain/.notebooklm/storage_state.json` (gitignored). Verificar:
  `./.venv/bin/python knowledge/tools/build_evidence.py --auth`  → `✅ NotebookLM auth OK`.

## 2. Ejecución (en orden)

```bash
cd littlefounders_brain/rag-llm-brain

# (A) GROUNDING curado con NotebookLM — una vez por (país,dominio). LENTO (deep-research 15-30 min/dominio).
nohup ./.venv/bin/python knowledge/tools/build_evidence.py --all > knowledge/evidence.log 2>&1 &
#     slice: build_evidence.py --only mx/taxes   ·   rápido (sin deep-research): --no-research

# (B) GENERACIÓN autónoma (Qwen-Flash, funda en el caché). Reanudable; concurrente.
nohup ./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 > knowledge/build.log 2>&1 &
tail -f knowledge/build.log          # progreso ;  --status para cobertura/tamaño

# (C) Verificación + reindex
./.venv/bin/python knowledge/tools/gate_kb.py
./.venv/bin/python knowledge/tools/build_index.py
./.venv/bin/python knowledge/eval/run_kb_eval.py
```

**Reanudable:** los .md son el checkpoint; re-ejecutar **salta lo ya hecho**. Seguro `kill`/relanzar.
`evidence/` e `index/` están gitignored (la evidencia es texto fuente con copyright = insumo, NO producto).

## 3. Criterios de STOP / profundidad  →  `_meta/build_policy.yaml`

`targets.total_size_mb` · `depth.min_docs_per_subdomain` (8) · `completeness.dry_rounds_to_stop` (2) ·
`quality_bar` (factual=5, país=5, resto≥4). STOP global = CONJUNCIÓN; si falta tamaño, el crítico de
completitud sigue profundizando.

## 4. Costo y tiempo (Qwen-Flash, Singapur: $0.05 in / $0.40 out por Mtok)

- ~$0.0035/doc-pareja → **100 MB (~11k parejas) ≈ $40–80**; fase **10 MB ≈ $5–10**.
- Tiempo dominado por NotebookLM (deep-research) + 2 llamadas Qwen/ronda. `--workers 8`: **~1–3 días**
  para 100 MB. **Recomendado:** fase ~10 MB cubriendo todos los dominios → revisar calidad → escalar.

## 5. Revisión humana (nada se publica solo)

El pipeline escribe `status: review`. Revisar `status: draft` (cuarentena de hechos no verificables) en
`index/build_log.jsonl`. Promover aprobados a `published`. Fuentes nuevas → `src_gen_*` en
`_meta/sources.yaml` (tier inferido).

## 6. Notas operativas

- **NotebookLM:** el flag de notebook va DESPUÉS del subcomando (`source add URL -n <id>`). Si la auth
  caduca: `./.venv/bin/notebooklm login --browser chrome --storage .notebooklm/storage_state.json`.
- **Qwen-Flash como juez** a veces lista falsos positivos en `wrong_facts` (valor del doc == correcto);
  el pipeline los filtra (`_real_wrong`). Para máximo rigor, subir `verifier` a `qwen-plus-latest`.
- **Evidencia coarse vs fina:** sin `--research` el caché por país mezcla dominios; con deep-research
  (default) es específica del dominio. Usar deep-research para la corrida real.
