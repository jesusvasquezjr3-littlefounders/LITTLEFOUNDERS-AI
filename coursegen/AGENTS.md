# AGENTS.md — coursegen (Forge)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).
> **Engine spec (authoritative for the pipeline):** [/COURSE_ENGINE.md](../COURSE_ENGINE.md). Content contract (authoritative for what Forge generates): [/LESSON_ENGINE.md](../LESSON_ENGINE.md).

## Mission

Generates courses and lessons for learn/ using **DeepSeek + Qwen**. Two things live in this package:

1. An Express `/health` service (internal, reachable only with `INTERNAL_API_KEY` — currently just the health envelope; not yet called service-to-service by anything).
2. **Forge**, a CLI pipeline (`npm run generate`) that turns a curated curriculum catalog into published `LessonDocument`s in Vault. Forge is **operator-triggered only** — never run by CI or any automatic process (/AGENTS.md sign-off rule, `agent/core/BOUNDARIES.md` #8).

## Pipeline shape (implemented — see `/COURSE_ENGINE.md` §4 for the full spec)

```
validate (catalog/) → plan → write → gate → review → localize → images → publish
```

- `src/catalog/` — Zod schemas + loader for `taxonomy.yaml` / `facts.yaml` / `catalog.yaml` / `adventures/*.yaml`. `npm run catalog:check [-- <path>]`.
- `src/contract/` — a **copy** of `frontend/src/lesson-engine`'s Zod contract (schemaBase + the 8 families' `schema.ts` + the composed `schema.ts`). See "Contract-copy parity rule" below.
- `src/providers/` — raw-`fetch` clients behind one chokepoint per provider (`deepseek.ts`, `qwen.ts`, `gemini.ts` for images), transport retry (`retry.ts`, jittered backoff, 429/5xx/network only), and the usage ledger (`usage.ts`, budget kill switches).
- `src/pipeline/` — `plan.ts` (blueprint→skeleton + deterministic `planRepair`), `write.ts` (skeleton→document, corrective retries + per-segment salvage), `gates.ts` (the 7 deterministic gates — incl. gate 7 generation-quality: icon whitelist, quality-map scale, cell-key format), `review.ts` (Qwen judge + revise loop), `localize.ts` (string-freeze translation), `images.ts` (Gemini + filebase upload), `publish.ts` (split + Vault upsert), `checkpoint.ts` + `run.ts` + `../cli.ts` (orchestration).
- `src/vault/restClient.ts` — service-role PostgREST client for Vault writes, mirrors `backend/src/services/supabaseRest.ts`.

## Invariants that bite here

- **All AI output is Zod-validated** against the copied `LESSON_ENGINE.md` contract before it is trusted for anything (gate 1). Never persist unvalidated model output.
- **Answer keys are server-only.** `pipeline/publish.ts#splitDocument` is the single sanctioned stripper on the Forge side (mirrors `stripAnswers()`) — never hand-strip a document elsewhere.
- Generated content ships in **3 locales** (en-US, es-MX, pt-BR); es-MX is the authoring locale, the other two come from `localize.ts`'s string-freeze translation, never a silent English-only lesson.
- **Child safety (§1.9):** no minor PII in prompts to DeepSeek/Qwen/Gemini — prompts contain only catalog/facts/canon content (age band, no real children's names). The forbidden-vocabulary gate (gate 2) and the judge's `kid_safety` dimension are independent layers on top of that; a human `publish` flip is the third, non-optional layer (§6). Generated lessons land as `status='review'`, **never** auto-published.
- **Paid-API runs are a BOUNDARIES action** — `npm run generate` requires `DEEPSEEK_API_KEY`/`QWEN_API_KEY` (checked lazily by `requireGenerationKeys()` right before the first paid call, never at import time) and is triggered by a human in this session, never by CI.
- **Retries are two separate counters** — transport retries (`providers/retry.ts`, 429/5xx/network, jittered 0.5s→8s, max 4) never share a budget with schema-corrective retries (`pipeline/correctiveRetry.ts`, fed the previous failure's Zod issues).
- **Budgets are checked before every paid call** — `UsageLedger.checkBudget()` throws `BudgetExceededError` once `FORGE_MAX_TOKENS_PER_RUN` / `FORGE_MAX_USD_PER_RUN` is hit; `run.ts` stops scheduling new slots (already-`published` slots stay published; everything else stays resumable via the checkpoint).

## Contract-copy parity rule (no workspaces)

`src/contract/**` is a **copy** of `frontend/src/lesson-engine`'s Zod contract, not a re-export — this repo has no workspaces (`/AGENTS.md` §1.2). Whenever the frontend contract changes (a new exercise type, a changed field), re-copy the affected file(s) into `src/contract/`, adjusting **only** the relative import paths (frontend uses bundler-style imports with no extension; this package is `NodeNext` and every relative import needs an explicit `.js`). Never hand-edit the copy to add new fields — that's how the copies drift.

`npm run contract:check` is the gate: it normalizes each pair (strips `import` lines and all whitespace/semicolons — coursegen and frontend use different formatting conventions, that's not drift) and diffs. Run it after any frontend contract change and after touching anything in `src/contract/`.

`src/contract/core/types.ts` is a deliberately **minimal subset** of the frontend original (just `LESSON_LOCALES`/`LESSON_SUBJECTS` — nothing that pulls in React) and is **not** part of the byte-diffed set. `src/contract/registry.ts` is Forge-only (derives type→family/schema maps from the copied schemas) and has no frontend counterpart.

## Curriculum catalog authoring

Catalog content (`curriculum/<course-slug>/*.yaml`) is **human-reviewed content design**, authored separately from this pipeline code (`/COURSE_ENGINE.md` §3). This package only:

- Defines and validates the Zod schema for those files (`src/catalog/schema.ts`).
- Loads + cross-validates them (`src/catalog/loader.ts`): fact_refs resolve, slugs are unique per parent, themes/tiers/families are in `taxonomy.yaml`'s closed vocabulary, and quota deviations (4 sagas/adventure, 6 topics/saga, 4 lessons/topic) are **warnings**, not errors.

Never hand-edit curriculum YAML from this package's code — if `catalog:check` reports a content problem, that's a finding to report to whoever is authoring that file, not something to patch programmatically.

## Lessons from the first real run (2026-07-13) — read before ANY pipeline change

The `qa-lesson-engine-smoketest` course was the first time this pipeline ever ran against real APIs. Every rule below exists because its absence cost a real failure that day. Do not relearn these the expensive way:

1. **The model cannot infer JSON shapes from type names — never remove the shape examples.** `write.ts`/`review.ts` inject an exact per-type JSON example derived live from the Zod schemas (`shapeExample.ts`). Before that existed, DeepSeek invented a different wrong shape on every retry (`story_scene` produced 4 distinct invalid shapes in 4 attempts). If you add a segment type, the example is derived automatically — but if a type has NON-OBVIOUS semantics the schema can't express (id-reference sequences, index-keyed records, sentinel values), it ALSO needs a targeted line in `BASE_HARD_RULES` (see `equation_builder`/`pattern_complete`/`story_branch`/`savings_goal`/`fill_blank`/`picture_choice` there for the pattern).
2. **Gate failures are corrective feedback, not death sentences.** Gates run INSIDE `write.ts`'s corrective-retry loop (via `WriteInput.gateCtx`) so their actionable messages reach the model's next attempt. If you add a gate, write its `message` so a model can act on it — name the field, the expected value, and the observed value.
3. **The judge must be given facts it otherwise guesses.** `reviewLesson` receives `priorMicroObjective` (`null` = first lesson, exempt from connect-to-prior). Before that, the judge failed lessons on "assuming this isn't the first lesson". If you add a rubric dimension that depends on course position, catalog intent, or anything outside the document itself, pass that context in — never let the judge assume.
4. **Every enum-valued payload/answer key must be in `gates.ts#NON_VISIBLE_KEYS`** or `localize.ts` will send it to the translator, which will happily "translate" the enum (`mode: "typed"` came back as pt-BR prose and failed the contract). `nonVisibleKeys.test.ts` derives this requirement from the schemas and fails CI on any gap — when it fails, add the key to the set; never weaken the test.
5. **Operator npm scripts must load `.env` explicitly** (`tsx --env-file-if-exists=.env …`). `dev` scripts had it; `generate` and audiogen's `narrate:all` didn't, and both crashed on their very first real invocation. Any new script that reaches `getConfig()` needs the flag.
6. **`checkpoint.ts` is shared by concurrent slot workers** — its `save()` serializes writes through an internal queue. Never call `writeFile`/`rename` on the checkpoint path directly, and never "simplify" the queue away: `FORGE_CONCURRENCY=2` is the default and the pre-queue version crashed with tmp-file `ENOENT` races.
7. **Verify visibility end-to-end after publishing, not just row counts.** The DB rows being present proves nothing — a missing RLS policy on `lessons` made every published course render 0 lessons to real users while every service-role query looked perfectly healthy. After any schema/RLS/publish change: log in as a real (non-service-role) user in the browser and see the lessons.
8b. **QA coverage and real pedagogy are NOT in tension — catalog briefs must ALWAYS be real content.** The first smoke-test catalog used meta briefs ("Verificar el ejercicio X de forma aislada") and the generated lessons read as placeholders to a real reviewer (and the judge kept flagging them). `forced_types` pins the exercise TYPE; the micro_objective/narrative_beat must still teach something true (see the lemonade-stand rewrite for the pattern). Never author a blueprint whose text is about the platform itself.
8c. **publish resets `lesson_documents.audio` to `{}`** — regenerated text invalidates old narration, and Echo's batch only picks rows with a null manifest. If you change what publish writes, keep that reset or stale clips will survive content changes silently.
8d. **The images stage must NEVER fail a lesson — quota/billing errors are real and permanent, not transient.** Live 2026-07-14: Gemini's free-tier image model returned `429 ... limit: 0` (zero free-tier quota for `gemini-2.5-flash-preview-image`) — a HARD, non-retryable ceiling, not a burst to back off from. `illustrateSegments` now catches ANY provider failure (not just `ProviderNotConfiguredError`) per OPTION: log a warning, leave the icon fallback, keep going — never re-throw and fail the whole slot. Only a missing API key short-circuits the whole document (cheap, no point trying more options). Images are documented as OPTIONAL (COURSE_ENGINE.md §4) — this is what makes that true in practice, not just on the happy path.
8e. **Every full-document completion call needs an explicit `maxTokens`.** Found live 2026-07-14: none of write/localize/review's `complete()` calls set `maxTokens`, so DeepSeek silently applied its own (lower) default and truncated mid-string on a content-heavy document — surfaced as "invalid JSON: Unterminated string", indistinguishable from a real malformed-output bug until you check the truncation position. All three (`write.ts` write + write-last-resort, `localize.ts` translate, `review.ts` revise) now pass `maxTokens: 8192`. Any NEW call site that returns a full lesson document must do the same — `plan.ts`'s skeleton-only call is the one exception (output is small by construction).
8. **Remaining known-hard spots** (fail-prone even after the above, acceptable losses on a big run, revisit if they spike): `equation_builder` (models struggle with id-sequence arithmetic), `story_branch` (graph coherence across 8+ nodes), and judge rejections of content whose *framing* is meta/test-like — real courses with real narrative beats don't trigger that last one.

## Read before touching

- `/COURSE_ENGINE.md` — the pipeline spec (hierarchy, catalog format, stages, gates, providers, safety).
- `/LESSON_ENGINE.md` — the document contract Forge generates against (§3 envelope, §5 the 56-type taxonomy, §6 grading semantics).
- `agent/prompts/templates/new-lesson-type.md` — the protocol for extending the taxonomy (frontend-first; this package's `src/contract/` + `pipeline/prompts/palette.ts` follow once the frontend type lands).
- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
