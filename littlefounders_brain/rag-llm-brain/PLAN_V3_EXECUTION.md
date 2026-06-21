# PLAN_V3_EXECUTION.md — Plan de ejecución del pipeline v3 (ultradetallado · resume-able)

> **Propósito doble:** (1) guía paso a paso para EJECUTAR el pipeline v3, y (2) registro histórico para
> que cualquier humano o agente IA retome el trabajo sin perder contexto si algo se interrumpe.
> **Estado al 2026-06-21:** TODO LISTO para ejecutar. `preflight.py` da **GO**. **No ejecutado aún**
> (la corrida completa la dispara un humano, por decisión explícita). Diseño en
> [`ARCHITECTURE_V3.md`](ARCHITECTURE_V3.md).
>
> **Ronda 2 (2026-06-21):** (1) **PLANNER/Crítico → DeepSeek V4** (`deepseek-v4-flash`) = 3er proveedor
> independiente (DeepSeek planner / Qwen autor / GLM juez) → más velocidad y diversidad; (2) **STOP por
> COBERTURA** (`stop_on: coverage`), ya no por MB — corre hasta cubrir toda la taxonomía; (3) **presupuesto
> en $** (`budget_usd`) + **alerta de saldo bajo** (`alert_usd_remaining`); (4) **taxonomía ampliada**
> (crypto, metales, bolsa, bonds, real_estate, loans, interest_rates) + **facts.yaml a ~48 cifras**
> verificadas (lote 2: NIIT, coleccionables 28%, wash-sale, SALT 2026, bolsa/dividendos MX, cripto…).

---

## 0. TL;DR — cómo arrancar (cuando se decida ejecutar)

```bash
cd littlefounders_brain/rag-llm-brain
./.venv/bin/python knowledge/tools/preflight.py          # debe decir GO ✅
# corrida completa, autónoma, en background, reanudable:
nohup ./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 \
      > knowledge/build_v3.log 2>&1 &
# vigilar:
tail -f knowledge/build_v3.log
./.venv/bin/python knowledge/tools/build_dataset.py --status
```

Si se interrumpe, **volver a lanzar el mismo comando**: salta lo ya hecho (resume idempotente + caché).

---

## 1. Qué se construyó en esta sesión (2026-06-21) — historial

Rediseño del pipeline del cerebro de v2 (Qwen autor + DeepSeek juez, depth-first, sin verdad de base) a
**v3 (fact-anchored · Qwen+GLM · breadth-first)**. Motivado por un benchmark vs. la industria que
identificó que el cuello de botella era la **verificación factual**, no el retrieval.

Cambios entregados (todos verificados, ver §6):

1. **Cliente multi-proveedor + caché** — `tools/llm_qwen.py`: añade `provider="glm"` (z.ai, búsqueda vía
   tool `web_search`), `provider_for()`, y caché content-addressed de respuestas. Qwen/DeepSeek intactos.
2. **Tabla canónica de hechos** — `_meta/facts.yaml` (NUEVO): 30 cifras de oro MX/US **verificadas con
   fuente primaria + verificación adversarial** (workflow `golden-facts-verify`). Loader
   `tools/facts_table.py`.
3. **Gate valida valores** — `tools/gate_kb.py`: compara cada `@fact` canónico contra `facts.yaml`
   (HARD-FAIL si difiere) + paridad de `@fact` ES/EN.
4. **Juez GLM con búsqueda + evidencia** — `tools/build_dataset.py`: rol juez → GLM (z.ai), recibe la
   evidencia curada, y NO re-checa cifras canónicas (las valida el gate). DeepSeek retirado del rol juez.
5. **Autor anclado** — el autor recibe el bloque de cifras canónicas (copia id+valor) y busca en web solo
   si falta evidencia (uso sabio).
6. **Orquestación breadth-first** — `run_all` por pasadas (cap `[2,4,8]`): amplitud total antes que
   profundidad.
7. **Robustez** — escritura atómica, `index/build_state.json`, `--retry-drafts`, presupuesto de tokens,
   tolerancia a fallo por subdominio, backoff de red.
8. **Auditoría + frescura** — `tools/preflight.py` (GO/NO-GO) y `tools/update_facts.py` (agente de
   actualización atómica, cron-ready).
9. **Config** — `_meta/build_policy.yaml` reescrito a v3 (models, breadth, wise_use, run/resume).
10. **Credenciales** — `ZAI_API_KEY`/`ZAI_BASE_URL` en `.env` (gitignored).

Cifras volátiles 2026 confirmadas y sembradas en `facts.yaml` (las que el pipeline v2 erraba): salario
mínimo MX **315.04**/frontera **440.87**, UMA **117.31**, Banxico **6.50%**; US std deduction
**$16,100/$32,200**, SS wage base **$184,500**, 401(k) **$24,500**, IRA **$7,500**, HSA **$4,400/$8,750**,
CTC **$2,200**, **1099-NEC subió a $2,000** (OBBBA), 1099-K revertido a $20,000+200, fed funds **3.50–3.75%**.

---

## 2. Pre-requisitos (ya satisfechos)

- `.venv` con `pyyaml` (y `fastembed` opcional para el índice). Solo stdlib para los clientes LLM.
- `.env` con `QWEN_API_KEY`, `QWEN_BASE_URL`, `ZAI_API_KEY`, `ZAI_BASE_URL` (gitignored).
- `knowledge/evidence/` con 657 archivos de grounding curado (opcional; si falta, el autor busca en web).
- `preflight.py` → **GO**.

---

## 3. Procedimiento de ejecución (paso a paso)

1. **Preflight (obligatorio).** `./.venv/bin/python knowledge/tools/preflight.py` → debe ser **GO**.
   Si NO-GO, resolver el check duro que falle (credenciales / facts PENDING / gate rojo) antes de seguir.
2. **Smoke de 1 doc (recomendado antes de la corrida larga).** Verifica el cableado escribiendo UN doc:
   ```bash
   ./.venv/bin/python knowledge/tools/build_dataset.py --only mx/taxes/consumption_tax --max-docs 1
   ./.venv/bin/python knowledge/tools/gate_kb.py mx/taxes/consumption_tax   # debe quedar VERDE
   ```
   Inspeccionar el `.es.md`/`.en.md` generado. Si se ve bien, continuar; si no, ajustar y borrar el doc.
3. **Corrida completa (autónoma, background, reanudable).**
   ```bash
   nohup ./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 \
         > knowledge/build_v3.log 2>&1 &
   ```
   Hace breadth-first: pasada 1 cubre todas las celdas a 2 docs, luego profundiza hasta 10 MB.
4. **Supervisión (solo errores).** `tail -f knowledge/build_v3.log` y `--status`. Señales sanas:
   `built_ok` frecuente, pocos `draft`, `error en <celda>` raro. No intervenir si corre limpio.
5. **Al terminar (meta de tamaño o cobertura).**
   ```bash
   ./.venv/bin/python knowledge/tools/gate_kb.py                 # corpus completo VERDE
   ./.venv/bin/python knowledge/tools/build_index.py --embedder fastembed   # índice (NO usar 'hash' en prod)
   ./.venv/bin/python knowledge/eval/run_kb_eval.py             # golden + fuga + frescura
   ```
6. **Revisión humana de drafts (cola del SME).** `--status` muestra el conteo de `draft`. Cada draft es
   una cifra/afirmación que no convergió: un contador/fiscalista la valida, corrige el doc, y lo promueve.
7. **Publicación.** Promover `review → published` SOLO tras aprobación humana. **Nada se auto-publica.**

---

## 4. Resume tras interrupción (corte de luz, kill, error fatal)

El pipeline es **reanudable por diseño**. Para continuar:

```bash
nohup ./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 \
      >> knowledge/build_v3.log 2>&1 &
```

Qué garantiza el resume:
- Cada doc ya en disco se **salta** (`exists`); la corrida continúa donde quedó.
- La **caché LLM** evita re-pagar las llamadas ya hechas (autor/juez) de docs en proceso.
- La **escritura atómica** asegura que un corte a mitad de escritura no dejó un doc corrupto.
- `index/build_state.json` y `index/build_log.jsonl` son el journal de progreso (observabilidad).

Para **reintentar los drafts** (regenerarlos en vez de saltarlos):
```bash
./.venv/bin/python knowledge/tools/build_dataset.py --run --workers 8 --retry-drafts
```

Si no hay journal y se quiere empezar de cero un subárbol: borrar esa carpeta bajo `mx/ us/ shared/` y
re-lanzar (el resto se respeta).

---

## 5. Rollback / abortar

- **Abortar la corrida:** `pkill -f build_dataset`. El corpus queda consistente (escritura atómica); el
  resume retoma después.
- **Descartar lo generado en v3 (volver al baseline piloto):** los docs nuevos son archivos sin commitear
  bajo `mx/ us/ shared/`; `git status` los lista. `git clean -fd` en esas rutas (con cuidado) o borrarlos.
  El piloto de 22 docs (committeado) es el baseline seguro.
- **Revertir el código v3:** los cambios viven en la rama `feat/lesson-factory-v2`; `git revert`/`git
  checkout` del commit v3.

---

## 6. Verificaciones ya realizadas (evidencia de readiness)

| Check | Resultado |
|-------|-----------|
| Compilan todos los tools (`py_compile`) | ✓ |
| `preflight.py` completo (con red) | **GO ✅** (ping autor Qwen, ping juez GLM, búsqueda GLM "IVA 16%", gate verde, 27 cifras canónicas, evidencia 657) |
| GLM vía z.ai responde + búsqueda web | ✓ (glm-4.6 y glm-4.7) |
| Gate v3 sobre corpus actual | ✓ VERDE (38 docs, 0 HARD) |
| Comparación canónica dispara | ✓ (`mx.iva.frontera`=8% pasa; 15%≠16% falla) |
| `facts.yaml` carga | ✓ 30 hechos, 27 enforced, 0 PENDING |
| Cableado autor→juez (dry-run, sin escribir corpus) | ✓ autor usa ids canónicos; juez GLM devuelve scores/verdict parseados |
| `update_facts.py --due / --affected` | ✓ |

---

## 7. Limitaciones conocidas / próximos pasos

- **Embedder por defecto = `hash`** (placeholder sin semántica) en `build_index.py`. Para servir el RAG en
  producción usar `--embedder fastembed` o migrar a `bge-m3`. No bloquea la *construcción* del corpus.
- **Drafts sin UI:** la cola de revisión humana es por ahora `--status` + `build_log.jsonl`. Falta UI mínima.
- **`update_facts.py` no está en cron:** correrlo manualmente o agendarlo (semanal) cuando se decida.
- **Fase 100 MB:** subir `targets.total_size_mb` a 100 y re-correr (mismos gates/juez/facts).
- **Cifras de banco central** (Banxico, fed funds) en `facts.yaml` son de alta volatilidad; evitar citarlas
  en docs salvo con fecha explícita (el autor está instruido así).

---

## 8. Comandos de referencia rápida

```bash
# auditoría
knowledge/tools/preflight.py [--no-net]
# construir
knowledge/tools/build_dataset.py --status
knowledge/tools/build_dataset.py --plan-only mx/taxes/income_tax
knowledge/tools/build_dataset.py --only mx/taxes/income_tax --max-docs 2
knowledge/tools/build_dataset.py --run --workers 8 [--retry-drafts]
# verdad de base / frescura
knowledge/tools/facts_table.py [--verified]
knowledge/tools/update_facts.py --due | --verify [--all] | --affected <fact_id>
# calidad / índice
knowledge/tools/gate_kb.py [subárbol]
knowledge/tools/build_index.py --embedder fastembed
knowledge/eval/run_kb_eval.py
```
(prefijar todos con `./.venv/bin/python`)
