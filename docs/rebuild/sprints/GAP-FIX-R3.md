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

## Checkpoint F3-mentor

Branch `codex/spec-fix3mentor`. Two audited SPEC gaps in the Mentor area. Each
was checked in the code first; both were real.

### Gaps confirmed

1. **No Stage 5 canary delivery path** (C.22; Appendix E §3.1; Appendix F Part 3 Stage 5 and §1.4). The only H.7 target Core read on the tutor surface was `mentor.dialogue-register` (`dialogueCalibration.ts`). The seven registered Tier 2 parameters were code constants with no runtime path. `oracle/src/core/client.ts` had no field that could carry a variant. `check-mentor-governance.mjs` accepted `canary` and `released` records on an `experimentId` and a transcript count, without checking that the experiment delivered anything.
2. **C.1 to C.4 safety metrics were neither gated nor measured** (Appendix F §1.3; Part 2.1 criterion 3; C.24). No `agent/tools` script referenced `resolveMentorSafety`, `requiresMinorMentorSafeguards` or `classifyMemoryReview`. `release-readiness.sh` had no minor-safeguard audit. `mentorQuality.ts` had no fracture-closure or calibration-coverage signal. The one remaining role test (`roles.includes('kid') || guardians.length > 0` in `classifyMemoryReview`) was pinned by no gate.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | C.22; Appendix E §3.1; Appendix F Stage 5 | **The canary manifest and generated tables.** `canaries.json` lists each canary: the H.7 experiment id, the proposal, the share (at most `maxShare`, 10%), the overrides and a status (`running` or `concluded`). `check-mentor-canary-parity.mjs --write` generates the Tier 2 id and bounds table from `registry.json` into Oracle (`tier2Parameters.generated.ts`) and the same table plus the running canaries into Core (`mentorCanaryTables.generated.ts`). `npm run canary:check` (repo-gates, release-readiness) fails on stale generated files, an override that is not a registered Tier 2 parameter or is out of bounds, a share over the ceiling, a duplicate, a proposal with no record, an arm-vocabulary drift, a migration CHECK drift, or Oracle dropping one of the three config objects. The registry now marks each Tier 2 parameter `integer`. | `docs/rebuild/mentor/governance/canaries.json`, `registry.json`, `agent/tools/check-mentor-canary-parity.mjs` |
| 2 | C.22 Stage 5; OD-23 | **Core resolves the arm.** `resolveMentorCanary` runs at session start, but only when Oracle announced the `canary` context field. Eligible: the Mentor's verified-adult posture (`resolveMentorSafety` says not a minor), the adult dialogue band, and the adult analytics rule. Then the `mentor.canary` H.7 assignment, a deterministic pool of twice the share (salted apart from the runtime's A/B draw), and the exposure recorded before the arm is sent. Variant B is the canary arm and variant A the matched control. Core sends `canary: { proposalId, arm, overrides }` in the negotiated context, never in the model context. At close it stores the reported arm once (`tutor_sessions.canary_proposal_id`, `canary_arm`) and refuses a proposal the manifest does not run. Dataintel refuses a `mentor.canary` experiment unless it is on the tutor surface, adults only and without an upper age bound. | `backend/src/services/pedagogy/mentorCanary.ts`, `routes/tutor.ts`, `pedagogy/behavioralTelemetry.ts` (`CONTEXT_OPTIONAL_FIELDS`), `dataintel/src/routes/queries.ts`, migration `0231_mentor_canary_arm.sql` |
| 3 | C.22 Stage 5 | **Oracle applies it.** `MentorCanarySchema` is closed: an unknown field refuses the context, a control arm carries no override, and a canary arm carries at least one. `applyCanary` moves registered Tier 2 parameters only, clamped to the registry bounds and rounded for integer parameters. Any other key refuses the whole canary: the session runs the approved defaults and reports no arm. The orchestrator builds the telemetry, alliance and self-explanation configs from it and reports `{ proposalId, arm }` in the close record. The park-snapshot fence lists `canary` as derived from the pinned context. | `oracle/src/tutor/mentorCanary.ts`, `core/client.ts`, `tutor/orchestrator.ts` |
| 4 | C.22; Appendix F Stage 5 and §1.4 | **The gate checks delivery.** From `canary` on, `stage5.experimentId` must name a `mentor.canary` canary in `canaries.json` that delivers this proposal, with overrides equal to the proposal's `parameterChanges`. The canary must be `running` while the proposal is in `canary`. `parameterChanges` must name registered Tier 2 parameters, inside their bounds, in files the proposal lists. A proposal with no parameter changes cannot claim a canary. | `agent/tools/check-mentor-governance.mjs`, `governance/proposals/README.md`, `SELF-IMPROVEMENT-GOVERNANCE-POLICY.md` §4.1 and §9 |
| 5 | C.22 Stage 5; C.24 | **Canary against control.** The new signal `canary.arm_comparison` (pedagogical lead) compares each proposal's canary arm with its control, using the share of rules-scored sessions that failed any criterion. The existing disparity rule decides, and a clearly worse canary opens a flag scoped to `proposal:<id>`. `npm --prefix backend run tutor:canary-report -- --proposal=<id> --sample=20 [--transcripts]` prints the comparison and a reproducible sample of closed canary-arm sessions for the named reader. It re-checks every learner and never prints a transcript whose learner now reads as a minor. | `mentorQuality.ts` (`canaryReading`), `evaluationLoop.ts`, `backend/src/scripts/canary-report.ts` |
| 6 | C.2, C.3, C.4; Appendix F §1.3 Fracture-Closure Verification | **The Fracture-Closure gate.** `check-mentor-minor-safeguards.mjs` runs six static checks over Core's tutor routes, the two resolvers and Oracle's admission, and writes a pass/fail JSON with `--report`. (1) The resolvers keep their non-role evidence. (2) Every kid-role test sits inside a resolver or on an allowlist entry that cites an owner decision in the log. A sole-condition test fails, and so does a stale entry. (3) `isMinor` and `originRestricted` are bound only from `resolveMentorSafety`. (4) Every microphone decision takes the resolved indicator. (5) Every memory-review decision compares a value from `classifyMemoryReview`. (6) Oracle's moderation mode, microphone and resume posture read only `session.isMinor`, and no role, age band or birth date reaches Oracle's admission. The OD-18 kid-role hold in `classifyMemoryReview` is the one allowlisted test. Wired into `spec:check`, repo-gates, `release:readiness` (JSON under `coursegen/runs/`) and CODEOWNERS. | `agent/tools/check-mentor-minor-safeguards.mjs`, `package.json`, `.github/workflows/repo-gates.yml`, `agent/tools/release-readiness.sh`, `.github/CODEOWNERS` |
| 7 | C.1; Appendix F §1.3 Age-Tier Calibration Coverage Rate | **The coverage RPC.** `mentor_age_calibration_coverage(p_from, p_to)` is callable by the service role only and returns counts only. For the sessions started in the window, it counts those whose learner's age was unknown at the session start, by the rule of Core's `knownMentorAgeTier`, and how many of those had a `mentor_age_calibrations` row before the session started. | migration `0232_mentor_age_calibration_coverage.sql`, `backend/src/services/mentorAgeCalibration.ts` (`readAgeCalibrationCoverage`) |
| 8 | C.24; Appendix F §1.3 | **The two safety signals.** `safety.fracture_closure` (C.2, external, zero tolerance, from the release gate) and `safety.age_tier_calibration` (C.1, a hard invariant at 100%, read from the RPC; a miss opens an urgent flag), both owned by the Safety and Trust lead. The evaluation loop reads the RPC and the canary arms. Staff console fixtures and labels exist in EN, es-MX and pt-BR, and `canary.arm_comparison` is formatted as a count. Thresholds are in the recalibration log. | `mentorQuality.ts`, `evaluationLoop.ts`, `frontend/src/rebuild/staff/mentorQualityFixtures.ts`, `mentorQualityApi.ts`, `console/staffSectionFixtures.json`, `src/i18n/*/rebuild-staff.json`, `THRESHOLD-RECALIBRATION-LOG.md` |

Tier 1 change-record rows were recorded for `safety.judge`, `mentor.non_negotiables`, `measurement.stage7_and_thresholds` and `governance.model`. Their sign-offs are pending.

### Verification (local)

- Oracle (vitest, focused): `mentorCanary.test.ts` has 17 tests: the generated table equals the registry, defaults sit inside their bounds, clamping and integer rounding, the whole canary refused on any unregistered key, the closed context field, no canary field in the model-context schema, and the orchestrator running and reporting each arm. Also run: `contextFields`, `snapshotFence`, `orchestrator`, `coreClient`, `context`, `parkStore`, `behavioralTelemetry`, `allianceSession`, `privacy-contract-docs`, `mentorGovernedDefaults` and `live-session`: 387 tests in total. Type-check and lint are clean, and no `.boot-test-` process was left.
- Core (vitest, focused): `mentorCanary.test.ts` has 17 tests. They cover OD-23 eligibility (a minor posture, a teen, a tween, under 18 and no analytics consent are never asked for an assignment), the pool share and its ceiling, exposure before the arm, invalid entries never delivered, the arm stored once or refused, and the reproducible sample. `tutor.test.ts` has 11 new route tests. A verified adult in the pool gets the canary arm with its overrides, and the exposure carries target and age. The control arm carries no override. Five refused populations get no canary and no runtime call: the under-13 kid, the independent teen with opt-in, the unverified declared adult, a revoked verification and a kid-role account. Also covered: outside the pool, an unlisted experiment, a failed runtime, an Oracle that did not announce the field, the close store, an unknown proposal and a malformed arm. `mentorQuality.test.ts` has 6 new tests and `evaluationLoop.test.ts` 1 new test. The whole focused set ran at 489 tests with `mentorQualityRoutes` and `spacedReviewCalibration`. Type-check and lint are clean.
- Dataintel: `experiment-age-eligibility.test.ts` (18, four new: three refused canary shapes and the accepted one). Type-check and lint are clean.
- Frontend: `MentorQuality.test.tsx`, `StaffSections.test.tsx` and `StaffProgramme.test.tsx` (70). Type-check is clean, and the i18n gate is green.
- Repo tools: the new `check-mentor-canary-parity.test.mjs` (7) and `check-mentor-minor-safeguards.test.mjs` (10) turn red on each mutation. `check-mentor-governance.test.mjs` has 28 tests, two of them new and covering eight delivery refusals and five `parameterChanges` refusals. The full `tools:test` ran at 418 tests. The three reds were CODEOWNERS coverage of the two new gates and the ledger before recording; all three were fixed and rerun green.
- Native PostgreSQL 17.6 (lane cluster, port 15920): `database/scripts/verify-mentor-f3-postgres.py` applies all 229 migrations and passes 5 checks:
  - the canary pair is stored, and an unknown arm, a malformed proposal id and a half-written pair are refused;
  - the coverage counts the unknown-age sessions as of their start: no evidence, an under-13 declaration with origin, and an adult declaration made after the start. It excludes the known ages (an adult declaration, a teen declaration, a birth date under 13) and the other windows, and counts only calibrations made before the session (7 sessions, 4 unknown, 2 calibrated, 0.5);
  - anon and authenticated are refused;
  - both migrations replay without changing a row.
- Root: `spec:check` (now including the Fracture-Closure gate), `secrets:check`, `governance:check`, `canary:check`, `minor-safeguards:check`, `telemetry:check`, `evaluation-loop:check`, `alliance:check`, `review-calibration:check`, `judge-calibration:check`, `honesty:check`, `session-end:check`, `check-migrations` and `check-migration-phase` are all green.
- Not run here (the orchestrator runs them per merge): browser matrices, `audit:rebuild`, full service suites, `test:all`.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Who may be in a canary.** Only a learner the Mentor already treats as a verified adult (`resolveMentorSafety`: a service-owned ID verification proves 18+), whose dialogue band is adult and whom the adult analytics rule admits. A declared but unverified adult is excluded, because the Mentor gives that account minor safeguards. In practice canaries reach verified parents who use the Mentor. Widening this to declared adults is a Product and Legal decision under OD-23.
2. **Age sent for a verified adult without an exact age.** Core sends 18, the floor the ID verification proves. To keep that truthful, dataintel refuses any upper age bound on a `mentor.canary` experiment.
3. **Non-parameter Tier 2 changes have no canary path.** A reworded scripted line or a persona tone variant cannot reach a share of sessions. The gate now refuses a proposal that claims a canary without `parameterChanges`, so such a change ships only as a human change. A feature-flagged variant path for wording is future scope.
4. **Starting a canary is a Tier 1 act.** `canaries.json` belongs to `governance.model`, so every canary start or conclusion needs a change-record row with both leads' sign-offs. The lighter alternative is a Tier 2 manifest that still requires the proposal's Stage 0.
5. **Canary share ceiling.** 10% of eligible sessions per arm is proposed, pending calibration. There is no experiment-console screen that creates a canary; staff use the experiment API.
6. **Canary regression rule.** The dashboard's existing disparity rule is reused (2x the control, 5 points, 30 scored sessions per arm). A dedicated Stage 5 threshold was not invented.

### Migrations (the orchestrator renumbers at merge)

- `0231_mentor_canary_arm.sql` (expand: two nullable columns with CHECKs, a pair constraint and a partial index)
- `0232_mentor_age_calibration_coverage.sql` (expand: a new service-role function)

### Open items

- `database/types/database.ts` was not regenerated. Core reads the new columns and the RPC untyped through `serviceRest`, as it does for the other dashboard RPCs.
- No canary has run. The first real proposal through Stage 5 is the acceptance evidence for C.22.
- `safety.age_tier_calibration` needs production data. `safety.fracture_closure` is external: its evidence is the release-readiness JSON.
- Tier 1 sign-offs for the four recorded rows are pending: the Pedagogical Reviewer and the Safety and Trust Lead.

## Checkpoint F3-mentor-finish (lane close)

Sync: `codex/spec-migration-s02` merged into `codex/spec-fix3mentor` with no
new commits to take (already up to date). No uncommitted work was left in the
worktree.

### Adversarial pass against the two audited gaps

- **Gap 1 (C.22 Stage 5 canary delivery).** Every mandated piece exists: the
  manifest, the generated bounds tables and their parity gate, Core's
  verified-adult assignment with the exposure recorded first, Oracle's closed
  context field with clamping and whole-canary refusal, the stored arm, the
  gate that checks delivery, the canary-against-control signal and the reader's
  sample. One hole was found and closed: Oracle trusted Core alone for OD-23. A
  context that carried a canary for a minor-posture session would have run it.
  `applyCanary` now takes the session posture and refuses any canary, control
  arm included, when `session.isMinor` is true, and it defaults to the minor
  posture when none is given. Two new Oracle tests pin it (the function and the
  orchestrator: defaults run, no arm reported). Because `oracle/src/tutor/`
  files are Tier 1, change-record rows were recorded for `governance.model` and
  `mentor.non_negotiables` (sign-offs pending).
- **Gap 2 (C.1 to C.4 metrics).** The Fracture-Closure gate, the coverage RPC
  and both safety signals are in place and gated; nothing half-built was found.
- Authorization stays at the server: Core decides eligibility and the arm, and
  Oracle refuses independently. No rebuilt UI was added beyond staff fixtures
  and labels, which exist in EN, es-MX and pt-BR.

### Final verification (local)

- Type-check and lint clean in `oracle`, `backend`, `dataintel` and `frontend`.
- Full unit suites, once each: Oracle 66 files, 1757 tests; Core 148 files,
  3369 tests (1 skipped, the Postgres-only placement test); dataintel 18 files,
  226 tests; frontend 272 files, 3126 tests; `database`: `check-migrations`
  (229 files), `check-migration-phase`, `check-family-lifecycle` and the 48
  `node --test` tests green (`railway-migrate.test.mjs`, which only spawns the
  dry-run script, is slow on Windows; see the lane report). No `.boot-test-`
  process was left.
- Root: `tools:test` 418 tests (the one red was the Tier 1 change record before
  the rows above were recorded; `check-mentor-governance.test.mjs` then ran 28 of
  28 green), `spec:check`, `secrets:check`, `canary:check`,
  `minor-safeguards:check` and `governance:check` green.

### Lane summary

Built: the C.22 Stage 5 canary delivery path end to end (manifest, Core
assignment for verified adults only, Oracle application with two independent
OD-23 fences, stored arm, delivery-checking governance gate, canary-against-
control signal, reader sample) and the Appendix F section 1.3 safety metrics
(Fracture-Closure Verification gate for C.2 to C.4, the C.1 calibration
coverage RPC, and both safety signals on the Mentor-quality dashboard).
Migrations: `0231_mentor_canary_arm.sql`,
`0232_mentor_age_calibration_coverage.sql` (renumbered at merge). Nothing is
accepted or released.

Still open: `database/types/database.ts` not regenerated for the two
migrations; no canary has run (the first real Tier 2 proposal through Stage 5 is
C.22's acceptance evidence); `safety.age_tier_calibration` needs production
data; six Tier 1 change-record rows from this lane await both leads'
sign-offs; there is no experiment-console screen to create a `mentor.canary`
experiment (staff use the experiment API). Owner questions are the six listed
under F3-mentor.

### Merge integration (F3-mentor into `codex/spec-migration-s02`)

- Conflicts: `GAP-FIX-R3.md` (add/add: the identity-site and learning lane
  sections are kept whole and this lane's sections follow them) and
  `THRESHOLD-RECALIBRATION-LOG.md` (history table: both new 2026-09-28 rows are
  kept, the learning lane's P-09 row first). Everything else auto-merged:
  `backend/src/routes/tutor.ts`, `oracle/src/core/client.ts`, `REQUIREMENTS.md`
  (the C.1, C.2, C.3, C.4, C.22 and C.24 rows exist once each, with this lane's
  status) and the three `rebuild-staff.json` locales (valid JSON, identical key
  sets).
- Migrations: the lane's `0228_mentor_canary_arm.sql` and
  `0229_mentor_age_calibration_coverage.sql` became
  `0231_mentor_canary_arm.sql` and `0232_mentor_age_calibration_coverage.sql`
  (offset +3, after the identity lane's `0228` and `0229` and the learning
  lane's `0230`; 1,987 and 3,958 bytes). The two bare "(0228)" and "(0229)"
  comments in `evaluationLoop.ts` now read 0231 and 0232. The gates and the
  Postgres verifier find both files by suffix, so nothing else named the
  numbers. Neither migration redefines a function, trigger or constraint that
  another lane on this branch sets (`tutor_sessions` gains two columns, a pair
  constraint and an index; the coverage function is new), so the apply-order
  state is correct without a reconciling migration.
- Cross-lane: the Fracture-Closure gate ran over the merged tree, including the
  identity lane's new tutor-route admission and the paused-child session end:
  6 checks pass, 2 kid-role tests found, neither the sole condition of a
  C.2/C.3/C.4 safeguard, 1 pinned by an owner decision. No integration defect
  was found; no gate was changed.
- Checks on the merged tree: `typecheck:all`, `lint:all`, `spec:check`
  (including the wallet glossary, dark-pattern, asset and minor-safeguards
  gates), `secrets:check`, `i18n:check`, `canary:check`, `governance:check`,
  `tools:test` (419 of 419); backend 150 files, 3427 tests (1 skipped);
  Oracle 66 files, 1761 tests; dataintel 18 files, 226 tests; frontend 273
  files, 3154 tests (the S03 design contracts included). `database`:
  `check-migrations` (232 files), `check-migration-phase`,
  `check-family-lifecycle` and the 48 `node --test` tests green. On an owned
  native PostgreSQL 17.6 cluster, `verify-mentor-f3-postgres.py` applied all 232
  migrations in order and passed its 5 checks, including the replay of 0231 and
  0232. `database/scripts/railway-migrate.test.mjs`, which the lane could not
  finish, completed on the merged tree (12 transport scenarios and the static
  cross-checks, exit 0; it ran alone for about 25 minutes). No `.boot-test-`
  process was left.

## Checkpoint F3-family

Branch `codex/spec-fix3family`. Two audited gaps in the family area. Each
was checked in the code first, and both were real.

### What was built

| # | SPEC clause | Gap confirmed in code | What was built | Where |
|---|---|---|---|---|
| 1 | D.1; Appendix H 1.3 (Freeze-Enforcement Verification, Unauthorized State-Transition Rate) and 2.2 D.1(d); Appendix H Part 3 Stage 2 and Stage 7 | No Block D database proof ran in CI or release readiness. The only native-PostgreSQL CI job was `social-db-verify`. `verify-freeze-postgres.py` was hard-wired to the Windows audit cluster (`psql.exe`, port 15483). It built a hand-written schema and applied only `0093_enforce_banking_freeze.sql`, so it tested none of the later redefinitions: `allocate_task_reward`/`allocate_pending_credit` (0163), `run_due_scheduled_credits` (0159), `decide_redemption`/`guard_redemption_state`/`family_request_redemption` (0169), `guard_share_gift` (0161) and `guard_banking_account_state` (0212). `check-no-unbacked-guarantee.mjs` only searched the proof for strings. The real-Chrome freeze matrix had been deleted in S10. Running the other Block D verifiers with `LF_PG_FULL_CHAIN=1` also showed that 6 of the 10 failed their replay step, because re-applying "every migration from X on" runs an expand step after its own contract step (0199 after 0200). Three more never ran the whole chain: governance stopped at 0177, and research re-consent and teen deletion notices stopped at their own migration. | **The proof.** `verify-freeze-postgres.py` was rewritten on the shared `LF_PG_*` harness. It applies every migration and first asserts that the live body of each of the 11 enforcing functions still carries its freeze guard and that the 4 enforcing triggers are installed. While a Tutor's freeze holds, it checks that each of these is refused: a direct request insert, the child's request flow, both approval paths, and a level-2 pre-approval even when a superuser forges it. It checks that the bonus-chore, contribution-chore and allowance splits are held, that the scheduled allowance and savings bonus post 0 and keep their due dates, and that the child can neither pledge Share coins nor take a pledge back. The child is refused on the service path (`FREEZE_OWNED_BY_GUARDIAN`) and a stranger gets `FREEZE_ACTOR_INVALID`. Every browser role (child, Tutor, stranger, anon) is refused when it writes the freeze, deletes the account or calls a movement function, and no coin moves. After the lift, each held split lands exactly once, the schedule catches up (2 posted, a 4-coin per-ten bonus), and the waiting request and the pledge resume. It also covers real lock waits in both orders and a replay. **Replay.** New `lf_pg_replay.py`: `replay_set()` returns the migrations under test plus every later migration that redefines one of their functions, triggers or policies, closed transitively. `fingerprint()`/`assert_unchanged()` then assert that every public function, trigger (and its enabled state), policy, table and column grant and EXECUTE privilege is byte-identical afterwards, and name any object that differs. The replay step of the family state machine, teen wallet, chores and bonus, money habits, autonomy, presentation, governance and deletion-notice verifiers now uses it. Governance, research re-consent and deletion notices now honour `LF_PG_FULL_CHAIN`. **A real proof defect the fingerprint found.** The money-habits verifier restored its fault-injected consent gate by replaying `0160`, which put the pre-0182 body of `family_analytics_admitted` back, so every later check ran against a stale gate. It now restores the live definition. **Runner and wiring.** The social runner's cluster logic became `pg-verify-runner.mjs`, shared by `social-db-verify.mjs` and the new `family-db-verify.mjs` (`BLOCK_D`, 11 verifiers, `LF_PG_FULL_CHAIN=1`, a missing file fails). On an external cluster it hands the verifiers the directory of the `psql` on PATH. Root and `database/` scripts: `family:db-verify`. CI: a `family-db-verify` job in `database-ci.yml`, where a red proof also stops the migration auto-apply, and one in the unfiltered `repo-gates.yml`, so a Core-only release re-proves it. `release-readiness.sh` runs it. **Self-tests.** `family-db-verify.test.mjs` checks four things: every Block D verifier is listed and exists; a verifier whose first docstring line cites a Block D clause (D.n, D-n, S07) cannot be left out; every database proof in `block-d-controls.json` is run; and every verifier honours the `LF_PG_*` harness and the whole chain, with CI, repo gates and readiness calling it. `check-no-unbacked-guarantee.mjs` now fails when the registry names a `database/scripts/*.py` proof that `BLOCK_D` does not run. README line 89 and the Mandatory-testing table point at the CI-run proof. The registry's freeze proofs now pin assertions of the new proof | `database/scripts/verify-freeze-postgres.py`, `lf_pg_replay.py`, `pg-verify-runner.mjs`, `family-db-verify.mjs`, `family-db-verify.test.mjs`, `social-db-verify.mjs`, the ten other Block D verifiers, `.github/workflows/database-ci.yml`, `repo-gates.yml`, `agent/tools/release-readiness.sh`, `check-no-unbacked-guarantee.mjs` (+ test), `docs/operations/block-d-controls.json`, `README.md`, `package.json`, `database/package.json` |
| 2 | Frontend Bible 06 (every string localized, every component declares `data-copy-role`); CLAUDE.md SPEC rules; OD-28 three-locale surfaces | `GuardianInvite.tsx` line 71: `<span … aria-label="invite link">{link}</span>`, which is English in es-MX and pt-BR and has no copy role. `GuardianInviteCopy` had no key for it. It was the only hardcoded `aria-label` in the family, banking and wallet surfaces | `GuardianInviteCopy.linkLabel` and `guardianInvite.linkLabel` in `rebuild-family.json` ("Invite link" / "Enlace de invitación" / "Link de convite"). The span uses it and declares `data-copy-role="data"`. The toggle and mint buttons carry `data-invite-control` hooks. New `GuardianInvite.test.tsx` checks, in all three locales, that the link is found by its localized name, has the data role, carries no English label, and that every text-bearing element sits under a copy role. The panel test now uses the localized name. The copy-role audit lane gains `/family@invite-link` (open, then mint; the synthetic Core answers the mint with Core's `{ token, expiresAt }`) | `frontend/src/rebuild/family/GuardianInvite.tsx` (+ test), `src/i18n/*/rebuild-family.json`, `src/routes/app/family/__tests__/GuardianInvitePanel.test.tsx`, `frontend/scripts/audits/lanes/family.mjs` |

### Verification (local)

- Native PostgreSQL 17.6 (lane-owned cluster, port 15930): `npm run family:db-verify` passed 11/11 (see the final run below), every verifier over the whole chain. The replay closure was also checked on its own against a fresh full chain for each parts set (freeze, S07.1-S07.6), and each left an identical schema.
- `database/` `npm test` (54 node tests, including the 6 new runner self-tests), `node --test` of `family-db-verify.test.mjs` and `social-db-verify.test.mjs`, `npm run tools:test` (400/400, including the new unbacked-guarantee case) and `node agent/tools/check-no-unbacked-guarantee.mjs` all green. `social-db-verify.mjs --list` still lists its 15 verifiers after the refactor.
- Frontend: `GuardianInvite.test.tsx` (4) and `GuardianInvitePanel.test.tsx` (8) green. Type-check and full lint clean. i18n gate green.
- Root: `spec:check` (exit 0) and `secrets:check` green.
- Not run here (orchestrator, per merge): the audit matrix including the new `/family@invite-link` state, browser matrices, full suites. The CI jobs have not run: nothing is pushed.

### Decisions taken with the SPEC's conservative default (owner questions)

- The Block D proofs run in both `database-ci.yml` (where they also gate the migration auto-apply) and the unfiltered `repo-gates.yml` (Core-only releases). On a push that touches `database/`, they run twice: about 10 minutes of runner time each on a 3-job PostgreSQL container, estimated from the local timings. The conservative choice is to prove on every build, as Appendix H 2.2 D.1(d) says. The owner may prefer to skip the repo-gates copy when `database/**` changed.
- The deleted real-Chrome freeze matrix was not rebuilt. The database proof now covers the enforcement, and the rebuilt coin screens' freeze card is covered by `BankingPage.test.tsx`. A browser journey of the frozen card on the rebuilt routes stays with the orchestrator's browser matrices.

### Migrations

None.

### Open items

- First CI run of the two `family-db-verify` jobs: confirm on the runner that the Ubuntu `psql` is found on PATH (the runner derives `LF_PG_BIN` from it) and record the job's duration.
- The freeze proof is about 5 to 9 minutes on this machine under load. It is the slowest single verifier with the autonomy one; `LF_PG_VERIFY_JOBS` (3 in CI) bounds the job, and the timeout is 60 minutes.
- Pre-existing, not from this lane: the migration chain cannot be replayed wholesale because of its expand/contract pairs (0199 after 0200). Any other verifier that replays "every migration from X on" will break the same way; `lf_pg_replay.replay_set()` is the shared fix.

## Checkpoint F3-family-finish (lane summary)

**Sync.** `codex/spec-migration-s02` merged into the lane branch: already up to date, no conflicts.

**Adversarial pass against the two audited gaps.**

- Gap 1 (D.1; Appendix H 1.3, 2.2 D.1(d), Part 3 Stage 2 and 7). The enforcement lives in the database functions and triggers, which is the server boundary. The proof covers the child, Tutor, stranger and anon roles on both the service and browser paths. It runs in `database-ci.yml`, where a red proof blocks the auto-apply, in the unfiltered `repo-gates.yml` and in release readiness. Nothing is missing.
- Gap 2 (Bible 06, OD-28). The label is localized in all three locales, the copy role is declared, and only shared controls are used, no legacy component. One defect found and fixed: the minted link used a raw `font-size: .8rem`, which is below the smallest type token and breaks the tokens-only rule. It now uses `var(--type-caption)` with its tracking token (`frontend/src/rebuild/family/guardianInvite.css`). This closes the proportion concern left open at F3-family.

**Final state.**

| Gap | Implementation | Local verification | Acceptance / release |
|---|---|---|---|
| 1: D.1 freeze and Block D proofs in CI and release | Done | `family:db-verify` passed 11/11 over the whole chain (F3-family); runner self-tests green | Not accepted. The first CI run has not been observed. |
| 2: invite link label and copy role | Done | Component tests in all three locales; type-check, lint, the full frontend suite and the i18n gate green | Not accepted. The `/family@invite-link` audit state has not been run through `audit:rebuild`. |

**Verification at finish.** Frontend: type-check, lint and the full vitest suite. `database/`: `npm test`. Root: `tools:test`, `spec:check`, `secrets:check` and the i18n gate. Migrations: none.

**Still open.** The first CI run of both `family-db-verify` jobs: confirm that `psql` is found on the runner's PATH and record the duration. The `/family@invite-link` audit state has not been run through `audit:rebuild`. The browser journey of the frozen card stays with the orchestrator's browser matrices.

**Owner question.** Should the Block D proofs run twice on a push that touches `database/`? The conservative default keeps both runs (Appendix H 2.2 D.1(d), "green in CI on every build").

### Merge integration (F3-family into `codex/spec-migration-s02`)

- Conflicts: `docs/rebuild/REQUIREMENTS.md` and this record only. In
  REQUIREMENTS.md the A.1 row keeps the F3-identity-site and
  F3-identity-site-finish records and appends the F3-family record and its
  evidence link after them; the D.1 row takes the lane's record (the
  integration branch had not changed it). Every other row keeps the integration
  branch's text. This record keeps every earlier lane section and appends the
  two F3-family sections.
- Migrations: the lane adds none, so nothing was renumbered. The integration
  branch gained 0228 to 0232 after the lane's base (identity enforcement,
  Tutor age-record review, V2 selection diagnostics, Mentor canary arm, Mentor
  age calibration). 0228 redefines the kid suspension functions and adds a
  trigger on `guardian_links`, so the Block D proofs were re-run over the
  merged chain rather than taken from the lane.
- Cross-lane gates: no integration defect found. The F3-identity-site change to
  `check-no-unbacked-guarantee.mjs` (the Families privacy line) and the lane's
  new rule (every database proof named in `block-d-controls.json` must run in
  BLOCK_D) merged cleanly and both hold. The verifiers the other round-3 lanes
  added (`verify-account-erasure`, `verify-analytics-disclosure`,
  `verify-learning-r3`, `verify-mentor-f3`, `verify-staff-ops`) do not cite
  D.n or S07 in their first docstring line, so the BLOCK_D self-test does not
  claim them.
- Verification on the merged tree: `npm run typecheck:all`, `npm run lint:all`,
  `npm run spec:check` (exit 0, including the wallet glossary and asset gates),
  `npm run secrets:check`, `bash agent/tools/check-i18n.sh`,
  `npm run tools:test` (420/420), the frontend unit suite (274 files, 3,158
  tests), `node agent/tools/check-no-unbacked-guarantee.mjs` (16 controls),
  `npm run family:db-verify` on a throwaway portable PostgreSQL 17 cluster
  (11/11 over the whole chain, freeze proof 39 s), `npm run social:db-verify`
  (15/15, on the shared runner the lane extracted) and the first stage of
  `cd database && npm test` (54/54, including the six family-db-verify
  self-tests). Its `railway-migrate.test.mjs` stage was still running when
  the merge was committed and is not recorded as passed.
- Open items are unchanged from F3-family-finish. The CI jobs have still never
  run, because nothing is pushed.

## Checkpoint F3-social

Branch `codex/spec-fix3social`. One audited gap: a Tutor could approve a
connection for their child but could not end or report it.

### The gap, confirmed in code

- Core's family router had only the graph, pending requests, decision, history
  and safety-notice routes (`backend/src/routes/family.ts`). No route ended a
  child's follow or approval in either direction, and none reported from the
  guardian's side.
- The database had no guardian-side end: `withdraw_social_connection` is the
  follower's own unfollow, `remove_social_follower` the followed account's own
  tool, `decide_social_connection` settles only pending requests, and the
  retention sweep removes an edge only when the approving guardian is no longer
  current.
- `rebuild/social/SocialGraph.tsx` and `SocialNotices.tsx` were display-only.

### What was built

| SPEC clause | What was built | Where |
|---|---|---|
| E.1, E.13; Block E components 1-2; OD-3 §2 | `public.guardian_end_social_connection(p_guardian, p_kid, p_other)`, service role only. Pair locks in both directions (the block trigger's order), guardian evidence locked, `social_guardian_is_current` re-checked (verified link, parent role, latest verification adult and local-ocr), a child outside the guardian tier refused (`SOCIAL_SELF_MANAGED`), 0 and no write when there is no follow. Otherwise it revokes every approved request between the pair (either direction), closes a teen consent between them, deletes the follow both ways and writes one `social.connection_revoked` row (actor the guardian, reason `guardian_ended`, `kid_user_id`, `guardian_id`, `other_user_id`, request ids, removed edges, origin `database-function`). Returns the number of removed edges | `database/migrations/0233_guardian_end_social_connection.sql` |
| E.2; Appendix J Audit-Log Completeness | The same migration redefines `social_protection_metrics`: a service-role unfollow row (no actor) counts as audited when a `guardian_ended` row with the same transaction timestamp names the same pair. Core records each removed edge as an `unfollow` event, so the reconciliation stays at 100% | same migration; `backend/src/routes/family.ts` |
| E.1, E.13 | `DELETE /api/v1/family/kids/:kidId/social/connections/:userId`: `guardKid` before and after the write, 400 for a malformed or self target or any query, 404 when the account is not a current connection (checked before the write, and again when the transaction removes nothing), 403 for a stale guardian or a self-managed teen, 502 on an unreadable read or receipt | `backend/src/routes/family.ts`, `services/supabaseRest.ts` (`isSocialConnection`, `guardianEndSocialConnection`) |
| E.3 | `POST .../connections/:userId/report`: the bounded report body (5 categories, 140-character note), the guardian as reporter, admitted only for a current connection of the child or an account named in this guardian's notice for this child; calls `submit_social_report`, so it reaches the staff queue, the guardian notices and the pattern evaluation | same files (`hasGuardianSocialNotice`) |
| E.1, E.2, E.3 (Family surfaces) | The graph answers `canEnd` (the child is guardian tier) and each notice answers `canEnd` (named, still connected, guardian tier). `rebuild/social/ConnectionActions.tsx`: a confirmed `DestructiveAction` ("End connection with {name}?", consequence: reconnecting needs your approval) and the existing `ReportDialog`, grouped and labelled by the account's name. Mounted on every graph row and every named notice. Transport is injected (`rebuild/social/guardianConnectionsClient.ts`); success only on Core's exact receipt. After an end, `publishSocialUpdate` refreshes the child's requests, history and graph panels, and a new token-wide subscription re-reads the notices | `frontend/src/rebuild/social/*`, `frontend/src/routes/app/family/SocialGraphPanel.tsx`, `SocialNoticesPanel.tsx`, `socialUpdates.ts` |
| 06 Copy Budget | `socialConnectionActions` in `rebuild-family.json` (en-US, es-MX, pt-BR), budgeted in `copy-budget/family.test.ts`; the report dialog reuses the profile's report copy | `frontend/src/i18n/*/rebuild-family.json` |
| Gates | `verify-social-guardian-end-postgres.py` (joins `social:db-verify` by name). `social:check` section 8: the latest SQL keeps the guardian re-check, the self-managed refusal, the locks, the revocation and the audit row; the metric keeps the reconciliation; Core keeps both routes with the session guardian and the unfollow record; the Family graph and notices keep the actions (4 new mutation tests). Policy `SOCIAL-TIERS.md` §1.3 | `database/scripts/`, `agent/tools/check-social-tiers.mjs` |

### Verification (local)

- PostgreSQL 17.6 (owned cluster, port 15940): `verify-social-guardian-end-postgres.py` applies all 228 migrations and passes 8 checks: refusals leave no trace (unrelated verified parent, stale guardian, the other account, the child itself, null, a self-registered teen's parent, anon and authenticated); a failing audit write rolls back everything; success removes both edges, revokes the approval and writes the audit row; a re-follow either way is refused and the old request cannot be re-approved until a fresh approval; no connection answers 0 with no write; audit completeness stays at 100%. Two mutation checks: the 0204 reconciliation reads the same unfollows as unaudited, and a copy without the guardian re-check lets the stale guardian through. `verify-social-protection-postgres.py` still passes (8 checks) on the new chain.
- Core (vitest): `familySocialGuardianEnd.test.ts` (new, 37 cases: success and each refused population for both routes, receipt mapping, the recheck after the write, the `canEnd` answers), `family.test.ts`, `report.test.ts`. Type-check and lint clean.
- Frontend (vitest): `SocialConnectionActions.test.tsx` (new, 11), the graph, notices, requests, history and refresh panel tests, `FamilyPage` tests, the family copy budget, `rebuild/design`. Type-check and lint clean.
- Root: `spec:check`, `secrets:check`, the i18n gate, `social:check` and its 26 tests, the database package tests.
- Not run here (orchestrator, per merge): browser matrices, `audit:rebuild`, full suites. The two Family social browser verifiers' mocks gained `canEnd`.

### Decisions taken with the conservative default (owner questions)

1. **"Ended" is the existing `revoked` status.** The request table's CHECK allows pending, approved, denied and revoked. Widening it would make every reader of the terminal states (retention, metrics) learn a new value; the audit reason `guardian_ended` records who ended it.
2. **Accounts are addressed by user id, not username.** The graph wire shape allows a null username and notices carry only ids, so a username path would leave some rows without actions. The route never reveals more than the Family list already shows.
3. **A self-registered teen's list stays read-only to its linked parent** (E.8, OD-3 Option B: the teen decides its own connections). Reporting stays available.
4. **A guardian's report counts as an adult's.** It opens a review case immediately and notifies the connected families, but the E.3 three-minors pattern counts minors only, so it does not count as the child's event. Whether it should is an owner question.
5. **Ending also closes an accepted teen consent between the pair and the reverse-direction approval**, so neither side can reconnect without a fresh decision.

### Migrations (renumbered by the orchestrator at merge)

- `0233_guardian_end_social_connection.sql` (`@phase: expand`; applying it deletes nothing, the DELETE lives inside the function).

### Remaining

Acceptance and release evidence for E.1-E.3 and E.13 as the requirement rows
state; a visual pass of the new row actions in the browser matrices.

## Checkpoint F3-social-finish (lane summary)

- **Sync.** `codex/spec-migration-s02` was already contained in the lane
  (merge: "Already up to date"); no conflicts.
- **Adversarial pass against the one audited gap (end/report a child's
  connection).** Authorization sits at the server: both routes run `guardKid`
  before and after the write, the database function re-checks the current
  guardian under the pair locks, and every refused population (unrelated or
  stale guardian, self-managed teen, self or malformed target, non-connection,
  anon/authenticated callers) has a Core test and a PostgreSQL check. The
  rebuilt UI uses only the shared `DestructiveAction` and the existing
  `ReportDialog`; nothing under `rebuild/` imports the legacy app. Copy exists
  in en-US, es-MX and pt-BR. One gap closed here: no test proved that the new
  row actions and both dialogs declare `data-copy-role` (02 rule 19); a test
  now walks the row, the confirm dialog and the report dialog.
- **Verification.** Backend: type-check, lint and the full unit suite (148
  files passed, 1 skipped). Frontend: type-check, lint and the full unit
  suite (272 of 273 files passed in the full run; the one red,
  `rebuild/assets/assetGate.test.ts`, was a 90 s timeout under other lanes'
  load and passes alone, 13/13). Database: every `npm test` step up to
  the migrator passed (migrations, phase, family lifecycle, 48 node tests);
  `railway-migrate.test.mjs` (a fully stubbed transport test this lane did
  not touch) was stopped after 55 minutes still in scenario 2 of 13 with
  every lane running it at once, so it is left to the orchestrator's merge
  run. Root: `spec:check`, `secrets:check`, `social:check`.
- **Status.** E.1, E.2, E.3 and E.13 stay "Implemented and locally verified;
  not accepted". Still open: a visual pass of the new actions in the browser
  matrices (the two Family social verifiers do not click them yet), and
  acceptance and release evidence. Owner questions 1-5 above stand, with the
  conservative defaults implemented.

### Merge integration (F3-social into `codex/spec-migration-s02`)

- Conflicts: `docs/rebuild/REQUIREMENTS.md` (the E.1 to E.4 block; the lane
  changed E.1, E.2, E.3 and E.13, the identity-site lane changed E.4, so each
  row keeps its only updated side) and this record (add/add; the lane's
  sections appended after the other lanes'). Locale JSON auto-merged.
- Migrations: the integration branch had gained `0228` to `0232` after the
  lane's base, so the lane's `0228_guardian_end_social_connection.sql` became
  `0233_guardian_end_social_connection.sql` (17,298 bytes). No other migration
  redefines `social_protection_metrics` after `0214` or touches the new
  function, so apply order leaves the lane's definitions final.
- Integration defect: the family copy tone gate (GAP-FIX-R2 D.8, extended by
  the family lanes) fails when a rebuilt Family surface renders a
  `rebuild-family` group outside its scope. `SocialNoticesPanel.tsx` renders
  the new `socialConnectionActions` group, so `tools:test` went red (6 tests).
  Fixed by scoping the group in `agent/tools/family-copy-tone.lexicon.json`;
  the gate then flagged `socialConnectionActions.reported` in es-MX and pt-BR
  ("equipo de seguridad" / "equipe de segurança"). It names who reads the
  report, the same name the profile and lesson report copy already uses, and
  promises nothing, so it carries one keyed `guarantee` exception with that
  reason, like `socialNotices.title` and `socialNotices.empty`.
- Verification on the merged tree: `typecheck:all`, `lint:all`, backend unit
  suite (151 files passed, 1 skipped; 3,464 tests), frontend unit suite (275
  files, 3,170 tests), `tools:test` (424 pass), `spec:check`, `secrets:check`,
  `social:check`, the i18n gate, `social:db-verify` on a throwaway native
  PostgreSQL 17.6 cluster (16/16, all 233 migrations applied in order; the
  new verifier's 8 checks, mutation checks included) and the first stage of
  `database` `npm test` (`check-migrations`, `check-migration-phase`,
  `check-family-lifecycle`, 54/54 node tests). Its `railway-migrate.test.mjs`
  stage hung again on this Windows machine (no output for about 20 minutes,
  stuck in the `--baseline 0022` scenario, before any of this round's
  migrations) and was stopped; it is not recorded as passed and needs the
  Linux CI run, as for the earlier merges of this round.
- Still open: the visual pass of the new row actions and acceptance and
  release evidence, as above.

## F3-staff-ops

Branch `codex/spec-fix3staffops`. Three audited gaps in operations
notification and staff access governance. Each was checked in the code
first, and all three were real.

### Gaps confirmed in code

| # | SPEC clause | Evidence before this checkpoint |
|---|---|---|
| 1 | H.4; Appendix O 1.3 (Watchdog-Plus-Notification Coverage, Simulated Job-Failure Drill), 2.3(b) | `tutor-retention-watch.yml` had only `permissions: contents: read` and on a stale sweep ran `echo ::error::` then `exit 1`: it opened and commented on no issue. `ops-job-watch.mjs` `WATCHED_JOBS` and `opsJobs.ts` `OPS_JOBS` listed only `vault_backup`, `pulse_backup` and `vault_drift`. `opsJobDrill.ts` `DrillTarget` had no retention target. The retention sweep was the only one of Appendix O's three named jobs whose failure reached nobody. |
| 2 | G.2; Appendix N 1.2, 2.3(b) | No workflow referenced `content:retro-checks` (a grep for `retro` under `.github/workflows` returned nothing). The retroactive check ran only when someone started it by hand. GAP-FIX-R2 F2-staff-ops decision 6 had left the scheduling to the owner. |
| 3 | G.4 (quarterly, calendar-triggered, owned by the staff/access owner); Appendix N 1.1 | `staff_access_review_status` (migration `0195`) computed `due`, and only the Roles & Access card read it (`adminData.ts`). No schedule, job-status field, watchdog issue or email existed for it (a search for access_review, access-review and accessReview under `.github`, `agent/tools`, `opsJobs.ts` and `backend/src/scripts` found only `adminData.ts`). |

### What was built

| # | What | Where |
|---|---|---|
| 1 | Core's operations job status (`GET /api/v1/internal/ops/job-status`, and the staff `GET /admin/ops/job-status`) carries `tutorRetention`, the Mentor retention sweep in the watched-job shape (`job: 'tutor_retention'`, `stale`, `staleAfterHours`, last run and detail). It is built from `getTutorRetentionStatus()`, so the 36-hour window keeps its one home (`RETENTION_STALE_HOURS`, now exported from `tutorData.ts`, not copied). `anyStale` covers it. A failed read is a 502. It sits beside `jobs`, not inside it, because the staff console already shows the sweep on its own card, and the frontend's `jobs` check stays unchanged. `ops-job-watch.mjs` watches four jobs (`tutor_retention` added to `WATCHED_JOBS`). A reply without the sweep, or with it under another name, is refused. A stale sweep fails the watch and is named in the notice that `ops-job-watch.yml` posts to the `ops-watchdog` issue. The drill has a `tutor_retention` target: a simulated stale `tutor.retention.swept` trail makes the real watcher exit 1 and write the notice. `tutor-retention-watch.yml` keeps failing its own run early, and its header now points to the notification path. | `backend/src/services/opsJobs.ts`, `tutorData.ts`; `backend/src/scripts/opsJobDrill.ts`, `ops-job-drill.ts`; `agent/tools/ops-job-watch.mjs`; `.github/workflows/ops-job-watch.yml`, `tutor-retention-watch.yml` |
| 2 | `.github/workflows/content-retro-checks.yml` runs every Monday at 05:00 UTC, and on `workflow_dispatch`. It runs `npm --prefix coursegen run content:retro-checks` against Vault. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` come from the Core service's Railway variables through `RAILWAY_TOKEN`, the pattern `tutor-content-bridge.yml` and `mentor-live-content-monitor.yml` use; no new repository secret. The key is masked, and an empty credential fails the run. A failed verification, an open check with no course or an unreadable Vault fails the run (pipefail) and comments on or opens the `ops-watchdog` issue with the last 60 lines of output. `agent/tools/content-retro-checks-workflow.test.mjs` pins the schedule (daily or weekly), the command, the script target, the credential source, the failure path and the notification, and shows the lint red on each weakened copy. | `.github/workflows/content-retro-checks.yml`; `agent/tools/content-retro-checks-workflow.test.mjs` |
| 3 | The job status carries `accessReviews: { due, windowDays: 90 }` from `staff_access_review_status(90)` (new `getAccessReviewDueCount` in `adminData.ts`, parsed with the same schema as the Roles & Access read; a failed or malformed read is a 502). `ops-job-watch.mjs` fails when `due > 0` and names it in the notice ("elevated staff grant(s) past the 90-day access review (G.4) ... Roles & Access"). It refuses a reply without the number, or with a negative, fractional or non-numeric one. The drill has an `access_reviews` target. | `backend/src/services/adminData.ts`, `opsJobs.ts`; `agent/tools/ops-job-watch.mjs`; `backend/src/scripts/opsJobDrill.ts` |

Documentation:

- `docs/operations/GOVERNANCE.md`: section 2 has a "Review trigger" bullet, and section 4 lists four watched jobs, the scheduled retroactive check and the extended drill.
- `docs/content/FORGE-V2-RELEASE.md`: the cadence of the scheduled run.
- `README.md`: the scheduled-jobs table (with `content-retro-checks.yml` and `ops-job-watch.yml`) and the command rows.
- `docs/operations/CUTOVER-RUNBOOK.md`: `content-retro-checks` is added to the workflows paused during the window.

### Verification (local)

- Core, focused vitest: `staffOps.test.ts` (18, with 3 new cases): the retention sweep is carried stale, fresh and never-run, and the `jobs` list is unchanged; the access-review count is passed with `p_cadence_days: 90`, and a 500 or malformed reply is a 502; the internal status refuses a missing or wrong key. Also `opsJobDrill.test.ts` (8: six drill targets, with the retention and access-review drills new), `tutorData.test.ts` (64) and `admin.test.ts` (94). `npm run type-check` and `npm run lint` are clean.
- `npm --prefix backend run ops:drill`: PASS for vault_backup, pulse_backup, vault_drift, tutor_retention, content_retro_checks and access_reviews (each stale, watcher exit 1, notice written).
- Root: `node --test agent/tools/ops-job-watch.test.mjs` (9, with 4 new cases) and `agent/tools/content-retro-checks-workflow.test.mjs` (5) pass, as do `npm run spec:check` and `npm run secrets:check`.
- Not run here (orchestrator, per merge): full suites and `tools:test` as a whole. No UI changed and no copy changed, so the i18n gate is not affected. No migration.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **The retention sweep is a separate `tutorRetention` field, not a fourth entry in `jobs`.** The staff console already shows the sweep on its own card. Putting it in `jobs` would duplicate it there and change the frontend's strict `jobs` check. The watcher treats it as its fourth watched job either way.
2. **Retroactive-check cadence: weekly (Monday 05:00 UTC).** Every bypass is verified within 7 days, and at least three more runs fit inside the 30-day window. A daily run would comment on the watchdog issue every day about one failing course. The ops watchdog still alerts daily once a check passes 30 days.
3. **Access-review trigger: both the daily watchdog and a calendar-quarter issue.** Each grant is due on its own rolling 90 days, the same verdict the Roles & Access card shows, so a due grant is reported the day it falls due and every day until it is kept or revoked. The SPEC's proposal is "quarterly, calendar-triggered", so the finish checkpoint added the calendar trigger as well (see F3-staff-ops-finish). The rolling per-grant check stays; the owner may drop one of the two.
4. **The notification channel is the `ops-watchdog` GitHub issue**, the H.4 channel already built. For the notice to reach the staff/access owner and the ops owner, they must watch the repository or that issue label (owner step).

### Migrations

None.

### F3-staff-ops-finish

Sync: `git merge codex/spec-migration-s02` was already up to date.

Adversarial pass against the three gaps. H.4 (retention sweep notification) and G.2 (scheduled retroactive checks) held: the server builds the status, the watcher refuses any reply without the fields, and the drill proves each. G.4 was half-built. The SPEC mandates a cadence "quarterly, calendar-triggered, owned by the staff/access owner" (10-PRODUCT-GOLD-STANDARD-REQUIREMENTS G.4), and only the rolling per-grant watchdog existed. It was built now:

| What | Where |
|---|---|
| The job status's `accessReviews` also carries `total`, the elevated grants held, from the same `staff_access_review_status` read (`getAccessReviewDueCount` became `getAccessReviewCounts`, returning `{ due, total }`, or null on a failed or malformed read, which is a 502). | `backend/src/services/adminData.ts`, `opsJobs.ts`; `staffOps.test.ts` |
| `access-review-quarterly.yml` runs at 09:00 UTC on 1 January, April, July and October (and on `workflow_dispatch`). It asks Core for the status over the same Railway SSH route as `ops-job-watch.yml`, and opens the quarter's issue, "Quarterly access review: YYYY-Qn", labelled `access-review`, or comments on it if it is already open. The issue carries the held and due counts and the review steps (every grant against actual usage on Roles & Access, keep or revoke each, then close). It opens even when nothing is due. An unreadable status still opens the issue and turns the run red. | `.github/workflows/access-review-quarterly.yml`; `agent/tools/access-review-quarterly.mjs` |
| `agent/tools/access-review-quarterly.test.mjs` (8 tests) covers the quarter label, the issue with counts, the issue with nothing due, eight unreadable replies (each still writes the issue and exits 1) and a workflow lint. The lint pins the calendar-quarter cron, the tool call, `issues: write` and an `always()` notification, and goes red on yearly or daily schedules, a skipped tool, a failure-only notice and a read-only permission. | `agent/tools/access-review-quarterly.test.mjs` |
| Docs: GOVERNANCE.md section 2 has a "Calendar trigger" bullet. The README scheduled-jobs table now counts fifteen workflows, with the new row. CUTOVER-RUNBOOK.md pauses `access-review-quarterly`. REQUIREMENTS G.4 row appended (not accepted). | docs |

No UI or copy changed, so the i18n gate and the UI audits do not apply. Authorization: the counts are read only through Core's internal status (`x-internal-api-key`, 403 without it, already pinned) and the staff route behind `manage_support`.

Final verification (local): backend `npm run type-check` and `npm run lint` clean. Full backend unit suite: 147 files passed and 1 skipped (the Postgres-only placement test), 3,341 tests passed and 1 skipped. Root `npm run tools:test`: 416 of 416 passed. `npm run spec:check` and `npm run secrets:check` are OK. `npm --prefix backend run ops:drill` gives PASS for all six targets.

### What remains

- The staff/access owner must watch the `access-review` label, as well as `ops-watchdog`, and the first quarterly run (1 October 2026 if deployed by then) is the first real review.
- Owner and ops steps: the first scheduled runs in production of `content-retro-checks.yml` and `ops-job-watch.yml`, with its new fields, once Core is deployed. Deploy Core before the watcher runs against it: a Core without `tutorRetention` and `accessReviews` makes the watcher refuse the reply and notify, which is loud, not silent. Also the subscription of the staff/access owner to the `ops-watchdog` issue, and a drill against the deployed Core.
- Human review. Acceptance of G.2, G.4 and H.4.

### Merge integration (F3-staff-ops into `codex/spec-migration-s02`)

- Conflict: only this record (add/add). Resolved as a union: the integration
  branch's header and every earlier lane section kept verbatim, this lane's
  sections appended after them. Every other file auto-merged, including
  `adminData.ts`, `staffOps.test.ts`, `README.md` and `REQUIREMENTS.md`
  (rows G.2, G.4 and H.4 carry both sides' appended records).
- Migrations: none in this lane, so nothing was renumbered.
  `database/types/database.ts` is unaffected.
- Integration defects: none found. The staff console's `isOpsJobs` check
  reads only `jobs` and `anyStale`, so the new `tutorRetention` and
  `accessReviews` fields pass through it unchanged.
- Noted, not caused by this lane: the README scheduled-jobs table lists
  fifteen workflows, but the merged tree has further scheduled workflows
  from other lanes that are not in it (`family-retention.yml`,
  `learning-retention.yml` and the `mentor-*` audit and monitor workflows).
  The count is true of the table, not of the repository; a docs pass should
  add those rows.
- Checks on the merged tree: `npm run typecheck:all` and `npm run lint:all`
  clean; backend unit suite 151 files passed and 1 skipped (3,470 tests
  passed, 1 skipped); `npm --prefix backend run ops:drill` PASS for all six
  targets; `npm run tools:test` 441 of 441; `npm run spec:check`,
  `npm run secrets:check` and the i18n gate OK. Line endings: every touched
  file stays LF as in the index.
- Still open, as above: deploy Core before the watcher and the quarterly
  run use the new fields; first production runs; owner subscriptions to the
  `ops-watchdog` and `access-review` labels; human review and acceptance.

## F3-design-system

Branch `codex/spec-fix3designsy`. Three audited gaps, each checked in the code
first; all three were real.

### What was built

1. **Class B navigation marks; the compact tab bar switches on** (Bible 02 §7
   rule 9; 07 §1 class B, §3 house style; 03 §3.4).
   - 22 in-house SVG marks (`frontend/public/rebuild/art/nav-*.svg`, 48 px grid,
     flat token fills, at most 3 hues, no text, no accent or error hue, one file
     for both modes): learn, tasks, wallet, family wallet, coins (the Tutor's
     Wallet), family, profile, become-a-Tutor, staff, back-to-app, and the 12
     staff console sections (overview, content, users, age corrections, emails,
     analytics, intel, Mentor quality, generation, audit, reports, roles).
   - Registered in `src/rebuild/assets/manifest.json` (slot `nav.icon`, type
     svg, modes both, altKey decorative, review status draft) under a new review
     family `navigation`; the asset gate (`scripts/check-rebuild-assets.mjs`)
     knows the family and resolves `nav.*` id references.
   - `src/rebuild/design/navMarks.ts` holds the ids; every `NavSlot` in
     `src/app-shell/navigation.ts` (SLOTS and STAFF_SLOTS) now requires an
     `iconAssetId`, carried through `AppLayouts.tsx` (learner, Tutor and staff
     layouts) into the shells. The preview shell gallery uses the same marks.
   - `shells.tsx`: a mark is shown only when the manifest resolves it;
     `data-icons='all'` when every entry has a mark. The current entry is
     marked on its list item (`data-current`), so the compact rule in
     `shells.css` no longer needs `:has()`; below a 360 px container inactive
     tabs are 48 px icon targets, only the current label is visible, every
     name stays the link's accessible name, and the bar's insets shrink to give
     the current label room (the 8 px gap between targets stays).
   - The Mentor tab before a character is chosen has no picture (02 rule 21, no
     stand-in) and keeps its word in the compact bar (`data-keep-label`).
2. **The 14 px floor on mounted screens, and an audit that checks it** (02 rule
   11, §3 caption; 06 §7; 02 §1.2).
   - `.lf-streak-weekday` (streak strip: learner home, rhythm, own profile) and
     `.lf-guardian-invite-link-value` (co-guardian invite link on /family) use
     `font: var(--type-caption)` (14 px).
   - The invite link has `data-copy-role="data"` and no hard-coded English
     `aria-label`: the visible link is its own name.
   - `scripts/audits/in-page.mjs`: 12 is no longer a step of the proportion type
     scale, and text fit reports `font<14px` for any visible non-SVG text under
     14 px.
3. **Flat, token-only feature stylesheets, and a contract over all of them**
   (02 rules 2, 10, 11, 23, §4.4, §3 input; 07 §3; 05 §2).
   - CPA counters are flat fills (no inset ridge, no `#000` mix); the flowchart
     outcome node is told apart by its mint-soft fill, word and weight, not a
     border; the what-if branch card is a surface card on `--elevation-card`,
     the chosen one wearing the 3 px selection ring; the staff learning-quality
     note is the shared `TextAreaField` (the raw textarea and its outlined
     rules are gone); the neutral streak dot's boundary is `--edge`.
   - The widened contract found four more lines on hue fills, fixed the same
     way: the CPA step rows' left stripe, the number-line marker's surface
     ring, the operations token's ink border (the spent token keeps a dashed
     `--edge` line: it has no fill), and the place-value rod's unit separators
     (now a 1 px gap).
   - `src/rebuild/design/controlsCss.test.ts` now checks every
     `src/rebuild/**/*.css`: colour literals only in `tokens.css` and
     `document.css` (plus the two shadow tokens of `system.css`); no inset
     relief ridge; no border or outline on a rule with its own hue fill (focus
     rules excepted); no HTML font size under .875rem (SVG text rules, which
     paint with `fill`, excepted); no text-overflow or line clamp; gradients
     only as hard-stop pattern fills (the second channel of a series, 05 §2),
     never as a shade. Each rule was mutation-checked.

### Verification (local)

- Frontend `type-check` and `lint` (`eslint .`) clean.
- Focused vitest: `shells.test.tsx` (new: compact tab bar at a 320 px
  container, applying the shell sheet's own container block; data-icons,
  visible labels, accessible names, decorative marks; unchosen Mentor; a
  missing mark; the Tutor bar), `navigation.test.ts` (every slot's mark is
  registered, decorative and distinct per destination), `controlsCss.test.ts`
  (59), `auditFloor.test.ts` (new, the in-page floor rule in jsdom),
  `StreakStrip.test.tsx`, `GuardianInvitePanel.test.tsx`,
  `LearningQualityPanel.test.tsx`, the learning board and operations tests,
  `boardAudit.test.ts`, and the asset gate and its mutation tests.
- `node scripts/check-rebuild-assets.mjs`: OK, 355 class B assets, owner style
  review pending for the new `navigation` family among others.
- `audit:text-fit` at 320 px on Vite 5960, Chromium, 3 locales x 2 modes x
  normal/+40% text x normal/WCAG spacing: the preview shells (learner, teen,
  Tutor, staff, staff limited, staff menu; 144 configurations) and the mounted
  shells on real routes (`/learn` child, `/profile/settings` teen,
  `/admin/intel` staff limited, `/family` Tutor empty; 96 configurations): no
  findings.
- One look at 320 px (headless Chromium, CDP capture): the es-MX learner bar
  and the pt-BR dark Tutor bar sit on one row with `data-icons='all'` and only
  the current label visible.
- Root `spec:check` (exit 0) and `secrets:check` OK. The i18n gate was not
  needed: no copy key changed in this lane.

### Decisions taken with the SPEC's conservative default (owner questions)

- **Unchosen Mentor tab in the compact bar.** 02 rule 21 forbids a stand-in
  picture, so before a character is chosen the Mentor tab keeps its word while
  the other inactive tabs compact. A class B "stage" mark would be an
  alternative; it needs the owner's word because it would sit in the Mentor's
  own slot.
- **Navigation family style.** The 22 marks are drafts; the owner's first-asset
  style review of the `navigation` family (07 §7 item 2) is pending, and a
  release build refuses drafts by design.

### Open items

- The linked teen's six-entry learner bar (Learn, Mentor, Tasks, Wallet, Family
  wallet, Profile) needs 5 x 48 px plus gaps before the current label, which
  does not fit one 320 px row: it reflows onto a second row, with no crop. The
  01 research asks for 4-5 bottom items; trimming the six is a product call.
- The teaching charts' 12 px HTML tags (`.lf-chart-tag`) and the SVG chart and
  operations labels sized in drawing units are the charts gap, owned by the
  learning lane; the static contract allowlists `.lf-chart-tag` by name, and
  the new `font<14px` text-fit finding will report those tags on any audited
  state that shows a chart until that gap closes.
- Human review (style, both modes, screen reader) and acceptance.

### Migrations

None.

### Lane finish (F3-design-system-finish)

- **Sync.** `codex/spec-migration-s02` merged: already up to date, so there
  was nothing to resolve.
- **Adversarial pass against the three gaps.** 02 §7 rule 9 asks that below
  360 px inactive tabs become 48 px icon buttons, only the active tab shows its
  label, and every name stays available to assistive tech. The lane does that
  for every learner, Tutor and staff slot. The one exception is the unchosen
  Mentor, which keeps its word because rule 21 forbids a stand-in. The 14 px
  floor holds on the two mounted offenders, and the audit now reports any
  visible text under 14 px. Every rebuilt stylesheet sits under the flat,
  token-only contract. No legacy component is used: the note field is the
  shared `TextAreaField`. No copy key changed, and the lane has no server
  surface, so no authorization boundary is involved. Nothing was missing.
- **Full frontend unit suite, run once.** Frontend `type-check` and `lint` are
  clean. `vitest run` (3 threads): 272 of 273 files and 3142 of 3143 tests
  passed. The one red was a 90 s per-test timeout in
  `src/rebuild/assets/assetGate.test.ts`, on the Mentor-avatar mutation case,
  while other lanes were loading the machine. Run alone, the file passed 13 of
  13 in 923 s. Several of its cases take 100-140 s alone, so the file is close
  to its own budget under load. That is a harness-time risk, not a product
  defect; see the open items. Root `spec:check` (exit 0), `secrets:check` and
  `check-rebuild-assets.mjs` are OK.
- **Status.** Implemented and locally verified. Not accepted and not released.
  Still open: the owner's style review of the `navigation` family, the teen's
  six-entry bar (a product call), the charts' 12 px tags (learning lane), a
  human review, and the asset-gate file's timing under load.

### Merge integration (F3-design-system into `codex/spec-migration-s02`)

- **Migrations.** None in the lane; nothing renumbered.
- **Conflict: the co-guardian invite link's name.** The family lane had
  already replaced the hard-coded English `aria-label` with the localized
  `guardianInvite.linkLabel` (en-US, es-MX, pt-BR), while this lane removed
  the label. Both fixed the same defect (06 §7: no hard-coded English). The
  merge keeps the localized name, so the link is still announced as "Invite
  link" in each locale, together with this lane's 14 px caption size and
  `data-copy-role="data"`. `GuardianInvitePanel.test.tsx` keeps both sides'
  assertions: the localized name, the data role, the class and the caption
  font rule, and, on a mint failure, neither the named link nor any
  `family?join=` text. The stylesheet keeps the family lane's
  `letter-spacing: var(--type-caption-tracking)` beside the caption font.
- **i18n gate.** `check-hardcoded-strings` flagged the two-word fixture texts
  in `src/rebuild/design/auditFloor.test.ts` (its directory filter excludes
  only `__tests__/`). The fixtures are now single words ("Invitation",
  "Hidden"); the test still proves the same floor rule. The gate was not
  changed.
- **Cross-lane checks.** The widened flat, token-only stylesheet contract
  (`controlsCss.test.ts`) passes over every stylesheet the other round-3 lanes
  added; every `NavSlot` on the merged tree carries a registered mark
  (`tsc` clean, `navigation.test.ts` green).
- **Checks on the merged tree.** `typecheck:all`, `lint:all`, the full
  frontend `vitest run` (276 files, 3187 tests), `spec:check` (exit 0, asset
  gate, OD-28 wallet glossary and the S05/S08 gates included),
  `secrets:check`, `check-i18n.sh` and `tools:test` (441 tests) all pass.
  Browser matrices and `audit:rebuild` were not run here.
