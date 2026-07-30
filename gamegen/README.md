# gamegen (Arcade)

> Part of LittleFounders v2. Read [/AGENTS.md](../AGENTS.md) first; domain rules in [AGENTS.md](AGENTS.md). Engine spec: [/GAME_ENGINE.md](../GAME_ENGINE.md).

**Mission:** Concept-bound minigame generation for the `games/` section — DeepSeek authors a `GameDocument` manifest, deterministic gates and a headless bot-play prove it is winnable, Qwen judges it, Prism draws its sprites, Vault stores it as `review` — plus a minimal internal `/health` service.
**Port (dev):** 4003 · **Deploy:** Railway · **Access:** internal only (`INTERNAL_API_KEY`)

```bash
npm install
cp .env.example .env
npm run dev            # Express /health service
npm test               # catalog:check && contract:check && vitest run
```

**Status (2026-07-30, branch `feat/game-engine`).** The service and the full nine-stage pipeline are implemented — Phases 0–6 committed as `4b0b64f..d968a3e`, with an adversarial-audit fix pass in flight on top. `npm test` passes. Everything documented below was read out of this package's code, not planned. The honest exceptions are listed under [Known gaps](AGENTS.md#known-gaps--verified-2026-07-30-against-the-code-on-this-branch) in `AGENTS.md` — most importantly, **no paid run has ever been executed** and the two telemetry modules are written but not yet called by `run.ts`.

Arcade generates games from a **prebuilt-mechanic + generated-manifest** design (decision RESOLVED 2026-07-30 — see [AGENTS.md](AGENTS.md)). It never generates game code: the 8 mechanics are hand-written in `frontend/src/game-engine/mechanics/`, and Arcade produces the JSON that skins and parameterizes them.

## Routes

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service health envelope `{ data: { service, version, status }, error: null }`. Mounted above every guard and every optional dependency, so it answers with zero credentials configured (§1.14). |

**There is no `/api/v1` route.** Arcade is CLI-driven, not called service-to-service. The `/api/v1` prefix nonetheless carries the internal-key guard (`x-internal-api-key`, compared as `timingSafeEqual(sha256(provided), sha256(expected))` — never a `String.length` pre-check, which throws `RangeError` → 500 instead of 401 on any header byte ≥ `0x80`, §1.14) so the first route to land cannot land unguarded. Because `INTERNAL_API_KEY` is optional in this package, the guard **fails closed** when it is unset: with no key configured `sha256('') === sha256('')` would make an absent header a valid match. Unknown paths answer the `{ data: null, error: { code: 'NOT_FOUND' } }` envelope; a thrown error answers the `INTERNAL` envelope from a 4-arg error handler.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | `tsx watch --env-file-if-exists=.env src/index.ts` — the Express `/health` service |
| `npm run build` / `npm start` | `tsc` → `node dist/index.js` |
| `npm run type-check` / `npm run lint` | `tsc --noEmit` / `eslint .` |
| `npm test` | `catalog:check && contract:check && vitest run` — **both gates run before vitest**, so a stale contract copy or a broken catalog binding fails `npm test`, not just an operator's manual check |
| `npm run test:watch` | `vitest` |
| `npm run generate` | `tsx --env-file-if-exists=.env src/cli.ts` — the Arcade pipeline, the only script that spends money. **Operator-triggered only.** |
| `npm run catalog:check [-- <course-dir>]` | Zod-validates `curriculum/<course>/games.yaml` + cross-validates every blueprint's `topic_path` against `coursegen/curriculum/<course>/catalog.yaml`. Free, offline, keyless. Dev/CI-time only — Railway deploys with `--path-as-root`, so `coursegen/` does not exist in the production image. |
| `npm run contract:check` | Diffs `src/contract/**` against its `frontend/src/game-engine` originals (imports and whitespace normalized away) — the no-workspaces parity gate. Free, offline, keyless. |

There is **no `coach` script** in this package. `judge.ts` writes `runs/<run-id>/rubrics.jsonl` and `providers/usage.ts` writes `runs/<run-id>/ledger.jsonl`, so the raw material for a Forge-style offline coach report exists, but the report generator does not.

## The Arcade CLI (`npm run generate`)

**Operator-triggered only** — never run by CI (`agent/core/BOUNDARIES.md` #8: bulk paid AI calls and publishing are both human-sign-off actions). Keys are checked **lazily**, by `runGeneration` right before the run starts spending, and skipped entirely for `--dry-run`, so `npm run dev` / `test` / `catalog:check` / `contract:check` never need them.

```
npm run generate -- --course <slug>
  [--slots <adventure>/<saga>/<topic>[/<game>],...]
  [--mechanic sorter,runner]
  [--locales es-MX,en-US,pt-BR]
  [--no-images] [--dry-run] [--budget-usd <n>] [--run-id <id>] [--help|-h]
```

The flag table below is read out of `src/cli.ts`, which is the authority.

| Flag | Value | Behavior |
|---|---|---|
| `--course` | slug | **Required.** Selects `curriculum/<slug>/games.yaml`. Missing → usage + exit 1. |
| `--slots` | comma list | Exact slot id `<adventure>/<saga>/<topic>/<game-slug>`, or any prefix of it (a topic path selects every game in that topic). Omit for the whole course. An **empty** value is rejected — it used to mean "the whole course", i.e. a full generation bill from a typo. |
| `--mechanic` | comma list | Restricts the run to a subset of the closed `MECHANIC_IDS`; an unknown id exits 1 with the valid set printed. Useful to regenerate one mechanic's games after a simulator fix. |
| `--locales` | comma list | Subset of `en-US,es-MX,pt-BR`. **Must include `es-MX`** — it is the authoring locale the others are derived from, so a run without it has nothing to translate from. Empty or unknown values exit 1. |
| `--no-images` | flag | Skips the `illustrate` stage entirely (and with it the Prism key requirement). Games publish with icon fallbacks instead of sprites; the run summary says so. |
| `--dry-run` | flag | Validates the catalog and the slot enumeration and stops **before every paid stage**. Zero LLM/image calls, **no API keys required**, and slots holding in-progress checkpoint data are left untouched. |
| `--budget-usd` | positive number | Hard USD ceiling for the run. It only ever **lowers** the scaled cap, never raises it: an operator flag may tighten a ceiling and must never buy headroom the config did not grant. |
| `--run-id` | id | Names (or resumes) the run. Normalized into the `games-` namespace, so a resume with the same flag resolves to the same directory. |
| `--help` / `-h` | flag | Prints usage, exits 0. |

Value-taking flags refuse a value that starts with `--`, so `--run-id --dry-run` cannot silently create a run literally named `--dry-run` while the real dry-run guard never fires.

**Exit code.** `main()` sets a non-zero exit for a run that failed slots, stopped on budget, left slots unattempted, hit a fatal provider error — **or enumerated zero slots**, because a `--slots`/`--mechanic` filter that matches nothing is not a successful run.

### Stages

| Stage | Paid? | What it does | Module |
|---|---|---|---|
| `validate` | free | Catalog + cross-catalog validation, slot enumeration, position resolution | `catalog/loader.ts` via `pipeline/run.ts` |
| `plan` | **PAID** (DeepSeek) | Blueprint → skeleton: mechanic confirmation, item/category counts, difficulty shape, target/pass posture | `pipeline/plan.ts` |
| `author` | **PAID** (DeepSeek) | Skeleton → full es-MX `GameDocument` + its server-only `GameValidation` sidecar | `pipeline/author.ts` |
| `gate` | free | Deterministic gates, cheap-first: Zod contract, forbidden vocabulary per tier × locale (hard fail), numeric coherence, misconception coverage, character canon, closed sets (palette/sfx/bgm/sprite slots), anti-genericity | `pipeline/gates.ts` |
| `simulate` | free | **Bot-play winnability gate** — the `perfect` bot must reach `pass_score`, the `random` bot must not, the tick budget must hold; `explorer` also runs its reachability solver | `pipeline/simulateGate.ts` |
| `judge` | **PAID** (Qwen) | Decorrelated-provider rubric 1–5 + notes: `concept_fit, fun_agency, clarity, kid_safety, difficulty_fairness`; `kid_safety` is a hard floor and escalates to a human instead of being retried | `pipeline/judge.ts` |
| `localize` | **PAID** (DeepSeek) | es-MX → en-US + pt-BR, structure FROZEN, container keys skipped, target-locale vocabulary re-gated on the OUTPUT | `pipeline/localize.ts` + `nonVisibleKeys.ts` |
| `illustrate` | **PAID** (Prism) | Sprites + background via `picturegen/` (4007), purposes `game_sprite` / `game_background` | `pipeline/images.ts` |
| `publish` | free | Upsert `games` + three `game_documents` rows (service role), `document`/`validation` split, `status='review'` | `pipeline/publish.ts` → `vault/gamesRepo.ts` |

`gate` owns no checkpoint state of its own: it runs *inside* the author stage's corrective-retry loop (so a gate failure is actionable feedback for the next attempt) and again standalone as the final authority, plus once more inside the judge's revalidate hook. Nine stages, eight checkpoint states.

`illustrate` runs on the **es-MX document before the `localize` string-freeze**, so one image serves all three locales; the separate `illustrated` state is a belt-and-braces sweep that makes zero Prism calls on the happy path. Games always land as `status='review'` — `upsertGame()` takes no status argument at all, so no code path can write `published`; a human promotes them from the `/admin/content` Games queue (§1.9, non-negotiable for kids' content), and a regenerated game that was already published is downgraded back to `review` on purpose.

### Run lifecycle

```
pending → planned → authored → simulated → judged → localized → illustrated → published
                                                        ↘ failed (failedFrom recorded; retried stage-aware)
                                                        ↘ dry-run (pristine pending slots only)
run id namespace:  games-<courseSlug>-<ISO8601>
telemetry marker:  generation_runs.params.kind = 'games'   ← see the wiring gap note below
```

File-checkpointed at `runs/<run-id>/checkpoint.json` (gitignored) with a per-slot state machine; re-running the same course/slots **resumes** (each stage no-ops once its slot has reached or passed that state; only `published` is terminal). A resume whose flags disagree with the checkpoint's recorded `params` is **refused** while any slot is already published, because `isSlotDone` would otherwise treat work produced under different parameters as finished.

Retries are **stage-aware**: a failure from `judged`/`localized`/`illustrated` resumes at the failed stage (the judge-approved manifest is sitting in the checkpoint), while a failure from `pending`/`planned`/`authored`/`simulated` resets the slot and regenerates from scratch, because a fresh draw converges better than revising a bad one. The last outer attempt (`ARCADE_SLOT_ATTEMPTS`) always forces a fresh draw. A `kid_safety` escalation is **terminal** and is never retried.

A per-run cost/token ledger is appended to `runs/<run-id>/ledger.jsonl` and judge rubrics to `runs/<run-id>/rubrics.jsonl`. The run's caps are scaled to the enumerated work (`max(absolute, slots × per-slot)`), then **hydrated from that ledger**, so the ceilings hold across the resumes a long run needs rather than restarting at zero every process.

> **Telemetry wiring gap (2026-07-30).** `pipeline/liveTelemetry.ts` and `vault/telemetry.ts` are implemented but not yet imported by `run.ts`, so an Arcade run currently writes **nothing** to `generation_runs` / `generation_slots` / `generation_runs_live`. `/admin/generation` is already kind-aware and filters by `params.kind`, so it will simply show no game runs until the wiring lands. Tracked in [AGENTS.md → Known gaps](AGENTS.md#known-gaps--verified-2026-07-30-against-the-code-on-this-branch).

`--dry-run` validates the catalog and the slot enumeration and stops **before every paid stage**: zero LLM/image calls, no API keys required, and slots holding in-progress checkpoint data are left untouched.

## Env vars

Read out of `src/env.ts`. `.env.example` carries the same set with placeholder values. **Every field is optional or defaulted on purpose** — `Env.parse({})` must succeed, because `/health` has to answer with zero credentials (§1.14), `--dry-run` has to run keyless, and `catalog:check` / `contract:check` / vitest never touch a paid API. The lazy `requireGenerationKeys()` / `requireIllustrationKeys()` / `requirePublishKeys()` gates are what actually refuse, called right before money is spent — never at import time.

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4003` | §1.5 LOCKED port |
| `INTERNAL_API_KEY` | — | ≥16 chars. Validates the inbound `x-internal-api-key` on `/api/v1`. Optional, and the guard **fails closed** when unset. |
| `DEEPSEEK_API_KEY` | — | `plan` + `author` + `localize`. Required only by a non-dry `npm run generate`. |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | Mirrors coursegen |
| `DEEPSEEK_MODEL` | `deepseek-v4-pro` | The author/localize model. A **reasoning** model spends its completion budget thinking, so size `maxTokens` by reasoning + answer, never by the length of the answer. |
| `QWEN_API_KEY` | — | The judge. Required only by a non-dry `npm run generate`. |
| `QWEN_BASE_URL` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | Mirrors coursegen |
| `QWEN_JUDGE_MODEL` | `qwen3-max` | Deliberately a decorrelated provider from the author |
| `PICTUREGEN_URL` | unset | Prism (4007), the ONLY image path. **Unset is a REFUSAL, not a skip**: `runGeneration` calls `requireIllustrationKeys()` up front unless `--no-images`, because an art-less manifest is a different (worse) product, not the same one minus a nicety. (`images.ts` still degrades to a reported `not-configured` skip if it is ever called directly.) |
| `PICTUREGEN_INTERNAL_KEY` | — | ≥16 chars, sent to Prism as `x-internal-api-key`. Prism owns the Depot upload, so Arcade needs no `FILEBASE_*`. |
| `SUPABASE_URL` | — | Vault, for `publish` (and, once wired, telemetry) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service role — bypasses RLS on purpose; `game_documents` has RLS enabled with **zero policies**, so the service role is its only reader |
| `ARCADE_MAX_TOKENS_PER_RUN` | `5000000` | Token kill switch. Effective cap = `max(this, slots × ARCADE_MAX_TOKENS_PER_SLOT)`, printed at startup. |
| `ARCADE_MAX_USD_PER_RUN` | `50` | USD kill switch, scaled the same way; `--budget-usd` may only lower it. |
| `ARCADE_MAX_TOKENS_PER_SLOT` | `150000` | Per-slot allowance the run caps scale with |
| `ARCADE_MAX_USD_PER_SLOT` | `0.25` | Same, in USD. **Not yet validated against a real run** — re-check both against the first ledger. |
| `ARCADE_CONCURRENCY` | `2` | Slot workers, 1..8. Also the pipeline's in-flight Prism call ceiling, which is why `generate:full` sets it. |
| `ARCADE_SLOT_ATTEMPTS` | `3` | Outer per-slot attempts, 1..5. On judge rejection or author exhaustion the slot regenerates from scratch. |
| `ARCADE_CHAT_TIMEOUT_MS` | `120000` | A fetch with no timeout parks a pool worker forever; with `ARCADE_CONCURRENCY` workers a long run can lose them all and hang. |
| `ARCADE_PICTUREGEN_TIMEOUT_MS` | `180000` | Prism generates images — slow by nature |
| `ARCADE_VAULT_TIMEOUT_MS` | `30000` | Vault writes are fast |
| `COST_DEEPSEEK_INPUT_PER_1K` | `0.000435` | Cost-table override. Defaults verified against the official price pages 2026-07-25. |
| `COST_DEEPSEEK_INPUT_CACHED_PER_1K` | `0.0000036` | The rate for prompt tokens served by DeepSeek's automatic prefix cache (`prompt_cache_hit_tokens`) — ~120× cheaper. Without a separate cached rate the ledger overstates real spend. |
| `COST_DEEPSEEK_OUTPUT_PER_1K` | `0.00087` | |
| `COST_QWEN_INPUT_PER_1K` | `0.0016` | |
| `COST_QWEN_INPUT_CACHED_PER_1K` | `0.00032` | DashScope bills implicit cache hits at 20% of input (`prompt_tokens_details.cached_tokens`) |
| `COST_QWEN_OUTPUT_PER_1K` | `0.0064` | |
| `COST_QWEN_IMAGE_PER_IMAGE` | `0.035` | Per image actually GENERATED — a Prism cache hit costs nothing and is billed nowhere. Image spend used to sit entirely outside Forge's ledger and outside every kill switch. |

There is **no `BACKEND_INTERNAL_URL`**: Arcade never calls Core. It talks to Prism and to Vault, and that is all.

A budget cap that cannot fit the job is a bug, not a guard — Forge's 5M-token default killed a 1312-lesson course at lesson ~82, which is why the effective cap here scales with the slot count and is printed at startup.

## Curriculum catalogs

`curriculum/<course>/games.yaml` is human-authored content design (format documented in [`curriculum/README.md`](curriculum/README.md)). One catalog exists today: **`first-lemonade-stand`**, the non-shipping QA catalog twinned with Forge's QA course — 18 blueprints across 9 topics, ≥2 per mechanic across all 8, tiers 1–3 and difficulties 1–5 spread on purpose so one run exercises every simulator, every gate and every per-mechanic schema. Its 7 tier-disagreement warnings are intentional design decisions, not defects. No production course has a game catalog yet.

## Operator workflow

1. **Author the catalog.** `curriculum/<course>/games.yaml` — human content design, one blueprint per game (`topic_path` + mechanic + intent). Never generated, never machine-patched.
2. **`npm run catalog:check`** — free. Proves every blueprint is well-formed and every `topic_path` exists in Forge's catalog **before** a single paid call.
3. **`npm run contract:check`** — free. Proves `src/contract/**` still matches `frontend/src/game-engine`. A stale copy does not fail loudly; Zod silently strips the fields it does not know about.
4. **`npm run generate -- --course <slug> --dry-run`** — free, keyless, non-destructive. Confirms the slot enumeration is what you meant.
5. **`npm run generate -- --course <slug>`** — the paid run. A human triggers it, in session, with the budget caps set (`agent/core/BOUNDARIES.md` #8). Read the run summary: every enumerated slot lands in exactly one bucket (published / failed / escalated / already-done / dry-run / skipped / not-attempted), plus images placed vs billed vs inherited, tokens, USD, cache-hit share and cost per published game.
6. **Review and publish.** Games land `status='review'`. A human promotes them from `/admin/content` → Games, where a reviewer can PLAY the game before approving it. This gate is not optional and is not automatable.

Whole-catalog Forge + Arcade runs go through the root `npm run generate:full` (`scripts/generate-full.mjs`), which launches the Forge track run and the Arcade run concurrently with linked ids and a combined summary, splitting one illustration-lane budget between them (`--lanes 3` → Forge 2, Arcade 1) because the DashScope image quota is **shared** with Prism's other caller. A paid `generate:full` requires an explicit `--confirm`.

## Cost warning

`npm run generate` calls paid APIs (DeepSeek plan/author/localize, Qwen judge, Prism/DashScope images). Illustration is the dominant cost, which is why `illustrate` runs before the string-freeze (one image, three locales) and why Prism is cache-first (an identical request never hits the paid image API twice). Every paid call passes `checkBudget()` first and lands in the ledger — spend that is not in the ledger is invisible to every guard.

**No paid Arcade run has been executed to date.** Every cost figure in this file is a price-table default, not a measurement.
