# LESSON_ENGINE.md — The LittleFounders Lesson Engine Specification

> **Authority:** Engine spec doc (level 6 in /AGENTS.md §1.1). Authoritative for the lesson
> content contract, the exercise taxonomy, grading semantics, session rules, and the
> Character Control API. `coursegen/` (Forge) MUST generate against this contract;
> `audiogen/` (Echo) narrates the fields marked narratable here. On conflict with
> /AGENTS.md or DESIGN.md, those win and this file gets fixed.
>
> **Status:** v1 — engine implemented in `frontend/src/lesson-engine/`. Server-side
> grading in Core + the definitive content schema in Vault land in the dedicated
> content-schema session (0002 is provisional until then).
> **Last updated:** 2026-07-12 · Language: English (project rule).

---

## §1 Mission & pedagogy principles

The engine teaches **money, math, science/physics, economics and programming-lite to
kids and teens** through fullscreen, story-driven, highly visual lessons. Brilliant and
Duolingo are references, not ceilings. Every design decision below traces to one of
these principles — cite them in PRs when adding types:

- **P1 Narrative first.** Concepts arrive inside a story told by the canonical
  characters (Dina, Liruf, Dr. Rho, Zara Vex). A lesson opens with story segments, not a
  wall of theory. (Narrative transportation → retention.)
- **P2 Visual before verbal.** Manipulatives (coins, jars, scales, number lines, grids)
  before abstract notation. Concrete → pictorial → abstract, in that order.
- **P3 Feedback teaches, never punishes.** No red "WRONG". Verdicts are tiered
  (`perfect / great / almost / tryAgain`) with growth-mindset microcopy, a
  per-distractor rationale for the *specific* wrong choice, and an explanation shown
  either way. Retries can only improve the score. (Formative assessment; Dweck.)
- **P4 One thing on screen.** One activity at a time, focused column, fullscreen player,
  zero external chrome. (Cognitive load management.)
- **P5 Earned celebration.** Correct answers trigger character reactions, combo streaks
  and XP — variable, earned, never idle dark-pattern loops (/AGENTS.md §1.9: no dark
  patterns aimed at kids).
- **P6 Self-knowledge.** Calibration (`confidence_quiz`), self-marking (`checkpoint`)
  and prediction-then-reveal (`interest_peek`, `hypothesis`-style flows) train
  metacognition, not just recall.
- **P7 Mistakes are data.** Distractors are authored with a reason they're tempting
  (`rationale_md` is REQUIRED on wrong options); partial credit uses real algorithms
  (Kendall, Jaccard, signal detection) instead of all-or-nothing.

## §2 Vocabulary

| Term | Meaning |
|---|---|
| **lesson document** | One self-contained JSON document (`LessonDocument`), single locale, played start-to-finish by the player. |
| **segment** | One ordered unit inside a lesson — either content (story) or an exercise. |
| **exercise family** | One of the 8 groups sharing interaction primitives and grading helpers. |
| **envelope** | The fields every segment shares (id, type, prompt, difficulty, xp, hints…). |
| **payload** | The learner-visible data of a segment. Always safe to ship to the client. |
| **answer** | The server-only answer key. NEVER shipped to the client in production. |
| **verdict** | The grading result (`score`, `tier`, `feedback`, `reveal`). |
| **grader** | The pluggable grading boundary. Production: Core endpoint. Dev harness: local grader. |
| **Character Control** | The standardized emotion/action API over the four canonical characters. |
| **director** | The engine layer that maps session events (correct, streak, finish…) to character reactions. |

## §3 Lesson document contract

Zod source of truth: `frontend/src/lesson-engine/core/schema.ts` (per-family payloads in
`frontend/src/lesson-engine/families/*/schema.ts`). When the content-schema session
lands, Core imports this contract (copy, validated by tests — no workspaces) and Vault
stores documents against it.

```ts
interface LessonDocument {
  schema_version: 1
  meta: {
    slug: string                      // kebab-case, unique within a course
    title: string
    locale: 'en-US' | 'es-MX' | 'pt-BR'   // ONE document per locale (Forge emits 3)
    subject: 'money' | 'math' | 'science' | 'economics' | 'code' | 'mixed'
    estimated_minutes: number         // 1–30
    objectives: string[]              // 1–6
    cast: CharacterId[]               // characters used; player preloads/introduces them
  }
  scoring: {
    pass_threshold: number            // default 70
    hint_penalty_pct: number          // 0–50, default 10 (per hint shown, on that segment)
    max_attempts: number              // 1–3, default 2
    hearts: number | null             // null = cheer mode (kids default). Number = arcade mode.
  }
  segments: Segment[]                 // 1–80, ids unique, discriminated union on `type`
}
```

**Every segment shares the envelope:**

```ts
interface SegmentEnvelope {
  id: string
  type: ExerciseType                  // one of the 56 type strings (§5)
  title?: string
  prompt_md: string                   // MarkdownLite (§8). The kid-voiced instruction.
  difficulty: 1 | 2 | 3 | 4 | 5
  xp: number                          // 5–50; weight in lesson score AND XP award
  hints?: string[]                    // ≤2, progressive
  explanation_md?: string             // shown after grading, right or wrong
  narrator?: { character: CharacterId; emotion?: CharacterEmotion }  // who presents this segment
  audio_segment_id?: string           // stamped by Echo, never authored by hand
  payload: <per-type>                 // §5
  answer?: <per-type>                 // §5 — server-only, stripped by stripAnswers()
}
```

**Security invariant (non-negotiable):** `answer` never reaches a production client.
`stripAnswers(document)` is the single sanctioned stripper; Core serves only stripped
documents; grading happens through the `Grader` boundary. The in-browser
`createLocalGrader` exists ONLY for the dev harness (`/dev/lesson-lab`) and fixtures —
it is only reachable through the dev-gated, lazily-loaded `/dev/lesson-lab` route
(`App.tsx` guards it with `import.meta.env.DEV`, so production builds never mount it).

Content types (`story` family) carry no `answer` and always count as complete on
advance. They carry `xp: 0` and don't enter the score denominator.

## §4 The 8 families

| Family | Dir | Mechanic center of gravity | Types |
|---|---|---|---|
| `story` | `families/story/` | Narrative beats, reveals, recaps — not graded | 5 |
| `choice` | `families/choice/` | Tap one/many options | 8 |
| `input` | `families/input/` | Type/slide a value or text | 6 |
| `arrange` | `families/arrange/` | Tap-to-place: match, sort, order, position | 10 |
| `money` | `families/money/` | Niche financial manipulatives (coins, jars, budgets) | 9 |
| `analyze` | `families/analyze/` | Inspect an artifact: errors, evidence, charts, traps | 7 |
| `storyplay` | `families/storyplay/` | Self-driving narrative flows, timers, combos | 5 |
| `maker` | `families/maker/` | Programming-lite + science manipulatives | 6 |

Every family owns: `schema.ts` (payload+answer Zod), `grade.ts` (pure validators),
`components/` (renderers), `fixtures.ts` (one demo segment per type, es-MX),
`register.ts` (its registry slice). The central registry composes family slices; adding
a family never edits another family's files.

**Interaction rule:** all manipulation is **tap-first** (tap token → tap slot).
The classification types `sort_buckets`/`group_sets` add a **progressive-enhancement
drag** (press-and-drag a chip into a bucket) on top of tap — implemented with
native Pointer Events (no drag-and-drop library) in `arrange/components.tsx`'s
`SortingBoard`; tap remains the accessible/keyboard fallback, so drag is never
the ONLY way to place. Touch = desktop = same interaction. ≥44px hit areas.

## §5 Taxonomy — 56 types

Notation per type: **`type_id`** — payload → answer → grading → mechanic.
`IdText = {id, text_md}` · `IdVisual = {id, text_md, icon?, image_url?}` ·
`IdLabel = {id, label}` · options carry `rationale_md` (REQUIRED on wrong
options, optional on correct). Shared scoring helpers in §6.

**Visuals (2026-07-24):** every concrete-object item across the families carries
an optional `image_url` (an AI illustration from Prism/picturegen), and EVERY
segment carries an optional segment-level `image_url` "scene anchor" shown above
the prompt. Concrete-object item arrays use `IdVisual` (was `IdText`). The
shared `VisualMark` primitive renders the AI image when present, falling back to
the Material `icon`, then to text — the single home of the "image preferred over
icon" rule (`picture_choice`/`memory_flip` were the original two; the coursegen
images stage now fills every such slot). A 40px monochrome glyph is not
recognizable to a young child; the illustration is. Icons/text remain the
zero-cost fallback — never emojis.

### 5.1 `story` family (content, ungraded — 5)

1. **`story_dialogue`** — `{ lines: [{character, emotion?, action?, text_md}] (1–12) }` →
   no answer → auto-complete → characters talk in sequence; tap advances line by line;
   Character Control plays each line's emotion/action.
2. **`story_scene`** — `{ backdrop: 'band'|'inverse'|'base', character?, emotion?, action?, body_md, art?: {icon, tint} }` →
   no answer → auto-complete → one illustrated narrative beat with a big visual.
3. **`key_ideas`** — `{ ideas: [{icon, title, body_md}] (2–5) }` → no answer →
   auto-complete → takeaway cards, revealed with a stagger.
4. **`concept_reveal`** — `{ cards: [{front_md, back_md, icon?}] (2–6) }` → no answer →
   complete when ALL cards flipped → tap-to-flip concept cards (curiosity gap).
5. **`checkpoint`** — `{ recap_md, mood_prompt_md? }` → no answer → complete on
   self-mark (`got_it` | `review`) → mid-lesson recap + metacognitive self-check;
   the mark is session telemetry, never a grade (P6).

### 5.2 `choice` family (8)

> **Display order never leaks the key (`core/shuffle.ts`).** Option lists, match
> columns and token banks are rendered through `seededSort`, which orders items by
> `mix32(hashCode(seed + key))` — seeded on the segment id so the order is stable
> across re-renders and retries, but decorrelated from the authored order.
> Grading is always id/order-based and never depends on display position, so
> reordering is purely cosmetic. Content can opt out per segment with
> `payload.shuffle: false`.
>
> The `mix32` avalanche is load-bearing, not decoration: sorting on the raw
> polynomial hash was an identity permutation for every id convention the content
> uses (`a/b/c/d`, `opt1..`, `t1..`), so from the engine's first release until
> 2026-07-24 the shuffle silently did nothing and content that keyed the correct
> answer as option "a" was passable by tapping the top item. Never "simplify"
> `seededSort` back to a bare hash comparison — `core/shuffle.test.ts` pins this.

6. **`quiz_mcq`** — `{ options: IdText&Rationale[] (2–6), shuffle?: boolean }` →
   `{ correct_option_id }` → binary; feedback = chosen option's `rationale_md` →
   classic single-choice.
7. **`true_false`** — `{ statement_md, justifications?: IdText[] (0|2–4) }` →
   `{ is_true, correct_justification_id? }` → verdict 60% + justification 40% (binary if
   no justifications) → judge a claim, optionally say why.
8. **`picture_choice`** — `{ options: [{id, icon, image_url?, label, rationale_md?}] (2–6) }` →
   `{ correct_option_id }` → binary → choose the correct VISUAL (big tiles). When
   `image_url` is present (Forge's generated-illustration pipeline: light-background
   images, background removed at generation time, stored in filebase) the tile renders
   the image instead of the Material icon — no emojis, ever.
9. **`odd_one_out`** — `{ items: IdText[] (3–6), reasons?: IdText[] (0|2–4) }` →
   `{ odd_item_id, correct_reason_id? }` → item 60% + reason 40% → find the intruder.
10. **`best_decision`** — `{ scenario_md, options: [{id, text_md, rationale_md}] (2–4) }` →
    `{ qualities: {option_id → 0–100} }` → score = chosen option's quality → judgment
    call with no single "right" answer; every option's rationale teaches.
11. **`yes_no_cases`** — `{ rule_md, cases: IdText[] (3–8) }` → `{ applies_ids: id[] }` →
    decision accuracy (TP+TN)/N → per-case: does the rule apply? (zero-applies valid).
12. **`speed_tap`** (flow) — `{ instruction_md, items: IdText[] (6–14), seconds (10–45) }` →
    `{ target_ids: id[] }` → signal detection, ×0.8 cap if time expires → tap everything
    matching the rule before the (gentle, pausable) timer ends.
13. **`confidence_quiz`** — `{ options: IdText&Rationale[] (2–5) }` →
    `{ correct_option_id }` + learner sends confidence 50–100 → calibration payoff:
    right→confidence, wrong→100−confidence; `correct` requires the right option →
    answer AND rate your certainty (P6).

### 5.3 `input` family (6)

14. **`type_answer`** — `{ placeholder?, max_chars (≤80) }` →
    `{ accept: string[], keywords?: string[], case_sensitive?: boolean }` → fuzzy match
    (accent-stripped, edit budget ⌊len/8⌋) OR keyword coverage % → type a short answer.
15. **`fill_blank`** — `{ text_md with {{n}} markers, mode: 'typed'|'bank', bank?: IdText[] }` →
    `{ gaps: [{gap: n, accept?: string[], bank_id?}] }` → per-gap ratio → cloze; bank
    mode is tap-token.
16. **`number_input`** — `{ unit?, decimals_hint? }` → `{ value, tolerance }` →
    tolerance bands 100/50/0 (within tol / within 2×tol / else) → compute a number on
    the kid number pad.
17. **`estimate_slider`** — `{ min, max, step?, unit?, scale: 'linear'|'log' }` →
    `{ value, full_credit_delta, zero_credit_delta }` → linear falloff between deltas
    (log-aware) → slide to estimate; rewards good sense of magnitude over precision.
18. **`count_objects`** — `{ scene: [{icon, tint?, count}], ask_icon }` → `{ value }` →
    exact = 100, ±1 = 40 (young-kid tolerance), else 0 → count the target objects in a
    generated visual scene (P2).
19. **`equation_builder`** — `{ tokens: [{id, text}] (numbers/operators, incl. distractors), slots (2–9), target_result }` →
    `{ accepted: string[] }` (canonical token orders) → 100 if built expression is
    accepted OR evaluates to `target_result` using only given tokens; else 0 → build a
    working equation from tiles.

### 5.4 `arrange` family (10)

20. **`match_pairs`** — `{ left: IdText[] (2–8), right: IdText[] (2–10, distractors ok) }` →
    `{ pairs: [leftId, rightId][] }` → pair ratio → tap-match columns.
21. **`memory_flip`** (flow) — `{ pairs: [{a_md, b_md}] (3–6) }` → derived → score =
    accuracy from flips (perfect recall 100, degrades with extra flips; floor 40 on
    completion) → concentration/memory card game; association through repetition.
22. **`sort_buckets`** — `{ buckets: IdLabel[] (2–5), items: IdText[] (4–16) }` →
    `{ assignments: {item_id → bucket_id} }` → item ratio → classify into buckets.
23. **`order_steps`** — `{ items: IdText[] (3–8) }` → `{ order: id[] }` → Kendall
    pairwise concordance → put procedure steps in order.
24. **`rank_choices`** — `{ criterion_md, items: IdText[] (3–7) }` → `{ order: id[] }` →
    Spearman footrule (gentler) → rank by a criterion.
25. **`build_sentence`** — `{ tokens: IdText[] (3–12, distractors ok), slots }` →
    `{ order: id[] }` → positional ratio → arrange word tiles into the concept sentence.
26. **`timeline_order`** — `{ events: [{id, text_md, icon?}] (3–7) }` → `{ order: id[] }` →
    positional ratio → place events on a visual left→right timeline.

> **Multiple valid orderings (`accept_orders`).** All five fine-order graders
> (`order_steps`, `rank_choices`, `build_sentence`, `timeline_order`, `code_order`)
> accept an optional `answer.accept_orders: id[][]` — a list of additional full
> orderings, each a permutation of `order`. The grader scores the child's answer
> against `order` and every `accept_orders` entry and keeps the BEST, revealing the
> accepted ordering nearest their attempt. This is how genuinely-swappable steps
> ("verify price" ↔ "take payment") or alternative valid phrasings ("2 vasos por 10
> pesos" ↔ "10 pesos por 2 vasos") avoid marking a defensible answer wrong. Each
> entry must be a permutation of `order` (same ids) — enforced by gate 7.
27. **`pattern_complete`** — `{ sequence: [{icon, tint}] shown, options: [{id, icon, tint}] (3–5), missing_slots (1–2) }` →
    `{ correct: {slot → option_id} }` → slot ratio → continue the visual pattern
    (pre-algebra pattern recognition).
28. **`group_sets`** — `{ set_a: label, set_b: label, items: IdText[] (4–12) }` →
    `{ zones: {item_id → 'a'|'b'|'both'|'none'} }` → item ratio → Venn-style zones —
    teaches set intersection concretely (P2).
29. **`number_line`** — `{ min, max, ticks?, labels?: boolean }` →
    `{ value, full_credit_delta, zero_credit_delta }` → linear falloff by distance →
    tap the position of a value on a number line (magnitude sense).

### 5.5 `money` family (9)

30. **`coin_count`** — `{ currency: 'MXN'|'USD'|'BRL', denominations: number[], target }` →
    `{ }` (self-contained: sum check) → 100 if selected coins/bills sum to target
    (any combo), 40 if within smallest denomination, else 0 → tap coins into the tray to
    pay the exact amount. Locale-aware `Intl` formatting, never string-built.
31. **`make_change`** — `{ currency, denominations, price, paid_with }` → `{ }` →
    same sum check vs `paid_with − price` → give correct change from the till.
32. **`piggy_split`** — `{ income, unit, jars: [{id, label, icon, hint_md?}] (2–4), step? }` →
    `{ targets: {jar_id → {min, max}}, rationale_md? }` → allocation-in-range ratio
    (must sum to income) → split earnings across save/spend/share jars.
33. **`needs_wants`** — `{ items: [{id, text_md, icon?}] (4–12) }` →
    `{ needs_ids: id[] }` → decision accuracy → the finlit classic, as icon cards.
34. **`price_compare`** — `{ offers: [{id, label, qty, unit, price}] (2–4), currency }` →
    `{ best_offer_id }` → binary; feedback auto-computes unit prices into the rationale →
    which deal is actually better?
35. **`budget_fit`** — `{ budget, currency, items: [{id, label, icon, price, need?: boolean}] (4–10), must_buy_needs: boolean }` →
    `{ }` (constraint check) → 100 if selection ≤ budget AND all needs covered (when
    required); partial 50 if over by ≤10% or one need missed → fill the cart within
    budget without dropping the needs.
36. **`savings_goal`** — `{ goal, currency, weekly_options: number[] }` →
    `{ correct: {weekly → weeks} }` → binary per asked pairing (weeks = ceil) → how many
    weeks to the goal at this saving rate? (division with purpose).
37. **`fair_trade`** — `{ offer_a: {label, icon, qty}, offer_b: {label, icon, qty}, rate_md }` →
    `{ verdict: 'fair'|'a_wins'|'b_wins' }` → binary → is the trade fair given the
    exchange rate? (ratios/proportions).
38. **`interest_peek`** (flow) — `{ principal, rate_pct, periods, currency, prediction: {kind:'choice', options: IdText[]} | {kind:'slider', min, max} }` →
    `{ correct_option_id? | value?, tolerance? }` → binary (choice) or tolerance
    (slider); outcome ANIMATES (bars growing per period) only after commit →
    predict compound growth, then watch it happen (P6 prediction→reveal).

### 5.6 `analyze` family (7)

39. **`spot_error`** — `{ context_md?, steps: IdText[] (3–10) }` →
    `{ error_ids: id[], correction_md? }` → set F1 of the tapped set vs `error_ids`
    (NOT decision accuracy: an untapped step is a default, not a decision, so
    crediting it let "tap any one step" score 80 on a 10-step list) → find the
    flawed step(s).
40. **`cause_effect`** — `{ events: IdText[] (4–9, distractors ok), slots (3–6) }` →
    `{ chain: id[] }` → positional ratio → build the cause→effect chain.
41. **`compare_table`** — `{ rows: IdLabel[] (2–4), cols: IdLabel[] (2–3), tokens: IdText[] }` →
    `{ cells: {"rowId:colId" → token_id} }` → cell ratio → fill the comparison grid.
42. **`read_chart`** — `{ chart: {kind: 'bar'|'line'|'pie', series: [{label, points: [{x, y}]}], unit?}, questions: [{id, prompt_md, options: IdText[]}] (1–3) }` →
    `{ correct: {question_id → option_id} }` → question ratio → read a kid-styled chart
    (rendered by the engine's own SVG chart, DESIGN.md tokens) and answer.
43. **`evidence_hunt`** — `{ claim_md, sentences: IdText[] (3–12) }` →
    `{ evidence_ids: id[] }` → Jaccard overlap → highlight the sentences that support
    the claim.
44. **`red_flags`** — `{ artifact_md, artifact_kind: 'ad'|'message'|'deal'|'website', flags: IdText[] (4–10) }` →
    `{ redflag_ids: id[] }` → signal detection max(0, hits−false_alarms)/positives →
    audit a realistic (fake) ad/message for scam signals. Core scam-literacy type.
45. **`fact_opinion`** — `{ statements: IdText[] (3–8) }` → `{ fact_ids: id[] }` →
    decision accuracy → tag each statement fact vs opinion.

### 5.7 `storyplay` family (flows — 5)

46. **`story_branch`** (flow) — `{ start_node, nodes: [{id, text_md, character?, emotion?, choices: [{id, text_md, next: id|null}]}] (2–12) }` →
    `{ qualities: [{node_id, choice_id, score 0–100}] }` → mean quality of the DECISIONS
    on the chosen path → branching decision story; wrong-ish paths still teach via
    consequences. A step taken at a node that offered only ONE choice (the authored
    "continue"/ending beat) is **not** a decision and is not graded — crediting those
    free steps let two keyed acknowledgements average a wrong decision up to a pass.
    A tree with no multi-choice node keeps grading its forced steps (never unwinnable);
    coursegen's gate 8 refuses to author that shape, an unkeyed choice at a real
    decision node, an all-paths-pass key, or one no path can pass.
47. **`dialogue_choice`** (flow) — `{ persona: {character, name?, role_md}, opening_md, turns: [{id, npc_md, replies: [{id, text_md, quality 0–100, react_md}]}] (2–6) }` →
    derived (qualities live in payload? NO — see note) → mean reply quality →
    scripted roleplay with an NPC character. **Note:** reply `quality`/`react_md` live
    in the ANSWER (`{ turns: [{turn_id, qualities: {reply_id → quality}, reactions: {reply_id → react_md}}] }`)
    so the client can't read scores; the local/dev grader supplies reactions per turn.
    Deterministic by design — NO live AI in kid lessons v1 (moderation, §1.9).
48. **`flash_match`** (flow) — `{ left: IdText[] (3–8), right: IdText[] (3–8), seconds (20–90) }` →
    `{ pairs: [id, id][] }` → pair ratio ×0.8 cap if overtime → speed-match under a
    friendly timer.
49. **`lightning_round`** (flow) — `{ questions: [{id, prompt_md, options: IdText[] (2–4)}] (3–8), seconds_per_q (5–15) }` →
    `{ correct: {question_id → option_id} }` → question ratio; in-round combo meter
    feeds the session streak → rapid-fire mini-quiz with momentum.
50. **`would_you_rather`** — `{ a: {text_md, icon?}, b: {text_md, icon?}, followup_md? }` →
    `{ qualities: {a: 0–100, b: 0–100}, reveal_md }` → chosen side's quality → tradeoff
    pick; reveal explains what each choice optimizes (opportunity cost made visceral).
    The grader stays permissive (an all-zero map scores any valid pick 100, so no
    published lesson is unwinnable) and reveals only WHICH side was rated higher, never
    the raw numbers. Authoring is where the bar sits: it is ONE tap, so coursegen's
    gate 8 refuses a key whose two sides BOTH clear `pass_threshold` — otherwise
    "always tap the same card" is a complete strategy.

### 5.8 `maker` family (6)

51. **`code_order`** — `{ blocks: IdText[] (3–8, code lines), language_hint? }` →
    `{ order: id[] }` → Kendall → arrange code blocks into a working program
    (monospace, syntax-tinted).
52. **`robot_path`** (flow) — `{ grid: {w (3–6), h (3–6)}, start: {x,y,dir}, goal: {x,y}, walls?: [{x,y}], commands: ('forward'|'left'|'right')[], max_commands }` →
    `{ }` (simulated) → 100 if the queued program reaches the goal (simulation runs in
    the renderer AND the grader re-simulates authoritatively), 40 if adjacent to goal →
    queue commands, press RUN, watch the character walk the grid. Kid programming.
53. **`debug_hunt`** — `{ intro_md, blocks: IdText[] (3–8) }` → `{ bug_ids: id[], fix_md? }` →
    decision accuracy → find the buggy line(s).
54. **`balance_scale`** (input) — `{ left_fixed: [{label, value}], weights: [{id, label, value}] (3–8), unknown_label? }` →
    `{ }` (state check) → 100 when placed weights balance the scale exactly (equation
    equality made physical); 40 within smallest weight → algebra intuition via a scale
    that visibly tips.
55. **`measure_read`** — `{ instrument: 'ruler'|'thermometer'|'gauge'|'beaker', min, max, ticks, unit, pointer_value }` →
    `{ value, tolerance }` → tolerance bands → read the instrument (engine renders the
    SVG instrument with the pointer at `pointer_value`).
56. **`machine_io`** — `{ examples: [{in, out}] (2–4), probe_in, options?: IdText[] }` →
    `{ value? | correct_option_id? }` → binary/tolerance → induce the function machine's
    rule from examples, predict the next output (functions before notation).

**Counts:** 56 total = 5 content + 51 graded. Interaction coverage: select, multi-select,
type, slide, order, map, grid, allocate, tag, branch, flow-timed, simulate.

## §6 Grading

**Boundary:** `Grader = { grade(segmentId, answer, meta) => Promise<Verdict> }`.
Production grader = Core endpoint (content-schema session; will reuse these pure
validators server-side — they are dependency-free TypeScript on purpose).
`createLocalGrader(fullDocument)` powers `/dev/lesson-lab` only.

```ts
interface Verdict {
  correct: boolean            // score >= pass_threshold
  score: number               // 0–100
  tier: 'perfect' | 'great' | 'almost' | 'tryAgain'   // 100 / ≥pass / ≥40 / <40
  feedback_md?: string        // per-distractor rationale or templated count feedback
  reveal?: unknown            // correct-answer summary — ONLY when retries exhausted or score 100
  allowRetry: boolean
}
```

**Shared helpers** (`core/scoring.ts`, pure, unit-tested numerically): `binary`,
`ratio`, `kendall`, `footrule`, `positional`, `jaccard`, `decisionAccuracy`,
`setF1` (asserted-set precision/recall — for "find the targets" toggles where NOT
tapping is the default), `signalDetection`, `toleranceBands`, `linearFalloff` (log-aware), `allocationRanges`,
`pathQuality`, `calibration`, `sumEquals`, `fuzzyEquals` (NFD accent-strip +
Levenshtein budget ⌊len/8⌋).

**Rules:** malformed answers → score 0, retry allowed, never throw to the UI. Unknown
type → the registry renders the i18n "unsupported segment" card (forward compatibility:
old clients skip new types gracefully, awarding no XP and excluding the segment from
the denominator — this is what makes the taxonomy production-extensible).

## §7 Session model (the player state machine)

`core/session.ts` — pure reducer, fully unit-tested.

```
intro → [per segment: present → answer → checking → feedback → advance] → results
```

- **Score:** XP-weighted mean over graded segments: `round(Σ(best/100·xp) / Σxp · 100)`;
  `passed = score ≥ pass_threshold`.
- **Attempts:** client mirrors `max_attempts`; `bestScore = max(prev, penalized)` — a
  retry never lowers the score (P3).
- **Hints:** each shown hint multiplies that segment's achieved score by
  `(1 − hint_penalty_pct/100)` per hint.
- **Streak/combo:** +1 only on first-try correct; correct-on-retry holds; wrong resets.
  Streak ≥3 upgrades celebration intensity (director).
- **Hearts:** `scoring.hearts = null` → **cheer mode** (kid default): no fail state,
  wrong answers cost score only. Number → **arcade mode**: each exhausted segment
  (attempts used, still <pass) costs one heart; 0 hearts ends the run at the results
  screen with an encouraging retry CTA. Never mid-lesson ejection.
- **XP:** `earned = round(Σ best/100 · xp)`; surfaced live as a chip; written to
  `learning_stats` by Core when the production progress endpoint lands (not from the
  client).
- **Results:** score ring, XP, pass/celebrate or encourage/retry, per-family recap
  chips, full-cast character celebration via the director.

## §8 MarkdownLite

All `*_md` fields accept ONLY: `**bold**`, `*italic*`, `` `code` ``, line breaks, and
`- ` lists. Rendered by `core/MarkdownLite.tsx` — hand-rolled, injection-safe (raw HTML
renders inert), no external lib. Anything else renders as literal text.

## §9 Character Control

Lives in `frontend/src/components/characters/control/` — reusable platform-wide (games,
tutor, empty states), not lesson-only. **Appearance is NON-NEGOTIABLE:** colors, shapes
and composition of Dina, Liruf, Dr. Rho and Zara Vex are never altered; the rig only
ADDS stable class hooks and wrapper-level animation.

```ts
type CharacterId = 'dina' | 'liruf' | 'rho' | 'zara'
type CharacterEmotion = 'neutral' | 'happy' | 'excited' | 'thinking'
                      | 'surprised' | 'encouraging' | 'proud'
type CharacterAction  = 'idle' | 'jump' | 'hop' | 'wave' | 'point' | 'celebrate'
                      | 'nod' | 'shake' | 'think' | 'dance' | 'peek' | 'bow'

<CharacterActor character="dina" emotion="happy" action="celebrate"
                speaking={false} size="md" bubble={text?} />
```

- `CharacterActor` maps the unified `CharacterEmotion` to each character's native prop
  (`expression` for Dina; `mood` unions for Liruf/Rho/Zara) via a per-character table —
  native prop surfaces stay untouched and keep working.
- Actions are CSS keyframe classes (`lf-act-*`) applied to the actor WRAPPER and to
  standardized rig hooks added inside each SVG (`lf-rig-arm-f`, `lf-rig-arm-b`,
  `lf-rig-leg-f`, `lf-rig-leg-b`, `lf-rig-tail`, `lf-rig-body`, `lf-rig-extra`).
  Per-character transform origins are provided as CSS vars by the actor. Head and
  pupil groups are RAF-owned by the characters' own tracking loops — the rig NEVER
  animates those nodes.
- Every action is one-shot (auto-returns to `idle`); `celebrate`/`dance` may loop
  while the celebration overlay is up, but stop with it. All rig animation is
  `prefers-reduced-motion` safe (falls back to emotion change only).
- **The director** (`lesson-engine/core/director.ts`) maps session events →
  `{character, emotion, action}` with rotation (no two identical consecutive
  reactions): `correct → celebrate/jump/nod`, `perfect → dance/celebrate`,
  `wrong → encouraging + think/shake` (NEVER mocking — P3), `streak3 → full-cast hop`,
  `hint → think`, `results_pass → cast celebrate`.

## §10 Player & dev harness

- **`LessonPlayer`** (`lesson-engine/player/`) — fullscreen (own route, no app chrome),
  DESIGN.md §Screen Recipes → Lesson: focused ~720px column, sticky glass header
  (close, progress fill, hearts/combo/XP chips), character stage, one segment card at a
  time, Check/Continue footer bar (thumb-reachable on mobile), results screen.
  Props: `{ document (stripped), grader, onExit, onComplete }` — course lessons and
  future tutor/personal lessons share the identical player with different graders.
- **`/dev/lesson-lab`** (dev harness, gated out of production builds) — grid of all 56
  fixtures by family; click → plays that single-segment lesson with the local grader;
  plus "Showcase" — one full lesson containing every type. This is the visual QA
  surface and the living authoring contract.

## §11 Extension protocol — adding type #57 without breaking production

1. **Justify** — prove no existing type covers the mechanic (else extend a payload,
   which must stay backward-compatible: only optional fields added).
2. **Schema** — add the discriminated-union member in its family's `schema.ts` (or a
   new family) + taxonomy metadata. `ALL_TYPES` / `GRADED_TYPES` derive automatically.
3. **Grade** — pure validator in the family's `grade.ts` using §6 helpers + numeric
   unit tests. The exhaustive-switch `default` throws in dev and the
   registry-completeness test fails until you finish.
4. **Render** — component from `core/primitives` + registry entry
   (`kind: content|input|flow`, `canSubmit`, `buildAnswer?`).
5. **Fixture** — one demo segment in the family's `fixtures.ts` (lesson-lab picks it up
   automatically) + template `agent/prompts/templates/new-lesson-type.md`.
6. **Docs & i18n** — this file's §5 + any new chrome keys ×3 locales.

Old clients render unknown types as the "unsupported segment" card (§6) — shipping new
types to production content NEVER breaks players that predate them.

## §12 What Forge and Echo consume

- **Forge (coursegen):** generates `LessonDocument`s (one per locale) against §3/§5
  Zod. Answer keys stay server-side through its whole pipeline. Distractor
  `rationale_md` is REQUIRED — a generated wrong option without a teaching rationale is
  invalid output. Difficulty/xp assignment rules and per-type generation prompt
  fragments live with Forge (`coursegen/AGENTS.md`), not here.
- **Echo (audiogen):** narratable fields are `prompt_md`, `story` family bodies,
  `explanation_md`, a `choices` roll-up (the choice-family option labels read in
  order, so a pre-reader hears the whole exercise) and each `hint`
  (`hint.<n>`); Echo stamps `audio_segment_id`. Unit ids follow
  `${segment_id}.${field}`. Voice = the segment's `narrator` character (voice
  casting is Echo's decision, per-locale). The player auto-plays prompt→choices
  and voices a hint when the kid reveals it; any missing unit is a silent no-op.
