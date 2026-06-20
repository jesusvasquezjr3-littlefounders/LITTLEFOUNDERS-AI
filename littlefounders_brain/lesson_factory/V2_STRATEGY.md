# Lesson Factory v2 — Estrategia

> **Estado:** PROPUESTA PARA REVISIÓN (no implementada).
> **Fecha:** 2026-06-18
> **Autoría:** Construido sobre la auditoría del Lesson Factory (2026-06-17) + investigación de ciencia del aprendizaje, teardown de competidores, ingeniería de generación con LLM y due-diligence de herramientas.
> **Propósito:** Definir cómo construir un Lesson Factory de alta calidad que produzca un currículo de educación financiera 5→18+ capaz de "trascender el aprendizaje gamificado". Generación **local y supervisada**; solo se publican resultados a la BD.

---

## 1. Diagnóstico (la causa raíz)

> **No es un problema de generación. Es un problema de _medición_ que esconde un problema de calidad.**

Hechos verificados en el código:

- `generate.py` **nunca importa** `validate.py`. Ni el único gate que existe corre durante la generación.
- `validate.py` tiene ~33 chequeos `content_nonempty` (solo verifican que un campo no esté vacío). El "84.2% de calidad" es **relativo al validador** y no mide casi nada.
- DeepSeek V3 a `temperature 0.7` **sin semilla** → no reproducible; **156 volcados** de JSON roto en `debug/`.
- Bucle `cycle_idx % 4` que **rellena** la lección reformulando el mismo dato trivial — origen mecánico de lo "aburrido".
- **Tres definiciones divergentes** de "lección válida": currículo (~6 tipos) / `validate.py` (40 tipos, 3 claves de respuesta) / frontend `validateAnswer` (~56 tipos, ~80 alias). Sin esquema compartido.

**Consecuencia estratégica:** cualquier mejora es invisible hasta que exista una forma de medir. De ahí la **regla de oro**: *no se regenera el corpus hasta que la calidad sea un número confiable.*

---

## 2. Modelo de operación (local, integrado, supervisado)

Decisión central de arquitectura (confirmada con el equipo):

- **El agente _es_ la fábrica.** El generador es el agente Claude (Opus 4.8) + subagentes/Skills corriendo **localmente**, integrados con el Lesson Factory. No se monta ni se paga una "API extra de Claude" desplegada; se usa la sesión de Claude Code existente. El loop generador→crítico→editor son subagentes.
- **Flujo:** _generar en local → revisión humana → publicar a la BD._ Nada de esto se despliega en la nube; solo se publican lecciones terminadas.
- **Híbrido por costo/calidad (reparto de roles):** el trabajo de alto volumen (redactar JSON) va a **DeepSeek** (barato); mi uso (Opus) se concentra en las piezas chicas y de alta palanca: **planear, criticar y juzgar**. Un juez NO crea calidad, solo la filtra — por eso DeepSeek debe ir acompañado de (1) un **plan** fuerte (lo hace Opus) y (2) un **loop de crítica accionable** (Opus), no de un juicio final a secas. El corpus mediocre actual fue DeepSeek one-shot sin plan/crítica/structured-outputs/gate; el nuevo andamiaje es justo lo que faltaba.
  - **Planner = Opus** (poco token, máxima palanca: concepto, hook, misconcepción, fases, andamiaje).
  - **Redactor = DeepSeek** (llena el plan en JSON bilingüe). Default Adventures 1-3.
  - **Crítico = Opus** (defectos específicos accionables; loop máx 2 revisiones).
  - **Juez final + gate = Opus + validate.py** (modelo distinto del redactor → evita sesgo de auto-preferencia).
  - **Escalación a autor = Opus** si DeepSeek no pasa la barra tras 2 intentos, o por default en Adventures 5-6 (abstracto/factual/voz).
  - **La frontera DeepSeek↔Opus se decide por DATOS** (A/B por banda con la rúbrica+golden set de la Fase 1), no por suposición.
- **Optimización clave:** medir primero y **regenerar solo lo que esté bajo la barra** (vía _provenance_), por tipo. Probablemente solo una fracción del corpus necesita rehacerse.

---

## 3. Decisiones (conciliadas)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Presupuesto de generación | **Híbrido.** Agente = calidad/ruta crítica; borrador barato local = volumen trivial. Optimizar regenerando solo lo malo. |
| 2 | Revisión | **Revisión humana antes de publicar.** El modelo es _genera local → revisas → publica_. |
| 3 | Auto-aprobado del juez | El juez **no publica solo**: es un **asistente de triaje** que ordena/marca para que la revisión humana sea rápida y enfocada. |
| 4 | Fase 6 (adaptación runtime) | Se aborda **una vez probada la fábrica**. |
| 5 | NotebookLM | **Sí, uso local.** Construye la base de conocimiento local para aterrizar hechos (10+); se espejan los extractos verificados a un store local. Cero dependencia en la nube/runtime; solo se publican lecciones. |
| 6 | Bilingüe | **Separado.** ES canónico → traducir-y-verificar EN como paso aparte con su propio gate. |

---

## 4. Los 6 pilares

1. **Un solo esquema (fuente única de verdad).** Modelo Pydantic v2 versionado (`schema/lesson_v2.py`) con un registro cerrado de tipos; del modelo se _generan_ los tipos de TypeScript del frontend y el JSON Schema que alimenta al validador. Colapsa la divergencia 6/40/56.
2. **La calidad es un número, con gate en CI.** Rúbrica analítica de ~10 criterios + _golden set_ humano (40-60) + juez LLM calibrado (Cohen's kappa) + GitHub Actions que rompe el build si hay regresión.
3. **Loop cerrado con structured outputs.** Generación con salida estructurada (cero JSON roto por construcción) dentro de un loop acotado planner→escritor→crítico-pedagógico→editor (máx 2 refinamientos; fallos persistentes → cola humana). Un **planner por-ejercicio** mata el relleno `cycle_idx % 4`.
4. **Pedagogía y engagement como datos exigibles, no prosa.** Forma `HOOK→APRENDE→APLICA→CONECTA`; feedback elaborado por distractor; `concept_ids` a profundidad creciente (espiral de Bruner); `scaffold_level` decreciente (andamiaje que se retira, Vygotsky); **techo de abstracción por edad** como _hard-fail_ (Piaget).
5. **Provenance + regeneración por lotes repetible.** Sello `{prompt_version, schema_version, model_id, judge_scores...}` en cada lección → cualquier mala es atribuible y la regeneración solo toca lo obsoleto/bajo-la-barra. `import_lessons.py` pasa de _wipe-reload_ a _upsert por provenance_.
6. **El compañero que crece (el foso, al final).** Contenido + personajes que maduran con el mismo niño 5→18 — algo que ningún competidor entrega. Las _casillas_ del esquema van ahora; el _motor de adaptación en runtime_ (Elo/IRT + repaso espaciado FSRS) va de último.

---

## 5. Roadmap por fases (con criterios de salida)

### Fase 0 — Congelar el contrato (esquema + columna de conceptos)
- **Meta:** que "lección válida" tenga UNA sola definición y sentar la base de datos para calidad y adaptación futura.
- **Actividades:** colapsar las 3 definiciones en `schema/lesson_v2.py` (Pydantic v2 — ya es dependencia); registro cerrado de tipos anclado a lo que el grader del frontend ya acepta; campos aditivos/nullables (ver §7); `concept_taxonomy.json` (concept_ids + aristas de prerequisitos); generar tipos TS desde Pydantic; tabla de techo de abstracción por banda.
- **Salida:** las 2,461 lecciones actuales **siguen validando** contra v2; los tipos del frontend se generan del registro; la taxonomía pasa chequeo de ciclos.

### Fase 1 — Medir antes de generar
- **Meta:** convertir la calidad en señal absoluta, calibrada y con test de regresión.
- **Actividades:** rúbrica analítica de ~10 dimensiones (ver §6); _golden set_ congelado de 40-60 lecciones (ejemplares + malas conocidas) revisadas a mano; juez LLM (Opus 4.8, modelo distinto del que redacta); calibrar contra humanos (kappa por criterio); arnés de evals vía `skill-creator`.
- **Salida:** kappa juez-humano ≥ ~0.6 por criterio _hard-fail_; baseline estable; se retira el 84.2% en favor de _media de rúbrica + tasa de hard-fail_.

### Fase 2 — Cero errores de sintaxis + gate real + CI
- **Meta:** eliminar la clase de fallos de parseo y volver el validador un gate duro.
- **Actividades:** generación con structured outputs (JSON garantizado); reconstruir `validate.py` de advisory a **gate duro** (importado en el loop); chequeo de coherencia de respuesta ES↔EN; cap de redundancia (anti-relleno); correr el corpus-harness de `validateAnswer` del frontend; job de CI; rescate de los 156 volcados (~150 lecciones recuperadas).
- **Salida:** cero volcados nuevos; `validate.py` corre en loop y en CI; el build falla ante regresión del golden set.

### Fase 3 — Cerrar el loop, regenerar tipo por tipo
- **Meta:** cada lección supera la barra cuantitativa; matar la mediocridad de raíz.
- **Actividades:** Skills `curriculum-planner`, `lesson-author`, `pedagogy-critic`, `editor`, `json-validator` (vía `skill-creator`), orquestadas con el Agent SDK; **planner por-ejercicio** (cada slot = fase cognitiva + objetivo + concept_id distintos); loop generar→criticar→refinar (máx 2); sellar provenance; regenerar **solo lo bajo-la-barra**, por tipo; engagement como datos (HOOK→APRENDE→APLICA→CONECTA, feedback por distractor, ≥1 beat de autonomía + ≥1 de relación).
- **Salida:** media de rúbrica sobre objetivo; tasa de hard-fail en cero para lo publicado; toda lección atribuible y re-ejecutable.

### Fase 4 — Aterrizar hechos (10+) con RAG propio + studio de revisión
- **Meta:** ningún dato financiero sin respaldo en Adventures 3-6; backstop de triaje para revisión.
- **Actividades:** base de conocimiento **local** con **NotebookLM** (curaduría humana) espejada a un store local (`pgvector` local o SQLite-vector); `fact-checker` Skill que falla afirmaciones numéricas/regulatorias sin respaldo (se omite para 5-9); studio ligero de revisión como **triaje** (no gate por-lección).
- **Salida:** toda afirmación numérica/regulatoria en 3-6 con cita o falla; la cola de revisión es una fracción del corpus; **cero dependencia programática de NotebookLM en la nube**.

### Fase 5 — Economía de escala + re-runs rutinarios
- **Meta:** que una regeneración completa versionada sea un paso de build asequible y repetible.
- **Actividades:** prefijo estático cacheable (esquema + contrato + ejemplo); si se usa la API, Batch (−50%) + prompt caching (−90%); `import_lessons.py` → upsert por provenance; regeneración _gateada_ por provenance (solo obsoleto/bajo-la-barra).
- **Salida:** un rebuild completo corre como build único cacheado; los re-runs tocan solo la rebanada stale/bajo-la-barra.

### Fase 6 — El compañero que crece (motor de adaptación en runtime) — *el foso*
- **Meta:** volver mecanismo lo de "experto en la adultez / crece con el niño".
- **Actividades:** pools de variantes por concepto; servicio FastAPI "Session Generator" (vector de proficiencia por aprendiz, Elo/IRT) que arma sesiones a ~80% de éxito predicho (flow); `recall_events` + FSRS/Half-Life Regression para repaso espaciado; loop correctivo (fallar el gate 80% → `alt_explanation` + `reassess_item`); arco continuo de personajes; dashboard parental anti-gaming.
- **Salida:** un aprendiz que regresa recibe una sesión adaptada a su proficiencia y a su estado de repaso; el mismo concept_id se entrega a profundidad creciente conforme crece.

---

## 6. Rúbrica v0 (borrador para calibrar en Fase 1)

Cada lección se puntúa por dimensión. **HF = hard-fail** (bloquea); **S = puntuada** (umbral).

| # | Dimensión | Tipo | Qué mide |
|---|-----------|------|----------|
| 1 | Validez estructural | HF | Pasa el esquema; tipos válidos; respuestas gradables por el frontend |
| 2 | Techo de abstracción por edad | HF | Nada por encima del estadio de desarrollo de la banda (Piaget) |
| 3 | Vocabulario y lenguaje | HF | Respeta reglas de banda (longitud de oración, palabras prohibidas) |
| 4 | Exactitud factual | HF | Sin afirmaciones financieras falsas (con respaldo en 10+) |
| 5 | Forma pedagógica | HF | Cubre HOOK→APRENDE→APLICA→CONECTA (las 6 fases de la banda) |
| 6 | Feedback que explica el porqué | HF | Sin "Inténtalo de nuevo" vacío; diagnóstico por distractor |
| 7 | Engagement / hook emocional | S | Curiosidad genuina, narrativa, beats de autonomía y relación (SDT) |
| 8 | Profundidad y transferencia | S | Enseña de verdad (no solo nombra); reaparición de concepto en variante |
| 9 | Andamiaje y dificultad | S | Scaffold apropiado y decreciente; reto en la ZPD |
| 10 | Tono y voz del personaje | S | Consistente, cálido, sin condescendencia ("baby-talk") |

**KPI:** media de dimensiones puntuadas + tasa de hard-fail (reemplazan al 84.2%).

---

## 7. Esquema: se conserva, se mejora aditivamente

**Migración, no reescritura.** El sobre actual valida en las 2,461 lecciones — se queda **verbatim**. Solo se añaden campos _nullable_ (para que el corpus siga validando):

**Nivel lección:** `schema_version`.
**Nivel ejercicio (aditivos):** `id`, `concept_ids[]`, `prerequisite_concept_ids[]`, `depth_tier` (1-5), `bloom_level`, `scaffold_level` (`modeled|guided|independent`), `review_of[]`, `engagement_role` (`hook|learn|apply|connect`), `narrative_weight`, `stakes_realism`, `alt_explanation`, `reassess_item`.
**Feedback (aditivo):** `feedback.per_option{}` (diagnóstico por distractor) manteniendo `feedback.error` como fallback.

**Plan de fuente única:** un `LessonV2` Pydantic → (a) genera tipos TS del frontend, (b) exporta JSON Schema para `validate.py` y los structured outputs, (c) registro cerrado de tipos anclado a lo que el grader ya acepta. Los 6 tipos "fantasma" del corpus (`comparison`, `case_study`, etc.) se pliegan a tipos canónicos durante la regeneración por tipo.

> Se adopta el set **completo desde la Fase 0** aunque la adaptación en runtime sea Fase 6 — añadir campos después forzaría una segunda migración del corpus.

---

## 8. Decisiones de herramientas

| Herramienta | Decisión | Razón |
|-------------|----------|-------|
| Esquema | Pydantic v2 (ya es dependencia) → codegen TS | Cero infra nueva; colapsa la divergencia |
| Planner | **Opus 4.8** (local) | Plan = poco token, máxima palanca; aquí nace la calidad |
| Redactor (volumen) | **DeepSeek** | Barato; llena el plan en JSON bilingüe. Default Adventures 1-3 |
| Crítico (loop) | **Opus 4.8** | Defectos específicos accionables; máx 2 revisiones |
| Juez final + escalación a autor | **Opus 4.8** + validate.py | Modelo distinto del redactor (evita sesgo); autora donde DeepSeek no llega (A5-6 / fallos) |
| Skills | `curriculum-planner`, `lesson-author`, `pedagogy-critic`, `fact-checker`, `editor`, `json-validator` vía `skill-creator` | Componibles, testeables; `skill-creator` aporta el arnés de evals |
| Grounding (10+) | **NotebookLM local** (curaduría) → espejo a store local | Tu decisión 5; sin dependencia en nube/runtime |
| Structured outputs | Sí en la ruta crítica | Elimina la clase de JSON roto |
| Batch/caching (si se usa API) | Batch −50% + caching −90% | Solo para regeneración masiva offline |

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| El juez LLM aprueba mediocridad verbosa | Juez de modelo distinto; calibración kappa ≥0.6 antes de confiar; studio humano de backstop |
| Front-loading: Fases 0-1 no producen lecciones nuevas (~semanas) | Quick wins visibles en Fase 2 (rescate de ~150 lecciones, cero parse-errors) |
| Migración revela contenido sin tipo canónico | Anclar formas al grader vivo; migrar durante regeneración por tipo |
| Curaduría humana del golden set es trabajo real | Golden set pequeño pero representativo (40-60); crecer incremental; NotebookLM acelera la curaduría |
| Fase 6 es infra nueva con cold-start | Gatearla tras fábrica confiable; sembrar Elo/IRT con la dificultad del planner |

---

## 10. Quick wins (ataque a la raíz, casi gratis)

1. Rescatar los 156 volcados rotos vía structured-output → ~150 lecciones recuperadas.
2. Importar `validate.py` dentro de `generate.py` y hacerlo bloquear al guardar.
3. Reemplazar `cycle_idx % 4` por planner por-ejercicio; quitar el mínimo forzado.
4. Chequeo de coherencia de respuesta ES↔EN.
5. Reframe del copy de `points_reward`: de "gana X" (control) a "dominaste X" (competencia, SDT).
6. Generar los tipos TS del frontend desde un primer Pydantic para frenar la deriva del grader.

---

## 11. Piloto (referencia)

Ver [`pilot_v2/`](pilot_v2/) — 2 lecciones de Adventure 1 regeneradas con el proceso integrado (before/after vs. el corpus actual), aplicando la rúbrica v0 y el esquema aditivo, validadas contra `validate.py`. Es la "prueba de la fábrica" en pequeño antes de escalar (decisión 4).

---

## 12. Decisiones abiertas restantes

- **Dueño del golden set:** quién del equipo califica a mano las 40-60 lecciones patrón oro y dibuja las aristas de prerequisitos. Trabajo humano irreducible; ruta crítica de la Fase 1.
- **Banda de presupuesto del híbrido:** qué fracción del corpus va por el agente vs. borrador barato.
- **Umbral de la barra de calidad:** qué media de rúbrica define "publicable".

---

## 13. Estado de implementación — Fase 0-1 (2026-06-18)

### Fase 0 — Congelar el contrato ✅ COMPLETADA
| Artefacto | Archivo | Estado |
|-----------|---------|--------|
| Registro cerrado de tipos (46 canónicos + 9 deprecados) anclado a corpus + frontend | `schema/exercise_registry.json` | ✅ |
| Modelo Pydantic v2 `LessonV2` (sobre estricto + campos v2 aditivos) + JSON Schema export | `schema/lesson_v2.py` | ✅ |
| Taxonomía de conceptos (sembrada Adventure 1 Saga 1; DAG validado) | `concept_taxonomy.json` + `schema/check_taxonomy.py` | ✅ seed |
| Tabla de techo de abstracción por banda (Piaget) | `abstraction_ceiling.json` | ✅ |
| Generador de tipos TS del frontend desde el registro | `schema/gen_frontend_types.py` → `frontend/.../generated/exerciseTypes.generated.ts` | ✅ |

**Criterio de salida:** **2460/2461 lecciones validan** estructuralmente contra `LessonV2`. La única falla es un **defecto real cazado** (`3-5-30-5`: `math_challenge` con `correct_answer` string `"26"` en vez de `{value:26}`) que el `validate.py` viejo nunca detectó → backward-compat probado + el gate ya aporta valor. Taxonomía: DAG sin ciclos ni colgantes. Advisories del corpus (no bloquean, miden la deriva): **5,940 claves de respuesta no canónicas, 1,688 gradables sin respuesta, 104 usos de tipos deprecados**.

### Fase 1 — Medir antes de generar 🟡 SCAFFOLD (rating humano pendiente)
| Artefacto | Archivo | Estado |
|-----------|---------|--------|
| Rúbrica analítica de 10 dimensiones (hard-fail vs puntuada; determinista vs LLM) | `eval/rubric.json` | ✅ |
| Prompt del juez LLM (Opus, modelo distinto del redactor) | `eval/judge_prompt.md` | ✅ |
| Arnés de evaluación: corre las 3 dimensiones DETERMINISTAS ya (estructura, techo de abstracción, vocabulario) + pre-check de feedback | `eval/run_eval.py` | ✅ runnable |
| Golden set: formato + 5 semillas (ejemplares + malas conocidas) | `eval/golden_set.json` | 🟡 seed |

**Demostración del gate determinista:** el piloto `1-1-2-8` pasa el techo de abstracción; la versión **actual** del corpus `1-1-2-8` **hard-falla** (usa $50/$100 > 20). El gate caza la violación exacta.

**Golden set (iterado bajo revisión del usuario):**
- v1 (etiqueta visible) → sesgado. v1.1 (a ciegas, neutralizado) → **midió el sesgo**: baseline Δ+0.09, exemplar (pilotos) Δ−0.88, known_bad Δ+1.37. Hallazgo: la "maldad" del corpus es DETERMINISTA, no pedagógica; los pilotos ganan en engagement/voz pero no en depth.
- v2 (restructure): **split** en `eval/deterministic_test_set.json` (5 hard-fails: factual/abstracción/estructural) + `eval/pedagogical_golden_set.json` (30 lecciones, varianza construida 1→5). Exemplars reales = lecciones de corpus que sacaron 5 a ciegas (`1-4-41-4`, `5-4-24-3`, `6-1-1-3`). Fixtures autorados (`eval/fixtures/`) anclan el extremo bajo que el corpus no produce. **Hallazgo clave:** el corpus FLOTA en 3 pedagógicamente (sin 1s; andamiaje nunca <3) → no está roto, está aplanado.

**Pendiente humano (ruta crítica Fase 1):** el usuario aprueba/ajusta los ratings del set pedagógico (ancla humana) → segundo pase de juez independiente → **kappa ponderado por dimensión** ≥ 0.6 → retirar el "84.2%".

### Fase 2 + Motor de generación 🟢 CONSTRUIDO (probado en pequeño)
| Artefacto | Archivo | Estado |
|-----------|---------|--------|
| Gate robusto (veredicto, entrypoint CI/pre-import) | `gate.py` | ✅ |
| Gate `content_quality` (profanidad/typos vulgares) | `eval/run_eval.py` | ✅ (cazó el único 'pedo' del corpus) |
| Motor de generación (DeepSeek drafter + gate + retry + provenance) | `generate_v2.py` | ✅ probado banda 1 y 3 |
| CI bloqueante sobre contenido nuevo | `.github/workflows/lesson-factory-ci.yml` | ✅ |
| Kappa inter-modelo Opus vs DeepSeek | `eval/kappa_report.json` | ✅ (engagement 0.61; DeepSeek NO juzga factual → juez=Opus) |
| Lecciones de prueba (gated) | `test_lessons/` | ✅ 1-1-3-1, 1-1-3-7 (banda 1), 3-2-15-3 (banda 3) |
| Runbook de generación masiva | `MASS_GENERATION_RUNBOOK.md` | ✅ |

**Hallazgo del motor:** DeepSeek a través del loop v2 produce contenido sólido y gate-passing (arco de 6 fases, feedback por distractor, andamiaje decreciente). Sus límites medidos: no escribe feedback específico para `matching_pairs` (gate afinado: exigible solo en mc/tf/tap) y no juzga rigor factual (juez=Opus). El pipeline funciona cross-banda.

> Nada de esto se ha publicado a la BD ni modifica el corpus. Es andamiaje local, listo para revisión.

---

## 9. Pivot 2026-06-19 — "Definir las reglas del juego": skills + grounding NotebookLM

> **Decisión del equipo (este punto marca el cierre de la fase exploratoria v2 y el inicio de una reestructuración).**

> ⚠️ **Nota histórica (2026-06-20):** todo lo de **grounding/NotebookLM/skills de RAG/venv** descrito en esta
> sección se **separó al cerebro** y hoy vive en `../rag-llm-brain/` (no en `lesson_factory/`). Esta carpeta
> conserva solo el generador de lecciones (skills `instructional-design-toolkit/`, `learning-notes/`). El
> piloto `pilot_v2/` fue eliminado. Para el pipeline del cerebro ver `../rag-llm-brain/knowledge/DATASET_BUILD_RUNBOOK.md`.

**Contexto del giro.** La fase v2 estableció con datos la frontera DeepSeek↔Opus: DeepSeek basta para bandas 1-2 pero choca con un techo de razonamiento (~40% auto-pass) en bandas 3-6 (aritmética, mecánica de simuladores, lógica de grading sutil). La conclusión a la que llegamos NO es "subir de modelo a toda costa", sino que **la calidad de un modelo barato depende de qué tan bien definamos las reglas del juego** — el contexto, los contratos y los ejemplos que le damos por petición.

**Nueva dirección.**
1. **Skills como caché de contexto por petición.** En lugar de depender de la potencia cruda del modelo, se indexa documentación/reglas/contratos en una carpeta `skills/` que se inyecta por petición. Objetivo: salida de calidad **independientemente de que el modelo sea barato**, y sin sesgo por proveedor único.
2. **Grounding con NotebookLM** (vía API no oficial `notebooklm-py`, Playwright) como fuente de material curado para fundamentar la generación de lecciones.
3. **Automatizar el proceso completo SIN perder calidad** — lograble solo si las "reglas del juego" (esquema, contratos de render, rúbrica, gate determinista) están bien definidas y se aplican por defecto.

**Reestructuración asociada (esta sesión):**
- Backup (este commit) de todo el trabajo previo.
- Limpieza de artefactos caché de pruebas (pilot batches, planes, defects, blind runs) — se conservan docs + scripts + maquinaria (esquema, gate, golden sets, curriculum).
- Instalación de `notebooklm-py[browser]` en venv local dentro de `lesson_factory/`.
- Nueva carpeta `skills/` con la doc esencial de la API.
- `CLAUDE.md` + `AGENTS.md` propios de la carpeta (contexto general del Lesson Factory, espejados).
- `.gitignore` para no comitear credenciales de Google/NotebookLM.

> Los scripts actuales (`generate_v2.py`, `gate.py`, etc.) se conservan como referencia y **cambiarán de nombre/proceso** en las próximas iteraciones bajo este nuevo enfoque.
