# S07: Family Hub and independent teen wallet

Status: in progress. Started 24 September 2026. Owner: Engineering for implementation; Product, Safety/Trust and the Block D Engineering Lead (Appendix H Stage 0 pairing) for the reviews named by the SPEC. No release approval is recorded.

## Binding acceptance sources

- Product D.1–D.23 and the Block D "Real-World Money Practice Standard" (non-negotiable constraints: no control shown as active unless enforced; no lifecycle state without a producing and consuming flow; no chore, redemption or banking-account state reachable through a path that bypasses parent-driven business rules).
- Appendix G (research framework) and Appendix H (metrics, Definition of Done, Stage 2 adversarial bypass testing, phasing: D.1/D.4 are Phase 0, D.5 is Phase 1).
- Owner decision log: OD-3 Option B (§7, independent teen wallet), OD-21 (every declared Family Hub lifecycle state gets a working flow; build, not remove), OD-23 (zero paid spend), §5 glossary ("Tutor" is only the verified parent; coins, never money).
- Frontend Bible 02 §1–2 and 06 for every rebuilt surface.

Risk classification: **structural/safety (money-adjacent state and family trust)**. Every change is subject to Appendix H Stage 2: an adversarial test must show the control restricts behavior through every path (UI, direct API, data gateway), not only that it displays correctly.

## Point-by-point checkpoints

| ID | Scope | Product acceptance | Frontend acceptance | State |
|---|---|---|---|---|
| S07.1a | D.4 data-layer writes cannot bypass the state machine | Browser roles hold no write path to tasks, goals, redemptions, catalog, ledger, guardian links or freeze fields; triggers enforce legal transitions for every writer including the service role (photo before approval, debit before a redemption is approved, reached only when savings cover the target, a child never lifts a guardian freeze); every accepted transition is recorded with its request role; Appendix H's Unauthorized State-Transition Rate is served to analytics staff | No surface change (enforcement boundary) | In progress: implementation and local verification recorded (native PostgreSQL over the actual migration chain, Core adversarial tests); full Supabase stack run, production metric and human review pending |
| S07.1b | D.5 / OD-21 lifecycle states | Redemption `fulfilled`, ledger `manual_adjustment` and `goal_withdrawal` (guardian-only, audited, required reason) and guardian-link `pending`, `rejected`, `revoked` each have a producing and a consuming flow; a gate refuses any Block D state without both | Rebuilt Tutors, coin-correction and child-history surfaces in three locales, light/dark, 375/1280 px | In progress: implementation and local verification recorded (PostgreSQL, Core, component and 12 real-Chrome journeys); full-stack run, copy/human review and Product acceptance pending |

## Current state found (verified against the code, 24 September 2026)

The SPEC's "Current State" was accurate on D.4 and D.5 with one exception:

- **D.4 confirmed and reproduced.** Migration 0074's policies let the child or any verified guardian `UPDATE` any task column (`tasks_update_party`), a guardian `INSERT` tasks, the child insert/update savings goals, a child insert redemptions with any status (`redemptions_insert_own`) and a guardian update a redemption's status (`redemptions_update_guardian`). On the actual migration chain a kid browser session approved its own chore and inserted an already-`approved` redemption with no debit (first check in the PostgreSQL report). Wallet ledger entries were already service-only, and S02 (0093) had already made the freeze fields service-only; the child-cannot-lift-a-guardian-freeze rule lived only in Core's PATCH filter.
- **D.5 confirmed.** No code produced redemption `fulfilled` (the legacy parent board only had a label), ledger reasons `goal_withdrawal`/`manual_adjustment` (allowed since 0081), or guardian-link `pending`/`rejected`/`revoked`: S04.1's second-guardian acceptance (0110) writes a `verified` link directly.
- **Stale in the SPEC:** "the `task_view` analytics event has no emitter" is no longer true; `KidTaskBoard` emits it once per mount since H.3 (S09).

## S07.1a implementation and rationale (D.4)

Migrations (descriptive names; the orchestrator assigns the final numbers at merge): `family_hub_state_machine` (schema, lockdown, helpers), `family_hub_transition_guards`, `family_hub_wallet_integrity`, `family_hub_guardian_link_lifecycle`, `family_hub_lifecycle_flows`. They are split in five because the operator transport sends each migration as one base64 argument, and a single 55 KB file exceeded the Windows command-line limit in `railway-migrate.test.mjs` (a real constraint on an operator running from Windows, not only a test artifact).

1. **Lockdown.** Every client write policy on tasks, savings goals, redemptions and the reward catalog is dropped, and `INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` are revoked from `anon`/`authenticated` on every Family Hub table (ledger, pending credits, allowance/bonus/limit rules, streaks, guardian links, the new tables). The account holder keeps 0093's nickname/card-design column grant. Reads are unchanged, except that `tasks_select_party` no longer lets a guardian who stepped away read the chores they once assigned.
2. **State machines enforced for every writer.** BEFORE triggers (SECURITY DEFINER, `search_path=''`) enforce: task `open→done→approved|cancelled` with the photo rule, a verified-guardian `decided_by`, immutable reward/assignee fields, evidence locked after a decision, and `allocated` only false→true on an approved task; goal `active→reached` only when tagged savings cover the target, `active|reached→archived`, immutable target; redemption inserts only as `requested` for an active reward owned by one of the child's verified guardians and within the rolling spend limit, `requested→approved` only with its debit written, `approved→fulfilled` only by a verified guardian; reward cost 1–500 and fixed ownership; the ledger is append-only (only `ON DELETE SET NULL` cascades may touch it), every row's shape matches its reason, and no debit may overdraw a bucket, a goal or the savings reserved for goals; banking accounts cannot be re-owned, a freeze actor must be the child or a verified guardian, and a child can neither lift nor re-own a freeze someone else placed. Core now records `decided_by/decided_at` on approval and cancellation so the database can re-check the actor.
3. **Measured.** `family_state_audit` records every accepted chore/goal/redemption/guardian-link/freeze transition with the request's JWT role and the database role (invoker-rights trigger). `family_state_integrity(since)` counts transitions per table and those outside the service role (target: zero). Core serves it at `GET /api/v1/admin/family/state-integrity?days=N` behind the `view_analytics` grant.

Deployment ordering: all five are declared `contract` (they narrow what even the service role may write, and they change what a second-guardian acceptance produces). They must ship with, never ahead of, the Core release carrying the S07.1 routes. `database/types/database.ts` was not hand-edited; regenerating it is an integration step.

## S07.1b implementation and rationale (D.5 / OD-21)

Producing flows (database functions, service-role only, each serialized on the child's wallet or guardian-link advisory lock and audited in the same transaction):

- **Manual adjustment** — `guardian_adjust_wallet(kid, actor, bucket, signed amount, reason)`: verified guardian only, 1–1000 coins, a trimmed 1–240 character reason stored in `wallet_guardian_actions`; the ledger row points at that action; overdrafts and dipping into goal-reserved savings are refused. Core: `POST /api/v1/tasks/:kidId/wallet/adjustments`.
- **Goal withdrawal** — `guardian_withdraw_goal(goal, actor, amount, spend|save, reason)`: moves coins out of a goal's tagged savings into Spend, or releases them into plain Save, as one balanced debit/credit pair; a deferred constraint trigger refuses a half-written action at commit. Core: `POST /api/v1/tasks/:kidId/goals/:goalId/withdrawals`. Monthly statements count a withdrawal as neither income nor spending and report corrections on their own `adjusted` line.
- **Redemption fulfilled** — `fulfill_redemption(redemption, actor)`: a verified guardian marks an approved reward delivered. Core: `POST /api/v1/tasks/redemptions/:id/fulfill`.
- **Guardian link pending/rejected** — `accept_guardian_invite` now produces a `pending` link while the child has a verified guardian; `decide_guardian_link` lets another verified guardian (never the pending adult) confirm (`verified`) or reject (`rejected`). A newer invite may re-pend a rejected or revoked link. A child with no verified guardian left keeps 0110's behavior (direct verification) because nobody could confirm. Core: `POST /api/v1/family/kids/:kidId/guardians/:linkId/decision`; the accept route now reports `{ linked, status }` from the database, never an assumed link.
- **Guardian link revoked** — `revoke_own_guardian_link(kid, actor)`: a verified guardian steps away while another verified guardian remains (`LAST_GUARDIAN` otherwise). A status-change suspension trigger mirrors 0110's delete trigger. Core: `POST /api/v1/family/kids/:kidId/guardians/leave`.

Consuming flows: `GET /api/v1/family/kids/:kidId/guardians` (every state, display names only), `GET /api/v1/family/guardian-links/mine` (the invited or departed adult's own pending/rejected/revoked links), `GET /api/v1/tasks/:kidId/wallet/guardian-actions` (history attributed as "you" or "another Tutor" only), `GET /api/v1/tasks/:kidId/wallet/ledger`, and the child's `GET /api/v1/tasks/wallet/ledger` now carrying each Tutor's reason (`note`); a movement whose reason cannot be read is refused rather than shown unexplained. `is_verified_guardian_of` and every Core guard already exclude non-verified links.

Rebuilt surfaces (`frontend/src/rebuild/family/`, no legacy imports; the API layer takes an injected transport so the rebuild imports nothing legacy): `CoGuardians` + `GuardianRequests`, `WalletCorrections` (correct coins, coins in goals, rewards to deliver, past corrections) and the child's `WalletActivity`, mounted through wrappers in the Family and Tasks routes. Copy lives in `i18n/<locale>/familyHub.json`; the child history is checked against the youngest band. Stepping away asks first and offers "Stay" before the destructive choice. No celebration fires (none of these is an OD-7 milestone). The FAQ answer about a second Tutor and the invite acceptance copy now state the confirmation step.

Enforced mechanism for OD-21's forward rule: `database/scripts/check-family-lifecycle.mjs` reads the CHECK vocabulary of tasks, savings goals, redemptions, the wallet ledger and guardian links from the migrations and refuses any declared state without registered producer and consumer evidence found in real source files (21 states today). It runs in `database` `npm test` and in the unfiltered repo gates; its test file proves it fails on a new unflowed state, a deleted producer, a missing consumer and a stale registry entry.

## Decisions taken on the SPEC's conservative default (proposals for owner review)

1. A second Tutor becomes `pending` until an existing verified Tutor confirms; only a child with no verified Tutor left is verified directly.
2. A Tutor may step away only from their own link. Removing another Tutor is not offered (custody-dispute risk); it is an open owner question.
3. Tutor corrections and goal withdrawals remain possible while an account is frozen: D.1 holds the child's allocations, allowance splits and redemption requests, and these are the guardian's own authority. A frozen child still cannot request a reward.
4. Any verified Tutor of the child may mark a reward delivered, not only the Tutor whose catalog it came from.
5. A goal withdrawal goes to Spend or plain Save, never Share; only a Tutor may perform it (OD-21 wording).
6. A pending Tutor is identified to the confirming Tutor by display name and date; a masked contact detail is an open owner question.

## Cross-lane finding (A.1 / S04)

Observed on native PostgreSQL: 0010's `prevent_parent_cascade_orphan`/`prevent_last_guardian_removal` refuse deleting the account of a kid-role child's only verified guardian ("Cannot delete this user because it would orphan a kid account"). 0110's suspension-on-last-link path is therefore unreachable for parent-created children; the FAQ's account-cancellation promise needs the A.1 lane to reconcile the two. Not changed here.

## Verification log

Executed 24 September 2026 in the S07 worktree. Commands are relative to the named directory. Local results only, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Physical PostgreSQL (actual migration chain) | Lane-owned PostgreSQL 17.6 cluster (`initdb` into `.lane-cache/pg`, port 15507, stopped afterwards); root: `python database/scripts/verify-family-state-machine-postgres.py` with `LF_PG_BIN/PORT/USER/DATA` | Passed. Every migration applied over a Supabase role/auth shim; 15 check groups: D.4 reproduced before the S07.1 migrations; kid, guardian, unrelated adult, independent teen and anon refused every write and every new RPC; service-role state machine refusals (13 task, 4 goal, 10 redemption, 5 freeze cases); manual adjustment and goal withdrawal flows and refusals; pending/rejected/revoked lifecycle including access checks; concurrency (8 simultaneous fulfilments by two guardians → 1; 8 simultaneous −3 debits against 6 coins → exactly 2, never negative; 8 opposite link decisions → 1 decision, 1 audit row); the metric isolating one out-of-band write; replay without data change. Report: `audit-results/s07-family-state-postgres.json` |
| Static migration gates | `database/`: `npm test` | Passed: 116 files numbering/RLS/phase (91 expand, 25 contract), lifecycle gate (21 states), 28 node tests, railway transport (12 scenarios) |
| Core adversarial | `backend/`: `npx vitest run src/__tests__/familyLifecycle.test.ts` | 60 passed: every population (kid, teen, staff, unrelated parent, pending adult, anonymous, unverified adult) refused before any RPC; exact actor pass-through; refusal mapping; transport/receipt failures never reported as success; metric admission |
| Core regression | `backend/`: `npm run type-check`, `npm run lint`, `npm test` | Passed; 71 files, 1,533 tests + 1 documented skip |
| Frontend components/data plane | `frontend/`: `npx vitest run src/rebuild/family src/routes/app/family src/routes/app/tasks` | 148 passed (18 surface, 13 data-plane, 8 copy-budget/glossary tests new) |
| Frontend regression | `frontend/`: `npm run type-check`, `npm run lint`, `npm test` | Passed; 214 files, 2,230 tests (run before the transport-injection refactor; the affected suites were re-run after it) |
| Real Chrome matrix | `frontend/`: `FAMILY_HUB_URL=http://localhost:5340 node scripts/verify-family-hub-lifecycle.mjs` | 12 of 12 journeys (EN/es-MX/pt-BR × light/dark × 375/1280), each a parent and a child journey; zero axe violations, no overflow, 48 px targets, every text node with a copy role, zero browser errors. Captures and `report.json` in `audit-results/family-hub-lifecycle/`; the es-MX dark 375 parent, pt-BR light 1280 parent and en-US light 1280 child captures were inspected |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check` (after staging, so the new files are scanned), `bash agent/tools/check-i18n.sh` (Git Bash), `npm run tools:test` | Passed: spec authority/tokens/assets OK; no credential patterns; i18n file/key parity, no hardcoded strings, every static key present; 56 of 56 tool tests |

Failures and their resolution: the first PostgreSQL run expected `GOAL_BALANCE_INSUFFICIENT` but the bucket check fired first; the ledger trigger now checks the goal before the bucket so the refusal names the real cause. The revoked-guardian read check exposed that `tasks_select_party` still admitted the task's author after they stepped away; the policy now admits only the child and current verified guardians. The single-file migration broke the Windows operator transport test (argument too long); it was split in five. `spec:check` refused the first API layer for importing `@/lib/api` into the rebuild; the transport is now injected by the route wrappers. Harness corrections: a `beforeEach` arrow that returned the mock was being run by Vitest as a cleanup hook; the browser driver's first kid run used an invalid age-band literal (`under_13` is the contract value).

### Resumed-session re-verification (24 September 2026, before commit)

The first session was interrupted by a usage limit after its gate runs and before committing. The resumed session reviewed the uncommitted diff (no file was discarded or rewritten; every changed and new file is LF), then re-ran every gate first-hand against the exact tree that is committed:

| Boundary | Command | Result |
|---|---|---|
| Physical PostgreSQL | Lane cluster started with `pg_ctl -D .lane-cache/pg/data -o "-p 15507 -h 127.0.0.1" start`, then `python database/scripts/verify-family-state-machine-postgres.py` (same `LF_PG_*` variables), then `pg_ctl stop -m fast` | Passed, all 15 check groups; metric isolated the single out-of-band write (`savings_goals:2:1`); replay preserved 13 ledger rows, 6 actions, 3 links |
| Core | `backend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 71 files, 1,533 tests + 1 documented skip |
| Frontend | `frontend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 214 files, 2,230 tests |
| Static migration gates | `database/`: `npm test` | Passed: 116 files numbering/RLS (91 expand, 25 contract, 14 contract pending), lifecycle gate 21 states across 5 columns, 28 of 28 node tests, railway transport 12 scenarios (about 55 minutes under five lanes' concurrent Git Bash load) |
| Repository gates | as above | Passed |

The browser matrix was not re-run: no frontend file changed after its 18:22 run (the last frontend edits are from 18:19). Two captures were re-inspected in this session (es-MX dark 375 parent corrections form; pt-BR light 1280 child history with a goal move, a Tutor correction with its reason and a fulfilled reward).

Copy finding (not changed here, legacy surface): the legacy Tasks screen's pt-BR bucket labels in `common.json` read "Guardar / Gastar / Doar", while the controlled glossary (owner log §5, Bible 02 §1) is "poupar / gastar / compartilhar". The rebuilt child history follows the glossary, so while it is mounted above the legacy stat cards a pt-BR child sees both words for the same pocket. The legacy strings belong to the Tasks screen rebuild in wave 2; changing them here would restyle a legacy screen and collide with other lanes' edits to `common.json`.

Remaining limitations: no full Supabase (PostgREST/GoTrue) stack run of the new routes and RLS; `database.ts` regeneration; production metrics for one release cycle (Appendix H "Measured"); human Product/Safety review of the proposals above and of the copy (native review of money screens is recommended by the Bible); the browser matrix uses synthetic Core responses. Neither D.4 nor D.5 is accepted.
