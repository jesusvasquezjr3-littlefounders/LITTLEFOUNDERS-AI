# Gap-fix round 3

Lane records for the third gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F3-identity-site

Branch `codex/spec-fix3identity`. Six audited gaps in the identity and
public-site area. Each was checked in the code first; all six were real
(the FAQ promised a pause that only `GET /auth/me` enforced and a 90-day
deletion that only ran on a sign-in; `POST /verification/parent` never read
the age record; `families.privacyBody` still promised a per-child switch;
`AnalyticsChoice` rendered only in Settings; `emails.json` opened with "!").

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | A.1 (FAQ `cancelTutor`: paused at once); Appendix M Part 2.1 criterion 2; OD-3 section 2 | Three layers. (a) Migration `identity_enforcement`: `suspend_unlinked_kid` also calls `set_kid_sign_in_ban`, which sets `auth.users.banned_until` to the sentinel `9999-12-31 00:00+00` and deletes the account's `auth.sessions` and `auth.refresh_tokens`, for a kid-role account only (a self-registered teen keeps Option B); `reactivate_linked_kid` lifts exactly that sentinel; paused kids are backfilled. The sentinel is finite on purpose: GoTrue scans `banned_until` into a Go time, and `'infinity'` would make the user unreadable (a 500 on sign-in and on every admin call). (b) Core `requireActiveAccount` (`middleware/accountAdmission.ts`) runs ahead of events, learn, onboarding, placement, tutor (the Oracle token mint included), family, family-hub, tasks, banking, wallet, profile, profiles and coop-goals: 403 `ACCOUNT_SUSPENDED` for a paused kid-role session, 503 `ACCOUNT_STATE_UNAVAILABLE` when the marker cannot be read, nothing read without a valid session, internal-key routes left to their key. (c) `/auth/login` and `/auth/refresh` re-check after GoTrue (a paused kid gets no session; every session is revoked; an unreadable marker ends only the new session). The SPA drops the session on any `ACCOUNT_SUSPENDED` answer (`lib/api.ts` event, `AuthContext`, refresh and login) and lands on `/account-suspended` | `database/migrations/0228_identity_enforcement.sql`, `backend/src/middleware/accountAdmission.ts`, `app.ts`, `routes/auth.ts`, `services/gotrue.ts`, `frontend/src/lib/api.ts`, `auth/AuthContext.tsx`, `routes/auth/LoginPage.tsx` |
| 2 | A.1 (deleted after 90 days); Appendix M 1.4; E.6 | `list_expired_kid_suspensions(days >= 90, limit)` (service role): kid-role profiles paused 90+ days, no verified link, no open deletion request. The daily sweep (`POST /internal/account-deletions/run`, `account-deletion.yml`) erases each through `purgeExpiredKidSuspension` (links re-read, never erased on an ambiguous read), reports `suspensionsExpired/Erased/Kept`, and answers 502 after running the due requests when the candidate list is unreadable. `identity_metrics.faqCapabilities.cancellationCascade` now also needs both suspension triggers, the ban inside `suspend_unlinked_kid`, the candidate function and a `account_deletions.sweep_ran` row of the last two days that carries `suspensionsExpired` | `0228_identity_enforcement.sql`, `backend/src/services/guardianLifecycle.ts`, `routes/account.ts`, `.github/workflows/account-deletion.yml`, `docs/rebuild/policies/ACCOUNT-DELETION.md` |
| 3 | A.2; A.5; E.4; OD-3 section 2 | `GET` and `POST /verification/parent` read `readAgeScreen` first: 403 `AGE_RECORD_MINOR` for an under-13 origin or an effective band of under 13 or 13 to 17, 403 `AGE_SCREEN_REQUIRED` when unscreened, 502 when unreadable; Guardian is never called and nothing is written. Database backstop `guard_parent_verification_age` (BEFORE INSERT OR UPDATE on `parent_verifications`) refuses a verified local-ocr row for a kid-role account, an origin row or a minor effective band, so `enforce_parent_role_provenance` can never see one. `VerifyParentScreen` gains the `minor` outcome (Settings age review and the support address, no form) in three locales | `backend/src/routes/verification.ts`, `0228_identity_enforcement.sql`, `frontend/src/rebuild/identity/VerifyParentScreen.tsx`, `routes/auth/VerifyParentPage.tsx`, `src/i18n/*/rebuild-site.json` |
| 4 | A.1; Appendix M Part 3 Stage 4; H-20 | `families.privacyBody` rewritten in EN, es-MX, pt-BR to the FAQ's statement ("Under 13, we never collect usage data; for a teen, it stays off until you or they turn it on. Mentor replies are checked first."). `check-no-unbacked-guarantee` gains `sharedStatements` (the Families line and `faq.items.analyticsToggle.answer` must both carry the same under-13 sentence in every locale) and a retired claim for the old per-child promise; both mutation-tested | `frontend/src/i18n/*/rebuild-site.json`, `docs/operations/block-d-controls.json`, `agent/tools/check-no-unbacked-guarantee.mjs` (+ test) |
| 5 | H.1; Appendix O 1.1 and 2.2(a) | `TeenAnalyticsDisclosure`: a sheet in the learner shell on the first app session while Core answers `canManage && !disclosed`, with the whole disclosure and two equal answers ("Keep it off", "Turn it on"), each writing the version-1 row; "Decide later" closes it for the browser session and it returns next session. The Settings card offers the same two answers until a choice is on file (the switch only afterwards). One data hook for both | `frontend/src/app-shell/TeenAnalyticsDisclosure.tsx`, `app-shell/useTeenAnalyticsPreference.ts`, `app-shell/AppLayouts.tsx`, `rebuild/privacy/AnalyticsChoice.tsx`, `routes/app/profile/TeenAnalyticsSetting.tsx`, `src/i18n/*/rebuild-profile.json` |
| 6 | Bible 06 section 5 rule 7; 02 D8 | The confirmation email body has no exclamation mark in any locale; templates regenerated. `build-rebuild-emails.mjs` (and its `--check` in `spec:check`) refuses `!` or `¡` in any email string; the email contract test asserts it on the generated templates | `frontend/src/i18n/*/emails.json`, `public/email-templates/confirmation.html`, `scripts/build-rebuild-emails.mjs`, `rebuild/design/emailsContract.test.ts` |

### Verification (local)

- Backend: `type-check`, `lint`, and the full unit suite once after the
  middleware landed (148 files, 3,377 tests green); then the focused files:
  `accountAdmission` (new: a paused kid refused on Learn, the Mentor session
  mint, the Wallet, banking, placement, profile, tasks and coop goals before
  any product read; 503 on each when the marker is unreadable; login banned
  answers the uniform `INVALID_CREDENTIALS`; login and refresh without the ban
  still refused and every session revoked; a cleared marker restores access;
  a teen with the marker stays active), `accountDeletion` (expired suspension
  erased without any sign-in; under 90 days kept; a relinked child and an
  unreadable link set kept; an unreadable candidate list still runs the due
  requests, then 502 with no coverage key), `verification` (flagged guest,
  upgraded flagged account, declared under-13 and declared teen refused before
  Guardian with no write and no role; unscreened refused; unreadable record
  502; adult verified), `analyticsPreference` (a first "off" recorded and no
  optional event admitted). 17 older suites answer the new admission read
  through `admissionStubResponse` (helpers.ts).
- Native PostgreSQL 17.6 (port 15900, full 228-migration chain):
  `verify-account-erasure-postgres.py` 19 checks (ban and session/refresh-token
  deletion on the pause, co-supervised child untouched, candidates only past
  90 days and never under 90 or to a browser role, an open request removes
  the candidate, relink lifts the ban, a teen is marked but never banned, a
  foreign ban is kept, only triggers can ban); `verify-staff-ops-postgres.py`
  20 checks (age guard on insert and on update for a flagged guest, an
  upgraded flagged account and a declared teen, none gains the parent role; a
  declared adult and a teen made 18 by birth month may; `cancellationCascade`
  false without a suspension-aware sweep, true with one);
  `verify-analytics-disclosure-postgres.py` 8 checks (a first "Keep off"
  writes version 1 off, admits no event and counts as covered).
- Frontend: `type-check`; eslint on touched files; focused vitest (api event,
  auth routes, `VerifyParentStatus`, `TeenAnalyticsDisclosure` (new),
  `TeenAnalyticsSetting`, app-shell, profile and site copy budgets, the email
  contract).
- Root: `spec:check`, `secrets:check`, `check-i18n.sh`,
  `check-no-unbacked-guarantee` (+ tests), `check-account-deletion` (+ tests),
  `database` package tests.
- Not run here (orchestrator, per speed mode): browser matrices, the rebuild
  audits (text fit, proportion, copy budget in the real app), `test:all`.

### Decisions taken with the SPEC's conservative default (owner questions)

1. A GoTrue ban answers sign-in with the uniform `INVALID_CREDENTIALS`, not
   `ACCOUNT_SUSPENDED`: GoTrue checks the ban before the password, so naming
   the pause would tell anyone holding a child's username that the child's
   Tutor is gone (E.1). The paused child therefore sees "wrong username or
   password" at the sign-in form; a child already signed in lands on the
   paused screen. Owner question: accept this, or name the pause at sign-in?
2. The first-session step has a "Decide later" close (for the browser
   session only; it returns each session until a choice is on file) rather
   than blocking the app. Owner question: keep it dismissible?
3. The admission check reads the marker on every request of the listed
   routers, with no cache, so the pause is immediate; this is one extra
   PostgREST read per request.

### Migrations (renumbered by the orchestrator at merge)

- `0228_identity_enforcement.sql` (`@phase: expand`, 22,143 bytes; no new
  table, so no new RLS; functions are service-role or trigger-only).

### Open items

- Accounts that were verified as Tutors before this fix while their age
  record said under 18 keep the parent role; the new guard stops new rows
  only. A staff query should list them for review (`parent_verifications`
  latest verified local-ocr joined to an origin row or a minor
  `effective_age_band`). Changing `requiresMinorMentorSafeguards` to consult
  the age record for parents was tried and reverted: it moves the Family
  router's verified-adult gate for ~100 existing tests and needs its own
  checkpoint.
- An Oracle live session opened before the pause runs until it ends; the
  pause stops the next token mint, sign-in, refresh and every Core route.
- Production: GoTrue's handling of the sentinel ban and the refresh refusal
  are verified by contract (GoTrue source) and by Core's re-check, not on the
  deployed GoTrue; the backfill runs on apply.

## Checkpoint F3-identity-site-finish

Lane finish. `codex/spec-migration-s02` merged in (already up to date, no
conflicts). The adversarial pass over the lane's commits found two items
that were still half-built and built them:

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 7 | A.1 (FAQ `cancelTutor`: paused at once); Appendix M 2.1 criterion 2 | A live Mentor session opened before the pause no longer runs until it ends. Core `GET /tutor/internal/admission/:userId` (internal key; the same read as `requireActiveAccount`; 503 when unreadable). Oracle `admitTurn` asks before every learner message that spends a model turn (text, edit, grade, goal, check-in, session-end answer) and before a clip reaches STT, for minors (only a kid-role account is ever paused). Suspended: an `ACCOUNT_SUSPENDED` frame, every socket and park of that account on the replica dropped, close 4001. Unreadable: only that turn is refused (`SERVICE_DEGRADED`, no model or STT call), the session stays. 404 (Core predates the route): the pause stays Core's alone, as before. The Mentor client (`useTutorSocket`, and the Mentor's own `coreApi` copy, which had never raised it) dispatches the shared `lf:account-suspended` event, so the shell drops the session and shows the paused screen | `backend/src/routes/tutor.ts`, `oracle/src/core/client.ts`, `oracle/src/ws/server.ts`, `frontend/src/rebuild/mentor/session/coreApi.ts`, `useTutorSocket.ts` |
| 8 | A.2; A.5; E.4; OD-3 section 2; Appendix M 1.2 | Tutors verified before `guard_parent_verification_age` existed while their own age record says a minor are found and measured, never demoted silently (the record itself may be the error). Migration `tutor_age_record_review`: `list_minor_record_tutors()` (service role; parent role plus a kid role, an under-13 origin or an effective band of under 13 or 13 to 17, the guard's own predicate). Core flags each in `/admin/users` (`ageRecordMinor`; the directory fails closed when the list is unreadable) and adds the release gate `tutor_adult_age_record` to the identity metrics (misses while any remain; counts only). The staff Users list shows an "Age record under 18" chip, and the details sheet a note next to the existing audited revocation; copy in EN, es-MX, pt-BR | `database/migrations/0229_tutor_age_record_review.sql`, `backend/src/services/tutorAgeRecord.ts`, `adminData.ts`, `identityMetrics.ts`, `frontend/src/rebuild/staff/console/StaffUsers.tsx`, `staffConsoleApi.ts`, `src/i18n/*/rebuild-staff.json`, staff fixtures |

### Verification (local, finish)

- Backend: `type-check`, `lint`, full unit suite (148 files, 3,385 tests,
  1 skipped). New: `staffOps` (the gate misses with one minor-record Tutor
  and names no account; 502 when the list is unreadable or malformed),
  `admin` (the directory flag; 502 when the list is unreadable),
  `accountAdmission` (the internal admission route: paused, active, teen
  with the marker, 503 on an unreadable marker or roles, key and id
  refused before any read).
- Oracle: `type-check`, `lint`, full unit suite (65 files, 1,742 tests).
  New in `hardening.test.ts`: a paused child's next typed turn is refused
  before any model call and the socket closes 4001; a paused child's clip
  never reaches STT; an unreadable answer refuses only that turn and the
  session continues; a 404 leaves the pause to Core.
- Frontend: `type-check`, `lint`, full unit suite (273 files). New: the
  socket hook and the Mentor Core client raise the shared event only for
  `ACCOUNT_SUSPENDED`; `lib/api.test.ts` pins the two event names equal;
  the staff Users list shows the flag in the row and the details sheet.
- Native PostgreSQL 17.6 (port 15900, 229 migrations):
  `verify-staff-ops-postgres.py` 21 checks, the new one listing exactly the
  flagged guest, the upgraded flagged account and the declared teen (never
  the teen made 18 by birth month or the adult), for the service role only.
- Root: `spec:check`, `secrets:check`, `check-i18n.sh`, `tools:test` (400
  tests). `database` package: `check-migrations` (229 files), the phase and
  family-lifecycle checks and the 48 `node --test` tests pass;
  `railway-migrate.test.mjs` did not finish on this Windows machine (see
  open items).

### Lane summary

All six audited gaps (A.1 pause, A.1 90-day deletion, A.2/A.5/E.4 minors kept
out of ID verification, the Families privacy line, H.1 first-session
disclosure, the email exclamation rule) are implemented and locally
verified, plus the two finish items above. REQUIREMENTS rows A.1, A.2, A.5,
E.4, E.6 and H.1 are updated; none is accepted.

Migrations (renumbered by the orchestrator at merge):
`0228_identity_enforcement.sql` (expand, 22,143 bytes) and
`0229_tutor_age_record_review.sql` (expand, no table).

### Open items (final)

- Owner questions 1 to 3 of the F3-identity-site checkpoint stand (uniform
  sign-in answer for a banned child, dismissible first-session disclosure,
  an uncached admission read per request). The Oracle check adds one Core
  read per model-spending turn of a minor.
- Deploy order: Core (admission route) before Oracle. An Oracle deployed
  first treats Core's 404 as "Core enforces the pause alone", so nothing
  breaks.
- A session parked on ANOTHER Oracle replica is not dropped by the pause
  (the service runs one replica; no token can resume it, Core mints none).
- Staff still decide each flagged Tutor (revoke, or settle an E.4 age
  correction); the release gate stays missed until they do.
- `requiresMinorMentorSafeguards` does not read the age record for a parent
  role (a change that moves the Family router's verified-adult gate and
  ~100 existing tests); the flag and the gate cover the cohort until then.
- GoTrue's handling of the sentinel ban is verified against GoTrue source
  and backed by Core's re-check, not on the deployed GoTrue.
- `database/scripts/railway-migrate.test.mjs` did not complete here: once
  it failed in its confirm-apply scenario (status 3840) midway through the
  fake per-file transport loop while other suites ran, once it stalled for
  over 14 minutes in a fake `railway ssh` shell and was stopped. It drives
  the whole migration list through fake Railway binaries and never reads a
  migration's SQL; the orchestrator should run it on its gate run (or CI).
- Orchestrator gates still to run: browser matrices, text-fit, proportion
  and copy-budget audits (the teen disclosure sheet, the `minor` verify
  outcome, the staff Users flag), `test:all`.

### Merge integration (F3-identity-site into codex/spec-migration-s02)

- The lane branched from the integration head (`f2f8e0f4`), so the merge had
  no conflicts and no auto-merged file needed a semantic fix.
- Migrations: no renumbering. The integration branch's highest migration was
  `0227`, so the lane's `0228_identity_enforcement.sql` (22,143 bytes) and
  `0229_tutor_age_record_review.sql` (2,199 bytes) already follow it in
  order, both under the 23,000-byte limit. No other lane redefines their
  functions or triggers on this branch.
- Integration defects found: none. On the merged tree `typecheck:all`,
  `lint:all`, the backend, Oracle and frontend unit suites, `spec:check`
  (S03 design gates, S05/S08 gates, OD-28 Wallet glossary), `secrets:check`,
  `tools:test` and the i18n gate pass. In `database`'s `npm test`,
  `check-migrations`, `check-migration-phase`, `check-family-lifecycle` and
  the 48 `node --test` cases pass; `railway-migrate.test.mjs` (unchanged by
  this lane) was still in its fake Railway transport scenarios after 15
  minutes and was stopped, as on the lane's own runs. It must run in CI or
  on a quieter gate run.
- Still open for the orchestrator: browser matrices, text-fit, proportion and
  copy-budget audits on the new surfaces, and `test:all`.

## Checkpoint F3-learning

Branch `codex/spec-fix3learning`. Eight audited SPEC gaps in the learning
area. Each was checked in the code first; all eight were real (the code
matched the audit's description). Built under the project leader's speed
mode (27 September 2026): complete features, lean verification, full gates at
merge.

### What was built

| # | SPEC clause | Gap confirmed in code | What was built | Where |
|---|---|---|---|---|
| 1 | Appendix P Part 1 M7, Part 4.1 and 4.5; Bible 05 §4 (Build) and §7; B.7 part 3 | Comparison-only payload and rubric; the scorer refused any other model; the structure step was a two-option control that started on the only right answer; bars pre-drawn from the payload | Schema-neutral payload (the text's 2-3 quantities, the unknown's label); private rubric `{model: part-whole \| comparison, slots}`; the canonical scorer grades a complete build (structure on a wrong model or slot, value on a wrong answer), refuses a key whose lengths contradict themselves (`solveBarModel`), and Core refuses an answer key the structure does not reach. The board starts empty: the learner adds one bar in parts or two bars to compare, adds a part or the total bracket, and fills each slot from a picker (Tab through slots, Enter or ArrowDown opens it); the unknown is a dashed "?" segment; lengths follow the quantities placed; the arithmetic step draws the learner's met build. Behaviour gate: empty `initial`, every build of both models enumerated. Forge: plan 08 rewritten, part-whole plan 41 | `backend/src/services/v2SegmentFamilies.ts`, `v2VisualScorer.ts`, `v2LessonDocument.ts`, `v2ScorerPayload.ts`, `forgeV2Behaviour.ts`; `frontend/src/rebuild/learning/BarModelBoard.tsx`, `pizarron/visuals.tsx`; `coursegen/src/v2/fixtures/plans/08-v2-bar-model.json`, `41-v2-bar-model-part-whole.json`; `frontend/scripts/verify-rebuild-bar-model.mjs` |
| 2 | B.8 (and OD-15); OD-19; Bible 08 §11 | `mentor_stage` optional; the projection and the preference read only ran when it was declared | `projectV2MentorStage` always projects the learner's character (catalog default) on `mentor_stage.scene`, else `adventure_scene_id`, else the catalog's first scene; the route reads preferences for every v2 document (a failed read still omits the stage, §1.14); Forge gate 15 blocks a document whose stage scene is not an approved scene | `v2LessonDocument.ts`, `routes/learn.ts`, `coursegen/src/v2/gates.ts` |
| 3 | Bible 08 §11; B.8 | The adventure scene was a separate 160 px stripe in a wrapper, so the `:has(> .lf-mentor-band)` side column never applied and phone bands could exceed their caps | The scene is the backdrop inside the one band (`MentorStage` `backdrop`); the band is the slot's single element; with no stage the scene keeps the band class contract and register height; the stripe classes are gone. Screenshot check: teen phone band 80 px of 740 with the scene on both sides of the Mentor; desktop side column 4/12 with the scene as its top strip. The compact-stage audit gains theme states per register (30/25/15%, answers in the first view, band as direct child) | `learning/lessonStage.tsx`, `CompactMentorStage.tsx`, `mentor/MentorStage.tsx`, `learning/mentorStage.css`, `AllocationBoard.tsx`, `scripts/verify-compact-stage.mjs` |
| 4 | B.8, B.18; Appendix P Part 5; OD-24 | `audio_ref` resolved nowhere; boards rendered only the text line | Core returns `narration_audio` (segment id -> public URL) for ungraded Mentor-voiced segments whose differentiated `audio_ref` Echo's manifest holds; the browser re-checks the map; Mentor turns and episodes offer Listen through the lesson's one narration channel (never autoplay, silent with the sound off switch, one line at a time, stops on leaving the segment, plate as caption); no resolvable audio = text-only plate. Forge release flags (`--audio-manifest`) or blocks (`--require-narration-audio`) a channel without an asset | `v2LessonDocument.ts` `v2NarrationAudio`, `routes/learn.ts`, `learning/lessonCue.ts`, `segmentKit.tsx` `NarrationControl`, `familyBoards.tsx`, `AuthenticatedLessonDocument.tsx`, `LessonRoute.tsx`, `coursegen/src/v2/release.ts`, `releaseCli.ts` |
| 5 | Appendix P Part 2 L1; Part 4.5 | Rubric only `must_flip_ids`; generic partial/miss/false_alarm | Private card roles (`p`, `not_p`, `q`, `not_q`, checked against `must_flip_ids`); codes `confirmation_bias` {P,Q}, `p_only_missing_not_q` {P}, `matching` {Q}, `not_p_checked` (any other set with not-P), `all_cards`; added to `V2_DIAGNOSTIC_CODES` (the grade-replay schema now reads that list; it had also lacked `count_from_zero`) and to the receipt CHECK (0230); the behaviour gate checks every role combination's code; plan 23 carries the roles; the staff learning-quality panel names the codes (three locales) | `v2SegmentFamilies.ts`, `v2VisualScorer.ts`, `supabaseRest.ts`, `forgeV2Behaviour.ts`, `LearningQualityPanel.tsx`, `database/migrations/0230_v2_selection_task_diagnostics.sql` |
| 6 | Bible 02 D1, §7 rules 1 and 11; 05 §5 | `fitLabel` cut labels with "…" in 8-9 px SVG text | Every word label (categories, lanes, nodes, bones, point and link labels) is an HTML tag over the drawing at 14 px that wraps within its mark's room; after layout a label that does not fit (a word wider than its room, too many lines, outside the drawing, over another label) is hidden and the table carries it; SVG text is numerals only; `fitLabel` deleted from Core's model and its mirror; the in-page `boards()` audit measures `.lf-chart` and flags cut or sub-14 px chart labels | `learning/charts/TeachingChart.tsx`, `charts.css`, `backend/src/services/v2ChartModel.ts` (+ generated), `scripts/audits/in-page.mjs`, `rules.mjs` |
| 7 | Bible 02 D1, rule 1; 06 §4 | Offer skill list sliced to three plus "…" | Up to three skills inline plus a localized "and N more" that opens a Details sheet with the whole list | `learning/CourseView.tsx`, `rebuild-learn.json` (3 locales) |
| 8 | P-09; OD-22; D-06; OD-23 | `recordCourseLessonEvidence` ran unconditionally | Gated at its single entry point: nothing unless `COURSE_PATHWAY_ENGINE = pathway` and the new `COURSE_LESSON_EVIDENCE` switch is `on` (default `off`); the calibration it must pass is a row in `THRESHOLD-RECALIBRATION-LOG.md` | `backend/src/services/pedagogy/courseLessonEvidence.ts`, `config.ts`, `.env.example` |

### Verification (local)

- Native PostgreSQL 17.6 (owned cluster, port 15910): `database/scripts/verify-learning-r3-postgres.py` applies all 228 migrations and passes 4 checks (the five selection codes and every older code accepted; unknown codes and malformed fields still refused; `learning_error_family_split` reports each code as an answer error on first tries; browsers read nothing). `database`: `check-migrations`, `check-migration-phase`, `check-family-lifecycle` and the phase/auto-apply node tests green (the `railway-migrate` test hung on this loaded machine, as in other lanes' runs; not touched by this lane).
- Core: `forge-v2:check` 123 rows, 216/216 graded segments pass the behaviour gate; focused vitest (v2 scorers, lesson documents, learn routes incl. mixed v2, stage and narration, Forge emitted rows, evidence gate, learning quality); `type-check` and `lint` clean; `governance:check` green.
- Forge: v2 emit, release (narration flag) and carried-gate tests; emitted fixture regenerated; `type-check` and `lint` clean.
- Frontend: every test under `src/rebuild` and the learn routes (149 files, 1,823 passed); focused runs before that (bar model build, reset, pending controls, lesson route M7 flow and resume, charts, board audit pin, general player narration, course offers, stage band, copy budget, recomposition); `type-check` and `lint` clean. Headless screenshots of the empty and built bar model at 375 px and of the stage band with an adventure theme at 375 (teen) and 1280.
- Root: `spec:check`, `secrets:check`, i18n gate.
- Not run here (orchestrator, per merge): browser matrices (`verify-rebuild-bar-model`, `verify-compact-stage` with its new theme states), `audit:rebuild`, full suites.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Narration never autoplays.** The learner presses Listen; this is the conservative reading of "never autoplay over the learner's own audio". The sound off switch hides the control.
2. **Selection-task codes are answer errors** in the structure-vs-answer split (a reasoning choice, not a wrong model); the names follow the audit's examples, with `not_p_checked` and `all_cards` added for the other named patterns.
3. **Course-lesson evidence calibration.** The switch is off; the proposed calibration (shadow-run agreement within 0.15 on 80% of topics with 20+ learners, reversal rate under 8%) is an engineering proposal for the two leads.
4. **Stage scene fallback.** A lesson scene outside the approved catalog stages the Mentor on the first catalog scene at runtime; Forge blocks such a document before publication.
5. **Bar-model bars without a number.** In a comparison a bar may carry no number (Ana's bar in "12 more than Leo; together 50"); part-whole slots and an added total must be filled.
6. **Tier 1 change record.** `courseLessonEvidence.ts` is classified Tier 2 (`mentor.runtime`) in the governance registry, so the gate needs no Tier 1 row; the switch itself is logged as a Tier 1 threshold in the recalibration log, pending both leads.

### Migrations (renumbered by the orchestrator at merge)

- `0230_v2_selection_task_diagnostics.sql` (contract by classifier, widening in fact: apply before the Core release that grades rule-checker rubrics with card roles)

### What remains

- The narration audio itself (a paid audiogen run, OD-23); until then every v2 plate is text-only.
- Browser matrices and `audit:rebuild` over the new bar-model build, the chart labels and the stage theme states. No chart screenshot was taken in the lane (no preview surface renders `visual.chart.v2` alone).
- The Mentor reading the new selection codes in its own decisions (the receipts carry them; the Mentor lane owns its use).

## Checkpoint F3-learning-finish

Lane close-out for `codex/spec-fix3learning`.

- **Sync.** `codex/spec-migration-s02` had not moved (tip `f2f8e0f4`, the lane's base): the merge was a no-op, with no conflicts.
- **Adversarial pass over the eight gaps.** No gap was mandated and missing or half-built. Every gap is closed in code with the defaults above. The server enforces authorization: the M7 model and slots and the L1 card roles live only in the private rubric. The scorer payload carries only the text's quantities. Core refuses an M7 answer key its structure cannot reach. Narration URLs resolve only for ungraded, Mentor-voiced segments on the authenticated lesson route. Course-lesson evidence is gated at its single entry point. No rebuilt file this lane touched imports a legacy component. The new copy ("and N more", the selection codes on the staff panel) exists in en-US, es-MX and pt-BR, and the i18n gate is green.
- **Full unit suites, once per touched service** (VITEST 3 threads/forks):
  - Core: 148 files passed and 1 skipped (Postgres-only); 3,343 tests.
  - Forge: 60 files, 836 tests.
  - Frontend: 271 of 272 files, 3,132 of 3,133 tests. The red was `src/rebuild/assets/assetGate.test.ts` › "caps the glyph set…", a 90 s timeout in a file this lane did not touch. Rerun alone, it passed (13/13).
  - `database`: `check-migrations` (228 files), `check-migration-phase`, `check-family-lifecycle` and the 48 node tests are green. `railway-migrate.test.mjs` never finishes on this machine: it produced no output in 9 min 50 s alone, and another lane's run is hung the same way. It is not touched by this lane (it only gains one more migration to walk). CI's Linux runner is its judge.
  - `type-check` and `lint` are clean in backend, coursegen and frontend.
- **Root:** `spec:check`, `secrets:check` and the i18n gate are green.

### Final summary

All eight audited learning gaps are implemented and locally verified: M7 learner-built bar models, a Mentor on every v2 lesson, the adventure scene inside the one band, the v2 narration channel, L1 selection-task diagnostics, uncut chart labels, the OD-25 skill list, and P-09 evidence gating. None is accepted or released. There is one migration, `0230_v2_selection_task_diagnostics.sql`, which the orchestrator renumbers at merge. Still open:

- The narration audio, which needs a paid audiogen run (OD-23).
- The browser matrices and `audit:rebuild` at merge.
- A visual check of the chart labels.
- The Mentor's own use of the selection codes, which the Mentor lane owns.
- The six owner questions above.

### Merge integration (F3-learning into codex/spec-migration-s02)

- One conflict: this record (`GAP-FIX-R3.md`, add/add). Resolved as the
  union: the F3-identity-site sections first, then the F3-learning sections.
  `REQUIREMENTS.md` and `backend/src/__tests__/learn.test.ts` auto-merged:
  the two lanes changed different rows (A.1, A.2, A.5, E.4, E.6, H.1 against
  B.6, B.7, B.8, B.18) and different tests, so each row keeps its newest
  status.
- Migrations: the lane's `0228_v2_selection_task_diagnostics.sql` became
  `0230_v2_selection_task_diagnostics.sql` (offset +2, after the identity
  lane's `0228` and `0229`; 4,010 bytes). The bare "(0228)" mentions in the
  B.7 row and in this record's table now read 0230. No other lane on this
  branch redefines `lesson_v2_grade_receipts_signals_check` (last set by
  `0216`), so the apply-order state is correct without a reconciling
  migration.
- Integration defects found: none. The identity lane's `requireActiveAccount`
  now sits ahead of the learn routes, and the lane's learn, narration and
  course-evidence tests pass with it on the merged tree.
- Checks on the merged tree: `typecheck:all`, `lint:all`, `spec:check` (S03
  design gates, S05/S08 gates, the OD-28 Wallet glossary), `secrets:check`
  `tools:test` and the i18n gate pass. Unit suites: backend 3,393 passed (1 skipped),
  coursegen 836, frontend 3,154, all green. In `database`,
  `check-migrations` (230 files), `check-migration-phase` and
  `check-family-lifecycle` pass, and so do the 48 `node --test` cases.
  `railway-migrate.test.mjs` (unchanged by this lane) failed on this Windows
  machine in its `confirm-apply` scenario: the fake transport runner exited
  with status 3840 after applying `0093`, before any of this round's
  migrations, and then the process hung until a 240 s timeout. It needs a
  Linux (CI) run to judge it.
- Still open for the orchestrator: the browser matrices
  (`verify-rebuild-bar-model.mjs`, `verify-compact-stage.mjs`),
  `audit:rebuild` with the chart-label check, and the text-fit, proportion and
  copy-budget audits.
