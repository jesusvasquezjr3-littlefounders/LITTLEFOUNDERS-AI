# Staff, analytics and operations governance (S09)

This document is the written record for Block G's and Block H's governance
requirements. It is engineering-owned, reviewed with Product and the
Safety/Trust role, and updated whenever a requirement or its implementation
changes. Sprint evidence lives in `docs/rebuild/sprints/S09-STAFF-ANALYTICS-OPS.md`;
this file holds the standing policies themselves.

## 1. Standing constraints (G.6, H.6)

The following are load-bearing design constraints. A future tool may only
cross one through an explicitly-reviewed exception recorded in the owner
decision log — never by default.

1. **No staff read-access to full AI Mentor transcripts.** Staff see sampled
   individual generated activities plus their answer keys (the `manage_content`
   review queue), never the surrounding conversation. Full transcript access
   remains ⛔ for Admin and Superadmin.
2. **No staff read-access to banking/wallet data** beyond the child and their
   verified guardians. Wallet reads are scoped to the kid and verified
   guardian links; staff consoles do not surface balances.
3. **No user-impersonation or "login as" capability.** None exists, and none
   may be added without an explicit reviewed exception.

Constraints 1-3 are enforced every release (Appendix N 1.3) by
`agent/tools/check-staff-standing-constraints.mjs`, in `npm run spec:check`
and the repo-gates workflow: it follows every symbol the staff router uses,
function by function, and fails on a reachable read of `tutor_turns`, a
transcript or turns endpoint, or a per-account wallet/banking table; on any
route, request field or identifier named impersonate, act-as, login-as or
sudo; and on minting a session or token for another account. An exception
needs an allowlist entry citing its owner decision (OD-n). At runtime,
`backend/src/__tests__/staffStandingConstraints.test.ts` calls every staff
GET route and asserts none of them reads or returns those fields.
4. **The kid-role analytics consent gate is the reference implementation for
   every future consent-gated feature** (H.6): transmission is blocked at the
   source (the beacon does not even transmit before the server confirms
   active guardian consent), consent is granted only by a verified guardian,
   and role-stamping precedence means "kid" always wins even when a person
   holds other roles. New consent gates must match this bar, not fall below
   it.

## 2. Access governance (G.4)

- **Quarterly access review.** Every calendar quarter, the staff/access owner
  reviews Admin/Superadmin role holders and staff permission grants against
  actual usage. Each completed review is a row in the access-review log
  (`staff_access_reviews`, written with its `admin.access.reviewed` audit row
  in one transaction by `POST /admin/roles/review`). The Roles & Access card
  lists every admin/superadmin role and staff permission whose later of grant
  and last kept review is older than 90 days (family roles are never listed),
  each with "Keep access", and shows the Appendix N numbers from the log:
  Access-Review Cadence Compliance (target 100%) and the stale-grant count.
- **Grant discipline.** A parent-role staff grant requires a mandatory audited
  justification (A.5), committed with the role in one transaction
  (`grant_parent_role_with_justification`); the database refuses a parent role
  written through the API with neither an ID check nor a justification.
  Verification revocation carries a mandatory audited reason, committed with
  the revoked row (`revoke_parent_verification`). Every staff moderation
  decision on live AI-Mentor activities, and every curated-pack status
  decision, writes its central audit row inside the decision's own
  transaction (G.3).
- **Discoverability.** Every staff-facing screen is either in active,
  documented use or removed (G.5). The Insights screen is in the staff
  navigation under the `view_analytics` grant.

## 3. Analytics retention policy (H.2)

Two windows exist over overlapping activity data, and the difference is
deliberate:

- **Raw usage events — 400 days** in the operational store. This is the
  investigative and reconciliation window: it must cover at least one full
  annual cycle (seasonality, school years) plus incident look-back, while
  remaining bounded enough to honor the platform's minimization commitments.
- **Warehouse "sessions" dimension — rolling 90 days.** The warehouse exists
  for fast product questions (funnels, experiments, health metrics). A rolling
  90-day session window keeps the derived layer cheap and stale-proof; any
  question older than that is answered from the raw store, not the derived
  layer.

The kid-role consent gate applies to BOTH stores: a kid's events only exist
to retain because an active guardian consent admitted them at the source.

## 4. Operational alerting (H.3, H.4)

- **Warehouse alerts notify, not just record.** A triggered alert is written
  to `alert_history` AND delivered through its configured channel (webhook
  POST, or an internal email through the email-server). Delivery is
  best-effort and loudly logged; the durable trigger row exists regardless.
  Unconfigured channels warn loudly rather than pretending delivery.
- **Half-built mechanisms may not ship.** The async export-job endpoints were
  removed (no processor ever advanced them — creating a permanently-pending
  job is now impossible; the direct synchronous export surface is the only
  one). The `task_view` and `tutor_open` events, previously catalogued with
  no emitter, now emit from the tasks boards and the Mentor experience.
- **Watchdog coverage (H.4).** The AI Mentor retention sweep has a watchdog
  plus a staff-console status, and the same pattern now covers the daily Vault
  backup, the daily Pulse backup and the schema drift probe:
  - each job ends with `scripts/ops-heartbeat.sh`, which records
    `ops.<job>.completed` (with `ok`) through Core's internal
    `POST /api/v1/internal/ops/heartbeat`; a heartbeat Core does not confirm
    fails the job;
  - `GET /admin/ops/job-status` (manage_support) and the Reports, Support
    view show each job's last successful run and `stale`, beside the
    retention sweep; the window (36 hours for each daily job) has one home,
    `OPS_JOB_STALE_HOURS` in `backend/src/services/opsJobs.ts`;
  - `.github/workflows/ops-job-watch.yml` (daily, 10:00 UTC) reads the
    status from inside the container, fails when a job is stale or the reply
    is unreadable, and opens or comments on the `ops-watchdog` GitHub issue,
    so a human is notified;
  - the simulated-failure drill (`npm --prefix backend run ops:drill`, also a
    unit test) proves, for each job, that a stale heartbeat produces
    `stale: true` and the notice.
  Remaining for the ops owner: the first scheduled runs in production and a
  drill run against the deployed Core.

## 5. Incident response and backups (H.5)

- **Backup encryption.** Database backups contain family and AI Mentor data
  and MUST be encrypted at rest. **Status: to be confirmed by the ops owner**
  against the backup provider's configuration before the next release cycle;
  if any backup store is not encrypted at rest, enabling encryption is a
  release-blocking task. This line stays in this document until confirmed.
  The cutover backup procedure (encrypted by the file itself) and the
  current status of each backup: `BACKUP-RESTORE-ROLLBACK.md` section 1.
- **Incident response baseline.** On discovery of a security incident:
  1. Contain: rotate the affected keys, revoke the affected sessions/grant.
  2. Triage: severity decided by Engineering + the Safety/Trust role within
     24 hours; a security incident involving a minor's data is always at
     least "high".
  3. Investigate: audit-log reconstruction; no blame logs, no speculation in
     the record.
  4. Notify families: affected guardians are informed in plain language,
     naming what was affected and what they can do, as soon as the scope is
     known — targeting within 72 hours of confirmation, with the exact
     timeline stated in the notice.
  5. Post-mortem: written within one week; the standing constraints above
     are re-verified.
- **Breach notification** follows the same timeline: affected families first,
  then any regulator per applicable law, with the notice written by
  Product + Legal.

## 6. Experimentation eligibility (H.7)

- Every experiment may declare integer age bounds (`min_age`/`max_age`).
  Unbounded experiments accept unknown ages; a bounded experiment NEVER
  assigns or exposes a learner whose age is unknown or outside the bounds —
  eligibility cannot be guessed. Enforcement lives in dataintel at the
  assignment/exposure boundary; Core passes the derived age (or null when the
  evidence is unavailable). Kid-role exposures additionally require the
  existing consent gate.
- No live experiment currently reaches any user; this policy applies from the
  first wired experiment onward.
