# S07: Family Hub and independent teen wallet

Status: in progress. Started 24 September 2026; S07.2, S07.3 and S07.4 recorded 25 September 2026; S07.5, S07.6, S07.7 and the S07.8 lane review recorded 24 September 2026 (the lane's verification date). The lane summary is at the end of this record. Owner: Engineering for implementation; Product, Safety/Trust and the Block D Engineering Lead (Appendix H Stage 0 pairing) for the reviews named by the SPEC. No release approval is recorded.

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
| S07.6 | D.6 the family-engagement staff insight on the per-child shape, D.7 honest simulation visuals and no unbacked guarantee, D.8 a tone gate for Family Hub and banking copy, D.12 age-differentiated presentation | One database function serves the staff insight per child: counts over every child with a verified Tutor, and per-child rows only for H.1-admitted children, with no identity. Request outcomes and a nightly probe feed Appendix H's Staff Family-Engagement Insight Uptime, and a gate keeps the key contract equal across the database, its probe, Core and the console. Every control a family sees is registered with its enforcing SQL and adversarial proof, and a gate fails when an enforcing function loses its guard, when the UI's freeze holds differ from the database's, or when a payment SDK appears. The written principle and the quarterly audit are in `docs/operations/NO-UNBACKED-GUARANTEE.md`. A tone gate (bank register, guarantee, glossary, shouting; reviewed exceptions; no raw Core message on a family surface) reports the Tone-Gate Pass Rate. The database decides the age register (young, transition, teen) from age evidence as one design with D.11, and Core shapes the child's numbers by it. The register cutoffs are in the Block D log, and the register distribution is served to analytics staff | Rebuilt coin account and Tutor freeze card (`frontend/src/rebuild/banking/`) in three locales and three registers, light/dark, 375/1280 px, mounted in the Banking route in place of the legacy card, freeze switch, banner, meter and statement summary. The usual split, goal progress and bonus explainer are presented per register. The Banking page's dead bare "Deny" is replaced by the reason-carrying queue. The legacy staff console reads the per-child contract | In progress: implementation and local verification recorded (native PostgreSQL over the actual migration chain with the S07.1-S07.5 checks re-run, 54 new Core tests, 41 new component and copy tests, 35 new gate self-tests, 12 real-Chrome configurations). Full Supabase stack run, types regeneration, the first human No-Unbacked-Guarantee Audit and Stage 4 spot-check, family usability testing, native copy review, production baselines and Product acceptance pending |
| S07.7 | D.9 the research foundation, D.19 the older-teen graduation initiative, D.20 what the practice does not teach, D.21 retention, deletion and consent for this Block's data, D.22 long-horizon research instrumentation, D.23 coaching for the Tutor | Appendix G adopted and traced: every D.10-D.23 choice cites its sections with an honest evidence strength and the metric that tests it, recalibrated on Appendices B and D's cadence (release readiness fails when overdue); no parent-facing string in app or marketing copy claims proof; no experiment column on a Block D table (OD-23). The initiative "Beyond the app" is scoped with four milestones and milestone 1 ships: from 15 by age evidence, three real-world moments with just-in-time checklists and a split tool that sends nothing; engagement and a 15+ research cohort served to analytics staff. A scope statement names credit, debt, real compound interest and risk as not taught, each "practises" line backed by code, mounted for Tutors and teens, a gate refusing a lending or interest mechanic without the statement changing, and a quarterly human audit. All 40 Block D tables classed (photos 30 days after the decision, records 400, invitations 30, research 1,100, the coin record for the account's life); a nightly job deletes what is past its period and each photo from Depot first; the compliance audit served to analytics staff; the Tutor reads the enforced periods; an adult's erasure keeps the child's record and a child's removes every row (the merged S08/S07.1 erasure defect fixed). A four-phase research plan and phase 1: separate research consent (a verified Tutor for a child, an adult for themselves, lapsing at 18, a child's no deletes), pseudonymous monthly snapshots with no free text, completeness served to analytics staff. Pricing and limit coaching inside the controls; a reflective prompt before every Tutor decision whose words never leave the browser unless sent, required and recorded by kind; twelve Appendix G tips delivered monthly only after the Pedagogical Lead's review bound to their exact copy | Rebuilt coaching tip, reflective prompt, pricing and limit notes, scope statement, data policy, research answer, the child's own research no and "Beyond the app" (`frontend/src/rebuild/family/`, `rebuild/wallet/MoneyBridge.tsx`) in three locales, light/dark, 375/1280 px, mounted on the Family, Tasks, Banking and wallet routes; the decision queue goes through the prompt; nothing celebrates | In progress: implementation and local verification recorded (native PostgreSQL with 21 new check groups and every S07.1-S07.6 verifier re-run over the whole chain, 56 new Core tests, 33 new component and copy tests, 32 new gate self-tests, 12 real-Chrome configurations plus four earlier matrices re-run). Full Supabase stack run, types regeneration, the owner naming the D.19 and D.22 owners, Legal review of the periods and the research disclosure, the Pedagogical Lead's tip review and first recalibration, the first scope audit, production data, family usability testing, native copy review and Product acceptance pending |
| S07.8 | Lane review of S07.1-S07.7 against D.2-D.23 | Every requirement's SPEC mandate compared with what the code enforces, for every population and path; each gap found fixed, tested and documented (marketing claims overstating the D.17 approval model and inventing a D.14 Share flow, now registered controls with a retired-claims guard; the D.20 statement and the D.21 periods published in the public FAQ and pinned by their gates; an untested D.17 staff route); the complete root gates green | The public FAQ and Families copy in three locales, light/dark, 375/1280 px (real Chrome); no rebuilt surface changed | In progress: review done and locally verified; nothing Accepted; the open items in the lane summary remain |

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
| Physical PostgreSQL, S07.1 regression over the whole chain | Root: the same variables plus `LF_PG_FULL_CHAIN=1 LF_PG_REPORT=audit-results/s07-family-state-postgres-full-chain.json python database/scripts/verify-family-state-machine-postgres.py`. This new mode runs every S07.1 check with the S07.2 redefinitions applied and replays every migration from the first S07.1 part on. Also run in the default mode | Both passed all 15 S07.1 check groups (`applied_through` 0121 and 0116 respectively, the lane's numbering; 0156 and 0151 since the S07 merge) |
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

## S07.6: current state found (verified against the code, 24 September 2026)

The SPEC's "Current State" was accurate for D.6 and D.8, partly stale for D.7 and D.12, and the code held two further defects the SPEC did not name.

- **D.6 confirmed.** 0074 redefined `insights_family_engagement` per child: `kid_user_id`, `first_guardian_link_at`, `guardians`, `tasks_created`, `tasks_approved`, `last_task_at`. Core's `readFamilyEngagement` still parsed `family_id`, `family_created_at`, `members`, `tasks_completed`, so every row failed validation and `GET /api/v1/admin/insights/families` answered "Family views unreachable" for every request since 0074. The console kept typing the old shape. The PostgreSQL verifier reproduces the column mismatch on the chain before S07.6. A Core test reproduces the refusal: the legacy shape is now a recorded `shape_mismatch`, never served.
- **D.7 partly stale.** D.1's enforcement is real (S02, and S07.1-S07.5 keep it for every writer), so the concern is presentation. The legacy Banking page still showed:
  - a card with a monospace `LF-####-####` number;
  - the freeze as a switch inside a "Card details" dialog, with a hint that understated what it holds;
  - "Your credits stay safe";
  - "A parent/guardian froze this card".

  Two defects were **not in the SPEC**:
  - the spending limit read "Weekly" and "Resets: Every week", while the database counts a rolling 7 or 30 days and checks at request time;
  - since S07.5 the Tutor's Banking page offered a bare "Deny" that the server always refuses (a denial needs an actionable reason, D.18), with no error shown. A control displayed as working and not backed is exactly D.7's failure.
- **D.8 confirmed.** No gate screened this Block's copy. B.14's Forge tone gate is not built in this branch either (S05 lane, Open).
- **D.12 partly stale.** D.11 (S07.3) already framed the savings bonus by age. Everything else was presented identically to a 7-year-old and a 17-year-old:
  - every rebuilt child surface was written to the 6-9 band;
  - the usual split read "out of 10" for a teen;
  - the legacy Banking page showed the same card, limit and statement to everyone.

## S07.6 implementation and rationale (D.6, D.7, D.8, D.12)

Two expand migrations, in this order after the S07.5 migrations (descriptive names; the orchestrator assigns the final numbers at merge):
1. `family_money_register` (D.12);
2. `family_engagement_insight` (D.6).

Neither redefines an earlier function, so the S07.1-S07.5 verifiers were re-run over the whole chain only to prove nothing regressed. `database/types/database.ts` was not hand-edited.

### D.6: the staff insight on the per-child shape

- **One database function serves it.** `family_engagement_insight(p_limit, p_active_days)` reads the per-child view, which stays the single definition of engagement per child. It answers two things:
  - a **summary** over every child with a verified Tutor: children, children with chores, children active in 30 days, chores created and approved. These are bookkeeping counts, so no consent is needed for a number no one can trace to a child;
  - **per-child rows**, only for children the H.1 analytics gate admits (`family_analytics_admitted`, the gate every Block D behavioural diagnostic uses). The rows carry Tutors, chores created and approved, and the first link and last chore by day. They have **no identity**: no child id, no Tutor id.

  Revoking consent removes the row at once. Out-of-range limits and windows are refused.
- **Core** (`readFamilyEngagementInsight`) parses it strictly. A row carrying an extra key, such as a smuggled id, is refused. "The database did not answer" (`unavailable`) is told apart from "it answered in another shape" (`shape_mismatch`, the D.6 failure mode). The route returns `{ summary, children, consent }`.
- **Uptime (Appendix H: Staff Family-Engagement Insight Uptime, target 100%).** Two sources are recorded in `staff_insight_checks`, which uses closed vocabularies, holds no identity, and has no browser or service-role table access (only two functions write it):
  - every staff request's outcome, recorded best-effort by Core;
  - a nightly probe (`probe_family_engagement_insight`, called by `insights-maintenance.yml`, guarded) that calls the same function and checks the contract keys. It keeps 400 days.

  `GET /api/v1/admin/family/engagement-uptime` (analytics staff) reports each source's checks and successes. An empty window is reported as no checks, never as 100%.
- **The contract as a gate.** The keys are written in four places: the function, the probe, Core's parser and the console's types. `agent/tools/check-family-engagement-contract.mjs` fails on any difference, since that difference is how D.6 happened.
- **The console.** It is still the legacy staff console, whose rebuild belongs to Block G. It now reads the per-child contract. Its approval rate comes from the whole population, never from the consented rows. It says that only consented children are listed.

### D.7: no unbacked guarantee

- **The written principle and the human audit.** `docs/operations/NO-UNBACKED-GUARANTEE.md` holds the rules, how a new control is admitted, the quarterly audit checklist and the audit log. The log's first entry is an Engineering pre-audit with 8 findings, which does **not** replace the human audit.
- **The control registry and its gate.** `docs/operations/block-d-controls.json` lists 10 controls, each with its written claim, its enforcement, its adversarial proof and its copy keys:
  - the practice card;
  - the freeze and each of its four holds;
  - who may lift a freeze;
  - the spending limit;
  - the bonus framing;
  - the register.

  `agent/tools/check-no-unbacked-guarantee.mjs` (unfiltered repo gates) fails when:
  - an enforcement or proof disappears;
  - **the latest migration that redefines an enforcing SQL function drops its guard**;
  - Core's or the client's `FREEZE_HOLDS` differ from the registry;
  - a rebuilt surface declares an unregistered `data-control`;
  - a copy key is missing in a locale;
  - any package depends on a payment, card-issuing or bank-linking SDK (the claim "no bank or card behind it" would stop being true).
- **At the server.** The rebuilt account contract (`GET /api/v1/banking/overview`, and the Tutor's `GET /api/v1/banking/accounts/:kidId/freeze`):
  - declares `simulated: true`;
  - carries no card number;
  - lists what a freeze holds from `FREEZE_HOLDS`: reward requests, approvals and pre-approvals; chore and allowance splits; the scheduled allowance and bonus; Share gifts. It lists them whether or not the account is frozen, so the explanation before a freeze is as honest as the one during it;
  - gives `by` relative to the reader, and `canChange`: a child may lift only their own freeze.
- **At the client.** `rebuild/banking/bankingApi.ts` refuses a card that:
  - is not a declared simulation;
  - carries a number;
  - claims a hold nobody enforces;
  - has a freeze without its author;
  - gives a child `canChange` over a Tutor's freeze.
- **The rebuilt surfaces.**
  - `CoinAccount` (child) is a flat practice card in a token hue with its practice label and "coins stay in the app". It shows the holds from the server, "nothing is lost", Unfreeze only for the child's own freeze, the pockets, the limit (said to be checked when a reward is asked for, over the last 7 or 30 days) and this month.
  - `TutorFreeze` (Tutor) shows the same holds, "a freeze moves no coins", who set the freeze, and which age view the child reads. It asks once before freezing.

  Both re-read the state after every change, never assuming it.
- **Mounting.** On the child's Banking page, the rebuilt coin account replaces:
  - the legacy card;
  - the freeze switch (the dialog keeps name and colour only);
  - the frozen banner;
  - the pocket tiles;
  - the limit meter;
  - the statement summary.

  On the Tutor's Banking page, the rebuilt freeze card replaces the switch and the number line. The dead bare "Deny" is replaced by S07.5's reason-carrying decision queue. The Tutor's legacy limit form now says "Counts the last: 7 days / 30 days" and when the limit is checked.

### D.8: the tone gate

`agent/tools/check-family-copy-tone.mjs` with `agent/tools/family-copy-tone.lexicon.json` is D.8's "equivalent review step". B.14 is not built in this branch; its lexicon should be merged with this one when it lands.

- **Scope.** Every Family Hub and banking string in three locales: 7 namespaces, the `tasks`, `banking` and `family` subtrees of `common.json`, and 8 error codes. That is 3,480 strings.
- **Categories.** Each carries a stated reason:
  - bank register (Law 2);
  - guarantee (D.7);
  - the controlled glossary;
  - shouting.
- **Exceptions.** Each names the key, the category and why. The gate fails on an exception that no longer excuses anything.
- **Core's messages.** They are English developer diagnostics a family never reads: every family surface resolves the error code to copy. So the gate fails instead when a Family Hub or banking surface renders a raw `error.message`.
- **The metric.** It prints Appendix H's Tone-Gate Pass Rate; `--report` writes it as JSON.
- **The human step.** The Stage 4 spot-check is written in `docs/operations/FAMILY-COPY-TONE-GATE.md`.
- **The first run found real copy.** 15 family-facing keys were rewritten in all three locales, legacy strings included:
  - "redeem" / "redemption";
  - "Deny" / "Denied";
  - "credits";
  - "stay safe";
  - "guardian";
  - "Rejected".

### D.12: one design, three registers

- **The database decides** (`family_money_register`): `young` (6-9, or age unknown), `transition` (10-12), `teen` (13-17, a self-registered teen, and an 18-year-old still in a family), or NULL for an account with no wallet.
  - It reads age evidence, never role.
  - It returns `teen` exactly when D.11's `savings_bonus_framing` is `percent`, so D.11 and D.12 are one design by construction; the verifier checks this for every population.
  - A birthday moves the register at read time; nothing is stored.
- **Core serves it and shapes by it.** `GET /api/v1/banking/register` serves it to every wallet holder. `GET /api/v1/banking/overview` shapes the child's numbers at the server:
  - young gets what is left of the limit, three month totals, and no cap, used amount, percentage or statement line;
  - transition adds the cap and what was used, given and corrected;
  - teen adds the used percentage and the latest 8 lines.
- **The client never picks a register.** It reads it once per session (`useMoneyRegister`), presents the young register while it loads or when it fails, and refuses an answer carrying numbers its register is not given.
- **Registered surfaces, in three locales** (`coinAccount.json`, `moneyRegister.json`):
  - `CoinAccount`: a copy set per register, with its own tone, numbers and detail, checked against its band's budget;
  - `UsualSplit`: "5 of 10", then "5 of 10" with "so 50 of 100" under it, then "50%";
  - `GoalProgress`: "12 of 30", then "12 of 30, 18 to go", then "12 of 30 (40%)", with provenance unchanged;
  - `SavingsBonusExplainer`: the transition register gains the bridge "1 for every 10 is like 10 for every 100", reaching toward a rate with concrete scaffolding (Appendix G §1.5);
  - `TeenWallet`: always the teen register.

  Every child-facing component declares its policy in `REGISTER_POLICY`, and a test fails when one is added without it. The register-neutral ones carry no ratio and are written to the youngest band's budget, with the reason recorded. The design is `docs/operations/FAMILY-AGE-REGISTERS.md`.
- **Measured.** The cutoffs and the teen's statement lines are in the Block D threshold log (5 new keys across D.6 and D.12). The register distribution (`GET /api/v1/admin/family/register-distribution`, counts only) is served to analytics staff for the recalibration.

## S07.6 decisions taken on the SPEC's conservative default (proposals for owner review)

1. **Staff read per-child engagement rows only for consented children, with no identity.** The population summary counts everyone. Whether staff should read per-child rows at all is a Safety/Privacy question.
2. **Uptime has two sources.** Request outcomes and a nightly probe. A database that cannot be reached cannot record its own outage, so that window rests on the probe's gap and Core's error log.
3. **The register cutoffs are 10 and 13.** Unknown age reads young. An 18-year-old still in a family reads teen.
4. **Numbers per register.** The young register shows no ratio at all (a limit is "what is left"). The transition register uses "out of 100" scaffolding. Only the teen register reads percentages. A teen's pocket percentages always add to 100 (largest remainder).
5. **The teen reads the latest 8 statement lines** on the card.
6. **The register-neutral components keep one copy set,** written to the 6-9 budget. Teen-specific wording for them (for example `MyLevel`) is a proposal, not built.
7. **The practice card shows no number.** The legacy `display_number` column stays until the wave-2 contract migration drops it.
8. **The young register's hold names are simplified.** "Rewards / Splitting coins / New coins / Share gifts" are each true of what the database holds.
9. **A Tutor confirms a freeze; a child does not.** A child's own freeze is theirs to lift at once.
10. **The tone gate's scope excludes Core's developer messages** and fails on any family surface rendering one. The six exceptions are listed with reasons.
11. **Legacy strings were rewritten, not deleted,** to avoid key churn across lanes. Their removal is the wave-2 cleanup.
12. **"Digital Banking" is kept** as the section name (the SPEC's); the page states that it is practice with coins that stay in the app.

## S07.6 verification log

Executed 24 September 2026 (the lane's verification date) in the S07 worktree, first-hand, on the tree being committed. Commands are relative to the named directory. Local results only, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Physical PostgreSQL, S07.6 | Lane cluster (PostgreSQL 17.6, `.lane-cache/pg`, port 15507); root: `python database/scripts/verify-money-presentation-postgres.py` with `LF_PG_BIN/PORT/USER/DATA`; the cluster was stopped with `pg_ctl stop -m fast` afterwards | Passed, 12 check groups. Report: `audit-results/s07-money-presentation-postgres.json`. Details below this table |
| Physical PostgreSQL, S07.1-S07.5 over the whole chain | Root, same cluster: `python database/scripts/verify-autonomy-decisions-postgres.py`, `verify-money-habits-postgres.py`, `verify-chore-streak-bonus-postgres.py`, and `LF_PG_FULL_CHAIN=1` for `verify-family-state-machine-postgres.py` and `verify-teen-wallet-postgres.py` | All passed: 16, 14, 11, 14 and 17 check groups. The two S07.6 migrations change no earlier function, and every earlier check still holds with them in the chain |
| Core adversarial | `backend/`: `npx vitest run src/__tests__/moneyPresentation.test.ts src/__tests__/insights.test.ts src/__tests__/blockDThresholds.test.ts` | 54 new tests (`moneyPresentation.test.ts`), the families test in `insights.test.ts` rewritten to the per-child contract, and one new threshold test. Coverage below this table |
| Core regression | `backend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 78 files (+1 skipped), 1,852 tests + 1 documented skip |
| Frontend regression | `frontend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 228 files, 2,429 tests. 41 new: `CoinAccount.test.tsx` 22 and `coinAccountCopy.test.ts` 19. The D.1 freeze tests (`KidBankingFreeze`, `ParentBankingFreeze`) were rewritten on the rebuilt panels, keeping all five guarantees. The staff console's families fixture is on the per-child shape |
| Real Chrome matrix | `frontend/`: `COIN_ACCOUNT_URL=http://localhost:5340 node scripts/verify-coin-account.mjs` (dev server with `VITE_CACHE_DIR` in the lane cache, stopped afterwards) | 12 of 12 configurations (EN/es-MX/pt-BR × light/dark × 375/1280). 84 captures and `report.json` in `audit-results/coin-account/`. Journey steps below this table |
| Static migration gates | `database/`: `npm test`; `node scripts/railway-migrate.test.mjs` re-run on its own | Passed. 137 files pass the numbering, RLS and phase checks (103 expand, 34 contract, 23 contract pending); the lifecycle gate covers 55 states across 13 columns; 28 of 28 node tests pass. The operator transport passes its 12 scenarios with both S07.6 files (`railway-migrate integration OK`), re-run on its own after the full `npm test` hit my own 900-second timeout during that step (see failures below) |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check` (after staging, so the new files are scanned), `bash agent/tools/check-i18n.sh` (Git Bash), `npm run tools:test`, `node agent/tools/check-block-d-thresholds.mjs`, `node agent/tools/check-no-unbacked-guarantee.mjs`, `node agent/tools/check-family-copy-tone.mjs --report audit-results/s07-family-copy-tone.json`, `node agent/tools/check-family-engagement-contract.mjs`, `node database/scripts/check-family-lifecycle.mjs` | Passed: spec authority, tokens and assets OK; no credential patterns; i18n file and key parity, no hardcoded strings, every static key present; 97 of 97 tool tests (35 new); 50 thresholds agree (5 new); 10 controls enforced and proved across 68 rebuilt surfaces; 3,480 strings pass the tone gate (100%); the insight keys agree in four places; 55 lifecycle states keep a producer and a consumer |

**PostgreSQL S07.6 check groups (12):**
- **D.6 reproduced** on the chain before S07.6: the view is per child and has none of the per-family keys Core parsed. **D.12 reproduced:** no register existed.
- **The register follows age evidence, never role:**
  - no birth date, 7 and 9 read young;
  - 10 and 12 read transition;
  - 13, 18, an independent teen and a linked teen read teen;
  - an adult, a guest, the Tutor and an unrelated parent have none.
- **One design with D.11:** for every population, teen is exactly the percentage framing, and there is no register without a framing.
- **Birthdays move the register at read time:**
  - 9 to 10 moves young to transition;
  - 12 to 13 moves transition to teen;
  - a birth date added to an unknown-age child moves it too;
  - a role grant changes nothing.
- **The register distribution** counts wallet holders per register (`teen=5, transition=3, young=1`), counts only.
- **No browser or anon session** calls the register or the distribution.
- **The insight on the per-child shape.** The summary counts all 8 linked children (5 with chores, 8 chores, 6 approved, 3 active). The rows list only the 3 children the H.1 gate admits:
  - the 7-year-old is excluded even with consent (the under-13 origin marker);
  - the 10-year-old is excluded without consent.

  Rows come newest first, and the JSON carries no id.
- **Consent and bounds.** Revoking consent removes the row at once while the population count stays. The limit is honoured, and five out-of-range calls are refused.
- **The uptime record resists every writer.** No browser or anon session calls the four functions. No browser or service-role session touches the table. The recorder refuses an outcome or insight outside the closed vocabulary.
- **The probe** answers:
  - `ok` on the real insight;
  - `shape_mismatch` when the insight answers without the contract keys;
  - `unavailable` when the view under it is gone.

  It prunes checks older than 400 days.
- **Uptime per source over a window** reads `probe=1/1/ok, request=2/1/shape_mismatch`. An empty window reports zero checks, never 100%.
- **Replay** of both migrations keeps every check row and every answer.

**Core coverage (54 new tests):**
- **Thresholds and shaping.** The teen register's age equals D.11's. The migration's register function never reads a role. Limits and months are shaped per register. The freeze author is relative to the reader, and an unattributed freeze is a Tutor's.
- **`/banking/register`:**
  - served to a parent-created child, a linked teen and an independent teen from the database;
  - refused to an adult, a guest, a parent and staff before any read;
  - a register the client names is ignored;
  - an unreadable register is a 502, never guessed;
  - an account with no wallet is refused.
- **`/banking/overview`:**
  - refused to an unlinked teen, an adult, a guest, a parent and staff before any account read;
  - a declared simulation with no card number, even when the row has one;
  - every real hold is listed;
  - a child may lift only their own freeze;
  - each register's exact keys (no ratio, percentage or line list for young, no percentage for transition);
  - 502 when the register, the account, the limit or the credits cannot be read;
  - no card before one is opened.
- **`/banking/accounts/:kidId/freeze`:**
  - refused to the child, a linked teen, an unlinked teen, an adult, a guest and staff;
  - 404 for an unrelated parent before any read;
  - the author relative to the Tutor, and the child's register;
  - a malformed id is 400.
- **`/admin/insights/families`:**
  - the per-child shape, with its outcome recorded and no id;
  - the legacy per-family shape is a recorded `shape_mismatch` and never served;
  - a row smuggling an id is refused;
  - an unreachable database is a recorded `unavailable`;
  - refused to support-only staff, a parent, a child and an adult before any read;
  - the contract keys are pinned.
- **Metrics.** Uptime per source with no rate for an empty window. The register distribution, with no share for an empty population. Both analytics-only. A malformed uptime answer is a 502.

**Browser matrix journey (each configuration):**
1. **Child, young register.**
   - The practice card and "coins stay in the app", with no card number anywhere on the page.
   - The four holds from the server; "what is left" of the limit and when it is checked; no percentage.
   - Freeze (exact body), "You froze it.", the informational notice, then Unfreeze (exact body).
   - The usual split reads "5 of 10" with no percentage.
2. **Child, transition register.** Used of the cap over the last 7 days and "of your 40" totals, with no percentage. The bonus's "out of 100" bridge. The usual split "5 of 10" over "so 50 of 100".
3. **Linked teen, teen register, a Tutor's freeze.** The limit with its percentage and the statement lines. "Your Tutor froze it." and "Only your Tutor can lift it.", with no Unfreeze button.
4. **Tutor.** "Nico sees the ages 6-9 view.", "A freeze moves no coins.", a confirmation before freezing with no request sent, then Freeze (exact body) and "You froze it."

Every configuration had:
- zero axe violations;
- no panel overflow or page scroll;
- 48 px targets;
- a copy role on every text node;
- only registered `data-control` values;
- no celebration element;
- zero browser errors.

Captures inspected in this session:
- en-US light 375, young;
- es-MX dark 375, transition;
- pt-BR dark 1280, teen with a Tutor's freeze (before the fixes below);
- en-US dark 1280, teen (after);
- en-US light 375 and es-MX light 375, the Tutor's confirmation;
- pt-BR light 375, the transition split (before and after the fix below).

**Failures and their resolution:**
- **Line endings.** Python's `write_text` on this host (and once the file tool) wrote CRLF into several LF files. All were normalised before any commit, and every later edit writes bytes.
- **Test and gate mistakes of my own:**
  - a regex literal broken by that conversion;
  - an expected pocket total;
  - an error body read as `undefined` instead of the envelope's `null`;
  - a PL/pgSQL fixture written as SQL (validated at creation);
  - a verifier cut at the wrong migration;
  - a service-role count on a table it correctly cannot read;
  - the registry gate reading a `REVOKE ... ON FUNCTION` as a definition, which is now fixed to `CREATE [OR REPLACE] FUNCTION` only and pinned by a test;
  - backspace characters injected into a regex by an unescaped Python string.
- **A real finding by the tone gate's first run.** 15 family-facing keys in three locales used bank register, "safe", "guardian" or "rejected". They were rewritten (see D.8).
- **Real findings from looking at the captures:**
  - the teen read "Your Tutor froze it." twice, so the second line became "Only your Tutor can lift it.";
  - the teen's pocket percentages added to 101, now fixed by largest-remainder rounding with a test;
  - the Tutor's confirmation squeezed its prompt beside its buttons at 375 px, so it now stacks;
  - the transition split wrapped its long count line, so "so 50 of 100" now sits on its own line under "5 of 10".
- **Consequences of the new design, caught by existing tests:**
  - `designClasses.test.ts` caught a class with no rule;
  - the old hold name in the freeze test;
  - the Block D threshold gate's own test now sees two failures when the 13-year cutoff moves alone, because the register and the bonus share it, which is intended.
- **The first `npm test` in `database/`** hit my own 900-second `timeout` inside the operator transport test (exit 124) after every other step passed. The transport test was re-run on its own (row above). A killed run is not counted as evidence.

**Cross-lane findings (not changed here):**
- **B.14 (S05).** This gate's lexicon should be merged with Forge's lesson tone gate when it lands.
- **B.23 (S05).** The "graduation" moment around 10-12 is B.23's to design. The Family Hub register changes silently.
- **H.1 / A.2.** The per-child staff rows use the H.1 gate, so a parent-created child under 13 is never listed, the same finding as S07.4 and S07.5.
- **Block G.** The staff console is still legacy. The uptime metric is served by the API only, and a console surface belongs to the console rebuild.
- **Legacy nav.** The learner navigation still reads "AI Tutor" (glossary: Mentor). That belongs to another lane's shell work.

**Remaining limitations:**
- No full Supabase (PostgREST/GoTrue) stack run of the new routes and functions.
- `database.ts` has not been regenerated: `staff_insight_checks` and five functions.
- No production baseline yet for Staff Family-Engagement Insight Uptime, the register distribution or the Tone-Gate Pass Rate.
- The first human No-Unbacked-Guarantee Audit and the first Stage 4 spot-check have not been done.
- Appendix H Stage 5 family usability testing of the three registers has not been run.
- Native review of `coinAccount.json` and `moneyRegister.json` in three locales.
- The legacy `display_number` column is still stored; its removal is a wave-2 contract migration.
- The browser matrix uses a synthetic Core.
- Product/Safety review of the twelve proposals above.

D.6, D.7, D.8 and D.12 are not accepted.

## S07.7: current state found (verified against the code, 24 September 2026)

The SPEC's "Current State" was accurate for D.9, D.19, D.20, D.21 and D.22 and partly stale for D.23. The code held one further defect the SPEC did not name.

- **D.9 confirmed as a governance gap.** Appendix G exists, but nothing in the code or the docs traced a Block D choice to it, recorded how strong its evidence is, or scheduled a recalibration. Nothing stopped copy from calling a mechanic "proven".
- **D.19 confirmed.** Coins never convert, and nothing in the product speaks to a teen's first real pay, account or budget.
- **D.20 confirmed.** No surface says what the practice does not teach. `marketing.json` makes no credit, debt or investing claim (its only mentions of credit and loans are the Terms' statement that LittleFounders grants none).
- **D.21 confirmed.** Of the 33 Block D tables before S07.7, only two had a retention bound (`family_money_events` and `staff_insight_checks`, 400 days). A chore's photo, every decision reason and child's note, every coin correction's reason and every invitation token were kept forever. **Not in the SPEC:** deleting any Tutor who had used the Family Hub failed on a NO ACTION key (`wallet_ledger_created_by_fkey`). The S08 lane relaxes those keys to ON DELETE SET NULL on the integration branch, and once both lanes are merged the S07.1 ledger guard refuses the cascade's own update with `LEDGER_APPEND_ONLY`. The S07.7 verifier reproduces both on the chain before S07.7.
- **D.22 confirmed.** No instrumentation, no research consent, no plan.
- **D.23 partly stale.** S07.5 (D.18) already made every "not yet" carry an actionable reason and put the child's own words next to each request, and S07.3 (D.10) makes the Tutor choose between a family contribution and a bonus task with a one-line hint. There was no pricing guidance, no reflective prompt for the Tutor and no coaching tip.

## S07.7 implementation and rationale (D.9, D.19, D.20, D.21, D.22, D.23)

Five expand migrations, in this order after the S07.6 migrations (descriptive names; the orchestrator assigns the final numbers at merge):
1. `family_erasure_provenance` (D.21);
2. `parent_coaching` (D.23);
3. `money_bridge` (D.19);
4. `family_research_instrumentation` (D.22);
5. `family_data_retention` (D.21).

They go with, never ahead of, the S07.7 Core release: Core requires `reflection` on every Tutor decision and calls the new functions. `database/types/database.ts` was not hand-edited.

### D.9: Appendix G adopted, traced and recalibrated

- **The foundation.** `docs/operations/BLOCK-D-RESEARCH-FOUNDATION.md` and its registry `block-d-research.json` trace D.10 to D.23 to the Appendix G sections each rests on, with the honest strength of that evidence and the Appendix H metric through which the product's own data can test it. Strengths use a closed vocabulary: supported (D.11, D.12, D.15, D.16, D.18, D.20, D.23), extrapolation (D.10, D.13, D.17), vacuum (D.14), contested (D.19), open (D.22), regulatory (D.21). The weakest rows carry a note so nobody reads them as stronger than they are.
- **Recalibration.** The same cadence as Appendices B and D and the threshold log: quarterly for the first year after release, then yearly, owned by the Pedagogical Lead. The first log entry is Engineering's adoption; the next review is due 2027-01-15.
- **Enforced** by `agent/tools/check-block-d-research.mjs` (unfiltered repo gates). It fails when:
  - a requirement loses its entry, cites a section Appendix G does not have, or names no metric;
  - the written foundation drops a row or understates a strength;
  - the log has no complete dated entry;
  - any parent-facing string claims proof ("scientifically", "is proven", "studies show" and their es-MX and pt-BR equivalents) in the app's Block D namespaces, the shared strings or the marketing site (Block D Part 4);
  - a Block D table gains an experiment, variant or treatment column (OD-23).

  `--strict`, added to `npm run release:readiness`, also fails when the recalibration is overdue; the repo gate only warns, so an overdue review blocks a release, not every push.

### D.19: the older-teen graduation initiative and its first milestone

- **Scope.** `docs/operations/OLDER-TEEN-GRADUATION-INITIATIVE.md` names the initiative ("Beyond the app") with four milestones: the bridge (built), a graduation curriculum in Forge (S05 lane), graduation at 18 (needs owner decisions), and optional real-world linkage (explicitly out of scope until an owner decision, Legal review and a D.7 control entry). The owner must still name its Product owner.
- **Milestone 1, enforced by the database.** `money_bridge_eligible()`: a wallet holder whose stored birth date makes them 15 or older; no birth date, no bridge; never role. `money_bridge_progress` stores only which moment the teen said arrived (step 0) and which steps they ticked (1 to 3); a step waits for its moment; unticking a moment clears it. No amount, bank or account detail can be stored: the split tool that applies the teen's usual split to a real amount runs in the browser (`splitAmount`, whole units by largest remainder) and sends nothing.
- **Surfaces.** `MoneyBridge` on the teen wallet and the child's Banking page, teen register, three moments with three just-in-time steps each ("Check what you got after any deductions", "Ask about fees before you open it", "Save first, then spend"...).
- **Measured.** Real-World Bridge Engagement Rate (`GET /api/v1/admin/family/bridge-engagement`, Diagnostic). Appendix H's Definition of Done (c) is met by the 15+ `bridge_age` cohort in D.22's completeness metric.

### D.20: what the practice does not teach

- **The statement** (`ScopeStatement`): "Practice with coins that stay in the app. No real money moves." It practises earning, splitting, saving toward goals and asking with a reason; it does not teach borrowing, loans or credit cards, debt, real compound interest ("the weekly bonus is not interest"), risk, investing or insurance. "These are hard to teach well, so we leave them out." It is mounted on the Tutor's Family and Banking screens and in the self-registered teen's wallet, in three locales.
- **Kept true** by `check-block-d-scope.mjs` and its registry `block-d-scope.json`. It fails when:
  - one of the four required exclusions is dropped;
  - a line loses its copy in any locale;
  - a "practises" line loses the code that backs it;
  - a mount disappears;
  - a table or column for borrowing, lending, interest, insurance or investing enters the schema without the statement changing first. The gate reads every table and column name the migrations define (588 today, none matching).
- **Human audit.** The quarterly Scope-Disclosure Presence & Accuracy Audit (Appendix H Part 1.3), with its checklist and an Engineering pre-audit entry, is in `docs/operations/BLOCK-D-SCOPE-STATEMENT.md`. "No real money moves" is added to the D.7 `simulation` control.

### D.21: retention, deletion and consent, enforced

- **The policy** (`docs/operations/FAMILY-DATA-RETENTION.md`, registry `block-d-retention.json`) classes all 40 live Block D tables:
  - photos, 30 days after the Tutor's decision;
  - records, 400 days (decisions and reasons, decided chores, answered reward and level requests, level changes, nudges, human scores, the transition audit, settled Share gifts, coin corrections, answered next-goal prompts, coaching records, behaviour events, health checks, retention runs);
  - invitations, 30 days after use or expiry;
  - research snapshots, 1,100 days;
  - the coin record (ledger, pockets, goals, rules, the streak's practised days and pauses, the bridge checklist, consents), for the account's life.
- **The sweep.** `family_retention_sweep()` deletes whole rows past their period; every reference to a deleted row is an ON DELETE SET NULL or CASCADE the S07.1-S07.6 guards already accept, so no balance can move. A decided chore is deleted only once its photo is gone.
- **The photos.** They live in Depot. `family_evidence_due()` lists them (flagging an object another, not-yet-due chore still shares); Core deletes each object and only then calls `family_evidence_cleared()`. The task guard's UPDATE trigger now skips exactly that clear (the four evidence columns to NULL on a chore decided more than 30 days ago) and nothing else. A failed Depot call leaves the pointer for the next night.
- **The job.** `POST /api/v1/family-hub/internal/retention/run` (internal key) runs it and records the run; `.github/workflows/family-retention.yml` calls it nightly at 03:15 UTC and fails loudly when Core reports no run.
- **Measured.** Appendix H's Retention-Policy Compliance Audit (`family_retention_compliance()`, `GET /api/v1/admin/family/retention-compliance`): rows held past their period plus a two-day grace, per class and table. Zero is a pass, and the policy makes it a release check.
- **Families read it.** "Your family's data" on the Family screen shows the periods from `GET /api/v1/family-hub/data-policy`, which serves Core's constants, locale-formatted.
- **Erasure.** `family_erasure_provenance` carries the S08 lane's provenance-key statements verbatim (identical constraint names, safe in either order) and splits four guarded tables' triggers (ledger, redemptions, banking accounts, savings bonus rules) into an unconditional INSERT trigger and an UPDATE trigger whose WHEN clause skips only the cascade's own change (the provenance column set to NULL, nothing else). The guard functions are not redefined, so the D.7 registry's guard checks still read the same bodies. An adult's erasure keeps the child's record; a child's erasure removes every Block D row about them.
- **Enforced** by `check-block-d-retention.mjs`. It follows every CREATE, RENAME and DROP in the chain and fails when:
  - a Block D table has no class;
  - a period differs between the registry, the migration, Core and the copy;
  - a table with a period is missing from the sweep or the audit, or the coin record is swept;
  - a table's erasure cascade is not in its schema;
  - the policy stops naming a table or a period;
  - a nightly job stops calling the work;
  - a Block D field reaches the Mentor's context schema, or a Family Hub surface imports the third-party analytics module (the policy tells families neither happens).

### D.22: the long-horizon research plan and its first phase

- **The plan** (`docs/operations/BLOCK-D-LONGITUDINAL-RESEARCH-PLAN.md`) frames the central hypothesis as an open question and sets a four-phase timeline: instrument, baseline, adult outcomes with the young adult's own yes, external review. It also says what would count against the hypothesis.
- **Observe, never assign (OD-23).** No experiment runs on a minor, and the D.9 gate refuses an assignment column on any Block D table.
- **Consent is separate and specific** (`family_research_consents`, `family_research_set_consent()`, `family_research_admitted()`, disclosure version 1):
  - a verified Tutor may say yes for a child under 18 or of unknown age, and only while still that child's Tutor;
  - an adult may say yes only for themselves; a Tutor's yes lapses at 18;
  - a self-registered teen without a Tutor cannot be enrolled in this phase;
  - a no from the Tutor or from the participant (a child's own no counts) ends the consent and deletes every snapshot at once.
- **The snapshot.** One per participant per complete month that began after the consent, keyed by a random research id: age in whole years, register, tenure, level, coins received, saved, spent and given, goals reached, next goals set, chores approved, rewards asked for and not approved yet, practised days, whether the usual split changed, bridge entries. No name, note, title or free text. Recorded nightly by `insights-maintenance.yml` (guarded, idempotent); kept 1,100 days by the D.21 sweep.
- **Measured.** Longitudinal-Hypothesis Data Completeness (`GET /api/v1/admin/family/research-completeness`, Diagnostic), overall and for the 15+ cohort, with coverage (enrolled of the long-tenure population) and completeness (a snapshot for each of the last 3 months among those enrolled for the whole window). The windows are in the threshold log.
- **Surfaces.** `ResearchConsent` per child on the Family screen (the whole disclosure before a yes; "Stop and delete" asked once) and `MyResearch` for the participant on the child's Banking page and the teen wallet.

### D.23: coaching for the Tutor

- **(a) Inside the controls.** `CoachingNote` puts pricing and contribution-versus-bonus guidance in the chore composer ("Pricing tips") and a structure-with-a-reason note beside the Tutor's spending limit ("Setting a limit").
- **(b) The reflective prompt.** Every Tutor decision in the rebuilt queue (a chore's approval, send-back or removal; a reward's yes or "not yet"; a level request; a self-directed item) starts with `ReflectionStep`: "What would you tell {name} about this?", before and apart from the reason the child reads.
  - The Tutor's words stay in the browser. They may be sent as the note on a yes, or used as the "not yet" reason (the reason form still demands it be actionable).
  - Core requires `reflection` (`written`, `shared` or `skipped`) on every Tutor decision route (`REFLECTION_REQUIRED` before any write) and records it after the decision through `record_decision_reflection()`, matched to the decision that Tutor just made on that subject. `family_decision_reflections` has no text column, and a request carrying the words is refused.
  - The fired rate is served at `GET /api/v1/admin/family/coaching-reflections`.
- **(c) The monthly tip.** Twelve tips drafted from Appendix G (`docs/operations/parent-coaching-tips.json`, each with its section and finding). `parent_coaching_deliver()` gives each Tutor one tip a month on the Family and Tasks screens, never the same one twice until all have been shown, and only from the list Core passes.
  - Core passes a tip only when `COACHING_TIPS` marks it reviewed. `check-parent-coaching-tips.mjs` allows that only when the registry records a Pedagogical Lead approval whose hash matches the tip's exact copy in three locales. No tip is reviewed yet, so none is sent: that is the SPEC's "reviewed before send".
  - The "why" behind each tip says "A finding, not a promise".
  - Parent-Coaching-Tip Delivery & Engagement Rate: `GET /api/v1/admin/family/coaching-delivery?period=YYYY-MM`. It also reports how many tips are reviewed, so "nothing delivered" and "nothing reviewed" stay distinct.

### Registered, measured and documented

- **D.7 registry.** Four new controls with their enforcing SQL or code and adversarial proofs: `research_consent`, `data_retention`, `reflection_private` and `bridge_split_local`.
- **Threshold log.** Four new keys (`bridge.min_age`, `coaching.reflection_window_minutes`, `research.completeness_months`, `research.min_tenure_months`), checked by the threshold gate and Core's test.
- **Tone gate.** The new namespace is in scope, with five reviewed exceptions (the scope statement naming real money, credit cards and insurance; the bridge's advice about a real bank's fees).
- **Register policies.** Declared for the eight new components.
- **README.** The S07.7 migrations, jobs, gates, metrics and matrix.

## S07.7 decisions taken on the SPEC's conservative default (proposals for owner review)

1. **The retention periods:** photos 30 days after the decision; records 400 days (the bound the behaviour stream already uses); invitations 30 days; research snapshots 1,100 days; the coin record for the account's life. They need Product and Legal review (OD-10).
2. **The streak's practised days and pauses are kept for the account's life,** because D.2 promises the best streak and total are never erased.
3. **An adult's erasure keeps the child's record** with the adult's id cleared; a rule the adult set keeps running. The chores and reward list that adult created go with them (the existing cascade the S08 erasure also assumes); the coins those chores earned stay.
4. **`family_state_audit` keeps opaque ids** of an erased account until its 400 days pass.
5. **The bridge opens at 15,** by birth date only.
6. **Research consent is separate from analytics consent:** a Tutor's yes lapses at 18, a child's own no deletes, and a self-registered teen without a Tutor cannot be enrolled in this phase.
7. **The research snapshot's measures** are habit-formation proxies with no free text.
8. **The reflective prompt stores no text,** and the Tutor may send their words as the note or reason.
9. **Tips are delivered in the app only;** an email channel needs an owner decision and consent design.
10. **The claims boundary screens proof claims only;** guarantee language stays with the D.7 and D.8 gates.
11. **The recalibration's overdue check fails release readiness,** not every push.

## S07.7 verification log

Executed 24 September 2026 (the lane's verification date) in the S07 worktree, first-hand, on the tree being committed. Commands are relative to the named directory. Local results only, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Physical PostgreSQL, S07.7 | Lane cluster (PostgreSQL 17.6, `.lane-cache/pg`, port 15507); root: `python database/scripts/verify-family-governance-postgres.py` with `LF_PG_BIN/PORT/USER/DATA`; the cluster was stopped with `pg_ctl stop -m fast` afterwards | Passed, 21 check groups. Report: `audit-results/s07-family-governance-postgres.json`. Details below this table |
| Physical PostgreSQL, S07.1-S07.6 over the whole chain | Root, same cluster, `LF_PG_FULL_CHAIN=1` for `verify-family-state-machine-postgres.py`, `verify-teen-wallet-postgres.py` and, new in S07.7, `verify-chore-streak-bonus-postgres.py`, `verify-money-habits-postgres.py`, `verify-autonomy-decisions-postgres.py`, `verify-money-presentation-postgres.py` | All passed: 14, 17, 11, 14, 16 and 12 check groups, each with every S07.7 migration applied after its own parts. The S07.7 trigger splits change no earlier check |
| Core adversarial | `backend/`: `npx vitest run src/__tests__/familyGovernance.test.ts src/__tests__/blockDThresholds.test.ts src/__tests__/tasks.test.ts src/__tests__/familyAutonomy.test.ts` | 56 new tests (`familyGovernance.test.ts`) and one new threshold test; the S07.5 decision tests send the reflection. Coverage below this table |
| Core regression | `backend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 79 files (+1 skipped), 1,909 tests + 1 documented skip |
| Frontend regression | `frontend/`: `npm run type-check`, `npm run lint`, `npm test` (3 threads) | Passed; 230 files, 2,462 tests. 33 new: `FamilyGovernance.test.tsx` 20 and `familyGovernanceCopy.test.ts` 13. The S07.5 queue tests go through the reflective prompt; `FamilyPage.test.tsx` mocks the new panels like the others |
| Real Chrome matrix, S07.7 | `frontend/`: `FAMILY_GOVERNANCE_URL=http://localhost:5340 node scripts/verify-family-governance.mjs` (dev server with `VITE_CACHE_DIR` in the lane cache, stopped afterwards) | 12 of 12 configurations (EN/es-MX/pt-BR × light/dark × 375/1280). 120 captures and `report.json` in `audit-results/family-governance/`. Journey steps below this table |
| Real Chrome regressions | `frontend/`: `verify-family-autonomy.mjs` (S07.5, updated for the reflective prompt), `verify-coin-account.mjs` (S07.6), `verify-money-habits.mjs` (S07.4), `verify-family-money.mjs` (S07.3, updated to the S07.5 child contract) | 12 of 12 configurations each: S07.5 (the reflection in every body), S07.6, S07.4 (re-run on a quiet machine after one load timeout) and S07.3 (after its two stale points were fixed) |
| Static migration gates | `database/`: `npm test`; `node scripts/railway-migrate.test.mjs` re-run on its own | Passed. 142 files pass the numbering, RLS and phase checks (108 expand, 34 contract, 23 contract pending); the lifecycle gate covers 55 states across 13 columns; 28 of 28 node tests pass. The operator transport passes its 12 scenarios with the five S07.7 files (`railway-migrate integration OK`), re-run on its own with no time limit (see failures below) |
| Repository gates | Root: `npm run spec:check`, `npm run secrets:check` (after staging), `bash agent/tools/check-i18n.sh` (Git Bash), `npm run tools:test`, and each Block D gate: `check-block-d-thresholds.mjs`, `check-no-unbacked-guarantee.mjs`, `check-family-copy-tone.mjs`, `check-family-engagement-contract.mjs`, `database/scripts/check-family-lifecycle.mjs`, and the four new ones `check-block-d-research.mjs` (also `--strict`), `check-block-d-scope.mjs`, `check-block-d-retention.mjs`, `check-parent-coaching-tips.mjs` | Passed: spec authority, tokens and assets OK; no credential patterns; i18n file and key parity, no hardcoded strings, every static key present; 129 of 129 tool tests (32 new); 54 thresholds agree (4 new); 14 controls enforced and proved (4 new) across 76 rebuilt surfaces; 3,873 strings pass the tone gate (100%); the insight keys agree; 55 lifecycle states keep a producer and a consumer; 14 requirements traced, 5,439 parent-facing strings free of proof claims, no experiment column, recalibration not overdue; the scope statement's 4 practised lines and 4 exclusions true and mounted on 3 pages; 40 Block D tables classified; 12 tips drafted, none reviewed or sent |

**PostgreSQL S07.7 check groups (21):**
- **D.21 reproduced** on the chain before S07.7:
  - deleting a Tutor who used the Family Hub fails on `wallet_ledger_created_by_fkey`;
  - with the S08 lane's SET NULL statements applied (the merged tree), the S07.1 ledger guard refuses the cascade with `LEDGER_APPEND_ONLY`;
  - no Block D retention job exists.
- **Erasure keeps the child's record.** A Tutor is deleted while a co-Tutor remains, and the child's coins are unchanged. The ledger lines, the reward decision, the account (still frozen, now the Tutors' freeze), the allowance, the limit and the bonus rule keep their rows with the id cleared. The chores that Tutor created go with them.
- **Rules keep running.** A frozen account credits nothing; once the co-Tutor lifts the freeze, the allowance and bonus credit again.
- **The guards still refuse everything else:**
  - re-assigning a ledger line;
  - changing an amount while clearing its author;
  - re-assigning a reward decision;
  - a percentage for a 9-year-old;
  - clearing a rule's Tutor together with another change (`NOT_A_GUARDIAN`);
  - a child lifting a Tutor's freeze.
- **A child's erasure** removes every Block D row about a 15-year-old across 19 tables (21 rows before, none after).
- **The sweep** deletes 2 decisions and a decided chore older than 400 days, a transition-audit row, an invitation 30 days past expiry and a behaviour event older than 400 days. It keeps the decided chore whose photo is still stored, and records the run.
- **The coin record survives.** A ledger line and a practised day from 500 days ago survive the sweep, and young chores, an open chore and their decisions stay.
- **Photos:**
  - due 30 days after the decision;
  - shared with a chore that is not due yet: flagged, pointer only;
  - cleared only for the matching object on an old decided chore; an open chore's and a young chore's photo stay locked, and nothing else changes in the same update;
  - the purge result is recorded once per run; the next sweep removes the chore; the compliance audit reads zero afterwards.
- **No browser or anon session** calls any retention function, and the service role cannot write the run record.
- **The reflective prompt's record:**
  - one per Tutor decision, matched to that Tutor's decision on that subject;
  - a second record, another adult, an unknown value and a decision older than ten minutes are all refused;
  - no text column, no direct write;
  - the fired-rate numbers are recorded in the report.
- **The monthly tip:**
  - nothing is delivered with no reviewed tip;
  - one row per Tutor per month;
  - a tip no longer reviewed is not returned;
  - the next month brings the next unseen tip;
  - a child, a teen, an adult and a guest are refused (`COACHING_NOT_ELIGIBLE`);
  - an invalid id is refused by its CHECK; only the Tutor marks their delivery; the row cannot be rewritten;
  - Delivery & Engagement reads 1/1/1.
- **No browser session** calls the delivery, the reflection or a metric.
- **The bridge by age evidence:**
  - 15, 17, 18 in a family and an independent 16 are eligible;
  - 14, 9, no birth date, an adult, a guest and a Tutor are not;
  - a 15th birthday opens it.
- **The checklist:**
  - a step waits for its moment; a 14-year-old and an unknown moment are refused;
  - unticking a moment clears it; a teen reads only their own rows; nobody writes the table directly;
  - Engagement reads `all=4/1/1/1`.
- **Research consent:**
  - a Tutor for a child under 18 or of unknown age, and an 18-year-old for themselves, are admitted;
  - a Tutor for an 18-year-old, a teen or child for themselves, an unrelated parent, an adult with no wallet, a guest and a Tutor for themselves are refused;
  - an older disclosure is refused.
- **The snapshot:**
  - only complete months after the consent, once per month; the current month is refused;
  - the hand-computed month reads `10/6/3/2/17/teen/1`;
  - no identity, note, title or reason column.
- **Completeness** with a one-month window reads `all=1/1/1/1, bridge_age=1/1/1/1`.
- **A child's own no** withdraws the consent and deletes every snapshot. A Tutor's yes lapses at 18 and nothing more is recorded.
- **A snapshot older than 1,100 days** is deleted by the sweep.
- **Research access.** No browser session calls a research function or reads a research table; the service role reads consents only.
- **Replay** of the five parts keeps every delivery, bridge entry, consent and run, and every guard.

**Core coverage (56 new tests):**
- **Constants agree with the SQL:** the four retention periods, the bridge age, the reflection window and the disclosure version. Every tip id is unique and cites Appendix G; `reviewedTipIds` passes only reviewed tips.
- **The reflective prompt**, on six Tutor decision routes (approve, send back, cancel, a reward yes and no, a level request) and on the review of a self-logged chore:
  - a missing or unknown reflection is refused before any write;
  - each of the three kinds is recorded as the caller, after the decision;
  - a request carrying the Tutor's words is refused;
  - a failed record never undoes the decision.
- **The monthly tip:**
  - asked as the caller with only reviewed tips;
  - served by id and month;
  - a malformed or unreachable answer is a 502;
  - "not a Tutor" is mapped;
  - opened and dismissed are recorded as the caller, and another Tutor's delivery is a 404;
  - refused before any read to a child, a linked and an unlinked teen, an adult, a guest and staff.
- **The data policy** serves the enforced periods to a Tutor, a child and a teen, and needs a session.
- **The retention run:**
  - refused without the internal key before any call;
  - each photo is deleted from Depot before its pointer is cleared, and a shared object is kept;
  - a Depot failure keeps the pointer;
  - an unreachable or malformed sweep is a 502, never a report.
- **Research:**
  - the Tutor reads and answers for their own child as the caller; a yes needs the version;
  - an unrelated parent gets a 404 before any call; a body naming someone else is refused;
  - not-allowed and stale refusals are mapped; a state claiming recording without a yes is a 502;
  - a child, a linked teen and an unlinked teen read their own state and say no as the caller;
  - an adult learner, a guest, a parent and staff are refused.
- **The bridge:**
  - read as the caller;
  - a too-young holder sees nothing, and a checklist claimed for them is a 502;
  - one entry is ticked as the caller, and holder, amount, bank, unknown moment and step 4 fields are refused;
  - "too young" and "moment first" are mapped;
  - four non-holders are refused before any call.
- **Metrics:** served to analytics staff with no rate for an empty population, refused to support staff, a parent and a child before any read, and a 502 when unreadable.

**Browser matrix journey (each configuration):**
1. **Tutor, `/family`.**
   - The reviewed tip: "Why it helps" shows its finding and "not a promise", and records the opening (exact request).
   - "What this practice covers": four practised lines and credit, debt, real compound interest and risk as not taught.
   - "Your family's data": 30, 400 and 1,100 days, locale-formatted.
   - Research: the whole disclosure before a yes, the yes naming disclosure version 1 (exact body), then "Stop and delete" asked once and sent (exact body).
2. **Tutor, `/tasks`.**
   - Approve opens the reflective prompt with no request sent; the Tutor's words go only as the note they chose (exact body `{ reflection: 'shared', note }`).
   - "Not yet" on a reward: the prompt is skipped, then the reason form (exact body with `reflection: 'skipped'`).
   - "Pricing tips" inside the chore composer.
3. **Tutor, `/banking`.** "Setting a limit" beside the spending limit, and the scope statement.
4. **Child, 15, `/banking`.**
   - "Beyond the app": a moment is marked (exact body), its checklist opens, a step is ticked (exact body), and 250 is split into 125, 100 and 25 with no request sent and no percentage shown.
   - The child's research note and their own no (exact body).

Every configuration had:
- zero axe violations;
- no panel overflow or page scroll;
- 48 px targets (checkbox rows included);
- a copy role on every text node;
- no celebration element;
- zero browser errors.

Captures inspected in this session:
- en-US light 375: the tip, the reflective prompt, the pricing tips, the limit note, the child's research no;
- es-MX dark 375: the bridge with the split tool, the research disclosure;
- pt-BR dark 1280: the scope statement and the data policy (before the fixes below).

**Failures and their resolution:**
- **Real findings from looking at the captures:**
  - the data policy printed "1100 dias" in pt-BR and "1100 days" in en-US; the periods are now locale-formatted (1.100, 1,100), with the test and the matrix updated;
  - the "does not teach" rows used the panel's own fill and read as bare text; they now sit on the surface like the practised rows, told apart by the mark and the heading.
- **Real findings from the gates on the new copy:**
  - the tone gate's first run flagged "Recusas" in a pt-BR tip (rewritten) and "reais" meaning "real" in the pt-BR compound-interest line (rewritten);
  - it also flagged five lines that name real money, credit cards, insurance and a real bank's fees on purpose (reviewed exceptions with reasons);
  - the claims gate's first draft flagged "no garantiza que" in the legal Terms, a disclaimer and not a proof claim, so guarantee language stays with the D.7 and D.8 gates;
  - the copy budget failed the research disclosure's first view by one word (41 of 40) and a pt-BR tip body by one word; both were shortened.
- **A state with no consumer, removed.** The first draft of research consent carried a `revoked_reason` vocabulary nothing consumed. OD-21 forbids declaring such a state, so it was removed: an ended consent keeps its date and who ended it.
- **Consequences of the new design, caught by existing tests:**
  - the existing decision-route calls in `tasks.test.ts` and `familyAutonomy.test.ts` now send the reflection, and the table-driven "not yet" refusals send it so they still test the reason rule;
  - the S07.5 component tests go through the prompt;
  - `FamilyPage.test.tsx` counted the new panels' requests until they were mocked like the other panels;
  - the D.12 register-policy test required a policy for each of the eight new components.
- **Stale regression tooling, fixed:**
  - the S07.5 browser matrix now goes through the prompt;
  - the S07.3 matrix had not followed S07.5's child contract: its `/complete` stub lacked `selfLogged`, and it pressed the legacy done label, which the rebuilt ChoreDone control replaced (the two labels differ in es-MX and pt-BR). It would have failed before S07.7 too;
  - the S07.3 verifier's new full-chain mode sends its Tutor decisions through the S07.5 decision flow, because its direct cancel is exactly what S07.5 forbids.
- **Test and gate mistakes of my own:**
  - PL/pgSQL fixtures violating CHECKs (a Share place kind, an unbalanced gift, an identity column), booleans read as `t` where text concatenation gives `true`, and the expected shared-photo scenario;
  - a stray empty paragraph in the prompt component;
  - an unused variable the linter caught;
  - JSON registry text-matching on escaped apostrophes, and a whole-file reformat of the controls registry that was reverted and re-applied textually.
- **Two disturbed transport runs, neither counted.** Editing a migration while the first `database/` test run was in its operator-transport step made it report "migration drift detected". A second run, capped at 28 minutes, was killed mid-scenario (exit 124), which surfaced as a failed assertion. The untimed run on the final files passed (row above).
- **Load.** The first S07.4 matrix regression timed out in its second configuration while six PostgreSQL verifiers, the transport test and a vitest run shared the machine; it was re-run on a quiet machine (row above).

**Cross-lane findings (not changed here):**
- **S08 (E.6).** The integration branch's `account_deletion_guards` relaxes the Block D provenance keys, and merged with S07.1 the ledger guard would refuse every Tutor erasure. `family_erasure_provenance` carries the identical statements and the guard exceptions; apply it with or after S08's file (either order is safe). S08's `erase_account_data` deletes `guardian_links` while a request is processing; its interaction with S07.1's lifecycle guard needs one full-stack run after the merge.
- **H.1 / A.2.** The same finding as S07.4-S07.6: the H.1 gate excludes a parent-created child under 13 even with consent. D.22's research consent is deliberately separate, so it does not inherit this.
- **Block H.** Parent product surfaces send Umami pageviews whose paths include the child's id (`/family/<kidId>/territory`); first-party and consented, but a path is not minimal.
- **Block G.** The metrics are served by the API only; a console surface belongs to the console rebuild.
- **S05 (B.6).** The D.19 graduation curriculum (milestone 2) belongs to Forge and the shared knowledge-component graph.
- **Legacy nav.** Still reads "AI Tutor" (glossary: Mentor).

**Remaining limitations:**
- No full Supabase (PostgREST/GoTrue) stack run of the new routes and functions.
- `database.ts` has not been regenerated: seven new tables and the new functions.
- No production data yet for any of the five new metrics, and the first compliance run.
- The Pedagogical Lead's review of the twelve tips: until then no tip is sent, by design.
- The project leader is the interim owner of D.19 and D.22 (OD-28, owner review O-02, 27 September 2026); a permanent Product (D.19) and Product/Research (D.22) owner is still to be named. Legal has not reviewed the retention periods or the research disclosure (no family may be asked before that).
- The first human scope audit and the first Appendix G recalibration review have not been done.
- Appendix H Stage 5 family usability testing: the reflective prompt, the bridge and the research disclosure.
- Native review of `familyGovernance.json` in three locales.
- The browser matrix uses a synthetic Core.
- Product/Safety/Legal review of the eleven proposals above.

D.9, D.19, D.20, D.21, D.22 and D.23 are not accepted.

## S07.8: lane review (24 September 2026)

An adversarial review of every commit on `codex/spec-s07` since `337c9f0e` (seven commits, S07.1 to S07.7, 286 files) against the SPEC acceptance criteria of D.2 to D.23 (D.1 belongs to S02), Appendix H's Definition of Done and its Stage 2 bypass rule, and the owner decision log. For each requirement the review compared what the SPEC mandates with what the code enforces, and hunted for mandates skipped or shrunk, authorization held only by the UI, uncovered populations (a parent-created child under 13, a guest, an independent teen 13-17, an adult, a verified parent Tutor, staff by permission), untested failure paths, untranslated or over-budget copy, legacy imports in rebuilt UI, CRLF damage, undocumented behaviour and claims the code does not support.

### How the review was done

- **Enforcement boundary, mechanically.** All 165 SQL functions the lane defines are revoked from `PUBLIC`, and none is granted to `anon` or `authenticated`. The lane's 17 browser policies are all `FOR SELECT`, scoped to the holder or a verified guardian. So no Block D write exists outside the service layer, and every Core route is re-checked by a database guard. Every function that writes `wallet_ledger` was listed from the latest migration that defines it. Each one either checks the freeze itself, or writes through a table whose trigger does: teen income, release and reward claims (`wallet_self_actions`), and Share pledges and take-backs (`share_gifts`). The exceptions are the Tutor's own coin corrections and goal withdrawals, which by D.1 are not child movements. The level-2 and level-3 pre-approval still passes the spending limit and the freeze in `guard_redemption_state`.
- **Routes against tests.** A scan listed every lane Core route that no test names. Only one lane route was untested: `GET /api/v1/admin/family-autonomy/:kidId`. The other hits are legacy routes that the tests call through template strings.
- **Rebuilt UI.** The review checked every import in `frontend/src/rebuild/{family,banking,wallet}`: only the design system, the lane's own modules, i18n and React. Every lane component declares `data-copy-role`, through the `Copy` control or directly. No lane component has a hardcoded label. The i18n key and placeholder sets are identical across the three locales in all 14 touched namespaces. The only strings equal to English are brand terms and `{name}: {reason}`.
- **Line endings.** All 286 lane files are `i/lf w/lf`, with no carriage return in any of them.
- **Claims.** Every string in `marketing.json` about approvals, the split, Share, goals, limits, the bonus and the streak was read against the controls as S07.1-S07.7 built them.

### Requirement by requirement

| ID | SPEC mandate | What the code enforces | Review verdict |
|---|---|---|---|
| D.2 | B.21's lapse-tolerant model on the chore streak | Pure model (two rest days a week, a permanent best and total, a Tutor's pause), practised days recorded only by the database trigger, rest-day utilization served to analytics staff | Holds. B.21 (S05) must adopt `choreStreak.ts` for the learning streak: a cross-lane merge point |
| D.3 | An independent teen wallet (OD-3 Option B) that layers onto family mechanics | Eligibility by stored age for every writer, guardian-only tasks, a teen-confirmed parent link, the adoption metric | Holds |
| D.4 | Every state transition only through the service layer | Browser write paths removed, triggers for every writer, the Unauthorized State-Transition Rate served | Holds. Re-confirmed mechanically for the S07.2-S07.7 tables |
| D.5 | Every declared state built or removed | 55 states across 13 columns, each with a producer and a consumer, enforced by the lifecycle gate | Holds |
| D.6 | The staff insight on the per-child shape | One database function, a nightly probe, uptime served, a contract gate | Holds |
| D.7 | No visual or copy implies a guarantee the system does not enforce, re-verified as controls change | Control registry and gate for the in-app surfaces | **Gap found and fixed:** the marketing site overstated the controls built in S07.4 and S07.5 (below) |
| D.8 | A tone gate for all Family Hub and banking system copy | 3,873 strings in three locales, reviewed exceptions, no raw Core message; there are no Family Hub emails or notifications to cover | Holds |
| D.9 | Appendix G authoritative, recalibrated on its cadence | Traceability registry and gate; release readiness fails when a recalibration is overdue | Holds. Human recalibration is open |
| D.10 | Contribution versus bonus tagging, as a family choice | Kind and range enforced for every writer; no preselected kind | Holds |
| D.11 | A fixed bonus for younger children, a percentage with a worked example for 13-17 | Framing by age at rule and credit time; the example is checked by the database | Holds |
| D.12 | B.23's three registers on this Block | Register from age evidence; Core shapes the numbers | Holds. The B.23 "graduation" moment is cross-lane |
| D.13 | Instrument redemption timing; a default split with an easy override | Usual split per holder, any full split accepted, time since the allowance and since earned coins both recorded | Holds |
| D.14 | A real destination for Share | Places chosen by a Tutor or a self-registered teen, a pledge debit, a settlement with a required note | Holds in the product. **Gap found and fixed** in the marketing copy ("someone else's goal") |
| D.15 | A next-goal prompt at the celebration; the post-goal rate instrumented | The next step opened in the covering transaction; the cliff metric served | Holds |
| D.16 | Bonus credit visually distinct in every goal display | Provenance on every read; one component; a release gate. The review found no goal progress drawn anywhere outside the gate's scopes | Holds |
| D.17 | Tiers by age and track record, fading pre-approval, child voice, rollback | Three levels in the database, eligibility logged, staff and system rollback | **Test gap found and fixed:** the support-staff read of a level before a rollback. Marketing approval claims corrected (D.7) |
| D.18 | Mandatory actionable reasons; the child's reasoning at decision time; a talk nudge | Every writer is refused a "not yet" without a code and an actionable reason; child notes in the queue; nudge after three in 14 days | Holds |
| D.19 | A scoped, age-gated bridge with a first milestone | Milestone 1 from age 15, by age evidence; engagement and the research cohort served | Holds. Milestones 2-4 are open; the project leader is interim owner (OD-28) |
| D.20 | A plain scope statement in parent-facing material | Mounted for Tutors and teens; a gate against lending or interest mechanics | **Gap found and fixed:** the statement was only in the signed-in app; it is now in the public FAQ too |
| D.21 | A published retention and deletion policy | Enforced periods, a nightly sweep, erasure paths, the compliance audit | **Gap found and fixed:** the periods were only in the signed-in app and the repository; they are now published in the public FAQ, pinned to the enforced numbers |
| D.22 | A long-horizon research plan and its first phase | Separate consent, pseudonymous snapshots, completeness served; no experiment on a minor | Holds. The project leader is interim owner (OD-28) |
| D.23 | Coaching in the controls, a reflective prompt, monthly reviewed tips | Guidance in the composer and the limit; the prompt before every decision; tips gated on the Pedagogical Lead's review | Holds. No tip is reviewed yet, so none is delivered: honest, and the delivery metric reads zero until then |

### Gaps found and fixed in S07.8

1. **The marketing site promised control the product no longer keeps (D.7, D.17).**
   - The FAQ answer "spending needs your approval first" and the Families page lines "you approve it before it lands" and "It's waiting for their approval before it's yours" were true before S07.5. They are false for a child whose Tutor raised them to Level 2 or 3, where small rewards are pre-approved and chores are self-logged and reviewed afterwards.
   - Rewritten in three locales: every child starts with the Tutor approving each chore and reward, and small ones can go through on their own within limits the Tutor sets.
   - Registered as the control `approval`, with its enforcing SQL (`guard_task_state`, `guard_redemption_state`, `family_request_redemption`) and its adversarial proofs.
2. **The marketing site described a Share flow that never existed (D.7, D.14).** "You send a few coins toward someone else's goal." Share coins go to a place a Tutor chose, and whoever chose it records what happened. Rewritten, and registered as the control `share_destination`.
3. **A regression guard for both.** `block-d-controls.json` gains `retiredClaims`. `check-no-unbacked-guarantee.mjs` now fails when any retired phrase comes back in any string of its namespace, in any locale. There is a new self-test, and `NO-UNBACKED-GUARANTEE.md` records the three findings in its audit log.
4. **D.20 was only in the signed-in app.** A parent weighing the product reads the marketing site, where "financial literacy" framing lives. The FAQ now answers "Does it teach credit, debt or investing?" (`faq.items.notTaught`) with the statement's lines. `check-block-d-scope.mjs` fails when the answer leaves the FAQ or stops naming credit, debt, compound interest, risk, insurance and "not interest" in any locale (`publicAnswers`), and it has a new self-test.
5. **D.21 asks for a published policy.** The FAQ now answers "How long do you keep chores, rewards and decisions?" (`faq.items.familyRecords`): photos 30 days after the decision, records 400 days, the coin record while the account exists, and a child's account deletion deleting all of it. `check-block-d-retention.mjs` fails when the answer leaves the FAQ, or states a number that is not an enforced period, in any locale. It has a new self-test. `FAMILY-DATA-RETENTION.md` adds the FAQ to the one-change rule for a period.
6. **An untested staff route (D.17).** `GET /api/v1/admin/family-autonomy/:kidId` had no test. A new Core test covers:
   - support staff are served the level and its history, with no actor id;
   - a bad id gets a 400, a child outside a family a 404 and an unreadable history a 502;
   - analytics-only and ungranted staff, a Tutor, a child, a linked and an unlinked teen, an adult and a guest are refused before any read.

The FAQ lists 29 questions (the component's comment and `App.test.tsx` were updated), and the FAQ test now opens both new answers.

### Found, not changed here (cross-lane, recorded for the orchestrator)

- **Glossary in the marketing FAQ (S04/S06).** The tutor category calls the AI "the Tutor", for example "Is everything the Tutor says checked first?". The es-MX and pt-BR `retention` questions call AI conversations "conversaciones con el Tutor" and "conversas com o Tutor", and the en-US one says "AI Tutor". Owner log §5 reserves "Tutor" for the verified parent. These strings belong to the acquisition and Mentor lanes and are left to them, like the legacy nav finding in S07.6.
- **Marketing header at 375 px (S04).** Once the page is scrolled, the header's right-hand controls and the cookie banner reach 384-385 px in a 375 px viewport, so the marketing pages scroll sideways by a few pixels (S07.8 verification log). This is layout the lane did not touch.
- **`GuardianInvite.tsx` (S04).** It carries a hardcoded English `aria-label="invite link"`. S07.1 changed the component but not that label.
- **Unchanged cross-lane items from earlier checkpoints:** B.21 adopting the chore-streak model; the H.1/A.2 gate excluding a parent-created child under 13; the S08 erasure-merge ordering; the B.23 graduation moment; the Block G console surface for the metrics.

## S07.8 verification log

Executed 24 September 2026 (the lane's verification date) in the S07 worktree, first-hand, on the tree being committed. Commands run from the worktree root unless a directory is named, with `VITEST_MAX_THREADS=3 VITEST_MIN_THREADS=1 VITEST_MAX_FORKS=3 VITEST_MIN_FORKS=1`. These are local results only, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Root type-check | `npm run typecheck:all` (once at the start, again on the final tree) | Passed both times: `run-all type-check OK across all services`. `database/` defines no type-check script and is skipped by design |
| Root lint | `npm run lint:all` (at the start, and on the final tree) | Passed both times: `run-all lint OK across all services` |
| Root tests | `npm run test:all` (47 minutes on the shared machine) | Passed across all eleven packages:<br>- audiogen: 17 files, 168 tests<br>- backend: 79 files and 1 skipped, 1,910 tests and 1 documented skip; one new test<br>- coursegen: 45 files, 662 tests<br>- database: the numbering, RLS and phase gates over 142 files (108 expand, 34 contract, 23 contract pending), the lifecycle gate (55 states), 28 of 28 node tests, and the operator transport's 12 scenarios (`railway-migrate integration OK`)<br>- dataintel: 16 files, 194 tests<br>- email-server: 7 files, 35 tests<br>- filebase: 8 files, 34 tests<br>- frontend: 230 files, 2,462 tests<br>- oracle: 41 files, 1,136 tests<br>- parent-id-check: 3 files, 26 tests<br>- picturegen: 10 files, 103 tests |
| Database gates | `database/`: `npm test`, run inside `test:all` above | Passed, see the row above |
| Secrets | `npm run secrets:check` (after staging) | `secrets:check OK — no credential patterns in tracked files` |
| Spec authority | `npm run spec:check` | Passed: spec authority, V2 parity, tokens and assets OK (7 assets, 7 awaiting review) |
| Tool self-tests | `npm run tools:test` | 133 of 133. Four are new: a retired claim, flattened copy, the public scope answer and the published periods |
| Block D gates | `node` on each of: `check-block-d-thresholds.mjs`, `check-no-unbacked-guarantee.mjs`, `check-family-copy-tone.mjs`, `check-family-engagement-contract.mjs`, `database/scripts/check-family-lifecycle.mjs`, `check-block-d-research.mjs` (also `--strict`), `check-block-d-scope.mjs`, `check-block-d-retention.mjs`, `check-parent-coaching-tips.mjs` | All passed:<br>- 54 thresholds agree;<br>- 16 controls (2 new) enforced and proved, and no retired claim present;<br>- 3,873 family strings pass the tone gate (100%);<br>- the insight keys agree;<br>- 55 lifecycle states;<br>- 14 requirements traced, and 5,451 parent-facing strings (the new FAQ answers included) free of proof claims;<br>- the scope statement mounted on 3 pages plus the public FAQ answer;<br>- 40 tables classified, with the published periods equal to the enforced ones;<br>- 12 tips drafted, none sent |
| i18n | `bash agent/tools/check-i18n.sh` (Git Bash) | File and key sets identical in three locales, no hardcoded strings, every static key present |
| Focused Core | `backend/`: `npx vitest run src/__tests__/familyAutonomy.test.ts -t "support staff a child"` | The new staff-read test passes |
| Focused frontend | `frontend/`: `npx vitest run src/__tests__/App.test.tsx` | 21 of 21, including both new FAQ answers opened |
| Real Chrome, public copy | `frontend/`: `node ../.lane-cache/s078-faq-matrix.mjs` against the dev server (`VITE_CACHE_DIR` in the lane cache, port 5340, stopped afterwards). A one-off lane matrix that fails every `/api/v1` request | 12 of 12 configurations (EN, es-MX and pt-BR × light and dark × 375 and 1280 px). In each one:<br>- the FAQ shows the new `notTaught` and `familyRecords` answers and the rewritten `chores` answer, word for word;<br>- the Families page shows the new body, Spend and Share lines;<br>- nothing inside `main` is wider than the viewport;<br>- zero console errors.<br>36 captures and `report.json` are in `.lane-cache/s078-faq/`. Captures inspected in this session: en-US light 375 (the FAQ money answer), es-MX dark 375 (the privacy answer) and pt-BR dark 375 (the Families Share line) |
| Line endings | `git ls-files --eol` over the 286 lane files and the staged files; a carriage-return search | All `i/lf w/lf`; no carriage return |

**Failures and their resolution:**
- **Matrix harness mistakes of my own, not product defects:**
  - the first run looked FAQ buttons up by their whole text, which includes the accordion's icon ligature (`add`);
  - the second looked up the Families radios the same way, and read the Spend line before React had rendered it.
  - Fixed by matching the label span and the text, and by waiting for the line. A stale `report.json` from the first run was read once and discarded.
- **A 9 to 10 px overflow at 375 px, pre-existing and not changed here.** At 375 px, once the marketing page is scrolled, the header's right-hand controls reach 384 px and the cookie banner 385 px. So the page scrolls sideways by a few pixels in every locale and theme. The same probe with the page at rest reports no overflow. Nothing inside `main` (the lane's copy) overflows. The header and banner belong to the marketing lane (S04) and were not touched by S07. The matrix records these elements as `chromeOverflow` for that lane, rather than counting them as a failure of this copy.
- **Load.** The first matrix run warmed up in 71 seconds while `test:all` shared the machine; nothing timed out.

**Remaining limitations:** the lane summary below lists them.

## Lane summary (S07.1 to S07.8)

**Scope delivered.** D.2 to D.23 in eight checkpoints (D.1 is S02's). Every requirement is implemented at its enforcing boundary: the database for every writer, Core re-checking as the caller, and the rebuilt surfaces showing only what the database enforces. Each one has been verified locally with adversarial tests and real-Chrome matrices, and reviewed once more as a lane in S07.8. **No requirement is Accepted.** Appendix H's Definition of Done still needs, for each of them: production data for its metric (Measured), the named human reviews (Reviewed), and for new mechanics, Stage 5 family usability testing.

**Final status per requirement:**

| ID | Status |
|---|---|
| D.2 | In progress: implemented and locally verified (S07.3, re-reviewed S07.8; on B.21's shared model since the S07 merge); pause lead-time owner question, production baseline, human review pending |
| D.3 | In progress: implemented and locally verified (S07.2, re-reviewed S07.8); full-stack run, production metric, Product acceptance pending |
| D.4 | In progress: implemented and locally verified (S07.1a, re-reviewed S07.8); full-stack run, production metric (target zero), human review pending |
| D.5 | In progress: implemented and locally verified (S07.1b, re-reviewed S07.8); full-stack run, human review pending |
| D.6 | In progress: implemented and locally verified (S07.6, re-reviewed S07.8); production uptime baseline, console surface (Block G) pending |
| D.7 | In progress: implemented and locally verified (S07.6, marketing gap fixed S07.8); first human quarterly audit pending |
| D.8 | In progress: implemented and locally verified (S07.6, re-reviewed S07.8); Stage 4 human spot-check, B.14 merge pending |
| D.9 | In progress: implemented and locally verified (S07.7, re-reviewed S07.8); first recalibration review pending |
| D.10 | In progress: implemented and locally verified (S07.3, re-reviewed S07.8); production baseline, Product review of the cap pending |
| D.11 | In progress: implemented and locally verified (S07.3, re-reviewed S07.8); threshold review, production baseline pending |
| D.12 | In progress: implemented and locally verified (S07.6, re-reviewed S07.8); B.23 graduation moment (cross-lane), usability testing pending |
| D.13 | In progress: implemented and locally verified (S07.4, re-reviewed S07.8); production baselines, usability testing pending |
| D.14 | In progress: implemented and locally verified (S07.4, marketing gap fixed S07.8); completion baseline, usability testing pending |
| D.15 | In progress: implemented and locally verified (S07.4, re-reviewed S07.8); cliff baseline over successive releases pending |
| D.16 | In progress: implemented and locally verified (S07.4, re-reviewed S07.8); per-release compliance in production pending |
| D.17 | In progress: implemented and locally verified (S07.5, test gap fixed S07.8); progression baseline, threshold review, usability testing pending |
| D.18 | In progress: implemented and locally verified (S07.5, re-reviewed S07.8); first human-scored sample, usability testing pending |
| D.19 | In progress: first milestone implemented and locally verified (S07.7, re-reviewed S07.8); interim owner named (OD-28); milestones 2-4 pending |
| D.20 | In progress: implemented and locally verified (S07.7, public FAQ added S07.8); first quarterly scope audit pending |
| D.21 | In progress: implemented and locally verified (S07.7, published in the FAQ S07.8); Legal review, first compliance run pending |
| D.22 | In progress: scope document and phase 1 implemented and locally verified (S07.7, re-reviewed S07.8); interim owner named (OD-28); Legal review of the disclosure pending |
| D.23 | In progress: implemented and locally verified (S07.7, re-reviewed S07.8); Pedagogical Lead tip review, delivery baseline pending |

**Commits on `codex/spec-s07`:** `84887636` (S07.1), `72c9552c` (S07.2), `954a59dd` (S07.3), `992e5044` (S07.4), `18cb1add` (S07.5), `940656a3` (S07.6), `85eb02f2` (S07.7) and the S07.8 review commit.

**Migrations.** There are 31, numbered 0112 to 0142 in the lane's worktree and renumbered 0147 to 0177 at the S07 merge (same order; see "S07 merge integration"), so they are named here by suffix. Apply them in this order, each group together with (never ahead of) its Core release:
- **S07.1:** family_hub_state_machine, family_hub_transition_guards, family_hub_wallet_integrity, family_hub_guardian_link_lifecycle, family_hub_lifecycle_flows.
- **S07.2:** independent_teen_wallet_schema, independent_teen_wallet_guards, independent_teen_wallet_ledger, independent_teen_wallet_flows, independent_teen_guardian_link.
- **S07.3:** chore_streak_rest_days, family_task_contribution_kind, savings_bonus_age_framing.
- **S07.4:** family_money_events, share_gift_destinations, share_gift_flows, wallet_usual_split, savings_goal_next_step.
- **S07.5:** family_autonomy_ladder, family_autonomy_rules, family_autonomy_flows, family_decision_guards, family_decision_flows, family_talk_nudges.
- **S07.6:** family_money_register, family_engagement_insight.
- **S07.7:** family_erasure_provenance, parent_coaching, money_bridge, family_research_instrumentation, family_data_retention.

Fourteen are `contract`, which `gate-auto-apply.mjs` refuses to apply on its own, so an operator applies them: the five S07.1 parts, four of the five S07.2 parts (all except independent_teen_wallet_flows), family_task_contribution_kind, savings_bonus_age_framing, share_gift_destinations, family_decision_guards and family_decision_flows. S07.8 adds no migration.

**Enforcing mechanisms in CI (`repo-gates.yml`, unfiltered):**
- the lifecycle gate;
- the threshold log gate;
- the no-unbacked-guarantee gate (now with retired claims);
- the family copy tone gate;
- the engagement-contract gate;
- the research, scope (now with the public FAQ answer), retention (now with the published periods) and coaching-tip gates.

Operator jobs: `family-retention.yml` nightly, plus three guarded calls in `insights-maintenance.yml`.

**Open for the lane (carried to integration):**
- A full Supabase (PostgREST/GoTrue) stack run of every lane migration, route and policy; so far only native PostgreSQL with a role and auth shim has been used.
- Regenerating `database/types/database.ts` with `db:types`.
- Production baselines for every Appendix H diagnostic, and a per-release production check of the zero and 100% targets.
- Human reviews:
  - Product/Safety review of the proposals recorded in each checkpoint;
  - the Pedagogical Lead's tip review and the first Appendix G recalibration;
  - the first quarterly No-Unbacked-Guarantee and Scope-Disclosure audits;
  - the first human-scored denial-reason sample;
  - Legal review of the retention periods, the research disclosure and the Privacy Notice wording;
  - native copy review of the lane namespaces and the new FAQ answers in es-MX and pt-BR.
- Appendix H Stage 5 family usability testing of the new mechanics.
- ~~The owner naming the D.19 and D.22 owners.~~ Answered by OD-28 (O-02): the project leader is interim owner of both.
- Cross-lane merge points:
  - B.21 learning streak;
  - H.1/A.2 under-13 gate;
  - S08 erasure ordering;
  - B.23 graduation moment;
  - Block G console;
  - the marketing and nav glossary ("Tutor" for the AI).
- Every browser matrix used a synthetic Core.

## S07 merge integration (25 September 2026)

The lane was merged into the integration branch after S05 (Forge gates, then the learning engine), S08 (profiles, social and sharing), S03 (the shared design system) and S06 (the Mentor). This records what the merge changed in the lane's work, and in the other lanes' work where the two met, and why. Statuses are unchanged: every D requirement stays "In progress", implemented and locally verified, not accepted.

**Conflicts, each resolved as a union.** Core's `family.ts` and `admin.ts` import both sides' services (the S08 profile review and metrics, the S05 learning-quality report, every S07 metric). The kid list returns both the E.13 `profileReview` flags and the S07.2 `accountType` hint, and the tests expect both. `FamilyPage` renders both sides' panels, so the S08 profile-safety note and the S05 learning panels sit next to the S07 co-Tutor, correction, pause, Share, ladder and research panels. The guardian-invite acceptance keeps the S03 `InlineNotice` and the lane's pending and teen-issued states: a pending link is an `info` notice, never a success. The marketing locales merged key by key without a clash. The FAQ carries both sides' new answers (`noMessaging` and `socialRetention` from S08, `familyRecords` from S07). Each answer was re-read against the merged code: "deleting your child's account deletes all of it" holds, because the child's erasure runs through S08's lifecycle and every Block D row cascades (verified below).

**Migrations renumbered.** The lane's `0112`–`0142` collided with S08's, S05's and S06's, so they are now `0147`–`0177`, in the same order (`0147_family_hub_state_machine` … `0177_family_data_retention`). The lane named its own migrations by suffix, so the verifiers and gates needed no number changes; two historical mentions in this record were annotated. One reconciling migration follows the chain: `0178_s07_merge_reconciliation` (expand).

**Erasure: one lifecycle.** S08 built the only account-erasure path (`account_deletion_requests`, `erase_account_data`, the provenance relaxation in `account_deletion_guards`). The lane plugs into it and adds no second one:
- The lane's `family_erasure_provenance` re-declares the same seven provenance keys with the same text as S08, so applying both leaves one identical constraint.
- Its `WHEN`-clause triggers let the `SET NULL` cascade pass the S07.1 guards, which would otherwise have refused an adult's erasure (`LEDGER_APPEND_ONLY`).
- The nightly retention sweep (D.21) only minimizes data by age. Deleting an account is always `erase_account_data`.
- `deletion:check` rule 6 holds for every new table: every key to an account is `CASCADE` or `SET NULL`.

One gap was found and closed in `0178`. The S07.1 transition audit (`family_state_audit.actor_user_id`) had no foreign key, so an erased adult's id stayed on the family's audit rows for up to 400 days, while `audit_logs` clears it at once. It is now `ON DELETE SET NULL` (`NOT VALID`, because the table is new in this release), with an index for the cascade. The retention registry, the written policy and the S08 erasure verifier record this, and the verifier asserts it.

**Guardian links: one state machine.** The lane's `guard_guardian_link_state` (`0150`) governs every insert and update: pending, verified, rejected, revoked and re-invite. S08's `prevent_last_guardian_removal` (redefined in `0117`) still guards deletes and last-guardian revocations, with its erasure bypass. The lane does not redefine it, so apply order leaves both intact. Erasure deletes links, which `0110`'s A.1 trigger turns into a suspension, and the lane's `guardian_link_suspension_on_status` adds the same consequence for a revocation. Every S08 Core read of `guardian_links` filters `verified`, so pending, rejected and revoked links grant no social visibility. The S04.1 invite flow shows the lane's pending state. Evidence on the merged chain: the S08 erasure verifier (a last-Tutor parent's erasure suspends the child it supervised alone and leaves the co-supervised child active), the lane's state-machine verifier (pending, rejected, revoked, concurrency), the teen-wallet verifier (teen-confirmed linking) and the S08 social-tiers and social-governance verifiers.

**Streaks: one model.** Both lanes wrote the Bible 02 §9.6 lapse-tolerant model in parallel. S05 wrote `habitStreak.ts`, pinned to the SQL twin inside `complete_lesson` by 31 shared vectors. The lane wrote `choreStreak.ts`. D.2 mandates one model, so the chore streak now folds its recorded days through `advanceHabitStreak` and reads them with `readHabitStreak`. `habitStreakLapses` was added to the shared module for the Appendix H rest-day metric. `choreStreak.ts` keeps only what is chore-specific: its input, the legacy floor, the local today and the milestone check. Its constants stay literal for the threshold gate, and a new test pins them to the shared module and checks that both streaks give the same number for the same days.

One behaviour changed. A run that breaks and restarts inside the same week now gets that week's two rest days afresh (the shared rule). The lane's copy carried the broken run's used rest days over. A new test pins the shared behaviour.

**Open owner question, both values unchanged:** the holiday-pause lead time is 120 days for the chore streak (`PAUSE_MAX_LEAD_DAYS`, the Block D threshold log and the database) and 60 days for the learning streak (`PAUSE_LEAD_DAYS`). The length (21 days) and backdate (7 days) agree.

The Family screen now showed two controls both titled "Holiday pause". They are "Lesson streak pause" (S05) and "Pause chore streak" / "Chore streak pause for {name}" (S07) in three locales. Whether one pause should cover both streaks is a Product question.

**Other lanes' gates, none weakened.**
- *E.10 messaging scan (S08, runtime).* Over the merged chain, the live scan (`social_messaging_surfaces`, structure rule: free text in a table that references two accounts) reported ten unreviewed columns:
  - `mentor_quality_flag.dedup_key` and `resolution_note` (S06, staff only);
  - the family reasons and notes of D.5, D.14, D.17 and D.18: `family_decisions.reason` and `prior_status`, `family_autonomy_changes.reason`, `redemptions.child_note`, `tasks.child_note`, `share_destinations.title`, `share_gifts.note` and `wallet_guardian_actions.reason`.

  Each is written by a verified Tutor for their own child, or by the child for their own Tutor at decision time (D.18 mandates the child's stated reasoning), inside the family, as `tasks.cancel_reason` and `tasks.title` already were. They are listed in `SOCIAL-GOVERNANCE.md` §2.2 and in the redefined scan (`0178`), and `guardrails:check` keeps the two equal. Their Stage 3 review is open. The static gate cannot see the structure rule, which is why the S06 merge missed its two columns. The `guardrails:check` mutation test now targets the latest definition of the scan.
- *B.22 randomness (S05).* `family_denial_reason_sample` orders a staff scoring sample by `random()`. It is declared in the allowlist as quality assurance with no child- or family-facing outcome, like the Mentor live-review sampling.
- *Law 2 tone gate (S05 Forge).* A developer note in `moneyRegister.ts` said "account holder" (a bank register phrase) and was reworded.
- *D.12 register policy (S07).* The lane's own test now also sees the S05 and S08 Family Hub components (`AchievementShare`, `AchievementSharePreview`, `LearningBridges`, `LearningNarrative`, `StreakPauseControl`). All five are registered as Tutor surfaces.
- *Glossary, no-lives, dark patterns and celebration budget (S03, S05).* Everything passes after the recomposition below. The one dark-pattern finding (SH-02, a "not yet" styled in the error hue in `familyAutonomy.css`) is gone.

**Rebuilt surfaces recomposed on the S03 controls.** The lane's 33 rebuilt components predated S03 and failed `recomposition.test.ts` (29 files with local alert or status paragraphs, 12 with raw inputs or buttons, 9 with `aria-pressed` toggles), `controlsCss.test.ts` and `celebrationBudget.test.ts`. Now:
- **Pick-one choices:** reason codes, reward reasons, pockets, directions and sources use `RadioGroup` or `SegmentedControl`.
- **Fields:** amounts, names, reasons and dates use `TextField`, `TextAreaField` or `SelectField`, replacing the retired `Field` and `.lf-field`. `WalletCorrections` did not compile.
- **Other controls:** the ladder's −/+ is `Stepper`, and the bridge checklist is `Checkbox`.
- **Status lines:** every loading, failure and confirmation line is `LoadingState`, `ErrorState`, `Banner` or `InlineNotice`, with a "not yet" in the `retry` tone.
- **Milestones:** the chore-streak 7/30/100 and the savings-goal-reached moments play through the shared `Celebration`, and the local spring keyframes are gone.
- **Legacy markup:** the Tasks route's allocation wrapper no longer renders `lf-*` markup outside `src/rebuild`.

Behaviour kept. Test changes are selector-only: radios instead of pressed buttons, and a `status` instead of an `alert` where a validation message is a "not yet". Two assertions were added to pin that no alert appears there.

**Evidence** (local, 25 September 2026; not CI, not production):

| Boundary | Result |
|---|---|
| Native PostgreSQL 17.6, whole merged chain (`0001`–`0178`) on a fresh owned cluster | S08 `verify-account-erasure-postgres.py`: 16 checks, now including that the transition audit keeps its row and loses the erased actor. Its Family Hub fixture is seeded as history with triggers off, as the S07 verifiers seed theirs, because since S07.1 a ledger adjustment needs its guardian action. Lane verifiers with `LF_PG_FULL_CHAIN=1`: state machine 14, teen wallet 17, chore streak and bonus 11, money habits 14, autonomy and decisions 16, money presentation 12. Governance: 21, and on the merged chain its reproduction step starts at the `LEDGER_APPEND_ONLY` stage, because S08's relaxation is already in the chain. S08 social tiers: 17. S08 social governance: 15, including the empty messaging scan |
| `database` | `npm test`: numbering, RLS, append-only and size cap over 178 files; phase 133 expand and 45 contract (34 contract pending); lifecycle 55 states; 28 of 28 node tests; `railway-migrate integration OK` (12 transport scenarios) |
| Core | `type-check`, `lint`; `npm test` 116 files (1 skipped), 2,868 tests plus 1 documented skip |
| Frontend | `type-check`, `lint`; `npm test` 272 files, 2,917 tests (`recomposition`, `controlsCss`, `celebrationBudget`, `designClasses`, the glossary and the D.12 register policy included) |
| Other packages | Oracle: 64 files, 1,687 tests. A first run beside three browser matrices timed out in four boot hooks; the rerun on a quiet machine passed. Coursegen: 55 files, 798 tests. Dataintel: 17 files, 200 tests. Email server: 7 files, 35 tests. Each also passed `type-check` and `lint` |
| Root gates | `spec:check`: every step OK, dark patterns 0 findings. `tools:test` 292 of 292. Also `secrets:check`, `deletion:check`, `guardrails:check`, `check-i18n.sh`, and the nine lane gates in `repo-gates.yml` (lifecycle 55 states, 54 thresholds, 16 controls, 3,876 strings at 100%, engagement contract, research, scope, retention for 40 tables, coaching tips) |
| Real Chrome, synthetic Core (Vite on 5394) | The seven lane matrices each pass 12 of 12 configurations (3 locales × light/dark × 375/1280 px) with 0 findings: family hub lifecycle, teen wallet, family money, money habits, family autonomy, coin account, family governance. `audit:rebuild`: 6,672 text-fit, 1,668 proportion and 1,668 copy-budget configurations, no issues |

What the matrices needed was stale harness, not product defects:
- The synthetic Cores lacked endpoints that later checkpoints and the other lanes' panels call. For example, the S07.2 teen matrix predates the split and Share requests of S07.4, and goals lacked the S07.4 provenance fields.
- Shared radios and checkboxes are pressed through their labels, and their 48 px target is the label.
- Stepper buttons carry their shared names.
- A "not yet" validation is now asserted as a `status` in the retry tone, with no alert.
- After a reload the matrices wait up to the warm-up ceiling for the app to mount, and let transitions settle before the axe check.

Two single axe colour-contrast reds, under three concurrent matrices, did not recur in targeted or full reruns, and are recorded as unexplained. Captures inspected: the Family co-Tutor and coin-corrections panels (es-MX, dark, 1280) and the teen wallet's reached goal with its next-goal prompt (es-MX, dark, 1280).

**Still open.**
- A full Supabase stack run.
- `db:types` regeneration.
- S05's `test-habit-streak.sql` on real PostgreSQL (it needs a seeded lesson and was not run here).
- Stage 3 review of the ten new E.10 names.
- The two owner and Product questions above: the pause lead time, and one pause or two.
