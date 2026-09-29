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
