# S09: staff, analytics and operations

Status: in progress. Started 24 September 2026. Owner: Engineering for implementation; Product, Safety/Trust and the ops owner for the reviews and confirmations named by the SPEC. No release approval is recorded.

## Binding acceptance sources

- Product G.3–G.6, H.2–H.7.
- Appendix N (staff console metrics/QA) and Appendix O (analytics/operations metrics/QA).
- Frontend Bible 02/06 for rebuilt staff surfaces.

Risk classification: **internal governance and operations**. Changes here do not touch child-facing product flows directly; G.3/G.6 are safety-adjacent.

## Point-by-point checkpoints

| ID | Scope | Product acceptance | Frontend acceptance | State |
|---|---|---|---|---|
| S09.1 | G.3 live-activity moderation audit | Mentor live-activity approve/reject decisions land in the central audit log (actor, segment, status) alongside the activity-row update | Staff audit screen shows the new action through the existing surface | In progress: implementation and local verification recorded; real-database and human review pending |
| S09.2 | G.4 access lifecycle | Quarterly review cadence documented and surfaced: grants older than 90 days listed in a review-due card in Roles & Access | Review-due card rendered from holder assignment timestamps | In progress: implementation and local verification recorded; first real quarter and human review pending |
| S09.3 | G.5 Insights discoverability | Insights is in the staff navigation under view_analytics (verified, already present) — recorded as the decision to keep it in use | Nav renders for the grant | In progress: verification recorded |
| S09.4 | G.6/H.6 standing constraints | No staff transcript/banking read, no impersonation, and the kid-role consent gate as the reference standard — written into docs/operations/GOVERNANCE.md | — | In progress: documentation recorded; Safety/Trust review pending |
| S09.5 | H.2 retention policy | Written rationale for the 400-day raw vs 90-day warehouse-session windows in the governance doc | — | In progress: documentation recorded; ops owner review pending |
| S09.6 | H.3 half-built instrumentation | task_view/tutor_open emitters wired; warehouse alerts now deliver (webhook/email) with durable rows regardless; export-job endpoints removed (no processor existed — creating a permanently-pending job is impossible) | Tasks boards and Mentor experience emit the events; no UI referenced the removed job surface | In progress: implementation and local verification recorded; production channel configuration pending |
| S09.7 | H.4 watchdog coverage | Backup and drift-probe watchdogs required and documented as open ops tasks with the retention-sweep pattern as the reference | — | In progress: documentation recorded; ops owner execution pending |
| S09.8 | H.5 incident response + backup encryption | Baseline incident/breach process documented; backup encryption required with an explicit open confirmation task | — | In progress: documentation recorded; ops owner confirmation pending |
| S09.9 | H.7 experiment age eligibility | Experiments declare integer age bounds; dataintel refuses assignment/exposure for unknown or out-of-range ages; Core passes the derived age (or null) | — | In progress: implementation and local verification recorded; first live experiment and human review pending |

## Verification log

Executed 24 September 2026 against the current working tree. Commands below are relative to the named directory. These are local results, not CI or production observations.

| Boundary | Command / evidence | Result |
|---|---|---|
| Core G.3 | `backend/`: `npm test -- --run src/__tests__/admin.test.ts` | The review-verdict test now asserts the audit-log write (actor-scoped action `admin.tutor_activity.review` with the segment id) alongside the activity-row update |
| Core regression | `backend/`: `npm test` | 70 files, 1,470 tests passed + 1 documented skip |
| Core static checks | `backend/`: `npm run type-check`, `npm run lint` | Passed |
| Data intel H.3/H.7 | `dataintel/`: `npm test` | 194 tests passed, including 4 new alert-delivery tests (webhook payload, unconfigured-channel loud gap, durable row on delivery failure, cooldown) and 4 new age-eligibility tests; the removed export-job surface is pinned by three 404 assertions |
| Data intel static checks | `dataintel/`: `npm run type-check`, `npm run lint` | Passed |
| Frontend regression | `frontend/`: `npm test` | 211 files, 2,189 tests passed |
| Frontend static checks | `frontend/`: `npm run type-check`, `npm run lint` | Passed |
| Binding authority and repository tools | Root: `npm run spec:check`, i18n gate, secrets scan (Git Bash) | Passed |

Execution notes: the dataintel config cache had to be reset between alert-delivery tests (the first test's env var leaked into the cached config — a harness correction). The removed export-job tests were replaced with removal-pinning assertions rather than deleted outright, so the half-built mechanism cannot silently return. The email channel targets the email-server's existing internal `/api/v1/send`; the `alert_notification` template name is a contract the email-server must supply when the channel is configured (an open ops task recorded below).

Remaining acceptance boundaries: production configuration of the alert channels, the ops owner's backup-encryption confirmation and watchdog execution (H.4/H.5), real PostgreSQL evidence for the G.3 audit write, the first real quarterly access review, and human review. None of these requirements is accepted.
