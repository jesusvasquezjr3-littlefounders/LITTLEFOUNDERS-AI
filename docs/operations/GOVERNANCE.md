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
deliberate (the warehouse's copy of the raw events shares the first one):

- **Raw usage events — 400 days** in the operational store. This is the
  investigative and reconciliation window: it must cover at least one full
  annual cycle (seasonality, school years) plus incident look-back, while
  remaining bounded enough to honor the platform's minimization commitments.
- **Warehouse "sessions" dimension — rolling 90 days.** The warehouse exists
  for fast product questions (funnels, experiments, health metrics). A rolling
  90-day session window keeps the derived layer cheap and stale-proof; any
  question older than that is answered from the raw store, not the derived
  layer.
- **Warehouse copy of raw usage events — 400 days, the same window.** The
  warehouse (dataintel) copies every raw event into `fact_events_raw`
  incrementally, and keeps learner-keyed `experiment_assignments` and
  `experiment_exposures`. These are not a third window: after every sync,
  `dataintel/src/services/warehouseRetention.ts` deletes rows older than
  `RAW_EVENT_RETENTION_DAYS` (400 days, the constant the Vault prune
  `prune_learning_events(400)` is pinned to by
  `dataintel/src/__tests__/warehouse-retention.test.ts`) and logs every run,
  rows removed per table, in `warehouse_maintenance_log`. An account erasure
  removes the same tables at once, and the erasure re-apply that runs after
  every sync (an erased account's rows never come back) logs there too. A
  failed run of either writes an `ok = FALSE` row with its error. The log is
  read by the `warehouse_retention` watched job (section 4), so a prune or
  re-apply that fails or stops running notifies a human. The daily aggregates
  (`agg_daily_*`) hold counts only and are kept.

The kid-role consent gate applies to BOTH stores: a kid's events only exist
to retain because an active guardian consent admitted them at the source.

## 4. Operational alerting (H.3, H.4)

- **Warehouse alerts notify, not just record.** A triggered alert is written
  to `alert_history` AND delivered through its configured channel (webhook
  POST, or an internal email through the email-server); the durable trigger
  row exists regardless. Since gap-fix round 6 (H.3, Block H "no alert may be
  built to record without a real consumer"):
  - an alert can only be created (`POST /alerts`) or switched back on
    (`PATCH /alerts/:id` to `active`) on a channel dataintel has configured
    (`ALERT_WEBHOOK_URL`, or `ALERT_EMAIL_SERVER_URL` + `ALERT_EMAIL_INTERNAL_KEY`
    + `ALERT_EMAIL_TO`); otherwise 409 `ALERT_CHANNEL_UNCONFIGURED`.
    `GET /alerts/channels` (and the staff console, Learning intel,
    Experiments & alerts, "Alert channels") says which are set up;
  - a failed send is retried up to 3 times (2 s, then 8 s apart; a network
    error, a timeout, 408, 425, 429 or 5xx is retried, any other 4xx is not)
    and every attempt is a row in `alert_delivery_attempts`; the trigger row
    keeps the final outcome and `delivery_attempts`;
  - a trigger that still reached nobody (failed, unconfigured because the
    channel was removed later, or no outcome recorded 15 minutes after it) is
    listed by `GET /alerts/undelivered?hours=36`. Core's operations status
    carries it as `alerts.undelivered` (window: `ALERT_UNDELIVERED_WINDOW_HOURS`
    in `backend/src/services/warehouseAlerts.ts`), `ops-job-watch` fails on
    any, names each one on the `ops-watchdog` issue (the escalation channel),
    and refuses a reply without the count (an unreadable warehouse);
  - the staff Reports, Support view shows the same count on the watchdog
    card.
- **Half-built mechanisms may not ship.** The async export-job endpoints were
  removed (no processor ever advanced them — creating a permanently-pending
  job is now impossible; the direct synchronous export surface is the only
  one). The `task_view` and `tutor_open` events, previously catalogued with
  no emitter, now emit from the tasks boards and the Mentor experience.
- **Watchdog coverage (H.4 and the Block H non-negotiable).** Eleven scheduled
  jobs are watched, each with a watchdog and a notification to a human.
  Appendix O 1.3 names the first three; the Block H standard adds every job
  whose silent failure would harm family data (GAP-FIX-R6, and GAP-FIX-R8 for
  the warehouse maintenance and for the legacy badge-image purge that owner
  answer D-08 approved):

  | Job (`job`) | Workflow (UTC) | Trail Core reads |
  |---|---|---|
  | `tutor_retention` | `tutor-retention.yml` 03:00 | `tutor.retention.swept` audit rows |
  | `family_retention` (D.21) | `family-retention.yml` 03:15 | `family_retention_runs.ran_at` |
  | `badge_link_retirement` (F.2 under OD-20; D-08) | `badge-link-retirement.yml` 03:30 | `badge_links.images_swept` audit rows (one per swept page); a page with `failed > 0` is a failed attempt, because that child's achievement image still resolves. Watched until the dated removal of the workflow |
  | `account_deletions` (E.6, A.1's 90-day paused child) | `account-deletion.yml` 03:45 | `account_deletions.sweep_ran` audit rows; a run with `suspensionsUnreadable` is a failed attempt |
  | `social_retention` (E.11) | `social-retention.yml` 04:15 | `social_retention.sweep_ran` audit rows (written by the database in the sweep's transaction) |
  | `learning_retention` (400-day practice days) | `learning-retention.yml` 04:30 | heartbeat `ops.learning_retention.completed` |
  | `insights_prune` (H.2's 400-day raw events) | `insights-maintenance.yml` 07:30 | heartbeat `ops.insights_prune.completed` |
  | `vault_drift` | `vault-drift.yml` 07:30 | heartbeat `ops.vault_drift.completed` |
  | `vault_backup` | `vault-backup.yml` 08:00 | heartbeat `ops.vault_backup.completed` |
  | `pulse_backup` | `pulse-backup.yml` 08:30 | heartbeat `ops.pulse_backup.completed` |
  | `warehouse_retention` (H.2's 400-day warehouse copy; E.6's erasure re-apply) | dataintel, after every sync (`SYNC_INTERVAL_MS`, 5 minutes) | `warehouse_maintenance_log`, read through dataintel `GET /api/v1/intel/maintenance/status` (internal key) |

  - the retention sweep keeps its 36-hour window in `RETENTION_STALE_HOURS`
    (`backend/src/services/tutorData.ts`); Core's job status carries it as
    `tutorRetention`, built from `getTutorRetentionStatus()`.
    `tutor-retention-watch.yml` (06:00 UTC) still fails its own run early;
    the human notification is the watchdog issue below;
  - a heartbeat job ends with `scripts/ops-heartbeat.sh`, which records
    `ops.<job>.completed` (with `ok`, also on a failed run) through Core's
    internal `POST /api/v1/internal/ops/heartbeat`; a heartbeat Core does not
    confirm fails the job. A trail job is never given a heartbeat: the route
    refuses its name, so nothing can fake its record;
  - `warehouse_retention` covers two steps, the 400-day prune
    (`warehouseRetention.ts`) and the erasure re-apply (`erasure.ts`). Core
    (`backend/src/services/warehouseMaintenance.ts`, judged in `opsJobs.ts`)
    reads the last successful and last attempted run of each. The job is
    stale when either step has no success inside 36 hours, when either step's
    last attempt failed (both run every sync, so a failure is a promise not
    kept right now), or when the warehouse cannot be read. That last case also
    carries `unreadable: true`, which `ops-job-watch` refuses as an error, and
    the console names it as unreadable. The notice names each failing step
    and its error;
  - a stalled erasure is a notify condition too: `accountDeletionFailures.stuck`
    counts requests still `processing` with an `account.deletion_step_failed`
    row older than 24 hours (`DELETION_STEP_FAILURE_HOURS`), which means no
    success since;
  - `GET /admin/ops/job-status` (manage_support) and the Reports, Support
    view show each job's last successful run, last attempt and `stale`, and
    name stalled erasures in words; each window (36 hours for every daily
    job) has one home, `OPS_JOB_STALE_HOURS` in
    `backend/src/services/opsJobs.ts`;
  - `.github/workflows/ops-job-watch.yml` (daily, 10:00 UTC) reads the
    status from inside the container, fails when any watched job is stale,
    an erasure has stalled, a retroactive release check is overdue (G.2), an
    elevated grant is due for review (G.4, section 2), a warehouse alert
    notified nobody (H.3, above) or the reply is unreadable, and opens or
    comments on the `ops-watchdog` GitHub issue, so a human is notified;
  - `.github/workflows/content-retro-checks.yml` (weekly, Monday 05:00 UTC)
    runs the retroactive release check itself inside its 30-day window and
    comments on the same issue when a course's verification fails (G.2, see
    `docs/content/FORGE-V2-RELEASE.md`);
  - the simulated-failure drill (`npm --prefix backend run ops:drill`, also a
    unit test) proves, for each of the eleven jobs, that a stale trail produces
    `stale: true`, a failed watcher and the notice (for the badge-image purge,
    a sweep that still runs daily but keeps failing to purge); it also drills a stalled
    erasure, an overdue retroactive check, a due access review and an
    undelivered warehouse alert (`alerts_undelivered`).
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
- **Internal notification chain.** Whoever discovers a suspected security
  incident or breach (a person, a failed watchdog, an alert) notifies these
  roles in this order. Each clock runs from discovery, not from
  confirmation. Every step is recorded on the `ops-watchdog` GitHub issue
  (a new comment, or a new issue labelled `ops-watchdog` titled
  "Incident: ..."), which carries no personal data of any family, only what
  was affected and the time of each step; the direct message or phone call
  is what makes sure a person saw it.
  1. **Owner**: within 1 hour of discovery, by phone call (a direct message
     when the call is not answered) plus the `ops-watchdog` issue. The owner
     is the decision-maker for the whole response.
  2. **Engineering lead**: within 1 hour of discovery, by direct message plus
     the `ops-watchdog` issue; leads containment (step 1 of the baseline).
  3. **Safety/Trust lead**: within 4 hours of discovery, by direct message
     plus the `ops-watchdog` issue; decides severity with Engineering (step 2)
     and owns the family notice.
  4. **Legal**: within 24 hours of discovery, by direct message or phone plus
     a link to the `ops-watchdog` issue; within 4 hours when a minor's data
     may be involved. Legal decides any regulator notice and co-writes the
     family notice with Product.
  A step whose person does not acknowledge within its limit escalates to the
  next role in the chain and to the owner. Nobody outside this chain is told
  before the owner decides, and no personal data travels in chat.
- **Plan review.** This incident-response and breach-notification plan (the
  baseline, the breach notice and the chain above) is reviewed at least once
  a year (366 days at most between reviews) and again after every actual
  incident, as part of its post-mortem. Owner of the review: the Safety/Trust
  lead, with the Engineering lead and Legal. Each review updates the date
  below; `npm run spec:check` (`agent/tools/check-staff-standing-constraints.mjs`)
  fails when the chain, the cadence or the date is missing, or when the date
  is more than 366 days old.
  Last reviewed: 2026-09-29 (GAP-FIX-R5 staff-ops: the chain and the cadence
  were added; the names behind each role are the owner's to confirm).

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

## 7. Post-launch recalibration (Appendix N and O, Part 3 Stage 6)

- **One threshold log for both blocks:**
  `docs/operations/STAFF-OPS-RECALIBRATION-LOG.md`. It lists every Appendix N
  and O Part 1 metric with its kind (release gate, diagnostic or
  documentation), target and code source. It also records the calibration
  values: the G.2 30-day retroactive window, the G.4 90-day access-review
  cadence, the 36-hour watchdog and undelivered-alert windows, the 24-hour
  stalled erasure, and the H.7 age floors. The owner decision log (section 8)
  sends these values through this log.
- **Owners and cadence.** Quarterly for each block:
  - Block G: the Platform Lead reviews access-review compliance, bypass-path
    usage and Audit Log completeness;
  - Block H: the Data/Privacy Lead reviews consent coverage, alert delivery,
    watchdog drill results and retention-policy currency.
  The first human review is due 2026-12-31. This is separate from the
  per-grant access review of section 2.
- **Enforced.** `agent/tools/staff-ops-review-cadence.mjs` runs in `npm run
  spec:check`. It fails when the log drifts from the code: a missing or
  unknown metric, a source that no longer exists, or a calibration value that
  differs from the constant or migration. With `--strict` (release readiness)
  it also fails while either review is overdue.
  `.github/workflows/staff-ops-recalibration-quarterly.yml` opens the
  quarter's `staff-ops-review` issue on 1 January, April, July and October.
  The issue lists every release-gate metric and asks for the quarterly
  simulated job-failure drill (`npm --prefix backend run ops:drill`,
  Appendix O 1.3).
- **Stage 6 rollback rule.** A regression in any of these five metrics is
  rolled back at once, never patched under pressure:
  - the Cosmetic-Permission Regression Test;
  - the Release-Verification Bypass Rate;
  - the Kid-Role Consent Gate Regression Check;
  - the Alert-to-Notification Delivery Rate;
  - Watchdog Coverage.
