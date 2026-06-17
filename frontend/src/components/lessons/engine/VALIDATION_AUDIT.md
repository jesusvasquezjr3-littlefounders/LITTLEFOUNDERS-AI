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

## Trabajo restante (capa de RENDER — requiere cambios por componente + verificación con backend)

Estos tipos fallan porque el **componente no renderiza** la forma de contenido real o no puede
representar la respuesta esperada. La capa central ya valida correctamente una vez el componente
emite el id/valor adecuado. **No abordados aquí** porque requieren refactor de render y play-through
con el backend (no disponible en el entorno de preview). Ordenados por impacto:

| Componente | Frec. | Problema |
|---|---|---|
| **BudgetBuilder** | ~1442 | `isNewSchema`/`isLegacySchema` demasiado estrictos; falta `total_income` → sliders en `max=0` inmovibles |
| **StoryMode** | ~1027 | Wired como consumo (sin `onSubmit`); los puntos de decisión (`correctOptionId`) no se califican — *decisión de diseño* |
| **MathChallenge** | ~125 | Teclado solo-numérico no puede representar `{correctOptionId}`/texto; debe renderizar opciones/texto cuando `content.choices`/`options` existen |
| **ConceptBuilder** | ~255+ | Lee bloques solo de `content.concepts`/`items`; datos reales usan `components`/`pieces`/`blocks`/`steps`/… |
| **RoleplayChat** | ~60 | Lee solo `content.options`; faltan `choices`/`responseOptions`/`chatSteps`/… |
| **RiskReward** | ~51 | Lee solo `risk_options`/`options`; muchos usan `optionA/optionB`/`choices`/`scenarios`/`portfolios` |
| **PriceDetective** | ~9 | Opciones en `prices`/`stores`/`cases`/`itemA-itemB`/`cityA-cityB` |
| **SalaryComparison** | ~10 | Opciones en `options[]`/`offer_a-offer_b`/`jobA-jobB` (2 son cálculo numérico mal-tipado) |
| **OpportunityCost** | ~6 | Opciones en `optionA/optionB`/`strategy_a/strategy_b` |
| **DebtStrategy** | ~4 | Estrategias en `strategyA/strategyB` |
| **CreditScoreBuilder** | ~2 | Modelo del componente no coincide con NINGÚN dato real |
| **ImpactMeter / EstimationSlider(zonas) / MindsetComparison(approach)** | ~3 | Claves de contenido alternativas |

**Otros temas transversales:**
- **Contradicción de feedback en simuladores** (9 componentes wired a `handleSimulatorSubmit`): el componente
  muestra error/reintentar desde el retorno de `onSubmit` mientras el runner reproduce éxito. Unificar.
- **Datos mal-tipados**: varios ejercicios `shop_sim`/`salary_comparison`/`math_challenge` son en realidad
  `multiple_choice`/`true_false` — candidatos a corrección en el JSON del backend (no en el frontend).

## Cómo verificar

```bash
cd frontend
npx vitest run src/__tests__/validateAnswer.test.ts        # 46 casos de shapes reales
npx vitest run src/__tests__/validateAnswer.corpus.test.ts  # regresión contra todo el corpus
npx tsc -b && npm run build                                 # tipos + build
```
