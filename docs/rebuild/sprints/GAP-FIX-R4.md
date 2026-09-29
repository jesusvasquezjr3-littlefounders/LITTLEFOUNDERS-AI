# Gap-fix round 4

Lane records for the fourth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F4-staff-ops

Branch `codex/spec-fix4staffops`. Six audited gaps in the staff console,
analytics and operations area. Each was checked in the code first; all six
were real, and a seventh defect surfaced while closing the third (the
content-release proof had gone stale and failed on the current chain).

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | A.5; OD-3 section 2; Appendix M 1.2 and Part 3 Stage 3 | The staff Tutor grant follows the age record. Migration `staff_parent_grant_age_guard`: `account_age_record_is_minor(user)` (service role only) is the one predicate of `guard_parent_verification_age` and `list_minor_record_tutors` (kid role, an `account_safety_origins` row, or an effective band of under 13 or 13 to 17); `grant_parent_role_with_justification` raises `PARENT_GRANT_MINOR_RECORD` before any write; `enforce_parent_role_provenance` applies the same refusal on the staff-marker, ID-verified and re-grant branches (a superuser session without the marker still bypasses, as before). Core maps the refusal to 409 `AGE_RECORD_MINOR`. Roles & Access shows "The age record says under 18. Correct it before granting Tutor." (EN, es-MX, pt-BR) with a link to the age-correction queue | `database/migrations/0235_staff_parent_grant_age_guard.sql`, `backend/src/services/adminData.ts`, `backend/src/routes/admin.ts`, `frontend/src/rebuild/staff/console/StaffAccess.tsx`, `frontend/src/app-routes/staffConsole.tsx`, `frontend/src/i18n/*/rebuild-staff.json` |
| 2 | H.5 (a); Appendix O 1.2; Appendix O Part 3 Stage 3 | The pre-migration restore points of `database-cd.yml` and `tutor-deploy.yml` follow `vault-backup.yml`: the key is written to `$RUNNER_TEMP` and a missing key fails the step (no dump, no migration), the dump is encrypted with `backup-crypto.mjs`, `test -s` checks the ciphertext and manifest and `test ! -e` the plaintext, only the `.lfbk` file and its manifest are uploaded, an `if: always()` step removes the key and every local dump, a prune step ages `pre-migration-*.dump.lfbk*` out after 30 days and deletes the old plaintext `pre-migration-*.dump` files once the encrypted point is stored. `backup-workflows.test.mjs` now discovers every workflow that writes to `/data/backups` by grep (four today) and reads each one's dump prefix from its own `FILE=` line; a synthetic new plaintext workflow is shown to fail | `.github/workflows/database-cd.yml`, `.github/workflows/tutor-deploy.yml`, `agent/tools/backup-workflows.test.mjs`, `docs/operations/BACKUP-RESTORE-ROLLBACK.md` section 1, `docs/operations/GOVERNANCE.md` section 5 |
| 3 | Appendix N 1.1, 1.2, 2.3(a)/(b), Part 3 Stage 2; Appendix O 1.1, 2.2(b), Part 3 Stage 2 | `database/scripts/staff-analytics-db-verify.mjs` (on `pg-verify-runner.mjs`, `LF_PG_FULL_CHAIN=1`) runs the Block G/H verifiers: staff-ops, content-release, data-platform, course-publish, admin-permissions, analytics-disclosure, analytics and the release-audit proof (mentor-quality-audits, found unwired too). Its self-test fails when a verifier citing G.x/H.x or staff-ops is left out, when one hardcodes a port or the audit cluster's psql, applies less than the whole chain or hand-writes a production table, and when CI or readiness stops calling it. `verify-admin-permissions-postgres.py`, `verify-analytics-postgres.py` and `verify-course-publish-postgres.py` were rewritten on the shared shim over the whole chain (they had tested hand-written tables and one migration each) and honour `LF_PG_PSQL`/`LF_PG_PORT`/`LF_PG_USER`; the analytics proof gains the kid-role case (unconsented dropped, consented admitted, revoked dropped, under 13 never admitted even with consent). `verify-content-release-postgres.py` had gone stale (it listed the v2 manifest gates by number and failed on the current chain); it now reads them from `forge_v2_manifest_gates`. Wired into the root script `staff:db-verify`, a `staff-db-verify` job in `database-ci.yml` and in `repo-gates.yml`, `release-readiness.sh` after `family:db-verify`, and the runner's test into `database` `npm test` | `database/scripts/staff-analytics-db-verify.mjs` (+ `.test.mjs`), `database/scripts/verify-*.py` (four), `.github/workflows/database-ci.yml`, `.github/workflows/repo-gates.yml`, `agent/tools/release-readiness.sh`, `package.json`, `database/package.json` |
| 4 | G.1; Appendix N 2.1(2), 2.2(b)-(c), 1.1, 1.2 note | Migration `generation_live_manage_content` recreates `staff_select_live` on `generation_runs_live`: a superadmin, or an admin who holds `manage_content`. `createLiveFeed` takes the viewer and never subscribes (never even builds the client) without `manage_content`. The native proof covers five admins (no grant, only view_analytics, only manage_support, only manage_users read 0 rows; manage_content reads it), the superadmin, anon, revoke-then-regrant on the next query, losing the admin role, no browser write, and shows the original 0019 policy leaking to the analyst before the fix migration closes it. Database types need no regeneration (policy only) | `database/migrations/0236_generation_live_manage_content.sql`, `database/scripts/verify-admin-permissions-postgres.py`, `frontend/src/app-routes/staffLiveFeed.ts`, `frontend/src/app-routes/staffConsole.tsx`, `frontend/src/lib/supabaseRealtime.ts` |
| 5 | Bible 02 section 1.2, rule 16; 06 section 5 rule 7; 02 D8 | Core's coach returns each proposed action as `{ tag, params }` only (`cost:cache {cacheHitPct, wastedUsd}`, `judge:<dim> {dimension, mean, min, n}`, `failure:stage {stage, count, total}`, `cost:perLesson {usdPerLesson, totalUsd, published, inherited, billed}`); a missing run counter is zero, never NaN. The console composes a localized label (`option` role), the proposal and one or two evidence lines (`body` role) from new `rebuild-staff.json` keys in three locales, numbers through Intl, and drops a tag it does not know | `backend/src/services/adminData.ts`, `frontend/src/rebuild/staff/console/generationApi.ts`, `StaffGeneration.tsx`, `staffSectionFixtures.json`, `frontend/src/i18n/*/rebuild-staff.json` |
| 6 | Bible 02 D1 and section 7 rule 1, rules 11 and 16, section 1.2, D8 | The analytics report PDF: `fitLabel` and every `ellipsis` option are gone; breakdown rows grow with the wrapped label; composition cards grow with their rows and hold up to five while under 320 pt (a row that would pass it is left out with every later row, keeping the ranking; the full tables below list every row); KPI cards, the header, section subtitles (now on their own line), the own-audience grid and the caveats measure their wrapped text. Every text is at least `TEXT` = 10.5 pt (the 14 px floor). The em-dash strings are rewritten in all three locales, the document title too; an empty label prints the locale's word (`none`/`ninguno`/`nenhum`); "No data for this period." is localized; bounce rate and changes format through Intl. The CSV/XLSX caveats and first-party notes carry no em dash | `backend/src/services/analyticsReport.ts`, `backend/src/services/analyticsExport.ts` |

### Verification (local)

- Native PostgreSQL 17.6 (lane cluster, port 15610, all 236 migrations):
  `staff:db-verify` 8/8 verifiers pass (content-release after its fix, rerun
  alone through the runner). New checks: `verify-staff-ops-postgres.py` 24
  checks (a staff grant to a flagged guest, an upgraded flagged account, a
  declared teen, a declared under-13 and a kid is refused with no role and no
  audit row; the trigger refuses them on the staff-marker and re-grant
  branches; a declared adult and a teen made 18 by birth month still pass;
  the predicate is service-role only); `verify-admin-permissions-postgres.py`
  7; `verify-analytics-postgres.py` 6; `verify-course-publish-postgres.py` 7.
- Core: type-check and lint; focused vitest `admin.test.ts` and
  `verificationAdmin.test.ts` (109; new: a minor-record grant answers 409
  `AGE_RECORD_MINOR` with one RPC and no direct role or audit write, other
  refusals stay `ROLE_REJECTED`, an adult is granted), `admin-generation.test.ts`
  (10; new: the coach returns tags and numbers only, no Spanish prose, no em
  dash), `analytics-report-pdf.test.ts`, `analyticsReportTokens.test.ts`,
  `analytics-export.test.ts`, `analytics-range-integrity.test.ts` (50; new:
  in each locale every drawn string and every font size of a worst-case
  report is recorded: the long label is drawn whole in the card and the
  table, no ellipsis, em dash or "(none)", the locale's word for an empty
  label, no size under 10.5 pt; no CSV or XLSX cell has an em dash).
- Frontend: type-check; eslint on touched files; vitest `src/rebuild/staff`,
  the staff copy budget and `staffLiveFeed.test.ts` (164; new: a minor-record
  refusal shows the three-locale notice and the age-correction link; the
  coach renders localized, `body`/`option` roles, an unknown tag dropped; the
  live feed is never attempted without manage_content).
- Root: `spec:check`, `secrets:check`, `check-i18n.sh`, `tools:test` (447 at
  the item-2 commit), `backup-workflows.test.mjs` 8, database checks and the
  node tests of `database` `npm test` file by file (od9 and railway-migrate
  untouched and not rerun).
- Looked at: the rendered es-MX report PDF with a 250-character label, an
  empty label and 13 page rows (pages 1-3). The first card layout left a
  card empty behind one long label; the cards now grow with their rows.
- Not run here (orchestrator, per merge): browser matrices, `audit:rebuild`,
  full suites. No screenshot of Roles & Access or the Coach.

### Decisions taken with the SPEC's conservative default (owner questions)

- The old plaintext `pre-migration-*.dump` files are deleted on the next
  migrating run, after its encrypted restore point is stored, not aged out
  over 30 days: keeping plaintext production dumps is the Critical gap
  Appendix O 1.2 names, and the daily encrypted backups hold every later
  state. The document also gives the one-line manual cleanup for the owner.
- An under-13 kid-role account's optional events are never admitted, even
  with a guardian consent, because declaring under 13 marks the origin. The
  proof pins this as the current behaviour (it matches the FAQ's "Under 13,
  we never collect usage data").
- The age refusal also applies on the ID-verified branch of
  `enforce_parent_role_provenance`, not only the two branches the audit
  named: one predicate for every path.

### Migrations (the orchestrator renumbers at merge)

- `0235_staff_parent_grant_age_guard.sql` (`@phase: expand`)
- `0236_generation_live_manage_content.sql` (`@phase: expand`)

### Open items

- Production: the `BACKUP_ENCRYPTION_KEY` secret must exist before either
  migrating workflow runs, or the migration stops at the dump (by design).
- Acceptance and release of every row touched (A.5, G.1, G.2, G.3, H.1, H.5).
- The Coach and Roles & Access notices were verified by unit tests, not by a
  screenshot.

## Checkpoint F4-staff-ops-finish (lane finish)

### Summary

The staff-ops lane closed its six audited gaps (A.5 / OD-3 section 2 staff
Tutor grant; H.5 (a) encrypted pre-migration restore points; Appendix N/O
database proofs wired into CI and release readiness; G.1 Generation live
table gated on `manage_content`; the localized Generation coach; the
analytics report PDF that never cuts text) plus the stale content-release
proof found on the way. Details are in the checkpoint above.

### Finish steps

- Sync: `codex/spec-migration-s02` was already contained in the lane branch
  (head `14232a10`); the merge was a no-op, no conflicts.
- Adversarial pass over the lane's seven commits against the six gaps:
  server enforcement holds on every path (the grant refusal is in the
  database function and the provenance trigger, and Core maps it to 409
  `AGE_RECORD_MINOR`; the live table is gated by RLS, not only by the
  client, and `createLiveFeed` refuses without `manage_content`; the coach
  route stays behind `manage_content`). The rebuilt screens use only
  `rebuild/design/controls` and `ConsoleParts` (no legacy component), every
  new element carries `data-copy-role`, and each new key exists in EN,
  es-MX and pt-BR. Both migrations are under 23,000 bytes (6,949 and 1,966)
  with a truthful `@phase: expand`. Nothing mandated was found missing, so
  no code changed at the finish.

### Verification at the finish

- Backend: `type-check`, `lint`, full vitest suite: 151 files, 3,486 tests
  pass, 1 skipped.
- Frontend: `type-check`, `lint` (whole package), full vitest suite: 275 of
  276 files pass. `src/rebuild/assets/assetGate.test.ts` (untouched by the
  lane) timed out three cases at 90 s while other lanes' suites ran on the
  machine; rerun alone it passes 13 of 13.
- Database: `npm test` checks and node tests pass (59 of 59, including the
  staff-analytics runner self-test), and
  `railway-migrate.test.mjs` passes its 12 transport scenarios against the
  fake Railway CLI (about 50 minutes on Windows with other lanes running).
- Root: `spec:check`, `secrets:check`, `check-i18n.sh`, `tools:test`
  (447 of 447).
- Not run here (orchestrator, per merge): browser matrices, `audit:rebuild`,
  root `test:all`, a screenshot of Roles & Access and the Coach.

### Still open

- Owner: create the `BACKUP_ENCRYPTION_KEY` secret before `database-cd.yml`
  or `tutor-deploy.yml` runs a migration (without it the migration stops at
  the dump, by design); the one-line manual cleanup of plaintext
  pre-migration dumps already on the volume (BACKUP-RESTORE-ROLLBACK.md).
- Deploy order: `staff_parent_grant_age_guard` may go before or after Core
  (an older Core answers 409 `ROLE_REJECTED` for the refusal);
  `generation_live_manage_content` narrows the live table's readers, and
  the new frontend already stops subscribing without `manage_content`.
- Acceptance and release of rows A.5, G.1, G.2, G.3, H.1 and H.5.
- The orchestrator renumbers 0235/0236 at merge; the verifiers and the
  runner's test find them by name pattern, not number.
