# COURSE_ENGINE.md — Forge: the Course & Lesson Generation Engine

> **Authority:** engine spec doc (level 6 in /AGENTS.md §1.1), sibling of
> /LESSON_ENGINE.md. Authoritative for the content hierarchy, the curriculum
> catalog format, the generation pipeline, its quality gates and its providers.
> The lesson DOCUMENT contract itself lives in /LESSON_ENGINE.md — Forge
> produces documents that validate against it, byte for byte.
>
> **Status:** v1 — hierarchy live in Vault (0007), pipeline implemented in
> `coursegen/`, first course catalog authored (`financial-education`).
> Generation runs are OPERATOR-TRIGGERED (CLI) and cost real money — they are
> never started by CI or by any automatic process (/AGENTS.md sign-off rule).
> **Last updated:** 2026-07-12 · Language: English (project rule).

---

## §1 Design synthesis (where each idea comes from)

| Source | What Forge adopts |
|---|---|
| LF-Business coursegen | Two-call author protocol (PLAN → WRITE), palette prompt rendered from the type taxonomy, zod-gated corrective retries, deterministic plan repair before burning tokens, per-lesson checkpoint/resume, token budget kill-switch, cost ledger per call |
| LF-Brain | Closed taxonomy YAML validated by schema, `catalog` as a coverage oracle (generation stops when every slot is filled, not at N megabytes), **Piaget vocabulary hard-gates**, `facts.yaml` canonical ground truth (never trust the model with a number), deterministic-first gate cascade, independent-provider judge to decorrelate errors |
| LittleFounders v1 | The Adventures narrative spine (worlds as progression), curriculum blueprint fields (concept / objective / vocabulary / prior knowledge / micro-objective per lesson), and its FAILURES: hierarchy must be DB data (never hardcoded dicts), XP must be real, unlock rules must be server-computed in exactly one place |

What Forge deliberately does NOT have: RAG over uploaded documents. Our niche
advantage is that the **catalog + facts ARE the ground truth** — curated,
versioned, reviewed. The grounding rule is "nothing that isn't derivable from
the blueprint, the facts table and the character canon."

## §2 Content hierarchy (Vault, migration 0007)

```
courses ── adventures ── sagas ── topics ── lessons ── lesson_documents (×3 locales)
```

- Every level is a REAL table with `position`, `slug`, per-locale `title`
  (jsonb `{en-US,es-MX,pt-BR}`) and `status`. No hardcoded taxonomy anywhere.
- `adventures.theme` — closed, extensible scene id (`archipelago | forest |
  city | valley | kingdom | cosmos`) rendered by the frontend's data-driven
  scene registry (CSS-drawn worlds, v1 heritage, Arcade-styled).
- `topics` carry the pedagogy: `concept_md`, `learning_objective`,
  `key_vocabulary`, `prior_knowledge` (all jsonb per-locale).
- `lessons` carry play metadata: `xp_total`, `estimated_minutes`,
  `difficulty`, `cast`. `lesson_documents(lesson_id, locale)` carries the
  split contract: `document` (client-safe, stripped) + `answer_keys`
  (server-only: `{segment_id → answer}`; **no RLS SELECT policy exists for
  it — service-role only**, Core grades with it).
- `lesson_progress(user_id, lesson_id)`: `best_score`, `passed`, `attempts`,
  `xp_earned`, `completed_at`. Core is the only writer; completing a lesson
  also feeds `learning_stats` (XP/minutes/lessons/streak).
- **Unlock rule (single source of truth = Core):** lessons unlock strictly in
  global order (adventure → saga → topic → lesson position); the "next lesson"
  pointer is the first non-passed lesson; everything before it stays
  replayable; an adventure unlocks when every lesson of the previous one is
  passed. No client re-derivation — the course-tree endpoint returns
  `locked/available/current/passed` per node.

## §3 The curriculum catalog (coverage oracle)

Lives in `coursegen/curriculum/<course-slug>/`, YAML, Zod-validated
(`npm run catalog:check` in coursegen):

- **`taxonomy.yaml`** — closed vocabulary: themes, age tiers, subjects, and
  the **forbidden-vocabulary lists per age tier per locale** (Piaget gate;
  tier1 6-7 y tier2 8-10 forbid: porcentaje/interés compuesto/deuda/crédito/
  acciones/inversión…, with en-US and pt-BR equivalents). HARD-FAIL gate.
- **`facts.yaml`** — canonical numeric ground truth (MXN/USD/BRL denominations,
  reference prices for kid-world goods, simple-interest examples used by
  `interest_peek`). Every number in a generated money exercise must either
  come from here or be pure arithmetic the gate can re-verify.
- **`catalog.yaml`** — the complete map: course → adventures (8) → sagas (4
  each) → topics (~6 per saga) → lesson blueprints (4 per topic). Blueprint =
  `{ position, slug, micro_objective, concept_ids, suggested_families,
  difficulty, narrative_beat }`. **8×4×6×4 ≈ 768 lesson slots ≈ one lesson a
  day for ~2 years.** The catalog is the STOP CONDITION: a run is complete
  when every slot has a published document ×3 locales, never before.

### §3.1 Spaced-review layer (pedagogy: spacing effect + retrieval practice + interleaving)

Review is DERIVED content — every review blueprint cites the teaching topics it
consolidates (`review_of`), so Forge grounds it in already-validated concepts
and the quality floor is inherited, not re-invented. Review share is capped by
design at ~37% of the walk (the kid-optimal 25–35%+capstones band): doubling
the catalog with review alone would saturate learners — if the catalog must
grow past this, grow TEACHING breadth (e.g. tier2 sagas 6→8 topics), never the
review ratio.

Three rungs, all inside the existing worlds:

| Rung | Where | Shape | Kind |
|---|---|---|---|
| Repaso de saga | topics 7–8 of every saga | 7: "El Cofre del Repaso" — pure retrieval of the saga's 6 topics, light playful types (2–3 min). 8: "Reto Entrelazado" — interleaves this saga with EARLIER sagas/adventures | `review_spaced`, `review_interleaved` |
| La Gran Misión | saga 5 of every adventure | 6 topics × 4 lessons: cumulative narrative quest re-playing the whole world's concepts + callbacks to previous worlds; gentle difficulty, high celebration | saga `review`, topics `review_quest` |
| Natural spacing | emergent | a concept returns days later (rung 1), weeks later (rung 2), months later (later worlds' interleaved retos) | — |

Catalog fields: topics carry optional `kind: teaching | review_spaced |
review_interleaved | review_quest` (default `teaching`) and `review_of:
[topic/saga slug paths]` (required for review kinds; must resolve). Sagas carry
optional `kind: teaching | review`. Review lessons: difficulty ≤ teaching
median, `suggested_families` lean on story/choice/arrange/money/storyplay,
micro-objectives are RETRIEVAL objectives ("recuerda y aplica X sin re-enseñar").
The plan/write prompts receive the source topics' concepts and objectives and
the instruction "consolidate — never introduce new concepts".

**Totals:** tier1 adventures (1–5): 4 teaching sagas × 8 topics (6 teaching +
2 review) + review saga × 6 topics = 152 lessons each. tier2 adventures (6–8)
use the sanctioned teaching-breadth expansion — 8 teaching topics per saga
(review shifts to positions 9–10) = 184 lessons each. **Course total: 5×152 +
3×184 = 1,312 lessons (864 teaching + 448 review, 34% consolidation ≈ 3.6
years at 1/day).**

### §3.1b The course sequence (execution order)

| # | Course (slug) | Tiers | Shape | Lessons | Requires |
|---|---|---|---|---|---|
| 1 | Educación Financiera (`financial-education`) | tier1×5 + tier2×3 | 5×152 + 3×184 | 1,312 | — |
| 2 | Emprendimiento (`entrepreneurship`) | tier1×2 + tier2×6 | 2×152 + 6×184 | 1,408 | financial-education |
| 3 | Inversiones (`investing`) | tier2×3 + tier3×5 | 8×184 | 1,472 | financial-education, entrepreneurship |

- **tier3 (10–12, concrete-operational→formal transition):** created FOR
  Inversiones — inversión, interés (simple y compuesto, siempre concreto y
  visual), acciones ("un pedacito de una empresa"), fondo/canasta, índice,
  riesgo, diversificar and inflación BECOME teachable; still forbidden:
  apalancamiento, derivados, opciones, ventas en corto, margen, trading
  intradía, forex, criptomonedas-como-inversión. Simulations only — nothing
  transactional, ever (§1.9/COPPA posture); one full adventure is dedicated to
  investment-fraud literacy.
- **`course.requires`** (catalog.yaml, optional `[course-slugs]`): the
  course-level prerequisite edge for future placement/unlock. Topic-level
  `prerequisites` paths stay within-course.
- `catalog:check` validates EVERY course directory under `coursegen/curriculum/`.

### §3.2 Concept metadata — mastery, placement and parent visibility

(Adapted from Marble's os-taxonomy patterns — structure only, no text reuse.)

- **`parent_check`** (optional, teaching topics; es-MX authoring locale): ONE
  natural-language mastery gut-check a parent can ask, with a `{{name}}`
  placeholder ("Si {{name}} recibiera dinero en su cumpleaños, ¿podría explicar
  por qué conviene guardar una parte?"). Surfaces in the future parent
  dashboard — a direct implementation of the §1.9 parent-visibility invariant.
- **`prerequisites`** (optional, topics): `[{path, strength: 'hard'|'soft',
  reason}]`. The linear walk already implies "previous lesson" as a hard edge —
  these entries model the NON-obvious edges, especially cross-domain ones
  (counting/arithmetic → money mechanics; reading a chart → red-flag audits),
  which curriculum graphs habitually under-model. Every edge carries a
  one-sentence human-readable `reason` (debuggability + judge grounding).
  `hard` = a true gate for future placement; `soft` = a sequencing nudge.
- These two fields power the **future onboarding/placement phase**
  (Duolingo-style): a placement quiz walks the hard-edge DAG backwards from the
  learner's claimed level, using topic objectives + parent_check territory to
  probe mastery, and drops the learner at the earliest unmet hard edge. Design
  reserved here; built in a later phase.

### §3.3 Audience registers (kids today, adults later)

The catalog's CONCEPTS are audience-agnostic; the RENDERING is not. `taxonomy.yaml`
declares `registers`: `kid` (default — age tiers + Piaget gates apply) and
`adult` (full 56-type palette, no vocabulary ceiling, tone: direct, respectful,
never infantilizing; anchors in real adult life — nómina, súper, renta,
comisiones). `npm run generate -- --register adult` regenerates the SAME
blueprints as a parallel course (slug `<course>-adultos`) — content is
REGENERATED per register, never filtered down or dressed up (a UI toggle that
hides fields and calls itself "adaptation" is the documented anti-pattern).
Piaget gates switch off for adult; the anti-genericity gate and judge stay.

### §3.4 Locale scalability

One document per locale, always. Adding locale N (e.g. fr-FR) touches exactly:
(1) Vault: widen the `lesson_documents.locale` CHECK (delta migration);
(2) frontend `LESSON_LOCALES` + i18n fragment directory; (3) `taxonomy.yaml`
forbidden-vocabulary lists for the new locale; (4) Forge `--locales` target +
Echo voice map env. Core's locale resolution (profile → authoring fallback)
needs no change. Verified serving today: en-US / es-MX / pt-BR each return
their own document for the same lesson when the profile locale changes.

Catalog authoring is human-reviewed content design. The Educación Financiera
catalog progression (ages 6→8):

| # | Adventure (theme) | Arc |
|---|---|---|
| 1 | El Archipiélago del Trueque (archipelago) | What money IS: wants, trading, why coins exist |
| 2 | El Bosque de la Abundancia (forest) | Earning: work, effort, first "chambitas" |
| 3 | La Aldea del Ahorro (valley) | Saving: goals, patience, piggy jars, safe places |
| 4 | El Mercado de los Colores (city) | Smart spending: needs vs wants, comparing, budgets |
| 5 | El Taller de los Inventores (workshop→valley scene) | Entrepreneurship: making, pricing, selling |
| 6 | El Faro de la Confianza (archipelago-night variant) | Safety: scams, ads, sharing, banks |
| 7 | El Jardín Compartido (forest variant) | Giving, community, taxes-as-cooperation (tier-safe) |
| 8 | El Cosmos del Mañana (cosmos) | Capstone: plans, dreams, review quests |

## §4 Pipeline

CLI-driven (`npm run generate -- --course financial-education [--slots a1-s1-t1-l1..] [--locales es-MX,en-US,pt-BR]`),
file-checkpointed (`coursegen/runs/<run-id>/checkpoint.json` — per-slot state:
`planned → written → reviewed → localized → illustrated → published |
failed`), resumable, idempotent (publish = upsert by slug).

```
validate  catalog + facts + taxonomy (Zod, offline)
   ↓
plan      blueprint → segment skeleton    DeepSeek, temp 0.3, JSON mode
   ↓      (palette prompt rendered from LESSON_ENGINE taxonomy + per-tier
          allowlist: tier1/2 EXCLUDE types like confidence_quiz/rank_choices;
          money family REQUIRED ≥1 per money-topic lesson; narrative-first;
          deterministic plan-repair before any retry)
   ↓
write     skeleton → full LessonDocument (es-MX first, the authoring locale)
          DeepSeek, temp 0.4, JSON mode, corrective retries (max 4) fed with
          Zod issues; per-segment salvage before full regen. The prompt now
          carries the CONTENT PLAYBOOK (§"Content quality" below) + the age-tier
          reasoning ceiling as its CREATIVE brief — the hard rules enforce
          FORMAT, the playbook enforces VALUE (a decision-driven, concrete,
          non-boring premise).
   ↓
gate      DETERMINISTIC, free, in order:
          1. LESSON_ENGINE Zod contract (composed 56-type schema)
          2. Forbidden-vocabulary scan (age tier × locale) — HARD FAIL
          3. Fact gate — every number matches facts.yaml or re-computes
             (coin sums, change, ceil(goal/weekly), balance totals, compound
             values are RE-EXECUTED programmatically against the answer key)
          4. Rationale gate — every wrong option carries rationale_md (P7)
          5. Character canon gate — cast ⊆ {dina,liruf,rho,zara}, emotions/
             actions in the closed sets
          6. Anti-genericity gate — deterministic detectors for content that
             restates instead of teaching: prompt_md ≈ topic/lesson title,
             explanation_md too short or with no concrete instance (no number,
             character or scenario), banned filler phrases per locale. Cheap
             garbage never reaches the judge (two-phase pattern).
          7. Generation-quality gate (added after the 2026-07-22 QA
             inspection) — icon names must be in the blessed palette (invented
             names like 'lemonade'/'piggy_bank' render as raw text); decision
             quality maps must grade on 0–100 (a 0–1 or all-zero map makes the
             correct answer unpassable); compare_table cell keys must use the
             `<row>:<col>` colon form the player submits.
   ↓
review    INDEPENDENT judge = Qwen (decorrelated provider), rubric 1-5 on:
          age_fit, pedagogy, narrative_quality, kid_safety, es-MX naturalness,
          concreteness (≥1 worked concrete instance; connects to the prior
          lesson's concept — the write prompt receives the previous blueprint's
          micro-objective and MUST open by linking to it, never restarting cold),
          and — added after the 2026-07-22 QA inspection — cognitive_engagement
          (does solving require real thinking / is the answer leaked?),
          feedback_quality (does wrong-answer feedback explain why?) and
          distractor_quality (are wrong options plausible?). GATE: kid_safety ≥ 5,
          age_fit ≥ 4, concreteness ≥ 4, and pedagogy / cognitive_engagement /
          feedback_quality / distractor_quality ≥ 3 → else revise loop (max 2)
          → else fail slot.
   ↓
localize  es-MX → en-US and pt-BR: translation-with-contract call (structure
          is FROZEN — ids/answers/numbers copied programmatically, only
          learner-visible strings translated), re-gated per locale (vocabulary
          lists are per-locale).
   ↓
images    OPTIONAL per slot: visual segments (picture_choice options,
          memory_flip card sides) get illustrations from PRISM (picturegen/,
          port 4007) — the platform's ONLY image service. Prism's
          art-director judge (Qwen chat) turns {label, context, purpose}
          into a detailed prompt carrying the LF illustration identity
          (flat kid-friendly vector style, papaya/navy palette, complete
          background scene — the frontend renders inside a rounded tile);
          generation = official Qwen `qwen-image` on DashScope; a vision
          verifier (qwen-vl) then inspects the ACTUAL pixels for readable
          text/numerals and regenerates on a hit (qwen-image's text bias
          cannot be prompted away — mechanical guarantee, up to 3 attempts);
          the clean asset lands in Depot and is indexed in Vault
          `picture_assets`, keyed on the REQUEST descriptor
          (sha256(model+size+style_version+purpose+label+context), computed
          BEFORE the judge) so an IDENTICAL request never hits the paid API
          twice. Forge just embeds the returned public URL.
          Skippable (--no-images) / PICTUREGEN_URL unset = clean skip —
          icons remain the fallback, NEVER emojis. (Gemini discarded
          2026-07-23: quota-0 on every Google image model.)
   ↓
publish   upsert lesson + 3 lesson_documents rows via service role;
          document/answer_keys split server-side; lesson lands as
          status='review' — a HUMAN publishes to 'published' (blocking gate
          for kids' content, non-negotiable). Echo narrates on publish
          (separate trigger).
```

**Retries & backoff:** schema-corrective retries and transport retries are
SEPARATE counters — 429/5xx get jittered exponential backoff (0.5s→8s) without
consuming correction attempts (fixes the sibling's known weakness).
**Outer slot attempts (`FORGE_SLOT_ATTEMPTS`, default 3):** a judge rejection
or write exhaustion resets the slot and regenerates it FROM SCRATCH — a fresh
draw converges far better than more revise cycles on a bad draft (measured
2026-07-23). This is the mass-generation convergence guarantee: with 3
independent draws each passing the strict judge ~70%+ of the time, per-slot
failure drops to low single digits, and `--slots` re-runs mop up the rest.
Budget kill-switches still abort the whole run — retries can never spend past
them. **Deterministic output sanitizers** run before every schema check:
`stripNullValues` (DeepSeek stubbornly emits `null` for optional fields) and
`repairDocument` (balance_scale subset-sum repair — weight[0] becomes the
exact left-pan total when no subset works). The write prompt now carries the
FULL blessed icon whitelist (the "invented icon" failure class became a
lookup), and the judge prompt carries a fluency/drill calibration so
speed_tap/memory_flip/lightning_round/flash_match/count_objects/measure_read
are scored as automaticity practice (no leakage, story-grounded, meaningful
items) rather than failed for not demanding multi-step reasoning.
**Budget:** `FORGE_MAX_TOKENS_PER_RUN` + `FORGE_MAX_USD_PER_RUN` kill-switches
checked before every call; every call logged to `runs/<id>/ledger.jsonl`
(provider, model, tokens, est. USD). **Concurrency:** small pool
(`FORGE_CONCURRENCY`, default 2).

### §4 addendum — `forced_types` (QA/authoring override)

A lesson blueprint may carry `forced_types: [type_id, ...]` (1-14 entries,
each a real LESSON_ENGINE segment type id, validated at load time). When
present, `run.ts` **skips the plan stage's DeepSeek call entirely** and
builds the segment skeleton deterministically — one segment per listed type,
in that exact order — instead of asking the model to design one. Every other
stage runs unchanged: `write` (the real content-authoring call), the 6
deterministic gates, the Qwen judge, localization, images, and publish. MIX
RULES (narrative-first, ≥5 distinct types, 8-14 segments) do not apply to a
forced skeleton — it is a deliberate hand-pinned exception, not a model
output to validate against them.

This exists to make per-exercise-type pipeline verification cheap and exact
before a full paid curriculum run: a smoke-test catalog with one
`forced_types: [x]` lesson per type (plus a few multi-type lessons to
exercise in-lesson sequencing) proves every stage — text generation, gates,
judging, translation, image generation, audio narration, and every Core/
frontend endpoint — end to end, for a fraction of a real course's cost,
before trusting the model to plan on its own at scale.

### §4b Content quality — the CREATIVE bar (`src/pipeline/contentPlaybook.ts`)

The deterministic gates and the schema enforce *correctness*; the content
playbook enforces *value* — the answer to the 2026-07-23 QA verdict that
exercises were mechanically valid but boring ("estúpidas, no aportan valor").
It is one shared module injected into BOTH the `write` author (as its creative
brief + age-tier reasoning ceiling) and the `review` judge (as binary,
checkable engagement signals), so the same Duolingo/Brilliant-level bar the
author aims for is the bar the judge rejects against — a boring-but-correct
lesson now fails `cognitive_engagement`/`pedagogy` and loops or fails, instead
of shipping.

Core principles (each is a scoreable judge signal): **application over
definition-recall** (make the kid USE a concept in a decision, never recite
it); **concrete-before-abstract, faded** (grounded object → icon → symbol; the
number is the last rung); **guided discovery** (let them attempt/decide first,
reveal the rule in feedback — Brilliant-style); **a decision with a stake +
a curiosity gap** (SDT autonomy; Loewenstein info-gap); **distractors tagged to
a specific misconception** (each wrong option diagnostic, its misconception in
`rationale_md`); **elaborated, outcome-neutral feedback** (Shute — teach the
WHY, shown right or wrong, short and concrete); and a **per-tier abstraction
ceiling** (Piaget: no profit/interest/percent/future-value for tier1 6-7;
change-making & needs-vs-wants for tier2 8-11; profit/buying-to-sell/interest
for tier3 11-13). Sources: retrieval practice & testing effect (Roediger;
Sana & Yan interleaving), desirable difficulties (Bjork), concreteness fading
(Fyfe & Nathan), formative feedback (Shute 2008), self-determination theory
(Deci & Ryan), curiosity info-gap (Loewenstein), children's economic cognition
(U. Wisconsin / GoHenry age milestones), Duolingo & Brilliant published design
philosophy. The playbook text is deliberately tight — it ships in every write
and review prompt, so every line must change what the model produces.

## §5 Providers

| Role | Provider / model | Why |
|---|---|---|
| Author (plan/write/localize) | DeepSeek `deepseek-chat` (V3.x, JSON mode) | Cheapest capable JSON author; prompts do the heavy lifting |
| Judge (review) | Qwen `qwen3-max` via DashScope compatible-mode (`qwen-plus` fallback env) | Independent provider decorrelates blind spots (LF-Brain pattern) |
| Images | Prism (`picturegen/`, HTTP `PICTUREGEN_URL`) → Qwen `qwen-image` on DashScope | Only image path; judge-crafted LF-identity prompts + Vault cache = never pay twice for the same request. Gemini discarded 2026-07-23 (quota-0) |
| TTS | Echo (`audiogen/`) — qwen3-tts-flash | See its own service docs |

All clients are raw `fetch` behind one `providers/` chokepoint with usage
logging. Keys live ONLY in `coursegen/.env` (gitignored; §1.10). Model ids are
env-overridable (`DEEPSEEK_MODEL`, `QWEN_JUDGE_MODEL`).

Because DeepSeek/Qwen are "smaller" models, the prompts are the product:
palette contracts are terse and exact (field names, cardinalities, per-type
example fragments for the 10 most-error-prone types), MIX RULES are mandatory
and machine-repairable, temperature is low, and everything the model could get
wrong deterministically (ids, arithmetic, answer keys for simulations) is
either generated programmatically or re-verified programmatically.

## §6 Child-safety posture (§1.9 — non-negotiable)

- No minor PII ever reaches a provider: prompts contain ONLY catalog/facts/
  canon content (age band, no names of real children — characters are the
  actors).
- Deterministic kid-safety gates run BEFORE the LLM judge; the judge's
  kid_safety dimension is a hard gate on top, and a human publish step is a
  blocking gate on top of that. Three layers, none optional.
- Generated lessons never auto-publish. `status='review'` → human → `published`.

## §7 What Echo consumes (contract)

On publish (or on demand), Echo receives `{lesson_id, locale}`; it reads the
CLIENT-SAFE document (never answer keys), narrates the narratable fields
(LESSON_ENGINE §12). **Voice map implemented** (`audiogen/src/env.ts`
`voiceFor()`): per UNIT — `story_dialogue` line / `story_scene` character →
segment envelope `narrator.character` → per-locale default, in that order;
per-character overrides are 12 optional env vars
(`TTS_VOICE_<DINA|LIRUF|RHO|ZARA>_<LOCALE>`), unset = falls through to the
locale default, so the map fills in incrementally with zero code changes.
Encodes mono MP3 (small, quality-preserving), stores in filebase
`lesson-audio`, and patches `audio_segment_id`s + an `audio` manifest into
the lesson_documents row. Idempotent by (lesson, locale, segment, voice,
text-hash) — a voice change alone re-narrates just that unit.

## §8 QA catalog — `coursegen/curriculum/qa-lesson-engine-smoketest/`

A deliberately tiny, non-shipping course (62 lessons, never appears in §3.1b's
sequence) that exercises the ENTIRE pipeline end to end before trusting it
with a real, expensive course run: one `forced_types`-pinned lesson per every
one of the 56 LESSON_ENGINE segment types (isolated, cheap, exact coverage),
4 multi-type combo lessons (in-lesson sequencing), and a minimal
`review_spaced` topic (the review pathway). Exercises text generation, all 6
gates, the judge, both localizations, image generation (`picture_choice`),
and — once narrated — Echo end to end, plus every Core/frontend endpoint a
real course would hit. `catalog:check` reports 0 errors and ~19 shape-quota
WARNINGS by design (a compact QA catalog doesn't match real-course grammar —
warnings, never errors, are the expected and correct outcome here). Run it
first: `npm run generate -- --course qa-lesson-engine-smoketest`.
