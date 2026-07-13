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
- `src/pipeline/` — `plan.ts` (blueprint→skeleton + deterministic `planRepair`), `write.ts` (skeleton→document, corrective retries + per-segment salvage), `gates.ts` (the 5 deterministic gates), `review.ts` (Qwen judge + revise loop), `localize.ts` (string-freeze translation), `images.ts` (Gemini + filebase upload), `publish.ts` (split + Vault upsert), `checkpoint.ts` + `run.ts` + `../cli.ts` (orchestration).
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

## Read before touching

- `/COURSE_ENGINE.md` — the pipeline spec (hierarchy, catalog format, stages, gates, providers, safety).
- `/LESSON_ENGINE.md` — the document contract Forge generates against (§3 envelope, §5 the 56-type taxonomy, §6 grading semantics).
- `agent/prompts/templates/new-lesson-type.md` — the protocol for extending the taxonomy (frontend-first; this package's `src/contract/` + `pipeline/prompts/palette.ts` follow once the frontend type lands).
- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
