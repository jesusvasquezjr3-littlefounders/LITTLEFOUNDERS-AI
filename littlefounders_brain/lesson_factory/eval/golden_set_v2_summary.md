# Golden set v2 — split estructurado (para tu aprobación)

> Ratings a ciegas (neutralizado), **provisionales hasta tu aprobación** (ancla humana propuesta).

## A. deterministic_test_set.json — verifica que el gate ATRAPA lo malo (6 lecciones)

| Lección | known_bad_type | atrapado por |
|---|---|---|
| 6-2-12-9 | `hard_fail_factual` | judgment |
| 1-1-2-8 | `hard_fail_abstraction` | deterministic |
| 3-5-30-5 | `hard_fail_structural_and_abstraction` | deterministic |
| 2-2-17-10 | `hard_fail_factual` | judgment |
| 6-1-1-2 | `hard_fail_factual` | judgment |
| 5-3-19-2 | `hard_fail_content_quality` | deterministic |

## B. pedagogical_golden_set.json — calibra el juicio (29 lecciones)

**Cobertura por nivel 1→5 (varianza construida):**

| Dimensión | 1 | 2 | 3 | 4 | 5 |
|---|:-:|:-:|:-:|:-:|:-:|
| engagement_hook | 1 | 5 | 12 | 10 | 1 |
| depth_transfer | 2 | 1 | 11 | 10 | 5 |
| scaffolding_difficulty | 1 | 1 | 8 | 17 | 2 |
| character_voice | 1 | 1 | 11 | 11 | 5 |

**Composición:** {'baseline': 22, 'pilot': 2, 'exemplar': 3, 'fixture_low': 2}


**Hallazgo de varianza:** El corpus FLOTA pedagógicamente en 3 (sin 1s; andamiaje nunca <3). La 'maldad' real es determinista, no pedagógica. El extremo bajo se ancla con fixtures.


## Pendiente para el kappa

1. Tú apruebas/ajustas los ratings (ancla humana).
2. Juez **independiente** (modelo distinto o tú) → kappa ponderado por dimensión ≥0.6.


> Gate nuevo `content_quality` (profanidad/typos vulgares) implementado en run_eval.py — cazó el único 'pedo' del corpus (5-3-19-2).
