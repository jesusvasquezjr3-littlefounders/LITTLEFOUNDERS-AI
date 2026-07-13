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

**Totals: 8 adventures × (5 sagas) — 4 teaching sagas × 8 topics (6 teaching +
2 review) + 1 review saga × 6 topics — × 4 lessons = 152 lessons/adventure =
1,216 total** (768 teaching + 448 review ≈ 3.3 years at 1/day).

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
          Zod issues; per-segment salvage before full regen
   ↓
gate      DETERMINISTIC, free, in order:
          1. LESSON_ENGINE Zod contract (composed 56-type schema)
          2. Forbidden-vocabulary scan (age tier × locale) — HARD FAIL
          3. Fact gate — every number matches facts.yaml or re-computes
             (coin sums, change, ceil(goal/weekly), balance totals, compound
             values are RE-EXECUTED programmatically against the answer key)
          4. Rationale gate — every wrong option carries rationale_md (P7)
          5. Character canon gate — cast ⊆ {dina,dino,rho,zara}, emotions/
             actions in the closed sets
   ↓
review    INDEPENDENT judge = Qwen (decorrelated provider), rubric 1-5 on:
          age_fit, pedagogy, narrative_quality, kid_safety, es-MX naturalness.
          kid_safety < 5 or age_fit < 4 → revise loop (max 2) → else fail slot.
   ↓
localize  es-MX → en-US and pt-BR: translation-with-contract call (structure
          is FROZEN — ids/answers/numbers copied programmatically, only
          learner-visible strings translated), re-gated per locale (vocabulary
          lists are per-locale).
   ↓
images    OPTIONAL per slot: visual options (picture_choice etc.) get
          generated illustrations — Gemini image API ("nanobanana"), prompt
          enforces flat light background; script post-processes to
          transparent-background PNG (edge flood-fill) and uploads to
          filebase `lesson-images` (content-addressed). Skippable
          (--no-images) — icons remain the fallback, NEVER emojis.
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
**Budget:** `FORGE_MAX_TOKENS_PER_RUN` + `FORGE_MAX_USD_PER_RUN` kill-switches
checked before every call; every call logged to `runs/<id>/ledger.jsonl`
(provider, model, tokens, est. USD). **Concurrency:** small pool
(`FORGE_CONCURRENCY`, default 2).

## §5 Providers

| Role | Provider / model | Why |
|---|---|---|
| Author (plan/write/localize) | DeepSeek `deepseek-chat` (V3.x, JSON mode) | Cheapest capable JSON author; prompts do the heavy lifting |
| Judge (review) | Qwen `qwen3-max` via DashScope compatible-mode (`qwen-plus` fallback env) | Independent provider decorrelates blind spots (LF-Brain pattern) |
| Images | Gemini image API (nanobanana) — `GEMINI_API_KEY`, module ships ready, key pending | Visual options without emojis |
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
(LESSON_ENGINE §12), voice = per-locale default until character voices land
(voice map is config), encodes mono MP3 (small, quality-preserving), stores in
filebase `lesson-audio`, and patches `audio_segment_id`s + an `audio` manifest
into the lesson_documents row. Idempotent by (lesson, locale, segment, text-hash).
