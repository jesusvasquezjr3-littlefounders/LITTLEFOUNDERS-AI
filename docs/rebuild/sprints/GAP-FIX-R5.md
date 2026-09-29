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

## Checkpoint F5-identity-site

Branch `codex/spec-fix5identity`. Four audited gaps. All four were checked in
the code first and all four were real.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | A.1 (FAQ "twoParents"); Appendix M 1.4; D.3 / OD-3 Option B; Law 5 | A Tutor invite link is now `/join/TOKEN`, a landing on the sign-in shell that needs no role. It keeps the token in router state (`from`) and in a small store (`auth/pendingInvite.ts`: localStorage, because the confirmation email opens a new tab; bounded by the invite's 7-day life; a malformed token is never stored; cleared on accept, on an invalid or expired invite and on sign-out, so a shared device never hands it to the next account). Each person gets one step: a signed-out visitor or guest is offered sign-up (Tutor intent preselected) or log-in; a signed-in adult who is not a Tutor sees "Verify your ID to accept" with one brand action to `/verify-parent` (or "Use another account"); a parent-created child is told the link is for an adult; a malformed link asks for a new one; a verified Tutor is sent straight to `/family?join=TOKEN`. Log-in, sign-up (with or without email confirmation), the Google callback and the signed-in redirect of the guest-only pages continue to the pending invite; `/verify-parent`'s success links to `/family?join=TOKEN` ("Open the invite"). An old `/family?join=` link opened by a non-Tutor goes to the landing instead of Learn with the token dropped. The mint panel and the teen's "Invite a parent" link both produce `/join/TOKEN`. The landing never shows the child's name or any account detail: preview and accept stay inside Core's verified-parent boundary (no Core change) | `frontend/src/auth/pendingInvite.ts` (+ test), `frontend/src/app-routes/JoinInvitePage.tsx`, `frontend/src/rebuild/identity/JoinInviteScreen.tsx`, `app-routes/site.tsx`, `app-routes/family.tsx`, `app-shell/PublicLayouts.tsx`, `auth/AuthContext.tsx`, `auth/RequireGuest.tsx`, `routes/auth/{Login,Signup,AuthCallback,VerifyParent}Page.tsx`, `rebuild/identity/VerifyParentScreen.tsx`, `routes/app/family/GuardianInvitePanel.tsx`, `routes/app/wallet/TeenWalletPage.tsx`, copy `authJoin`, `authVerify.openInvite`, `pageTitle.joinInvite` (EN/es-MX/pt-BR); tests `app-routes/__tests__/JoinInvite.test.tsx`, `GuardianInvitePanel.test.tsx`, `AuthContext.test.tsx`, `AuthRecipe.test.tsx` |
| 2 | Bible 02 §7 item 10 and rule 19; 06 §7; 03 §5 | Audit states for every identity state the audits never rendered: `verify-minor` and the W2S.3 offline copy (`login-offline`, `signup-offline`) as identity previews; the age question's `askTutor` and `error` states on a real route (`/learn@age-ask-tutor`, `/learn@age-error`) and as previews; the H.1 first-session teen analytics disclosure sheet (`/learn@teen-analytics-disclosure`) and the undecided two-answer Settings card (`/profile/settings@teen-undecided`), reachable through the synthetic Core's new `analyticsDisclosed` and `ageScreenError` scenario fields; four `/join/:token` states (signed-out, verify, child, invalid). `auditCoverage.test.tsx` pins every identity preview view and age-screen state to an audited state | `frontend/scripts/audits/lanes/site.mjs`, `lanes/profile.mjs`, `scripts/audits/synthetic-core.mjs`, `src/rebuild/preview/registry/site.tsx`, `src/app-routes/__tests__/auditCoverage.test.tsx` |
| 3 | Bible 03 §3.3 (7:5 hero, portrait 4:5 art allowed to overlap); 07 §1 class B; 02 D12 | Three portrait 4:5 hero scenes rendered locally at zero spend from the real runtime models on Diorama A in catalogue poses (Dina `ambient.idle.happy` on Landing, Dr. Rho `teach.explain` on How it works, Zara `greet.nod` on Families), light and dark, WebP 1x/2x/3x plus a PNG fallback, no text (OCR clean). `SiteHeroArt` serves the page's colour mode with a translated alt; `SiteHero overlap` keeps the 7:5 copy:art split and lets the art reach into the next section on wide screens; on a phone it sits small above the copy. The four-Mentor cast moved into the Landing's Mentors section. 24 files registered as class B `scenes` drafts awaiting the owner's style review | `frontend/scripts/render-site-hero.mjs`, `frontend/public/rebuild/site-hero/`, `src/rebuild/assets/manifest.json`, `src/rebuild/site/{blocks.tsx,site.css,Landing.tsx,HowItWorks.tsx,Families.tsx}`, copy `siteHeroArt` (3 locales) |
| 4 | OD-27 (3); A.1; OD-18 / C.4 | The llms brief says what the product does: the Tutor reads their child's Mentor conversations and approves what the Mentor remembers; a teen's story choices stay private. "Everything their child does" and "a permanent property of the product" are gone. `check-seo-surface.mjs` refuses a total-visibility claim ("see everything", "everything their child does", "permanent property") in llms.txt and llms-full.txt in every locale, with a mutation test on the shipped files | `frontend/scripts/seo/build-seo.mjs`, `agent/tools/check-seo-surface.mjs` (+ test) |

### Verification (local)

- Frontend `npm run type-check` and `npm run lint` clean.
- Focused vitest: `src/routes/auth`, `src/auth`, `GuardianInvitePanel`,
  `src/app-routes/__tests__` (including `JoinInvite.test.tsx`, every hop:
  landing, Family route, log-in, sign-up with and without confirmation,
  Google return, signed-in redirect, verification, and the refused
  populations: child, invalid token, non-Tutor never reaching accept),
  `src/rebuild/{site,identity,assets,preview}`: all green. The asset gate test
  first failed on the WebP srcSet (paths were not literal); fixed and re-run
  green.
- Root `spec:check` (legacy UI gate, asset gate with OCR: 379 class B assets,
  no text in any raster), `secrets:check`, `check-i18n.sh`: pass. The invite
  route adapter moved from `routes/auth/` to `app-routes/` because the legacy
  UI freeze refuses new files under `src/routes/`.
- Earlier in the lane: the new identity audit states in item 2 passed text
  fit, proportion and copy budget (3 locales x 2 modes x 4 widths); the SEO
  gate and its mutation test pass.

### Open

- Not run here (speed mode, orchestrator's end-of-round run): the `/join`
  audit states and the site hero states through the three audits,
  `verify-identity.mjs` (two new journeys: signed-out visitor and signed-in
  adult, each to the accepted invite), `verify-teen-wallet.mjs` (updated link
  shape) and `verify-public-site.mjs`.
- The optional read-only Core preview of an invite for a not-yet-verified
  adult was not built: the landing shows no child data at all, the
  conservative default. Owner question below.
- The hero scenes are drafts until the owner's style review (07 §7).

### Owner questions

- Should a signed-in, age-screened adult who is not yet a verified Tutor see
  who invited them (inviter-safe fields only) before verifying? Default
  implemented: no, nothing about the family is shown before verification.
- Hero casting: Dina on Landing, Dr. Rho on How it works, Zara on Families.
  Default implemented: one Mentor per page so the heroes do not repeat.
