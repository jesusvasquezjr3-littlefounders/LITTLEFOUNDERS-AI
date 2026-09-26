# Family Hub and Digital Banking data: retention, deletion and consent

**Status:** written policy for Product 10 D.21, proposed by Engineering (S07.7, 2026-09-24) on the SPEC's conservative default. The periods are proposals awaiting Product and Legal review (owner log OD-10: Legal validates before launch). The SPEC (`docs/littlefounders-spec/`) and the owner decision log win over this file. A change here without the matching change in the code is a defect, and `agent/tools/check-block-d-retention.mjs` fails on it.

**Why it exists.** Block D records a rich picture of a child's family life: chores and when they were done, a Tutor's yes and "not yet" with the reasons written to the child, the child's own notes, spending limits, freezes and coin corrections. No real money moves, and that is not a shield: the FTC's 2025 COPPA amendments ask for data minimization and a disclosed retention policy, and state age-appropriate design codes would reach the 13 to 17 band (Appendix G §4.6). This policy is written ahead of full regulatory clarity, as D.21 asks.

## Principles

1. **Keep what the family owns, delete what only described a moment.** The coin record (the ledger the balances are computed from, pockets, goals, rules, the streak's practised days) belongs to the child and lives as long as the account. A decision, a reason, a note, a photo or a behaviour event described one moment: it has a period.
2. **Whole rows, never quiet edits.** Retention deletes a row; it never rewrites an immutable record. Every reference to a deleted row was already an `ON DELETE SET NULL` or `CASCADE` that the S07.1 to S07.6 guards accept, so a deletion can never break a balance.
3. **An erasure removes the person.** Deleting a child's account deletes every Block D row about them. Deleting an adult's account removes their identity from the child's record and keeps the child's record (see Erasure).
4. **Nothing leaves.** Block D data is not shared with advertisers or with the Mentor's AI providers, and no Block D field is part of the Mentor's context. Behaviour analytics are consent-gated.
5. **What the family reads is what happens.** The Tutor reads these periods on the Family screen ("Your family's data"). Core serves them from the same constants the database enforces, and a gate keeps the two equal.
6. **Published before sign-up.** Since S07.8 the marketing FAQ answers "How long do you keep chores, rewards and decisions?" with the photo and record periods in three locales (`faq.items.familyRecords`); the gate fails if its numbers differ from the enforced periods or it leaves the page.

## Periods

| Class | Period | Counted from | What happens |
|---|---|---|---|
| Photos (`evidence`) | 30 days | the Tutor's decision on the chore | the photo is deleted from Depot, then the chore's pointer is cleared |
| Records (`records`) | 400 days | each row's own timestamp | the whole row is deleted |
| Invitations (`invites`) | 30 days | the invitation's use or expiry | the whole row, and its token, is deleted |
| Research (`research`) | 1,100 days | the snapshot's month | the snapshot is deleted; every snapshot is deleted at once on a no |
| The coin record (`account`) | while the account exists | | deleted with the account |

The 400-day bound is the one `learning_events` (0025) and the Block D behaviour stream (S07.4) already use: long enough for a year-on-year look at a family's own history and for the D.17 track record (60 days) and every Appendix H window (at most 30 days), short enough that a child's notes and a Tutor's reasons do not outlive their purpose. The 30-day photo bound: a chore's photo exists so a Tutor can approve the chore; a month later it only keeps a picture of a child's room.

## What each table holds and for how long

Records (400 days):

- `tasks`: an approved or cancelled chore, 400 days after the decision, and only once its photo is gone (a chore is never deleted while a stored photo still points at it).
- `family_decisions`: every decision with its reason code and the reason the child read.
- `redemptions`: a denied reward request 400 days after the decision; a fulfilled one 400 days after it was given. An approved reward not yet given is an open promise and stays.
- `family_autonomy_requests`: an answered level request.
- `family_autonomy_changes`: a level change and its reason (the current level lives in `family_autonomy_levels`).
- `family_autonomy_eligibility_log`: the first day a child became eligible for a level.
- `family_talk_nudges`: a closed "talk about it" nudge.
- `family_denial_reason_scores`: a person's score of a reason's actionability.
- `family_state_audit`: a state transition. It holds opaque ids and states only (no name, note or amount); an erasure clears the acting adult's id at once (ON DELETE SET NULL, the same as the platform audit log), any other id it holds resolves to nothing, and the row goes within 400 days.
- `share_gifts`: a settled Share gift and its note (the ledger line of what was given stays).
- `wallet_guardian_actions`: a Tutor's coin correction and its written reason (the ledger line stays).
- `goal_next_steps`: an answered next-goal prompt.
- `parent_coaching_deliveries`: a delivered monthly tip and whether it was opened.
- `family_decision_reflections`: whether the reflective prompt was written, shared or skipped. The Tutor's words are never stored.
- `family_money_events`: a consent-gated behaviour event (S07.4).
- `staff_insight_checks`: a staff insight health check (no identity).
- `family_retention_runs`: what each retention run deleted (counts only).

Invitations (30 days): `guardian_invites`.

Research (1,100 days): `family_research_snapshots`, see the research plan (`BLOCK-D-LONGITUDINAL-RESEARCH-PLAN.md`).

Kept while the account exists: `wallet_ledger`, `wallet_self_actions`, `wallet_split_preferences`, `pending_credits`, `banking_accounts`, `savings_goals`, `savings_bonus_rules`, `savings_bonus_explanations`, `allowance_rules`, `spend_limits`, `redemption_catalog`, `personal_rewards`, `share_destinations`, `chore_streak_days`, `chore_streak_pauses`, `kid_task_streaks`, `family_autonomy_levels`, `guardian_links`, `money_bridge_progress`, `family_research_consents`, `family_research_participants`. The streak's practised days and pauses are kept on purpose: D.2 promises that the best streak and the total are never erased, and past runs are computed from them.

Spending configuration (`spend_limits`, `allowance_rules`, `savings_bonus_rules`) is the setting in force; a changed setting replaces the previous one, and the platform audit log (`audit_logs`, governed with the staff console, Block G) records who changed it.

## Erasure

- **A child's account** (a Tutor deleting a child, the child's own request where allowed, or A.1's 90-day suspension purge, all through the S08 lane's E.6 erasure lifecycle): every Block D table keyed by the child cascades from `auth.users`, so every row about the child goes in the same transaction. The S07.7 verifier deletes a 15-year-old with rows in 19 Block D tables and finds none afterwards. Task photos are listed by the erasure's inventory and deleted from Depot by its Depot step.
- **An adult's account** (a Tutor): the child's record stays, and the departed adult's identity leaves it. Every column that records who acted (who wrote a ledger line, decided a reward, opened or froze an account, set a rule, settled a gift, made a correction) becomes NULL. A frozen account stays frozen with no recorded freezer, which the database treats as the Tutors' freeze, so a child still cannot lift it. A rule the departed Tutor set keeps running, so an erasure never stops a child's allowance; another Tutor can change it. The chores and the reward list that Tutor created are deleted with them (their chores' decisions go too); the coins those chores earned stay in the ledger. Migration `family_erasure_provenance` makes this possible: before it, deleting any Tutor who had used the Family Hub failed, and once the S08 lane's provenance change is merged the S07.1 ledger guard would have refused the cascade.
- A deleted account's opaque id can remain in `family_state_audit` as the id of the row that changed (never as the actor, which the erasure clears) until its 400 days pass. It no longer resolves to anyone.

## Consent

- **Behaviour analytics** (`family_money_events` and every Appendix H diagnostic built on it): the H.1 gate. A child in a family only with the Tutor's analytics consent, a self-registered teen only with their own opt-in, never a guest. Revoking consent stops new events at once; the 400-day period removes the rest. (Cross-lane finding, recorded in the sprint record: the H.1 gate currently excludes a parent-created child under 13 even with consent.)
- **Research** (`family_research_*`): a separate, specific consent (D.22): a verified Tutor for a child under 18, an adult only for themselves. A no from the Tutor or from the participant (a child's own no counts) deletes every snapshot at once. A Tutor's yes lapses at 18.
- **Everything else** is the service itself: a chore, a decision, a balance. It exists because the family uses the Family Hub, and it follows the periods above.

## Who else sees it

Nobody outside LittleFounders' own services. Hosting providers process it on LittleFounders' behalf. Google Analytics runs on public marketing pages only, never on the product (`frontend/src/lib/analytics.tsx`), and no Family Hub surface imports the analytics module. The Mentor's context schema (`oracle/src/context/schema.ts`, pinned to 14 fields) carries no Block D field, so nothing here reaches an AI provider. The gate fails if either changes.

## How it is enforced

| Mechanism | What it does |
|---|---|
| `family_retention_sweep()` (migration `family_data_retention`) | deletes every row past its period, records the run and a maintenance-log row |
| `family_evidence_due()` / `family_evidence_cleared()` | lists photos due for deletion; clears a chore's pointer only for the matching object on a chore decided more than 30 days ago (the only update the task guard lets through for a decided chore) |
| `POST /api/v1/family-hub/internal/retention/run` | Core runs the sweep, deletes each due photo from Depot before clearing its pointer (a failed call keeps the pointer for the next night; an object shared with a chore that is not due is kept), and records the run |
| `.github/workflows/family-retention.yml` | runs it nightly at 03:15 UTC and fails loudly when Core does not report a run |
| `family_retention_compliance()` and `GET /api/v1/admin/family/retention-compliance` | Appendix H's Retention-Policy Compliance Audit: rows held past their period plus a two-day grace, per class and table. Zero everywhere is a pass |
| `database/scripts/verify-family-governance-postgres.py` | the adversarial proof on real PostgreSQL: the sweep deletes what is past its period and nothing else, the coin record survives, photos wait for Depot, erasures keep or remove exactly what this policy says |
| `agent/tools/check-block-d-retention.mjs` | keeps this policy, its registry, the migration, Core, the copy and the jobs equal |

## Release check

Before every release that touches Block D: `GET /api/v1/admin/family/retention-compliance` must answer `pass: true`, and `lastRun.ranAt` must be within the last two days. A failing audit blocks the release; the fix is to run or repair the sweep, never to widen a period to make the audit pass.

## Changing a period

A period changes only with Product and Legal review, in one change: `block-d-retention.json`, `family_retention_days()` (a new migration), the Core constant, this file, the published FAQ answer, and the family-facing copy if its wording depends on it. The gate fails on any partial change. Record the review in the Block D threshold log's history.

## Open

- Legal review of every period and of this text before launch (OD-10), including the COPPA amended rule's timeline and the state design codes for the 13 to 17 band.
- Native review of the family-facing copy in es-MX and pt-BR.
- The first production run of the compliance audit, and its baseline.
