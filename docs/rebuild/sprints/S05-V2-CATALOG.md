# S05 — the v2 catalog (OD-24), authored agentically

Checkpoint of 4 October 2026. Branch `feat/fe-pilot-v2`. Status: **code released to production; catalog data not yet published; not accepted.** Staff release, native-language review and the owner's acceptance remain open.

## What this block did

1. **Pilot, two rounds.** Eight Educación Financiera lessons were authored by Claude Code in agentic mode (no Forge model call, zero spend), reviewed three ways and improved once. Method and numbers: [FORGE-V2-PILOT-ROUNDS](../../content/FORGE-V2-PILOT-ROUNDS.md).
2. **Tooling for a whole catalog.** The writing skills (`v2:brief`), the lesson-design gate (gate 14: examples-first arc), the catalog coverage check (`v2:catalog`), the hierarchy generator (`v2:hierarchy --course`), the segment-type lister (`v2:brief --types`, which asks Core's own age scopes through `backend/scripts/v2-open-types.ts`) and `v2:publish --lesson-ids`. Runbook: [FORGE-V2-RELEASE](../../content/FORGE-V2-RELEASE.md#3-the-whole-catalog-od-24).
3. **Market money on the Horizonte boards.** The coin-stack, market-stall and fin1 boards printed a generic "$" or "mm"; they now print the learner's market currency (frontend change; Core behaviour unchanged, the two backend edits are comments).
4. **The catalog.** 144 lesson plans, three markets each (432 documents): financial education 56 lessons in 14 chapters, entrepreneurship 44 in 11, investing 28 in 7 (no 6-9 pathway, by design), First Lemonade Stand 16 in 4; four age pathways (6-9, 10-12, 13-17, adult) with the 8 pilot lessons frozen. Plans live in `coursegen/curriculum-v2/<course>/plans/`, structures in `structure.yaml`, hierarchy rows and a reviewable seed (ending in `ROLLBACK`) in `hierarchy/`.

## How it was authored

One structure file per course decided each lesson's concepts, knowledge components, age, Mentor, situation and segment mix. One author agent wrote each chapter against the shared brief (the writing skills, the engine limits, the pilot plans as the quality bar) and gated its own plans. A second, independent reviewer agent then recomputed every number and answer key per market and read each lesson for pedagogy, register, regional truth and safety, fixing in place and re-gating. The coordinator then ran a catalog-wide sweep (es-MX "Halla" to "Encuentra", en-US "Let us" to "Let's", one gendered pt-BR form) and the whole-catalog checks.

## Verification (local, zero spend)

- `v2:catalog` over the four courses: 144 lessons, 100 of 100 knowledge components covered (gate G3), 0 errors.
- `v2:emit --require-lesson-design` over all 144 plans: clean (gates 11-16, 19). Core's strict contract and interactive-behaviour check over 432 documents: pass; 2,364 of 2,364 graded segments solvable.
- `v2:hierarchy --course <slug>` per course and `v2:publish --dry-run` per course (with `--lesson-ids`, `--core-has-horizonte`): clean.
- Push-gate results are in "Push gate" below.

## Push gate (once, on the final tree)

Run once on the final tree, in the background, with no agent fleet live.

- Green: `typecheck:all`, `lint:all`, `secrets:check`, `tools:test` (676 of 676), `spec:check` (after regenerating the Horizonte generated copies, see below), `i18n:check`, `narration:check`, `forge:release-gates:check`, `forge:v2:dry-run`, the v2 lesson-capability parity gate, `kc:map`, `content:gates` (the CI form, no blocking finding), builds of backend, coursegen and frontend.
- `test:all`: audiogen 188, backend 5,135, database, dataintel 259, email-server 36, filebase 50, frontend 4,248, picturegen 103 all green. Two findings, both resolved: (1) coursegen `v2Hierarchy.test.ts` read the pilot's `plans/` folder, which now holds the whole catalog; the test now copies only the eight frozen pilot plans, and passes (32 of 32, type-check and lint clean). (2) Oracle `hardening.test.ts` and `live-session.test.ts` hit their 10 s `beforeAll` timeout while the machine was saturated by the frontend suite; run alone on a quiet machine both pass (88 of 88). Oracle is untouched by this block.
- Rebuilt-UI audits (text fit, proportion, copy budget, board rules) on the 16 states that render the changed boards (fin1 and the Horizonte space1 coin-stack and market-stall fixtures) in 3 locales, 2 themes and every width: no issue, no JS or media error. This is a trimmed run; the full 12-shard audit is the frontend CI deploy gate and runs on the push.
- `spec:check` failed once on drift: the backend comment edit in `coins.ts` and `stall.ts` changes the generated frontend copies. `node agent/tools/sync-v2-horizonte.mjs` regenerated them (comment-only change) and the check passes.
- Pre-existing and unrelated: `npm run content:gates -- --course <slug>` fails for all four courses on the legacy v1 curriculum YAML (it lacks `regional_scenarios`). CI runs the form without `--course`, which passes.

## Release evidence

- PR #127 merged to `main` as `083df604` (230 files). Main CI: frontend (12 audit shards), backend, coursegen and repo gates green.
- CD: backend CD and coursegen CD succeeded; frontend CD succeeded and the Vercel production deployment of `083df604` is READY. No migrations in this release.
- Not done: knowledge-component seed (`seed:kc`), hierarchy seed per course, `v2:publish` for four courses and three markets, draft knowledge-component activation, `COURSE_PATHWAY_ENGINE=pathway`. Each needs the production Vault URL and service-role key, or superuser database access; this session could not use them. Until they run, the Vault holds none of the new lessons and learners see nothing new. Runbook order is in [FORGE-V2-RELEASE](../../content/FORGE-V2-RELEASE.md#3-the-whole-catalog-od-24).

## Judgement calls (defaults taken, owner can redirect)

- OD-22 (draft knowledge components and misconceptions): the owner's "I approve the changes" was read as accepting the proposal in `kc-misconceptions.proposal.yaml`. Activating the KCs changes Mentor planning, whose BKT defaults are uncalibrated; the change is a data step, not part of this code push.
- The per-service commit gate was skipped in favour of one push gate on the final tree (CLAUDE.md rule 3).
- `structure.yaml` drifted from the plans in a few numbers (lem-1317-03 break-even, lem-adult-04 hours, ent-adult-01..04 amounts, fe-1317-08 amounts, fe-1317-11 saving rate, inv-1317-12 horizon, ent-1012-11 stall payload). The plan is authoritative; the structure files were not rewritten.
- Left as is: Liruf's masculine "Obrigado" (the pilot uses it; the character's gender is undecided), es-MX legal "tutor" and the tutoring side-gig wording, pt-BR "bancada" and "oficina".
- Three reviewer-flagged cross-chapter points took defaults: resale apps stay in fe-1317-07 (13-17), the "Insumos" label and scale of fe-1317-02 and -03 stay as authored, and the phone-case cost differs between ent-1317-05 (14) and -06 (12) because they are separate scenarios.
- Cross-chapter patterns judged non-blocking because the reviewers fixed the per-lesson instances: some `not_yet` lines that point close to the answer, guided and practice steps that reuse the example's numbers, slider cues, pt-BR "Etapa" against "Passo", "data cap".

## Limits and what is not claimed

- No native es-MX or pt-BR reader has seen the copy; no real learner has used it. The 12 lesson-level gate-16 acknowledgements stay until a native reader signs them. es-MX "despensa" and Mexican wage realism need a native check; two pt-BR hypotheses (br-installment-culture, br-instant-payments) are unvalidated.
- Engine limits that shaped the content: boards print the market currency but the copy still says "coins" in universal plans; goal-bullet and allocation boards accept any value at or above a minimum; some payloads (coin, stall) are shared across markets; slider boards need an explicit cue in the prompt; the donut chart shows no numbers until a table; Core does not recompute chart answers. Details: pilot rounds, "Engine limits".
- The pilot `subtract-money` prerequisite warning is a known property of the frozen pilot lessons.
- First Lemonade Stand has live v1 content: its v2 adventures append after it, so that course is mixed v1 and v2 until the v1 lessons are retired.
- A published lesson stays invisible to learners until staff release it (`release_lesson`, Content page). Nothing here bypasses that gate.

## Owner items

Native es-MX and pt-BR read; sign the gate-16 acknowledgements; confirm OD-22 activation; staff release of the lessons per course; flip the entrepreneurship and investing course statuses; decide the engine-limit backlog.
