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
| S04.2 | A.5 verification status split | pending | pending | Planned |
| S04.3 | A.6 role-branched Settings | pending | pending | Planned |

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
