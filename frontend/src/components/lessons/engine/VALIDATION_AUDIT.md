# Lesson Engine — Auditoría de Validación (2026-06-16)

Auditoría exhaustiva del contrato de respuesta de los **40 tipos de ejercicio** del Lesson Engine
contra las **2,462 lecciones reales** del corpus (`backend/lesson_engine/littlefounders_lessons`).
Motivada por el bug reportado: *"se selecciona la opción correcta pero el ejercicio da error"* (falso negativo).

## Arquitectura del contrato

```
Componente de actividad  --onSubmit(answer)-->  LessonRunner (handleStandardSubmit / handleSimulatorSubmit)
                                                      |
                                                      v
                              useLessonState.submitAnswer(answer)  -->  validateAnswer(exercise, answer): boolean
```

`validateAnswer` en [`hooks/useLessonState.ts`](hooks/useLessonState.ts) es la **única fuente de verdad**.
Los componentes envían la respuesta cruda y usan el `boolean` de retorno para su feedback.
La causa raíz de los falsos negativos: el **formato/clave** del `correct_answer` real no estaba cubierto por
la rama correspondiente del `switch`, devolviendo `false` para respuestas correctas.

## Estado por tipo (auditoría)

- **12/40 sin defectos**: `multiple_choice`*, `true_false`, `matching_pairs`, `tap_action`, `coin_counter`,
  `bill_splitter`, `expense_timeline`, `market_reaction`, `passive_income`, `savings_race`,
  `subscription_tracker`, `word_scramble`, `intro_narrative`. (*MC tenía 1 caso `correctOptionIds` plural).
- **28/40 con defectos**, la mayoría confirmados con verificación adversarial multi-agente.

## Correcciones aplicadas (capa central — verificadas con tests)

Todo en [`useLessonState.ts`](hooks/useLessonState.ts) salvo los dos arreglos de render indicados.
Verificadas por `src/__tests__/validateAnswer.test.ts` (46 casos) y
`src/__tests__/validateAnswer.corpus.test.ts` (regresión contra todo el corpus real).

| Tipo / Helper | Problema (frecuencia) | Corrección |
|---|---|---|
| **`extractCorrectId`** | Faltaban ~60 alias de id de un solo valor (`correctOption`, `correctMindset`, `targetId`, `incorrect*Id`, `trap*Id`, `selectedProductId`, …) | Lista de claves ampliada + helper `optionIdMatches` (tolerante a esquemas `'B'` vs `'mindsetB'`) |
| **`spot_trap`** 🔴 | El caso nunca llamaba a `extractCorrectId`; `{correctOptionId}` (599), `{targetId}` (103), `incorrect*`/`trap*` (80), `{correctOptionIds}` → siempre `false` | Usa `extractCorrectId` para un-solo-id + más claves de array |
| **`SpotTheTrap.tsx`** (render) 🔴 | Items solo desde `messages`/`scenarios`/`options` → 850 no renderizaban (items en `traps`/`statements`/`items`/`plans`/`segments`…) | Resolución genérica de contenedor de items |
| **`classification`** 🔴 | Detección genérica de invertido disparaba antes que wrappers nombrados → `{categoryAssignments:[…]}` (79), `{matches:[…]}` (69) mal-interpretados (284 total); claves de categoría por NOMBRE no resueltas (15) | `normalizeClassifications` reescrito: wrappers + arrays-de-objetos primero; resuelve clave→`cat.id` por nombre |
| **`fill_blank`** 🔴 | Mapas multi-clave (`{blank1,b1,…}`), arrays, `content.blanks[].correctText` (167), `{blanks:[{id,text}]}` (129) → `false` | Extractor central `fillBlankExpected` + comparación texto/id flexible |
| **`quiz_battle`** 🔴 | Umbral por defecto 200 inalcanzable (componente da ~100/correcta) | Umbral derivado de nº de preguntas (`questionCount*100`) |
| **`estimation_slider`** | `range` como array `[min,max]` aceptaba todo (falso positivo); `{min,max}`, `targetZone`, `content.correctRange`, sin-info → `false` (falso negativo) | Extractor de rango robusto + zonas + exploratorio |
| **`shop_sim`** | `{selectedIds}`, `{selectedProductId}`, `{validCombinations}` → `false` | Ramas de id-set + combinaciones válidas |
| **`portfolio_builder`** | Modo OPTIONS envía `{[id]:100}` pero comparaba `String(answer)` | Acepta objeto de una clave como id |
| **`goal_roadmap`** | Orden en `content.correct_sequence` ignorado | Soporte de `correct_sequence` `[{actionId,position}]` |
| **`GoalRoadmap.tsx`** (render) | Leía solo `content.goals` (no existe en datos) | Lee `goals`/`milestones`/`items`/`available_actions` + normaliza campos |
| **`emergency_fund`** | Mapeo posicional vs claves por `event.id` → balance erróneo | Búsqueda por `event.id` + `minBalance` opcional |
| **`mystery_investment`** | `minBoxes` por defecto 2 → falso negativo | Solo exige ≥1 caja salvo `minBoxes` explícito |
| **`interest_calculator`** | Respuesta-objeto `{principal,rate,time}` → `NaN`/`false` | Acepta objeto (simulador exploratorio) |

## Capa de RENDER — corregido (2do commit)

Helper compartido `activities/optionSource.ts` (`resolveOptions`): normaliza la fuente de opciones desde
cualquier clave de contenido (arrays bajo `options`/`choices`/`offers`/… o formas pareadas
`optionA/optionB`, `strategy_a/strategy_b`, …). Aplicado a los componentes que solo leían una clave:

| Componente | Frec. | Corrección |
|---|---|---|
| **BudgetBuilder** | ~1442 | `isNewSchema` relajado (ya no exige `allocated`); `total_income` derivado de múltiples claves / suma de categorías / asignación correcta / default → sliders usables. Legacy (drag-drop) tiene prioridad si hay `items`. |
| **MathChallenge** | ~125 | Renderiza opciones (OptionCard) cuando `content.choices`/`options` existen; valida vía `correctOptionId`. Teclado numérico solo para respuestas numéricas. |
| **ConceptBuilder** | ~255+ | Lee bloques de `components`/`pieces`/`blocks`/`steps`/… + **modo multi-selección** para shapes de subconjunto (`correctOptionIds`/`selectedIds`/`componentIds`/…). |
| **RoleplayChat** | ~60 | Lee opciones de `choices`/`responseOptions`/`chatOptions` además de `options`. |
| **RiskReward** | ~51 | `resolveOptions` (cubre `optionA/optionB`, `choices`, `scenarios`, `portfolios`). |
| **PriceDetective** | ~9 | `resolveOptions` (prices/stores/cases/itemA-itemB/…); omite el gating de precio-unitario sin datos de precio. |
| **SalaryComparison** | ~10 | Ofertas vía `resolveOptions` (`options[]`/`offer_a-offer_b`/`jobA-jobB`). |
| **OpportunityCost** | ~6 | `resolveOptions` (`optionA/optionB`, `strategy_a/strategy_b`). |
| **DebtStrategy** | ~4 | Modo opción múltiple vía `resolveOptions` (`strategyA/strategyB`). |
| **CreditScoreBuilder** | ~2 | Render de opción única cuando no hay `scenarios` pero sí `options`/`profiles`. |
| **ImpactMeter** | ~1 | Causas desde `causes`/`options`. |

Verificación añadida: `src/__tests__/optionSource.test.ts` + nuevas ramas en `validateAnswer.test.ts`.

## Capa de RENDER — fase 3 (3er commit)

| Área | Frec. | Corrección |
|---|---|---|
| **Tipos sin renderer** (`comparison`, `compare`, `comparison_chart/table/slider/matrix/challenge`, `case_study`, `case_real`, `decision_challenge`, `decision_matrix`) | ~298 | Antes mostraban "Ejercicio en desarrollo". Nuevo componente `GenericChoice` (resolveOptions + estado vacío que permite saltar); ruteados en `LessonRunner` y removidos de la lista de exclusión del fallback. |
| **Feedback de simuladores** | 9 comp. | `handleSimulatorSubmit` ahora refleja el resultado REAL (componente y runner concuerdan), sin penalizar vidas. Los tipos exploratorios validan a `true` → siguen siendo siempre-éxito. |
| **StoryMode** | ~1027 | Califica el punto de decisión (cuando hay `correct_answer` y la opción no ramifica): feedback visual + registro del resultado, sin penalizar; preserva la navegación ramificada (`next_page`). |
| **EstimationSlider** | — | Deriva min/max del slider desde `content.ranges` para alcanzar la banda correcta. |
| **MindsetComparison** | ~2 | Soporta el formato `approach_a/approach_b` / `approachA/approachB`. |
| **ShopSim** | ~13 | Modo opción única (`options`/`price_options`/`money_options`); +rama `correctPrices` en el validador. |
| **FillBlank** | ~41 | Banco de palabras sin marcadores `____`: sintetiza slots según el nº de respuestas esperadas. |

## Trabajo restante (opcional)

- **Datos mal-tipados**: algunos `shop_sim`/`salary_comparison`/`math_challenge` son en realidad
  `multiple_choice`/`true_false`. El frontend ya los maneja; lo ideal a futuro es re-tipificarlos en el
  JSON del backend (limpieza de datos, fuera del alcance del frontend).

## Verificación realizada

- **87 tests** (casos de shapes reales + regresión sobre TODO el corpus, sintetizando la respuesta
  correcta de cada `multiple_choice`/`true_false`/`sequencing`/`tap_action`/`spot_trap`/`classification`/
  comparison/case/decision y confirmando que pasa) · `tsc -b` limpio · `npm run build` OK · lint 0 errores.
- **Play-through real contra el backend de producción** (proxy dev → Railway): la lección `5-4-26-2`
  (que contiene el `spot_trap` con `{correctOptionId}`, el bug reportado) carga y renderiza sin errores de
  consola; un `multiple_choice` se respondió correctamente y avanzó (pipeline fetch→render→calificar→avanzar OK).

```bash
cd frontend
npx vitest run                 # suite completa (86)
npx tsc -b && npm run build    # tipos + build
```
