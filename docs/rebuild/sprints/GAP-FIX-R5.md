# Gap-fix round 5

Lane records for the fifth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

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
- No "deny and report" single action was added: the Tutor reports, then
  decides, and a denied request stays reportable for 30 days through the
  same route (the gap listed the combined action as optional).
