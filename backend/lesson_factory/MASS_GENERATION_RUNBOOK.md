# Runbook — Generación masiva (Lesson Factory v3)

> **Estado:** preparación. Pipeline probado en pequeño; aún NO ejecutado a escala. Nada se publica a la BD sin revisión.
> Ver estrategia en [`V2_STRATEGY.md`](V2_STRATEGY.md). **v3 (2026-07)**: generación *taxonomy-pure* (el contrato por tipo se DERIVA de `schema/exercise_registry.json` para los 47 tipos) y *model-agnostic* (LLM inyectable). v1/v2 → `archive/` (referencia).

## El pipeline

```
plan (Opus/planner)
  → generate_v3.py  ── drafter LLM inyectable (JSON, banda-aware, structured)
                    ── contrato de taxonomía DERIVADO del registry (47 tipos, sin drift)
                    ── valida LessonV2
                    ── gate: hard-fails deterministas + validate_answer_keys (claves semánticas)
                    ── retry con feedback del gate (máx 2)
                    ── sella lf_meta.provenance
  → [crítica pedagógica de Opus]  (factual/forma/engagement — capa LLM)
  → revisión humana
  → import_lessons.py (upsert por provenance)  → BD
```

## Componentes (todos en `backend/lesson_factory/`)

| Pieza | Archivo | Rol |
|-------|---------|-----|
| Esquema (fuente única) | `schema/lesson_v2.py` + `schema/exercise_registry.json` | valida estructura + tipos |
| Techo de abstracción | `abstraction_ceiling.json` | hard-fail por edad (Piaget) |
| Taxonomía de conceptos | `concept_taxonomy.json` | spiral / prerequisitos |
| Gate determinista | `gate.py` + `eval/run_eval.py` | bloquea estructura/abstracción/vocabulario/content_quality |
| Rúbrica + juez | `eval/rubric.json` + `eval/judge_prompt.md` | calidad pedagógica (capa Opus) |
| Motor de generación | `generate_v3.py` | drafter (LLM inyectable) + contrato taxonomy-pure derivado del registry + gate + retry + provenance |
| Motores archivados | `archive/generate_v1.py`, `archive/generate_v2.py` | referencia histórica (ver `archive/README.md`) |
| Golden set | `eval/pedagogical_golden_set.json` + `eval/deterministic_test_set.json` | calibración + regresión |
| CI | `.github/workflows/lesson-factory-ci.yml` | gate bloqueante sobre contenido nuevo |

## Cómo correr una regeneración

1. **Planear** (Opus): por cada coordenada a regenerar, producir un `plan` (lesson_code, band, levels, micro_objective, concept_ids, scenario, activity_plan de 6 fases). Para escala: un pase de Opus por *topic* desde `curriculum/adventure_N.json` + `concept_taxonomy.json`.
2. **Generar:** `python3 generate_v3.py --plan planes.json --endpoint <url_openai_compat> --model <id> --key-env <VAR> --out generated_v3/` (acepta lista de planes). Inspecciona el contrato por banda sin llamar al LLM con `--dry-run`.
3. **Gate:** `python3 gate.py "generated_v2/*.json"` (CI lo corre solo). Exit 1 si alguna falla.
4. **Crítica de Opus** (factual/forma/engagement) sobre las que pasan el gate determinista — DeepSeek NO sirve como juez factual (medido: no caza contradicciones). En lote por el agente, o vía API de Opus si hay key.
5. **Revisión humana** de una muestra / de las marcadas.
6. **Import:** `import_lessons.py` con upsert por provenance → solo sube lo nuevo/aprobado.

## La gran optimización: regenerar SOLO lo bajo-la-barra

No regenerar las 2,461. Flujo:
1. Correr el juez (Opus) + gate sobre el corpus actual → puntaje por lección.
2. Regenerar **solo** las que caen bajo el umbral (rúbrica) o fallan un hard-fail.
3. El corpus FLOTA en 3 pedagógicamente (medido) → el objetivo es subir la mediana 3→4+, no arreglar lecciones rotas. Probablemente una fracción necesita regeneración real.

## Costo estimado (DeepSeek drafter)

~$0.004–0.007 por lección (referencia: corrida v1/v2 del audit, ~$9.89 por 2,461). Regenerar solo el subconjunto bajo-la-barra → fracción de eso. Stacking futuro: prompt caching del prefijo estático (esquema+rúbrica+ejemplo) si se migra a la API de Anthropic.

## LISTO ✅ vs PENDIENTE ⏳ para "press go"

**Listo:**
- ✅ Esquema fuente única + registro de tipos (2460/2461 validan).
- ✅ Gate determinista robusto (estructura, abstracción, vocabulario, content_quality) — probado, caza casos reales.
- ✅ Motor `generate_v3.py` (taxonomy-pure derivado del registry + gate + validate_answer_keys + retry + provenance) — contrato verificado en banda 1; gate probado (gold pasa, violación de taxonomía rechazada). Falta cablear el endpoint LLM para una corrida real.
- ✅ Golden set con varianza + deterministic_test_set.
- ✅ CI bloqueante sobre contenido nuevo.

**Pendiente para escala desatendida:**
- ⏳ **Planner automático (Opus por topic).** Hoy los planes se autoran a mano/por el agente. Para miles, automatizar el pase de planeación.
- ⏳ **Juez Opus programático.** DeepSeek no juzga rigor factual (medido). El juicio corre por el agente en lotes, o requiere **key de Anthropic** para escala desatendida. (En `audio_factory/.env` hay `DEEPSEEK_API_KEY`; NO hay key de Anthropic local.)
- ⏳ **Cola de escalación.** Lecciones que DeepSeek no logra pasar tras 2 retries → autoría por Opus. (Patrón: persistent-failure → human/stronger queue.)
- ⏳ **Kappa anclado en humano** para fijar el umbral de calidad con confianza (el inter-LLM dio engagement κ=0.61; resto moderado).
- ⏳ **import_lessons.py → upsert por provenance** (hoy es wipe-reload).

## Modelo de ejecución recomendado (dado que no hay key de Opus local)

Generación **local supervisada en lotes** (consistente con la decisión del proyecto): el agente actúa como planner + crítico Opus por lote, DeepSeek redacta, el gate filtra, el humano revisa el lote, se publica. Escala por lotes a través de la sesión, no desatendido. Para desatendido masivo: añadir key de Anthropic y automatizar planner+juez.
