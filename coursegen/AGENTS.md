# AGENTS.md — coursegen (Forge)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).
> **Engine spec (authoritative for the pipeline):** [/COURSE_ENGINE.md](../COURSE_ENGINE.md). Content contract (authoritative for what Forge generates): [/LESSON_ENGINE.md](../LESSON_ENGINE.md).

## Mission

Generates courses and lessons for learn/ using **DeepSeek + Qwen**. Two things live in this package:

1. An Express `/health` service (internal, reachable only with `INTERNAL_API_KEY` — currently just the health envelope; not yet called service-to-service by anything).
2. **Forge**, a CLI pipeline (`npm run generate`) that turns a curated curriculum catalog into review-ready `LessonDocument`s in Vault. Forge is **operator-triggered only** — never run by CI or any automatic process (/AGENTS.md sign-off rule, `agent/core/BOUNDARIES.md` #8).

## Pipeline shape (implemented — see `/COURSE_ENGINE.md` §4 for the full spec)

```
validate (catalog/) → plan → write → gate → review → localize → images → publish
```

- `src/catalog/` — Zod schemas + loader for `taxonomy.yaml` / `facts.yaml` / `catalog.yaml` / `adventures/*.yaml`. `npm run catalog:check [-- <path>]`.
- `src/contract/` — a **copy** of `frontend/src/lesson-engine`'s Zod contract (schemaBase + the 8 families' `schema.ts` + the composed `schema.ts`). See "Contract-copy parity rule" below.
- `src/providers/` — raw-`fetch` clients behind one chokepoint per provider (`deepseek.ts`, `qwen.ts`, `picturegen.ts` — the Prism HTTP client, the ONLY image path), transport retry (`retry.ts`, jittered backoff, 429/5xx/network only), and the usage ledger (`usage.ts`, budget kill switches; image cost is accounted inside Prism, not here).
- `src/pipeline/` — `plan.ts` (blueprint→skeleton + deterministic `planRepair`), `write.ts` (skeleton→document, corrective retries + final full-document recovery before diagnostic-only salvage + `stripNullValues`/`repairDocument` sanitizers + the FULL icon whitelist in-prompt), `gates.ts` (the 9 deterministic gates — incl. gate 9 readability: per-tier×locale Flesch-Kincaid/Fernández-Huerta/Flesch-PT bands over learner-facing prose, calibrated against the live corpus (0 false failures on 186 judged-good docs) — incl. gate 7 generation-quality: icon whitelist, quality-map scale, cell-key format; and gate 8 clarity/visual-first: prompt_md ≤160 chars/≤3 sentences, no fake question in non-graded types, no answer-leak in prompt/hints), `review.ts` (Qwen judge + revise loop, fluency/drill calibration, low-decision-type floor relaxation), `localize.ts` (string-freeze translation), `images.ts` (asks Prism for EVERY concrete-object slot across all families via a per-type illustration plan + a segment-level scene anchor; Prism owns judge+generation+storage+cache), `illustrationStyle.ts` (single bundle version for Vault provenance and style-safe inheritance), `recapDialogue.ts` (opt-in dual-persona recap: blueprint `recap_dialogue: true` appends a teacher-student story_dialogue where the STUDENT persona is blind to the lesson — authentic naive questions; runs BEFORE gates so nothing ungated ships), `publish.ts` (split + Vault upsert), `checkpoint.ts` + `run.ts` + `../cli.ts` (orchestration — incl. `FORGE_SLOT_ATTEMPTS` outer per-slot regen-from-scratch retries, the mass-generation convergence knob).
- `src/vault/restClient.ts` — service-role PostgREST client for Vault writes, mirrors `backend/src/services/supabaseRest.ts`.
- `src/vault/telemetry.ts` — post-run telemetry ingest (0017: generation_runs/slots/tracks — the durable scoreboard).
- `src/pipeline/liveTelemetry.ts` — DURING-run live heartbeat (0018: generation_runs_live — per-stage slot progress, cost, images; upserted on every transition; row deleted at run end). Aggregated by a `LiveTelemetry` class instantiated once per `runGeneration()` and called by `processSlot` after every stage's `store.save`. Swallow-on-failure; telemetry, never control flow.

## Invariants that bite here

- **All AI output is Zod-validated** against the copied `LESSON_ENGINE.md` contract before it is trusted for anything (gate 1). Never persist unvalidated model output.
- **Answer keys are server-only.** `pipeline/publish.ts#splitDocument` is the single sanctioned stripper on the Forge side (mirrors `stripAnswers()`) — never hand-strip a document elsewhere.
- Generated content ships in **one complete 3-locale bundle** (en-US, es-MX, pt-BR); es-MX is the authoring locale, the other two come from `localize.ts`'s string-freeze translation. `generate` and `generate:track` reject a partial locale set before any checkpoint, telemetry, provider call, or Vault write.
- **Child safety (§1.9):** no minor PII in prompts to DeepSeek/Qwen/Prism — prompts contain only catalog/facts/canon content (age band, no real children's names). The deterministic gates, the judge's `kid_safety` dimension, a fresh full-course `verify:course` attestation, and the human Core release are independent layers. Generated lessons land as `status='review'`, **never** auto-published; Vault atomically publishes the full hierarchy only after all release preconditions pass.
- **Paid-API runs are a BOUNDARIES action** — `npm run generate` requires `DEEPSEEK_API_KEY`/`QWEN_API_KEY` (checked lazily by `requireGenerationKeys()` right before the first paid call, never at import time) and is triggered by a human in this session, never by CI. A retryable DeepSeek author transport failure, or a provider-local DeepSeek 402 balance failure, may use Qwen as a ledgered fallback (`FORGE_DEEPSEEK_FALLBACK_TO_QWEN`, default true); invalid credentials and malformed requests do not fail over. Every fallback remains subject to deterministic gates, review and human release.
- **Retries are two separate counters** — transport retries (`providers/retry.ts`, 429/5xx/network, jittered 0.5s→8s, max 4) never share a budget with schema-corrective retries (`pipeline/correctiveRetry.ts`, fed the previous failure's Zod issues).
- **Budgets are checked before every paid call** — `UsageLedger.checkBudget()` throws `BudgetExceededError` once `FORGE_MAX_TOKENS_PER_RUN` / `FORGE_MAX_USD_PER_RUN` is hit; `run.ts` stops scheduling new slots (already-`published` slots stay published; everything else stays resumable via the checkpoint). Fresh image calls reserve Prism's configured worst-case verifier redraw count (`FORGE_MAX_PICTUREGEN_IMAGES_PER_REQUEST`, default 3) before reaching Prism, then ledger the exact count Prism reports even when it rejects every pixel. **A kill switch only exists if the error PROPAGATES.** A per-item `catch` inside a stage MUST rethrow `BudgetExceededError`; `ProviderNotConfiguredError` is a clean icon-fallback only for an intentional non-shipping run. `--require-images` validates Prism before any author call and propagates every image failure, so every production release candidate is fail-closed rather than spending on text before discovering visual delivery is unavailable.

## Contract-copy parity rule (no workspaces)

`src/contract/**` is a **copy** of `frontend/src/lesson-engine`'s Zod contract, not a re-export — this repo has no workspaces (`/AGENTS.md` §1.2). Whenever the frontend contract changes (a new exercise type, a changed field), re-copy the affected file(s) into `src/contract/`, adjusting **only** the relative import paths (frontend uses bundler-style imports with no extension; this package is `NodeNext` and every relative import needs an explicit `.js`). Never hand-edit the copy to add new fields — that's how the copies drift.

`npm run contract:check` is the gate: it normalizes each pair (strips `import` lines and all whitespace/semicolons — coursegen and frontend use different formatting conventions, that's not drift) and diffs. Run it after any frontend contract change and after touching anything in `src/contract/`.

> **RUN THE RIGHT ONE.** `backend` has its OWN `contract:check` (backend/src/lesson-contract ↔ frontend). Running that one and seeing "OK" says NOTHING about coursegen's copies — a mistake made on 2026-07-25 that let real drift sit unnoticed for the whole session. From the repo root, both matter: `cd coursegen && npm run contract:check` AND `cd backend && npm run contract:check`.
>
> **WHY DRIFT IS SILENT AND EXPENSIVE.** Zod objects STRIP unknown keys by default. So when the frontend contract gained a field that coursegen's copy lacked, the author dutifully emitted it, gate 1 validated the document, and the field was DELETED — no error, no warning, nothing in the logs. Measured that day: 7 of 10 files had drifted, all of them missing exactly the visual-first fields added earlier in the branch (`image_url`, `icon`, `label`, `ask_label`, `ask_image_url`). `image_url` happened to be harmless because `illustrateSegments` writes it AFTER validation, but `count_objects`'s `label` was not: the author's labels were stripped, the image stage found nothing to draw, and the lesson shipped as bare icons with zero pictures in all three locales.
>
> The lesson generalizes: after ANY change to `frontend/src/lesson-engine/**/schema.ts`, re-copy and run coursegen's `contract:check` in the SAME commit. A stale copy does not fail loudly — it quietly deletes content.

`src/contract/core/types.ts` is a deliberately **minimal subset** of the frontend original (just `LESSON_LOCALES`/`LESSON_SUBJECTS` — nothing that pulls in React) and is **not** part of the byte-diffed set. `src/contract/registry.ts` is Forge-only (derives type→family/schema maps from the copied schemas) and has no frontend counterpart.

## Identity migration — kid progress must survive republishes (2026-07-25)

Every publish upsert keys on `(parent_id, slug)`, so republishing UNCHANGED
slugs already preserves row UUIDs — and all learner progress keys on those
UUIDs. The danger is a RENAME or restructure: a changed slug inserts a
brand-new row and silently orphans every kid's attempts/streaks/map states.
The contract (roadmap.sh migration-mapping pattern):

- Declare renames in the catalog: `renamed_from: <old-slug>` on the
  adventure/saga/topic/lesson being renamed. Publish then RENAMES the
  existing Vault row first (same UUID) and the upsert lands on it.
  Idempotent — once the old slug is gone the rename is a no-op. Remove the
  declaration after the rename has shipped everywhere.
- `verify:course` enforces the other half: an orphaned lesson (in Vault,
  absent from the catalog) that carries learner progress FAILS the
  acceptance check. Orphans without progress are reported informationally.

## Curriculum catalog authoring

Catalog content (`curriculum/<course-slug>/*.yaml`) is **human-reviewed content design**, authored separately from this pipeline code (`/COURSE_ENGINE.md` §3). This package only:

- Defines and validates the Zod schema for those files (`src/catalog/schema.ts`).
- Loads + cross-validates them (`src/catalog/loader.ts`): fact_refs resolve, slugs are unique per parent, themes/tiers/families are in `taxonomy.yaml`'s closed vocabulary, and quota deviations (4 sagas/adventure, 6 topics/saga, 4 lessons/topic) are **warnings**, not errors.

Never hand-edit curriculum YAML from this package's code — if `catalog:check` reports a content problem, that's a finding to report to whoever is authoring that file, not something to patch programmatically.

## Content quality — the CREATIVE bar (`src/pipeline/contentPlaybook.ts`)

The gates + schema enforce CORRECTNESS; the playbook enforces VALUE. `contentPlaybook.ts` is ONE module injected into both `write.ts` (author creative brief + `tierReasoningGuidance`) and `review.ts` (judge binary engagement signals), so the author's bar and the judge's bar are identical. It exists because the 2026-07-23 manual QA found exercises mechanically valid but boring ("estúpidas, no aportan valor"). Core rules: application-not-recall, concrete-before-abstract (faded), guided discovery, a decision-with-a-stake premise, distractors tagged to a specific misconception, elaborated outcome-neutral feedback, and a per-tier abstraction ceiling (no profit/interest/percent for tier1). Research-grounded — see COURSE_ENGINE.md §4b for the source list. When you touch write/review prompts, keep the playbook injected; when you touch the playbook, it changes EVERY generation, so re-read §4b first.

## Pedagogy is VALIDATED, not assumed (`src/catalog/progression.ts`)

The catalog schema carries the pedagogy vocabulary (age tiers, per-lesson `difficulty`, `micro_objective`, the spaced-review layer's `review_of`, `prerequisites` with an earlier-only rule). `checkProgression` is what turns that vocabulary into a **guarantee**: it proves a catalog describes a learnable path before a single paid API call, and runs automatically inside `catalog:check`.

It encodes the product promise — take a learner with ZERO prior knowledge to mastery, guiding them by the hand, with day-over-day retention, without boring or saturating them:

| code | level | promise |
|---|---|---|
| `cold-start` | error | the course opens at difficulty 1, so a beginner has somewhere to stand |
| `ramp-cliff` | error | difficulty never jumps more than +1 between consecutive lessons (drops are fine — consolidation eases off on purpose). Checked ACROSS topic/saga boundaries, not just inside a topic |
| `retention-gap` | warning | every teaching saga is cited by some review topic — taught once and never retrieved does not stick |
| `retention-single-shot` | warning | a saga is retrieved at more than one DISTINCT distance (one extra pass is not spaced practice) |
| `first-review-too-far` | warning | the first retrieval lands within 12 topics, before the material decays into re-teaching |
| `retention-backwards` | warning | reviews are positioned after the material they review, not before it |
| `monotony` | warning | no more than 4 consecutive lessons share an identical family/type signature |
| `cognitive-load` | warning | a topic introduces ≤ 6 facts |
| `topic-difficulty-spread` | warning | one topic stays within 2 difficulty steps |

`standalone: true` catalogs (type-coverage harnesses) are exempt from the retention checks — isolated demos have nothing to consolidate.

**CALIBRATE AGAINST THE AUTHORED CURRICULUM, NOT INTUITION.** The first version of the spacing rule demanded a strictly increasing RAW review-citation sequence. It flagged all 32 teaching sagas of every large course — 96 false warnings — against a curriculum whose spacing is in fact textbook (measured distances 1, 2, 12, 33, 48, 176). The duplicates come from one review topic legitimately citing several topics of the same saga; only DISTINCT distances carry meaning. Current calibration over the real corpus: **4,254 blueprints across 4 courses → 0 errors, 1 warning** (a genuine 5-lesson monotony run in `investing`). If a new rule fires in bulk, measure before believing it — a rule that cries wolf trains people to ignore the gate.

## The model REASONS: an empty completion is budget starvation, not an answer

`DEEPSEEK_MODEL` is `deepseek-v4-pro`, a **reasoning** model. It spends its completion budget thinking before emitting a single character of content, so a call whose `maxTokens` is too low returns `content: ''` with `finish_reason: 'length'` — and HTTP 200. Measured on the real API, translating a THREE-WORD title:

| `max_tokens` | `content` | `reasoning_tokens` | `finish_reason` |
|---|---|---|---|
| 60 | `''` | 60 | `length` |
| 300 | `''` | 300 | `length` |
| 800 | `"The Position's Accounts"` | 477 | `stop` |

That is what shipped **nine of ten topic titles blank** in en-US and pt-BR: `translateTitle` asked for 60 tokens, got an empty string reported as success, trimmed it, and upserted it into `topics.title`. Nobody saw it because a blank title renders as an empty pill, not an error. It only surfaced when the acceptance check started asserting that titles are present and localized.

Two defences, both in place:

1. **`openAiCompatibleComplete` refuses and accounts for a starved completion.** Empty content with `finish_reason: 'length'` throws a typed error carrying the provider-reported usage. The provider wrappers append that billable usage to the ledger exactly once before rethrowing, so a rejected response can never make a run look cheaper than it was.
2. **Every completion call needs headroom above the reasoning cost.** `translateTitle` is 1500 (measured need: 477 + variance). Full-document calls use `FORGE_DOCUMENT_MAX_TOKENS` (default 16,384; operator-tunable per run) after a real financial-education pilot exhausted 8,192 reasoning tokens before emitting JSON. Do not lower it merely because the visible answer is short.

When you add a completion call, do not size `maxTokens` by the length of the ANSWER — size it by reasoning + answer. A 3-word reply can legitimately need 500+ tokens.

## Image inheritance — illustration is the dominant cost, so never re-pay for the same drawing

Prism caches on `sha256(model + size + "STYLE_VERSION | purpose | scope | label | context")`, so a cache hit needs the label AND the context byte-identical (and, for scene purposes, the same `scope` — Forge sends `<course-slug>/<lesson-slug>`). A REGENERATION rewrites both, so every slot misses the cache and every image is billed again — even when the object is the same lemon. At the configured image unit rate, illustration is a dominant controllable cost; one failed 62-slot run billed 424 fresh generations and published nothing. The active Prism model is `qwen-image-max`; verify its current DashScope tariff before quoting a new pilot total.

`src/pipeline/imageInheritance.ts` closes that: before asking Prism for "limones", `run.ts` reads the lesson's PREVIOUSLY published documents from Vault and reuses the URL already drawn for that normalized label. Free, no network, and it survives the label/context rewrite that defeats the cache. Since migration `0032`, the donor document must also carry the current `FORGE_ILLUSTRATION_STYLE_VERSION`; legacy/null art is deliberately excluded after a style change. Points that matter when you touch it:

- **Keyed on the normalized LABEL, not label+purpose** — a deliberate trade-off. Prism art-directs per purpose, so a reused image can carry the framing of the slot it was first drawn for: a small, on-brand cosmetic difference, and the right price for not re-billing an identical drawing.
- **Scene anchors are NEVER inherited.** `buildImageInheritance` only indexes images that have a sibling label (an OBJECT); a segment-level `image_url` is a scene, where a stale picture would be *wrong*, not merely differently framed.
- **Scoped to the course** through a PostgREST embedded-resource filter, so a lesson slug repeated in another course cannot donate its art.
- **Style-aware since migration `0032`:** every published document records `illustration_style_version`; Forge inherits only the current `FORGE_ILLUSTRATION_STYLE_VERSION`. Legacy/null documents are not free donors, so a Prism style bump cannot be bypassed by old lesson URLs.
- **Failure is swallowed on purpose.** If Vault is unreachable the index is empty and images are paid for — the old behaviour. Inheritance is a cost optimisation, never a precondition.
- The run summary reports `placed / freshly generated (billed) / inherited (free)`, so the saving is visible instead of assumed.

## A repair that changes a TYPE must not orphan its BRIEF (2026-08-15)

Owner report: some lessons contain questions that arrive from nowhere. Root
cause: `planRepair` rewrote `seg.type` in five places and never touched
`seg.brief`. A brief is the micro-situation the lesson has been building — "Zara
decide si sube el precio de la limonada" — so a segment retyped from `quiz_mcq`
to `piggy_split` reached the writer as a jar-splitting widget with a
pricing-decision premise. The writer authored the mismatch faithfully, and the
child met an exercise the lesson had never set up. Worse, it landed LATE: the
money rule targets the last graded segment and the diversify rule scans from the
end, so the damage concentrated exactly where a lesson should be paying off.

Rules that follow from it:

- **A mix-rule violation is feedback to the PLANNER, not a mutation.**
  `describeMixRuleViolations` states each broken rule in the planner's own
  vocabulary and the corrective loop re-plans type and brief together. One extra
  cheap DeepSeek call, and only when a rule was actually broken.
- **`planRepair` is the net, not the path.** It still runs, and it still
  degrades rather than killing a slot when the planner cannot comply in
  `MAX_PLAN_ATTEMPTS` — but that case now prepends an explicit `fixes` line, so
  it is visible in the run report instead of looking like business as usual.
- **Never assign `seg.type` directly — call `retype()`.** It records
  `retypedFrom`, which `write.ts` turns into an instruction to RE-ANCHOR the
  premise in the same characters/objects/stakes rather than force the old one
  through a mechanic that cannot express it.
- **A repair can only fix half a plan.** That is the general lesson. Any future
  deterministic fixer that touches one field of a model-authored pair must
  either fix both fields or make the divergence visible downstream.

## A scene anchor's subject is the SITUATION, never the instruction (2026-08-14)

The published financial-education catalog opened almost every exercise with the
same lemonade stand. Three things had to be true at once, and all three are
worth carrying forward as rules:

1. **`prompt_md` is not a subject for the story family.** For the numeric types
   (`coin_count`, `make_change`, `measure_read`, `compare_table`, …) the prompt
   IS the situation and makes a fine brief. For `story_dialogue`, `eavesdrop`,
   `dialogue_choice` and `story_branch` it is a bare instruction — *"Escucha la
   conversación entre Dina y Liruf."* Those types describe their situation
   elsewhere in the payload, and `sceneAnchorSubject` (`pipeline/images.ts`) now
   reads it from there: `context_md`, `opening_md`, the start node, the first
   two dialogue lines. Adding a type to `SCENE_ANCHOR_TYPES` means deciding
   where its situation actually lives.
2. **Narrative sources only — never options, items or `answer`.** The anchor
   must not reveal what the child is being asked to work out.
3. **No subject → no anchor.** `sceneAnchorSubject` returns `undefined` and the
   segment renders with no image. Silence beats a confident wrong picture; a
   generic image above an exercise actively misleads, because a child reads the
   picture as the thing the question is about.

The other half of the fix lives in Prism (its style brief no longer names a
subject, and its verifier now checks `depicts_subject`) — see
`picturegen/AGENTS.md`. Forge's own guard is the release check: **`verify:course`
fails if any scene image serves more than one lesson.** Coverage counts
presence, and presence was never the problem — every one of those anchors was
present.

**A claimed gate that does not exist is worse than no rule.** `write.ts` had told the author for weeks that omitting `count_objects` scene labels "fails the gate" — no such gate existed, so those lessons shipped as bare icons with ZERO pictures in a visual-first product, silently, in all three locales. Found while building inheritance (the lesson yielded 0 inheritable images, which is what exposed it). `countObjectsLabels` now enforces it. When you write "the gate rejects this" in an author instruction, go and confirm the gate.

## Mass generation: what makes a 1000-lesson run survivable (2026-07-25)

An 8-dimension resilience audit asked one question — *what happens on the 900th slot that did not happen on the 6th* — and produced 62 confirmed risks. The rules below are the ones whose absence was going to cost a real, expensive run. `npm run verify:course [slug]` is the acceptance check that proves the OUTPUT; these are about surviving the PROCESS.

1. **A budget cap that cannot fit the job is a bug, not a guard.** `FORGE_MAX_TOKENS_PER_RUN` defaults to 5M and a real lesson costs ~104k tokens including retries, so a 1312-lesson course died at lesson ~82. The effective cap is now `max(absolute, slots × FORGE_MAX_TOKENS_PER_SLOT)`, printed at startup. When you add a stage that spends, re-check that per-slot number against a measured run.
2. **The ledger is the durable record — read it back.** Totals used to restart at zero in every process, so the "per-run" ceilings were per-INVOCATION and bounded nothing across the dozen-plus resumes a long run needs. `UsageLedger.hydrate()` replays `ledger.jsonl` (tolerating a truncated final line — refusing to resume a multi-day run would be worse). Any new cost MUST go through the ledger or it is invisible to every guard: image spend sat outside it for months and was the largest uncapped cost in the pipeline.
3. **A resume must be provably compatible.** `isSlotDone` only reads a state string, so resuming under the same `--run-id` with different flags silently treated incompatible work as finished. `RunParams` is persisted and a mismatched resume with published slots is REFUSED; partial locale sets are rejected at both generation entry points. `--dry-run` has its own terminal state for the same reason.
4. **Every enumerated slot must land in exactly one summary bucket.** With only `published`/`failed`, 700 unattempted slots of 1000 looked like a clean partial success. The summary now carries published / failed / dryRun / skipped / alreadyDone / notAttempted, asserts the total, and makes `notAttempted` a non-zero exit.
5. **Never claim success without proof.** The final `return { state: 'published' }` was unconditional, so a slot whose state fell outside the lifecycle skipped every stage guard and reported success with nothing in Vault. It is asserted against the checkpoint now.
6. **Failure bookkeeping must not be able to kill the run.** An exception from the checkpoint write inside `processSlot`'s own catch escaped and aborted every remaining slot. `saveQuietly` contains it.
7. **Every outbound fetch needs a timeout, and a retry series shares that deadline.** An untimed socket parked a pool worker (~20 min observed) and could drain every lane. Prism and Vault use `AbortSignal.timeout`; `openAiCompatibleComplete` also applies `FORGE_CHAT_TIMEOUT_MS` to its complete retry series, so four retries cannot silently multiply an operator's ceiling.
8. **Rate limits and 5xx are different timescales.** One 0.5s→8s ×4 ladder (~3.75s total) expired inside the same per-MINUTE window that rejected the call, turning transient limits into terminal slot failures. 429 now gets 1s→60s ×6, and a provider `Retry-After` always wins (capped at 120s).
9. **Validate at the CLI edge (§1.14).** An empty `--slots` meant "the whole course" (a 1000-lesson bill from a typo), an empty or partial `--locales` meant an unreleasable course, and a `--slots` pattern matching nothing exited 0 reporting a successful run of zero lessons. All rejected.
10. **One run ID has one writer.** `RunLock` excludes a concurrent CLI/process for the same `runs/<run-id>` directory; without it two workers can both read `planned`, re-author the same slot, and race the checkpoint/ledger.
10. **Never write unvalidated model output into a shared row.** `translateTitle` had no retry, no schema and no emptiness check, and `openAiCompatibleComplete` coerces a blank completion to `''` and returns SUCCESS — nine of ten topics shipped with BLANK titles in en-US and pt-BR. It also ran per LESSON, so sibling workers wrote different translations into the same `topics` row and the title drifted. Validated and memoized per (title, locale).
11. **Surface what a stage actually did.** `salvaged`/`droppedSegments` were returned by write and never read, so lessons once published up to 8 of 14 segments short in silence; image counts were destructured away, so an unconfigured Prism shipped a visual-first curriculum with zero illustrations and reported complete success. Salvage is now diagnostic-only and refused before review/publication; image counts remain in the summary, and a run that publishes lessons while generating zero images warns.
12. **Batching and chunking were MEASURED and rejected (2026-07-25) — do not re-derive.** A ledger audit over all 32 runs (6,107 calls): coalescing N lessons per write request would save ~$5 per 1000-lesson course but makes corrective retry batch-granular (write already averages 2+ attempts/lesson — one bad doc re-pays the whole batch), needs an array-Zod wrapper with per-doc salvage, and collides with the configurable full-document output allowance at ~4 heavy docs. Judge calls must NEVER be merged: per-lesson independence is load-bearing (the rubric gates a per-lesson revise loop; merging couples verdicts and forces sibling re-judges). Chunking is unjustified — 1 truncation in 1,164 current-pipeline calls; if truncations rise, raise `FORGE_DOCUMENT_MAX_TOKENS` first. Localize coalescing saves ~$0.006/run — skip. The lever that captures most of the same dollars with zero validation churn is DeepSeek's automatic prefix cache: keep prompts assembled static-first (see "An identical prompt prefix is a 10x discount" below), and read the cache-hit share in the run summary (ledger `cached_prompt_tokens`).
13. **Outer retries are STAGE-AWARE (2026-07-26) — never regress this to a blanket reset.** The checkpoint records `failedFrom` on every slot failure. A failure from `reviewed`/`localized`/`illustrated` resumes from the checkpoint (`prepareSlotForAttempt` — the judge-approved document is in `data`; re-paying plan+write+revise+judge for a transient localize/publish error is pure waste), while plan/write/judge failures keep the measured from-scratch regen. The LAST attempt always resets fully so a deterministic late-stage failure still gets one fresh draw. Related: the revise loop EARLY-STOPS when a re-judge improves no failing dimension — compare judge-emitted rubrics ONLY (a gate-breaking revise cycle produces no new rubric and must never feed the comparison, or it kills the designed gate-feedback recovery path on its first firing).
14. **`--dry-run` spends nothing, structurally.** The short-circuit sits BEFORE every paid stage in `processSlot`, and `runGeneration` skips `requireGenerationKeys` for dry runs. If you add a stage, it must sit after that guard — `dry-run.test.ts` runs without API keys precisely so a regression fails loudly. (Before 2026-07-26 dry-run only skipped publish: "validating" an enumeration paid the full generation bill while claiming "nothing was paid for".)
15. **Whole-course runs go through `generate:track`, and budgets must compose.** Per-run budgets have a floor, so N shards would aggregate to far more permitted spend than the course's real budget — the track passes its REMAINING budget down via `RunOptions.maxUsdOverride` (which only ever LOWERS the scaled budget, never raises it). Its policy is pinned in `track.test.ts`: halt on fatal provider errors and all-slots (systemic) failures, resume shards with unattempted work — work is never skipped — and advance past stubborn slot failures into the mop-up list.

## An identical prompt prefix is a 10x discount (2026-07-25)

DeepSeek's context cache is automatic and prefix-based: identical LEADING
tokens across requests bill ~120x cheaper (v4-pro: $0.435/1M miss vs
$0.003625/1M hit); DashScope's implicit cache bills hits at 20% of input.
Three disciplines keep the discount real — hold them in every prompt change:

1. **Static-first assembly.** Every call site (`write.ts`, `plan.ts`, the
   judge in `review.ts`) puts byte-stable material first (playbook, base hard
   rules, icon whitelist, meta shape, palette, judge rubric-in-system) and
   per-lesson material last. Never splice a conditional into a numbered list
   — renumbering changes every following byte and kills the prefix.
2. **Retries append, never rebuild.** `withCorrectiveRetry` feedback goes
   AFTER the original messages, so attempts 2..N re-send an identical leading
   prompt (a full cache hit). Keep that convention.
3. **Measure, don't assume.** The transport captures cache-hit tokens
   (`cached_prompt_tokens` on every ledger line, `cachedTokens` in the run
   summary, the share printed by the CLI). A prompt change that tanks the
   cache-hit % is a cost regression even if quality holds.

## Lessons from the first real run (2026-07-13) — read before ANY pipeline change

The `first-lemonade-stand` course was the first time this pipeline ever ran against real APIs. Every rule below exists because its absence cost a real failure that day. Do not relearn these the expensive way:

1. **The model cannot infer JSON shapes from type names — never remove the shape examples.** `write.ts`/`review.ts` inject an exact per-type JSON example derived live from the Zod schemas (`shapeExample.ts`). Before that existed, DeepSeek invented a different wrong shape on every retry (`story_scene` produced 4 distinct invalid shapes in 4 attempts). If you add a segment type, the example is derived automatically — but if a type has NON-OBVIOUS semantics the schema can't express (id-reference sequences, index-keyed records, sentinel values), it ALSO needs a targeted line in `BASE_HARD_RULES` (see `equation_builder`/`pattern_complete`/`story_branch`/`savings_goal`/`fill_blank`/`picture_choice` there for the pattern).
2. **Gate failures are corrective feedback, not death sentences.** Gates run INSIDE `write.ts`'s corrective-retry loop (via `WriteInput.gateCtx`) so their actionable messages reach the model's next attempt. If you add a gate, write its `message` so a model can act on it — name the field, the expected value, and the observed value.
3. **The judge must be given facts it otherwise guesses.** `reviewLesson` receives `priorMicroObjective` (`null` = first lesson, exempt from connect-to-prior). Before that, the judge failed lessons on "assuming this isn't the first lesson". If you add a rubric dimension that depends on course position, catalog intent, or anything outside the document itself, pass that context in — never let the judge assume.
4. **Every enum-valued payload/answer key must be in `gates.ts#NON_VISIBLE_KEYS`** or `localize.ts` will send it to the translator, which will happily "translate" the enum (`mode: "typed"` came back as pt-BR prose and failed the contract). `nonVisibleKeys.test.ts` derives this requirement from the schemas and fails CI on any gap — when it fails, add the key to the set; never weaken the test.
5. **Operator npm scripts must load `.env` explicitly** (`tsx --env-file-if-exists=.env …`). `dev` scripts had it; `generate` and audiogen's `narrate:all` didn't, and both crashed on their very first real invocation. Any new script that reaches `getConfig()` needs the flag.
6. **`checkpoint.ts` is shared by concurrent slot workers** — its `save()` serializes writes through an internal queue. Never call `writeFile`/`rename` on the checkpoint path directly, and never "simplify" the queue away: `FORGE_CONCURRENCY=2` is the default and the pre-queue version crashed with tmp-file `ENOENT` races.
7. **Verify visibility end-to-end after publishing, not just row counts.** The DB rows being present proves nothing — a missing RLS policy on `lessons` made every published course render 0 lessons to real users while every service-role query looked perfectly healthy. After any schema/RLS/publish change: log in as a real (non-service-role) user in the browser and see the lessons.
8b. **QA coverage and real pedagogy are NOT in tension — catalog briefs must ALWAYS be real content.** The first smoke-test catalog used meta briefs ("Verificar el ejercicio X de forma aislada") and the generated lessons read as placeholders to a real reviewer (and the judge kept flagging them). `forced_types` pins the exercise TYPE; the micro_objective/narrative_beat must still teach something true (see the lemonade-stand rewrite for the pattern). Never author a blueprint whose text is about the platform itself.
8c. **publish resets `lesson_documents.audio` to `{}`** — regenerated text invalidates old narration, and Echo's batch only picks rows with a null manifest. If you change what publish writes, keep that reset or stale clips will survive content changes silently.
8d. **Optional image mode must not fail a lesson on an individual provider error — but required visual mode is fail-closed.** (Learned live 2026-07-14 on Gemini's `429 limit: 0` hard ceiling — Gemini has since been DISCARDED and images go through Prism/`picturegen.ts`.) In the default optional mode, `illustrateSegments` catches per-target failures, logs a warning, leaves the icon/text fallback, and keeps going. `ProviderNotConfiguredError` (Prism unset) and `BudgetExceededError` (the run-level kill switch) always stop the document/run because continuing would misrepresent the operator's configuration or exceed the cap. The explicit `--require-images` production mode is the deliberate exception: it propagates any missing/rejected illustration and fails the slot, so a candidate cannot reach release with incomplete visual coverage. Images remain OPTIONAL only for non-shipping text pilots; `verify:course` and the required mode enforce the production floor.
8f. **The HTTP status Prism answers with is a RETRY INSTRUCTION — a 4xx from Prism is TERMINAL, never retry it.** (2026-07-28.) `providers/picturegen.ts` wraps the call in `withTransportRetry`, which retries 429/5xx/network and gives up immediately on any other 4xx. So Prism answers 502 only for transient faults (`IMAGE_TIMEOUT`, `IMAGE_RATE_LIMITED`, `IMAGE_PROVIDER_ERROR`, `IMAGE_DOWNLOAD_FAILED`) and 422 for deterministic ones (`IMAGE_BAD_RESPONSE`, `IMAGE_VERIFICATION_FAILED`). While every failure was a 502, an unusable prompt re-paid a full `qwen-image-max` generation on every retry attempt for a result that could never differ. When you add an image failure mode on either side, pick its status by one question: could the IDENTICAL request plausibly succeed later?

## Lessons from the visual-first regen (2026-07-24) — read before touching gates/judge

The 62-lesson Testing course was regenerated after a 1x1 Fable-judge review scored it 2.03/5 on visual-first (55 Material-icon fields vs 3 AI images; 56/70 prompts were text walls). The pipeline changes that made the regen produce terse, fully-illustrated, correct content — and the false-failures they caused, which you must not reintroduce:

9. **The judge runs BEFORE the images stage — never make it require `image_url`.** Illustration happens after review (reviewed → illustrate → localize → publish), so at review time no image exists. A judge anchor that asks "is every object a real image?" fails EVERY lesson. Judge the visual DESIGN (short literal object labels ready to illustrate), never the pixels — the pipeline guarantees the images downstream.
10. **`illustrateSegments` covers a per-type PLAN, not two hardcoded types.** Adding image support for a new segment type = one case in `planTargets` (label + `PicturePurpose` + where the URL lands) plus the schema field. Types whose visuals must be engine-controlled (pattern_complete's size ladder) or are inherently abstract (quiz statements) are intentionally absent. Every `*image_url` key MUST also be in `NON_VISIBLE_KEYS` (see #4) or localize corrupts the URL.
11. **Self-contained graded types are KEYLESS.** A graded type whose answer schema is `z.object({})` derives its answer from the payload (coin_count, make_change, budget_fit, balance_scale, savings_goal, memory_flip) — it has no answer key by design. It MUST be in `generationQuality.ts#KEYLESS_GRADED_TYPES` or the answer-key gate false-fails it.
12. **Judge floors are type-appropriate, set in code not prose.** `passesJudgeGate` is document-aware: a lesson made ENTIRELY of low-decision types (content beats, fluency drills, pure recognition — `LOW_DECISION_TYPES`) uses relaxed concreteness (≥3) and cognitive_engagement (≥2) floors, because those types are not worked-numeric reasoning exercises. A course of standalone type-demos (catalog `standalone: true`) is exempt from the concreteness "connect-to-prior-lesson" penalty. Both prevent false-failing otherwise-excellent lessons; a normal reasoning exercise keeps the full 4/3 floors and the continuity check.
13. **Render-truth: judge the RENDERED player, and back every "it's on screen" rule with a deterministic gate.** Reading the JSON is not enough — several defects only appear once a child actually plays the segment in `/dev/lesson-view`, and a prose instruction to the author is not enforcement. The render-truth gates now in `runClarityGate`, each cut from a real defect the strict judge had passed:
    - **`clarityCompareTable` (grounding):** v4-pro parked `compare_table` prices in a *hint*, so the rendered table (empty cells + token bank, no data panel) gave no way to know which stall cost what → a 50/50 guess the exact-cell grader marks wrong. The gate requires every *source* cell (a value the child transcribes — not the "best choice" decision cell/column) to have BOTH its value and its row label in `prompt_md`. A `DECISION_COL` regex skips per-row Sí/No decision columns so they don't false-fail.
    - **`clarityCoinCount` (mechanic match):** the `coin_count` engine only lets the child ASSEMBLE a coin tray to a target (grade = tray sum === target) — there is no yes/no control. An author wrote "¿tiene suficiente para el vaso de 5 pesos?"; the mechanic literally cannot answer it and passes any combo summing to 5. The gate rejects sufficiency-question prompts; guidance forces "form/count the amount." Lesson: when a prompt and a fixed engine mechanic can diverge, gate the prompt against the mechanic.
    - **`picture_choice` / `sort_buckets` (guidance, judge-enforced):** a `picture_choice` must be answerable from its OWN screen (never "según la conversación" pointing at an off-screen sibling segment) and every option needs a literal `text_md` so the image stage illustrates it (an unlabeled option renders a lone fallback icon beside real photos). `sort_buckets` items must be unambiguously one-bucket from the on-screen criterion (don't key "Hielo" as "can wait" for a lemonade stand — a child reasonably calls ice a need).
   General rule: any type that renders a fixed structure the child manipulates — verify a real child could reach the keyed answer from what's on screen, prove it with a gate where the shape is deterministic, and always confirm in the rendered player.
15. **An LLM review panel is a defect FINDER, not a score — its numbers have a ±0.4 noise floor.** Measured 2026-07-24: the same 62-lesson render-truth review was run three times. Between rounds 2 and 3, on the 56 lessons whose content was BYTE-IDENTICAL, mean clarity moved 4.30→3.93 and child_fit 4.23→3.77, and **10 lessons flipped `solvable_from_screen` true→false with no content change at all**. Run-over-run deltas of that size are therefore measurement noise, and "ok_count went from 43 to 47" proves nothing. What the panel IS excellent at: surfacing specific, reproducible defects (it found the compare_table hidden prices, the coin_count prompt/mechanic mismatch, the pattern_complete invisible price ladder, the savings_goal pre-saved-amount math error, the ruler-vs-jug instrument mismatch, and the balance_scale bank that sums to its own target). So: mine the panel for CONCRETE claims, adversarially verify each one, then root-cause it in code/payload and prove the fix with a deterministic gate + the rendered player. Never report a judge mean as evidence of progress, and never gate a release on one; gate on the validator (contract + clarity + quality over every published doc, all locales) and on browser verification.
14. **Fix unfair grading at the ENGINE, not with regeneration whack-a-mole.** The render-truth review kept flagging fine-order tasks (`order_steps`/`rank_choices`/`build_sentence`/`timeline_order`/`code_order`) where a DEFENSIBLE alternative order ("verify price" ↔ "take payment"; "2 vasos por 10 pesos" ↔ "10 pesos por 2 vasos") was marked wrong — and regenerating a lesson just moved the ambiguity to a different pair. The durable fix was an engine capability: `answer.accept_orders` (a set of additional valid orderings; grader takes the best score across `order` + all `accept_orders`). Both grader copies (`frontend/src/lesson-engine` and the authoritative `backend/src/lesson-contract`) must stay byte-identical (parity rule); the answer schema lives in `frontend` + `coursegen/src/contract`; gate 7 enforces each alt is a permutation of `order`; the judge (`review.ts` solvability pass) is told accept_orders orderings ALL count so it stops false-flagging. When the review flags a whole CLASS of lessons for the same structural reason, prefer a capability that fixes the class over N regenerations.
8e. **Every full-document completion call needs an explicit `maxTokens`.** Found live 2026-07-14: none of write/localize/review's `complete()` calls set `maxTokens`, so DeepSeek silently applied its own (lower) default and truncated mid-string on a content-heavy document — surfaced as "invalid JSON: Unterminated string", indistinguishable from a real malformed-output bug until you check the truncation position. All three (`write.ts` write + write-last-resort, `localize.ts` translate, `review.ts` revise) now pass `getConfig().FORGE_DOCUMENT_MAX_TOKENS` (default 16,384). Any NEW call site that returns a full lesson document must do the same — `plan.ts`'s skeleton-only call is the one exception (output is small by construction).
8. **Remaining known-hard spots** (fail-prone even after the above, acceptable losses on a big run, revisit if they spike): `equation_builder` (models struggle with id-sequence arithmetic), `story_branch` (graph coherence across 8+ nodes), and judge rejections of content whose *framing* is meta/test-like — real courses with real narrative beats don't trigger that last one.
16. **Voice garnishes are scoped and gated (2026-07-26): light colloquialisms + sparse emojis.** The playbook (#9) allows an OCCASIONAL G-rated regional colloquial touch in character dialogue/narration only — dosage ramps with tier (tier1 ≈ none → tier3 slightly relaxed, set in `tierReasoningGuidance`), never in instructions/options/answer text, never anything with a double meaning (albures = kid_safety fail); localize renders locale-authentic equivalents at the SAME dosage, never literal translations, never adding slang to neutral sentences. Emojis are allowed ONLY in story-family narration text + `explanation_md`. The PROMPT asks for ≤1 per segment; gate 7's `emojiDisciplineCheck` hard-fails at >2 visible emojis per segment (deliberate slack — the gate counts GRAPHEME clusters, so a ZWJ family or a flag is ONE emoji) and always fails any emoji in prompt_md/hints/meta/answer/graded-payload; keycap sequences (FE0F/20E3) count as emojis in both layers. audiogen's `normalizeForSpeech` strips every emoji before TTS (math pictographs ➕➖✖➗ are EXPANDED to spoken words first, never deleted; speechGuard blocks any residue). `recapDialogue` deterministically budgets its whole dialogue to ≤1 emoji before gating. An emoji must never carry meaning a listener needs.

## Subagent authoring harness (`src/scripts/author-*.ts`) — 2026-08-17

An alternative AUTHOR for the same pipeline: Claude subagents write the lesson
documents instead of DeepSeek, driven from an operator session rather than from
`runGeneration`. Built because the cloud generation path had been unreliable and
the owner wanted the documents written directly. It is operator-triggered only,
exactly like `generate` (BOUNDARIES #8).

```
author:briefs → [subagents author es-MX] → author:validate
   → author:judge emit → [subagent judges] → author:judge ingest → [revise → RE-judge]
   → author:localize extract → [subagents translate] → author:localize inject
   → author:publish
```

**What it replaces, and what it deliberately does NOT.** The subagents replace
`plan` + `write` + `localize`'s translation call. Everything that decides
whether a document is CORRECT is untouched and still runs: the contract
(`lessonDocumentSchema`), all 9 gates via `runAllGates`, `stripNullValues` +
`repairDocument`, the per-locale vocabulary re-gate, and `publishLessonSlot`
with its identity/answer-key/audio-reset rules. An agent's own report that it
finished is never evidence — `author-validate.ts` is the only authority, it
writes the canonical parsed document back over the agent's file, and it exits
non-zero so a partial course cannot be published by accident.

**Every prompt block is IMPORTED, never paraphrased.** `author-briefs.ts`
renders `CONTENT_PLAYBOOK`, `MIX_RULES`, `BASE_HARD_RULES`, the tier palette,
the icon whitelist and the per-type shape examples from the modules that own
them; `author-localize.ts` renders `translationSystemPrompt()`. This is the
contract-copy rule applied to prompts: a second hand-maintained copy of a rule
does not fail loudly when it drifts, it just quietly stops being the rule.
`MIX_RULES`, `BASE_HARD_RULES`, `renderBaseHardRules`, `renderFactsBlock`,
`buildLessonDirectives`, `buildPlanContext` and the localize primitives were
exported for this — all pure moves, so the rendered prompt bytes (and therefore
the DeepSeek prefix cache) are unchanged.

**Translation is a STRING FREEZE, never a re-authoring.** A subagent asked to
"translate this lesson" re-emits the document and quietly renumbers an id or
rounds a number, and the three locales stop being the same lesson. So the
translator never sees a document: `indexVisibleStrings` hands it a flat
index → string map (ids, numbers, enums, answer keys and every
`NON_VISIBLE_KEYS` entry excluded), and `applyTranslatedStrings` re-injects at
the recorded paths, remaps the play currency and re-validates. Structural
parity across locales is mechanical, not hoped for. `localizeLesson` is built
from those same three primitives — there is deliberately no second
implementation. A string that still breaks the schema after translation falls
back to its es-MX source (same last resort as the pipeline) and is COUNTED in
the report, because "shipped in the wrong language" is exactly what hides
behind a green run.

**The judge is not optional, and it pays for itself.** `author-judge` runs
`review.ts`'s own rubric (`judgeSystemPrompt`), schema (`reviewRubricSchema`)
and PASS FLOORS (`failingDimensions`) — the verdict is decided in code, never by
the reviewing agent. Measured over the 64-lesson `radar-de-oportunidades` run:
the 9 gates caught 12 defects, all MECHANICAL; the judge caught 8 more that had
cleared every gate, all SEMANTIC — lessons contradicting their own thesis, and
two whose answer key marked correct reasoning WRONG. It also does not print a
mean: run-over-run judge scores have a ±0.4 noise floor (2026-07-24) and gating
on one is meaningless.

**ALWAYS RE-JUDGE A REVISION.** Of 8 lessons revised after a judge failure, 3
had a NEW defect introduced by the fix (a fresh answer leak, residual
foreshadowing, and a dangling reference to material the revision had removed).
A fix is a change, and a change needs the same scrutiny as the original — tell
the re-judge explicitly not to rubber-stamp, and to report problems the
revision introduced.

**Placement probes are `null`.** `resolvePlacementProbe` is a generation stage
of its own; the harness publishes without it, alongside audio and images.

### The three defect classes that dominate subagent authoring

Measured over 64 lessons. None is visible to a deterministic gate; the first two
are what a contract rule should prevent, the third is now code.

1. **Answer leaked from an earlier segment (~15% of lessons).** The author
   writes a worked example and then grades THE SAME CASE, so the learner
   recognises instead of deriving. Fix by giving the graded segment a fresh
   case — keep the teaching. Only strip the earlier give-away when the case is
   load-bearing for the narrative.
2. **`compare_table` (7 of 12 gate failures).** It must ground every source
   cell's row label AND value in `prompt_md` *and* fit `MAX_PROMPT_CHARS` (160,
   3 sentences) — the cap is NOT waived for it. That only fits a 2×2 table with
   one-to-three-word values; if it does not fit, SHRINK the table. The
   "decision" column (the one exempt from grounding) is detected by a REGEX on
   the column id/label — `/elig|eleg|escoj|escog|choos|pick|best|mejor|winner|ganad/i`
   — so a conceptually-derived column named `conviene` false-fails; renaming it
   `mejor` is the fix, not restructuring.
3. **A translated `build_sentence` that is no longer a sentence.** Its answer is
   an ORDER, and the string freeze hands the translator the tiles with no order
   and no sentence. Ten good words can reassemble into nonsense. Nothing else
   sees it: the gates see valid structure, the judge reads es-MX.
   `author-localize inject` now reassembles every one and PRINTS it per locale
   (`assembleOrderedProse`). It cannot gate — grammaticality is not decidable —
   so the report is the control. Read it.

**What a mechanical check can never catch:** compressing a translation to fit
the length cap produces MEANING INVERSIONS (a "False:" distractor rewritten into
a true statement). Key parity, JSON validity and length checks all pass. Only a
semantic re-read finds it.

**`publishLessonSlot` does not write `badge_asset` or `requires`** — found
while building this. It upserts only slug/subject/title/description/position,
so a course it creates from scratch has `badge_asset = NULL`, and Vault's
`courses_published_badge_required_check` (`status <> 'published' OR badge_asset
IS NOT NULL`) then makes that course IMPOSSIBLE to release — surfacing much
later, as a constraint violation with no obvious cause, to whoever tries to
flip the switch. Dropping `requires` also silently deletes the course-to-course
prerequisite edge (§3.1b). `author-publish.ts` projects both from
`catalog.yaml` after publishing; the pipeline's own publish stage still does
not, and should.

**`position` is an operator decision.** `publishLessonSlot` hardcodes course
position 0, which was unambiguous while Vault held one course. A second course
at 0 leaves learner-facing order undefined, so `author-publish.ts` takes
`--course-position` instead of guessing.

### Proven at full scale (2026-08-18): all 8 adventures, 544 lessons, ×3 locales

The pilot above was 64 lessons, one adventure. The full `entrepreneurship` catalog
now ships the same way — every adventure through `author:validate`, `author:judge`,
`author:localize` and `author:publish`, confirmed by direct production query
(544 lessons, `status='review'`, 1,632 documents). Two more defect classes only
showed up at this scale; the first cost real re-authoring, the second is a pure
tooling trap.

**4. Parallel batches invent DIFFERENT worlds for the same adventure.** Nothing
in the pipeline shares state between concurrent authoring agents, so each one
that opens cold invents its own business, product and cast context. One
adventure reached FOUR incompatible worlds (two different product lines plus a
finale written before any of its own earlier lessons existed) before repair —
harmless per-lesson, catastrophic read start-to-finish. Fix: write a `WORLD.md`
BEFORE dispatching any batch, pinning the business, its numbers, the cast and
the canon callback names, and put it first in every agent's reading order.
**The world file must say it is subordinate to the brief, not the reverse** — an
earlier version omitted that line and got obeyed over the catalog's own
authored briefs by two batches (one substituted a completely different product;
the other overwrote a brief's explicit narrative beat to match the file's
wrong default), both requiring a second pass to re-home. The catalog is
human-reviewed content design; no world file an agent writes outranks it.

**5. `author-judge`'s `notes` field silently drops a valid verdict past 2000
characters.** `reviewRubricSchema` caps `notes` and the schema fails closed
correctly — but a judge that writes a thorough finding into a long paragraph
loses the WHOLE verdict, not just the tail, and the lesson then reads as
unjudged rather than as passing. Measured: 11 verdicts across two adventures
were silently discarded this way, and every one turned out to be a lesson that
was actually clean. `ingest` reports these as a schema `problems` entry, not a
failing dimension — check for that shape specifically, don't assume a missing
verdict means the run crashed.

### A second full-scale run, at real parallelism (2026-08-19/20): `investing`, 544 lessons via `Workflow`

The `entrepreneurship` run above dispatched every subagent by hand through the
interactive `Agent` tool. For `investing` that tool's session-wide spawn cap
(200) was already exhausted by the prior course, with zero live agents to
resume — the fix was the `Workflow` tool: its `agent()` calls run on a
**completely separate budget** from the interactive cap, so a workflow launched
from the same session when `Agent` refuses outright still succeeds. This let
all 8 adventures author, judge and translate **concurrently** (8 workflows ×
up to 16 agents each) instead of one adventure at a time — the whole course
went from authored-but-unverified to published in one sitting. Confirmed by
direct production query: 544 lessons, `status='review'`, 1,632 documents
(544 × 3 locales exactly), course row correct (`position=2`,
`requires=["financial-education","entrepreneurship"]`, `badge_asset` set).

**6. The platform's own per-session usage limit can fail a `Workflow` batch
independently of the subagent-spawn cap.** Mid-run, every in-flight judge
agent across all 8 workflows failed at once with `You've hit your session
limit`, not a spawn-cap error — a different resource entirely, and it resets
on its own schedule. `Workflow` still reports `batchCount`/`completed`
accurately per run, so the recovery is mechanical, not a guess: diff which
`judge/<stem>.verdict.json` files are actually missing on disk against the
manifest, and relaunch a workflow with an **explicit list of only those
slot ranges** (not a symmetric retry of the whole course) — repeated across
all affected adventures until every verdict file exists. Caching does not
dedupe this automatically; a workflow only remembers its own prior run.

**7. `order_steps` / `rank_choices` / `build_sentence` / `timeline_order` /
`code_order` display order is a PURE FUNCTION of `(item ids, segment.id)` —
never the authored JSON array order.** `seededSortMiddlingIds` (gates.ts)
re-derives what the frontend will actually show from those two inputs and
checks it against `answer.order` (and its reverse, since a reversed rail
reads just as naturally). **Reordering the `items`/`tokens` array in the
document does nothing** — the fix that actually works is renaming
`segment.id` (append a suffix) to reseed the hash, and it can take more than
one attempt: a 3-item sequence has only 6 possible renders and 2 of them are
"bad" (the key or its reverse), so a single reseed lands on another bad
render close to a third of the time. Retry with a fresh suffix until
`author-validate` confirms it cleared.

**8. `compare_table` cannot be used for an objective that requires the child
to DERIVE or COUNT the answer.** Its own hard gate demands every source
cell's value be stated together with its row in `prompt_md` — that
requirement is what makes the type solvable, but it also means the type can
only ever test "read this value off the prompt," never "count/identify this
value from a description." An exercise built to test "count how many fraud
signals this case has" degenerates to copying two numbers the prompt already
handed over. There is no compliant middle ground here: if the skill is
derivation, use a different type (`quiz_mcq`/`best_decision` comparing two
*described* cases) — don't reach for `compare_table` at all.

**9. `equation_builder` tokens must use ASCII `*` and `/`, never the Unicode
math glyphs `×`/`÷`.** `evaluateInfixTokens`'s `PRECEDENCE` map only
recognizes `+ - * /` literally; an unrecognized token makes the whole
expression evaluate to `null`, which gate 4 reports as *"no accepted sequence
evaluates to target_result N"* — a message that reads like a wrong answer
key, not an unparseable operator symbol. The contract's own age-tier register
text lists `×`/`÷` among symbols that are "auto-spoken," which is true for
prose but not for these token payloads; grep authored `equation_builder`
segments for the Unicode glyphs specifically, `grep 'PRECEDENCE'` won't find
this on its own.

**10. Sunk cost keeps getting authored as if it were opportunity cost, and a
mechanical gate cannot catch it.** Three related segments across two sibling
lessons scored a "the torneo already had 3 weeks of practice invested in it"
argument as the textbook example of opportunity cost — backward-looking
honoring of past investment is the *opposite* concept from forward-looking
cost of the foregone option, and one of the three instances hard-coded it as
a graded MCQ's correct answer with feedback that reinforced the confusion.
This is a content-accuracy defect specific to a financial-literacy course,
not a style note; it survived all 9 gates and was only caught by the judge's
holistic pedagogy read. Fix pattern: rewrite the winning rationale to name
only forward-looking reasons ("the event doesn't repeat" / "the other option
can be taken later"), never "already invested."

**11. Gate 8's arithmetic-consistency check can misattribute numbers across
sibling items in the same segment.** It scans the whole segment's text for a
"total"-shaped claim and the numbers near it; if an unrelated item elsewhere
in the same `sort_buckets`/`evidence_hunt` payload happens to contain bare
numbers of its own (a duration, a count), the check can flag a mismatch that
was never actually claimed. Confirmed false-positive pattern: a line
containing the word "total" with zero numbers in it got checked against
numbers pulled from a completely different item's text. When this fires and
the arithmetic in the flagged segment is genuinely internally consistent,
the reliable fix is removing the trigger word ("total"/"suma") from the
unrelated line rather than hunting for a math error that isn't there.

**12. Topic titles are es-MX-only in the catalog (`title_es`) and are NOT
part of the per-lesson translation pipeline.** `author-publish` needs a
separate `--titles <file>` — a flat JSON map of `topic-slug → {"en-US":...,
"pt-BR":...}` — covering every unique topic across the whole course (272 for
this one, fewer than the 544 lesson count because most topics hold 2
lessons); the publish step fails closed per-lesson with `no en-US/pt-BR title
for topic "…" — supply it via --titles` if any slug is missing. Generate this
file once per course, before the first publish attempt, not per adventure.
**Stale as of the 2026-08-21 catalog prune** (see `WALKTHROUGH.md`): a topic
with zero surviving lessons needs no title at all, and 272/544 no longer
match either course's live topic/lesson count. Regenerate `--titles` against
the current surviving lesson set, never against these historical numbers.

## Read before touching

- `/COURSE_ENGINE.md` — the pipeline spec (hierarchy, catalog format, stages, gates, providers, safety).
- `/LESSON_ENGINE.md` — the document contract Forge generates against (§3 envelope, §5 the 56-type taxonomy, §6 grading semantics).
- `agent/prompts/templates/new-lesson-type.md` — the protocol for extending the taxonomy (frontend-first; this package's `src/contract/` + `pipeline/prompts/palette.ts` follow once the frontend type lands).
- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
