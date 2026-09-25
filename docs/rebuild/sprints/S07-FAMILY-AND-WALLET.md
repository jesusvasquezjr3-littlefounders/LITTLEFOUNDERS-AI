# S07: Family Hub and independent teen wallet

Status: in progress. Started 24 September 2026; S07.2 and S07.3 recorded 25 September 2026. Owner: Engineering for implementation; Product, Safety/Trust and the Block D Engineering Lead (Appendix H Stage 0 pairing) for the reviews named by the SPEC. No release approval is recorded.

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
| S07.2 | D.3 per OD-3 Option B (owner log §7): the self-registered teen's personal wallet | An eligible teen (13–17 by the stored age declaration, never role) logs income and splits it across Save/Spend/Share in one step with no approval, keeps savings goals, defines and marks their own rewards, and moves coins out of their own goal; Tasks, chore approval, reward requests and every parent-set rule stay guardian-only; adults, guests, under-13 arrivals, parent-created children (family wallet instead), staff and aged-out accounts hold no personal wallet, enforced by the database for every writer and by Core admission; a teen-initiated parent link layers the family mechanics onto the same ledger, goals and rewards without migration; Appendix H's Teen Independent-Mode Adoption is served to analytics staff | Rebuilt `/wallet` surface (`frontend/src/rebuild/wallet/`) in three locales, light/dark, 375/1280 px; learner shell shows Wallet, Tasks locked until a parent links, no Family entry for a teen | In progress: implementation and local verification recorded (native PostgreSQL over the actual migration chain, 73 adversarial Core tests, 42 component/route tests, 12 real-Chrome journeys); full Supabase stack run, types regeneration, copy/native review, production metric and Product acceptance pending |
| S07.3 | D.2 forgiving chore streak, D.10 expected contribution versus paid bonus task, D.11 savings bonus framed by age | The chore streak is computed by a lapse-tolerant model (two free rest days a week, permanent best and total, a Tutor's holiday pause) from practised days that only the task itself can record; a Tutor tags every chore as a family contribution (0–2 coins) or a bonus task (1–500) with no preselected kind; under 13 (or with no known birth date) the savings bonus is the fixed 1 coin per 10 saved and no percentage reaches the child, whoever writes the rule; 13–17 keep the Tutor's 0–20% with a worked example checked by the database; every threshold sits in the Block D threshold log and a gate keeps log, Core and migrations equal; three Appendix H diagnostics served to analytics staff | Rebuilt chore composer, chore streak, holiday pause, bonus settings and bonus explainer (`frontend/src/rebuild/family/`) in three locales, light/dark, 375/1280 px, mounted in the Tasks, Family and Banking routes | In progress: implementation and local verification recorded (native PostgreSQL over the actual migration chain, 77 new Core tests, 37 new component/copy tests, 12 real-Chrome configurations); full Supabase stack run, types regeneration, B.21 adoption of the model, copy/native review, production baselines and Product acceptance pending |

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
