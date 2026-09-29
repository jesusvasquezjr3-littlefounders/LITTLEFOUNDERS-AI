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
