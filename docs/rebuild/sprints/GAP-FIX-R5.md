# Gap-fix round 5

Lane records for the fifth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F5-mentor

Branch `codex/spec-fix5mentor`. Three audited gaps. Each was checked in the
code first and each was real.

### Gap 1: a stored Mentor memory note can be deleted (C.4, OD-18, S01.4)

Verified first: `backend/src/routes/tutor.ts` had no route that removes a
`learner_memory` row (the only `router.delete` handlers were the disposition
resets and the consent revoke), and the database had no function that clears
one (`decide_learner_memory_proposal`, `write_learner_memory_checked` and
`write_learner_memory_pair_checked` only write). `MemorySelfReview` and
`ChildMentorTalks` showed the current note read-only; their delete only
rejected a proposal.

| SPEC clause | What was built | Where |
|---|---|---|
| C.4 (self-review/deletion mechanism), OD-18 (approves or deletes every persistent note), S01.4 acceptance (visible deletion controls) | `clear_learner_memory(p_user, p_store, p_expected, p_actor, p_decided_by)`: service-role only; compare-and-delete of one store's row under the same advisory lock as the write path; one append-only `learner_memory_ledger` row with no text (actor `learner-self-deleted` or `guardian-deleted`, sha256 of the deleted note, sha256 of the empty string as the after hash); pending proposals of that store written against the deleted note are closed as rejected, decided by the deleter; a proposal computed from "no note yet" stays pending. Answers `deleted`, `absent` or `conflict`. A fifth parameter, `p_decided_by`, was added to the suggested signature because the proposals table requires a decider on every closed row | `database/migrations/0241_learner_memory_clear.sql` (number provisional; the orchestrator renumbers at merge) |
| same | `DELETE /tutor/memory/:store` (the owner; admitted only when `classifyMemoryReview` answers self-review or adult-direct; guardian-review is 403 GUARDIAN_MANAGED, hold is 403 AGE_EVIDENCE_REQUIRED) and `DELETE /tutor/kids/:kidUserId/memory/:store` (a verified guardian, re-checked on every call, audited without the text). Body `{ expected }` names the note on screen: a read failure is 502, a changed note is 409 NOTE_OUT_OF_DATE (checked before the write and again inside the database), no note is 404 | `backend/src/routes/tutor.ts`, `backend/src/services/tutorData.ts` (`clearLearnerMemory`) |
| same; Bible 02 §9.5 (destructive action behind a confirmation) | A secondary "Delete this note" action beside each current note in teen Settings (`MemorySelfReview`) and in the Family console (`ChildMentorTalks`), behind the rebuilt `ConfirmDialog` (destructive confirm), then a status line (deleted, changed, failed). Copy in EN, es-MX, pt-BR | `frontend/src/rebuild/memory/MemorySelfReview.tsx`, `frontend/src/routes/app/profile/TeenMemoryReviewSetting.tsx`, `frontend/src/rebuild/family/console/ChildMentorTalks.tsx`, `consoleApi.ts`, `rebuild/mentor/session/tutorApi.ts`, `rebuild-profile.json`, `rebuild-family.json` |
| C.4 via Appendix F 1.3 (Fracture-Closure Verification) | `check-mentor-minor-safeguards.mjs` check `memory-review` now requires the owner's delete to bind `classifyMemoryReview(user.id)` and refuse guardian-review and hold with 403, and the guardian's delete to re-check `isVerifiedGuardian` | `agent/tools/check-mentor-minor-safeguards.mjs` (+ test) |

Verification (local): 15 route tests in `backend/src/__tests__/tutor.test.ts`
(teen self-delete for both stores, adult direct, and the refused populations:
a linked child, a kid-role account with no link, an under-13 hold, another
teen reaching for someone's child, an unlinked adult, a Tutor for a kid with
no link, the child through the guardian route; 502 on eligibility, note and
guardian reads; 409 before the write and on the database race; 404; 400; the
audit row carries no text); the whole file passes (367). `node --test` on the
safeguards gate: 11 pass, including four new RED cases.
`database/scripts/verify-mentor-f5-postgres.py` on the lane's PostgreSQL 17.6
cluster (port 15720), all 241 migrations: compare-and-delete of one store, the
hashes-only ledger row, stale proposals closed and a from-nothing proposal
still applying, `absent`, the guardian stamp, four refused inputs, browser
roles denied, replay keeps rows. 5 new frontend tests (MemorySelfReview 17,
ChildMentorTalks 23, all pass). `check-migration-phase` and `check-migrations`
pass; the migration is declared contract (the classifier flags the DELETE in
the function body, as for 0118 and 0122) and must be applied by hand before
the Core release that serves the two routes.

Remaining: an adult has no screen for their own notes (the API admits them;
no SPEC surface asks for one). Assistive-technology and device evidence and
human review, as for the rest of C.4.

### Gap 2: the lesson's compact Mentor follows the lesson; the offer's choices are equal (Bible 08 §11, §3, §4; D9; B.8)

Verified first: `LessonStageSlot({ verdict })` passed only the verdict,
`CompactMentorStage` played `lessonStateFor(verdict)` (idle, acknowledging or
encouraging), `NarrationControl`, `WorkedExampleBoard` and `StepReplay` never
informed the stage, the guided-review offer rendered as the lesson layer's
sibling of the board (outside any stage context), and its choices were an
`accent` button and a default one.

| SPEC clause | What was built | Where |
|---|---|---|
| 08 §11 ("the same states as section 3": introduces, reacts, demonstrates beside the board); 08 §3 (encouraging when offering a guided review) | A counted stage-request store (`LessonStageRequestHost`, `useLessonStageRequest`) in the lesson layer, above both the lesson and the offer (a lesson without the layer gets its own). `NarrationControl` requests `speaking` while its line plays; `StepReplay` and `WorkedExampleBoard` request `demonstrating` while on screen; `GuidedReviewOffer` requests `encouraging` while open. The slot adds a 2 s introduction (`speaking`) when a segment mounts (boards remount per segment). `lessonStageStateFor` resolves: verdict reaction, then the offer, then speaking, then demonstrating, then idle; no path returns `celebrating` | `frontend/src/rebuild/learning/lessonStage.tsx`, `LessonLayer.tsx`, `segmentKit.tsx`, `StepReplay.tsx`, `WorkedExampleBoard.tsx`, `GuidedReviewOffer.tsx`, `CompactMentorStage.tsx`, `frontend/src/rebuild/mentor/stageStates.ts` |
| 08 §4 (two equal choices, never a default-accepted path); D9 | Both offer choices are the same (secondary) variant and size, marked `data-offer-choice`; neither takes focus | `GuidedReviewOffer.tsx` |
| 08 §7 (the still fallback shows the state the stage is in) | No new stills were needed: the GAP-FIX-R2 band stills already cover speaking (`ambient.idle.happy`) and demonstrating (`teach.explain`) for every character, both modes and both band shapes; a new unit test pins that every state a lesson can request has its band still | `frontend/src/rebuild/mentor/__tests__/stageStills.test.ts` |
| Verification harness | `verify-compact-stage.mjs` records every state the band shows from the first frame and adds five checks (intro, worked example light and dark, offer young and teen: settled state, the states seen, no celebration, equal and unfocused 48 px+ choices); `STAGE_ONLY=states` runs just these. Previews: `screen=workedexample&stage=1`, `screen=lesson&stage=1&offer=1` | `frontend/scripts/verify-compact-stage.mjs`, `frontend/src/rebuild/preview/registry/learn.tsx` |

Verification (local): `lessonStage.test.tsx` (7: intro then rest, verdict
wins, replay demonstrates and stops, a worked example demonstrates, narration
speaks exactly while playing, the offer beside the lesson encourages, counted
requests), `stageStates.test.ts` (13, the precedence and no celebration over
every combination), `stageStills.test.ts` (18), `wellbeingS053f.test.tsx`
(19, equal and unfocused choices in both registers), and the lesson player,
layer, authenticated-document and board-reset suites (all pass).
`verify-compact-stage.mjs` against the lane's dev server: the five new state
checks pass (the band was seen `speaking` then `idle`; `speaking` then
`demonstrating` with the `teach.explain` still; `encouraging` with
`feedback.retry.gentle` (6-9) and `ambient.listen` (13-17), choices 56 px and
equal).

### Gap 3: every mounted Mentor screen state is in a Bible audit state (08 §10 item 5, 08 §4, 02 §7 item 10, 06 §7, 03 §5)

Verified first: `frontend/scripts/audits/lanes/mentor.mjs` declared no state
for the goal-agreement chips, the stop-or-continue choice, the likely-answer
chips, the Thinking plate, the microphone level, the live error notice, the
transcript and grown-up sheets, the recap's "Finish now" chip or the
start-over ConfirmDialog, and no lane audited the four standalone Mentor
preview screens.

| SPEC clause | What was built | Where |
|---|---|---|
| 08 §10 item 5, 06 §7, 02 §7 item 10, 03 §5 | 19 new Mentor screen audit states spread over the child bands (goal, session-end, replies, thinking, recording, error, transcript, grown-up, recap, start-over), each with `readyAll` selectors that prove the state rendered; 10 states for the standalone previews (`mentor-session-end` with each closing script, `mentor-goal-check`, `mentor-alliance-check`, `mentor-profile` own and child) | `frontend/scripts/audits/lanes/mentor.mjs` |
| same | Preview openers `?recap=1` (the OD-28 recap's one "Finish now" chip) and `?dialog=start-over` (the start-over ConfirmDialog), both only in a conversation, through a new `initialConfirmRestart` prop | `frontend/src/rebuild/mentor/screen/MentorScreenPreview.tsx`, `MentorScreen.tsx` |

Verification (local): `MentorScreenPreview.test.tsx` (3: recap chip, start-over
dialog, neither outside a conversation or by default) with the Mentor screen
suites (74 pass); the lane module loads with 63 unique state ids and every
`readyAll` selector was checked against the component source. Frontend
type-check and lint pass. No requirement row owns audit coverage, so no row
changed.

Remaining: the three audits (`npm run audit:rebuild`) have not measured these
states. Speed mode keeps browser runs with the orchestrator's final gate; an
earlier attempt in this lane was interrupted before it finished. Any finding
there is open until that run.

### Lane summary

Built: stored-note deletion for the owner and the verified Tutor (C.4, OD-18);
a compact lesson Mentor that introduces, demonstrates and encourages, with
equal guided-review choices (08 §11, §3, §4); audit states for every mounted
Mentor screen state (08 §10 item 5). Migration: `0241_learner_memory_clear.sql`
(provisional number, declared contract, apply by hand before the Core
release). Open: the orchestrator's UI audit of the new states; device,
assistive-technology and human review; nothing is accepted.

## Checkpoint F5-data-platform

Branch `codex/spec-fix5dataplat`. One audited gap: OD-9 section 4.1 (coins
must not be lost) and section 4.5 (row counts and per-family spot checks on
balances before and after), S10.1a.

The gap was checked in the code first and is real. The legacy schema keeps
coins a child is owed outside `wallet_ledger` until the child splits them:
`public.pending_credits` (0081, allowance payouts with `allocated = false`)
and approved tasks with `tasks.allocated = false` (0075). The rebuild still
uses both (0093, 0159 and 0163 write them; Core's `getPendingCreditsForKid`
and the rebuilt `ChildCoins` split flow read them). Before this checkpoint
`od9.inventory_categories()` hashed coins only from `wallet_ledger`, the
`chore_history` hash left out `allocated`, the spot check reported only the
ledger's coins per pocket, and the synthetic fixture never created an
unsplit payout or an unsplit chore reward. A cutover defect that dropped or
double-allocated owed coins would have passed `compare` and the section 4.5
sign-off sheet with zero failures.

### What was built

- `database/migration-od9/sql/10_inventory.sql`: two new categories.
  `pending_coins` hashes every `pending_credits` row per child (id, amount,
  source, allocated, created_at, ordered by id), split or not, so a lost row
  and a flipped `allocated` both fail. `owed_task_rewards` hashes the
  approved, unsplit chores with a reward above zero (a zero-coin
  contribution, 0158, is never split). `chore_history` now also hashes
  `allocated`. The inventory captures 18 categories (was 16).
- `database/migration-od9/sql/50_spot_check.sql`: a readable
  `owed coins (unsplit)` item per sampled account, the sum of unallocated
  `pending_credits.amount` plus unallocated approved `reward_coins`, shown
  only when above zero.
- `database/migration-od9/fixtures/generate-legacy-fixture.mjs`: every kid
  with a Family Hub record may get unsplit allowance payouts, an already
  split payout (with its ledger row) and an approved, unsplit chore reward.
  `kid_a_one` always holds one unsplit payout and `kid_c` two, so the
  negative control has a target. New independent expectations: `owed`
  (coins per child), `pendingCredits`, `owedTasks`.
- `prove-od9-postgres.mjs`: the before inventory must count exactly the
  fixture's payouts and unsplit chore rewards; a spot check over every
  family on the legacy schema must read every child's owed coins exactly as
  the fixture computed them, and again after the whole chain, the toolkit
  and the catalog retirement. Negative control: deleting one of `kid_c`'s
  unsplit payouts fails `compare` at exactly `account:pending_coins:<kid_c>`
  and that family, and the spot check at exactly that child's owed coins.
- `rehearse-cutover.mjs`: R2 checks the same two counts; R12 adds the same
  negative control on the restored database for a child drawn from the
  section 4.5 sample (the streak control is reverted first so each control
  fails at exactly one place).
- `od9.test.mjs`: the new categories, the `allocated` column in
  `chore_history` and the spot item are pinned; the fixture's owed-coin
  expectation is recomputed from the SQL it writes.
- Docs: `database/migration-od9/README.md` (18 categories, owed coins),
  `docs/operations/CUTOVER-RUNBOOK.md` and `S10-CUTOVER.md` (spot-check
  contents), `docs/rebuild/REQUIREMENTS.md` (OD-9 note in the preamble; OD-9
  has no requirement row of its own).

No migration: the toolkit is installed by `od9 install`, not by the chain.

### Verification (local)

- `node --test migration-od9/od9.test.mjs`: 17 pass (2 new).
- `npm run od9:prove` on the lane's native PostgreSQL 17.6 (port 15770,
  data directory under `.lane-cache/pg`): 17 checks pass over the 240-file
  chain (82 legacy migrations, 158 applied over the legacy data). 20 payouts
  and 11 unsplit chore rewards counted; 18 children owe 192 coins, read
  identically before and after; 24/24 families identical, 331/331 spot
  values identical; the deleted 12-coin payout failed exactly at `kid_c`
  (21 before, 9 after) and its family.
- `npm run od9:rehearse` at the default 12 random families, at 0 and at 200
  (212 families): every phase passes, including both R12 negative controls.
- `database` checks and node tests (`check-migrations`,
  `check-migration-phase`, `check-family-lifecycle`, 72 node tests) pass;
  the untouched `railway-migrate.test.mjs` fake-transport harness was
  stopped after 30 minutes under the other lanes' load and left to the
  merge gates. Root `npm run spec:check` and `npm run secrets:check` pass.

### Remaining

- The production cutover run and the person's section 4.5 signature are
  owner steps (unchanged).
- The toolkit counts owed coins; it does not reconcile a payout against the
  allowance rule that produced it (`source_ref` is informational in 0081 and
  is not hashed).

### Owner questions

None (see the lane finish below).

## Checkpoint F5-data-platform-finish

Lane finish: sync with `codex/spec-migration-s02` (already up to date, no
conflict), an adversarial pass over the lane against OD-9 section 4.1 and
4.5, and the full `database` suite.

### Adversarial pass: what was still missing

Section 4.1 reads "nothing is lost that a family was promised", and the
lane's first checkpoint covered coins earned but not split. Coins a Tutor
promised for later were still invisible: `public.allowance_rules` (the
recurring allowance: amount, cadence, on/off, next payout) and
`public.savings_bonus_rules` (0081). A cutover that dropped or changed a
child's allowance would have passed `compare` and the sign-off sheet.

- `sql/10_inventory.sql`: `allowance_promise` hashes every allowance rule
  per child (id, Tutor, amount, frequency, anchor day, active, next run,
  created). `savings_bonus_promise` hashes the Tutor, the agreed rate, the
  next run and the creation time. 0159 deliberately moves an under-13
  child's percentage bonus to the fixed per-ten ratio (switching off a rate
  below it) and keeps the agreed rate in `reframed_from_rate_bp`; the
  category reads that rate through `to_jsonb` (so it also runs on the
  legacy schema, where the column does not exist) and leaves `active` out,
  because that reframe changes it on purpose. 20 categories.
- `sql/50_spot_check.sql`: `allowance promised` (for example `12 weekly`,
  `(paused)` when off) and `savings bonus promised (basis points)`.
- Fixture: allowance rules for about half the Family Hub children (always
  `kid_c`) and bonus rules for about a third (always `kid_a_one`, aged 8,
  at 500 bp, which 0159 reframes). New expectations `allowance` and `bonus`.
- `prove-od9-postgres.mjs`: counts and spot values before and after the
  full chain; asserts 0159 really reframed `kid_a_one` (500 to 1000) while
  the inventory and the sheet still read 500; negative control: lowering
  `kid_c`'s allowance by one coin fails `compare` at exactly
  `account:allowance_promise:<kid_c>` and that family, and the spot check
  at exactly that child's allowance.
- `rehearse-cutover.mjs` R2 checks both counts. `od9.test.mjs`: two new
  tests pin the categories, the spot items and the fixture's expectations.

Not added: `spend_limits` (a control on spending, not coins owed or
promised) and `banking_accounts` (card nickname and design); both are
still covered by the chain's own tests, not by the OD-9 inventory.

### Verification (local)

- `node --test migration-od9/od9.test.mjs`: 19 pass (2 new); the database
  checks and node tests of `npm test` (74) pass. The
  `railway-migrate.test.mjs` fake-transport harness (untouched) is left to
  the merge gates.
- `npm run od9:prove` on the lane's native PostgreSQL 17.6 (port 15970):
  19 checks pass over the full chain (82 legacy migrations, then 158). The
  before inventory holds 20 categories; 20 `pending_credits` rows, 11
  unsplit chore rewards (18 children owe 192 coins), 10 allowance rules and
  5 savings bonus rules, all read the same after the chain; 24/24 families
  identical, 346/346 spot values identical; `kid_a_one`'s 500 bp bonus is
  reframed by 0159 to 1000 and still reads 500. Negative controls: a
  deleted 12-coin payout fails at exactly `kid_c`'s `pending_coins`, its
  family and its owed coins (21 to 9); a one-coin lower allowance fails at
  exactly `kid_c`'s `allowance_promise`, its family and its allowance
  (35 monthly to 34 monthly).
- `npm run od9:rehearse` (default 12 random families): R0 to R12 pass
  (13 checks, 66 s; R2 22 categories and identifier sets, R8 24/24
  families and 116/116 spot values, R12 restore 24/24).
- Root `npm run spec:check` and `npm run secrets:check`: pass.

### Lane summary

- One audited gap (OD-9 section 4.1 and 4.5, S10.1a): coins owed but not
  split and coins promised for later are now inventoried, hashed per child
  and family, shown on the section 4.5 sign-off sheet, held by the
  synthetic fixture and proven on native PostgreSQL with a negative control
  per kind. No migration (the toolkit is installed by `od9 install`), no UI,
  no copy.
- Status: implemented and locally verified; not accepted, not released.

### Remaining

- The production cutover run and the person's section 4.5 signature are
  owner steps.
- The toolkit does not reconcile a payout against the rule that produced it
  (`pending_credits.source_ref` is informational in 0081 and not hashed).
- A savings bonus switched off by something other than 0159 is not
  detected (`active` is not hashed; see above).

### Owner questions

None.

## Checkpoint F5-staff-ops

Branch `codex/spec-fix5staffops`. Three audited gaps. Each was checked in the
code first and each was real:

1. `release_course(uuid)` (0112) and `release_lesson(uuid)` (0113) took no
   actor, checked no grant and wrote no audit row; Core committed the release
   and then posted the audit row separately (a failure was only
   `console.error`'d), and a rejection, return to review, unpublish or
   archive was a PostgREST PATCH whose audit insert result was ignored. No
   trigger on `courses` or `lessons` audited anything. A release that lost its
   row also dropped out of the `content_bypass_metrics` denominator.
2. `revokeRoleChecked` / `revokeAdminPermissionChecked` issued a service-role
   DELETE; the audit triggers (0003, 0030) took `COALESCE(jwt sub,
   OLD.granted_by)`, and the service key has no `sub`, so every revocation
   was recorded under the original granter. No revocation wrote a
   `staff_access_reviews` row (the console only records 'kept').
3. `docs/operations/GOVERNANCE.md` section 5 had no internal notification
   chain and no review cadence, owner or date.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | G.3 (non-negotiable; "consistent with how course and lesson status changes are already treated"); Appendix N 1.2 (Release-Verification Bypass Rate, publish event log from the staff console and the CLI; the second-write-path note); G.2 | Migration `audited_content_release` (expand): `release_course(p_actor, p_course_id)` and `release_lesson(p_actor, p_lesson_id)` keep the 0112/0113 bodies (the static pins still hold), refuse with `FORBIDDEN` unless the actor is a superadmin or an admin holding manage_content (`content_release_actor_allowed`, 0221), and insert `admin.course.release` / `admin.lesson.release` in the same transaction (a course retry that changes nothing writes none). `set_course_status(actor, course, draft or archived)` and `set_lesson_status(actor, lesson, draft, review or archived)` lock the row, move it and insert `admin.course.set_status` / `admin.lesson.set_status` {status, from} together; publishing there is `USE_RELEASE`, the current status is `UNCHANGED` with no row. Migration `content_status_contract` (contract, after the Core release): drops the one-argument releases; `guard_release_only_publication` now refuses, for anon, authenticated and service_role, every course or lesson status change, except the Forge upsert of a lesson into review, whose demotion of a published lesson writes `content.lesson.demoted` (no staff actor) in the same statement. Core `setCourseStatus` / `setLessonStatus` call the four RPCs with `authedUser(res).id`, answer 502 on any unconfirmed receipt (failed request, empty or unreadable row), map `FORBIDDEN` to 403, and no longer post an audit row themselves. `publish-course.sh` passes `LF_RELEASE_ACTOR` (uuid-checked) or the local superadmin with the oldest grant | `database/migrations/0242_audited_content_release.sql`, `database/migrations/0244_content_status_contract.sql`, `backend/src/services/adminData.ts`, `backend/src/routes/admin.ts`, `database/scripts/publish-course.sh`, `database/scripts/test-publish-course.sh`, `database/scripts/verify-course-publish-postgres.py`, `backend/src/__tests__/admin.test.ts` |
| 2 | G.1 (permissions stored, displayed and audited; Law 5); G.4; Appendix N 1.1 (Access-Review Cadence Compliance and Stale-Grant Rate from the access-review log); Appendix N Part 3 Stage 4 | Migration `staff_grant_revocation` (additive in effect, declared `contract` because the phase classifier flags the DELETE statements in the new function body, the 0208 precedent; applied by hand BEFORE the Core release): `audit_role_change` and `audit_admin_permission_change` take the actor from the jwt `sub`, then the transaction-local `lf.actor`, then (INSERT/UPDATE only) `granted_by`; a DELETE with no actor records NULL and keeps the granter as `grantedBy` in the detail. `revoke_staff_grant(p_actor, p_subject, p_kind, p_grant)`, service role only: superadmin actor (`ACCESS_REVOKE_FORBIDDEN`), never the actor's own superadmin role (`ACCESS_REVOKE_SELF`), sets `lf.actor`, deletes the role or permission, and for an elevated grant records the review 'revoked' through `record_staff_access_review` (review row plus `admin.access.reviewed`), one transaction; returns 'revoked' or 'not_held'. The role triggers (domain, kid guardian, parent cascade, admin grant) still refuse. Core `/roles/revoke` and `/roles/permissions/revoke` call it with the caller's id: 200 (`revoked` true, or false when not held), 403 on the actor refusal, 409 `ROLE_REJECTED` on a trigger refusal, 502 when unconfirmed. The service-role DELETE helpers were removed. The console needs no change (it already reloads the review card after a removal) | `database/migrations/0243_staff_grant_revocation.sql`, `backend/src/services/adminData.ts`, `backend/src/services/supabaseRest.ts`, `backend/src/routes/admin.ts`, `database/scripts/verify-staff-ops-postgres.py`, `backend/src/__tests__/admin.test.ts`, `frontend/src/rebuild/staff/console/StaffAccess.tsx` (comment) |
| 3 | H.5 (b) (who inside the company is notified); Appendix O 1.2 (plan present and reviewed annually or after any incident); Appendix O Part 3 Stage 3 | GOVERNANCE.md section 5 gains the internal notification chain (Owner and Engineering lead within 1 hour, Safety/Trust lead within 4 hours, Legal within 24 hours or 4 hours when a minor's data may be involved; each by phone or direct message plus the `ops-watchdog` issue, no personal data in the issue; escalation when a step is not acknowledged) and a Plan review bullet (at least yearly, 366 days at most, and after every incident; owner the Safety/Trust lead; Last reviewed 2026-09-29). `check-staff-standing-constraints.mjs` (in `spec:check`) now also fails when section 5 lacks the chain, one of the four roles in order, a channel or a time limit per step, the annual and after-incident cadence, the review owner or the date, or when the date is more than 366 days old or in the future | `docs/operations/GOVERNANCE.md`, `agent/tools/check-staff-standing-constraints.mjs` (+ test) |

### Verification (local)

- Native PostgreSQL 17.6 (lane cluster `.lane-cache/pg`, port 15750), whole
  chain of 243 migrations: `verify-course-publish-postgres.py` 16 checks
  (exactly one audit row per decision with the staff actor, a failed audit
  insert rolls back the course release, the lesson release, the lesson
  takedown and the course takedown, a non-content admin is refused for each
  of the four functions, the one-argument signatures are gone, the service
  role cannot PATCH a status except the Forge move into review and the
  demotion is recorded, no browser role calls the functions);
  `verify-staff-ops-postgres.py` 30 checks (the revoking superadmin is the
  audit actor with the granter kept as `grantedBy`, the review row and
  `admin.access.reviewed` land, a non-superadmin, missing actor, unknown
  kind and self-revocation are refused, a failed review write keeps the
  grant, a direct DELETE records no actor, browser roles refused). The whole
  `staff:db-verify` gate on the same cluster: 9/9 verifiers pass over the
  whole chain (content release, staff ops, data platform, course publish,
  admin permissions, analytics disclosure, analytics, Mentor quality audits,
  origin).
- `database`: `check-migrations`, `check-migration-phase`, the node tests of
  the phase gate, auto-apply gate, publish CLI boundary (bash) and the
  db-verify runner self-tests (37 pass).
- Backend `type-check`, `lint`, `admin.test.ts` (116 pass: the RPC bodies
  carry the actor, no PATCH, DELETE or separate audit write, every 502 path,
  FORBIDDEN mapping, every revoke outcome). Frontend `type-check`.
- `node --test agent/tools/check-staff-standing-constraints.test.mjs` (10),
  root `spec:check`, `secrets:check`. No copy changed (no i18n run needed).
- Finish pass (after the lane was stopped): stale lane test processes were
  stopped, the 0243 header was declared `contract` so `check-migration-phase`
  agrees with its SQL, and the branch was merged with the integration
  branch (already up to date). Re-run green: `check-migrations`,
  `check-migration-phase` (+ phase and auto-apply gate tests, 20), the
  publish CLI test, backend `type-check`, `lint`, `admin.test.ts` (116),
  `check-staff-standing-constraints` tests (10), `spec:check`,
  `secrets:check`. The native PostgreSQL verifiers were not re-run: only a
  comment header changed since their 16 + 30 and 9/9 passes.

### Remaining

- Deploy order: 0242 (expand, auto-applies) and 0243 (declared contract,
  applied by hand; it deletes nothing on apply) must both be in place BEFORE
  the new Core, whose revoke routes answer 502 without 0243. The new Core must
  be live before 0244 (contract) is applied by hand, since 0244 drops the
  signatures the current Core calls and refuses its status PATCH.
- `database/types/database.ts` still lists `release_course(p_course_id)` and
  `release_lesson(p_lesson_id)` and lacks the new functions: it is generated
  (`db:types`) against the local stack, which this lane may not touch.
- `account_erasure` (0118) deletes roles with no session actor, so those rows
  are now recorded with a NULL actor (system) instead of the original
  granter; naming the erasing actor there would need that function to set
  `lf.actor`.
- The first staff:db-verify run in CI on the new verifiers; acceptance by
  Trust and the owner; production evidence of the audit rows.

### Owner questions

- Default taken for H.5: the chain names roles, not people, with the time
  limits above; the owner confirms the people and their phone and message
  channels, and the next review date follows from that confirmation.
- Default taken for G.3: the Forge pipeline may still move a lesson into
  review (including an archived one) without a staff actor, because that is
  content entering the human gate; a demotion of a live lesson is recorded as
  `content.lesson.demoted`. Every other status move needs a staff actor.

## Checkpoint F5-social

Branch `codex/spec-fix5social`. Three audited gaps. Each was checked in the
code first and all three were real:

1. Both request queues offered only Approve/Deny (`SocialRequests.tsx`) or
   Accept/Decline (`TeenConnections.tsx`). `PendingConnection` carried no
   requester id, Core's guardian report route admitted only a current
   connection or a notice subject (a pending requester got 404), and a decline
   is not an input of `evaluate_social_pattern` (reports and blocks only).
2. `badgeShares` had no line about previews a messaging app cached before
   revocation, in any locale, and ACHIEVEMENT-SHARING.md said the F.2 caveat
   "no longer applies", true only for new image shares.
3. `repo-gates.yml` ran the family, identity and staff database proofs but no
   social job; `social-db-verify.mjs` ran only in the paths-filtered
   `database-ci.yml` and in the operator's release readiness.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | E.3 ("a path to act on a concern"); OD-8 hotfix list (a report action for unwanted contact); D-19 (the 20-request cap, the 30-day cooldown and the E.3 pattern trigger); Block E component 2 | Core `POST /family/kids/:kidId/social/requests/:requestId/report`: `guardKid` before and after the write, the bounded `GuardianReportBody`, no query fields, admission by the request addressed to THIS child (pending, or `denied`/`revoked` in the last 30 days; anything else is a 404 that says nothing), the session guardian files `submit_social_report(guardian, requester, ...)`. Core `POST /profile/connection-requests/:requestId/report` and `/block`: the request addressed to the session (pending, or `declined`/`removed`/`withdrawn` in the last 30 days), addressed by request id so the requester's profile visibility is never needed; the session is reporter and blocker (the block is the session's own write, so the audited blocks trigger closes the request and feeds the pattern). The Tutor's queue gets Report per row (the shared `ReportDialog`; reporting does not decide the request); the teen's queue gets Report and Block per row (Block behind a `DestructiveAction` confirmation). Copy in en-US, es-MX and pt-BR (`socialRequests.report/reported`, `teenConnections.report/reported/block*`) inside the copy budget and both tone gates (keyed exceptions for "safety team", the same as the existing report receipts). `social:check` section 10 pins the routes, the 30-day window, both queues and the database proof; SOCIAL-TIERS.md section 1.4 states the rule. Audit states: `/family@connection-request-report`, `/profile@teen-request-report`, `/profile@teen-request-block` (each dialog opened by a real press). `verify-social-request-report-postgres.py` (in `social:db-verify`) proves on the whole chain: three teens declining one adult open nothing and the adult waits 30 days; three teens reporting one requester from their queues (pending or already declined) cross the pattern threshold, two do not, and a report leaves the request pending; three teens blocking from their queues open a `pattern` case, each block closes that request (`removed`) and the adult cannot ask again; a Tutor's queue report opens a `report` case on its own, is idempotent, and does not count toward the three-minor pattern | `backend/src/routes/family.ts`, `backend/src/routes/profile.ts`, `backend/src/services/supabaseRest.ts` (`requestStillActionable`, `getGuardianReportableRequest`), `backend/src/services/socialTier.ts` (`getTeenActionableRequest`), `frontend/src/rebuild/social/{SocialRequests,TeenConnections,ReportDialog,guardianConnectionsClient,teenConnectionsClient}.ts(x)`, `frontend/src/rebuild/design/overlays.tsx` (optional `disabled` on `DestructiveAction`), `frontend/src/routes/app/family/SocialRequestsPanel.tsx`, `frontend/src/routes/app/profile/TeenConnectionsPanel.tsx`, `frontend/scripts/audits/lanes/{family,profile}.mjs`, `agent/tools/check-social-tiers.mjs` (+ test), `agent/tools/{social,family}-copy-tone.lexicon.json`, `database/scripts/verify-social-request-report-postgres.py`, `docs/rebuild/policies/SOCIAL-TIERS.md` |
| 2 | F.2 (b) (the cached-preview caveat accepted and disclosed to the parent per F.3); OD-20 (F.2's revocation remains the control for legacy links); Appendix L Part 2.1(2) | `badgeShares.cachedPreview` ("Apps that already showed a preview of a link may keep it.") rendered beside `legacyNote`, and the revoke receipt `badgeShares.revoked` repeats it ("Link revoked. Previews other apps already made may stay."), in three locales, inside the copy budget and both tone gates with no exception. ACHIEVEMENT-SHARING.md section 3 records the caveat as accepted and disclosed for legacy links, with the table of the six strings, and no longer says the caveat is gone. `sharing:check` section 7 pins the panel render, both keys in every locale (each must name the preview) and the policy sentence until `BADGE_LINK_ROUTE_RETIRES_AT`; after that date the pin lifts (tested) | `frontend/src/i18n/*/rebuild-family.json`, `frontend/src/rebuild/family/BadgeShares.tsx`, `docs/rebuild/policies/ACHIEVEMENT-SHARING.md`, `agent/tools/check-achievement-sharing.mjs` (+ test), `frontend/src/routes/app/family/__tests__/BadgeSharesPanel.test.tsx` |
| 3 | Appendix J 2.2 E.1 (c) (green in CI on every build); Appendix J 1.3 (Discoverability-Gate Enforcement Verification, every release, UI, API and data gateway); Part 3 Stage 2 | A `social-db-verify` job in the unfiltered `repo-gates.yml`, mirroring `family-db-verify` (PostgreSQL 17 service, Node 24, Python 3.12, `LF_PG_*`, `LF_PG_VERIFY_JOBS=3`, `node database/scripts/social-db-verify.mjs`), with a header citing E.1 (c) and 1.3. `social-db-verify.test.mjs` now asserts the list is non-empty and includes the discovery, guardian-end, pattern and new queue-report proofs, that both workflows carry the job, that `repo-gates.yml` stays unfiltered, and the npm and release-readiness wiring | `.github/workflows/repo-gates.yml`, `database/scripts/social-db-verify.test.mjs` |

Finish pass (same checkpoint): a decision was still the end of the path in
the UI, since a denied or declined row left the queue. The request the Tutor
just denied now keeps Report beside the receipt, and the request the teen just
declined keeps Report and Block (confirmed), until the next action; Core
already admits both for 30 days. Pinned in `social:check` section 10 (two
more mutation tests); unit tests in `SocialRequestsPanel.test.tsx` and
`SocialTiers.test.tsx` (three locales). Where: `rebuild/social/{SocialRequests,TeenConnections}.tsx`,
`routes/app/family/SocialRequestsPanel.tsx`, `routes/app/profile/TeenConnectionsPanel.tsx`.

No migration: the database already accepted every report and block these
routes file; the new admission is Core's, over service-role reads.

### Verification (local)

- PostgreSQL 17.6 (lane cluster, `.lane-cache/pg`, port 15740):
  `social-db-verify.mjs --only request-report` passes over the whole
  migration chain (6 checks). The other social verifiers were not re-run
  (nothing under `database/migrations` changed); the merge gate runs them.
- Backend: `type-check`, `lint`; `socialRequestReports.test.ts` (31: the
  30-day window, every refused population for both routes: anonymous, an
  unlinked or pending-link child, a guardian without current verification,
  another child's or another teen's request, an approved or accepted one, an
  old one, a malformed id, a query field, an unknown body field, the requester
  itself, unreadable rows, an unconfirmed report or block, the link revoked
  during the write), `familySocialGuardianEnd.test.ts`, `socialTiers.test.ts`.
- Frontend: `type-check`, `lint`; `rebuild/social` (report and block from the
  teen queue in three locales, client receipts), `SocialRequestsPanel`
  (report on a matching receipt, the dialog kept on a mismatch),
  `BadgeSharesPanel`, the Family page and social refresh suites,
  `rebuild/design`, `rebuild/family`, `rebuild/account`, `rebuild/preview`,
  every copy-budget suite.
- Root: `spec:check`, `secrets:check`, `sharing:check` (+ 10 node tests),
  `social:check` (+ 31 node tests), `social-db-verify.test.mjs` (3), both tone
  gates at 100%, the i18n gate.
- Finish pass: frontend `type-check`, lint of the touched files, `rebuild/social`,
  `SocialRequestsPanel` and `routes/app/profile` suites (12 files, 130 tests);
  `social:check` (+ 31 node tests); `spec:check`; `secrets:check`. No copy
  changed. Merged with `codex/spec-migration-s02` (already contained).
- Not run here (speed mode, merge gates): the audit matrix for the three new
  states, the full suites, `test:all`.

### Remaining

- The first CI run of the new `social-db-verify` job in `repo-gates.yml` is
  the evidence that the job runs on a GitHub runner.
- The three audit states were added but not executed in this checkpoint.
- Acceptance: Safety/Trust review of the queue actions and of the cached
  preview disclosure; nothing is accepted.

### Owner questions (conservative default implemented)

- A Tutor's report from the request queue is filed with the Tutor as the
  reporter (as the Family graph and notice reports are, and as the gap's fix
  text states). It opens a staff review case on its own, but, the Tutor being
  an adult, it does not count toward the three-unrelated-minors pattern.
  Should a guardian's report on a child's behalf count as the child's for the
  pattern? (Same open question as GAP-FIX-R3 social.)
- A request stays reportable for 30 days after it closed without a
  connection (the same window as the teen decline cooldown). Default taken;
  the owner may prefer a different window.
- No "deny and report" single action was added (the gap listed it as
  optional): the Tutor may report before deciding, and after a denial Report
  stays beside the receipt; Core admits a denied request for 30 days.

## Checkpoint F5-design-system

Branch `codex/spec-fix5designsy`. Two audited gaps in the design-system area.
Both were checked in the code first and both were real. One more defect
surfaced while wiring the second: the Mentor-stage verifier had drifted from
the product and could not pass (below).

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | Bible 02 rule 2 (no glass, no gradients), D13 and rule 23 (the legacy look is rebuilt, never carried over); 04 §2 (duration and easing tokens), §3 (reduced motion); 02 §9.4 (idle motion on three things only); 07 §3 | The inline boot veil every page shows during the bundle download is rebuilt. It was an 18 px `backdrop-filter` blur (also animated in `lf-boot-out`), a breathing `radial-gradient` bloom on an infinite 2.4 s loop and a 560 ms `cubic-bezier(0.22, 1, 0.36, 1)` dissolve. It is now an opaque `--base` ground with nothing on it, which alone hides the prerendered shell. The `@supports` block, the reduced-motion `!important` override and the bloom pseudo-element are gone. The dissolve is `--dur-transition` (380 ms), with the veil leaving on `--ease-exit` and `#root` arriving on `--ease-enter`, and it exists only under `prefers-reduced-motion: no-preference`. With reduced motion the veil cuts away. The fail-open deadline (30 s CSS timer plus the `load`-armed release) is kept. It is now a `step-end` timer, so nothing moves and it still runs under reduced motion. The release script's fallback duration is 0, not a second copy of a number. `bootVeil.test.ts` holds the inline stylesheet (the one product stylesheet outside `src/rebuild`) to the rule 2 and 04 §2 contract. It checks for no `backdrop-filter`, filter, gradient or shadow, no `@supports` or `!important`, and no pseudo-element bloom. It also checks that every duration literal is the dissolve token copy or the deadline, that every `cubic-bezier` is `--ease-exit` or `--ease-enter` read from `tokens.css`, and that no keyword curve or `infinite` is used. Outside the no-preference query, only the two `step-end` deadline animations are allowed. Keyframes may animate opacity only. Run against the legacy file, 10 of these tests fail. | `frontend/index.html`, `frontend/src/__tests__/bootVeil.test.ts`, citations in `frontend/src/App.tsx` and `frontend/src/lib/boot.ts` |
| 2 | Bible 02 §7 item 10 and 06 §7 (text fit and copy budget before merge); 03 §5 (proportion); 05 §8 (board rules); 08 §9 (stage verification); CLAUDE.md SPEC rule on UI merges | **One gate command.** `frontend/scripts/rebuild-audit-gate.mjs` (`npm run audit:gate -- --suite audits\|mentor-stage\|all`; root `npm run rebuild:audit-gate` runs `all`) runs the predev decoder copy and starts Vite on a strict port (`AUDIT_GATE_PORT`, default 5310). It then runs `audit-rebuild.mjs all` and/or `verify-mentor-stage.mjs` against that server, stops it, and exits with the worst code (0 clean, 1 findings, 2 setup). With no Chrome it prints SKIP and exits 0, unless `--require-chrome` is given, in which case it exits 2. `browser.mjs` exports `findChrome()`. **Sharding without trimming.** `AUDIT_SHARD=k/n` (`shardStates` in `audits/states.mjs`) splits the state list round-robin into disjoint, balanced shards. Each report records `shard`, `filtered` and the `[signature, state]` pairs. `scripts/audits/merge-shards.mjs` merges n reports and exits 2 unless every shard 1..n is present once, no shard was narrowed by `AUDIT_STATES` or a trimmed locale, theme or width list, every state in `states.mjs` was measured exactly once, and no two states in different shards render identical markup (the driver's own check, across shards). It sums configurations, merges finding groups by key and exits 1 on findings or JS errors. **CI.** `frontend-ci.yml` gains `rebuild-audits`: `needs: ci`, 12 shards, `fail-fast: false`, `scenes:fetch`, then the gate with `--suite audits --require-chrome`, `AUDIT_WORKERS=2` and `AUDIT_READY_MS=60000` (a shared runner is a loaded machine, as the driver header defines one). Each shard's reports are uploaded, and `rebuild-audits-report` merges them into the `rebuild-audits` artifact. The `browser-gates` job now runs the Mentor-stage verifier (`--suite mentor-stage --require-chrome`) and uploads `mentor-stage`, so its comment is true. frontend CD deploys only a green frontend CI, so all of these are deploy gates. **Release readiness.** `release-readiness.sh` runs `npm run rebuild:audit-gate` after the db-verify proofs. **Verifier drift fixed.** `verify-mentor-stage.mjs` still expected the chooser portrait (`/rebuild/mentor-chooser/liruf-<mode>.png`, pose `ambient.idle`) as the low-power, no-WebGL and data-saver still. Since W3M.1 the stage shows the same character in the pose its state plays (`/rebuild/mentor-stage/liruf-ambient-listen-<mode>.png`, `ambient.listen`), as `MentorStage.test.tsx` and `stageStills.test.ts` pin. The verifier now expects that. `agent/tools/rebuild-audit-gate.test.mjs` (in `tools:test`, so in the unfiltered repo gates) pins the partition, every merge refusal, the gate's suites and Chrome decision, and the CI and release wiring. | `frontend/scripts/rebuild-audit-gate.mjs`, `frontend/scripts/audits/merge-shards.mjs`, `frontend/scripts/audits/states.mjs`, `frontend/scripts/audit-rebuild.mjs`, `frontend/scripts/lesson-engine/browser.mjs`, `frontend/scripts/verify-mentor-stage.mjs`, `frontend/package.json`, `package.json`, `.github/workflows/frontend-ci.yml`, `agent/tools/release-readiness.sh`, `agent/tools/rebuild-audit-gate.test.mjs`, `README.md` |

### Verification (local)

- The rebuilt veil on the real dev server, in headless Chrome at 375 px, in
  light and dark with motion and in dark with reduced motion. While armed,
  the veil computes `backdrop-filter: none`, `background-image: none`, no
  `::after` content and the `--base` colour (rgb 244 245 253 / 11 13 27). Its
  only animation is the `steps(1)` 30 s deadline. After release, the
  attribute is gone, the veil is `display: none`, `#root` has opacity 1 and
  no animation, and there are no console errors. A screenshot of the armed
  dark veil shows a flat ground.
- The gate itself: `AUDIT_STATES=system,gallery,overlays AUDIT_SHARD=2/3`
  with one locale, mode and width measured exactly the one state of shard 2
  (`gallery`). It found 0 findings and exited 0. The Vite server and Chrome
  were stopped afterwards, and no lane process was left. `merge-shards.mjs`
  on that report exited 2, naming the narrowed matrix, the missing shards 1
  and 3, and the 440 unmeasured states.
- The Mentor-stage verifier through the gate (`--suite mentor-stage`) on this
  machine, before the orchestrator stopped the lane: the `stage` (48) and
  `states` (101) families passed, 149 of 149. The `modes` family failed the
  reduced-motion and low-power checks in every locale and mode (no-WebGL and
  data-saver passed), and the `lesson` family failed at 320 and 375 px (768
  and 1280 px passed). Both runs were stopped before the report was written,
  so the failing assertion is not recorded. An earlier `modes` run failed
  only because `public/scenes/` had not been fetched in this worktree
  (`diorama-a.glb` served as HTML), which CI's `scenes:fetch` covers. The
  lane's speed rules forbid further browser runs, so these failures are open
  (below). They are not caused by this lane's changes, which touch only the
  verifier's still expectation.
- Frontend `type-check` and `lint`. Focused vitest: `bootVeil`,
  `designClasses`, `galleryContract`, `controlsCss` and `stageStills`, 112
  tests. `node --test agent/tools/rebuild-audit-gate.test.mjs` passed 14
  tests. Root `spec:check` and `secrets:check` passed. No copy changed, so
  the i18n gate was not required.

### Decisions taken with the SPEC's conservative default (owner questions)

- The veil keeps no loading shape at all ("either nothing or the shimmer"):
  the boot window is short, the shimmer is busy motion reserved for a
  surface's own loading state, and nothing on the ground cannot break 02
  §9.4.
- The CI split is 12 shards, estimated from the measured 58 states in about
  20 minutes on the 16-thread machine, which extrapolates to about 150
  minutes for 441 states. That is roughly 12 runner jobs of 20 to 40 minutes
  each on every frontend push. This costs GitHub Actions minutes, not model
  spend (OD-23 is about paid generation), but it is a recurring cost the
  owner should know about.

### Commits

- `92f48a9e` fix(frontend): rebuild the boot veil from the Bible, without the legacy glass
- `5085caa9` ci(frontend): run the Bible audits and the Mentor-stage verifier in CI and release readiness

### Migrations

None.

### Open items

- The full 441-state matrix has not run in CI or locally in this lane. The
  first CI run is also the first full measurement, so it can surface existing
  findings. Because the job is a deploy gate, a red first run blocks frontend
  CD until they are fixed. The orchestrator's merge gate is the place to run
  it first, locally.
- The Mentor-stage verifier is red locally in two families (reduced motion
  and low power in `modes`; phone widths in `lesson`). Until each failure is
  read from a full report and fixed, in the product or in the verifier if it
  drifted again, the `browser-gates` job is red and blocks frontend CD. Run
  `npm run audit:gate -- --suite mentor-stage` from `frontend/` (or
  `MENTOR_STAGE_FAMILIES=modes,lesson node scripts/verify-mentor-stage.mjs`
  against a running server) at the orchestrator's end gate.
- The shard runtime on the GitHub runner is unmeasured. The 75-minute
  per-shard timeout is a guess to revisit after the first run.

## F5-family

Branch `codex/spec-fix5family`. Two audited gaps, both checked in the code
first and both real:

- **The three UI audits never rendered most Block D panels.** The real-app
  audits (`frontend/scripts/audit-rebuild.mjs`) measure only the states
  `frontend/scripts/audits/lanes/family.mjs` lists. Every per-child Block D
  panel on `/family` (corrections, streak pauses, Share places, the
  independence ladder, the Tutors, research, the data policy) starts closed
  and loads only when pressed, and no state pressed it; the synthetic Core
  answered none of their Tutor-side reads. On `/tasks` the reflective prompt
  (D.23), the "not yet" reason form (D.18), the child's reward ask and level
  ask were never opened; on `/family-wallet` the bonus settings (D.11) and the
  freeze confirmation were never opened, and `card()` was never frozen, so no
  frozen card (D.1/D.7) was measured for either reader.
- **Nothing scheduled the three quarterly Block D reviews.** Only the
  Appendix G recalibration had a due date and a `--strict` release check. The
  threshold log, the no-unbacked-guarantee audit and the scope-disclosure
  audit had no due date, no overdue check and no trigger; an engineering
  pre-audit row satisfied their gates.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | Bible 02 §7 item 10, 06 §7, 03 §5; CLAUDE.md audit rule; Appendix H Part 3 Stage 4; D.1, D.2, D.5, D.7, D.11, D.14, D.17, D.18, D.21, D.22, D.23 | The synthetic Core answers every Tutor-side read these panels make, in the shapes the client validators accept (`familyHubApi`, `familyMoneyApi`, `moneyHabitsApi`, `familyAutonomyApi`, `governanceApi`, `bankingApi`): the Tutors of a child (this Tutor, a second verified Tutor, a pending second Tutor, one who stepped away), goals with provenance, corrections and goal moves, approved rewards to deliver, the chore streak with an upcoming pause, Share places and gifts (pledged and given), a level-2 ladder with the Tutor's change, the child's research answer, and the bonus framing per child (per ten for the young child, a percentage for the teen). New scenarios: `money-child-frozen` (a Tutor froze it, read by the child), `money-tutor-frozen` (the child froze it, read by the Tutor), `money-child-level2`. 21 new press-opened or frozen states: `/family@wallet-corrections`, `@goal-move`, `@streak-pauses`, `@share-destinations`, `@autonomy-ladder`, `@co-tutors`, `@co-tutors-leave`, `@research-consent`, `@data-policy`; `/tasks@queue-reflection`, `@queue-not-yet` (press "not yet", then continue to the reason form), `@reward-ask`, `@level-ask`, `@level-step-down`; `/family-wallet@bonus-settings`, `@bonus-settings-teen`, `@freeze-confirm`, `@tutor-frozen`, `@tutor-frozen-holds`, `@child-frozen`, `@child-frozen-why`. Per-child panels are pressed only after the token-bound remount (`SOCIAL.settled`); Wallet panels after the Tutor's freeze card has loaded. The child's Spend pocket now covers the cheaper reward, so the reward ask is enabled | `frontend/scripts/audits/lanes/family.mjs` |
| 2 | "Add stable hooks where a toggle has none" | `data-queue-answer` (yes / not-yet / remove) on the queue's decisions, `data-reward-ask="open"`, `data-level-control` (ask / step-down), `data-freeze-control` (ask on the Tutor's Freeze; holds on both details toggles), `data-guardian-control="leave"`, `data-goal-control="move-out"` | `frontend/src/rebuild/family/DecisionQueue.tsx`, `RewardAsk.tsx`, `MyLevel.tsx`, `CoGuardians.tsx`, `WalletCorrections.tsx`, `rebuild/banking/TutorFreeze.tsx`, `CoinAccount.tsx` |
| 3 | 06 §3.1 (first view: 25 words at 6-9, 40 adult), §4 layering, §4.4 "Why?"; D.7 | Findings fixed at the root. The frozen child card read 40 words on the first view against 25, the Tutor's 57 against 40: the hold list was always open while frozen. Now what a freeze holds is one press away in both states, for both readers; the Tutor still sees it at the confirmation (the point of action). While frozen, the child's toggle reads "Why?" (new key `whyFrozen`, young/transition/teen, three locales) and opens who froze it, what pauses, that waiting coins wait (moved from the pocket list) and, for a Tutor's freeze, that only the Tutor can lift it (`freeze.owner`). The first view keeps "Frozen" on the card and never offers Unfreeze unless the server allows it. Measured after: child 25/25 (en), 27/32 (es-MX), 27/32 (pt-BR); Tutor 36/40, 42/50, 41/50 | `frontend/src/rebuild/banking/CoinAccount.tsx`, `TutorFreeze.tsx`, `src/i18n/*/coinAccount.json` |
| 4 | D.7 (no copy implies what the system does not enforce) | Found while measuring the frozen card: the child's page said "You can spend 30 more coins for now." while the freeze holds reward requests. The spending-limit section is not shown while a freeze holds `rewards`; it returns when the freeze ends (a hold list without `rewards` keeps it) | `frontend/src/rebuild/banking/CoinAccount.tsx` |
| 5 | 03 §3 (at most three accent buttons a screen); 02 type scale | `/tasks@level-ask` and `@level-step-down` showed four accent buttons: every affordable reward's "Ask" was an accent. The ask that opens the form is now a plain button; the accent is the form's send. The Tutor ladder's level name was 22 px, off the scale: it now uses `--type-title` | `frontend/src/rebuild/family/RewardAsk.tsx`, `familyAutonomy.css` |
| 6 | Appendix H Part 1.4, Part 1.3; Part 3 Stage 7; D.7, D.11, D.12, D.17, D.20 | `agent/tools/block-d-review-cadence.mjs`: each log's table has a `Kind` column (`engineering` or `human`; only `human` counts) and a machine-read `First human review due: 2027-01-15`. The next review is due on that date until a human review is recorded, then 90 days after the latest one; the threshold log goes to 365 days after four human reviews (quarterly for the first year, then yearly). `check-block-d-thresholds.mjs`, `check-no-unbacked-guarantee.mjs` and `check-block-d-scope.mjs` report the due date, warn when overdue and fail with `--strict`; `release-readiness.sh` runs all three with `--strict`, next to the Appendix G recalibration. The existing engineering rows are marked `engineering` | `agent/tools/block-d-review-cadence.mjs`, the three gates, `agent/tools/release-readiness.sh`, `docs/operations/BLOCK-D-THRESHOLD-LOG.md`, `NO-UNBACKED-GUARANTEE.md`, `BLOCK-D-SCOPE-STATEMENT.md`, `README.md` |
| 7 | Appendix H Parts 1.3/1.4 (calendar trigger) | `.github/workflows/block-d-reviews-quarterly.yml` (cron `0 9 1 1,4,7,10 *`, `workflow_dispatch`, `issues: write`, no production access) runs `agent/tools/block-d-reviews-quarterly.mjs`, which opens one `block-d-review` issue a quarter listing the three reviews with owner (Pedagogical Lead with Product; Pedagogical Lead with the Engineering Lead; Product with the Pedagogical Lead), last human review, next due date and state (overdue, due this quarter, not yet due). A malformed log still writes the issue and turns the run red | `.github/workflows/block-d-reviews-quarterly.yml`, `agent/tools/block-d-reviews-quarterly.mjs` |
| 8 | Tests | `block-d-review-cadence.test.mjs` (the schedule, engineering rows never count, a human review moves the date, yearly after four, overdue warns and fails under `--strict`, malformed logs, the live logs, the readiness wiring) and `block-d-reviews-quarterly.test.mjs` (the issue for the live logs, overdue and not-yet-due states, a malformed log, the workflow lint); `blockDThresholds.test.ts` pins the due line and the Kind of every history row; `CoinAccount.test.tsx` pins the frozen layering, the owner line in the "Why?" panel, the limit held back while rewards are held, and the Tutor's list shown at the confirmation and one press away while frozen. `verify-coin-account.mjs` presses "Why?" before reading the attribution; `familyAuditCore.test.ts` pins every synthetic-Core read of the new audit states against the pages' validators | `agent/tools/*.test.mjs`, `backend/src/__tests__/blockDThresholds.test.ts`, `frontend/src/rebuild/banking/CoinAccount.test.tsx`, `frontend/src/rebuild/family/familyAuditCore.test.ts`, `frontend/scripts/verify-coin-account.mjs` |

Server boundary: no Core route or migration changed. The new synthetic reads
mirror existing Core routes, which already refuse a non-guardian (the family
link checks) and, for the child, a Tutor's freeze (`canChange`).

### Verification (local)

- Frontend: `type-check`, `lint`; focused vitest over `src/rebuild/banking`,
  `src/rebuild/family`, `auditCoverage` and `auditAgeBand` (32 files, 417
  tests). New `src/rebuild/family/familyAuditCore.test.ts` loads the family
  lane's synthetic Core and runs every read the new states depend on through
  the pages' own validators, in three locales (a refused shape would make the
  audit measure an error notice instead of the panel).
- Backend: `type-check`, `lint`, `blockDThresholds.test.ts` (11 tests).
- Root: `spec:check`, `secrets:check`, `check-i18n.sh`; `node --test` over
  the Block D gate, cadence, quarterly-issue and readiness tests (66 tests);
  the three gates with `--strict` report "next review due 2027-01-15".
- UI audits: the first pass measured the frozen cards on a partial
  `audit:rebuild` run (the figures in row 3); the full family-lane matrix
  (three locales, two themes, 320/375/768/1280) did not complete on this
  shared machine and was not rerun under speed mode. The orchestrator's
  final audit run is the evidence for the 21 new states.
- Sync: merged with `codex/spec-migration-s02` at `5bb4dead` (no
  conflicts); no migration in this lane.

### Owner questions (conservative default applied)

- The first human review date of all three logs is 2027-01-15, the date the
  Appendix G recalibration already uses for "one quarter after the release
  that ships S07.3". The release date is not set; when it is, move the three
  dates (and the Appendix G one) to one quarter after it, never later.
- While frozen, who froze the card is one press away ("Why?") on the child's
  first view, because the 6-9 first-view budget (25 words) cannot hold the
  attribution as well; the card still says "Frozen" and never offers
  Unfreeze. If the owner wants the attribution on the first view, another
  first-view line has to go.

### What remains

- Acceptance: a human review of the frozen card (child and Tutor) and of
  the new audit states' screenshots; the owners' first human reviews on
  2027-01-15 or one quarter after release.
- The workflow has not run on GitHub (nothing pushed).
- The full `audit:rebuild` family-lane matrix over the 21 new states
  (orchestrator's final run); any finding it reports is fixed at the root.
