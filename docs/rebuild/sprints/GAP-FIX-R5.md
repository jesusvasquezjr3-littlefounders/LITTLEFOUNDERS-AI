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
