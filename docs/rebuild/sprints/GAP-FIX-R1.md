# Gap-fix round 1

Lane records for the first gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F1-identity-site

Lane: identity-site, branch `codex/spec-fix1identity`. Five audited SPEC gaps
were checked in the code first. All five were real, and all five are closed at
the implementation and local-verification level.

### 1. A parent-created child is never asked their own age (A.4; OD-3; Appendix M 1.1)

The gap was real. `birthDate` was optional on `POST /family/kids`, and no
declaration was written without it. `readAgeScreen` then returned
`required=true`, and the child answered the self-declaration screen, with any
band, as insert-once evidence.

Built:
- Core `POST /family/kids` requires a birth date or a Tutor-chosen `ageBand`
  (`under_13` / `13_to_17`, which must agree with a date when both are sent).
  It refuses neither with `CHILD_AGE_REQUIRED` before any identity is created,
  and records the declaration before the role (rollback on failure as before).
  (`backend/src/routes/family.ts`, `services/ageScreen.ts`: `ChildAgeBand`,
  `childAgeBand`, `recordAgeScreenBand`, `readAgeRecorded`.)
- `PATCH /family/kids/:kidId` records the first declaration from a new date
  or band. A band-only change of an age already on record is refused
  (`AGE_ALREADY_RECORDED`, insert-once). A date still updates the profile.
- `GET /family/kids` reports `ageRecorded` per child.
- `POST /auth/age-screen` refuses a kid-role caller (`403 KID_AGE_BY_TUTOR`)
  before any write, and fails closed when the role cannot be read.
- Frontend: `RequireAgeScreen` shows a kid (or any caller Core refused with
  `KID_AGE_BY_TUTOR`) the single-state "Ask your Tutor" screen
  (`AgeScreen` state `askTutor`, no date form). The Family console's add-child
  form requires an age band or a birth date. Manage account asks the Tutor for
  the age of a child with none on record. Copy is in 3 locales within budget.

### 2. The database refuses a kid-role address change on any path (A.6; Appendix M 1.3; Part 2.1 criterion 2)

The gap was real: only Core refused the change, and GoTrue was reachable
directly through Kong.

Built:
- Migration `0193_guard_kid_email.sql`: a `guard_kid_email` BEFORE UPDATE
  trigger on `auth.users` (SECURITY DEFINER). For a kid-role account it raises
  `P0001 KID_EMAIL_FORBIDDEN` on any email move, except to the derived
  `<username>@kids.littlefounders.invalid` of the current (guarded) handle,
  which is the Tutor's S-06 rename. It also raises on any new pending email
  (`email_change`) or phone. Values are compared first, so GoTrue's whole-row
  rewrites at sign-in pass. There is deliberately no session switch to skip
  the check; the Tutor's rename passes on its own terms.
- `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED: "true"` is pinned in the compose
  overlays written by `database/scripts/local-stack.sh` and
  `disposable-stack.sh`, and documented in `README.md` for the Railway auth
  service.
- Native proof: `database/scripts/verify-kid-email-guard-postgres.py` (5
  checks on the full chain). It covers 15 refused writes by GoTrue's role, the
  service role and a superuser; sign-in rewrites; clearing a pending value;
  adult, teen and Tutor changes; and the Tutor rename. The existing
  `verify-kid-username-change-postgres.py` still passes on the new chain.

### 3. Onboarding completion requires the age screen (Appendix M 1.1; Part 2.3(b))

The gap was real. `onboardingRouter` now mounts `requireAuth,
requireAgeScreen`. An adversarial test in `ageScreen.test.ts` shows that an
unscreened account gets `403 AGE_SCREEN_REQUIRED` and nothing is written. A
refused child's guest carries the under-13 origin and still passes.

### 4. The onboarding Mentor chooser shows the characters on the Diorama (Bible 08 §8; OD-6)

The gap was real, and the assets exist. Each O1 Mentor row now leads with
`findChooserStill(character, theme)`, the `mentor.chooserStill` render used by
the Mentor screen's chooser, with its name and a line of up to 6 words. The
`PUT /tutor/preferences` save is unchanged. A character without a still falls
back to its avatar render, never a stand-in. `identity.test.tsx` asserts that
the rows use `mentor.<character>.chooser.<theme>` and that no `mentor-avatar`
slot is rendered.

### 5. The staff-reviewed age correction (E.4 as amended by OD-3; Appendix J 1.1)

The gap was real: no table, route or screen existed.

Built:
- Migration `0194_age_correction_requests.sql`:
  - `age_correction_requests`: requester, saved and requested band, a birth
    month for a 13-17 band only, status, decider, reason code and timestamps.
    RLS is on with no policy. There is no browser grant, and the service role
    can SELECT only. A unique partial index allows one pending request per
    account.
  - `request_age_correction`: refuses a kid role, an under-13 origin, a
    guest, an unscreened account, no change, a malformed band or month, and a
    second pending request. An under-13 request marks the under-13 origin at
    once (0086: a later under-13 disclosure always protects).
  - `decide_age_correction`: the decider must be superadmin, or admin with
    `manage_users`, and never the requester (`SELF_DECISION`). Only a pending
    request can be decided, and the reason must match the decision. An
    approval replaces the declaration through `record_age_declaration`,
    promotes a due month through `promote_age_declaration`, and re-runs the
    E.13 review when the tier moved. Every decision writes one `audit_logs`
    row (G.3) in the same transaction.
- Core:
  - `GET` / `POST /api/v1/account/age-correction` (strict body `{ birthDate }`,
    kid and guest refused before any write).
  - `GET /api/v1/admin/age-corrections` and `POST
    /api/v1/admin/age-corrections/:id/decision`, behind `manage_users`. The
    decider is always the session, never the body.
  - All of it is in `services/ageCorrection.ts`.
- Frontend:
  - The Settings age card (`AgeRecordCard` and `AgeRecordSetting`) now also
    shows a self-declared adult. When Core says the account may ask, it
    offers "Request a correction" and then shows the status (pending,
    approved or rejected).
  - `settings.birthDateHelp` now points to the correction.
  - The rebuilt staff section "Age corrections" (`staffGrants` entry
    `ageCorrections`, `navigation.ts`, `staff.tsx`, `staffConsole.tsx`,
    `StaffAgeCorrections.tsx`, and an Overview link) lets staff filter,
    open a request, pick a matching reason, confirm, and see the outcome.
  - Copy is in 3 locales within budget.
- Native proof: `database/scripts/verify-age-correction-postgres.py` (9
  checks). It covers the refused populations; a pending request changing
  nothing; that no one decides their own request and a non-staff decider is
  refused; that an approval moves the declaration, social tier and analytics
  admission with one audit row; a due month promoted; a rejection changing
  nothing; the under-13 request protecting at once; and browser denial.

### Verification (lean mode)

- Backend: `type-check` and `lint` are clean. The focused vitest files pass:
  `ageScreen`, `familyKids`, `family`, `onboarding`, `motivationS053e`,
  `ageUpgradeChain`, `insights` and the new `ageCorrection` (28 cases).
- Frontend: `type-check` and `lint` are clean. The focused vitest runs pass:
  `rebuild/identity`, `rebuild/family/console`, `rebuild/account`,
  `rebuild/staff`, `app-shell`, `app-routes`, `routes/app/profile`,
  `auth/RequireAgeScreen`, `design/shells` and every `copy-budget` file.
- Database: `check-migrations` and `check-migration-phase` pass on the
  194-file chain, and both new native verifiers pass on PostgreSQL 17.6 (lane
  cluster, port 15710).
- Root: `spec:check`, `secrets:check` and the i18n gate pass.
- Not run (orchestrator merge gates): full suites, `audit:rebuild`, and the
  browser matrix. The `onboarding@mentor*` audit re-run was attempted, but
  headless Chrome did not open its debugging port inside this agent's
  sandbox. It must run at the merge.

### Remaining limitations and open items

- A live GoTrue proof is still missing: `PUT /auth/v1/user {email}` with a kid
  token on the disposable stack. The trigger is proven natively. Whether a
  GoTrue version sends the confirmation mail before its refused write needs
  that live run.
- Railway's auth service must carry
  `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true`. This is an operator step,
  deferred to production.
- A parent-created child whose age is still missing sees "Ask your Tutor"
  until the Tutor gives it in Family. No backfill guesses a band for a child
  with no stored date. Children with a stored `profiles.birth_date` were
  already backfilled by S10.1.
- A later birth date from a Tutor does not change an age already on record
  (the declaration is insert-once, as before). A guardian-side correction of a
  parent-created child's recorded band is not in scope here.
- Browser matrix, audits, human design review and Trust review are pending.

### Owner questions (conservative defaults applied)

- An under-13 correction request marks the under-13 origin at once, before
  staff decide. This is the protective reading of 0086. It stays even if
  staff reject the request. Confirm.
- The correction's reason codes are `evidence_verified`, `entry_error`
  (approve), `evidence_missing` and `not_credible` (reject). Evidence is
  checked outside the app. No document upload is built.
- Self-declared adults now see the age card, so they can ask for a
  correction.

## Checkpoint F1-identity-site-finish (lane summary)

Final state of the identity-site lane. All five audited gaps (A.4, A.6, E.4,
Appendix M 1.1 / Part 2.3(b) onboarding, Bible 08 §8 chooser) are
implemented and locally verified; none is accepted or released.

- Sync: `codex/spec-migration-s02` had not moved since the lane branched
  (`d0c9a0f7`), so the merge was a no-op.
- Adversarial pass against the SPEC scope found no mandated behavior missing.
  Every refusal is enforced at Core and, for A.6 and E.4, again in the
  database. The rebuilt screens (`ChildControls`, `AgeRecordCard`,
  `AgeScreen` ask-your-Tutor state, `StaffAgeCorrections`) import only the
  shared design controls and shells, and their copy exists in EN, es-MX and
  pt-BR. E.4 is met by its "lock" branch for parent-created children: their
  recorded band is insert-once, and the database's `profiles_birth_date_guard`
  (0087) still refuses a self-edit.
- Fixes in this checkpoint:
  - `backend/src/__tests__/ageCorrection.test.ts`: the `rpcCalls` helper
    dropped the recorded body from its type, so backend `type-check` was red
    (TS2339) although the tests ran. It is generic now.
  - `frontend/src/routes/onboarding/__tests__/OnboardingPage.test.tsx` still
    expected the square `mentor.<c>.avatar` renders in the O1 chooser. It now
    asserts the `mentor.<c>.chooser.<theme>` stills and no `mentor-avatar`
    slot (Gap 4).
  - `backend/src/__tests__/analytics.test.ts` (not lane code, found by the
    full suite): "does not invent years of leading zeros for all-time" used
    the real clock and turned red on 2026-09-28, when the series from
    2026-08-20 reached 40 days. `now` and the zone are now pinned. The base
    branch has the same red.
- Verification:
  - Backend and frontend `type-check` and `lint` are clean.
  - The full backend unit suite ran: 125 of 126 files passed, and the one red
    was the analytics clock test above, which passes after the fix.
    `ageCorrection` passes 28 of 28.
  - The full frontend unit suite ran twice with other lanes loading the CPU
    to 99%. The first run's real red was the onboarding test above. The
    second run's reds were timeouts only, in `App`, `BankingPage`,
    `AuthLayout` and `assetGate`. All four pass when run alone, and
    `check-rebuild-assets.mjs` passes directly.
  - `database` `npm test`: `check-migrations`, `check-migration-phase`,
    `check-family-lifecycle` and the node test files pass on the 194-file
    chain. `railway-migrate.test.mjs` was still applying its full-chain
    scenario after more than two hours under load when this record was
    written; see the lane report.
  - Root `spec:check` and `secrets:check` pass.
- Still open: the live GoTrue proof on the disposable stack, the Railway
  `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED=true` operator step, the
  `onboarding@mentor*` audit, the browser matrix, device and screen-reader
  passes, human design and Trust review, and acceptance for A.4, A.6 and
  E.4. A Tutor cannot correct a parent-created child's recorded band (see
  the owner question below).

Additional owner question (conservative default applied): E.4 allows either
a lock or a guardian re-confirmation. The lane locks. A Tutor who entered the
wrong band for their child has no in-app path to change it; the recommended
follow-up is to let the Tutor file the same staff-reviewed request for a
linked child.
