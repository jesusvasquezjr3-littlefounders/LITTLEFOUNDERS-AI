# S07: Family Hub and independent teen wallet

Status: in progress. Started 24 September 2026; S07.2, S07.3 and S07.4 recorded 25 September 2026; S07.5 recorded 24 September 2026 (the lane's verification date). Owner: Engineering for implementation; Product, Safety/Trust and the Block D Engineering Lead (Appendix H Stage 0 pairing) for the reviews named by the SPEC. No release approval is recorded.

## Binding acceptance sources

- Product D.1–D.23 and the Block D "Real-World Money Practice Standard" (non-negotiable constraints: no control shown as active unless enforced; no lifecycle state without a producing and consuming flow; no chore, redemption or banking-account state reachable through a path that bypasses parent-driven business rules).
- Appendix G (research framework) and Appendix H (metrics, Definition of Done, Stage 2 adversarial bypass testing, phasing: D.1/D.4 are Phase 0, D.5 is Phase 1).
- Owner decision log: OD-3 Option B (§7, independent teen wallet; §2 access model: "under the parent's approvals and the independence tiers of D.17"), OD-21 (every declared Family Hub lifecycle state gets a working flow; build, not remove), OD-23 (zero paid spend), §5 glossary ("Tutor" is only the verified parent; coins, never money).
- Frontend Bible 02 §1–2 and 06 for every rebuilt surface.

Risk classification: **structural/safety (money-adjacent state and family trust)**. Every change is subject to Appendix H Stage 2: an adversarial test must show the control restricts behavior through every path (UI, direct API, data gateway), not only that it displays correctly.

## Point-by-point checkpoints

| ID | Scope | Product acceptance | Frontend acceptance | State |
|---|---|---|---|---|
| S07.1a | D.4 data-layer writes cannot bypass the state machine | Browser roles hold no write path to tasks, goals, redemptions, catalog, ledger, guardian links or freeze fields; triggers enforce legal transitions for every writer including the service role (photo before approval, debit before a redemption is approved, reached only when savings cover the target, a child never lifts a guardian freeze); every accepted transition is recorded with its request role; Appendix H's Unauthorized State-Transition Rate is served to analytics staff | No surface change (enforcement boundary) | In progress: implementation and local verification recorded (native PostgreSQL over the actual migration chain, Core adversarial tests); full Supabase stack run, production metric and human review pending |
| S07.1b | D.5 / OD-21 lifecycle states | Redemption `fulfilled`, ledger `manual_adjustment` and `goal_withdrawal` (guardian-only, audited, required reason) and guardian-link `pending`, `rejected`, `revoked` each have a producing and a consuming flow; a gate refuses any Block D state without both | Rebuilt Tutors, coin-correction and child-history surfaces in three locales, light/dark, 375/1280 px | In progress: implementation and local verification recorded (PostgreSQL, Core, component and 12 real-Chrome journeys); full-stack run, copy/human review and Product acceptance pending |
| S07.2 | D.3 per OD-3 Option B (owner log §7): the self-registered teen's personal wallet | An eligible teen (13–17 by the stored age declaration, never role) logs income and splits it across Save/Spend/Share in one step with no approval, keeps savings goals, defines and marks their own rewards, and moves coins out of their own goal; Tasks, chore approval, reward requests and every parent-set rule stay guardian-only; adults, guests, under-13 arrivals, parent-created children (family wallet instead), staff and aged-out accounts hold no personal wallet, enforced by the database for every writer and by Core admission; a teen-initiated parent link layers the family mechanics onto the same ledger, goals and rewards without migration; Appendix H's Teen Independent-Mode Adoption is served to analytics staff | Rebuilt `/wallet` surface (`frontend/src/rebuild/wallet/`) in three locales, light/dark, 375/1280 px; learner shell shows Wallet, Tasks locked until a parent links, no Family entry for a teen | In progress: implementation and local verification recorded (native PostgreSQL over the actual migration chain, 73 adversarial Core tests, 42 component/route tests, 12 real-Chrome journeys); full Supabase stack run, types regeneration, copy/native review, production metric and Product acceptance pending |
| S07.3 | D.2 forgiving chore streak, D.10 expected contribution versus paid bonus task, D.11 savings bonus framed by age | The chore streak is computed by a lapse-tolerant model (two free rest days a week, permanent best and total, a Tutor's holiday pause) from practised days that only the task itself can record; a Tutor tags every chore as a family contribution (0–2 coins) or a bonus task (1–500) with no preselected kind; under 13 (or with no known birth date) the savings bonus is the fixed 1 coin per 10 saved and no percentage reaches the child, whoever writes the rule; 13–17 keep the Tutor's 0–20% with a worked example checked by the database; every threshold sits in the Block D threshold log and a gate keeps log, Core and migrations equal; three Appendix H diagnostics served to analytics staff | Rebuilt chore composer, chore streak, holiday pause, bonus settings and bonus explainer (`frontend/src/rebuild/family/`) in three locales, light/dark, 375/1280 px, mounted in the Tasks, Family and Banking routes | In progress: implementation and local verification recorded (native PostgreSQL over the actual migration chain, 77 new Core tests, 37 new component/copy tests, 12 real-Chrome configurations); full Supabase stack run, types regeneration, B.21 adoption of the model, copy/native review, production baselines and Product acceptance pending |
| S07.4 | D.13 recommended default split with an easy override and redemption timing, D.14 a real destination for the Share pocket, D.15 the next-goal prompt at the celebration, D.16 goal progress by provenance | Every holder owns a usual split (the recommended 50 / 40 / 10 until changed; only the holder sets it); every payout arrives pre-split by it, one tap keeps it and any split that places every coin is accepted; an allowance's Save part may go to a goal; Share coins go to a place a Tutor (or a self-registered teen) chose, and whoever chose it records what really happened with a required note, enforced for every writer; a goal is reached in the transaction that covered it and opens a next step whose first view is the one celebration, with a next goal that follows it; every goal carries its provenance (own, bonus, Tutor), a read without it is refused, and one component draws every goal bar; a consent-gated behaviour stream (the H.1 gate, fail-closed, never blocking, 400-day retention) feeds five Appendix H diagnostics served to analytics staff; new thresholds in the Block D log | Rebuilt split chooser, usual split, goals with provenance and the next-goal card, Share giving and the Tutor's Share places (`frontend/src/rebuild/family/`) in three locales, light/dark, 375/1280 px, mounted in the Tasks, Banking, Family and Wallet routes; a static D.16 release gate | In progress: implementation and local verification recorded (native PostgreSQL over the actual migration chain including a hand-computed diagnostic timeline, the S07.1/S07.2 checks re-run over the whole chain, 57 new Core tests, 49 new component/copy/gate/data-plane tests, 12 real-Chrome configurations); full Supabase stack run, types regeneration, copy/native review, production baselines, family usability testing and Product acceptance pending |
| S07.5 | D.17 a graduated-autonomy ladder inside the parent-managed system, D.18 a rationale requirement and communication scaffolding for approval and denial | Three independence levels for every child in a family (by age and record, never role): Level 1 is the old flat model, Level 2 self-logs family contributions and pre-approves rewards up to a Tutor-set amount (at most 20 coins), Level 3 self-logs chores up to 100 coins and pre-approves up to 100; the spending limit and the hold apply at every level; a documented age-and-track-record rule per level shown with the child's own numbers; a Tutor moves up only when eligible and down only with an actionable reason, the child asks and may step down, support staff and the evidence-based system step-down lower a level; every decision is one immutable record, and no "not yet" (sent back, cancelled, denied, declined, questioned) exists without a subject reason code and an actionable reason (a "later" with a date), for every writer; the child's own words reach the Tutor at decision time; three "not yet"s in 14 days open a "talk about it" nudge and the child can ask to talk; the rule is in `docs/operations/FAMILY-INDEPENDENCE-AND-DECISIONS.md` and 20 thresholds in the Block D log; three Appendix H diagnostics (progression, nudge trigger rate, human-scored actionability) served to analytics staff | Rebuilt decision queue and reason form (Tutor Tasks), independence ladder (Family, per child), the child's level, decision notes, mark-done-with-a-note and ask-for-a-reward-with-a-reason (child Tasks) in `frontend/src/rebuild/family/`, three locales, light/dark, 375/1280 px; the legacy approve/cancel/deny buttons replaced; nothing celebrates | In progress: implementation and local verification recorded (native PostgreSQL over the actual migration chain including a crafted metric timeline and real concurrency, the S07.1 and S07.2 checks re-run over the whole chain, 48 new adversarial Core tests, 30 new component/copy/parity tests, 12 real-Chrome configurations); full Supabase stack run, types regeneration, Product/Safety review of every threshold, production baselines, the first human-scored sample, family usability testing, native copy review and Product acceptance pending |

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

## S07.2: current state found (verified against the code, 25 September 2026)

The SPEC's D.3 "Current State" was accurate: `/tasks` and `/banking` were gated by `RequireRole(['parent','kid'])` in the SPA and every child-side Core route by `requireRole(['kid'])`, so a self-registered teen (the `universal` role) reached no wallet, goal, reward or statement under any circumstance. Two further gaps the SPEC does not name were reproduced on native PostgreSQL before the S07.2 migrations: nothing stopped the service role from writing a wallet ledger row or a savings goal for an **adult** (OD-3: adults never hold a personal wallet), and no database rule tied a guardian invite to a verified guardian of the account it was issued for.

## S07.2 implementation and rationale (D.3, OD-3 Option B)

This work was started by an earlier session of this lane that was interrupted by a usage limit before committing. The resumed session reviewed every uncommitted change against the SPEC (nothing was discarded), fixed the defects its own gate runs and captures found (below), and re-ran every verification first-hand before committing.

Migrations (descriptive names; the orchestrator assigns the final numbers at merge), split in five for the operator transport's single-argument limit: `independent_teen_wallet_schema`, `independent_teen_wallet_guards`, `independent_teen_wallet_ledger`, `independent_teen_wallet_flows` (expand) and `independent_teen_guardian_link`. The other four are declared `contract` because they drop and re-add the ledger reason CHECK and narrow what even the service role may write; every write the current Core makes stays legal (verified). They ship with, never ahead of, the Core release carrying the S07.2 routes, and after the S07.1 `family_hub_*` migrations.

1. **Eligibility by age, never role (OD-3; the A.3/A.4 pattern).** `teen_wallet_holder(user)` is true only when the stored age-screen declaration is `13_to_17`, there is no under-13 origin marker (A.2), the account is not a guest, holds none of `kid`/`parent`/`admin`/`superadmin`, and any profile birth date still places the person at 13–17 today. `wallet_holder_kind` answers `managed_child` (a parent-created child, the S07.1 family wallet), `teen`, or nothing. The ledger and savings-goal guards now refuse a row for anyone who is neither (`WALLET_HOLDER_REQUIRED`), whoever writes it: no adult can hold a personal wallet.
2. **The teen's own flows, with no approval step.** Service-role functions, each serialized on the holder's wallet advisory lock (the same key as S07.1's guardian flows, so a Tutor correction and a teen action never interleave) and audited in the same transaction:
   - `teen_log_income`: the source is `allowance`, `gift` or `earned` (never free text). The teen logs 1–1000 coins and splits them across the three pockets in one action. The Save part may go straight to an active goal, which is marked reached in the same transaction when the income covers it.
   - `teen_create_personal_reward`, `teen_archive_personal_reward` and `teen_claim_personal_reward`: the teen's own reward list, in place of a parent-curated catalog. A reward has a 1–60 character name and costs 1–500 coins, like the catalog. An account can hold at most 20 active rewards, which are archived rather than deleted. Marking a reward takes its cost out of Spend at once.
   - `teen_release_goal`: moves coins out of the teen's own goal into Spend or plain Save as one balanced pair. For a child in a family, this stays guardian-only (S07.1).

   Each function writes a `wallet_self_actions` row, and its ledger rows point at that row. A deferred constraint trigger refuses a half-written or unbalanced action at commit. The ledger guard refuses a teen reason without its matching action (amount, pocket, goal and author).
3. **Savings goals work exactly as in the managed model.** The teen uses the same goal endpoints and the same S07.1 goal state machine (`active→reached→archived`, reached only when tagged savings cover the target).
4. **Tasks and anything a parent approves stay guardian-only.** Core's child-side task, evidence, reward-catalog, redemption, allowance, pending-credit, spend-limit, savings-bonus and banking-account routes now admit a "child in a family" (`requireWalletAccess('familyChild')`): a parent-created child, or a teen with a verified parent. An unlinked teen is refused (`GUARDIAN_LINK_REQUIRED`). Balances, history, goals and the monthly statement admit every wallet holder (`'holder'`). The teen's own routes (`/api/v1/wallet/*`) admit only an eligible teen (`'teen'`). Admission reads the database's own classification (`wallet_access`); a failed read is a 502 and never an admission. The database re-checks every write regardless.
5. **Linking a parent later is teen-initiated and optional.** Only the teen can issue an invite for their own account. A database trigger now ties every invite to its issuer: the teen for a teen's account, a verified guardian otherwise. A teen can have at most three invites outstanding, and an invite lasts at most 8 days. Accepting any invite now needs a parent-role account (Core's family router already required current ID verification, A.5). A teen-issued invite always produces a **pending** link that only the teen can confirm or reject (`teen_decide_guardian_link`), so a leaked invite link can never attach a stranger to a teen's account on its own.

   Once the teen confirms, the parent's existing flows (chores, reward catalog and requests, allowance, freeze, spend limit, corrections) key on the teen's user id and a verified link. They therefore work on the teen's existing ledger, goals and personal rewards. Nothing is migrated, so nothing can be lost: the PostgreSQL run compares the wallet row for row before and after linking. The teen keeps the self-directed actions, but a freeze or spend limit the parent sets applies to them too. The limit counts reward requests and personal rewards over the same window.
6. **The teen keeps ownership of their account.** A parent linked to a self-registered teen is refused every account-holder control that a parent has over a child they created (`ACCOUNT_SELF_MANAGED`). That covers:
   - renaming the account;
   - the birth date;
   - the passphrase;
   - deleting the account;
   - the analytics consent, which the teen manages themself (H.1);
   - inviting another Tutor.

   `GET /family/kids` marks such a child as `accountType: 'teen'` (display only).
7. **Measured (Appendix H, Diagnostic, no target).** `teen_wallet_adoption(since)` returns counts only, never an identity: eligible teens; adopters (a logged income, a goal or a personal reward), split by whether a parent is linked now; and first uses inside the window. Core serves it at `GET /api/v1/admin/family/teen-wallet-adoption?days=N` behind `view_analytics`, with a `null` rate for an empty population. Personal-reward transitions are recorded in S07.1's `family_state_audit`, so the D.4 integrity metric covers them.
8. **Lifecycle gate (OD-21).** `check-family-lifecycle.mjs` now also reads `personal_rewards.status` and the three new ledger reasons: 26 declared Block D states across 6 columns, each with a registered producer and consumer.

**Rebuilt surface.** `frontend/src/rebuild/wallet/` imports nothing legacy; its API layer takes S07.1's injected transport. `TeenWallet` shows the balance and the pockets, then five sections that open on demand (log income, goals, rewards, history, parents), so the first view stays inside the Copy Budget. The coins are labelled as simulated once, and client validation mirrors the server's. There is no celebration (a reached goal is announced as plain status), no lives, no streak and no Mentor character. The copy lives in `i18n/<locale>/teenWallet.json` and is checked against the 13–17 band and the controlled glossary ("Tutor" only for the confirmed parent).

**Routing and the shell.** The route wrapper `routes/app/wallet/TeenWalletPage` binds the surface to the shared client. `useWalletAccess` asks `GET /api/v1/wallet/access` once per account and drives the learner shell:
- a teen sees Learn, Mentor, Tasks (locked, and leading to the wallet), Wallet and Profile;
- Banking appears once a parent links;
- Family never appears for a teen.

The legacy Tasks and Banking pages render the child's side for a linked teen (routing only, no restyle). The S07.1 surfaces now label the teen's entries in the history and say who confirms a pending adult (`awaiting`, `confirmedBy`).

## S07.2 decisions taken on the SPEC's conservative default (proposals for owner review)

1. A parent who accepts a teen's invite stays pending until the teen confirms. Nobody else, neither another Tutor nor staff, can confirm it.
2. Once linked, the teen keeps logging income, marking personal rewards and releasing their own goal coins with no approval step: Option B's "no approval step" is read as surviving the link. The parent's freeze and spend limit do apply to those actions. Whether a linked parent may switch the self-directed actions off is an owner question.
3. The parent of a self-registered teen gets none of the account-holder controls that a parent has over a child they created (rename, birth date, passphrase, delete, analytics consent, inviting another Tutor).
4. A teen may not remove a parent they confirmed, and S07.1's rule that the last verified guardian cannot step away also applies to the parent of a teen. Both are owner questions with custody and safety trade-offs, so they are recorded here rather than guessed.
5. A teen who turns 18 (by the profile birth date) loses the wallet's write and read paths through Core, because adults never hold a personal wallet. The rows are kept and remain readable to the account at the data layer (RLS select), but no read-only view or export exists yet. This is an owner question.
6. Income sources are a closed list (allowance, gift, earned). There is no free-text memo, so nothing identifying can be typed into a money record.
7. Personal rewards reuse the catalog's 1–500 coin range and are capped at 20 active per account.

## S07.2 verification log

Executed 25 September 2026 in the S07 worktree; these runs supersede the earlier session's runs of 24 September. Commands are relative to the named directory. Local results only, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Physical PostgreSQL, S07.2 | Lane cluster (`pg_ctl -D .lane-cache/pg/data -o "-p 15507 -h 127.0.0.1" start`); root: `python database/scripts/verify-teen-wallet-postgres.py` with `LF_PG_BIN/PORT/USER/DATA`; then `pg_ctl stop -m fast` | Passed, 17 check groups. Report: `audit-results/s07-teen-wallet-postgres.json`. Details below this table |
| Physical PostgreSQL, S07.1 regression over the whole chain | Root: the same variables plus `LF_PG_FULL_CHAIN=1 LF_PG_REPORT=audit-results/s07-family-state-postgres-full-chain.json python database/scripts/verify-family-state-machine-postgres.py`. This new mode runs every S07.1 check with the S07.2 redefinitions applied and replays every migration from the first S07.1 part on. Also run in the default mode | Both passed all 15 S07.1 check groups (`applied_through` 0121 and 0116 respectively) |
| Core adversarial | `backend/`: `npx vitest run src/__tests__/teenWallet.test.ts` plus the family, familyKids, familyLifecycle, guardianInvite, tasks and banking files | 73 teen-wallet tests pass (348 across the seven files). Coverage listed below this table |
| Core regression | `backend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 72 files, 1,610 tests + 1 documented skip |
| Frontend components/routes | `frontend/`: `npx vitest run src/rebuild/wallet src/rebuild/family src/rebuild/design src/routes/app` | 310 passed in 39 files (42 new: 14 surface, 12 copy-budget/glossary, 7 route gate, 9 shell) |
| Real Chrome matrix | `frontend/`: `TEEN_WALLET_URL=http://localhost:5340 node scripts/verify-teen-wallet.mjs` | 12 of 12 journeys (EN/es-MX/pt-BR × light/dark × 375/1280). 72 captures and `report.json` in `audit-results/teen-wallet/`. Journey steps and checks below this table |

**PostgreSQL S07.2 check groups (17):**
- **Gaps reproduced** before the first S07.2 migration: no teen path existed, and a ledger row and a goal for an adult were accepted.
- **Eligibility for 13 populations:** only the three declared 13–17 teens hold a teen wallet. The adult, guest, under-13 origin, aged-out, staff, undeclared and parent accounts hold none. The parent-created child keeps the family wallet.
- **Browser roles** were refused every write and all ten new functions.
- **Service-role refusals** for every non-holder and for every malformed or borrowed action.
- **Flows:** logged income, personal rewards and goal release.
- **Guardian-only:** tasks and approvals stay with the guardian.
- **Invites and pending links:** only the teen can confirm, and the wallet is identical before and after linking (6/15/1/1/3).
- **Layering:** a chore, a catalog request and its approval, and a Tutor correction all land on the same ledger.
- **Parent controls:** the parent's freeze and spend limit hold on the teen's own actions.
- **S07.1 regression** checks.
- **Concurrency:** 8 simultaneous marks of a 5-coin reward against 12 coins → exactly 2 succeed; 8 opposite teen decisions → 1 decision and 1 audit row.
- **Adoption metric:** 3/3/2/1/3.
- **Replay** of the migrations.

**Core adversarial coverage (`teenWallet.test.ts`):**
- `/wallet/access` answers all seven populations from the database classification.
- Every teen route is refused to a parent-created child, an adult, a guest, a parent and staff before any RPC.
- The caller, never a body field, is the holder.
- Every database refusal is mapped honestly.
- A transport or receipt failure is never reported as success.
- A linked teen is admitted to the family mechanics; an unlinked teen is refused.
- A teen gets their monthly statement.
- The adoption metric sits behind the analytics grant.
- Account-holder controls are refused for a linked teen (7 routes), with a 502 when the account type cannot be read.

**Browser matrix journey:**
1. Shell: Wallet present, Family and Banking absent, Tasks locked until the link.
2. First view within the Copy Budget.
3. Unsplit income refused locally, then one request that names no holder.
4. Goal reached, announced as plain status.
5. A reward refusal, then a reward added with Enter and used.
6. Goal release.
7. Labelled history.
8. Invite, teen confirmation, and Tasks unlocked.

Every configuration had zero axe violations, no overflow, 48 px targets, a copy role on every text node and zero browser errors.

### S07.2 commit gate (re-run on the committed tree)

| Boundary | Command | Result |
|---|---|---|
| Core | `backend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 72 files, 1,610 tests + 1 documented skip |
| Frontend | `frontend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 218 files, 2,272 tests (after the fixes below; the first full run had 1 failure) |
| Static migration gates | `database/`: `npm test` | Passed: 121 files numbering/RLS/phase (92 expand, 29 contract, 18 contract pending), lifecycle gate 26 states across 6 columns, 28 of 28 node tests, railway transport 12 scenarios |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check` (after staging, so the new files are scanned), `bash agent/tools/check-i18n.sh` (Git Bash), `npm run tools:test` | Passed: spec authority, tokens and assets OK; no credential patterns; i18n file and key parity, no hardcoded strings, every static key present; 56 of 56 tool tests |

**Failures and their resolution in the resumed session:**
- **Undefined class.** The full frontend suite found that the surface's Tasks link used `lf-button--secondary`, which no stylesheet defines (`designClasses.test.ts`). The class was removed; the base `.lf-button` is the secondary style.
- **Controls invisible in dark mode.** The captures showed that secondary controls on a section had the section's own fill and read as plain text: the "Open tasks" link, the unselected income sources, and the goal and reward actions. The surface now separates them by fill (sunken on a section, surface on a sunken row), per its "fill, never outline" rule. The matrix now also captures the rewards and goals sections.
- **Stalled matrix run.** The earlier session's last matrix run had stopped at its tenth journey on a blank page and left its Chrome profiles under `audit-results/`. The matrix now removes its throwaway profile, and the re-run passed 12 of 12.
- **Unclean database shutdown.** The earlier session had not stopped its PostgreSQL cluster cleanly, so it went through crash recovery on start. This session stopped it with `pg_ctl stop -m fast`.

**Cross-lane findings (not changed here):**
- The legacy learner shell labels the Mentor "AI Tutor" / "Tutor IA" (`dashboard.nav`), while the glossary reserves "Tutor" for the verified parent. The teen wallet now tells a teen "Ana is now your Tutor" on the same screen. The shell belongs to the S03 rebuild.
- The legacy locked-item badge reads "Tutor" on a teen's locked Tasks item; its hint now says "Tasks need a linked parent".

**Remaining limitations:**
- No full Supabase (PostgREST/GoTrue) stack run of the new routes, triggers and RLS.
- `database.ts` has not been regenerated.
- The adoption metric has no production baseline yet (Appendix H: Diagnostic, one release cycle).
- The browser matrix uses a synthetic Core.
- Human Product/Safety review of the proposals above, and native review of the copy.
- The owner questions above.

D.3 is not accepted.

## S07.3: current state found (verified against the code, 25 September 2026)

The SPEC's "Current State" for D.2, D.10 and D.11 was accurate, with one addition:

- **D.2 confirmed.** `POST /tasks/:id/complete` updated `kid_task_streaks` (0080) with `nextStreak()` from `services/streak.ts`, the learning streak's arithmetic: any gap restarted the count at 1. The update was last-write-wins from Core, so it was also not tied to a real chore.
- **D.10 confirmed.** `tasks.reward_coins` was `CHECK (> 0)`, Core required 1–500 and the legacy composer offered only a coin amount: every chore was paid, and there was no way to say otherwise.
- **D.11 confirmed.** One 0–20% rate for every age, credited weekly on the Save balance. The honest label ("not a bank interest rate") existed only on the Tutor's form.
- **Not in the SPEC:** the child never saw the rule. The only trace was a ledger line, "Bonus your family added", which is the "free money" reading D.11 warns about.
- **B.21 (S05 lane) is not in this worktree.** The learning streak still uses `nextStreak()` in `routes/onboarding.ts`. S07.3 therefore built the model as a pure, documented module and names the merge point below.

## S07.3 implementation and rationale (D.2, D.10, D.11)

This work was started by an earlier session of this lane that was interrupted by a usage limit before committing. The resumed session reviewed every uncommitted change against the SPEC and kept it: nothing was discarded. It also compared the redefined functions with the migrations they replace; each one keeps the earlier rules word for word and only adds to them. It restored one test file's CRLF ending, which the earlier session had converted to LF. It then re-ran every verification first-hand before committing. The earlier session's last browser matrix had stopped after 6 of 12 configurations, and its last `database` test run had failed on a Windows process-spawn error. Both were re-run; see the verification log.

Migrations (descriptive names; the orchestrator assigns the final numbers at merge), applied in this order after the S07.2 migrations:
- `chore_streak_rest_days` (expand);
- `family_task_contribution_kind` (contract);
- `savings_bonus_age_framing` (contract).

The two contract migrations narrow what any writer may store: a chore's coin rule, and a percentage for a child under 13. They also redefine the S07.1 task guard and the 0093 weekly credit. Every other rule in those two is kept word for word; the diff of each function against its previous definition shows only the additions. They ship with, never ahead of, the Core release carrying the S07.3 routes. `database/types/database.ts` was not hand-edited.

### D.2: the chore streak stops resetting on one missed day

1. **One model, written once (`backend/src/services/choreStreak.ts`).** It follows Frontend Bible 02 §9.6, which binds every streak in the product, and meets B.21's "lapse-tolerant" requirement:
   - two rest days a week (Monday to Sunday) are free and automatic;
   - a missed day while the streak is alive uses one of them;
   - a third missed day in a week rests the streak;
   - the best streak and the total days practised are permanent;
   - a Tutor's holiday pause makes days neutral.

   The streak number counts **practised** days only. A rest day or a paused day bridges the run but never adds to it, so neither can pad the number toward a 7/30/100 milestone. This is the same honesty rule D.16 applies to goal progress. Today is never a miss. A milestone fires only on the completion that first makes a day practised and lands the run exactly on 7, 30 or 100 (OD-7's closed list). A second chore on the same day never celebrates again.
2. **The facts cannot be forged.** Only a trigger on the task itself writes `chore_streak_days`. An `open→done` transition adds the day, and a Tutor who cancels a done chore takes it back. Any direct insert or update is refused, even by the service role. `tasks.completed_on` is stamped once, bounded to the server's UTC day ±1 (every real time zone), and immutable. Core never writes a streak.
3. **Holiday pauses (Bible 02 §9.6 rule 3).** `chore_streak_pauses` holds each pause, and the guard enforces its rules for every writer:
   - a verified guardian of the child sets it;
   - it lasts 1–21 days;
   - it starts at most 7 days back and at most 120 days ahead;
   - it never overlaps another pause, and at most 3 live pauses exist at a time;
   - it is cancelled before it starts, or ended early while it runs (it ends yesterday);
   - it is never deleted.

   Core calls it through `guardian_pause_chore_streak` / `guardian_end_chore_streak_pause` (`POST /api/v1/tasks/:kidId/streak/pauses`, `POST …/pauses/:pauseId/end`).
4. **No family loses a streak.** The migration backfills each legacy counter as its run of consecutive days ending on `last_completed_date`, marked `legacy`. `kid_task_streaks.longest_streak_days` stays as the permanent floor for the best streak (owner log §4: streaks, current and best, are never lost). The counter is no longer written.
5. **Reads.** `GET /api/v1/tasks/streak` (a child in a family) and `GET /api/v1/tasks/:kidId/streak` (the Tutor, with running and upcoming pauses). `GET /family/kids` now reports the model's current run. An unreadable history is a 502, never "no streak".
6. **Merge point (B.21).** The learning streak must call `evaluateStreak` with its own practised days and never keep a second copy. The module says so in its header, and the owner log's "rest day" glossary rule applies to both. Until the S05 lane adopts it, the learning streak keeps the all-or-nothing arithmetic, which is B.21's scope, not D.2's.

### D.10: expected family contribution versus paid bonus task

- `tasks.kind` is `contribution` (0–2 coins: unpaid, or a token amount) or `bonus` (1–500, paid at the Tutor's rate). The CHECK and the task guard enforce the pair for every writer, and the kind and the reward are immutable.
- A zero-coin contribution is approved like any chore and never allocated: the guard refuses the allocation flag, and the child's board does not offer a split. It still counts toward the chore streak.
- **The choice is deliberate and never preselected.** The rebuilt composer (`ChoreComposer`) makes the Tutor pick a kind. One line says no mix is right for every family, because the evidence does not compel an answer (Appendix G §1.2; the SPEC asks for "a deliberate design option… not a scientifically mandated ratio"). The API's `kind` default of `bonus` exists only so that an older client, which always sent a paid chore, keeps its meaning.
- Both task lists show the kind with the coins ("Family chore · no coins").
- The OD-21 lifecycle gate now registers both kinds with a producer and a consumer (28 states across 7 columns).

### D.11: a savings bonus the child can understand

- **The framing follows age, never role** (`savings_bonus_framing`):
  - `per_ten` applies under 13, or when there is no known birth date (the conservative default). The child reads "Keep 10 coins in Save, get 1 more each week" (the SPEC's proposed starting ratio). The Tutor only switches it on or off.
  - `percent` applies from 13 to 17: a self-registered teen, or a parent-created child whose birth date says 13 or older. The Tutor keeps the 0–20% rate.
- **The database is the boundary.** The rule guard refuses any rate but the fixed ratio for a `per_ten` child, a non-guardian and a non-holder. The weekly credit applies the framing the child is in **at credit time**, so a stored percentage can never reach a child under 13, whoever wrote it or when.
- **Existing rules for children under 13:**
  - a rate of 10% or more moves to the fixed ratio, which is never more than the Tutor agreed to;
  - a rate below 10% is switched off, so no coins are minted above what the Tutor agreed. The Tutor is told why, and the rule restarts only with their yes.

  The previous rate is kept (`reframed_from_rate_bp`) so the Tutor's screen can say what changed, until the Tutor next saves.
- **The child sees the rule with their own numbers.** `GET /api/v1/banking/savings-bonus` returns the child's saved coins and next week's bonus, using the credit's own arithmetic.
  - Under 13: the rebuilt explainer draws the coins as groups of ten, each earning one. No percentage appears.
  - 13–17: the explainer shows the rate, why the bonus grows ("bonus coins land in Save, so next week counts them too") and the honest "not a bank interest rate" line. It then offers a worked example. The teen's answer is checked by the database against the current rate (`record_savings_bonus_explanation`), and the example never uses the teen's own balance, whose answer is already on screen.
- A right answer gets an informational confirmation, never a celebration (OD-7).

### Measured and governed

Appendix H diagnostics (no target; counts only, never an identity), each behind `view_analytics`:
- **Chore-Tag Adoption Rate:** `GET /api/v1/admin/family/chore-tag-adoption?days=N`.
- **Chore streak rest-day utilization:** `GET /api/v1/admin/family/chore-streak-rest-days?days=N`. This is the Appendix's "Streak-Freeze Utilization Rate", renamed because the product never says "freeze" (owner log §5). It counts missed days covered by a rest day against missed days that rested a run, computed by the same model. A scan above 200,000 rows reports "unavailable", never a partial.
- **Age-Tier Bonus Comprehension Proxy:** `GET /api/v1/admin/family/savings-bonus-comprehension?days=N`.

Appendix H's Threshold Recalibration Log exists as `docs/operations/BLOCK-D-THRESHOLD-LOG.md`, with 12 thresholds, their sources, owners and a quarterly cadence. Two checks enforce it:
- `agent/tools/check-block-d-thresholds.mjs` runs in the unfiltered repo gates, with tests in `npm run tools:test`. It fails when the log, the Core constant and the migration disagree.
- `backend/src/__tests__/blockDThresholds.test.ts` pins the same values to the live constants.

### Rebuilt surfaces

The surfaces live in `frontend/src/rebuild/family/`, import nothing legacy and use the S07.1 injected transport:
- `ChoreComposer`, `ChoreStreak`, `StreakPauses`, `SavingsBonusSettings` and `SavingsBonusExplainer`;
- the API layer `familyMoneyApi.ts`, which shape-checks every response.

They are mounted through route wrappers:
- `ChoreComposerPanel` replaces the legacy paid-only form on the Tutor's Tasks screen;
- `ChoreStreakPanel` replaces the legacy flame chip on the child's Tasks screen;
- `StreakPausesPanel` sits on each child's card on the Family screen;
- `SavingsBonusSettingsPanel` replaces the legacy percentage-only section on the Tutor's Banking screen;
- `SavingsBonusPanel` is added to the child's Banking screen.

The copy lives in `i18n/<locale>/familyMoney.json`. It is checked for key parity, the Copy Budget, the controlled glossary, the honest "not interest" line and no percentage in the under-13 copy, and the child's first views are checked against the 6–9 first-view budget. A resting streak reads "Streak resting" with the best still shown, never a loss.

## S07.3 decisions taken on the SPEC's conservative default (proposals for owner review)

1. **Rest days.** The rest-day count (2 a week) and the milestones come from Bible 02 §9.6 and OD-7. The rest-day week runs Monday to Sunday on the child's local calendar.
2. **Pause bounds.** A pause lasts 1–21 days, starts at most 7 days back and at most 120 days ahead, and at most 3 live pauses exist at a time. These are Engineering proposals, recorded in the threshold log for Product review.
3. **Contribution coins.** A "nominal" contribution is capped at 2 coins; the SPEC mandates the choice, not a number.
4. **The fixed ratio is platform-wide.** A Tutor of a child under 13 cannot pick a different ratio. The SPEC calls 1 per 10 a starting ratio to be recalibrated through the threshold log, not a per-family setting.
5. **No known birth date.** A child with no known birth date gets the younger framing.
6. **Legacy rules for children under 13.** A rule below 10% is switched off pending the Tutor's yes, rather than raised to the fixed ratio. Raising it would mint more coins than the Tutor agreed to.
7. **Who sees the worked example.** Only a 13–17 child with an active percentage bonus, and therefore a linked Tutor, gets the worked example. An unlinked teen has no family bonus.
8. **A Tutor who steps away.** The weekly bonus job keeps crediting a rule whose Tutor is no longer a guardian, as it did before S07.3 (the job is bookkeeping, not a new decision). Any configuration change then needs a current Tutor. Whether a departing Tutor's bonus should stop is an owner question.
9. **Metric name.** The Appendix H metric name says "freeze"; the product and the admin API say "rest day" (owner log §5).

## S07.3 verification log

Executed 25 September 2026 in the S07 worktree by the resumed session, first-hand, on the committed tree. Commands are relative to the named directory. Local results only, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Physical PostgreSQL, S07.3 | Lane cluster (PostgreSQL 17.6, `.lane-cache/pg`, port 15507); root: `python database/scripts/verify-chore-streak-bonus-postgres.py` with `LF_PG_BIN/PORT/USER/DATA`; the cluster was stopped with `pg_ctl stop -m fast` afterwards | Passed, 11 check groups. Report: `audit-results/s07-chore-streak-bonus-postgres.json`. Details below this table |
| Physical PostgreSQL, S07.1 regression over the whole chain | Root: `LF_PG_FULL_CHAIN=1 LF_PG_REPORT=audit-results/s07-family-state-postgres-full-chain.json python database/scripts/verify-family-state-machine-postgres.py` | Passed all S07.1 check groups with `applied_through` the last S07.3 migration, so the redefined task guard and weekly credit keep every S07.1 rule |
| Physical PostgreSQL, S07.2 | Root: `python database/scripts/verify-teen-wallet-postgres.py` | Passed, 17 check groups. This verifier applies the chain through its own parts. S07.3's effect on teens (framing, a linked teen's bonus and chores, an unlinked teen refused) is covered by the S07.3 verifier |
| Core adversarial | `backend/`: `npx vitest run src/services/choreStreak.test.ts src/__tests__/choreStreakBonus.test.ts src/__tests__/blockDThresholds.test.ts` plus the tasks, banking and family files | 77 new tests (28 model, 43 route, 6 threshold) pass; 260 across the six files |
| Core regression | `backend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 75 files (+1 skipped), 1,689 tests + 1 documented skip |
| Frontend regression | `frontend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 220 files, 2,309 tests (37 new: 20 surface, 17 copy) |
| Real Chrome matrix | `frontend/`: `FAMILY_MONEY_URL=http://localhost:5340 node scripts/verify-family-money.mjs` | 12 of 12 configurations (EN/es-MX/pt-BR × light/dark × 375/1280). 72 captures and `report.json` in `audit-results/family-money/`. Journey steps below this table |
| Static migration gates | `database/`: `npm test` | Passed: 124 files numbering/RLS/phase (93 expand, 31 contract, 20 contract pending), lifecycle gate 28 states across 7 columns, 28 of 28 node tests, railway transport 12 scenarios (about 58 minutes under five lanes' concurrent load) |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check` (after staging, so the new files are scanned), `bash agent/tools/check-i18n.sh` (Git Bash), `npm run tools:test`, `node agent/tools/check-block-d-thresholds.mjs` | Passed: spec authority, tokens and assets OK; no credential patterns; i18n file and key parity, no hardcoded strings, every static key present; 62 of 62 tool tests; 12 thresholds agree |

**PostgreSQL S07.3 check groups (11):**
- **Gaps reproduced** on the chain before the first S07.3 migration: no practised-day record existed, a zero-coin chore was refused, and a 20% weekly percentage reached a 9-year-old (57 saved → 11 coins).
- **Upgrade in place:** a legacy 4-day streak became 4 consecutive legacy days, and legacy bonus rules moved as designed (9-year-old 20% → fixed ratio, on; undated 5% → off; 0% → off; the 14-year-old's 15% unchanged).
- **Completion day:** stamped once, bounded to ±1 day and immutable. Two chores on the same day count 2; a Tutor's cancellation takes one back.
- **Forgery:** no writer can insert, raise or mark a practised day; no browser role can write days or pauses; an unrelated parent reads nothing.
- **Pauses:** every bound, overlap, the live-pause limit, cancellation versus early ending, and a stranger refused.
- **Concurrency:** 8 simultaneous overlapping pauses → exactly 1; 8 simultaneous completions → the day counts 8.
- **Kinds:** both kinds and their coin bounds; the kind and the reward are immutable; a zero-coin contribution is approved and never allocated; Chore-Tag Adoption = 2/12/1/1.
- **Bonus:** framing for 10 populations; every forbidden rule refused; credits 69 → 6 and 57 → 5 under 13, 57 at 15% → 8 and a linked teen's 50 at 8% → 4. A stored 15% never reached a child whose birth date now says 12 (65 → 6).
- **Bookkeeping:** the weekly job for a departed Tutor's rule still advances, and configuration changes are refused.
- **Worked example:** refused to the under-13, undated, adult and unlinked-teen populations; answers are checked against the current rate; completion is never undone; Comprehension Proxy = 2/2/1.
- **Replay** of the three migrations preserved all data and refusals.

**Browser matrix journey (each configuration):**
1. Tutor, Tasks: nothing preselected, a submit without a kind refused locally with no request, then an unpaid contribution created with the exact body.
2. Tutor, Family: an out-of-range pause refused locally, a valid one saved and re-read as running, then ended.
3. Tutor, Banking, a child under 13: the fixed rule with no percent field; the "what changed" notice shown, then cleared on save; the PUT carries no rate.
4. Child, Tasks: rest days shown; the family chore named with no coins; marking it done reaches 7 days and the 7-day milestone shows once.
5. Child, Banking, under 13: coins in groups of ten, never a percent.
6. Teen, 14: the percent, why it grows, "not interest", then the worked example (a wrong answer, then the right one).

Every configuration had zero axe violations, no panel overflow or page scroll, 48 px targets, a copy role on every text node and zero browser errors. Three captures were inspected in this session: es-MX dark 375 Tutor composer, pt-BR light 1280 teen worked example, en-US light 375 child streak at the 7-day milestone.

**Failures and their resolution in the resumed session:**
- **Line ending.** `KidBankingFreeze.test.tsx` is CRLF in the index; the earlier session's edit had rewritten it as LF (a whole-file diff). It was restored to CRLF, leaving a two-line diff.
- **Incomplete matrix.** The earlier session's last matrix run had stopped after 6 of 12 configurations. It was re-run from a clean capture directory: 12 of 12.
- **`database` test run failed.** The earlier session's last run failed in `railway-migrate.test.mjs` with Windows status `0xC0000142` (a child process failed to initialize under five lanes' load, before any migration was read). It was re-run and passed.
- **Leftover processes.** The earlier session had left the lane's Vite server and PostgreSQL cluster running. Both were reused for this session's runs and then stopped.

**Cross-lane findings (not changed here):**
- **B.21 (S05).** The learning streak (`routes/onboarding.ts`) still resets on one missed day. It should adopt `evaluateStreak` rather than a second model.
- **Unused legacy strings.** The legacy `banking.parent.bonus*` strings in `common.json` are no longer rendered. They were left in place to avoid colliding with other lanes' edits; the wave-2 Banking rebuild removes them.
- **Two names for one kind.** The kind line says "Family chore", while the composer says "Family contribution" for the same kind. This is deliberate: the shorter word suits the list, and the composer explains the choice. It should go to native copy review.

**Remaining limitations:**
- No full Supabase (PostgREST/GoTrue) stack run of the new routes, triggers and RLS.
- `database.ts` has not been regenerated.
- The three diagnostics have no production baseline yet (one release cycle).
- The browser matrix uses a synthetic Core.
- The first quarterly threshold review.
- Human Product/Safety review of the proposals above, and native review of the copy.
- B.21's adoption of the model.

D.2, D.10 and D.11 are not accepted.

## S07.4: current state found (verified against the code, 25 September 2026)

The SPEC's "Current State" was partly stale for D.13 and D.16:

- **D.13 partly stale.** The SPEC says the child has no discretion over the ratios. In fact the legacy allocation dialog let the child type any split that added up. But it always opened with every coin in Save. That default was fixed and nobody had chosen it, so it was not a recommendation. There was no usual split, and nothing recorded the default against the child's choice. An allowance's Save part could not go to a goal: `allocate_pending_credit` had no goal parameter, and the S07.1 ledger guard refused a tagged allowance row (reproduced on PostgreSQL). Nothing timed reward requests against credits.
- **D.14 confirmed.** Share coins could not leave the Share pocket at all. No ledger reason debits Share except a Tutor's correction.
- **D.15 confirmed.** A reached goal led nowhere. Core flipped the status in a second request, outside the allocation's transaction. The teen wallet announced it as plain status.
- **D.16 partly stale.** The savings bonus has never been tagged to a goal: it lands in plain Save, and the S07.1 ledger guard refuses a bonus row with a goal (reproduced). No goal bar has therefore ever included bonus coins. But every goal display still showed one mixed total with no provenance:
  - the legacy Tasks and Banking bars;
  - the teen wallet's bar;
  - the Tutor's correction panel ("{saved} of {target} coins").

  Any future path that tagged coins other than the child's own to a goal would have been folded in silently.
- **Not in the SPEC.** Coins in plain Save, bonus coins included, can never reach a goal: there is no "move to a goal" flow. Recorded as an owner question below; not built.

## S07.4 implementation and rationale (D.13, D.14, D.15, D.16)

Migrations (descriptive names; the orchestrator assigns the final numbers at merge), applied in this order after the S07.3 migrations:
1. `family_money_events` (expand);
2. `share_gift_destinations` (contract: the ledger reason CHECK is dropped and re-added as a pure widening);
3. `share_gift_flows` (expand: the ledger guard is replaced, and the Share flows and metric);
4. `wallet_usual_split` (expand);
5. `savings_goal_next_step` (expand).

The Share work is split in two because a single 33 KB file exceeded the Windows command-line limit of the operator transport (`railway-migrate.test.mjs`), the same limit S07.1 met.

The ledger guard, the two allocation functions and `teen_log_income` are redefined. Each keeps every earlier rule word for word and only adds to it. The S07.1 and S07.2 PostgreSQL verifiers re-run all their checks over the whole chain to prove it (below). The migrations ship with, never ahead of, the Core release carrying the S07.4 routes. `database/types/database.ts` was not hand-edited.

### The consent-gated behaviour stream (D.13, D.15 instrumentation)

The Appendix H diagnostics of this checkpoint are records of what a child did with their coins and when. That is analytics, not bookkeeping. So they go into their own stream, `family_money_events`, and through the same gate as `learning_events` (H.1, 0090):
- a parent-created child is recorded only while the Tutor's analytics consent is active;
- a self-registered teen only with their own opt-in;
- never a guest or an account with the under-13 origin marker.

The gate is a BEFORE INSERT trigger that drops the row. No emitter can forget it, and a consent revoked mid-transaction still wins. It is fail-closed and never blocking: when the consent question cannot be answered, the event is dropped and the coin movement goes through untouched (proved on PostgreSQL). No browser role and not even Core's service role can write or read a row. Only the database's own emitters write, so no request can forge a behaviour. The stream holds closed vocabularies, integers and ids, never free text. `prune_family_money_events(400)` keeps it to 400 days, the `learning_events` bound, and the nightly `insights-maintenance.yml` calls it once the migration is applied. The PostgreSQL run proves that `family_analytics_admitted()` gives the same answer as the H.1 gate for all 11 populations.

### D.13: a recommended default split with an easy override

Owner log §8: no compulsory rationale was recorded, so the recommended default with an override applies.

- **Every wallet holder has a usual split.** It is their own ratio and starts from the platform's recommended 50 / 40 / 10 until they change it. Only the holder sets it (`set_wallet_usual_split`, `SPLIT_OWNER_ONLY` for anyone else). A Tutor sees it read-only on the Share-places panel. A Tutor-set ratio would be the externally imposed category D.13 moves away from (Appendix G §2.1).
- **Every payout arrives pre-split** by that ratio: a chore reward, an allowance, or a teen's logged income. Keeping it is one tap ("Use my split"). "Change it" opens per-pocket steppers and typed counts. Any split that places every coin is accepted, including everything in one pocket.
- **The coin arithmetic is written three times and pinned to one fixture.** The database (`wallet_split_coins`), Core and the client each compute it (the floor of each share, the leftover coins to the largest remainders). All three are checked against `database/scripts/fixtures/split-coins.json` (200 cases).
- **The usual split is shown "out of every 10 coins" to every age, never as a percentage.** D.11 found percentages unusable for young children. It is stored as percent.
- **An allowance's Save part may now go to a goal**, as a chore reward's already could. The savings bonus still never may.
- **Measured.** Every split writes a `split_allocated` event holding the default at that moment, computed in the database, and whether the child kept it. This is Appendix H's Split-Ratio Engagement Quality (`GET /api/v1/admin/family/split-engagement`).
- **Reward requests are timed.** Every reward request (a catalog request, or a teen's personal reward) records the hours since the last allowance credit and the last earned credit to Spend, read from the ledger at that moment. Every own credit is recorded with its class and pocket.
- **The Allowance-Triggered Redemption Spike** (`GET /api/v1/admin/family/redemption-timing`) reports requests per 100 child-days in four time-since-credit bins, allowance against earned credits. Each rate has a real denominator: the child-hours spent in each bin, computed from the credit events. This is the falsifiable test of Heath and Soll's rigidity prediction. The PostgreSQL run checks it against a hand-computed timeline.

### D.14: a real destination for the Share pocket

- **A share destination is a real place the family chooses:** a cause, a gift for someone, or a community action. A verified Tutor chooses it for a child in a family. A self-registered teen chooses their own (OD-3 Option B, no approval step). A linked teen can have both kinds. A holder has at most 10 active places.
- **A share gift directs Share coins to a place.** The coins leave Share at once, so they cannot be pledged twice. The gift then waits for whoever chose the place to record what really happened:
  - `given`, with a required note that the child reads;
  - or `returned`, with a required reason.

  The child may take a pledge back before it happens, with no note. A deferred constraint trigger refuses a gift without its debit, or a return without its single credit. The ledger guard refuses any forged gift row.
- **D.1.** A Tutor's freeze holds the child's pledges and take-backs. The Tutor can still record what the family did.
- **Honesty (D.7).** Coins are never sent anywhere. The copy says so on both sides ("Coins stay in the app", "Coins are never sent anywhere"), and a copy test pins it in all three locales.
- **The monthly statement** reports gifts on their own `given` line, never as spending. The legacy statement card does not show that line yet: it belongs to the wave-2 Banking rebuild.
- **Measured.** The Share-Bucket Destination Completion Rate (`GET /api/v1/admin/family/share-completion`) is read from the gifts themselves, which are bookkeeping, not behaviour:
  - gifts pledged in the window and old enough to judge;
  - given within 14 days, given later, returned, or still waiting;
  - and the "invisible destination" risk itself: holders who have Share coins but no active place.
- **Every transition is audited.** Share-place and gift transitions are in the D.4 transition audit. The OD-21 lifecycle gate registers every new state with a producer and a consumer: 39 states across 10 columns.

### D.15: "what's your next goal?" at the celebration

- **A reached goal opens a next step.** A goal is now reached inside the transaction that covered it: a chore allocation, an allowance, or a teen's income. Core no longer flips it. Reaching a goal opens its next step (`pending`), whatever path reached it.
- **The first view is the celebration.** The child's first view of the reached goal is the one OD-7 celebration ("savings goal reached"). It happens only when `goal_next_step_seen` answers `true`, so it comes once per goal whoever reloads the page. The prompt sits in the same card: start a next goal, which follows this one (`set`), or "Not now" (`declined`). "Not now" is respected: the prompt does not come back, but a next goal can still follow later. A goal can be followed only once, only by the holder's own reached goal, and the link cannot change.
- **Measured.** The Post-Goal Motivation Cliff (`GET /api/v1/admin/family/post-goal-motivation`) compares Save contributions per day in the 28 days up to a goal with the 14 days after it. It splits the goals by whether a next goal was set within 2 days, which is the D.15 mechanism under test. Save-Bucket Contribution Persistence (`/save-persistence`) is its baseline and counts own coins only, never the bonus.

### D.16: goal progress by provenance

- **The server gives every goal with its provenance.** `goal_progress_breakdown` splits a goal's coins into three parts:
  - `own`: chores, allowance, the teen's own income;
  - `bonus`;
  - `family`: any other credit.

  Every goal response carries `progress: {own, bonus, family, total}`, with `saved` kept as the total for older clients. A read that cannot provide it is refused (502) rather than shown as a mixed number. Coins taken out of a goal come out of the child's own part first, so "yours" is never overstated.
- **One display draws every goal bar.** It is `<GoalProgress>`: own coins are solid, bonus coins striped, Tutor coins dotted, and each part that is not zero is named with its number, so the difference never rests on colour alone. When every coin is the child's own, it says "All yours".
- **Every goal surface uses it.** It replaces:
  - the legacy Tasks and Banking goal lists (through the new `SavingsGoalsPanel`);
  - the teen wallet's bar;
  - the Tutor's correction panel.
- **Measured, as a release gate.** The Goal-Progress Bonus-Distinction Compliance Rate is enforced twice:
  - statically, by `frontend/src/rebuild/family/goalProgressGate.test.ts`: no goal-progress display in the app, the family surfaces or the wallet outside `<GoalProgress>`, with a known-bad fixture proving it fails;
  - at runtime, by the browser matrix, which checks every rendered goal bar's segments, legend and fills.

### Rebuilt surfaces and mounting

The surfaces live in `frontend/src/rebuild/family/`:
- `SplitChooser`, `UsualSplit`, `GoalProgress`, `GoalNextStep`, `SavingsGoals`, `ShareGiving` and `ShareDestinations`;
- the API layer `moneyHabitsApi.ts`, which shape-checks every response. A goal whose parts do not add up, a usual split that does not make 100, and a gift shown as given without its note are all refused.

They import nothing legacy and use the S07.1 injected transport. The copy lives in `i18n/<locale>/moneyHabits.json`, checked for:
- key parity and the Copy Budget role of every key;
- the youngest band (6-9) for the child's surfaces, 13-17 for the teen's own-place lines and adult for the Tutor's;
- the 6-9 first-view budget;
- the controlled glossary (no money, withdraw, interest, freeze, job, invest or donate; no Mentor or bot; no percentage);
- the honesty lines.

Mounting, through route wrappers:
- `AllocationPanel` (chore rewards on Tasks, allowances on Banking), `UsualSplitPanel`, `SavingsGoalsPanel` and `ShareGivingPanel` replace the legacy allocation dialogs and goal lists on the child's Tasks and Banking screens;
- `ShareDestinationsPanel` sits on each child's card on the Family screen;
- the teen wallet uses the same pieces: income pre-split by the usual split, the usual-split settings, goal provenance and the next goal, and a Share section.

The legacy allocation and goal components were removed from `KidTaskBoard` and `KidBankingHome`. Their `common.json` strings are left for the wave-2 cleanup, to avoid collisions with other lanes. The legacy activity lists name the two new ledger reasons instead of calling them an "adjustment".

## S07.4 decisions taken on the SPEC's conservative default (proposals for owner review)

1. **The usual split belongs to the child.** The child (or teen) sets it and the Tutor sees it read-only. A Tutor-set default would be an externally imposed ratio. Whether a Tutor may suggest one is an owner question.
2. **The recommended split is 50 / 40 / 10** (5 / 4 / 1 out of 10). Appendix G gives no evidence for any ratio. It is recorded in the threshold log for review.
3. **The usual split is shown out of 10 to every age**, never as a percentage, even to teens: one representation, and no percentage for any child.
4. **Share places.** For a child in a family only a Tutor chooses places. A child proposing a place for the Tutor to accept is an owner question. Places are archived, never deleted: at most 10 active per holder, and 1 to 1000 coins per gift.
5. **Settling a gift.** The steward (whoever chose the place) records "given", always with a note. The child can take a pledge back before it happens. A Tutor returns one only with a reason.
6. **The freeze and Share.** A freeze holds the child's pledges and take-backs, but not the Tutor's record of what happened (the same rule as S07.1 decision 3).
7. **The next goal.** The prompt comes once per reached goal, and "Not now" ends it. Goals reached before S07.4 get no next step, so there is no late celebration.
8. **Provenance.** Coins leaving a goal are taken from the child's own part first, so the "yours" number is a floor.
9. **Diagnostic windows**, all recorded in the threshold log: time-since-credit bins of 24, 72 and 168 hours; a 28-day baseline and 14 days after for the cliff; 2 days for "a next goal was set"; 14 days for Share completion.
10. **The behaviour stream follows the H.1 retention and revocation practice of `learning_events`:** 400 days, and a revoked consent stops new events without deleting past ones. D.21's written policy decides whether that holds.

## S07.4 verification log

Executed 25 September 2026 in the S07 worktree, first-hand, on the committed tree. Commands are relative to the named directory. Local results only, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Physical PostgreSQL, S07.4 | Lane cluster (PostgreSQL 17.6, `.lane-cache/pg`, port 15507); root: `python database/scripts/verify-money-habits-postgres.py` with `LF_PG_BIN/PORT/USER/DATA`; the cluster was stopped with `pg_ctl stop -m fast` afterwards | Passed, 14 check groups. Report: `audit-results/s07-money-habits-postgres.json`. Details below this table |
| Physical PostgreSQL, S07.1 regression over the whole chain | Root: `LF_PG_FULL_CHAIN=1 LF_PG_REPORT=audit-results/s07-family-state-postgres-full-chain.json python database/scripts/verify-family-state-machine-postgres.py`; also the default mode | Both passed all their check groups. The full chain was applied through the last S07.4 migration, so the redefined ledger guard and allocation functions keep every S07.1 rule. One verifier line changed; see the failures below |
| Physical PostgreSQL, S07.2 regression over the whole chain | Root: `LF_PG_FULL_CHAIN=1 LF_PG_REPORT=audit-results/s07-teen-wallet-postgres-full-chain.json python database/scripts/verify-teen-wallet-postgres.py` (the full-chain mode is new in this checkpoint); also the default mode | Both passed all 17 check groups. The full chain was applied through the last S07.4 migration, so the redefined ledger guard and `teen_log_income` keep every S07.2 rule |
| Physical PostgreSQL, S07.3 | Root: `python database/scripts/verify-chore-streak-bonus-postgres.py` | Passed, 11 check groups (unchanged chain through its own parts) |
| Core adversarial | `backend/`: `npx vitest run src/__tests__/moneyHabits.test.ts src/__tests__/blockDThresholds.test.ts` plus the tasks, banking and familyLifecycle files | 57 new adversarial tests pass (`moneyHabits.test.ts`), and the threshold test gains one; 2 allocation tests in `tasks.test.ts` were rewritten for the database-side flip. Coverage: every holder route refused to an adult, a guest, a parent and staff before any RPC; every Tutor route refused to the six non-parent populations, and a stranger gets 404 before any RPC; the caller, never a body field, is the holder and the actor; every database refusal mapped; a transport failure or an unexpected receipt is never reported as success; a goal list without provenance or next steps is refused (502); the metrics sit behind the analytics grant, with null rates for empty populations and 502 for a partial read |
| Core regression | `backend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 76 files (+1 skipped), 1,747 tests + 1 documented skip |
| Frontend regression | `frontend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 224 files, 2,358 tests. The 49 new tests: 19 surface, 17 copy, 4 D.16 gate, 9 data-plane |
| Real Chrome matrix | `frontend/`: `MONEY_HABITS_URL=http://localhost:5340 node scripts/verify-money-habits.mjs` | 12 of 12 configurations (EN/es-MX/pt-BR × light/dark × 375/1280). 72 captures and `report.json` in `audit-results/money-habits/`. Journey steps below this table |
| Static migration gates | `database/`: `npm test` | Passed. 129 files pass the numbering, RLS and phase checks (97 expand, 32 contract, 21 contract pending). The lifecycle gate covers 39 states across 10 columns. 28 of 28 node tests and the railway transport (12 scenarios) pass. The first run failed on the transport; see the failures below |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check` (after staging, so the new files are scanned), `bash agent/tools/check-i18n.sh` (Git Bash), `npm run tools:test`, `node agent/tools/check-block-d-thresholds.mjs` | Passed: spec authority, tokens and assets OK; no credential patterns; i18n file and key parity, no hardcoded strings, every static key present; 62 of 62 tool tests; 25 thresholds agree (13 new) |

**PostgreSQL S07.4 check groups (14):**
- **Gaps reproduced** on the chain before the first S07.4 migration: no usual split, Share place, next step or behaviour stream; an allowance cannot carry a goal tag; a bonus row tagged to a goal is already refused.
- **Consent gate:** equal to the H.1 gate for all 11 populations; no browser or service-role write or read of the stream.
- **Usual split:** the default, the owner-only setter, refused sums, no wallet for an adult or a guest, no browser path; the fixture parity for all 200 cases.
- **Split events:** kept, adjusted, an allowance to a goal, an older six-argument call, the teen's income; no event for the under-13 child or the teen who did not opt in; the coins still land when the consent store fails (the event is dropped); Split-Ratio Engagement exact.
- **Redemption timing:** a catalog request and a personal reward, timed from the ledger; no event for the under-13 child; credits recorded with their class.
- **Share:** places by the Tutor and by the teen, the refusals (child, stranger, adult, name, kind, limit), pledges, "given" only by the steward and always with a note, take-back, a Tutor's return with a reason, and exact ledger rows.
- **Share forgery:** no direct service-role write; forged ledger rows refused; a gift without its debit refused at commit; a settled gift cannot reopen, even for a superuser; no browser write; RLS reads.
- **Share and the freeze.**
- **Concurrency:** 8 simultaneous 3-coin pledges against 10 coins → exactly 3; 8 simultaneous opposite settlements → exactly 1.
- **Next goal:** reached in the allocation's own transaction, the step opened, the first view once, a foreign child refused, a follower only for one's own reached goal and only once, the link immutable, "not now" respected, no event under 13, no writer can reopen or forge a step, RLS.
- **Provenance:** a chore and an allowance counted as the child's own, a withdrawal from the own part first, no writer can tag a bonus or an unexplained Tutor credit; a simulated future path shown apart (13 / 4 / 3), and a later withdrawal leaving 0 / 4 / 1.
- **Retention and audit:** the 400-day prune and its log; the transitions in the D.4 audit, all through the service role.
- **Replay** of the five migrations preserved every row and refusal.
- **Diagnostics on a crafted, backdated timeline:** the redemption rates, the post-goal cliff and Save persistence equal the hand computation.

**Browser matrix journey (each configuration):**
1. Tutor, Family, Share places:
   - a place without a kind is refused locally, with no request;
   - a place is added with the exact body;
   - marking a pledge done without a note is refused locally, then the settle carries the note;
   - the child's usual split is shown out of 10.
2. Child, Tasks:
   - the chore reward arrives pre-split 5 / 4 / 1 and Enter keeps it, with the exact body;
   - the usual split changes out of 10 (no percent) and is saved as percent;
   - the reached goal celebrates once and carries the prompt, and the next goal follows it (the exact body; one first-view call);
   - every goal bar shows its provenance, with the bonus drawn apart as a pattern and named;
   - Share coins go to the family's place (the exact body), and the Tutor's note is shown.
3. Teen, Wallet:
   - income is pre-split 6 / 5 / 1 by the usual split;
   - the teen adds their own place, gives coins, and "I did it" needs a note, then logs it.

Every configuration had zero axe violations, no panel overflow or page scroll, 48 px targets, a copy role on every text node and zero browser errors. Six captures were inspected in this session, including the es-MX dark 375 child goals (own and bonus segments, the celebration and the prompt), the pt-BR light 1280 Tutor Share places (the required note), the es-MX dark 375 split chooser, and the en-US dark 375 and pt-BR dark 1280 child Share.

**Failures and their resolution:**
- **The first PostgreSQL runs.** The verifier's own mistakes were fixed: a helper named a column before its migration existed; the stream refuses browser reads with a privilege error, not an empty result; `split_allocated` events also carry a goal id.
- **A consent failure blocked the wallet.** The S07.1 full-chain run found that the analytics gate could block a wallet write: its shim's `auth.users` has no `is_anonymous`, and the gate's error aborted the allocation. The gate is now fail-closed and never blocking. The S07.4 verifier proves the coins land when the consent question fails.
- **The goal-reached flip moved into the database.** The S07.1 full-chain run failed where it flipped a goal that S07.4 had already reached in the same transaction. The verifier now flips only when the goal is not yet reached, which keeps the S07.1 check valid for both chains.
- **A retention function read as a row deletion.** The migration phase gate read the prune function's `DELETE` as a row deletion at apply time. It is now a `WITH ... DELETE ... RETURNING` inside the function, with a comment. The migration deletes nothing when applied, so it stays `expand`.
- **The Share migration was too large for the operator transport.** `railway-migrate.test.mjs` failed on the single 33 KB Share migration: the Windows command line refused its base64 payload (`Argument list too long`), the limit S07.1 met. It is now two files, `share_gift_destinations` and `share_gift_flows`, and every verifier, gate and document names both.
- **A clash with the analytics console's drift test.** `usageShared.test.ts` reads the last event IN-list CHECK of the migrations as the `learning_events` vocabulary, and the new stream's CHECK matched it. The stream's CHECK now uses `= ANY (ARRAY[...])`.
- **Dark mode on nested surfaces.** A nested `.lf-rebuild` without its own `data-theme` resets the tokens to light, so the split chooser and the usual-split settings (inside a wrapper, and inside the teen wallet) would have rendered light in dark mode. Both now carry their own theme and language.
- **Matrix findings:**
  - `<option>` text had no copy role;
  - the matrix's own state leaked from one journey into the next (the usual split and a settle count);
  - the Share total was oversized at 375 px (2.5rem across three lines, now 1.5rem);
  - a secondary button on a list row read as plain text in dark mode (now filled);
  - a gift row showed a bare number (now "{count} coins").

  One run stopped at its eleventh configuration on a blank page after navigation. The page was empty, with no assertion about the product. The complete re-run passed 12 of 12.

**Cross-lane findings (not changed here):**
- **H.1 / A.2.** A parent-created child under 13 whose Tutor gave a birth date carries the A.2 under-13 origin marker, because `record_age_declaration` marks it. So the H.1 optional-event gate never admits that child, even with the Tutor's analytics consent. The Block D diagnostics mirror that gate exactly, so they exclude that population. Whether a Tutor's consent should admit a child who is under 13 because the Tutor said so belongs to the H.1 and A.2 owners.
- **The legacy statement card** does not show the new `given` line (wave-2 Banking rebuild).
- **Unused legacy strings.** `tasks.kid.allocate*` and the legacy goal strings in `common.json` are no longer rendered (wave-2 cleanup).

**Remaining limitations:**
- No full Supabase (PostgREST/GoTrue) stack run of the new routes, triggers and RLS.
- `database.ts` has not been regenerated (five new tables, one new column on `wallet_ledger` and one on `savings_goals`).
- The five diagnostics have no production baseline yet (one release cycle).
- The browser matrix uses a synthetic Core.
- The first threshold review of the new keys.
- Human Product/Safety review of the proposals above, and native review of the copy.
- Appendix H Stage 5 (family usability testing of the split chooser, Share and the next-goal prompt) has not been run.

D.13, D.14, D.15 and D.16 are not accepted.

## S07.5: current state found (verified against the code, 24 September 2026)

The SPEC's "Current State" was accurate for D.17 and partly stale for D.18:

- **D.17 confirmed.** Nothing in the database or Core knew a child's age or record when approving. A chore reached `approved` only with a verified guardian as `decided_by`, and a reward only through `decide_redemption` called by a Tutor, for an 8-year-old and a 17-year-old alike. There was no level, no pre-approved amount and no self-logging anywhere.
- **D.18 confirmed, and worse than stated for rewards.** A chore's only "not yet" was a cancel with an optional reason of up to 240 characters. A chore could not be sent back to finish: cancelling was the only way to refuse it. A reward denial carried **no reason at all**: the route took `{ approve }` only. The SPEC says "an optional, short reason" for both. Nothing captured the child's own reasoning: a reward request carried only `catalogId`. Both gaps were reproduced on PostgreSQL over the chain before this checkpoint (first check group below).

## S07.5 implementation and rationale (D.17, D.18)

Six migrations, in this order after the S07.4 migrations (descriptive names; the orchestrator assigns the final numbers at merge):
1. `family_autonomy_ladder` (expand): the tables, the thresholds and the actionable-reason rule;
2. `family_autonomy_rules` (expand): the level in force, the eligibility rule, and the guards of the decision record and of level requests;
3. `family_autonomy_flows` (expand): who may move a level;
4. `family_decision_guards` (`contract`): the task guard;
5. `family_decision_flows` (`contract`): the redemption guard and the flows;
6. `family_talk_nudges` (expand): the nudge, the step-down and the metrics.

The work is split in six because the operator transport (`railway-migrate.test.mjs`) refuses a file over the Windows command-line limit, the limit S07.1 and S07.4 met: the first draft was two files of 57 KB and 38 KB. The task, redemption, completion-day and streak-day functions are redefined. Each keeps every S07.1-S07.4 rule word for word and only adds to it. The S07.1 and S07.2 verifiers re-ran every check over the whole chain to prove it (below). The two `contract` parts ship with, never ahead of, the S07.5 Core release: the current Core's optional-reason cancel and its bare deny call are refused by design. `database/types/database.ts` was not hand-edited.

The documented rule is `docs/operations/FAMILY-INDEPENDENCE-AND-DECISIONS.md`; every number is in the Block D threshold log (20 new keys).

### The decision record (D.18, and D.17's track record)

- **Every decision is one immutable row** in `family_decisions`: the subject (a chore, a reward request or a level request), the state it was taken from (read from the subject, never trusted), the outcome, who decided, and for every "not yet" a reason code and a reason. Ten outcomes: approved, self-logged, pre-approved, sent back, cancelled, denied, granted, declined, and a Tutor's later look, confirmed or questioned.
- **Every writer is covered.** A Tutor's approval through the S07.1 path (a direct guardian update) records its own decision in a trigger, so the track record never misses a yes. A "not yet" cannot be recorded that way, because it needs the reason. A deferred check refuses a decision row whose state change did not happen, and the task and redemption guards refuse a state change without its decision. No browser or service-role write reaches the table; only the flows write it.
- **Backfill (OD-9).** Past approvals and past reward decisions became legacy rows before the guard existed, so a child's record starts from their real history. A past bare cancellation was not turned into a denial: nobody can tell whether the chore had been marked done.

### D.18: no "not yet" without a reason the child can act on

- **Chores.** A chore marked done can be approved, **sent back** (it returns to open with no completion day, and the practised streak day is taken back, as a cancellation already did), or cancelled. Sending back and cancelling need a task code (not finished, needs a redo, not a good fit, let's talk first) and a reason.
- **Rewards.** A denial needs a reward code (save more first, later on a date, not a good fit, let's talk first) and a reason. "Later" needs the date to ask again, from tomorrow to 90 days ahead. The legacy `decide_redemption(..., false, ...)` now refuses. The approval path of that function is unchanged, and it records its decision.
- **Actionable, not just present.** The reason must be 12 to 240 characters with at least three different words, and never a brush-off: "not now", "maybe later", "because I said so", "ahora no", "porque sí", "agora não" and 50 more. Normalization is accent- and case-proof, and never depends on the database locale. The same verdict is computed by the database (`family_reason_actionable`), Core and the client, and all three are pinned to `database/scripts/fixtures/denial-reasons.json` (55 cases in three languages). A structural check cannot judge meaning, so the human-scored sample below measures that.
- **The child's own reasoning reaches the Tutor at the moment of decision:**
  - a note when marking a chore done;
  - why they want a reward: a closed set a young child can tap, required, plus an optional note;
  - a note on a level request.

  None of it can be edited afterwards.
- **The child reads every decision:** the outcome, the reason, the code and the date to ask again. They can press "Let's talk" on any "not yet", which opens a card for the Tutor (the child starts the conversation too, Appendix G §4.2).
- **"Talk about it".** Three "not yet"s within 14 days open a "Time to talk" card for the Tutor, at most once per 14 days per child, with a one-line suggestion. The Tutor closes it as "we talked" or "not now". The database writes it when the pattern happens, so no flow can forget it.

### D.17: a graduated-autonomy ladder

- **Three levels** for every child in a family: a parent-created child, or a linked teen. The ladder follows the child's age and record, never their role. An unlinked teen has no ladder, because their personal wallet already has no approval step (OD-3 Option B).
  - Level 1, "Ask first": the previous flat model. Every child starts here.
  - Level 2, "Small steps": family contributions (D.10) are **self-logged**, meaning approved at once by the child under their level. Rewards up to the Tutor's pre-approved amount (at most 20 coins) are approved and paid with no tap.
  - Level 3, "Trusted": every chore up to 100 coins is self-logged. A chore that asks for a photo self-logs only once the photo is in. Rewards up to the pre-approved amount (at most 100 coins) need no tap.

  At every level the spending limit and the hold still stop a pre-approved reward. They are the safety boundary Appendix G §4.4 reserves for the parent.
- **The rule, with the child's own numbers.** Level 2 needs age 8+, 10 approved in 60 days and at most 1 in 4 not approved. Level 3 needs age 12+, 20 approved, at most 1 in 5, and 28 days on Level 2. A cancel of a chore never marked done does not count against the child. A "not yet" to a level request never counts: asking to grow is not a failure. A parent-created child with no birth date stays on Level 1 until the Tutor adds one (the conservative default).
- **The level in force is capped by age at use.** If a birth date changes, the level and the amount fall back to what the age allows, whatever is stored. The database checks this every time a chore or a reward goes through without a Tutor.
- **Who moves a level.** The database enforces it for every writer:
  - a verified Tutor moves up only when the rule is met, and down only with a reason code and an actionable reason;
  - the child asks for the next level (optionally in their own words), and may step down on their own;
  - staff with `manage_support` lower a level with a reason (the product-team rollback, `POST /api/v1/admin/family-autonomy/:kidId/lower`);
  - the system steps a level down by one when a Tutor questions three self-directed items within 30 days, following the Appendix D demotion precedent.

  Nobody else can move a level, and no writer can forge a system change. A level row cannot move without its change row, and a change row without its level row is refused at commit.
- **Afterwards.** Every self-directed item appears in the Tutor's queue, "Done on their own", for 30 days. The Tutor answers "Looks good" or "Ask about it" (a question needs an actionable reason, and the child reads it). Coins already moved stay where they are; a correction is the audited S07.1 Tutor correction.
- **Measured.** First-eligible moments are recorded after every decision and by the nightly sweep in `insights-maintenance.yml` (a birthday opens a level without any decision). A promotion always records its own.

### Measured (Appendix H, all Diagnostic)

- **Independence-Tier Progression Rate** (`GET /api/v1/admin/family/autonomy-progression`): of the children first eligible for a level, how many reached it within 30 days, and how many are still inside the window. It also reports the step-downs by who lowered the level, which is the rollback path in use.
- **Repeated-Denial Communication-Nudge Trigger Rate** (`/talk-nudges`): the qualifying patterns are recomputed from the decision record alone, as episodes of three "not yet"s in 14 days no sooner than 14 days apart, and compared with the nudges that opened in the same transaction. It also counts child asks and how nudges were closed.
- **Denial-Reason Actionability Rate** (`/denial-actionability`, with `/denial-reasons/sample` and `POST /denial-reasons/:id/score`): staff with `view_analytics` score a random sample. The sample carries the reason, its code and an opaque id only, and only for children the H.1 analytics gate admits. The structural compliance of every "not yet" is reported next to the human score.

### Rebuilt surfaces and mounting

The surfaces live in `frontend/src/rebuild/family/`:
- `NotYetForm`, `DecisionQueue`, `AutonomyLadder` (the Tutor);
- `MyLevel`, `DecisionNotes`, `ChoreDone` and `RewardAsk` (the child);
- the API layer `familyAutonomyApi.ts`. It shape-checks every response: an "eligible" that contradicts its own conditions, an amount over the cap, and a "not yet" without its reason are all refused, never shown.

They import nothing legacy and use the S07.1 injected transport. The copy lives in `i18n/<locale>/familyAutonomy.json`, checked for:
- key parity and the Copy Budget role of every key;
- the youngest band (6-9) for the child's surfaces and adult for the Tutor's;
- the 6-9 first-view budget;
- the glossary (coins, never money; Tutor only for the parent; approve, never accept; no freeze, no percentage);
- no exclamation mark. A new level is not an OD-7 milestone, so nothing celebrates.

Mounting, through route wrappers:
- `DecisionQueuePanel` sits at the top of the Tutor's Tasks page. It replaces the legacy approve, cancel and deny buttons, which could not carry a reason.
- `AutonomyLadderPanel` sits on each child's card on the Family page.
- `MyLevelPanel`, `DecisionNotesPanel`, `ChoreDonePanel` (replacing "Mark done") and `RewardAskPanel` (replacing the reward request button) sit on the child's Tasks page.

The legacy task list stays as a read-only history. Its strings are left for the wave-2 cleanup.

## S07.5 decisions taken on the SPEC's conservative default (proposals for owner review)

1. **Three levels**, the Definition of Done's minimum of two beyond the flat model: Level 1 is the old model, then "Small steps" and "Trusted". Level names and every threshold are Engineering proposals (all 20 keys in the threshold log). Appendix G supports gradual, volitional fading, but gives no number.
2. **No automatic promotion.** Meeting the rule only makes a level available; a Tutor decides, and the child can ask (Appendix G §2.5; Beyers et al. 2024).
3. **What stays unilateral at every level:** the spending limit, the hold, and a chore worth more than 100 coins.
4. **Unknown age means Level 1.** A parent-created child without a birth date cannot move up until the Tutor adds one.
5. **The system steps down** one level after three questioned self-directed items in 30 days (at most once per 30 days), following the Appendix D demotion precedent. The child reads "Back to Level N for now. Try again soon." Whether an automatic step-down is wanted at all is an owner question.
6. **Self-directed coins are not clawed back** when a Tutor questions an item. The coins stay where they are; the Tutor can use the audited correction.
7. **What counts as "not approved":** sent back, denied, questioned, and cancelled after "done". A cancelled open chore and a declined level request do not count.
8. **The actionable-reason rule is structural** (length, three different words, a brush-off list in three languages). The human-scored sample decides whether it is enough.
9. **A child counter-proposal** (Appendix G §4.4's negotiation surface) is not built. The child's voice here is their reason on every request, their ask for a level, and "Let's talk". A structured counter-offer is an owner question.
10. **The "talk about it" pattern is three "not yet"s in 14 days**, at most one card per 14 days per child. The child's own "Let's talk" has no limit beyond one per decision.
11. **Staff read reasons only in the consent-gated sample.** The text is written by a Tutor about their child, so the sample carries no identity beyond an opaque id and only admits children the H.1 gate admits. Safety should review whether staff may read these reasons at all.
12. **The decision record lives as long as its chore, reward or request.** Whether reasons are pruned earlier is D.21's written retention policy.

## S07.5 verification log

Executed 24 September 2026 (the lane's verification date) in the S07 worktree, first-hand, on the tree being committed. Commands are relative to the named directory. Local results only, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Physical PostgreSQL, S07.5 | Lane cluster (PostgreSQL 17.6, `.lane-cache/pg`, port 15507); root: `python database/scripts/verify-autonomy-decisions-postgres.py` with `LF_PG_BIN/PORT/USER/DATA`; the cluster was stopped with `pg_ctl stop -m fast` afterwards | Passed, 16 check groups. Report: `audit-results/s07-autonomy-decisions-postgres.json`. Details below this table |
| Physical PostgreSQL, S07.1 and S07.2 over the whole chain | Root: `LF_PG_FULL_CHAIN=1 python database/scripts/verify-family-state-machine-postgres.py` and `LF_PG_FULL_CHAIN=1 python database/scripts/verify-teen-wallet-postgres.py` | Both passed all their check groups (14 and 17) through the last S07.5 migration. The redefined task, redemption, completion-day and streak-day functions keep every S07.1 and S07.2 rule, and the S07.1 direct approvals still pass because they now record their own decision |
| Physical PostgreSQL, S07.4 | Root: `python database/scripts/verify-money-habits-postgres.py` | Passed, 14 check groups (its own chain, unchanged) |
| Core adversarial | `backend/`: `npx vitest run src/__tests__/familyAutonomy.test.ts src/__tests__/tasks.test.ts src/__tests__/blockDThresholds.test.ts` | 48 new adversarial tests pass (`familyAutonomy.test.ts`). In `tasks.test.ts`, 23 tests were rewritten for the decision flows and 2 added (a cancel and a reward request without a reason are refused before any write). The threshold test gains one. Coverage: every child route is refused to an unlinked teen, an adult, a guest, a parent and staff; every Tutor route is refused to the six non-parent populations, and a stranger gets 404, all before any write; the caller, never a body field, is the child and the actor; each "not yet" body (no code, no reason, a wrong code, "Not now", "Ahora no", "porque sim", a repeated word, a date on the wrong code, a date outside 1-90 days) is refused before any write; a lowering without an actionable reason and an amount over the cap are refused; every database refusal is mapped; a transport failure or a surprising answer is never reported as success; a queue that cannot be read in full is refused (502); support-only rollback; analytics-only metrics with null rates for empty populations; a sample without identity |
| Core regression | `backend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 77 files (+1 skipped), 1,797 tests + 1 documented skip |
| Frontend regression | `frontend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 226 files, 2,388 tests. The 30 new tests: 17 surface, parity and API-shape, 13 copy |
| Real Chrome matrix | `frontend/`: `FAMILY_AUTONOMY_URL=http://localhost:5340 node scripts/verify-family-autonomy.mjs` (dev server with `VITE_CACHE_DIR` in the lane cache, stopped afterwards) | 12 of 12 configurations (EN/es-MX/pt-BR × light/dark × 375/1280). 96 captures and `report.json` in `audit-results/family-autonomy/`. Journey steps below this table |
| Static migration gates | `database/`: `npm test`, and `node scripts/railway-migrate.test.mjs` re-run on its own | Passed. 135 files pass the numbering, RLS and phase checks (101 expand, 34 contract, 23 contract pending). The lifecycle gate covers 55 states across 13 columns. 28 of 28 node tests pass. The operator transport passes its 12 scenarios with all six S07.5 files (`railway-migrate integration OK`); see the failures below for the runs that did not count |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check` (after staging, so the new files are scanned), `bash agent/tools/check-i18n.sh` (Git Bash), `npm run tools:test`, `node agent/tools/check-block-d-thresholds.mjs` | Passed: spec authority, tokens and assets OK; no credential patterns; i18n file and key parity, no hardcoded strings, every static key present; 62 of 62 tool tests; 45 thresholds agree (20 new) |

**PostgreSQL S07.5 check groups (16):**
- **Gaps reproduced** on the chain before the first S07.5 migration: no decision record, level or nudge; a Tutor cancels a chore the child marked done with no reason at all, and denies a reward with no reason.
- **Backfill (OD-9):** the approved chore and the denied reward from before became legacy decision rows, and their subjects point at them.
- **The actionable-reason rule** matches the shared fixture for all 55 cases.
- **Chores (D.18):**
  - the child's note is kept and cannot be edited;
  - send-back and cancel need a task code and an actionable reason, and are refused for none, "Not now", a reward code, a stranger and the child;
  - a sent-back chore is open again with no completion day, and its practised day is taken back;
  - a direct service-role cancel or send-back without a decision is refused;
  - the S07.1 direct approval records its own decision.
- **Rewards (D.18):**
  - the child's reason is required and immutable;
  - the legacy bare denial is refused;
  - a denial needs a reward code and an actionable reason;
  - "later" needs a date 1-90 days ahead;
  - a denial moves no coins, and the legacy approval pays and records itself.
- **The decision record resists every writer:** no service-role or browser insert. Even a superuser cannot edit a decision, forge a legacy row, record a decision without its state change (refused at commit), or attach one to another child. The child and the Tutor read it; a stranger and another child do not.
- **Eligibility (D.17):**
  - every child starts on Level 1;
  - the 9-year-old is refused at 5 approved and 4 not approved, then eligible at exactly the 25% boundary (12 and 4);
  - the 7-year-old is refused by age;
  - a child with no birth date is refused until one is added;
  - a stranger and the child cannot promote;
  - the amount is capped at 20;
  - Level 3 is refused without 28 days on Level 2.
- **Level 2:**
  - a contribution is self-logged, while a bonus chore waits;
  - a forged self-logged bonus chore is refused by the task guard;
  - a reward inside the amount is paid with no tap, one above it waits, and a forged pre-approval is refused;
  - the spending limit and the hold still stop a pre-approved reward.
- **Level 3:**
  - eligible on day 29, not on day 0, and the cap is 100;
  - a 100-coin chore self-logs and a 150-coin one waits;
  - a photo chore waits until the photo is in;
  - a birth date changed to 11 drops the level in force to 2 at once.
- **Afterwards and rollback:**
  - reviews happen once, and a question needs a reason;
  - the third question in 30 days steps the level down 3 to 2 (a system change), and a forged system change is refused;
  - a Tutor lowers a level only with a reason;
  - the child steps down but never up;
  - staff lower a level only with `manage_support` (analytics-only, no-grant admins and a parent are refused), only downward, and only with a reason.
- **The child's voice:**
  - one pending ask;
  - "not yet" to it needs a level code and a reason;
  - a grant only when eligible, and a direct promotion grants the pending ask;
  - an unlinked teen, an adult and a guest have no ladder, while a linked teen climbs it.
- **Level tables:** no service-role or browser write. A superuser cannot write a level without its change, a change without its level, or edit a change. RLS reads for the party only; no browser reads the eligibility log.
- **Concurrency:** 8 simultaneous pre-approved 10-coin requests against 20 coins give exactly 2 paid and 6 waiting, and Spend ends at 0.
- **"Talk about it":**
  - the third "not yet" in 14 days opens one nudge and the fourth adds none;
  - an open-chore cancel is not a denial;
  - the child's ask is idempotent, never about a yes or another child's decision;
  - no forged pattern nudge, even by a superuser;
  - only a Tutor closes a nudge, once.
- **Replay** of the six migrations preserved every row (87/10/4/4/5) and every refusal.
- **Metrics on a crafted, backdated timeline:**
  - progression `2=3/1/1 3=0/0/0`;
  - step-downs `child=0 staff=0 system=1 tutor=1`;
  - nudge rate `2/1/1/1/0/1` (a missing nudge is detected);
  - actionability `9/9/8/4/3`;
  - the sample excludes the under-13 child and carries no identity;
  - only `view_analytics` staff score, once per reason.

**Browser matrix journey (each configuration):**
1. Tutor, Tasks, the decision queue:
   - the child's note and reason are shown next to their chore and reward;
   - "Send back" with no code, then with "Not now", is refused locally with no request, and an actionable reason is sent with the exact body;
   - a reward "Not yet" with "later" carries its date (exact body);
   - the "Time to talk" card closes as "we talked", and "Done on their own" is confirmed (exact bodies).
2. Tutor, Family, the ladder:
   - the rule is shown with the child's numbers ("12 of 10 approved in 60 days");
   - "Move up" (exact body);
   - the amount is raised twice within the cap and saved;
   - "Move down" needs a reason, then sends it (exact body).
3. Child, Tasks:
   - my level ("Level 2: Small steps", "Rewards up to 10 coins need no asking.", "7 of 20 to Trusted"), with no percentage;
   - asking for the next level in my words (exact body);
   - a "not yet" with its reason and date, and "Let's talk" sent once;
   - a chore marked done with my note;
   - a reward asked for only with a reason (refused locally without one), approved by my level (exact body).

Every configuration had zero axe violations, no panel overflow or page scroll, 48 px targets, a copy role on every text node, no celebration element and zero browser errors. Seven captures were inspected in this session:
- es-MX dark 375, the child's level, with the note being written;
- en-US dark 375, the Tutor's reason form (before and after the fix below);
- pt-BR dark 375, the reason form after the fix;
- pt-BR dark 1280, the ladder with every condition met;
- es-MX light 375, the reward reason;
- en-US light 1280, the child's notes.

**Failures and their resolution:**
- **The verifier's own first mistakes.** An admin role cannot be granted without a superadmin on the company domain, so the staff fixtures bypass that chain for setup only. The first record expectation forgot the backfilled legacy decisions. A metric timeline written in two transactions had two different `now()` values. The replay check reused a decided chore. `information_schema.routine_columns` does not exist on PostgreSQL 17, so the check uses `pg_get_function_result` instead.
- **A real leak, found by the verifier.** `family_talk_request` returned an existing child nudge for any caller who named its decision, so another child's "Let's talk" id could be read. The lookup now also requires the child to match, and the guard refuses a mismatch (`TALK_NUDGE_INVALID`).
- **Transport size.** The first draft was two migrations of 57 KB and 38 KB. `railway-migrate.test.mjs` refused the first (`Argument list too long`), so the work is now six files, each at most 22 KB. A later transport run reported "migration drift" because a migration was edited while the test ran, and another run of `npm test` ended with exit 127 and no transport output. Only the clean stand-alone re-run is recorded as the result.
- **Threshold keys with digits.** The Block D gate and its test read only `[a-z_.]` keys, so `autonomy.level2_*` was invisible. Both now read `[a-z0-9_.]`. The last key of the thresholds object had no trailing comma, so every key got one (a non-threshold `thresholds_version` closes the object).
- **Copy.** The child's level view (31 words) and the reward-reason view (31) exceeded the 25-word first-view budget. The level name became the heading, the unlock and pre-approval lines were shortened, and the reason options were cut to two or three words.
- **Matrix findings:**
  - text typed into a textarea had no copy role (the user's own words now carry `data`);
  - an error message with an apostrophe broke the helper's generated script;
  - clicks landed on moving targets while panels above were still loading, so the helper now waits for a stable box;
  - in dark mode the unselected reason options were invisible on the form's fill (a more specific list-row rule won), so their fill now wins.
- **A legacy test.** `FamilyPage.test.tsx` mocks every per-child panel and needed the new ladder panel mocked too.

**Cross-lane findings (not changed here):**
- **D.23.** Its reflective prompt ("what would you tell your kid about this decision?") belongs on this decision surface. The API already accepts an optional note on a yes; the prompt and its metric are D.23's work.
- **D.21.** Decision reasons live as long as their chore, reward or request. Their retention belongs to D.21's written policy.
- **Staff console.** The support rollback is served by the API only. A console surface belongs to the staff console rebuild (Block G).
- **H.1 / A.2.** The actionability sample uses the H.1 gate, so a parent-created child under 13 is never sampled (the S07.4 finding).

**Remaining limitations:**
- No full Supabase (PostgREST/GoTrue) stack run of the new routes, triggers and RLS.
- `database.ts` has not been regenerated: five new tables, and new columns on `tasks` and `redemptions`.
- The three diagnostics have no production baseline and no first human-scored sample yet.
- Every threshold is a proposal awaiting Product and Safety review.
- The browser matrix uses a synthetic Core, and a date field is set through its native setter.
- Appendix H Stage 5 (family usability testing: does a denial feel explained, does a level feel earned) has not been run.
- Native review of `familyAutonomy.json` in three locales, and human Product/Safety review of the twelve proposals above.

D.17 and D.18 are not accepted.
