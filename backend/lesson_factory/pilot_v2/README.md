# Piloto Lesson Factory v2 — Adventure 1

> **Estado:** PILOTO PARA REVISIÓN. No publicado a la BD. No sobrescribe el corpus.
> **Fecha:** 2026-06-18
> Ver la estrategia completa en [`../V2_STRATEGY.md`](../V2_STRATEGY.md).

## Qué es esto

Dos lecciones de Adventure 1 (5-7 años, personaje Liruf) **regeneradas con el proceso integrado** (el agente como fábrica: planner → autor → crítico), aplicando la **rúbrica v0** y el **esquema aditivo v2**. Es la "prueba de la fábrica" en pequeño antes de escalar.

| Archivo | Lección | Comparar contra (corpus actual) |
|---------|---------|-------------------------------|
| `1-1-1-1.json` | Bienvenida / conocer a Liruf | `lesson_engine/littlefounders_lessons/adventure_1/saga_1/topic_1/lesson_1.json` |
| `1-1-2-8.json` | El tamaño no es valor | `lesson_engine/littlefounders_lessons/adventure_1/saga_1/topic_2/lesson_8.json` |

## Cómo validar (gate real)

```bash
cd backend/lesson_factory
python3 - <<'PY'
import json, sys; sys.path.insert(0, ".")
import validate as v
rules = v.load_rules()
for f in ["pilot_v2/1-1-1-1.json", "pilot_v2/1-1-2-8.json"]:
    r = v.validate_lesson(json.load(open(f)), rules)
    print(f, "PASSED:", r.passed, "| errors:", r.errors or "ninguno", "| warnings:", r.warnings or "ninguno")
PY
```

Resultado actual: **ambas PASSED, sin errores ni warnings.** Paridad ES/EN ✓, solo tipos permitidos para Adventure 1 ✓, valores monetarios ≤20 ✓ (la versión previa de `1-1-2-8` usaba $50/$100, violando `content_rules.numbers.max_value`).

## Qué mejora vs. el corpus actual (before → after)

| Dimensión | Antes (corpus actual) | Después (piloto v2) |
|-----------|----------------------|---------------------|
| **Hook / curiosidad** | Una línea ("encontré un mapa, ¿exploramos?") | Misterio con meta: cofre **cerrado** que guarda un secreto; en `1-1-2-8`, mecánica de **predicción → revelación** ("yo me equivoqué, ¿adivinas por qué?") |
| **Feedback de error** | A veces genérico ("Casi.", "Hmm") | **Diagnóstico por distractor** (`feedback.per_option`): cada opción equivocada nombra su confusión y corrige |
| **Conexión emocional (SDT)** | Ninguna explícita | Beat de **relación** (Liruf pide ayuda / admite que cayó en la trampa) + cierre que celebra **competencia** ("eres detective del valor") |
| **Enseñanza real** | Nombra hechos | Enseña una **regla aplicable** ("mira el número, no el tamaño") con ejemplo concreto |
| **Misconcepción** | Implícita | **Nombrada explícitamente** ("es una trampa común") — corrección directa |
| **Andamiaje (ZPD)** | Constante | **Decreciente**: `scaffold_level` modeled → guided → independent |
| **Cierre / gancho** | "hasta pronto" | **Conecta** al arco (el cofre brilla) + **anticipa** la próxima lección (monedas) |
| **Rigor numérico** | $50/$100 (viola ≤20) | Todos los valores ≤20 ✓ |
| **Trazabilidad** | Ninguna | `lf_meta.provenance` + tags por ejercicio (concepto, fase, bloom, scaffold) |

## Esquema v2 demostrado (aditivo, retrocompatible)

Todos los campos nuevos son **aditivos** — el frontend ignora lo que no conoce, y `validate.py` sigue pasando:

- **Nivel lección:** `lf_meta` { `schema_version`, `concept_spine`, `phase_map`, `engagement_design`, `provenance` }.
- **Nivel ejercicio:** `phase` (las 6 fases), `engagement_role` (hook/learn/apply/connect), `concept_ids`, `bloom_level`, `scaffold_level`.
- **Feedback:** `feedback.per_option{}` (diagnóstico por distractor), manteniendo `feedback.error` como fallback.

> ⚠️ **Nota de render:** `feedback.per_option` es metadata _forward-looking_. El renderer actual del frontend muestra `feedback.success` / `feedback.error` (que siguen presentes, así que la experiencia actual no se rompe). Consumir `per_option` es una mejora de la **Fase 3** (renderer). Las lecciones renderizan hoy igual que cualquier otra del corpus.

## Auto-puntuación de rúbrica v0 (a calibrar con humanos en Fase 1)

Esta es la **auto-evaluación del autor** (no el juez calibrado — ese llega en la Fase 1). Útil como referencia de intención:

| Criterio | 1-1-1-1 | 1-1-2-8 |
|----------|:------:|:------:|
| 1. Validez estructural (HF) | ✅ | ✅ |
| 2. Techo de abstracción por edad (HF) | ✅ | ✅ |
| 3. Vocabulario / lenguaje (HF) | ✅ | ✅ |
| 4. Exactitud factual (HF) | ✅ | ✅ |
| 5. Forma pedagógica / 6 fases (HF) | ✅ | ✅ |
| 6. Feedback que explica el porqué (HF) | ✅ | ✅ |
| 7. Engagement / hook emocional (S) | Alto | Muy alto |
| 8. Profundidad y transferencia (S) | Media-alta | Alta |
| 9. Andamiaje decreciente (S) | Sí | Sí |
| 10. Tono / voz del personaje (S) | Alto | Alto |

## Qué NO incluye este piloto (a propósito)

- No corre el juez LLM calibrado (Fase 1) ni el corpus-harness de `validateAnswer` del frontend (Fase 2) — esos son infra de fases posteriores.
- No se publica a la BD ni se importa. Eso es decisión humana tras tu revisión.
- Autonomía plena del aprendiz (elegir camino) se realiza en runtime (Fase 6); aquí se aproxima con framing narrativo.
