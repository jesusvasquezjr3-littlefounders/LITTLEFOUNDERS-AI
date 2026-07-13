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
