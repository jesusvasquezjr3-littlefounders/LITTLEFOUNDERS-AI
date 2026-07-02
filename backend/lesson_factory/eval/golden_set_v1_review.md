# Golden set v1 — hoja de revisión (PROVISIONAL)

> Estado: **pendiente de tu aprobación/ajuste.** Las columnas DET (deterministas) son exactas; las de juicio (Eng/Prof/And/Voz 1-5 + hard-fails) son provisionales y **sesgadas por la etiqueta** — ajústalas.

> Cómo ajustar: edita `eval/golden_set_v1.json` → en cada entrada pon `human_approved: true` y, si cambias algo, ponlo en `human_overrides`.

> Caveat: Las dims de juicio fueron calificadas por un agente LLM que VIO la etiqueta (exemplar/known_bad/baseline), lo que sesga los puntajes. Para la calibración final del juez, re-calificar A CIEGAS (sin label). Estos ratings son el DRAFT que el humano aprueba/ajusta; la versión humana corregida es el ancla real (objetivo kappa>=0.6).


DET = hard-fail determinista (S=estructura, A=abstracción, V=vocabulario, F=feedback). HF = hard-fail de juicio.

| # | Lección | Banda | Tipo | DET fails | HF juicio | Eng | Prof | And | Voz | Resumen |
|---|---------|:-----:|------|-----------|-----------|:---:|:----:|:---:|:---:|---------|
| g001 | 1-3-31-14 | 1 | baseline | F | — | 3 | 3 | 3 | 3 | Competent, factually clean band-1 change-checking lesson with a full hook-to-close arc and |
| g002 | 1-4-41-4 | 1 | baseline | — | — | 3 | 3 | 3 | 3 | Solid, accurate band-1 needs-vs-wants lesson with explicit teaching, a clean arc and good  |
| g003 | 2-2-11-10 | 2 | baseline | A | — | 2 | 4 | 4 | 3 | Accurate, conceptually solid band-2 fixed-expenses practice lesson with good depth and ris |
| g004 | 2-3-26-5 | 2 | baseline | — | — | 4 | 4 | 4 | 4 | The standout of the batch: a curiosity-led, factually sound $99-trap lesson with a real me |
| g005 | 2-1-3-9 | 2 | baseline | A | — | 3 | 4 | 4 | 3 | A rich, accurate band-2 price-vs-quality lesson with strong cost-of-ownership transfer and |
| g006 | 2-1-1-7 | 2 | baseline | — | — | 2 | 3 | 3 | 3 | Competent, factually clean addition drill with a real arc and guiding feedback, but a flat |
| g007 | 3-5-34-2 | 3 | baseline | A | — | 3 | 4 | 4 | 3 | A solid, accurate diversification lesson with a real teach-then-build arc and a genuine co |
| g008 | 3-5-35-1 | 3 | baseline | A | — | 3 | 4 | 4 | 3 | A rich, accurate investment-fundamentals review with strong format variety and a standout  |
| g009 | 3-3-21-7 | 3 | baseline | F | — | 4 | 4 | 3 | 3 | An engaging, accurate real-world application of fine-print skills with strong scenario hoo |
| g010 | 3-3-21-6 | 3 | baseline | — | — | 3 | 4 | 4 | 3 | The clean teaching foundation of the fine-print pair: accurate, well-scaffolded from defin |
| g011 | 4-2-16-2 | 4 | baseline | A | — | 2 | 4 | 3 | 3 | Competent band-4 integration review with accurate math and explanatory feedback, but flat  |
| g012 | 4-4-28-9 | 4 | baseline | F | — | 2 | 4 | 4 | 3 | Solid, accurate risk-profile application lesson with good variant practice and decreasing  |
| g013 | 4-1-1-9 | 4 | baseline | — | — | 3 | 5 | 4 | 3 | Strong, transfer-focused 50/30/20 lesson that teaches the rule then applies it to realisti |
| g014 | 4-2-11-10 | 4 | baseline | A | — | 3 | 5 | 4 | 4 | The strongest band-4 lesson: accurate, builds three pricing methods into genuine multi-con |
| g015 | 5-1-3-7 | 5 | baseline | — | — | 4 | 4 | 4 | 5 | A standout baseline: accurate Mexico-specific AFORE content with a vivid metaphor hook, ma |
| g016 | 5-5-30-10 | 5 | baseline | — | — | 3 | 4 | 3 | 3 | Solid, accurate capstone on Mexican corporate structures with a complete HOOK-LEARN-APPLY- |
| g017 | 5-4-26-1 | 5 | baseline | — | — | 4 | 4 | 4 | 3 | A strong, accurate FIBRAS/REITs lesson with a vivid hook, well-scaffolded teach-then-apply |
| g018 | 5-4-24-3 | 5 | baseline | — | — | 3 | 4 | 4 | 3 | Accurate, well-structured CETES lesson that goes beyond naming facts to teach the risk-fre |
| g019 | 6-1-1-3 | 6 | baseline | — | — | 2 | 4 | 3 | 3 | A factually sound synthesis lesson that genuinely integrates and transfers four money prin |
| g020 | 6-2-12-9 | 6 | baseline | — | — | 3 | 4 | 4 | 3 | A genuinely advanced, accurate estate-planning lesson with strong teach-then-apply scaffol |
| g021 | 6-5-28-10 | 6 | baseline | F | — | 3 | 4 | 3 | 3 | Competent, factually sound band-6 baseline on social impact/ESG with real transfer items ( |
| g022 | 6-6-38-10 | 6 | baseline | F | — | 2 | 3 | 3 | 3 | A factually sound, well-shaped but engagement-poor band-6 baseline whose single thesis ('i |
| g023 | 1-1-1-1 | 1 | exemplar | — | — | 5 | 4 | 5 | 5 | An exemplary band-1 lesson: mystery-driven hook, warm distinctive Liruf voice, explicit de |
| g024 | 1-1-2-8 | 1 | exemplar | — | — | 5 | 5 | 5 | 5 | A model band-1 exemplar: predict-then-reveal misconception hook, self-aware Liruf voice, e |
| g025 | 1-1-2-8 | 1 | known_bad | A | fact,peda,feed | 2 | 2 | 2 | 3 | A known-bad band-1 baseline that fails all three hard-fail checks: out-of-band $50/$100 va |
| g026 | 3-5-30-5 | 3 | known_bad | SA | — | 2 | 3 | 2 | 2 | A factually sound, structurally complete band-3 risk-return lesson whose 'known_bad' weakn |

## Medias por tipo (dims puntuadas, provisional)

- **baseline**: engagement 2.91 · profundidad 3.91 · andamiaje 3.59 · voz 3.18
- **exemplar**: engagement 5 · profundidad 4.5 · andamiaje 5 · voz 5
- **known_bad**: engagement 2 · profundidad 2.5 · andamiaje 2 · voz 2.5