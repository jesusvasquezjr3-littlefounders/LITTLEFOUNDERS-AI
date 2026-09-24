# S01: identity and age safeguards

Status: in progress. Started 21 September 2026. Owner: Engineering for implementation; Product and Safety/Trust for the decisions/reviews named by the SPEC. No release approval is recorded.

## Binding acceptance sources

- Owner decisions OD-3, OD-8 and OD-9, including the supported guest/teen populations and data-preservation rules.
- Product A.2–A.4, C.1–C.4, E.4 and H.1.
- Appendix M: enforced safeguards, adversarial Stage 2 and acquisition phasing.
- Appendix F: safety/governance and Mentor Definition of Done.
- Frontend Bible 02, 06 and 08 for rebuilt identity and Mentor controls.

Risk classification: **age/identity boundary and safety-critical**, not presentation-only. Existing production UI may receive OD-8 hotfixes; it is not reused in the rebuilt frontend.

## Point-by-point checkpoints

| ID | Scope | Product acceptance | Frontend acceptance | State |
|---|---|---|---|---|
| S01.1 | C.2/C.3 conservative interim Mentor policy | Guests, teens, unknown ages and staff grants receive minor safeguards; only current ID-verified adulthood exempts; read failures restrict; same decision at offers/start/internal context | Existing client respects blocked microphone reasons, cannot request voice through a blocked offer, and preserves typed conversation | Locally verified checkpoint; requirement acceptance remains open |
| S01.2 | A.2/A.3 durable provenance and OAuth gate | Under-13 origin boolean survives upgrade; Google cannot bypass age capture; marker blocks microphone even if another consent signal exists | All entry/return/reload paths reach the mandatory age step or protected guest journey | In progress: storage, consumers, mandatory screen, upgrade-chain, history-traversal and real-HTTP evidence recorded; production metrics and human review pending |
| S01.3 | A.4/E.4 universal age signal | Age signal persisted for every path; protected DOB changes cannot be made through Core or direct browser DB access; unknown legacy users stay protected | Honest age capture, validation, recovery and immutable-date/help states | In progress: universal admission, profile/DB date locking and guardian verification guards implemented; correction/full-stack acceptance pending |
| S01.4 | C.1/C.4 age-aware pedagogy and memory | Unknown age is explicit; guardian relationship governs review; independent-teen memory policy decided before implementation | Correct age register and visible review/deletion controls matching the chosen policy | In progress: known age and explicit calibration integrated; full acceptance and C.4 decision pending |
| S01.5 | H.1/A.2 analytics | Under-13 guests suppressed; teen disclosure/opt-out actually prevents nonessential collection at source | Consent controls are accurate and usable across all supported locales | In progress: disclosure/toggle, Core enforcement and 12 browser journeys verified; cross-session/provider/full-stack acceptance pending |
| S01.6 | Migration and end-to-end acceptance | Backfill flags suspect legacy records without inventing age; data and guardian links preserved; adversarial population journeys pass | New identity flows satisfy the full Bible audit matrix | Planned |

## S01.1 implementation and rationale

Inspected evidence: Core previously derived `isMinor` from the `kid` role in the offer, session-start and Oracle session-context handlers. Profile birth dates are editable, and email signup currently discards the declared date. A profile age or staff-assigned `parent` role is therefore insufficient evidence to relax safeguards.

The interim resolver uses the existing service-owned `parent_verifications` table (migration 0004). It requires an active parent role, no kid role, and the latest record to be `verified`, use `local-ocr`, and contain a valid date proving age 18 or older. It selects only status, method and date, derives a boolean within Core, and never adds the date or verification record to Oracle's payload. A revoked latest record does not fall back to an older approval. No schema, generated types, prompt-context fields or paid-provider calls are added.

Unknown or unverified accounts now use the minors' existing voice policy and consent checks. This intentionally includes adults who have only self-declared their age: they can use the text Mentor when required moderation is available, but receive no unverified microphone exemption. An unavailable verification store also restricts access; it is not interpreted as proof of adulthood.

The resolver runs for offers, session admission and each fresh Oracle context fetch, including resume. It does not invent a teen's age band, implement the durable guest marker, change memory policy, or certify immediate revocation of an adult exemption inside an already connected session. Those boundaries must remain visible in the sprint's remaining acceptance work.

## Verification log

Executed 21 September 2026 against the current working tree. Commands below are relative to the named directory. These are local results, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Core implementation | [Resolver](../../../backend/src/services/mentorSafety.ts), [API enforcement](../../../backend/src/routes/tutor.ts) | One policy used by offers, start and fresh internal context |
| Adversarial population matrix | `backend/`: `npm test -- --run src/__tests__/mentorSafety.test.ts src/__tests__/tutor.test.ts` | 194 tests passed, including seven unverified populations, explicit voice requests, exact age boundary, malformed evidence, failed reads and revocation |
| Core regressions | `backend/`: `npm test` | 51 files, 1,030 tests passed; lesson-contract parity passed (8 files and 8 symbols) |
| Core static/build checks | `backend/`: `npm run type-check`, `npm run lint`, `npm run build` | All passed, including test type checking |
| Privacy and safety canaries | `oracle/`: `npm run verify:tutor` | Passed: context field rejection, injection corpus, fence and output moderation |
| Live Mentor boundary | `oracle/`: `npm test -- src/__tests__/admission-control.test.ts src/__tests__/live-session.test.ts src/__tests__/orchestrator.test.ts src/__tests__/privacy-contract-docs.test.ts` | 4 files, 223 tests passed; real local WebSockets with mocked external providers, including fail-closed moderation and refreshed minor posture on resume |
| Frontend behavior | `frontend/`: `npm test -- src/tutor/__tests__/mic.test.ts src/tutor/__tests__/micRevoked.test.tsx src/tutor/__tests__/offerChips.test.tsx src/tutor/__tests__/reloadResume.test.tsx src/tutor/stage/__tests__/stageMic.test.tsx src/tutor/stage/__tests__/micForPhase.test.ts` | 6 files, 73 tests passed; blocked offers request no voice, revocation and stage microphone states remain consistent |
| Binding authority and repository tools | Root: `npm run spec:check`, `npm run secrets:check`, `npm run tools:test` | Passed; SPEC checksums, 113 headings, agent parity, Bible tokens, new-UI boundary and 54 tool tests |

Frontend scope: this checkpoint changes no UI, copy, layout or wire shape. Existing component behavior is checked against the server's unchanged blocked-reason contract. No new browser screenshots or full Bible visual acceptance are claimed for S01.1; rebuilt identity screens and their mobile/desktop/locale/theme/accessibility matrix remain S01.2–S01.6 work. The prior S00 preview audit is not evidence that these product flows are migrated.

Execution notes: the initial parameterized resolver test fixtures incorrectly spread array values into test arguments; wrapping each case in an object corrected the harness before the successful runs above. The first secrets scan selected Windows' WSL Bash and failed to start; rerunning with Git Bash first in PATH passed. Frontend tests emitted existing Three.js, jsdom canvas and router warnings; they do not substitute for a real rendered UI audit. Oracle failure-path logs are from deliberately mocked outages; no paid-provider verification was performed.

Remaining acceptance boundaries: no real database/RLS/persistence test, backfill, production moderation-provider check, full repository service aggregate, or human Safety/Trust/Legal acceptance is recorded here. This checkpoint adds no migration. Live adult-exemption revocation while the socket remains connected, durable under-13 provenance, universal age capture, memory policy and analytics remain open. No commit, push or deployment was performed.

## Next checkpoint: S01.2

Trace guest creation, guest upgrade, email signup and OAuth return before changing persistence. Define the durable under-13-origin marker and its write protections, then test that upgrade/reload/direct requests cannot erase it or bypass the microphone prohibition. Database-dependent work must first provision a disposable test stack without resetting existing local data. Update this record and the A.2/A.3 ledger entries together with implementation and evidence.

### S01.2 boundary audit and implementation sequence

The owner activated the autonomous migration goal on 21 September 2026. The SPEC remains binding; the goal does not waive acceptance, data-preservation or pre-release gates.

Confirmed in the current code:

- Core `/auth/guest` creates an anonymous identity without an age-refusal marker. `/auth/upgrade` attaches credentials to the same user ID, so protection must live outside editable auth metadata and survive the identity transition.
- `/auth/me` currently enables analytics for every non-kid account with roles. The OAuth callback can immediately send a conversion event. Both the server ingest boundary and client permission resolution must suppress events before age is known or when the origin marker requires it.
- `RequireAuth` only requires a session. The OAuth callback proceeds to the app without mandatory age screening. UI redirection alone cannot satisfy Appendix M's direct-request and deep-link bypass tests.
- Existing onboarding optionally writes `profiles.birth_date`. Its completion flag is display-only; it cannot be used as the authoritative age clearance.

Implementation order within this checkpoint:

1. Add service-controlled, minimal provenance storage and real SQL tests for browser-role denial, idempotence, concurrent writes and persistence through an identity upgrade. Never store the refused birth date in the origin marker.
2. Wire creation/reclassification and enforce the marker at microphone, fail-closed Mentor moderation and analytics ingestion boundaries. Failed reads must restrict access.
3. Add authoritative age-screen status and mandatory entry enforcement on Core and frontend, including refresh, OAuth return and deep links. Self-edited profile or auth metadata must not clear safeguards.
4. Verify all entry populations and supported frontend states, then update evidence. Universal capture and protected DOB semantics overlap S01.3 and must be tracked explicitly rather than marked complete by association.

Environment observation: Node 24.19.0, npm 11.17.0, 16 logical CPUs, approximately 31.7 GiB RAM and 15.8 GiB free. Service dependencies and local environment files are present. Docker Desktop's Linux engine is unavailable; a background startup was attempted, but the engine had not become reachable on recheck. The historical `LittleFounders-QA-20260916` WSL distribution is absent on this machine. Native PostgreSQL audit binaries and data exist under `.codex/audit-db`; their availability is not a claim of a running or fully verified Supabase stack. The Supabase CLI is not on PATH. No reset or migration was attempted against an existing database during this audit.

### S01.2a storage implementation evidence (partial checkpoint)

Migration `0085_under13_origin.sql` adds a private `account_safety_origins` table and service-only `mark_under13_origin` RPC. The marker contains a user ID, a boolean and its creation timestamp, never the refused birth date. Anonymous and authenticated browser roles have no table or RPC privileges. Service access is explicitly reset before granting only SELECT/INSERT, preventing broad default privileges from retaining UPDATE/DELETE/TRUNCATE. Concurrent marks are idempotent. Account deletion cascades the marker; identity upgrades do not.

Core's `ageOrigin.ts` validates the response shape and distinguishes absent provenance (`false`) from unavailable evidence (`null`). A write requires the RPC's literal `true` acknowledgement. This helper is not yet called by product routes: creation, microphone, moderation, analytics and frontend wiring remain in progress, so the storage change alone closes no requirement.

Verification on 21 September 2026:

- Started the existing audit-owned native PostgreSQL cluster on loopback port 15483 without resetting it. The test runner verifies its resolved data-directory identity and creates a fresh synthetic database per run.
- `python database/scripts/verify-origin-postgres.py` passed after the final privilege revision: eight concurrent marks produce one record; ten browser read/write/RPC attempts are denied; identity upgrade and editable metadata preserve the marker; migration replay preserves it; account deletion removes it; service UPDATE/DELETE/TRUNCATE privileges are absent. Artifact: `audit-results/s01-origin-postgres.json`. This uses minimal auth fixtures, not GoTrue.
- `backend/`: the nine `ageOrigin.test.ts` tests, type checking and lint passed. Lesson-contract parity also passed.
- Migration sequence/RLS and phase checks passed for all 85 files; all 20 migration phase/auto-apply tests passed. The final mocked Railway migration integration test was still running at this record update (tool session 83157); do not report the entire database suite as passed until its terminal result is inspected.
- `npm run spec:check` and `git diff --check` passed.

Outstanding: wire all consumers and frontend flows, test policy release only through verified guardian/adult evidence, run full Supabase resets twice in an isolated stack, regenerate shared types from the full migrated schema, and complete end-to-end acceptance. Generated types have not been hand-edited. No deployment or production database action occurred.

### S01.2b Mentor consumer integration (in progress)

Core now resolves origin restrictions for offers, session admission, internal session context and the live consent-poll endpoint. An unresolved origin blocks microphone use even when a consent row exists and the runtime allows minors' voice. The effective decision survives loss of the anonymous JWT flag. An origin lookup failure restricts access. A verified guardian link releases the origin-specific prohibition while retaining minor moderation and ordinary voice-consent/policy checks; trusted adult evidence provides the existing explicit adulthood exception. No origin information or DOB is added to the model context.

Local verification on 21 September 2026: 182 tutor API tests passed, including two new upgraded/anonymous population scenarios; all 21 policy tests passed, including malformed/unavailable origin and guardian data and scoped guardian queries. Type checking, lint and build passed before the final policy-test additions; build also passed after them. The frontend's microphone, revocation and offer suites passed (44 tests); Oracle's privacy/safety canary gate passed. The first expanded API run exhausted the shared loopback client's 200-request budget across unrelated tests; test setup now resets only that global rate-limit key between scenarios. Production limits are unchanged. `spec:check` and whitespace validation passed.

This is not yet a complete protected guest journey: the marker writer must still be wired into guest creation and Google reclassification, analytics must consume it, and mandatory age-entry guards remain outstanding. Migration 0085 must exist before deploying this Core change; otherwise missing provenance data deliberately blocks unverified microphones. Full backend regression and the already-running database integration gate require their terminal results to be recorded. No release is claimed.

Terminal results subsequently inspected: the complete backend suite passed **52 files / 1,048 tests**. The database suite also finished successfully, including all 12 mocked Railway transport scenarios and static probe-map checks. Session 83157 is complete; it must not be restarted merely because earlier polls produced no output. These successes do not replace the still-pending full Supabase migration/reset/type-generation gates.

### S01.2c age-refusal entry and analytics consumers (in progress)

The existing signup rejection now starts a guest with `{ under13Origin: true }` directly instead of navigating to the general marketing entry. Core accepts only that optional literal boolean, rejects a refused DOB or `false` override, and withholds the session response until the service-owned marker write is acknowledged. The rejected form clears its name, email, password and date state and disables the first-party insights buffer. A failed protected-guest start remains on the refusal screen with an error and retry control. This is an OD-8 hotfix on the legacy surface, not a claim that the new identity frontend is complete.

`/auth/me`, authenticated event ingestion and signup attribution now check provenance. Present or unreadable provenance suppresses analytics, including conversion attribution. No equivalent guest consent flow has been approved or implemented, so suppression is conservative even after a guardian is subsequently linked; do not silently treat historical guardian consent as authorization for a new data practice.

Verification on 21 September 2026: the complete backend run after entry/analytics wiring passed **52 files / 1,051 tests** (`audit-results/s01-backend-latest.log`). Two additional adversarial analytics cases were then added; the affected suite passed **31 tests**, proving zero event writes and no conversion attribution for flagged/unavailable provenance. The frontend age-refusal interaction and AuthContext suites passed **8 tests**, including failure/retry and the exact boolean request. Backend type checking and lint, root i18n parity/hardcoded-copy checks, SPEC integrity and whitespace checks passed. Frontend type/lint checks were started and require terminal confirmation. Real-browser mobile/desktop verification and the frontend build remain outstanding for this hotfix.

Important remaining boundary: the origin flag is currently supplied by the protected entry, not yet backed by mandatory server age clearance for every path. A client that skips that entry, reloads or uses Google must be caught by the forthcoming universal entry gate; the current changes alone do not prove zero bypasses. First-time Google screening, unknown-age analytics policy, anonymous/pre-account beacon behavior, upgrade eligibility, full Supabase tests and generated types remain open. Do not mark A.2/A.3 accepted.

Frontend static-check terminal confirmation: both `npm run type-check` and `npm run lint` exited successfully (session 28014). Browser/build acceptance remains pending as stated above.

### S01.2d rendered refusal verification and age-declaration storage

`frontend/scripts/verify-age-refusal.mjs` passed against the running local frontend in Chrome at 375px and 1280px, using real pointer and keyboard input and synthetic intercepted Core replies. At both widths a failed provenance write remains on the refusal screen with a usable retry; the successful retry reaches onboarding. All four guest requests contained only `{ under13Origin: true }`. Neither viewport overflowed horizontally and no runtime errors were recorded. Both screenshots were inspected. Evidence: `audit-results/age-refusal/report.json`, `375-retry.png`, `1280-retry.png`. This is legacy hotfix behavior, not full Bible acceptance or database E2E. The frontend production build also passed (`audit-results/s01-frontend-build.log`).

Migration `0086_age_declarations.sql` adds private, service-written minimal age-band declarations. First declaration is immutable through the ordinary service/browser interfaces; it is self-declaration, never verified-adult evidence. An under-13 declaration marks provenance in the same transaction, including a later disclosure after a different first declaration. This groundwork supports the mandatory server gate without storing the refused DOB. It currently has no application consumer; API and frontend age capture are the next implementation step.

The native PostgreSQL runner now verifies both migrations: eight concurrent attempts cannot elevate an under-13 declaration; a later under-13 disclosure sets provenance; browser roles cannot read or invoke the age RPC; direct service INSERT/UPDATE/DELETE/TRUNCATE privileges are absent; replay preserves declarations. Injecting a failed declaration INSERT rolls back its origin write. The refreshed `audit-results/s01-origin-postgres.json` records these results. Migration sequence/RLS/phase checks passed for all 86 files. Full Supabase resets, generated types, policy correction flows and all-entry end-to-end acceptance remain open. No production action occurred.

### S01.2e authoritative age-screen API

Core now exposes authenticated GET/POST `/auth/age-screen`. GET reads service-owned declarations and provenance, never profile DOB or user-editable metadata. Missing evidence returns `required: true`; unreadable or malformed data returns an error, not clearance. An already-marked refusal origin returns a protected under-13 state without collecting the child's date again. Origin takes precedence over a contradictory older declaration.

POST accepts only a birth date and derives the authenticated user ID server-side. It validates real calendar dates, exact UTC birthdays, future dates and the existing 120-year plausibility ceiling. Only the age band goes to the storage RPC. The response requires both an affirmative, valid stored-band result and a fresh read confirming that screening is no longer required. This is self-declared age, not the verified-adult exception used by Mentor safety.

The nine `ageScreen.test.ts` cases passed, covering 13th/18th birthday boundaries, invalid dates, missing authentication, forged subject fields, missing/malformed evidence, contradictory declaration/origin and the minimal storage payload. Backend type checking and lint passed. The API is ready for frontend integration, but Learn/placement/Mentor admission and route guards have not yet been connected to it: mandatory screening enforcement is still outstanding. No requirement closes on the presence of this API alone.

### S01.2f mandatory frontend and Core entry enforcement

`RequireAuth` now requires server age-screen confirmation before mounting protected product content, except credential recovery at `/reset-password`. The new `RequireAgeScreen` presents loading, retry, date entry, saving and sign-out states. It is keyed by account and route, discards stale read results and prevents a previous identity's submission result from granting clearance. Its view lives in `src/rebuild/identity`, uses only the new design controls/tokens and localized copy, and imports no legacy UI. Copy-role budgets pass in EN, es-MX and pt-BR.

Core's `requireAgeScreen` now guards Learn, placement and the external Mentor router after authentication. Missing evidence returns `AGE_SCREEN_REQUIRED`; unavailable evidence returns a 502. The internal session-context endpoint independently checks screening before letting Oracle start/resume a session. `/auth/me` suppresses analytics while screening is unknown, unavailable or origin-protected. Internal service-key routes remain separate from the browser guard.

Verified locally on 21 September 2026: **53 backend files / 1,065 tests** passed (`audit-results/s01-age-gate-regression.log`), including direct API bypass cases on all three entry surfaces. **174 frontend files / 1,929 tests** passed (`audit-results/s01-frontend-gate-regression.log`), including no protected-content render while pending, server-confirmed submission and retry/sign-out on malformed results. Frontend types/lint and localized copy-budget checks passed. SPEC and i18n checks passed after moving the synthetic guard test into the recognized `__tests__` directory. Backend type/lint passed and build was running in session 59354 at this update.

Regression corrections: existing learning fixtures now explicitly contain age declarations; the PostgREST stand-in now projects simple scalar `select` columns as the real service does instead of returning extra columns rejected by strict safety parsers. The placement scenario that resets its fixture mid-test also carries its declaration. A new test initially reused a consumed Response object across two reads; it now returns a fresh response per request. No production safety gate was disabled for testing.

Remaining before this checkpoint can be accepted: real-browser verification of the new mandatory screen and its full Bible matrix, refreshed frontend build, explicit email-signup persistence to avoid asking twice, unknown-age suppression at analytics ingestion/attribution (not only `/auth/me`), upgrade eligibility, all entry/refresh/OAuth journeys, whole-stack migration/type gates and human reviews. Existing browser drivers need the new age-screen reply in their synthetic fixtures before replay. Earlier screen-only screenshots do not certify this newly added screen.

Backend build terminal confirmation: session 59354 exited successfully; type checking, lint and build all passed. No test or build process remains pending from S01.2f.

### S01.2g signup persistence, analytics admission and rendered age screen

Email signup now uses the shared calendar/birthday validator and records only the derived age band after identity creation. The route withholds its session response if the service-owned declaration cannot be confirmed. This avoids asking a newly registered email user for the same date twice. It does not make identity creation and declaration storage one transaction: an upstream-created identity can remain after a downstream storage failure, and a later login must still pass mandatory screening. No DOB is sent to the age-band RPC.

Authenticated event ingestion and signup attribution now reject unknown or unavailable age-screen evidence as well as protected origins, matching `/auth/me`. A direct analytics request cannot bypass the frontend's disabled buffer. Existing consent checks still apply after this admission check. Anonymous/pre-account analytics and the complete teen consent policy remain separate open work.

`verify-age-screen.mjs` exercised real Chrome pointer/keyboard interactions at 375px and 1280px in all three locales and both themes: **12 combinations**, each with a failed declaration write, a visible retry and successful server confirmation before leaving the screen. All **24 submissions** contained exactly the synthetic birth date; no horizontal overflow, copy-element clipping or browser runtime errors were observed. The Spanish mobile/light and Portuguese desktop/dark screenshots were visually inspected. Evidence: `audit-results/age-screen/report.json` and its screenshots. The test uses intercepted synthetic Core replies; it is not full GoTrue/database E2E or the complete Bible acceptance matrix.

The protected refusal browser driver now supplies the mandatory age-screen response and verifies the rendered onboarding welcome, not just its URL. Both viewport scenarios passed. An intermediate test assertion incorrectly expected an input on the welcome step; it was corrected to the actual welcome heading. The product had reached the expected welcome screen. The entry guard also now offers retry/sign-out if no session credential is available, instead of remaining indefinitely in its loading state.

Verification on 21 September 2026:

- Full backend regression: **53 files / 1,067 tests passed**, including the email-signup storage-failure case and direct unknown-age analytics denial. Artifact: `audit-results/s01-signup-age-regression.log`. Backend type/lint passed after signup integration.
- Frontend production build passed with the existing large-bundle warning (`audit-results/s01-age-screen-build.log`). A subsequent one-line no-credential recovery fix passed the affected guard/refusal suites: **2 files / 6 tests**. The prior full frontend result remains 174 files / 1,929 tests; do not present it as a rerun after this added case.
- All browser processes launched by these drivers exited. No commit, deployment or production action occurred.

Still open: OAuth/refresh/back/account-switch acceptance, guest upgrade eligibility review, duplication with the legacy optional onboarding DOB step, full Bible accessibility/resizing matrix, full Supabase migration/reset/type-generation gates, and required human reviews. The current evidence does not close A.2, A.3 or A.4 or complete Sprint S01.

Final static-check confirmation for this checkpoint: frontend type checking and lint passed after the no-credential recovery fix. SPEC integrity/token parity and `git diff --check` passed. No verification process remains pending from S01.2g.

### S01.2h stale submissions, reload and synthetic OAuth journeys

An adversarial account-switch test exposed a gap in the submission guard: comparing only account ID and pathname could accept an old response after switching away and back to the same account/path. Each screening lifecycle now has a generation, invalidated on cleanup; all asynchronous submission continuations require both the current identity and generation. An obsolete result cannot refresh the profile or grant clearance, including after returning to the original identity.

The **7 guard tests passed**, covering pending reads, account changes, the switch-away-and-back submission race, remount revalidation, missing credentials, malformed replies and confirmed submissions. Frontend type checking and lint passed after the change.

The refreshed Chrome matrix passed **12 locale/theme/viewport combinations**, now reloading both before and after confirmation. Every reload issued a fresh age-screen read; confirmed stored clearance did not ask for the date again. All 24 date submissions retained the minimal payload, and runtime errors/overflow/clipping checks remained clear. Evidence: `audit-results/age-screen/report.json`. An intermediate driver run examined the previous document too early during reload; synchronizing on a fresh server read fixed the harness without changing product behavior.

`node scripts/verify-age-screen.mjs --journeys-only` separately passed the actual local OAuth callback route with synthetic tokens and intercepted Core responses. The callback removed the token fragment, navigated to Learn and displayed mandatory age capture. Subsequent direct navigation to Mentor and Learn revalidated screening. **Zero Learn/placement/Mentor content requests** occurred before clearance. Evidence: `audit-results/age-screen-journeys/report.json`. This proves frontend routing under synthetic service responses, not live Google/GoTrue authentication or full-stack persistence.

Remaining: real provider/full-stack journeys, browser history navigation, upgrade policy, legacy onboarding DOB duplication, complete Bible accessibility acceptance and all previously recorded migration/release gates. No requirement is accepted by this checkpoint alone. No commit, deployment or production action occurred.

### S01.2i guest-upgrade safeguard persistence (A.2(c) adversarial chain)

The A.2 Definition of Done requires the origin marker and its three downstream safeguards to survive the guest-to-account upgrade on the same `auth.users` id. The microphone half already covered that transition; this checkpoint closes the identity, age-screen and analytics halves at the Core boundary with one cohesive adversarial suite, `backend/src/__tests__/ageUpgradeChain.test.ts`:

- `/auth/me` keeps optional analytics off for the flagged identity both before and after it becomes permanent; `isGuest` flips but the suppression does not.
- A direct authenticated event batch is acknowledged with `accepted: 0` and stores nothing; signup attribution refuses the flagged upgraded identity (no `anon_visitors` write).
- The upgrade route completes in place with the same user id, and its fire-and-forget attribution call never reaches storage for a flagged guest.
- The upgraded identity resolves `{ required: false, ageBand: 'under_13', protectedOrigin: true }` without a second date capture; an adult self-declaration cannot elevate it (the stored immutable first declaration wins inside the RPC, and the origin marker keeps precedence in the read).
- An unavailable origin read fails closed for the upgraded identity: analytics stay off, events drop, and the age screen returns 502 rather than clearance.

Verification on 23 September 2026: **5 focused backend tests passed**; the full Core regression passed **63 files / 1,327 tests + 1 documented skip** (`audit-results/s01x-backend-full.log`).

Frontend half: new `frontend/scripts/verify-age-upgrade.mjs` drives the actual app in Chrome from the real refusal screen through "Keep going without an account", onboarding, the account-offer step and `/upgrade-account`. All **4 journeys passed** (light/dark × 375/1280 px): the first upgrade attempt fails with a visible error and retained form; the retry lands on `/learn`; the age screen never asks the flagged account for a second date at any point; **zero optional analytics events are transmitted** across the whole journey (refusal, guest, upgrade and permanent states); direct `/tutor` entry resolves the protected state into the Mentor's calibration question rather than re-collecting a birth date; no horizontal overflow. Evidence: `audit-results/age-upgrade/report.json` and eight captures. The captures were produced by this checkpoint's driver; human visual inspection of them remains open.

### S01.2j browser history navigation across the mandatory gate

`frontend/scripts/verify-age-screen.mjs --history-only` now exercises real Back/Forward traversal (same-document SPA entries, `history.back()`/`history.forward()`) in three journeys:

1. **Before clearance:** form at `/learn` → Back to marketing (gate surface gone, zero product requests) → Forward revalidates with a fresh age-screen read and shows the form again.
2. **After stored clearance (permanent identity):** cleared `/learn` → `/tutor` (Mentor calibration, no date form) → Back to `/learn` revalidates with a fresh read → Forward to `/tutor` revalidates again; the date is never re-asked (`attempts` stays at the two submit/retry calls).
3. **OAuth callback:** a synthetic callback with tokens lands on the mandatory form with the fragment scrubbed; Back cannot replay the callback (its entry was replaced), mounts no protected content, and Forward revalidates into the form. Zero product requests before screening in every journey.

The driver's earlier bfcache investigation is recorded: `Page.navigate` creates full-document history entries that Chrome restores frozen from the back/forward cache, so the journeys use same-document pushState navigation — the actual SPA behavior. All three journeys passed with revalidation reads observed at every hop. Evidence: `audit-results/age-screen-history/report.json`. The other three modes of the same driver (12-config matrix, OAuth deep-link journeys, Mentor calibration matrix) were rerun after the shared-handler edits and all passed.

### S01.2k isolated full-stack database gate, regenerated types and real HTTP enforcement

The long-blocked destructive double-reset gate now has a safe local execution path: `database/scripts/disposable-stack.sh` provisions an **isolated** Supabase stack from a copy of the pinned docker directory — distinct compose project (`lf-reset`), remapped host ports (`18000/18443/55432/56543/12500`), a fresh empty PGDATA (the dev stack's bind-mounted `volumes/db/data` is replaced, never copied for reuse), and container names derived from the project (the upstream global `container_name:` pins are stripped from the copy). The dev stack and its 16 accounts / 8 lessons were never touched; both stacks ran side by side.

Verification on 23 September 2026:

- **Double from-zero reset:** `disposable-stack.sh reset` twice — each reset nukes volumes and bind-mounted PGDATA, boots the full stack healthy, and applies **all 107 migrations** with the checksum ledger. Both runs green: `audit-results/s01x-disposable-reset-1.log`, `s01x-disposable-reset-2.log`.
- **Regenerated shared types:** official CLI 2.117.0 / postgres-meta 0.99.0 (via `npx supabase@2.117.0 gen types`) against the isolated pooler. The diff is a clean superset: **0 tables removed, 35 added** (the S01/S02/S05 tables and RPCs: `account_safety_origins`, `account_age_declarations`, `teen_analytics_preferences`, `mentor_age_calibrations`, `lesson_v2_*`, `social_connection_requests`, `course_assembly_incidents`, and their service RPCs). Backend type-check passed against the new types; the database suite passed (21 Node checks, 0 failures) (`audit-results/s01x-database-suite.log`). The generator emitted its known MaxListenersExceededWarning; generation exited successfully.
- **18 real HTTP checks** (`audit-results/verify-s01-age-http.mjs`, `audit-results/s01-age-http.json`): a real Core instance booted against the isolated stack (real GoTrue, PostgREST, PostgreSQL; external providers blocked) proved — flagged guest creation writes the marker before the session returns and a plain guest writes none; `/auth/me` and direct `/events` suppression with **zero stored rows** (the real `optional_event_admission` trigger); `microphoneBlockedBy: POLICY_BLOCKED` on real offers; the protected age-screen state with an inert adult self-claim and intact marker; in-place upgrade keeping the id, the marker and every safeguard; a direct browser-role read of the marker table is refused by PostgREST; and a GoTrue-created unscreened permanent account (the Google-shaped population) is 403-blocked on Learn, placement and Mentor until mandatory screening admission, after which Learn opens.

Two observations recorded honestly: (1) an origin-protected account that POSTs an adult date stores that contradictory first declaration in `account_age_declarations` while the origin marker keeps absolute precedence in every read — protection holds (proven by the HTTP checks), and whether Core should refuse to store a contradictory declaration at all remains a small open product decision; (2) the working tree carried a stale v2 fixture regression — `learn.test.ts`'s allocation fixture policy `{7,10}` contradicted its own two age-boundary tests (age 7 blocked). Restoring the consistent `{8,10}` policy in the base fixture and the grade-test override brought the suite back to 72/72; this is recorded as a regression correction, not a new capability.

This closes the disposable-stack reset and type-regeneration gates and supplies real-database enforcement evidence for S01.2. It does not close A.2/A.3: real Google provider journeys, production instrumentation, one release cycle of the Appendix M Part 1.1 metrics, and the required human Trust/Safety review remain. The isolated stack is left running for further checkpoints; `teardown` removes it.

Final repository gates for this checkpoint group (23 September 2026): `typecheck:all` and `lint:all` passed. In the `test:all` aggregate every service passed except oracle, whose two timing-sensitive lock/park tests failed under aggregate load; the complete oracle suite then passed in isolation (**40 files / 1,129 tests**, `audit-results/s01x-oracle-final-isolated.log`) — the same recorded aggregate-flakiness pattern as S05's gate audit. Backend passed in the aggregate itself (**63 files / 1,327 tests + 1 documented skip**, `audit-results/s01x-final-test-all.log`). `spec:check`, `secrets:check`, `tools:test`, `i18n:check` and `git diff --check` all passed (`audit-results/s01x-final-*.log`).

### S01.3a remove duplicate optional DOB collection

The boundary audit for E.4 found three remaining profile-date writers: own-profile edits, guardian family edits and optional onboarding. The mandatory service-owned age declaration is already independent of that editable profile field; this does not by itself satisfy the SPEC's explicit profile-date locking requirement.

Removed the legacy onboarding age step and its DOB submission. The flow now moves from name to discovery and account choice after `RequireAgeScreen` has already handled age admission. Core's strict onboarding payload rejects `birthDate` instead of storing another editable copy. Existing stored dates are preserved. This removes the contradictory second date question and the onboarding rewrite path; it does not yet lock own-profile/direct-database changes or implement staff-reviewed corrections. Legacy onboarding layout/narration remain transitional OD-8 integration, not accepted rebuilt UI.

Verification on 21 September 2026: **7 backend onboarding tests** and **10 frontend onboarding tests** passed, including rejection of a forged replacement date without changing the existing profile, exact minimal frontend payload, back navigation, failure recovery and account-choice navigation. Type checking and lint passed in both services. Chrome at 375px and 1280px passed refusal failure/retry, confirmed guest entry, name entry and direct progression to discovery with no second DOB field (`audit-results/age-refusal/report.json`). SPEC integrity/token parity passed. A test-file rewrite introduced Windows line endings flagged by whitespace validation; it was normalized back to LF.

Next: enforce E.4 on own-profile and direct database writes, define correction entry without falsely promising an unimplemented review workflow, and verify the related guardian path. S01.3 remains in progress; no release or requirement acceptance is claimed.

Localization and whitespace checks passed. The first localization invocation could not create Git Bash's signal pipe inside the sandbox; the authorized retry completed successfully. No check is still running from S01.3a.

### S01.3b own-profile date protection

Own-profile PATCH now accepts only display name, username and locale; the strict schema rejects any `birthDate`, including a valid-looking adult replacement. Settings displays the existing date as read-only, explains that it cannot be edited there in EN/es-MX/pt-BR, and omits it from saves. This common self-service boundary also applies to adults; identity correction is a separate workflow, not a general profile edit. Existing dates remain readable and are not rewritten or removed.

Migration `0087_profile_birth_date_guard.sql` adds an invoker-context trigger rejecting date insertion/change/removal by the `anon` and `authenticated` database roles, including direct PostgREST writes. Service-role guardian operations remain available and require their own authorization/reconfirmation review; this migration does not certify them. No new staff correction route or review promise is exposed.

Local verification: **24 profile API tests passed**, including no downstream write on a forged date change. The new Settings interaction test passed, proving read-only presentation and exact save fields. Backend type checking and frontend type/lint passed; backend lint requires terminal confirmation. The native PostgreSQL runner passed all prior origin/declaration checks plus **6 direct browser-role date denials**, allowed unrelated profile-field edits, and preserved dates on migration replay. Its profile fixture intentionally grants broad table privileges, so the denials exercise the trigger itself. Evidence: `audit-results/s01-origin-postgres.json`. This is supplemental native PostgreSQL with minimal fixtures, not full Supabase/GoTrue/RLS acceptance.

Migration sequence/RLS and phase checks passed for 87 migrations. SPEC/token integrity, localization and whitespace checks passed. Full isolated Supabase resets and regenerated types remain required; generated types were not edited. Before rollout, coordinate this frontend/API/database boundary: a stale Settings client that still submits a DOB will now receive validation failure. Browser visual acceptance of Settings, guardian reconfirmation, staff-reviewed correction and E.4 population acceptance remain open. No commit or deployment occurred.

Backend lint terminal confirmation: passed. No verification process remains running from S01.3b.

### S01.3c guardian-created age admission and creation authorization

Child creation now validates the supplied date with the shared exact-calendar validator, derives its minimal age band and persists it before granting the kid role. A failed declaration acknowledgement rolls back only the newly created identity using the existing creation rollback path and records the failed stage without retaining the date in audit details. When the parent supplies no date, screening remains required; no age is invented. Guardian update dates also use exact-calendar validation.

The creation audit also found that a parent role was incorrectly treated as proof of ID verification. Creation now checks current service-owned adult verification through the same conservative identity resolver used by Mentor, including active roles and revoked decisions. Missing/revoked evidence refuses creation before any child identity is written. This closes the creation-specific staff-grant bypass; other family read/manage routes still require the broader A.5/OD-3 trust audit. This does not certify the guardian date-correction workflow.

The **21 child-management tests passed**, including exact band payload/order, rollback on failed age persistence, invalid-calendar/future dates and missing/revoked adult verification. Backend type checking, lint, lesson-contract parity, SPEC/token checks and whitespace checks passed. Full backend regression was started separately and its terminal result must be recorded before reporting it passed. No frontend layout changed in this checkpoint; the existing AddKid form supplies the date. Dedicated frontend refusal copy, missing-date admission, live GoTrue rollback and whole-stack migration acceptance remain open. No production action occurred.

Full regression terminal confirmation: **53 files / 1,076 backend tests passed** (`audit-results/s01-family-age-regression.log`). No verification process remains running from S01.3c.

### S01.3d current verification across family administration

Moved the creation-only adult-verification check to the family router boundary. Every family read/manage/consent/share route now requires an active parent role and current service-owned ID-verified adulthood; the existing verified guardian-link check still independently scopes each child. Staff-granted roles, revoked/missing/wrong-method verification and a kid-role combination cannot gain this family access. Read errors remain restrictive through the shared resolver. This does not replace direct database authorization or automatically revoke previously recorded consent elsewhere.

The four affected suites passed **80 tests**, including a matrix of five invalid verification states against family listing, child-profile editing, passphrase replacement, badge sharing and analytics-consent grant. All 25 denied requests returned 403 without changing fixture data. Authorized scenarios now explicitly carry verified-adult evidence. Lesson-contract parity, SPEC/token integrity and whitespace checks passed. Backend type/lint were started and require terminal confirmation.

Scope remains partial: staff status/justification and revocation UI under A.5, SQL guardian policies, guardian correction acknowledgement, old-consent validity after revocation, other parent-only routers, live full-stack tests and frontend permission/recovery UX still require implementation/acceptance. No requirement closes and no production action occurred.

Terminal confirmation: backend type checking and lint passed. No verification process remains running from S01.3d.

### S01.3e honest family denial and verification recovery

The family verification guard now returns `PARENT_VERIFICATION_REQUIRED`, with localized explanations in EN/es-MX/pt-BR. The Family page links that response to `/verify-parent` without mounting child controls. Following that route revealed another role/evidence conflation: the legacy verification page and POST endpoint treated any parent role as already verified.

Added authenticated GET `/verification/parent`, which reports current verified-adult evidence through the shared resolver. The verification page waits for that response, offers error/retry on failed or malformed status, and displays its already-verified state only on server confirmation. POST now rejects an existing current verification rather than merely a parent role, so a staff-granted parent can complete the actual ID process. Kid-role accounts cannot use this adult-verification endpoint. This does not add a staff review/revocation workflow, validate document type, or certify reinstatement policy following fraud revocation; those remain A.5 acceptance work.

Verification: **50 backend tests** (verification/family/child management) and **10 frontend tests** (verification status/family controls) passed. Tests distinguish staff-granted and ID-verified parents, verify the recovery link, suppress premature verified claims and retain retry on unavailable status. Backend/frontend type checking and lint passed before the final frontend test additions; localization, SPEC/token integrity and whitespace checks passed afterward. No browser-render matrix or live document-provider acceptance is claimed for these legacy transition screens. No process is left running, and no commit or deployment occurred.

### S01.3f revocation cannot use ordinary verification recovery

The follow-up audit of S01.3e distinguished two formerly conflated cases: an account with no ID verification may submit documents, but a revoked verification must not restore itself through the same route. `readAdultVerificationStatus` now reads and strictly validates the latest decision, including revoked evidence even when the parent role has been removed. It distinguishes verified, unverified, revoked, ineligible and unavailable evidence. GET/POST verification fail closed on unavailable evidence and return `PARENT_VERIFICATION_REVOKED` for revocation before contacting the document processor or writing a new record.

The frontend presents the localized revocation explanation and the existing published support email, without retry or document-upload controls. It does not automate staff review, grant reinstatement, or promise a response deadline. A staff revocation/reinstatement workflow and its authorization/audit trail remain required A.5 work.

The **16 verification API tests** and **4 verification frontend tests** passed. New cases prove that revocation cannot be self-cleared with either parent or universal roles and that unreadable evidence causes no provider call/write. Backend types/lint, localization, SPEC/token integrity and whitespace checks passed; frontend static checks require terminal confirmation. No live document processing, production action or release acceptance occurred.

Frontend type/lint terminal confirmation: passed. No verification process remains running from S01.3f.

### S01.4a use persisted teen/adult evidence for teaching register

The C.1 audit confirmed that session creation and the Mentor map still selected tier 2 from a missing profile DOB despite a stored 13–17/adult declaration. The mandatory age middleware now shares its confirmed state within the request. Both consumers use that evidence to select the existing 10+ teaching register, without granting any adult safety exemption. A protected under-13 origin takes precedence over contradictory adult evidence.

The **186 Mentor API tests passed**, including an actual session-start assertion that a self-registered teen without a profile date persists `p_tier: 3` while `p_voice_used` remains false. Backend type/lint passed before the final integration test addition; lesson-contract parity, SPEC/token checks and whitespace checks passed. The default fixture now explicitly represents an under-13 declaration, matching its child profile; teen/adult cases declare their own evidence.

This is partial C.1 implementation: an under-13 marker/coarse band still cannot distinguish the legacy 6–7/8–9/10+ teaching registers. The existing tier-2 fallback remains for that unresolved population and must be replaced by an explicit unknown/calibration state before C.1 acceptance. No Oracle prompt/context schema was widened, and no model-visible DOB or identifier was added. Required next work includes one-time conversational calibration, persistence/resume semantics, new age-register alignment, privacy-contract/parity gates and rendered Mentor acceptance.

C.4 remains a pending product decision. The owner was asked whether independent teens should explicitly approve/delete every persistent memory note or have cross-session memory disabled until linking a guardian. No answer is recorded and no new independent-teen memory policy is being implemented by assumption. This does not block the independent C.1 work. No commit or deployment occurred.

### S01.4b one-time calibration persistence foundation

Migration `0088_mentor_age_calibration.sql` stores only a user-keyed coarse teaching tier and timestamp, with no DOB or exact age. Its service-only RPC preserves the first response on retries/concurrent writes. Browser roles cannot read/write/invoke it; the service role cannot directly insert, update, delete or truncate the table. Calibration is pedagogical self-declaration, never adulthood evidence or authorization to relax origin/moderation/consent protections.

The Core helper distinguishes an absent calibration (`{ tier: null }`) from unavailable/malformed storage (`null`) and requires a valid RPC acknowledgement. Six contract tests passed, including malformed/duplicate rows, empty acknowledgements and the minimal subject/tier payload. Backend types and lint passed. The native PostgreSQL runner passed eight concurrent attempted replacements, browser privilege denials, migration replay and an exact check that calibration leaves all origin markers unchanged, alongside the earlier age/profile tests (`audit-results/s01-origin-postgres.json`). All 88 migration sequence/RLS/phase checks and SPEC/token/whitespace checks passed.

This is storage groundwork only: no product route or Mentor conversation calls the helper yet. Next connect explicit unknown resolution, the one-time calibration question, confirmed write/retry, session admission and resume. The prior tier-2 fallback remains unaccepted until those consumers are integrated. Full Supabase reset/type generation and full-stack acceptance are still outstanding. No model context field was added, generated types were not hand-edited, and no production action occurred.

### S01.4c explicit calibration API

Authenticated GET/POST `/tutor/age-calibration` now resolve known teaching evidence or report `{ required: true, tier: null }` instead of inventing a tier. A confirmed 13+ declaration supplies tier 3; a valid, consistent under-13 profile date resolves the existing teaching bands; otherwise Core checks the private calibration record. Contradictory adult profile dates cannot override protected under-13 evidence. Failed profile/calibration reads return 502.

POST accepts only a tier, derives the subject from authentication, requires acknowledged storage and a fresh matching read, and preserves an already known/stored answer. It cannot accept an alternate user ID, DOB or invalid tier. All routes remain behind mandatory general age screening. These endpoints do not themselves change microphone, consent or moderation eligibility.

The **14 storage/API tests passed**, covering explicit unknown, missing authentication, minimal payloads, first-answer retry, forged fields, known age evidence and storage failures. Backend type checking/lint, lesson-contract parity, SPEC/token integrity and whitespace checks passed. No verification process remains running.

Remaining C.1 integration: the one-time question must be presented by the Mentor, successful calibration must drive session creation/map/resume, and the legacy unknown-tier fallback must be removed. The new endpoint alone does not satisfy conversational or frontend acceptance. Migration 0088 and the earlier full-stack/type-generation gates remain required before release. No production action occurred.

### S01.4d explicit Mentor calibration and admission enforcement

The selected Mentor now presents a short question and three age-band options using the new design controls over the existing single scene. The choice is stored through S01.4c before offers/session admission proceeds. Read failures provide recovery; failed writes retain the question and options. Successful retries use the confirmed stored answer, and reload does not ask again. Identity changes invalidate pending calibration responses. This is a transition layer, not acceptance of the complete new Mentor composition or spoken dialogue.

Core map recommendations and session creation now resolve known evidence or persisted calibration instead of silently substituting tier 2. Unknown calibration returns `MENTOR_AGE_CALIBRATION_REQUIRED`; unavailable evidence returns 502 before session creation. Resume and internal Oracle socket-context admission independently enforce the same requirement. A legacy session with a different stored register returns `SESSION_AGE_CHANGED`; the frontend clears that resumable reference and returns to the normal start flow. Its historical record is preserved. This does not waive or change the existing daily session cap, and the legacy-session cutover policy still needs review.

Removed the unused default-tier functions from both Core and Oracle. Oracle continues receiving only the existing tier field; no DOB, declaration, calibration record or additional model-context field is sent. Calibration cannot grant adulthood or microphone consent.

Initial verification: **204 Core tests**, **19 Oracle context/privacy tests** and **17 frontend component/copy/stage tests** passed. Core, Oracle and frontend type/lint checks passed before the final frontend identity-invalidation adjustment; its static rerun remains pending. `verify:tutor`, lesson-contract parity, `verify:tutor-ui`, localization, SPEC/token integrity and whitespace checks passed. The initial actual-route browser run passed 375px and 1280px Spanish/light write-failure/retry/reload journeys. That run discovered the legacy microphone denial panel obscuring the choices; the microphone dock is now absent during the calibration question, while unavailable-phase recovery remains visible. Evidence: `audit-results/mentor-calibration/` (synthetic Core responses and real pointer input, not database E2E). The expanded 12-configuration browser/accessibility matrix and general `verify:tutor-a11y` gate still require terminal confirmation.

C.1 remains in progress: full-stack migration/type generation, population acceptance, complete Bible composition/focus/motion evidence and the final conversational presentation remain open. C.4's independent-teen memory decision remains unanswered. No requirement, sprint, release or deployment is marked complete.

Follow-up verification: the full Core regression passed **55 files / 1,109 tests** (`audit-results/s01-mentor-calibration-backend.log`). Frontend type checking/lint passed after identity invalidation. The general `verify:tutor-a11y` gate passed all eight phases plus the sorting activity across its mobile/desktop and light/dark configurations. The new question separately passed 12 locale/theme/width combinations with zero component axe violations, confirmed write-failure recovery and reload persistence. Visual review found unnecessary clearance left for the now-absent microphone; the question has been moved to the bottom safe area to uncover the Mentor. The final matrix rerun includes real Tab/Enter recovery and must finish before that final layout is marked locally verified.

The final-position keyboard matrix passed all 12 configurations. The first keyboard attempt exposed a driver issue: CDP's Enter event lacked its carriage-return text and therefore did not generate native button activation. Supplying the complete Enter sequence resolved it without an application keyboard workaround. The driver now additionally waits for an actual `[data-opening]` Mentor control after save and reload, preventing an intermediate loading screen from being mistaken for successful continuation. That stronger terminal-state run is in progress.

Final terminal confirmation for S01.4d: **all 12 stronger browser journeys passed**, including real-pointer first submission, native Tab/Enter retry, zero component axe violations, actual Mentor opening controls after confirmation, and actual opening controls after reload without another question. Report: `audit-results/mentor-calibration/report.json`; captures use `<locale>-<theme>-<width>-retry.png`. The earlier `failure.png` is retained as failed-run evidence, not a current acceptance screenshot. The final mobile light and desktop dark captures were visually inspected. No verification process is left running from this checkpoint. Full C.1/C.4 and release acceptance remain open as specified above.

Next independent checkpoint: S01.5 / H.1. The current `/auth/me` analytics flag still enables a self-registered teen once general age screening succeeds, without a teen-owned opt-out. Implement the SPEC's plain-language disclosure and enforce suppression of nonessential collection in both browser and ingest; preserve safety-critical logging. This work does not depend on deciding C.4's separate memory policy.

### S01.5a persistent teen analytics choice and server enforcement

H.1 requires a teen-owned disclosure and effective opt-out. Added private migration `0089_teen_analytics_preferences.sql`, storing only account ID, the Boolean choice, disclosure version and update time. Browser database roles cannot read or write the table or execute its setter; Core can read and call a controlled upsert. Missing choice means optional collection is off until the disclosure is presented and accepted. This avoids continuing the SPEC's silent collection while the frontend control is being connected.

Authenticated GET/PUT `/auth/analytics-preference` derives the subject from the session, permits only screened independent teens, strictly accepts only `{enabled}`, and confirms persistence before reporting success. Guests, under-13 origin, adult accounts and kid-role/guardian-managed accounts cannot use this endpoint to override their population's policy. An unknown role or age read is unavailable, never an adult exemption. This preference does not manage safety logs or guardian consent.

`/auth/me`, authenticated event ingest and signup attribution now consult the teen choice. Missing, disabled or unreadable preference suppresses nonessential events; an enabled preference admits this optional path. Core rechecks the choice on direct event requests, so stale client settings cannot override it. Guests and unconfirmed roles remain off. Existing guardian-managed consent remains separate. This checkpoint does not certify all collection sinks, anonymous-identity transitions or immediate UI refresh after a choice; those remain acceptance work.

Verification: **95 targeted API/ingest tests passed**, then the full Core regression passed **56 files / 1,126 tests** (`audit-results/s01-analytics-backend.log`). Tests exercise opt-in, revocation, missing evidence, read/write/readback failures, forged subjects, attempted safety-log control and population boundaries; `/me`, direct ingest and attribution agree on the three choice states. Core types/lint and lesson-contract parity passed. Native PostgreSQL verifies concurrent opt-out persistence, migration replay, browser-role denial, restricted service writes and unchanged protected origin (`audit-results/s01-origin-postgres.json`). The schema/phase checks pass for 89 migrations and their 20 gate tests passed; the remaining database test process still requires terminal confirmation. Frontend beacon/identity regression is running.

H.1 is **not accepted**: the localized disclosure and working self-managed toggle, browser network evidence after a change, remaining collection-sink audit and full Supabase/type-generation gates are still required. Generated database types were not edited. No production action occurred.

Frontend contract confirmation: **59 beacon, tracker and identity tests passed**. Existing disabled-beacon tests verify no transmission and queue removal; this is compatibility evidence for Core's `analyticsEnabled: false`, not acceptance of the still-unbuilt teen disclosure/toggle. The next checkpoint must connect that control, refresh the current browser policy, audit third-party sinks and verify actual browser requests after toggling.

Client enforcement follow-up within S01.5a: the sink audit found a token-refresh race in `flushInsights`: a batch removed from the queue could still transmit after the beacon was disabled. A configuration generation now invalidates pending batches, including disable/re-enable sequences and logout reset. Two new asynchronous tests passed. Umami's authenticated parent branch now also requires Core's `analyticsEnabled` signal, and a component test verifies no initial mount before authorization and script removal/no new pageview after revocation. The updated beacon/identity/tracker suites passed **62 tests** in total. Frontend type/lint checks passed before the final standalone tracker test addition; the final static rerun is pending. These checks do not replace live browser network verification or the remaining disclosure UI.

Terminal confirmation for S01.5a: the complete database test command passed, including all **12 fake Railway transport scenarios**. This harness never contacts Railway. Frontend static checks also passed. No S01.5a verification process remains running.

### S01.5b visible teen disclosure and working account preference

Added the new-design `AnalyticsChoice` control to the existing Settings route through a separate migration adapter. English, Mexican Spanish and Brazilian Portuguese disclose page visits, clicks, lesson attempts/hints/completions and time spent; they distinguish optional usage events from safety records and explain that switching off does not erase history. The accessible switch is shown only when Core confirms the account can manage this choice. Adults, guests and guardian-managed children do not receive a misleading self-service switch.

The adapter does not invent a preference while loading or after an invalid response. Read errors offer retry; failed writes retain the confirmed choice. Successful opt-out clears queued/pending optional events before reflecting the new state, then refreshes the browser's authorization. Controls stay busy until refresh completes. Account-keyed mounting and generation checks discard stale reads/writes. A same-account `/me` failure now explicitly revokes optional analytics in AuthContext while preserving the existing profile; an unavailable refresh must not retain an old tracker permission. Its existing identity/request-version checks remain in place.

Verification: **5 control integration tests**, **3 localized copy-budget tests**, and the Settings immutable-DOB regression passed. The latest policy-refresh, tracker and control subset passed **13 tests**; the broader beacon/tracker/identity coverage totals **63 tests**, including the newly added refresh-failure case. Frontend types/lint passed before the final policy-refresh guard; its final static command requires terminal confirmation. Localization and SPEC/token/whitespace checks passed.

`node scripts/verify-analytics-choice.mjs` passed **12 actual Settings-route journeys** (three locales, light/dark, 375px/1280px). Each uses real pointer input, a failed save followed by opt-in and opt-out, the actual first-party beacon module and observed network requests. No optional request is sent before the choice, opt-in enables transmission, and opt-out/reload suppress it. Each reload waits for a fresh preference read. The component has zero axe violations in each settled render and no horizontal page overflow. The driver initially read the outgoing document during reload; a fresh-read barrier corrected that. A subsequent contrast failure measured the legacy page-entry fade mid-animation; waiting for full ancestor opacity and theme-transition completion produced stable passing measurements. These were driver corrections, not disabled accessibility rules. Final mobile light and desktop dark captures were visually inspected.

Evidence: `audit-results/analytics-choice/report.json` and its locale/theme/width screenshots. Core is synthetic in this browser harness; the database and API evidence are independent checks, not full-stack E2E. External tracker providers are not contacted. The retained `failure.png` documents an earlier failed run, not current acceptance.

H.1 remains **in progress**, with local functional/product/frontend checkpoints verified. Remaining acceptance includes cross-tab/device revocation, the complete optional-event/third-party sink audit, in-flight server-ingest/revocation ordering, population-transition journeys, full Bible composition/motion checks and Supabase/type-generation gates. Existing safety logs were not changed. No requirement, sprint or release is accepted, and no production action occurred.

Final terminal confirmation for S01.5b: frontend type checking and lint passed after the same-account refresh-failure guard. SPEC/token integrity and whitespace checks passed after the sprint/ledger update. No verification process remains running from this checkpoint. Next: close cross-session revocation and ingest ordering without weakening the independent-teen choice or the separate guardian/safety boundaries.


### S01.5c cross-tab revocation and atomic optional-event admission

A storage signal now invalidates analytics authorization in other tabs; it carries only an opaque nonce, never a permission or account identifier. AuthContext suspends optional collection immediately and reloads Core's policy. Focus and visibility changes revalidate authorization; hiding a tab invalidates pending responses and suspends collection. A 30-second visible-tab refresh limits stale cross-device authorization, but is not an instantaneous cross-device guarantee. Conservative refresh discards queued optional events even when permission remains enabled. The Settings adapter reloads its displayed preference after another tab signals a change.

Migration `0090_optional_event_admission.sql` gates identified inserts into `learning_events` using stored age, protected origin, actual roles, guardian consent or the independent teen preference. It serializes on the same account row as the teen preference setter: an insert admitted first commits before revocation acknowledges; revocation first makes the waiting insert drop. Anonymous acquisition remains separate. Safety and learning-progress storage are outside this trigger. This does not yet establish atomic ordering for guardian-consent changes or signup attribution.

The common Core event sink now checks source admission for server-produced events as well as browser ingest, deduplicating policy reads per subject within a batch. Missing evidence drops optional rows. Family reporting distinguishes a legitimate zero-row privacy drop from a database failure. Existing lesson/family producers therefore cannot rely solely on their older role-based prechecks.

Verification: the complete Core suite passed **56 files / 1,126 tests** after the common sink change. An additional **9 direct-sink cases** then passed within the **26-test analytics preference suite**, covering enabled/disabled/missing choices, protected origin, unknown roles, guardian-managed accounts, unavailable reads, adults and mixed anonymous/identified batches. A readonly fixture typing issue exposed by the static gate was corrected; Core and frontend type/lint checks passed. Cross-session AuthContext/control tests passed **15 tests**, including untrusted storage messages and hidden-tab stale responses.

The actual-browser cross-tab journey passed with two tabs sharing storage: a real switch click in one tab updates the other, and the returning visible tab sends no optional beacon. The complete **12 locale/theme/viewport journeys** passed again after the refresh changes, with zero component axe violations. Reports: `audit-results/analytics-choice/cross-tab-report.json` and `report.json`. This harness uses synthetic Core responses and blocks external providers; it is not provider or full-stack acceptance.

Native PostgreSQL exercised both concurrent orderings and observed real lock waits before releasing each transaction, plus **10 population cases**, migration replay, preserved opt-out and unaffected safety fixtures. Evidence: `audit-results/s01-analytics-concurrency.json`; reproducible runner: `database/scripts/verify-analytics-postgres.py`. These are minimal PostgreSQL fixtures, not the full Supabase schema. The 90-migration database gate command remains running at this checkpoint; schema/phase checks and 20 gate tests have passed, with fake Railway transport scenarios awaiting terminal confirmation.

H.1 remains in progress. Remaining work includes concurrent cross-tab preference writes, cross-device/provider and population-transition evidence, attribution/guardian-revocation ordering, full Bible acceptance, and Supabase migration/type generation. No sprint or release is accepted and no production action occurred.


S01.5c terminal confirmation: the complete 90-migration database command passed, including all 12 fake Railway transport scenarios. No external Railway operation occurred.

### S01.5d concurrent preference presentation

A storage notification previously invalidated an in-flight Settings write while immediately issuing a new GET. That GET could finish before the write, leaving the visible switch stale and suppressing the write's outgoing invalidation signal. The adapter now defers reconciliation until the existing write and policy refresh settle, keeps the control busy, signals other tabs and performs a fresh preference read. The same reconciliation applies when the signal arrives during policy refresh. It never treats the storage payload as authorization.

Verification: **17 frontend tests passed**, including two new controlled interleavings (signal during PUT and signal during policy refresh). Frontend type checking and lint passed. The actual two-tab browser journey passed again with real pointer input and observed beacon suppression. Database ordering evidence remains the independently verified S01.5c result; these frontend tests do not prove distributed cross-device delivery or every concurrent multi-tab ordering. H.1 and S01 remain in progress.


### S01.4e verified-link memory review admission

C.4 explicitly requires guardian review eligibility to depend on the verified guardian relationship. The internal learner-memory write route now reads verified guardian links as well as roles. A dependant with a verified link enters the existing learner-note proposal queue even when their only role is universal, parent or admin. A failed or malformed guardian identity read refuses the write. Existing kid-role records without a verified link retain their conservative hold rather than silently gaining automatic writes.

This is a bounded correction to the existing learner-store admission path. It does not choose the unanswered independent-teen policy, migrate historical notes, alter Oracle's model context, or establish atomic ordering against a concurrent guardian-link change. Existing pedagogy-store automatic writes remain and require a separate C.4 scope/content review; the old rulebook's rationale for that distinction is historical evidence, not SPEC authority. Likewise, no-role/unknown-age and independent-teen automatic-write behavior remain unresolved in this checkpoint and are not approved as the final policy.

Verification: **194 tutor-route tests passed**, including three new role-independent linked-dependant cases and guardian-read outage rejection. Existing proposal parking, guardian access/decision, compare-and-swap and pedagogy compatibility tests passed. Lesson-contract parity, Core type checking and lint passed. The full Core regression passed **56 files / 1,139 tests** (`audit-results/s01-memory-links-backend.log`). SPEC/token integrity and whitespace checks also passed. No frontend changed; these API checks are not evidence of a rebuilt guardian review experience or actual RLS/persistence behavior. C.4 remains in progress and requires the pending product decision, both-store assessment, population transitions, database and frontend acceptance.

### Owner decisions recorded (24 September 2026)

The project leader answered the two open product questions this sprint was waiting on:

- **OD-18 � C.4 independent-teen memory:** teens (13-17, no linked guardian) approve or delete every persistent memory note as their own reviewer, using the same per-note review pattern children get from their verified guardian. No note is written to persistent memory without that note-level decision. Implementation becomes the next S01 checkpoint.
- **OD-19 � lesson Mentor stage:** the compact lesson stage shows the learner's own chosen Mentor character on the diorama/scene the lesson document declares. S05.2bh's paused integration boundary is now unblocked; the public, minimum, answerless projection contract is defined in the v2 lesson document path.

Both are recorded in the binding owner log (OD-18/OD-19) with updated SPEC checksums; spec:check passes. C.4 and B.8 acceptance still require the implemented behavior, its verification and the human reviews.

### S01.4f independent-teen memory self-review (OD-18, C.4)

The project leader decided OD-18 on 24 September 2026: an independent teen (13-17, no linked guardian) approves or deletes every persistent Mentor memory note as their own reviewer, using the same per-note review pattern children get from their verified guardian. Implemented at the Core boundary:

- classifyMemoryReview() (backend/src/routes/tutor.ts:366) classifies the learner from server-held evidence only: verified guardian link or legacy kid role -> guardian review (unchanged); screened 13-17 declaration with no protected origin, no kid role and no verified link -> self-review; missing/under-13/unknown evidence or any read failure -> conservative hold (403 MEMORY_REVIEW_INELIGIBLE, 502 on unreadable evidence); screened adult declaration -> existing direct-write adult behavior preserved.
- PUT /learner-memory parks self-review notes in the existing proposal queue instead of writing them; GET /memory-proposals gives a self-reviewing teen their own pending queue; POST /memory-proposals/:id/decision re-resolves authorization from the note owner at decision time and stamps the actor distinctly (learner-self-approved-review vs guardian-approved-review). A teen can only decide their own notes; a teen who later gains a linked parent automatically returns to guardian review.
- No migration was required: the proposal queue and the service-only decision RPC already accept a free actor field. No Oracle context or payload field was added.

Verification on 24 September 2026: 17 new adversarial tests in the OD-18 describe block (backend/src/__tests__/tutor.test.ts:2995) plus three fixture corrections; the focused tutor suite passed 212/212; the combined full Core regression passed 63 files / 1,355 tests + 1 documented skip (audit-results/s01x-combined-backend.log); Core type-check and lint passed. Remaining: the teen self-review portal in the frontend, real-database/RLS verification of the proposal round-trip, Oracle's cosmetic info-log wording for parked teen notes, and full C.4 acceptance (the reviewed human sign-off). C.4 stays in progress; no release is claimed.

Real-database follow-up (24 September 2026): 15 real Core/GoTrue/PostgREST/PostgreSQL checks passed against the owned isolated lf-reset stack (audit-results/verify-s01-c4-http.mjs, audit-results/s01-c4-http.json): a screened teen's internal write parks for self-review with zero learner_memory rows until the note-level decision; the teen lists, approves (row lands in learner_memory) and rejects their own notes; a second teen cannot see or decide the first teen's note; a screened adult keeps the direct write with no self-review queue; an unscreened account is held with 403. The first harness run used a stale Core build and reported the pre-OD-18 direct write; rebuilding Core (backend/dist was older than the source) produced the passing run � recorded as a harness correction, not a product change.
