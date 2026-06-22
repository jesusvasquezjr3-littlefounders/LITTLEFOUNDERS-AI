# Runbook — Construcción Autónoma del Dataset (pipeline HÍBRIDO)

> ⚠️ **v3.1 vigente:** el pipeline evolucionó a **v3.1 (hardened)** (autor Qwen + **juez GLM con búsqueda**
> + tabla canónica `_meta/facts.yaml` + breadth-first + STOP por cobertura real + grounding etiquetado +
> dedup semántico + frescura wall-clock). La referencia **CANÓNICA de principio a fin (con mermaid)** es
> [`../PIPELINE.md`](../PIPELINE.md) (ejecución en §9). Antes de `--run`, corre `tools/test_pipeline.py` +
> `tools/preflight.py` (GO/NO-GO). Lo de abajo describe el flujo base híbrido.
>
> Construye el corpus **solo**, sin tokens de Claude. Grounding **híbrido**: **NotebookLM** ingiere
> fuentes primarias curadas → caché local; el **autor (Qwen)** redacta fundado en esa evidencia (+
> búsqueda de respaldo) y el **juez (GLM/z.ai con búsqueda)** verifica. **Gate determinista** hace cumplir
> los invariantes (incluido el VALOR de cada cifra contra `facts.yaml`). Estrategia:
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
  ⑤ JUDGE       → rúbrica + verifica cifras vs fuente → revise loop; si no converge → status: draft
  ⑥ ESCRIBE status: review (humano aprueba) ; checkpoint = existencia del par .es/.en
  ⑦ CRÍTICO completitud (loop-until-dry) → más temas hasta cubrir el subdominio
  ⑧ STOP AUTOMÁTICO = tamaño ≥ meta  (o cobertura agotada). El gate+eval globales son
     COMPUERTAS MANUALES post-corrida (paso C), NO los aplica el build solo.
```

## 1. Prerrequisitos (VERIFICADOS 2026-06-20)

```bash
cd littlefounders_brain/rag-llm-brain
# venv (si falta): python3.11 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
#                  ./.venv/bin/python -m playwright install chromium
# .env (si falta): cp .env.example .env  y rellenar QWEN_API_KEY/QWEN_BASE_URL (ver comentarios del .example)

./.venv/bin/python knowledge/tools/llm_qwen.py "responde solo: ok"        # Qwen OK → imprime 'ok' + usage
./.venv/bin/python knowledge/tools/build_evidence.py --auth               # NotebookLM → '✅ NotebookLM auth OK'
```
- venv: `rag-llm-brain/.venv` (deps en `requirements.txt`). El Lesson Factory usa `../rag-llm-brain/.venv/bin/python`.
- `.env` (gitignored): obligatorias `QWEN_API_KEY` y `QWEN_BASE_URL` (las otras 2 son informativas). Plantilla: `.env.example`.
- NotebookLM: cookies en `.notebooklm/storage_state.json` (gitignored). Modelos = **qwen-flash** en `_meta/build_policy.yaml`.

## 2. Ejecución (en orden)

```bash
cd littlefounders_brain/rag-llm-brain

# (A) GROUNDING curado con NotebookLM — una vez por (país,dominio). LENTO (deep-research 15-30 min/dominio).
nohup ./.venv/bin/python knowledge/tools/build_evidence.py --all > knowledge/evidence.log 2>&1 &
#     slice: build_evidence.py --only mx/taxes   ·   rápido (sin deep-research): --no-research
#     monitorear:  find knowledge/evidence -name '*.md' | wc -l   ·   du -sh knowledge/evidence/*
#     (un (país,dominio) con 0 archivos = el autor caerá a qwen_search; menos rigor, no es fatal)

# (B) GENERACIÓN autónoma (Qwen-Flash, funda en el caché). Reanudable; concurrente.
nohup ./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 > knowledge/build.log 2>&1 &

# (C) Verificación + reindex (COMPUERTAS MANUALES de calidad)
./.venv/bin/pip install fastembed                                        # opcional, para retrieval semántico real
./.venv/bin/python knowledge/tools/build_index.py --embedder fastembed   # piloto: omitir flag = embedder hash
./.venv/bin/python knowledge/tools/gate_kb.py
./.venv/bin/python knowledge/eval/run_kb_eval.py
```

### Monitoreo (mientras corre)
- **`build_dataset.py --status`** (en cualquier momento; lee el disco, no necesita el proceso) → tamaño actual vs meta + ✓/espacio por subdominio. Es la fuente de verdad de cobertura.
- **`tail -f knowledge/build.log`** — líneas por doc: `built_ok(scores=...)` (aceptado), `exists` (ya estaba), `needs_review(...)` (cuarentena draft), `!! error en c/d/s` (subdominio abortado). Con `--workers>1` el log entrelaza hilos.
- Vigilancia rápida: `grep -c needs_review knowledge/build.log` · `grep '!!' knowledge/build.log`.
- **Señal de FIN:** aparición de la línea final de `status()` + `usage total={...}` en build.log.

## 3. Criterios de STOP / profundidad  →  `_meta/build_policy.yaml`

- **STOP automático del build** = `targets.total_size_mb` alcanzado **o** cobertura agotada (recorrió todos los subdominios). El `gate_kb` y `run_kb_eval` (incl. la suite de FUGA, bloqueante) son **compuertas MANUALES** del paso C, no las corre el build.
- **Profundidad:** `depth.min_docs_per_subdomain` (8) + `completeness.dry_rounds_to_stop` (2): el crítico sigue proponiendo subtemas hasta 2 rondas sin nada nuevo. Si falta tamaño para la meta, sigue profundizando.
- `quality_bar` (factual=5, país=5, resto≥4): por debajo → revise loop; si no converge → `status: draft`.

## 4. Costo y tiempo (Qwen-Flash, Singapur: $0.05 in / $0.40 out por Mtok)

- ~$0.0035/doc-pareja → **100 MB (~11k parejas) ≈ $40–80**; fase **10 MB ≈ $5–10**.
- Tiempo dominado por NotebookLM (deep-research) + 2 llamadas Qwen/ronda. `--workers 8`: **~1–3 días** para 100 MB
  (el default del flag es 4; los ejemplos usan 8). **Recomendado:** fase ~10 MB cubriendo todos los dominios → revisar → escalar.

## 5. Revisión humana (nada se publica solo)

El pipeline escribe `status: review` (o `status: draft` si el juez no pudo verificar). `index/build_log.jsonl` se crea durante la corrida.
```bash
grep -rl 'status: draft'  knowledge/{shared,mx,us}      # docs en cuarentena (revisar/corregir)
grep -rl 'status: review' knowledge/{shared,mx,us}      # listos para aprobar
grep '"status": "draft"'  knowledge/index/build_log.jsonl   # con el motivo (issue) de cuarentena
```
- **Promover:** editar el frontmatter `status: review` (o `draft` corregido) → `published`, y re-correr gate+eval.
- Fuentes web nuevas se auto-registran como `src_gen_*` en `_meta/sources.yaml` (tier inferido por dominio).
- Si el **% de drafts es alto**, no publiques en masa: revisa prompts/evidencia (suele indicar evidencia pobre o juez Flash estricto).

## 6. Operación, fallas y recuperación

- **NotebookLM (fase de evidencia, la más larga):** `check_auth()` se valida SOLO al inicio. Si la sesión caduca a mitad,
  cada llamada falla en SILENCIO por dominio (`nb_create_failed` / `cached:0`) y SALTA al siguiente — el grounding queda vacío
  y el autor cae a qwen_search. **Recuperación:** re-loguéate y re-ejecuta `build_evidence.py --all` (salta los dominios ya cacheados):
  `./.venv/bin/notebooklm login --browser chrome --storage .notebooklm/storage_state.json`. Para mantener la sesión caliente en
  corridas largas: `notebooklm auth refresh --quiet` por cron (15-20 min). El flag de notebook va DESPUÉS del subcomando (`source add URL -n <id>`).
- **Qwen rate-limit:** `llm_qwen.py` reintenta 429/5xx con backoff exponencial (4 intentos) automáticamente; si un subdominio aborta verás
  `!! error en c/d/s` → basta relanzar (reanuda). Para bajar presión, reduce `--workers`. Con `--workers>1` el `usage total` es aproximado.
- **Rigor del juez:** Qwen-Flash a veces lista falsos positivos en `wrong_facts` (valor del doc == correcto); el pipeline los filtra
  (`_real_wrong`). Para máximo rigor, subir el rol **`judge`** (no `verifier`, que es config reservada sin efecto hoy) a `qwen-plus-latest` en `build_policy.yaml`.
- **Embedder:** `build_index.py` por defecto usa el embedder `hash` (determinista, sin deps; suficiente para gate/eval). Para retrieval real
  instala `fastembed` y reconstruye con `--embedder fastembed` (el `meta` del kb.db registra `embed_backend`; índice y retriever deben usar el mismo).
- **Reanudar:** el único checkpoint es la existencia del par `.es/.en`. Para forzar regeneración de un doc, borra sus `.md`. El gate detecta `.en` sin par `.es`.
