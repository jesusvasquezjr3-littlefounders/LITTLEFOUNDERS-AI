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
- **Review trigger.** The review does not wait for a superadmin to open Roles
  & Access. Core's `GET /api/v1/internal/ops/job-status` carries
  `accessReviews: { due, windowDays: 90 }` from
  `staff_access_review_status(90)`, and `ops-job-watch.yml` (daily, 10:00
  UTC) fails and opens or comments on the `ops-watchdog` GitHub issue while
  any elevated grant is due, naming the count and the Roles & Access card.
  The staff/access owner watches that issue; it is commented on every day
  until each due grant is kept or revoked. The drill
  (`npm --prefix backend run ops:drill`, target `access_reviews`) proves it.
- **Calendar trigger.** On 1 January, April, July and October at 09:00 UTC,
  `access-review-quarterly.yml` opens the quarter's review issue
  ("Quarterly access review: YYYY-Qn", label `access-review`) for the
  staff/access owner, with the elevated grants held (`accessReviews.total`)
  and the number already due, and the steps: review every grant against
  actual usage on Roles & Access, keep or revoke each, close the issue. It
  opens even when nothing is due. An unreadable status still opens the issue
  and turns the run red. `agent/tools/access-review-quarterly.test.mjs` pins
  the schedule, the tool and the notification.
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
- **Watchdog coverage (H.4).** Four scheduled jobs are watched, each with a
  watchdog and a notification to a human (Appendix O 1.3 names the first
  three): the AI Mentor 90-day retention sweep, the daily Vault backup, the
  daily Pulse backup and the schema drift probe:
  - the retention sweep records its own trail (`tutor.retention.swept`, on
    every purge that reaches the database) and keeps its 36-hour window in
    `RETENTION_STALE_HOURS` (`backend/src/services/tutorData.ts`); Core's
    job status carries it as the `tutor_retention` job (`tutorRetention`),
    built from `getTutorRetentionStatus()`. `tutor-retention-watch.yml`
    (06:00 UTC) still fails its own run early; the human notification is the
    watchdog issue below;
  - each of the other three ends with `scripts/ops-heartbeat.sh`, which records
    `ops.<job>.completed` (with `ok`) through Core's internal
    `POST /api/v1/internal/ops/heartbeat`; a heartbeat Core does not confirm
    fails the job;
  - `GET /admin/ops/job-status` (manage_support) and the Reports, Support
    view show each job's last successful run and `stale`, beside the
    retention sweep; the window (36 hours for each daily job) has one home,
    `OPS_JOB_STALE_HOURS` in `backend/src/services/opsJobs.ts`;
  - `.github/workflows/ops-job-watch.yml` (daily, 10:00 UTC) reads the
    status from inside the container, fails when any of the four jobs is
    stale, a retroactive release check is overdue (G.2), an elevated grant
    is due for review (G.4, section 2) or the reply is unreadable, and opens
    or comments on the `ops-watchdog` GitHub issue, so a human is notified;
  - `.github/workflows/content-retro-checks.yml` (weekly, Monday 05:00 UTC)
    runs the retroactive release check itself inside its 30-day window and
    comments on the same issue when a course's verification fails (G.2, see
    `docs/content/FORGE-V2-RELEASE.md`);
  - the simulated-failure drill (`npm --prefix backend run ops:drill`, also a
    unit test) proves, for each of the four jobs, that a stale trail produces
    `stale: true`, a failed watcher and the notice; it also drills an overdue
    retroactive check and a due access review.
  Remaining for the ops owner: the first scheduled runs in production and a
  drill run against the deployed Core.

## 5. Incident response and backups (H.5)

- **Backup encryption.** Database backups contain family and AI Mentor data
  and MUST be encrypted at rest. The daily Vault and Pulse backups
  (`.github/workflows/vault-backup.yml`, `pulse-backup.yml`) are encrypted by
  the file itself: the runner encrypts each dump with
  `database/migration-od9/backup-crypto.mjs` (AES-256-GCM, a manifest with the
  key fingerprint) using the `BACKUP_ENCRYPTION_KEY` secret, deletes the
  plaintext, and stores only the `.lfbk` file and its manifest; a missing key
  or an empty ciphertext fails the job. `agent/tools/backup-workflows.test.mjs`
  refuses any backup workflow that uploads a file without the `.lfbk` suffix.
  Owner steps before this is live: create the secret (`node
  database/migration-od9/backup-crypto.mjs keygen --key-file <path>`, stored
  in the secret store and the offline key escrow) and push the workflows.
  Plaintext dumps written before the change age out with the 30-day prune.
  The pre-migration restore points (a full production dump taken by
  `.github/workflows/database-cd.yml` before every auto-applied additive
  migration and by `tutor-deploy.yml` `step: migrate`) follow the same rule:
  encrypted on the runner, only `pre-migration-*.dump.lfbk` and its manifest
  stored, pruned after 30 days, the older plaintext `pre-migration-*.dump`
  files deleted once the encrypted point is stored. The lint discovers every
  workflow that writes to `/data/backups`, never a fixed list.
  The cutover backup procedure and each store's status:
  `BACKUP-RESTORE-ROLLBACK.md` section 1.
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

- **Adults only by default (OD-23).** Every experiment admits adults (18+)
  only until Product and Legal decide otherwise. An experiment that declares
  no age bounds is adults-only, never open to every age; a declared bound can
  raise the floor, never lower it.
- **One exception (OD-26).** The C.17 dialogue-calibration experiment (the
  Mentor surface) may enrol teens 13-17 with their own analytics opt-in and
  tweens 10-12 with guardian analytics consent. Children 6-9 stay excluded.
  In the warehouse this is the `eligibility_policy` value `od26_c17`, accepted
  only on the `tutor` surface and never below age 10; Core enforces the
  opt-in/consent half at its boundary.
- **Unknown ages are never eligible**, whatever the policy or bounds:
  eligibility cannot be guessed.
- **Any new exception needs an owner decision** recorded in the owner
  decision log, and a new policy value added in code with its tests; staff
  cannot widen an experiment by setting bounds.
- Enforcement lives in dataintel at creation (`POST /experiments` refuses a
  bound or policy outside these rules) and at the assignment/exposure
  boundary; Core passes the derived age (or null when the evidence is
  unavailable), and its own exposure route admits adults only. Kid-role
  exposures additionally require the existing consent gate.
- No live experiment currently reaches any user; this policy applies from the
  first wired experiment onward.
