# AGENTS.md — gamegen (Arcade)

> Domain rules for this service. Root rules: [/AGENTS.md](../AGENTS.md). Context: [agent/core/CONTEXT.md](../agent/core/CONTEXT.md).
> **Engine spec (authoritative for the pipeline and for what Arcade generates):** [/GAME_ENGINE.md](../GAME_ENGINE.md) — §9 is this pipeline, §3–§5 are the contract it must satisfy.

## Mission

Generates concept-bound educational minigames for `games/` using **DeepSeek (author) + Qwen (judge) + Prism (art)**. Two things live in this package:

1. An Express `/health` service (internal, reachable only with `INTERNAL_API_KEY` — currently just the health envelope; not yet called service-to-service by anything).
2. **Arcade**, a CLI pipeline (`npm run generate`) that turns a curated game catalog into `GameDocument`s in Vault. Arcade is **operator-triggered only** — never run by CI or any automatic process (`/AGENTS.md` sign-off rule, `agent/core/BOUNDARIES.md` #8: calling paid AI APIs in bulk and publishing are both boundary actions).

**Implementation status (read this before believing anything below is code).** As of 2026-07-30 `gamegen/src` is a bare scaffold: `app.ts` (health envelope + `NOT_FOUND` catch-all) and `index.ts` (raw `process.env.PORT` read). Every pipeline rule in this file is a **requirement on the implementation landing on `feat/game-engine`**, not an observation of existing code. When a stage lands, its rule here stops being a requirement and starts being a description — do not blur the two.

## Approach decision — RESOLVED 2026-07-30

**DECIDED: parameterized prebuilt mechanics + LLM-generated JSON manifests.** Eight hand-written, deterministic game mechanics (code) are skinned and parameterized per instance by a generated `GameDocument` (data). Human sign-off given by the owner 2026-07-30; the decision is recorded in `ROADMAP.md` and specified in `/GAME_ENGINE.md` §1.

**REJECTED: fully generated HTML5 sandboxed games.** Three independent reasons, each disqualifying on its own:

1. **Unreviewable code surface aimed at children (§1.9).** Generated *content* can be moderated; a generated *program* cannot. Kid-facing output must pass moderation before display and a human publish gate — a novel program per instance means the thing a child executes was reviewed by nobody. "Sandboxed" is a containment claim, not a safety claim.
2. **No shared quality bar.** N generated engines means N feel-and-fairness implementations, N accessibility postures, N responsive behaviours (§1.11), N motion policies. With 8 hand-written mechanics there is exactly one of each, and improving `runner` improves every `runner` game ever generated, retroactively.
3. **Incompatible with the deterministic gate/judge pattern that made Forge work.** Generated code cannot be replayed server-side (so it cannot derive a reward — see the rewards invariant below), cannot be bot-tested for winnability before publish, and cannot be gated cheap-first before the paid judge. It would leave the client-reported score as the only reward signal — the exact thing this file forbids.

Extending the closed mechanic set is `/GAME_ENGINE.md` §12, not a re-litigation of this decision.

## Invariants that bite here

- **Every game binds to a learn/ concept — orphan games do not exist, and the link is DATA, not convention.** The blueprint carries `topic_path`; `validate` cross-checks it against `coursegen/curriculum/<course>/catalog.yaml`; publish stores the resolved `games.topic_id` FK. A game whose topic cannot be resolved must fail the run, never publish "unbound".
- **Rewards are SERVER-DERIVED BY REPLAY. A client-reported score is a claim, never a grant.** The client submits `{ seed, input_log }`; Core re-runs the mechanic's simulator over that log and derives the score itself (`/GAME_ENGINE.md` §6). The weaker posture — "the backend validates that the reported score is plausible" — was **rejected**: plausibility only rejects absurd numbers, so a *plausible fabricated* score would have been granted, and the bound it checks against is exactly the bound an attacker reads off the client. Replay has no such gap: an input log either reproduces the score or it is a `422 RESULT_REJECTED`. This is why every simulator must be pure and deterministic (§5) and why `gamegen/src/contract/` exists at all — **a mechanic the server cannot replay can never grant XP.**
- **Sandboxed output: the manifest never carries executable code and never names an external host.** Sprites/backgrounds are Depot URLs produced by Prism; SFX/BGM are ids from the closed vocabularies. No `<script>`, no data-URI payloads, no third-party CDN. Under the decided approach this is enforceable by Zod, which is half the point of the decision.
- **All AI-generated text and art shown to kids passes moderation (§1.9) — non-optional, three layers:** deterministic gates (forbidden-vocabulary per age tier × locale is a HARD fail), then the judge's `kid_safety` floor, then the blocking human publish gate. Arcade publishes `status='review'` and **never auto-publishes**.
- **Generated content ships in 3 locales** (es-MX authoring locale, then en-US + pt-BR from `localize`), and every chrome string the engine renders is an i18n key in all three (`/AGENTS.md` §1.8). Never a silent es-MX-only game.
- **No minor PII in any prompt.** Prompts carry the blueprint, catalog concept context, the age TIER and the character canon — nothing else. There is no per-child generation path; adding one needs explicit human sign-off against §1.9.
- **All AI output is Zod-validated against the copied `/GAME_ENGINE.md` contract before it is trusted for anything.** Never persist unvalidated model output; never relax a schema to make a generation pass (§1.14).

## Pipeline shape (spec: `/GAME_ENGINE.md` §9)

```
stages:            validate → plan → author → gate → simulate → judge → localize → illustrate → publish
checkpoint states: pending → planned → authored → simulated → judged → localized → illustrated → published
                   (+ 'failed' with failedFrom, + 'dry-run' for pristine slots only)
live stage labels: planning, authoring, simulating, judging, localizing, illustrating, publishing
run id namespace:  games-<courseSlug>-<ISO8601>     // NEVER collides with Forge run ids
telemetry marker:  generation_runs.params.kind = 'games'
```

Nine stages, **eight** checkpoint states: `gate` owns no state of its own because it is expected to run INSIDE the author stage's corrective-retry loop, the way Forge's gates run inside `write.ts` via `WriteInput.gateCtx` — so a gate failure is actionable feedback to the next attempt, not a dead slot. Write every gate message so a model can act on it: name the field, the expected value, the observed value.

- **Paid stages: `plan`, `author`, `judge`, `localize`, `illustrate`.** `validate`, `gate`, `simulate` and `publish` cost nothing. Keep the free stages cheap-first and ordered before the paid judge — letting cheap garbage reach a paid call is the mistake Forge's two-phase gate/judge split already paid for.
- **`--dry-run` must spend NOTHING, structurally.** The short-circuit sits BEFORE all five paid stages, `runGeneration` skips the key check for dry runs, and a **keyless dry-run test** is the regression pin. Only PRISTINE `pending` slots get the `dry-run` marker; a slot carrying in-progress checkpoint data is left untouched, because marking it would wipe paid, judge-approved work. (Forge's dry-run once only skipped publish — it paid the full generation bill while reporting that nothing was paid for. Do not rebuild that.)
- **The budget kill switch only exists if it PROPAGATES.** `checkBudget()` runs before every paid call and throws `BudgetExceededError`; `run.ts` then stops scheduling new slots (published slots stay published, the rest stay resumable). A per-item `catch` inside a stage MUST rethrow `BudgetExceededError` (and `ProviderNotConfiguredError`) instead of degrading it to "skip this one". Forge's `illustrateSegments` swallowed it per target: a run that had already hit its USD cap kept walking every remaining image, paid for each, and shipped lessons with silently missing art while the cap read as enforced. Arcade's `illustrate` loops over sprite slots — the identical shape, so the identical trap.
- **Every cost goes through the JSONL `UsageLedger`, or it is invisible to every guard.** Image spend sat outside Forge's ledger for months and was its largest uncapped cost.
- **`simulate` is the bot-play winnability gate — free, deterministic, and the reason a generated game is trustworthy.** Run the mechanic's simulator headless (the parity copy in `gamegen/src/contract/`) against the authored document: the **`perfect` bot MUST reach `scoring.pass_score`** (otherwise a child would fail content that is broken, not hard), the **`random` bot MUST NOT** (otherwise mashing is a complete strategy and the XP is free), and the tick budget must hold. On failure the bot trace is corrective feedback for the next author attempt. No LLM is involved; it runs BEFORE the paid judge.
- **`illustrate` runs on the es-MX document BEFORE the `localize` string-freeze.** Sprite URLs, `palette`, `background_url`, `sfx` and `bgm` then copy verbatim into en-US and pt-BR: **one image serves three locales**, a 3× cut in the dominant cost of mass generation. This is the ordering `coursegen/src/pipeline/run.ts` really uses inside its `reviewed → localized` transition; the stage list keeps Forge's stage NAMES for CLI/telemetry parity.
- **The `NON_VISIBLE_KEYS` twin must skip CONTAINER keys, not just named leaves.** Consequence of the ordering above: `localize` must not translate `sprites`, `background_url`, `palette`, `sfx`, `bgm`, `config`, `mechanic`, `topic_path`, `image_slot`, `icon` or any id. This is a **different shape** from coursegen's field-name list, because sprite slots are arbitrary `Record<string, string>` keys — you cannot enumerate the leaves, you must skip the whole container. A schema-derived coverage test (twin of `coursegen/src/__tests__/nonVisibleKeys.test.ts`) proves both halves: no visible string escapes translation, and no non-visible key is translated. When it fails, add the key — never weaken the test. Forge learned this when a `mode: "typed"` enum came back as pt-BR prose and broke the contract.
- **Prefix-cache discipline: static-first assembly, retries APPEND.** DeepSeek's context cache is automatic and prefix-based (identical LEADING tokens bill ~120× cheaper on v4-pro; DashScope bills implicit hits at 20% of input). So every prompt puts byte-stable material first (playbook, hard rules, closed sets, mechanic shape, judge rubric-in-system) and per-game material last, never splices a conditional into a numbered list (renumbering changes every following byte), and corrective retries append feedback AFTER the original messages so attempts 2..N re-send an identical leading prompt. Read `cached_prompt_tokens` back from the ledger — a prompt change that tanks the cache-hit share is a cost regression even when quality holds.
- **`gamePlaybook.ts` is ONE module injected into BOTH the author and the judge prompt** (twin of `coursegen/src/pipeline/contentPlaybook.ts`). The schema and gates enforce CORRECTNESS; the playbook enforces VALUE. Injecting it in only one place means the author aims at a different bar than the judge rejects against — which is how you get mechanically-valid, boring content.
- **Judge rubric dimensions are `concept_fit, fun_agency, clarity, kid_safety, difficulty_fairness`** (1–5 + notes), on Qwen — a deliberately decorrelated provider from the DeepSeek author. `kid_safety` is a hard floor, not an average input.
- **`checkpoint.ts` is shared by concurrent slot workers**: serialize its writes through an internal queue, never `writeFile`/`rename` the checkpoint path directly, and never "simplify" the queue away (Forge's pre-queue version crashed with tmp-file `ENOENT` races at concurrency 2).
- **Operator scripts must load `.env` explicitly** (`tsx --env-file-if-exists=.env …`). Forge's `generate` and Echo's `narrate:all` both crashed on their very first real invocation for exactly this. Any new script that reaches `getConfig()` needs the flag.

## Contract-copy parity rule (no workspaces)

`gamegen/src/contract/**` is a **copy** of `frontend/src/game-engine`'s pure simulation code (the `core/types.ts` subset, `rng.ts`, `mathd.ts`, `replay.ts`, and every `mechanics/*/simulate.ts` + `schema.ts`), not a re-export — this repo has no workspaces (`/AGENTS.md` §1.2). Adjust **only** the relative import paths when re-copying: the frontend uses bundler-style imports with no extension, this package is `NodeNext` and every relative import needs an explicit `.js`. Keep `simulate.ts` and `schema.ts` free of any React import precisely so the copy is possible.

`npm run contract:check` is the gate. Run it after ANY change to `frontend/src/game-engine/**/{schema,simulate}.ts`, **in the same commit**.

> **RUN THE RIGHT ONE.** `backend/` has its own `contract:check` for `backend/src/game-contract/`. Running that one and seeing "OK" says NOTHING about gamegen's copies — the mistake made on 2026-07-25 with the lesson contract, which let real drift sit unnoticed for a whole session. Both matter.
>
> **WHY DRIFT IS SILENT AND EXPENSIVE.** Zod objects STRIP unknown keys by default. When the frontend contract gains a field the copy lacks, the author dutifully emits it, the gate validates the document, and the field is DELETED — no error, no warning, nothing in the logs. On the lesson contract that shipped `count_objects` lessons as bare icons with zero pictures in all three locales. On a game manifest the same drift silently strips a `config` field the simulator needs, which the winnability gate then reports as an unwinnable game — you will debug the bot, not the copy.

## Curriculum catalog authoring

`gamegen/curriculum/<course>/games.yaml` is **human-reviewed content design**, authored separately from this pipeline code. This package only defines/validates its Zod schema and cross-validates it (`npm run catalog:check`): slug uniqueness, closed-set membership (mechanic, tier, palette), and **every blueprint's `topic_path` exists in `coursegen/curriculum/<course>/catalog.yaml`** — read from the repo root; the prior art for reaching across packages is `coursegen/src/contract/check.ts`.

`gamegen-ci.yml` path filters must therefore include `coursegen/curriculum/**`, and `catalog:check` + `contract:check` must be wired into `npm test`. A manual-only check is a silent gap: a Forge catalog rename would break the binding with nothing failing.

Never hand-edit curriculum YAML from this package's code — a `catalog:check` content finding is something to report to whoever authors that file, not to patch programmatically.

## Read before touching

- `/GAME_ENGINE.md` — the authoritative spec: §3 the `GameDocument` contract, §4 the 8-mechanic taxonomy, §5 determinism/replay, §6 rewards, §9 this pipeline, §12 the extension protocol for mechanic #9.
- `/COURSE_ENGINE.md` — Forge's pipeline spec; Arcade's stages, checkpointing, providers and telemetry are modeled on it, and the course hierarchy is what game blueprints bind into.
- `/LESSON_ENGINE.md` — the lesson runtime a game consolidates (§7 hearts/cheer is the failure posture games mirror; a game never teaches a concept cold).
- `coursegen/AGENTS.md` — the sibling generation service whose hard-won rules this service inherits verbatim: budget propagation, stage-aware retries, ledger hydration, dry-run structure, prefix cache, `NON_VISIBLE_KEYS`, contract-copy parity, mass-run survivability.
- `picturegen/AGENTS.md` — how to ask Prism for art, and why its HTTP status is a retry instruction (a 4xx from Prism is TERMINAL; retrying it re-pays a generation that can never differ).
- `agent/core/CONVENTIONS.md` — app layout, envelope, test shape.
- `agent/prompts/templates/new-minigame.md` — predates the approach decision and is kept for its reward/moderation/i18n acceptance checklist. For **adding a mechanic**, `/GAME_ENGINE.md` §12 supersedes it.
