# Golden set v1.1 — calificación A CIEGAS (para tu aprobación)

> Re-calificado sobre copias neutralizadas (sin etiqueta ni metadata v2). `blind_judgment` es ahora el rating primario, SIN sesgo de etiqueta. `labeled_avg` se deja como referencia del sesgo medido.

> Aprobar/ajustar: edita `eval/golden_set_v1.1.json` (pon `human_approved:true` y cambios en `human_overrides`), o dime los ajustes.

> Sesgo medido: baseline +0.09 (sin inflación sistémica) · exemplar -0.88 (los pilotos SÍ estaban inflados por la etiqueta) · known_bad +1.37 (su 'maldad' es DETERMINISTA, no pedagógica)


DET = hard-fail determinista (S/A/V/F). E/D/A/V = engagement/depth/scaffolding/voice a ciegas (1-5). Δ = ciego − etiquetado.

| # | Lección | Bnd | Tipo | DET | E | D | A | V | ciego | Δ | nota |
|---|---------|:--:|------|-----|:-:|:-:|:-:|:-:|:----:|:--:|------|
| g017 | 5-4-26-1 | 5 | baseline | — | 4 | 4 | 4 | 3 | 3.75 | +0.0 |  |
| g013 | 4-1-1-9 | 4 | baseline | — | 3 | 4 | 4 | 3 | 3.5 | -0.25 |  |
| g010 | 3-3-21-6 | 3 | baseline | — | 3 | 4 | 4 | 3 | 3.5 | +0.0 |  |
| g026 | 3-5-30-5 | 3 | known_bad | SA | 4 | 4 | 4 | 3 | 3.75 | +1.5 | hard_fail_structural (det: correct_answer stri |
| g020 | 6-2-12-9 | 6 | baseline | — | 3 | 4 | 3 | 3 | 3.25 | -0.25 |  |
| g007 | 3-5-34-2 | 3 | baseline | A | 3 | 4 | 4 | 3 | 3.5 | +0.0 |  |
| g006 | 2-1-1-7 | 2 | baseline | — | 3 | 3 | 4 | 4 | 3.5 | +0.75 |  |
| g011 | 4-2-16-2 | 4 | baseline | A | 2 | 4 | 4 | 3 | 3.25 | +0.25 |  |
| g016 | 5-5-30-10 | 5 | baseline | — | 3 | 4 | 4 | 3 | 3.5 | +0.25 |  |
| g023 | 1-1-1-1 | 1 | exemplar | — | 4 | 3 | 3 | 5 | 3.75 | -1.0 |  |
| g012 | 4-4-28-9 | 4 | baseline | F | 2 | 4 | 4 | 3 | 3.25 | +0.0 |  |
| g019 | 6-1-1-3 | 6 | baseline | — | 3 | 5 | 4 | 4 | 4 | +1 | exemplar_candidate (sacó 5 a ciegas) |
| g002 | 1-4-41-4 | 1 | baseline | — | 4 | 3 | 4 | 5 | 4 | +1 | exemplar_candidate (sacó 5 a ciegas) |
| g015 | 5-1-3-7 | 5 | baseline | — | 3 | 4 | 4 | 4 | 3.75 | -0.5 |  |
| g024 | 1-1-2-8 | 1 | exemplar | — | 5 | 3 | 4 | 5 | 4.25 | -0.75 |  |
| g014 | 4-2-11-10 | 4 | baseline | A | 3 | 4 | 4 | 3 | 3.5 | -0.5 |  |
| g003 | 2-2-11-10 | 2 | baseline | A | 2 | 3 | 3 | 3 | 2.75 | -0.5 |  |
| g018 | 5-4-24-3 | 5 | baseline | — | 4 | 5 | 4 | 4 | 4.25 | +0.75 | exemplar_candidate (sacó 5 a ciegas) |
| g025 | 1-1-2-8 | 1 | known_bad | A | 3 | 3 | 4 | 4 | 3.5 | +1.25 | hard_fail_abstraction (det: $50/$100>20); peda |
| g005 | 2-1-3-9 | 2 | baseline | A | 3 | 4 | 4 | 3 | 3.5 | +0.0 |  |
| g022 | 6-6-38-10 | 6 | baseline | F | 2 | 3 | 3 | 3 | 2.75 | +0.0 |  |
| g008 | 3-5-35-1 | 3 | baseline | A | 3 | 4 | 4 | 3 | 3.5 | +0.0 |  |
| g009 | 3-3-21-7 | 3 | baseline | F | 3 | 4 | 3 | 3 | 3.25 | -0.25 |  |
| g001 | 1-3-31-14 | 1 | baseline | F | 3 | 3 | 3 | 4 | 3.25 | +0.25 |  |
| g004 | 2-3-26-5 | 2 | baseline | — | 4 | 4 | 4 | 4 | 4 | +0 |  |
| g021 | 6-5-28-10 | 6 | baseline | F | 3 | 4 | 3 | 3 | 3.25 | +0.0 |  |

## Medias a ciegas por dimensión

- **baseline**: engagement 3 · depth 3.86 · scaffolding 3.73 · voice 3.36
- **exemplar**: engagement 4.5 · depth 3 · scaffolding 3.5 · voice 5
- **known_bad**: engagement 3.5 · depth 3.5 · scaffolding 4 · voice 3.5