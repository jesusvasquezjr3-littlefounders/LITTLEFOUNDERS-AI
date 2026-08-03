# coursegen (Forge)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md). Pipeline spec: [/COURSE_ENGINE.md](../COURSE_ENGINE.md). Content contract: [/LESSON_ENGINE.md](../LESSON_ENGINE.md).

**Mission:** Course & lesson generation pipeline (DeepSeek + Qwen) for the learn/ section, plus a minimal internal `/health` service.
**Port (dev):** 4001 · **Deploy:** Railway · **Access:** internal only (`INTERNAL_API_KEY`)

```bash
npm install
cp .env.example .env
npm run dev        # Express /health service
npm test
```

## Routes

| Method | Path | Description |
|---|---|---|
| GET | /health | Service health envelope |

## Forge CLI (the generation pipeline)

**Operator-triggered only** — never run by CI. Requires `DEEPSEEK_API_KEY` and `QWEN_API_KEY` in `.env` (checked lazily, right before the first paid call — `npm run dev`/`test`/`catalog:check`/`contract:check` never need them).

```bash
npm run generate -- --course financial-education \
  [--slots archipelago-1/saga-1/topic-1/lesson-1,...] \
  [--locales es-MX,en-US,pt-BR] \
  [--no-images|--require-images] \
  [--dry-run] \
  [--run-id <id>]
```

- `--course <slug>` (required) — a directory under `curriculum/<slug>/`.
- `--slots <id,...>` — restrict to specific slots (`adventureSlug/sagaSlug/topicSlug/lessonSlug`, or a prefix of one, e.g. `archipelago-1/saga-1`). Omit to run the whole catalog.
- `--locales` — defaults to all three (`es-MX,en-US,pt-BR`); if supplied, it must name exactly those three locales once each. A partial locale run is rejected before checkpoints, telemetry, provider calls, or Vault writes; es-MX is always generated first (the authoring locale) regardless of order given.
- `--no-images` — skip the images stage; icons remain the fallback (never emojis). This is valid for a cheap non-shipping text pilot only: `verify:course` blocks release until every planned visual target has a real illustration.
- `--require-images` — production visual mode. Requires Prism configuration before the first paid author call and fails a slot on any missing/rejected illustration. It is mutually exclusive with `--no-images`; use it for the visual pilot and every full release candidate.
- `--dry-run` — validate the catalog + slot enumeration and stop BEFORE every paid stage: zero LLM/image calls, zero tokens, no API keys required, and slots holding in-progress checkpoint data are left untouched (only pristine pending slots get the `dry-run` marker). (It used to run the whole pipeline and only skip publish — fixed 2026-07-26.)
- `--run-id` — resume a specific run; omit to start a fresh run (or resume the latest matching checkpoint if one exists at the default id).

### Run lifecycle

Every run is file-checkpointed at `runs/<run-id>/checkpoint.json` (gitignored) with a per-slot state machine:

```
pending → planned → written → reviewed → localized → illustrated → published
                                                              ↘ failed (retried on the next run)
```

Re-running the same `--course`/`--slots` **resumes**: each stage no-ops once its slot has already reached or passed that state. Only `published` is terminal. Retries are **stage-aware**: a slot that failed from `reviewed`/`localized`/`illustrated` (recorded as `failedFrom` in the checkpoint) resumes from that stage — its judge-approved document is still in the checkpoint data — while a plan/write/judge failure regenerates from scratch (a fresh draw converges better than revising a bad draft); the last outer attempt always resets fully. A per-run cost/token ledger is appended to `runs/<run-id>/ledger.jsonl`; the CLI stops scheduling new slots once `FORGE_MAX_TOKENS_PER_RUN` / `FORGE_MAX_USD_PER_RUN` is hit (already-published slots are unaffected). Each fresh image reserves its known unit cost before its network call, so concurrent workers cannot exceed the image portion of a small visual-pilot budget.

Lessons always land in Vault as `status='review'`. Production release is deliberately two-step: run `npm run verify:course -- <slug>` after the final document update (all deterministic gates, all locales, hierarchy checks, and the same per-type visual coverage plan used by `images.ts`; it records a fresh internal attestation), then an admin publishes from Content. Core calls Vault's atomic `release_course` RPC, which refuses incomplete hierarchy/locales, unreviewed lessons, or stale/missing verification before publishing the entire hierarchy and auditing the human approval. The local `db:publish-course` helper is development-only.

### Cost-capped financial-education pilot

Start with the first real slot, not a saga: `archipielago-del-trueque/islas-de-los-deseos/cosas-que-quiero/mi-primer-deseo`.

1. Validate for free: `npm run generate -- --course financial-education --slots archipielago-del-trueque/islas-de-los-deseos/cosas-que-quiero/mi-primer-deseo --dry-run`.
2. Only after reviewing the dry-run output and provider configuration, run a deliberately low shell-scoped **admission probe**, for example `FORGE_MAX_USD_PER_RUN=0.50 FORGE_CONCURRENCY=1 FORGE_CHAT_TIMEOUT_MS=300000 FORGE_DOCUMENT_MAX_TOKENS=16384 npm run generate -- --course financial-education --slots archipielago-del-trueque/islas-de-los-deseos/cosas-que-quiero/mi-primer-deseo --require-images --run-id fe-pilot-001`. The flag checks Prism before any author call and fails closed on visual defects. In required visual mode it also reserves the worst-case redraw cost of every still-missing visual target **before the first image request**; a USD 0.50 probe may therefore stop cleanly after text validation rather than buy a partial, unreleasable set of tiles. Do not pass `--no-images` for a release candidate. Model-authored lessons are limited to 8–10 segments. After normal corrective retries, Forge attempts one final complete-document recovery before recording any salvage; a salvaged/shortened document is then refused before review or publication. `FORGE_CHAT_TIMEOUT_MS` bounds the complete LLM retry series, including a provider that stalls before or after headers. A retryable DeepSeek author failure, or a provider-local DeepSeek 402 balance failure, automatically falls back to the already-required Qwen provider (`FORGE_DEEPSEEK_FALLBACK_TO_QWEN=true`); invalid credentials and malformed requests do not. Fallback is ledgered under `:deepseek-fallback` and still must pass gates, review and human release. Full-document calls use the 16,384-token default; localization splits learner-visible strings into bounded, atomic JSON batches so one large lesson cannot exhaust a single response. Use a fresh run ID after a repaired pilot so its ledger is independently auditable. A run directory is single-writer: a second process with the same ID fails before it can spend.
3. For a complete visual lesson candidate, set a separate human-approved cap that covers its worst-case target count (`missing targets × PICTUREGEN_VERIFY_ATTEMPTS × image unit price`) plus author/judge calls; never infer this from the USD 0.50 admission probe. Review its ledger, all three localized documents and the generated art in the admin tools. Do not release this partial course. TTS is a separate operator batch after its production voice credentials and voices are ready; its cost must be budgeted separately.

The full run is an explicit human-authorized spend, uses `generate:track` with
a cumulative course budget (including hard admission for known image cost), and is followed by `verify:course` and the one human
Content release. Never reuse a pilot run id for the full course.

### Mass runs (`npm run generate:track`)

**Operator-triggered only.** Runs a WHOLE course sharded per adventure — sequential `runGeneration` invocations, one run-id/checkpoint per shard (`<track-id>--<adventure-slug>`):

```bash
npm run generate:track -- --course financial-education \
  [--track-id fin-edu-2026-07] [--budget-usd 350] [--shard-passes 3] \
  [--locales ...] [--no-images|--require-images] [--dry-run] [--register kid|adult]
```

The track owns what a single run cannot: a **global cumulative budget** (per-run floors don't compose — the remaining track budget is passed down as a per-shard override), the **resume-vs-advance policy** (halt on fatal provider errors / all-slots failures; resume shards with unattempted work — work is never skipped; advance past stubborn slot failures into a mop-up list), and the **cross-shard report** at `runs/<track-id>/track-report.json` (per-shard outcomes, cost, prefix-cache hit %, failure heatmap by stage). Re-running with the same `--track-id` resumes the whole track. Exit 1 on any halt, mop-up deficit, or failure. Use `--require-images` for every full release candidate.

### Env vars

See `.env.example` for the full list with defaults. Groups: author/judge provider keys (DeepSeek, Qwen), Prism internal-service credentials (images stage), Vault service-role credentials (publish stage), run budgets/concurrency, and cost-table overrides.

### Improvement loop (`npm run coach -- --run <run-id> | --track <track-id>`)

Offline, FREE, deterministic, **propose-only**. Reads what a run left behind
(`checkpoint.json`, `ledger.jsonl`, `rubrics.jsonl`, `track-report.json`) and
writes `coach-report.md`: outcomes + failure heatmap, recurring-error groups,
judge dimension stats (±0.4 noise disclaimer built in), revise-cycle
histogram, cost per published lesson, cache-hit per operation, and proposed
playbook/gate actions **each tied to evidence**. Applying a proposal is a
human editing the playbook/prompts/gates in a normal commit — never automatic
(§1.9: the system must not grade its own homework into kid-facing content).

Run artifacts, per `runs/<run-id>/`: `checkpoint.json` (slot state machine),
`ledger.jsonl` (every paid call), `rubrics.jsonl` (every judge verdict —
appended, last-per-slot wins), `coach-report.md`. Non-dry runs also upsert the
Vault telemetry tables (0017) read by the `/admin/generation` dashboard.

### Other scripts

| Script | What it checks |
|---|---|
| `npm run catalog:check [-- <path>]` | Validates `curriculum/<course>/*.yaml` against `src/catalog/schema.ts` + cross-references (fact_refs, slug uniqueness, taxonomy membership, quota warnings). No path = every course under `curriculum/`. |
| `npm run contract:check` | Diffs `src/contract/**` against its `frontend/src/lesson-engine` originals (import-line + whitespace/semicolon normalized) — the no-workspaces parity gate. |
| `npm run graph:check` | Builds and checks every derived topic competency DAG before any paid provider call. Pass `-- <course>` to inspect one course. The validated edge slice is injected into PLAN, WRITE and REVIEW prompts. |
| `npm run coach -- --run <id> \| --track <id>` | Free, offline diagnosis of a finished run/track with proposed (human-applied) improvements — see above. |

### Image url map (`npm run images:apply-map -- <map.json> [--confirm]`)

**Operator-triggered only.** Rewrites image urls embedded in lesson documents
from an old-url → new-url JSON map — the Forge half of a storage migration
whose Prism half is `picturegen`'s `backfill:webp` (which converts the Depot
objects, updates `picture_assets` in place, and emits the map). Walks the four
image keys (`image_url`, `a_image_url`, `b_image_url`, `ask_image_url`) at
every depth including scene anchors; PATCHes only `document`; strict
completeness — any `lesson-images` url not covered by the map fails the run
(a silent partial rewrite would strand objects that the cleanup then deletes).
Dry-run by default; first real run 2026-07-25 rewrote 334 urls across 120
documents (the PNG→WebP migration: 1.5 GB → 51 MB on Depot).

### Image backfill (`npm run images:backfill -- --course <slug> [--reuse-only] [--dry-run]`)

**Operator-triggered only.** Fills in missing illustrations on lessons that are **already published or in review**, without regenerating any content. For every `lesson_document` of a published-or-review lesson in the course, it runs the same shared per-type images stage as generation (`illustrateSegments`) over the STORED `document`, then PATCHes **only** the `document` column back.

- Starts from the stored `document` and only ADDS `image_url`; the `audio` column (and any per-segment audio stamps inside the document) and `answer_keys` are never read or written.
- No `PICTUREGEN_URL`/`INTERNAL_API_KEY` → a clean full skip; per-option provider failures are logged and skipped — icons stay the fallback (§8d).
- A document that gains zero images is not patched (no-op write avoidance).
- `--dry-run` runs the full illustration pass but performs no Vault writes.
- `--reuse-only` builds a deterministic, course-local index of approved object art and fills exact normalized-label matches without contacting Prism. It needs only Vault credentials, never bills image generation, and deliberately cannot fill scene anchors: a scene must match its own learning context. It is the first remediation step before a paid visual repair.
- Prints a per-document line plus a final total (documents scanned / patched / generated / reused / placed / skipped). Exit 0 on any clean run (even all-skipped / quota-exhausted); exit 1 only on an unexpected error. Normal generation needs Vault (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) and Prism credentials.
