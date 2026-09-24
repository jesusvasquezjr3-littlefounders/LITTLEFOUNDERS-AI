# S04: acquisition, verified-parent integrity and truthful promises

Status: in progress. Started 24 September 2026. Owner: Engineering for implementation; Product and Safety/Trust for the decisions/reviews named by the SPEC. No release approval is recorded.

## Binding acceptance sources

- Owner decision OD-3 (access model) and the A.1 decision table ("for each FAQ promise: build the flow or remove the claim").
- Product A.1, A.5, A.6.
- Appendix M: acquisition Definition of Done and phasing.
- Frontend Bible 02 and 06 for rebuilt identity surfaces.

Risk classification: **trust and identity boundary**. Existing production UI may receive OD-8 hotfixes; it is not reused in the rebuilt frontend.

## Point-by-point checkpoints

| ID | Scope | Product acceptance | Frontend acceptance | State |
|---|---|---|---|---|
| S04.1 | A.1 truthful FAQ promises | Second verified guardian built (single-use 7-day invite + verified-parent acceptance); kid suspension built (last verified link lost → sessions revoked; 90-day lazy purge); in-product report tool exists since S02.3ab; FAQ copy states each mechanism accurately | Invite mint/accept and suspended-account surfaces rendered in the current product with rebuild components | In progress: implementation and local verification recorded; human review and real-database evidence pending |
| S04.2 | A.5 verification status split | Distinct id-verified vs staff-granted vs revoked status projected to the staff console; parent-role staff grant requires a mandatory audited justification; document-type declaration removed from the form (cannot be validated); revocation has a real staff trigger path with a mandatory reason | Users console shows the verification badge and the revoke-with-reason action; Roles console demands the justification for Tutor grants; verify-parent form no longer collects a document type | In progress: implementation and local verification recorded; human review and real-database evidence pending |
| S04.3 | A.6 role-branched Settings | Kid role: email change refused at the API (no real email exists by design) and username edits refused at the API (sign-in identifier derives from it); universal/teen accounts keep both with the documented sign-in/profile username divergence | Settings shows the kid's locked username with the fixed-sign-in hint and replaces the email row with the data-minimization note; server errors surface the same truth | In progress: implementation and local verification recorded; human review and real-database evidence pending |

## S04.2 implementation and rationale

Inspected evidence: `parent_verifications.method` already distinguished `local-ocr` from any other grant path, and the Mentor-safety resolver (S01.1) already treats only a current `local-ocr` verified row as adult evidence — but the staff console showed nothing, a Superadmin could grant the parent role with no explanation, the verification form collected a document type it never validated, and the `revoked` status had no writer.

**Distinct status.** The staff Users directory now projects each account's latest verification row into a four-value status — `id-verified` (latest row `verified` via `local-ocr`), `staff-granted` (latest verified row via any other method, or a parent role with no verification row at all), `revoked` (latest row revoked), or none — read through the existing `manage_users` gate. The Users console renders the badge in the table and the detail dialog.

**Mandated justification.** The superadmin parent-role grant now refuses a body without `justification` (10–200 chars) and writes it to its own audit row (`admin.parent_role_justification`), so the reason is reconstructable after the grant trigger has recorded actor and timestamp. The Roles console renders the required justification field only for the Tutor role, with a hint that the badge will read Staff-granted.

**Document type.** The declared document type is removed from the verification form and from the Core schema/insert — the image content cannot validate the declaration, and collecting an unvalidated claim is the exact pattern the requirement bans. The historical column keeps its DB default for pre-existing rows; migration 0111 does not touch it.

**Revocation trigger.** A new `manage_users` endpoint (`POST /admin/users/:userId/verification/revoke`) requires a 10–300 char reason, writes the audit row FIRST (so the reason exists even if the write fails), then inserts a new `parent_verifications` row with status `revoked` and method `staff-revoked` — migration 0111 relaxes the applicant columns to NULLable so no fake identity data is invented. Because the Mentor/family resolver reads the latest row, the revocation takes effect at the next admission while the role grant stays for the audit trail's reconstruction. The Users console detail dialog carries the revoke form.

## S04.3 implementation and rationale

Inspected evidence: the shared Settings screen let a kid-role account request an email change (GoTrue would happily attach a real, recoverable email to an account created with a synthetic `.invalid` address for data minimization) and edit the profile username even though the sign-in identifier derives from it (`kidEmail`), which would strand the account behind its old handle.

**API boundary.** `PATCH /api/v1/profile` refuses a `username` change for the kid role (`KID_USERNAME_LOCKED`); display name and locale remain editable. `POST /auth/change-email` refuses for the kid role (`KID_EMAIL_FORBIDDEN`) — removed entirely, not merely hidden. Self-registered teens and adults (universal role) keep both capabilities; the divergence between the editable profile username and the fixed sign-in identifier remains as before, surfaced by the existing username hint.

**Settings surface.** The Settings page branches by role: kid accounts see the locked username with a hint that the sign-in username is fixed, and the email row becomes a data-minimization note ("a child account has no email — your Tutor manages access") with no change control. The server errors map to the same truth when a stale client attempts the forbidden calls.

## Verification log (S04.2/S04.3)

Executed 24 September 2026 against the current working tree. Commands below are relative to the named directory. These are local results, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Adversarial Core tests | `backend/`: `npm test -- --run src/__tests__/verificationAdmin.test.ts src/__tests__/admin.test.ts src/__tests__/auth.test.ts` | 8 new verification-admin tests (revoke gate/reason/audit-first, grant justification, users projection, kid username/email refusal, kid display-name edit still allowed); 136 tests passed across the three suites |
| Core regression | `backend/`: `npm test` | 69 files, 1,459 tests passed + 1 documented skip |
| Core static checks | `backend/`: `npm run type-check`, `npm run lint` | Passed, including test type checking |
| Database gate | `database/`: `npm test` (via Git Bash PATH) | Migration 0111 passes the structure/phase/additive gates and the real-tree gate; 21 Node checks and 12 Railway transport scenarios green |
| Frontend behavior | `frontend/`: profile/auth/admin test directories | 120 tests passed; the SettingsAge suite gained the roles fixture for the new role branch |
| Frontend regression | `frontend/`: `npm test` | 211 files, 2,189 tests passed |
| Frontend static checks | `frontend/`: `npm run type-check`, `npm run lint` | Passed |
| Binding authority and repository tools | Root: `npm run spec:check`, `secrets:check` (Git Bash), i18n gate (Git Bash) | Passed |

Execution notes: the admin.users stub and the change-email stubs gained the new upstream reads their routes now make (parent_verifications projection, kid-role gate), and the SettingsAge fixture gained the `roles` field the branched page reads. The `tools:test` gate retains the two documented WSL-dependent operator-test failures on this host.

Remaining acceptance boundaries for A.5/A.6: real PostgreSQL evidence for the 0111 relaxed columns and the revoked-row write, real GoTrue behavior proof for the refused email change, visual/device matrices for the branched Settings and the two new staff surfaces, and human Product/Safety review. Neither requirement is accepted.

## S04.1 implementation and rationale

Inspected evidence: the FAQ promised (a) a second verified Tutor can link to the same child, (b) a child account is suspended when the parent's account is cancelled and deleted after 90 days of no reactivation, and (c) an in-product report tool. None of the three existed at the start of the checkpoint; the report tool arrived first, in S02.3ab. The owner decision table (OD log §8) mandates building the flow or removing the claim before the first public release, with the second-guardian flow first — the schema already supports multiple verified guardian links, so that promise is a missing product flow, not a structural limitation.

**Second verified guardian.** Migration 0110 adds a service-only `guardian_invites` table (token, kid, creator, 7-day expiry, accepted marker) with `created_by ON DELETE SET NULL` so an invite survives the inviting parent's account deletion and a second parent can still accept it to reactivate the kid. Core exposes three routes inside the verified-parent boundary (the family router already refuses every caller without current ID-verified adult evidence): POST `/family/kids/:kidId/guardian-invite` (guardKid-scoped mint, audited), GET `/family/guardian-invite/:token` (joining parent's preview — kid display fields only, never contact data or other guardians; defensive post-parse re-check of accepted/expiry so a proxy artifact cannot revive a consumed invite), and POST `/family/guardian-invite/:token/accept`, a one-shot exchange into migration 0110's `accept_guardian_invite` service transaction (validate → link → mark accepted → audit), where every invalid shape is one indistinguishable 404. The frontend adds the rebuild GuardianInvite surface: a per-kid "Invite a second Tutor" panel that mints and copies the single-use link (`/family?join=TOKEN`), and a join card on the Family page that previews the kid's name and accepts; a malformed token shape is refused client-side without a call.

**Account-cancellation cascade.** The same migration adds `profiles.suspended_at` and two triggers: deleting a verified `guardian_links` row that empties the kid's verified set writes the marker (idempotent), and inserting/verifying a link clears it — the FAQ's "unusable until an active Tutor account supervises it again" is the trigger, not a promise. Enforcement is session revocation at admission: `/auth/me` runs `enforceKidSuspensionAtAdmission` for kid-role sessions, which reads the marker (service role — the browser's own profile read is not the enforcing boundary), revokes every GoTrue session, and refuses admission. The 90-day deletion is lazy rather than cron-based (no scheduler exists in this stack): at the same admission point the purge hard-deletes only when the window has passed AND the verified-link read returned a validated empty set — a failed, ambiguous or unexpected read never deletes (§1.14). The frontend renders a dedicated public `/account-suspended` screen (rebuild component, three locales, copy-budget-checked) and the app shell redirects to it; the AuthContext captures `ACCOUNT_SUSPENDED`/`ACCOUNT_DELETED` from `/auth/me`, clears the local session and sets the flags that pick the wording.

**FAQ copy.** All three answers now state what ships: the second-Tutor answer names the single-use 7-day invite; the suspension answer (unchanged text) is now backed by the trigger + revocation + 90-day purge; the support answer names the in-product profile report beside Block. The FAQ never describes a capability that does not exist.

## Verification log

Executed 24 September 2026 against the current working tree. Commands below are relative to the named directory. These are local results, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Core implementation | [Lifecycle service](../../../backend/src/services/guardianLifecycle.ts), [family routes](../../../backend/src/routes/family.ts), [auth admission](../../../backend/src/routes/auth.ts), [GoTrue session revocation](../../../backend/src/services/gotrue.ts) | One policy: verified-parent gate for invites, admission-boundary suspension with session revocation and lazy purge |
| Adversarial Core tests | `backend/`: `npm test -- --run src/__tests__/guardianInvite.test.ts src/__tests__/guardianLifecycle.test.ts src/__tests__/auth.test.ts src/__tests__/family.test.ts src/__tests__/familyKids.test.ts` | 162 tests passed: foreign-kid mint refusal, one-shot exchange, indistinguishable 404s, window boundaries, ambiguous-read refusal to delete, revocation-failure still refuses admission |
| Core regression | `backend/`: `npm test` | 68 files, 1,451 tests passed + 1 documented skip |
| Core static checks | `backend/`: `npm run type-check`, `npm run lint` | Passed, including test type checking |
| Database gate | `database/`: `npm test` (via Git Bash PATH) | Migration 0110 passes the structure/phase/additive gates and the real-tree gate; 21 Node checks and 12 Railway transport scenarios green |
| Frontend behavior | `frontend/`: focused suites for GuardianInvitePanel, FamilyPage, SocialNoticesPanel, BadgeSharesPanel, ProfileReportControl, previewCopy | 41 focused tests passed; mint/accept/expired/malformed-token journeys, copy budget for all three locales |
| Frontend regression | `frontend/`: `npm test` | 211 files, 2,189 tests passed |
| Frontend static checks | `frontend/`: `npm run type-check`, `npm run lint` | Passed |
| Binding authority and repository tools | Root: `npm run spec:check`, `npm run secrets:check`, i18n gate (Git Bash) | Passed; SPEC checksums, 113 headings, three-locale i18n parity, no credential patterns |

Execution notes: the first frontend run exposed two real defects, both corrected with tests added: the suspended-screen and invite copy exceeded the youngest Copy Budget (trimmed to the 12-word body limit and re-verified in all three locales), and a test-mock instability traced to an unstable `getToken` identity — the real AuthContext is useCallback-stable, so the product code was correct and the test harness was fixed. The `tools:test` gate retains the two documented WSL-dependent operator-test failures on this host.

Remaining acceptance boundaries: no real PostgreSQL transaction evidence for the 0110 triggers/invite exchange, no real GoTrue session-revocation proof, no device/assistive-technology or visual matrix for the three new surfaces, and no human Product/Safety review. A.1 remains in progress; nothing here accepts it.
