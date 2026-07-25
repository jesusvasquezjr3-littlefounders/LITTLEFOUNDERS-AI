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
  [--no-images] \
  [--dry-run] \
  [--run-id <id>]
```

- `--course <slug>` (required) — a directory under `curriculum/<slug>/`.
- `--slots <id,...>` — restrict to specific slots (`adventureSlug/sagaSlug/topicSlug/lessonSlug`, or a prefix of one, e.g. `archipelago-1/saga-1`). Omit to run the whole catalog.
- `--locales` — defaults to all three (`es-MX,en-US,pt-BR`); es-MX is always generated first (the authoring locale) regardless of order given.
- `--no-images` — skip the images stage; icons remain the fallback (never emojis).
- `--dry-run` — run the full pipeline (plan→write→gate→review→localize→images) but skip the Vault `publish` write.
- `--run-id` — resume a specific run; omit to start a fresh run (or resume the latest matching checkpoint if one exists at the default id).

### Run lifecycle

Every run is file-checkpointed at `runs/<run-id>/checkpoint.json` (gitignored) with a per-slot state machine:

```
pending → planned → written → reviewed → localized → illustrated → published
                                                              ↘ failed (retried on the next run)
```

Re-running the same `--course`/`--slots` **resumes**: each stage no-ops once its slot has already reached or passed that state. Only `published` is terminal — a `failed` slot is retried from wherever it left off. A per-run cost/token ledger is appended to `runs/<run-id>/ledger.jsonl`; the CLI stops scheduling new slots once `FORGE_MAX_TOKENS_PER_RUN` / `FORGE_MAX_USD_PER_RUN` is hit (already-published slots are unaffected).

Lessons always land in Vault as `status='review'` — a human flips them to `published` (COURSE_ENGINE.md §6, non-negotiable for kids' content).

### Env vars

See `.env.example` for the full list with defaults. Groups: author/judge provider keys (DeepSeek, Qwen), image provider key (Gemini, optional), Vault service-role credentials (publish stage), filebase credentials (images stage), run budgets/concurrency, and cost-table overrides.

### Other scripts

| Script | What it checks |
|---|---|
| `npm run catalog:check [-- <path>]` | Validates `curriculum/<course>/*.yaml` against `src/catalog/schema.ts` + cross-references (fact_refs, slug uniqueness, taxonomy membership, quota warnings). No path = every course under `curriculum/`. |
| `npm run contract:check` | Diffs `src/contract/**` against its `frontend/src/lesson-engine` originals (import-line + whitespace/semicolon normalized) — the no-workspaces parity gate. |

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

### Image backfill (`npm run images:backfill -- --course <slug> [--dry-run]`)

**Operator-triggered only.** Fills in missing illustrations on lessons that are **already published or in review**, without regenerating any content. For every `lesson_document` of a published-or-review lesson in the course, it runs the same images stage as generation (`illustrateSegments`) over the STORED `document` — adding `image_url` to `picture_choice` options and `memory_flip` card sides that lack one — and PATCHes **only** the `document` column back.

- Starts from the stored `document` and only ADDS `image_url`; the `audio` column (and any per-segment audio stamps inside the document) and `answer_keys` are never read or written.
- No `GEMINI_API_KEY` → a clean full skip (`GEMINI_API_KEY not configured`); per-option failures (429 `limit:0` quota, HTTP, network) are logged and skipped — icons stay the fallback (§8d).
- A document that gains zero images is not patched (no-op write avoidance).
- `--dry-run` runs the full illustration pass but performs no Vault writes.
- Prints a per-document line plus a final total (documents scanned / patched / images generated / skipped). Exit 0 on any clean run (even all-skipped / quota-exhausted); exit 1 only on an unexpected error. Needs Vault (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) and, to actually generate, Gemini + filebase credentials.
