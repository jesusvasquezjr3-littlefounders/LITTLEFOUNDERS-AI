# S07: Family Hub and independent teen wallet

Status: in progress. Started 24 September 2026; S07.2 recorded 25 September 2026. Owner: Engineering for implementation; Product, Safety/Trust and the Block D Engineering Lead (Appendix H Stage 0 pairing) for the reviews named by the SPEC. No release approval is recorded.

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
