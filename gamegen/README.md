# gamegen (Arcade)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md). Engine spec: [/GAME_ENGINE.md](../GAME_ENGINE.md).

**Mission:** Concept-bound minigame generation for the `games/` section — DeepSeek authors a `GameDocument` manifest, Qwen judges it, Prism draws its sprites, Vault stores it — plus a minimal internal `/health` service.
**Port (dev):** 4003 · **Deploy:** Railway · **Access:** internal only (`INTERNAL_API_KEY`)

```bash
npm install
cp .env.example .env
npm run dev        # Express /health service
npm test
```

> **What is shipped vs. planned.** This README describes the service **as it will be at the end of Phase 5** of the Game Engine build; the implementation lands across Phases 1–5 on branch `feat/game-engine`. Everything below is tagged: **[shipped]** = read out of this package's code/config today (2026-07-30); **[planned]** = the contract the implementation must satisfy, not yet code. Today `src/` is only `app.ts` (health + envelope 404) and `index.ts`.

Arcade generates games from a **prebuilt-mechanic + generated-manifest** design (decision RESOLVED 2026-07-30 — see [AGENTS.md](AGENTS.md)). It never generates game code: the 8 mechanics are hand-written in `frontend/src/game-engine/mechanics/`, and Arcade produces the JSON that skins and parameterizes them.

## Routes

| Method | Path | Description | Status |
|---|---|---|---|
| GET | `/health` | Service health envelope `{ data: { service, version, status }, error: null }` | **[shipped]** |

**There is no `/api/v1` route in the plan** — Arcade is **CLI-driven**, not called service-to-service. What the plan does add is the sibling-service hygiene the scaffold lacks **[planned]**: a Zod-validated frozen `src/env.ts` (`getConfig()` + `resetConfigCache()`) and an internal-key guard mounted on the `/api/v1` prefix comparing `timingSafeEqual(sha256(provided), sha256(expected))` — never a `String.length` pre-check, which throws `RangeError` (a 500 instead of a 401) on any header byte ≥ `0x80` (§1.14). `GET /health` stays above the rate limiter and every optional dependency. Unknown paths keep answering the `{ data: null, error: { code: 'NOT_FOUND' } }` envelope.

## Scripts

| Script | What it does | Status |
|---|---|---|
| `npm run dev` | `tsx watch` the Express `/health` service | **[shipped]** |
| `npm run build` / `npm start` | `tsc` → `node dist/index.js` | **[shipped]** |
| `npm run type-check` / `npm run lint` | `tsc --noEmit` / `eslint .` | **[shipped]** |
| `npm test` / `npm run test:watch` | `vitest run` / `vitest` | **[shipped]** |
| `npm run generate` | The Arcade pipeline — the only script that spends money. **Operator-triggered only.** | **[planned]** |
| `npm run catalog:check [-- <path>]` | Zod-validates `curriculum/<course>/games.yaml` + cross-validates every blueprint's `topic_path` against `coursegen/curriculum/<course>/catalog.yaml`. Free, offline. Wired into `npm test`. | **[planned]** |
| `npm run contract:check` | Diffs `src/contract/**` against its `frontend/src/game-engine` originals (import-line + whitespace normalized) — the no-workspaces parity gate. Free, offline. Wired into `npm test`. | **[planned]** |
| `npm run coach -- --run <run-id>` | Free, offline, deterministic, **propose-only** report over what a finished run left behind (`checkpoint.json`, `ledger.jsonl`, `rubrics.jsonl`) → `coach-report.md`. Applying a proposal is a human editing the playbook/prompts/gates in a normal commit. | **[planned]** |

## The Arcade CLI (`npm run generate`) — [planned]

**Operator-triggered only** — never run by CI (`agent/core/BOUNDARIES.md` #8: bulk paid AI calls and publishing are both human-sign-off actions). Requires `DEEPSEEK_API_KEY` + `QWEN_API_KEY`, checked lazily right before the first paid call, so `npm run dev` / `test` / `catalog:check` / `contract:check` never need them.

The flag surface is modeled on Forge's (`coursegen`) so operators do not learn two CLIs — `--course`, `--slots`, `--locales`, `--no-images`, `--dry-run`, `--run-id`. **The exact flag set is pinned by the implementation, not by this README**: neither the implementation brief nor `/GAME_ENGINE.md` §9 fixes it, so treat Forge's documented flags as the intended shape and update this table when `src/cli.ts` lands.

### Stages

| Stage | Paid? | What it does |
|---|---|---|
| `validate` | free | Catalog + cross-catalog validation (`catalog:check`), slot enumeration |
| `plan` | **PAID** (DeepSeek) | Blueprint → skeleton: mechanic confirmation, item/category counts, difficulty shape, target/pass posture |
| `author` | **PAID** (DeepSeek) | Skeleton → full es-MX `GameDocument` + its server-only `GameValidation` sidecar |
| `gate` | free | Deterministic gates, cheap-first: Zod contract, forbidden vocabulary per tier × locale (hard fail), numeric coherence, misconception coverage, character canon, closed sets (palette/sfx/bgm/sprite slots), anti-genericity |
| `simulate` | free | **Bot-play winnability gate** — the `perfect` bot must reach `pass_score`, the `random` bot must not, the tick budget must hold |
| `judge` | **PAID** (Qwen) | Decorrelated-provider rubric 1–5 + notes: `concept_fit, fun_agency, clarity, kid_safety, difficulty_fairness`; `kid_safety` is a hard floor |
| `localize` | **PAID** (DeepSeek) | es-MX → en-US + pt-BR, structure FROZEN, container keys skipped |
| `illustrate` | **PAID** (Prism) | Sprites + background via `picturegen/` (4007), purposes `game_sprite` / `game_background` |
| `publish` | free | Upsert `games` + three `game_documents` rows (service role), `document`/`validation` split, `status='review'` |

`illustrate` runs on the **es-MX document before the `localize` string-freeze**, so one image serves all three locales. Games always land as `status='review'` — a human promotes them from the `/admin/content` Games queue (§1.9, non-negotiable for kids' content).

### Run lifecycle

```
pending → planned → authored → simulated → judged → localized → illustrated → published
                                                        ↘ failed (failedFrom recorded; retried on the next run)
                                                        ↘ dry-run (pristine pending slots only)
run id namespace:  games-<courseSlug>-<ISO8601>
telemetry marker:  generation_runs.params.kind = 'games'
```

File-checkpointed at `runs/<run-id>/checkpoint.json` (gitignored) with a per-slot state machine; re-running the same course/slots **resumes** (each stage no-ops once its slot has reached or passed that state; only `published` is terminal). A per-run cost/token ledger is appended to `runs/<run-id>/ledger.jsonl`, and the run stops scheduling new slots once its token/USD cap is hit. Non-dry runs upsert the shared Vault telemetry tables (0017/0018) read by `/admin/generation`, which **filters by `params.kind`** so game runs never contaminate lesson cost/quality trends.

`--dry-run` validates the catalog and the slot enumeration and stops **before every paid stage**: zero LLM/image calls, no API keys required, and slots holding in-progress checkpoint data are left untouched.

## Env vars — [planned unless marked]

`.env.example` is the authoritative list; this table is the reading guide. **[shipped]** = present in `.env.example` today.

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4003` | **[shipped]** — §1.5 LOCKED port |
| `INTERNAL_API_KEY` | — | **[shipped]** — validates inbound `x-internal-api-key` on `/api/v1` |
| `BACKEND_INTERNAL_URL` | `http://localhost:4000` | **[shipped]** — Core, for service-to-service calls |
| `DEEPSEEK_API_KEY` | — | **[shipped]** — author + plan + localize. Required only by `npm run generate` |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | Mirrors coursegen |
| `DEEPSEEK_MODEL` | — | The author/localize model. A **reasoning** model spends its completion budget thinking, so size `maxTokens` by reasoning + answer, never by the length of the answer (coursegen/AGENTS.md) |
| `QWEN_API_KEY` | — | The judge. Required only by `npm run generate` |
| `QWEN_BASE_URL` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | Mirrors coursegen |
| `QWEN_JUDGE_MODEL` | — | Judge model — a deliberately decorrelated provider from the author |
| `PICTUREGEN_URL` | unset | Prism (4007), the ONLY image path. **Unset = the `illustrate` stage skips cleanly** (icon fallback stays) |
| `PICTUREGEN_INTERNAL_KEY` | — | Sent to Prism as `x-internal-api-key`. Prism owns the Depot upload, so Arcade needs no `FILEBASE_*` |
| `SUPABASE_URL` | — | Vault, for the `publish` stage + telemetry |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service role — bypasses RLS on purpose; `game_documents` has RLS enabled with **zero policies**, so service role is its only reader |
| Run budgets / concurrency | — | Token cap, USD cap and worker concurrency, one kill switch each, checked before every paid call. **The variable NAMES are not pinned** by the brief or `/GAME_ENGINE.md`; whoever writes `src/env.ts` settles them (Forge's are `FORGE_MAX_TOKENS_PER_RUN` / `FORGE_MAX_USD_PER_RUN` / `FORGE_CONCURRENCY`) and updates `.env.example` in the same commit |
| Cost-table overrides | — | Optional per-1K-token / per-image USD overrides, same group coursegen exposes; only needed when provider pricing moves |

A budget cap that cannot fit the job is a bug, not a guard — Forge's 5M-token default killed a 1312-lesson course at lesson ~82, and the fix was an effective cap of `max(absolute, slots × per-slot)` printed at startup. Re-check the per-slot number against a measured run whenever you add a stage that spends.

## Operator workflow

1. **Author the catalog.** `curriculum/<course>/games.yaml` — human content design, one blueprint per game (`topic_path` + mechanic + intent). Never generated, never machine-patched.
2. **`npm run catalog:check`** — free. Proves every blueprint is well-formed and every `topic_path` exists in Forge's catalog **before** a single paid call.
3. **`npm run contract:check`** — free. Proves `src/contract/**` still matches `frontend/src/game-engine`. A stale copy does not fail loudly; Zod silently strips the fields it does not know about.
4. **`npm run generate -- --course <slug> --dry-run`** — free, keyless, non-destructive. Confirms the slot enumeration is what you meant.
5. **`npm run generate -- --course <slug>`** — the paid run. A human triggers it, in session, with the budget caps set (`agent/core/BOUNDARIES.md` #8). Watch `/admin/generation` (live) and the run summary (cost, cache-hit share, per-stage failures).
6. **`npm run coach -- --run <run-id>`** — free. Diagnose what the run actually did; apply proposals by hand.
7. **Review and publish.** Games land `status='review'`. A human promotes them from `/admin/content` → Games. This gate is not optional and is not automatable.

Whole-catalog Forge + Arcade runs go through the root `npm run generate:full` **[planned]**, which launches the Forge track run and the Arcade run concurrently with linked ids and a combined summary, staggering illustration because the DashScope image quota is **shared** with Prism's other caller.

## Cost warning

`npm run generate` calls paid APIs (DeepSeek author/plan/localize, Qwen judge, Prism/DashScope images). Illustration is the dominant cost, which is why `illustrate` runs before the string-freeze (one image, three locales) and why Prism is cache-first (an identical request never hits the paid image API twice). Every paid call must pass `checkBudget()` first and must land in the ledger — spend that is not in the ledger is invisible to every guard.
