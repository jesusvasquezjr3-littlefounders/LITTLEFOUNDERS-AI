# Runbook — Construcción Autónoma del Dataset (pipeline HÍBRIDO)

> 🛑 **SUPERSEDED — para la corrida MASIVA usa [`../RUNBOOK_V4.md`](../RUNBOOK_V4.md).**
> El diseño CANÓNICO de principio a fin es ahora [`../ARCHITECTURE_V4.md`](../ARCHITECTURE_V4.md).
> Este runbook documenta el flujo **v2/v3.1** (histórico) y **se conserva sólo como referencia**;
> es **válido donde no esté superado por v4**, pero **NO** lo uses como guía operativa de la corrida grande.
> Los cambios clave de **v4** (refléjalos): autor = **Qwen-Plus** (no Qwen-Flash) escribiendo con
> **RAG-to-write** (evidencia recuperada POR-TEMA, `tools/evidence_rag.py`); **verificación atómica**
> NLI por afirmación (`tools/atomic_verify.py`) — el juez GLM ya no es el único garante factual;
> juez = **GLM/z.ai (glm-4.6)**; planner/mapa = **DeepSeek V4**; **STOP por COBERTURA verificada**
> (no por MB); **proyección de costo** (`tools/cost_projection.py`) cableada al preflight.
>
> ⚠️ **v3.1 (histórico):** el pipeline evolucionó a **v3.1 (hardened)** (autor Qwen + **juez GLM con búsqueda**
> + tabla canónica `_meta/facts.yaml` + breadth-first + STOP por cobertura real + grounding etiquetado +
> dedup semántico + frescura wall-clock). La referencia v3.1 de principio a fin (con mermaid) es
> [`../PIPELINE.md`](../PIPELINE.md) (ejecución en §9). Antes de `--run`, corre `tools/test_pipeline.py` +
> `tools/preflight.py` (GO/NO-GO). Lo de abajo describe el flujo base híbrido.
>
> Construye el corpus **solo**, sin tokens de Claude. Grounding **híbrido**: **NotebookLM** ingiere
> fuentes primarias curadas → caché local; en **v4** el **autor (Qwen-Plus)** redacta fundado en evidencia
> recuperada **por-tema** (RAG-to-write) y el **juez (GLM/z.ai)** verifica + **valida cada afirmación**
> contra la evidencia (verificación atómica). **Gate determinista** hace cumplir los invariantes (incluido
> el VALOR de cada cifra contra `facts.yaml` y la **disciplina de ids**). Estrategia:
> [`../BRAIN_STRATEGY.md`](../BRAIN_STRATEGY.md). Rutas relativas a `littlefounders_brain/rag-llm-brain/`.

## 0. Pipeline (por documento)

> **v4 (vigente):** las etiquetas de abajo describen el flujo v2/v3.1. Diferencias v4 a tener en cuenta:
> el planner/mapa es **DeepSeek V4**; el autor es **Qwen-Plus** y escribe con **RAG-to-write** (②, evidencia
> recuperada POR-TEMA vía `tools/evidence_rag.py`, no de memoria); el juez es **GLM/z.ai** (⑤) y se le suma
> un paso de **verificación atómica** NLI (`tools/atomic_verify.py`): cada afirmación se chequea contra la
> evidencia (supported/contradicted/unverifiable; `factscore<0.80` o contradicha ⇒ revise); el STOP es por
> **cobertura VERIFICADA** (⑧, no por MB). Diseño canónico v4: [`../ARCHITECTURE_V4.md`](../ARCHITECTURE_V4.md).

```
build_evidence.py (NotebookLM)  → por (país,dominio): siembra fuentes .gov + deep-research →
                                  extrae fulltext → caché knowledge/evidence/<país>/<dominio>/
build_dataset.py (DeepSeek V4 + Qwen-Plus + GLM):
  ① PLANNER     → temas EXHAUSTIVOS por (país,dominio,subdominio)   [DeepSeek V4 / concept_map.yaml]
  ② AUTHOR      → RAG-to-write: funda en EVIDENCIA recuperada POR-TEMA → cuerpo ES/EN, @fact, fuentes [Qwen-Plus]
  ③ ENSAMBLE    → frontmatter determinista + registra fuentes + sentinels @fact   (código, no IA)
  ④ GATE        → schema · firewall país/idioma · vocab por edad · citas · DISCIPLINA de ids → revise loop
  ⑤ JUDGE       → rúbrica (pedagogía/coherencia/jurisdicción) [GLM/z.ai]
       + VERIFICACIÓN ATÓMICA → cada afirmación vs evidencia (NLI) → revise; si no converge → status: draft
  ⑥ ESCRIBE status: review (humano aprueba) ; checkpoint = existencia del par .es/.en
  ⑦ CRÍTICO completitud (loop-until-dry) → más temas hasta cubrir el subdominio
  ⑧ STOP AUTOMÁTICO = COBERTURA verificada agotada (recorrió el concept_map). El gate+eval globales son
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
- `.env` (gitignored): en **v4** se requieren credenciales de **Qwen** (autor), **GLM/z.ai** (juez + verificación
  atómica) y **DeepSeek** (planner/mapa). Plantilla: `.env.example`. (v2 sólo exigía `QWEN_API_KEY`/`QWEN_BASE_URL`.)
- NotebookLM: cookies en `.notebooklm/storage_state.json` (gitignored). Modelos en `_meta/build_policy.yaml`
  (**v4**: planner=`deepseek-v4-flash`, autor=`qwen-plus`, juez+verificación atómica=`glm-4.6`; la nota
  histórica de abajo decía **qwen-flash** para autor+juez en v2).

## 2. Ejecución (en orden)

```bash
cd littlefounders_brain/rag-llm-brain

# (A) GROUNDING curado con NotebookLM — una vez por (país,dominio). LENTO (deep-research 15-30 min/dominio).
nohup ./.venv/bin/python knowledge/tools/build_evidence.py --all > knowledge/evidence.log 2>&1 &
#     slice: build_evidence.py --only mx/taxes   ·   rápido (sin deep-research): --no-research
#     monitorear:  find knowledge/evidence -name '*.md' | wc -l   ·   du -sh knowledge/evidence/*
#     (un (país,dominio) con 0 archivos = el autor caerá a qwen_search; menos rigor, no es fatal)

# (B) GENERACIÓN autónoma (v4: planner DeepSeek V4 + autor Qwen-Plus RAG-to-write + juez/verif. atómica GLM).
#     Reanudable; concurrente. (v2 usaba Qwen-Flash como autor+juez.)
nohup ./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 > knowledge/build.log 2>&1 &

# (C) Verificación + reindex (COMPUERTAS MANUALES de calidad)
./.venv/bin/pip install fastembed                                        # para el embedder real de producción
# v4: índice PROD con embedder REAL mpnet (paraphrase-multilingual-mpnet-base-v2, 768d; rechaza 'hash').
./.venv/bin/python knowledge/tools/build_index.py --production --embedder fastembed
./.venv/bin/python knowledge/tools/gate_kb.py --strict-facts             # v4: + DISCIPLINA de ids (valor canónico)
./.venv/bin/python knowledge/eval/run_kb_eval.py
```

### Monitoreo (mientras corre)
- **`build_dataset.py --status`** (en cualquier momento; lee el disco, no necesita el proceso) → **cobertura verificada**
  vs `concept_map.yaml` + ✓/espacio por subdominio + grounding/drafts. Es la fuente de verdad de cobertura. (v2 mostraba tamaño vs meta MB.)
- **`tail -f knowledge/build.log`** — líneas por doc: `built_ok(scores=...)` (aceptado), `exists` (ya estaba), `needs_review(...)` (cuarentena draft), `!! error en c/d/s` (subdominio abortado). Con `--workers>1` el log entrelaza hilos.
- Vigilancia rápida: `grep -c needs_review knowledge/build.log` · `grep '!!' knowledge/build.log`.
- **Señal de FIN:** aparición de la línea final de `status()` + `usage total={...}` en build.log.

## 3. Criterios de STOP / profundidad  →  `_meta/build_policy.yaml`

- **STOP automático del build (v4)** = **cobertura VERIFICADA agotada** (`stop_on: coverage`): recorrió el
  `concept_map.yaml` y sólo cuentan los docs **verificados** (no drafts). El `gate_kb` y `run_kb_eval` (incl.
  la suite de FUGA, bloqueante) son **compuertas MANUALES** del paso C, no las corre el build. *(v2 paraba por
  `targets.total_size_mb` — STOP-por-MB, ya retirado.)*
- **Profundidad:** `depth.min_docs_per_subdomain` (8) + `completeness.dry_rounds_to_stop` (2): el crítico sigue proponiendo subtemas hasta 2 rondas sin nada nuevo. Mientras quede cobertura del mapa sin atender, sigue profundizando.
- `quality_bar` (factual=5, país=5, resto≥4): por debajo → revise loop; si no converge → `status: draft`.
- **v4 — verificación atómica** (`quality_bar.atomic_verify`): `min_factscore` 0.80 y `max_unverifiable_rate`
  0.50 sobre las afirmaciones del doc; por debajo → revise loop. El juez GLM ya no es el único garante factual.

## 4. Costo y tiempo

- **v4 (vigente) — corrida MASIVA ≈ $964 USD** (GLM ~$703 por juez + verificación atómica · Qwen ~$261 por
  autor). El cap de GLM debe subir de **$9 a ~$800** antes de `--run`. La **proyección de costo**
  (`tools/cost_projection.py`, cableada al `preflight.py`) **rehúsa GO** si los caps no cubren la corrida
  completa (para no morir al 3%). Tiempo dominado por NotebookLM (deep-research) + las llamadas DeepSeek/Qwen/GLM
  por ronda. Guía completa de la corrida grande: [`../RUNBOOK_V4.md`](../RUNBOOK_V4.md).
- **Histórico v2 (Qwen-Flash, Singapur: $0.05 in / $0.40 out por Mtok):** ~$0.0035/doc-pareja →
  **100 MB ≈ $40–80**; fase **10 MB ≈ $5–10**. *(Cifras obsoletas: la corrida v4 usa 3 proveedores y verificación
  atómica; el costo real es el de arriba.)*

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
- **Rigor del juez (v4):** el juez es **GLM/z.ai (glm-4.6)** y se complementa con **verificación atómica** NLI
  (`tools/atomic_verify.py`): cada afirmación se valida contra la evidencia, así que el juez ya no es el único
  garante factual. *(Nota histórica v2: cuando el juez era Qwen-Flash listaba falsos positivos en `wrong_facts`
  que el pipeline filtraba en `_real_wrong`; se mitigaba subiendo el rol `judge` a `qwen-plus-latest`.)*
- **Embedder (v4 producción):** usar `build_index.py --production --embedder fastembed` → embedder **REAL mpnet**
  (`sentence-transformers/paraphrase-multilingual-mpnet-base-v2`, 768d; fallback MiniLM-L12-v2, 384d). El modo
  `--production` **rechaza el embedder `hash`**. El `meta` del kb.db registra `embed_backend`; índice y retriever
  deben usar el mismo. *(El `hash` determinista de v2 servía sólo para gate/eval rápidos, no para retrieval real.)*
- **Reanudar:** el único checkpoint es la existencia del par `.es/.en`. Para forzar regeneración de un doc, borra sus `.md`. El gate detecta `.en` sin par `.es`.
