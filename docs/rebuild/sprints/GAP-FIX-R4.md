# Gap-fix round 4

Lane records for the fourth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F4-identity-site

Branch `codex/spec-fix4identity`. Two audited gaps. Both were checked in the
code first and both were real, with one correction to the audit: the Block A
proof it named for the optional-event trigger, `verify-origin-postgres.py`,
never exercised `guard_optional_learning_event`. It applied 0085 to 0089 to a
hand-written schema, hardcoded port 15483 and the audit cluster's data
directory, and so could not run under any gate. The only proof of the trigger
(`verify-analytics-postgres.py`) was also a hand-written 0090-era schema,
while production runs the 0182 definition.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | Appendix M Part 2.1 criterion 2, Part 3 Stage 2, 1.1 (Unconsented Analytics Event Rate, flagged sessions), 1.3 (Unauthorized Kid-Role Email-Change Attempt Rate, every release); A.2, A.4, A.5, A.6 | `identity-db-verify.mjs` on the shared `pg-verify-runner.mjs` runs six verifiers over the WHOLE migration chain (`LF_PG_FULL_CHAIN=1`): origin (rewritten), kid email guard, staff ops, age correction, age birth month, kid username change. `verify-origin-postgres.py` is rewritten on the full chain and the shared `LF_PG_*` harness and now proves, against the latest definitions: the origin (concurrent marks, upgrade persistence, browser and service-role denials, deletion cascade), the first-wins age declaration with its atomic origin mark and rollback, the profile birth-date trigger (even with a table grant), the Mentor calibration, the teen analytics choice, and the optional-event trigger over 12 refused populations (every flagged-origin account whatever its band, opt-in or guardian consent; guests; a child without or with revoked consent; an under-13 declared child; a teen without or against an opt-in; no declaration; no role) and 3 admitted ones, an account flagged after an admitted event, the Family Hub admission, audit logs kept, and a teen made adult by birth month keeping an earlier "no". A mutation run (the trigger with its origin line removed) fails the verifier. `verify-age-birth-month-postgres.py` honours `LF_PG_FULL_CHAIN` (it stopped at its own migration) and expects the adult tier before promotion once `effective_age_band` exists. Wired into `npm run identity:db-verify` (root and database), an `identity-db-verify` job in `database-ci.yml` (so a weakening migration cannot auto-apply) and in the unfiltered `repo-gates.yml`, and `release-readiness.sh`. `IDENTITY_ADVERSARIAL` names the gate for `flagged_session_unconsented_analytics` and adds the kid-email database proof to `kid_email_change_unauthorized`. `identity-db-verify.test.mjs` (in `database` `npm test`) pins the list, twelve Block A database guards to the verifier and refusal that proves each, whole-chain application, the CI, repo-gate and release wiring, and the staff report entries | `database/scripts/identity-db-verify.mjs` (+ test), `verify-origin-postgres.py`, `verify-age-birth-month-postgres.py`, `pg-verify-runner.mjs`, `package.json`, `database/package.json`, `.github/workflows/database-ci.yml`, `.github/workflows/repo-gates.yml`, `agent/tools/release-readiness.sh`, `backend/src/services/identityMetrics.ts` |
| 2 | OD-6; Bible 02 D10 and section 1.1 (the AI is the Mentor); rule 16 (no em dash); section 1.2 (three locales) | The llms brief says "Four characters guide the lessons: Dina, Liruf, Dr. Rho, Zara. The Mentor holds a real conversation..." and names the Tutor as the verified parent; no em dash in the brief, the subjects list or the robots.txt header. `renderLlmsTxt`, `renderLlmsFullTxt` and `loadMarketing` are exported (the build runs `main()` only when invoked directly). `check-seo-surface.mjs` gains `auditAgentText` (em dash, lowercase "tutor", "AI Tutor") run over both rendered files in all three locales by `npm run seo:check`; its test asserts the real output and that each rule fires. The legacy badge unfurl takes its title, description and `og:locale` from a three-locale table (`BADGE_UNFURL_COPY`) keyed by the payload's `locale`, no em dash, en-US for a missing or unknown one. Core's `GET /badges/:token` now returns that `locale`: legacy rows store none, so it reads only the `locale` column of the sharing Tutor's profile, then the child's, and answers one of the three locales (en-US otherwise, and on a failed read the share is still served) | `frontend/scripts/seo/build-seo.mjs`, `agent/tools/check-seo-surface.mjs` (+ test), `frontend/api/badge/[token].ts`, `frontend/src/badgeEdge.test.ts`, `backend/src/routes/badgePublic.ts`, `backend/src/services/supabaseRest.ts`, `backend/src/__tests__/badgePublic.test.ts` |

### Verification (local)

- `npm run identity:db-verify` on the lane's native PostgreSQL 17.6 cluster
  (`.lane-cache/pg`, port 15600): 6/6 verifiers pass over all 234
  migrations (birth month re-run alone after the tier fix). The birth-month
  verifier also passes through its own migration only (no full chain).
- `database` `npm test` gates and node tests (60, the family and identity
  runner self-tests included); `scripts/railway-migrate.test.mjs` did not
  finish on this machine within the checkpoint (its fake-transport runs of
  `railway-migrate.sh` also hung in another lane's worktree; the file is
  untouched here), so it is left to the merge gates. `node --test
  agent/tools/check-seo-surface.test.mjs` (20), `npm run seo:check`,
  `tools:test` (444), backend `badgePublic.test.ts` (10), frontend
  `badgeEdge.test.ts` (9); backend and frontend `type-check` and `lint`; root
  `spec:check`, `secrets:check`, `sharing:check` and the i18n gate.

### Remaining

- CI has not run the new jobs yet; the first `identity-db-verify` run on a
  GitHub runner is the evidence that the external-cluster path works for
  these six verifiers (the family and social jobs use the same harness).
- `verify-analytics-postgres.py` (H.1 concurrency on a hand-written 0090-era
  schema) is left as it was and outside every gate; its population checks are
  superseded by the full-chain origin proof, its lock-ordering race is not.
- The badge unfurl locale is a best reading: a legacy row never stored the
  locale its label was written in. Links retire on 24 October 2026.
- Acceptance: Trust review of the identity gate list; nothing is accepted.

### Owner questions

- None blocking. Default taken: the unfurl reads the sharing Tutor's profile
  locale, then the child's, rather than adding a column no new row would fill
  (OD-20 issues no new links).

## Checkpoint F4-identity-site-finish

Lane finish. The worktree was clean; `codex/spec-migration-s02` was already
merged (no conflicts). Adversarial pass over the lane commit against the two
audited gaps: nothing mandated was missing from Gap 2 (the llms brief, the
seo:check audit and the badge unfurl already cover all three locales, and the
locale read is server-side and returns one of three values only). Gap 1 had
one open proof, the H.1 concurrency race, which lived only in the hand-written
`verify-analytics-postgres.py` outside every gate. It is now proven on the
whole chain.

### What was built

| SPEC clause | What was built | Where |
|---|---|---|
| Appendix M 1.1 (flagged sessions), A.2, H.1 | `verify-origin-postgres.py` runs four races on the whole migration chain, each with an observed lock wait (`pg_blocking_pids`): an event behind a teen revocation is refused; a revocation behind an admitted event waits for it to commit; an event behind an under-13 origin mark is refused; a mark behind an admitted event waits for it. No optional event commits after the "no" or the flag is acknowledged. `identity-db-verify.test.mjs` pins the lock each writer takes (the guard's `FOR UPDATE`, the teen choice and the declaration locking the account row, the origin's foreign key to `auth.users`) and the four races | `database/scripts/verify-origin-postgres.py`, `database/scripts/identity-db-verify.test.mjs` |

A correction to my own first reading: I suspected that `mark_under13_origin`,
which Core calls directly at sign-up, did not serialize with the event guard,
and wrote a migration to make it take the row lock. The chain WITHOUT that
migration passed the new race, because the origin's foreign key check takes a
KEY SHARE lock on the same `auth.users` row, and that conflicts with the
guard's `FOR UPDATE`. The migration was redundant and was dropped (no
migration in this checkpoint). The self-test now pins that foreign key as the
serialization.

### Verification (local)

- Lane cluster (native PostgreSQL 17.6, `.lane-cache/pg`, port 15600):
  `npm run identity:db-verify` 6/6 verifiers pass over the whole chain
  (origin now 14 checks, two of them the four races). Mutation: with the
  guard's `FOR UPDATE` removed from 0182, the origin verifier fails at the
  first race ("an event racing a revocation was admitted").
- `database` gates and node tests 61/61 (identity self-test 7/7);
  `railway-migrate.test.mjs` again did not finish within 15 minutes (hang,
  untouched here, as in F4-identity-site).
- Backend `type-check`, `lint`, full suite: 3480 passed, 1 skipped.
- Frontend `type-check`, `lint`, full suite: 3189 passed, 6 failed, all six
  in `src/rebuild/assets/assetGate.test.ts` by 90-second timeouts while the
  machine ran at 85% CPU with other lanes. Untouched by this lane; the gate
  itself (`node scripts/check-rebuild-assets.mjs`) passes when run directly.
  A lone rerun of the file did not finish in 15 minutes under the same load,
  so it is left to the merge gates.
- Root `tools:test`: 416 of 418 in the loaded run; the two reds
  (`check-social-tiers`, `railway-preflight`, both untouched) pass alone
  (48/48 with `check-seo-surface`). Root `spec:check` and `secrets:check`
  pass.

### Remaining

- Carried over from F4-identity-site: the first GitHub-runner run of the
  `identity-db-verify` jobs; `railway-migrate.test.mjs` left to the merge
  gates; the badge unfurl locale is a best reading of legacy rows.
- `assetGate.test.ts` (frontend) to be confirmed by the merge gates on a
  quieter machine.
- `verify-analytics-postgres.py` is kept only as S01 history (it is the
  evidence that record cites); its races and populations are now superseded
  by the full-chain origin proof.
- Acceptance: Trust review of the identity gate list. Nothing is accepted.

### Owner questions

- None.

### Merge integration (F4-identity-site into `codex/spec-migration-s02`)

- The lane branched from the integration head (`14232a10`), so the merge had
  no conflicts and no auto-merged file needed a semantic fix.
- Migrations: none added by the lane, so no renumbering. The integration
  branch's highest migration stays `0234`.
- Integration defects found: none. On the merged tree `typecheck:all`,
  `lint:all`, the backend (3,480 tests) and frontend (276 files, 3,195 tests,
  `assetGate.test.ts` included) unit suites, `spec:check` (S03 design gates,
  S05/S08 gates, OD-28 Wallet glossary), `secrets:check`, `seo:check`,
  `tools:test` (444 tests) and the i18n gate pass. In `database`'s
  `npm test`, `check-migrations`, `check-migration-phase`,
  `check-family-lifecycle` and the 61 `node --test` cases pass, including
  `identity-db-verify.test.mjs`. `npm run identity:db-verify` on a throwaway
  portable PostgreSQL 17 cluster over the whole 234-migration chain: 6/6
  verifiers pass.
- `railway-migrate.test.mjs` (unchanged by this lane) passes: all 12
  transport scenarios and the static cross-checks, run alone on a quiet
  machine. It is slow, not hung: it took 1,393 seconds (about 23 minutes)
  here, each `--confirm-production` scenario walking every migration through
  the fake Railway transport. Earlier runs that were stopped at 10 to 15
  minutes, in this round and in round 3, were stopped before it finished.
- Still open for the orchestrator: browser matrices and `test:all`; the first
  GitHub-runner run of the `identity-db-verify` jobs.

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

### Merge integration (F4-staff-ops into `codex/spec-migration-s02`)

- Base: the lane branched from `14232a10`; the integration head had since
  taken F4-identity-site (`7680248c`). Seven files conflicted, all because
  both lanes wired a new database gate into the same places. Each was
  resolved as the union: `database-ci.yml` and `repo-gates.yml` keep both the
  `identity-db-verify` and the `staff-db-verify` jobs; root and `database`
  `package.json` keep both `identity:db-verify` and `staff:db-verify`, and
  `database`'s `npm test` runs both runner self-tests; `release-readiness.sh`
  runs `identity:db-verify` then `staff:db-verify`; the REQUIREMENTS A.5 row
  keeps both lanes' evidence and checkpoint links (A.6 kept the identity
  lane's text, the lane had not changed it); this record keeps both lanes'
  sections.
- Migrations: the integration branch's highest was still `0234`, so the
  lane's `0235_staff_parent_grant_age_guard.sql` and
  `0236_generation_live_manage_content.sql` keep their numbers. No
  renumbering, no bare old-number mentions to fix. Neither lane redefines a
  function or policy the other changed (the identity lane added no
  migration). Both files stay far under 23,000 bytes.
- Integration defect 1: `staff-analytics-db-verify.test.mjs` failed on the
  merged tree. The identity lane rewrote `verify-origin-postgres.py`, whose
  docstring now opens with "A.2 / A.4 / H.1", and the staff runner test
  requires every verifier that cites a Block G/H clause to be in
  `BLOCK_GH`. The test was right: the optional-event admission trigger is
  the database half of the H.1 / Appendix O 1.1 kid consent gate. Fix:
  `verify-origin-postgres.py` joins `BLOCK_GH` (it already runs in
  `identity:db-verify`, the same way `verify-staff-ops-postgres.py` runs in
  both gates).
- Integration defect 2: that surfaced a too-literal check in the same test.
  "The gate runs the whole chain" matched only the idiom
  `migrations = sorted(...)` immediately followed by the loop;
  `verify-origin-postgres.py` builds a module-level `MIGRATIONS = sorted(...)`
  and loops over it later. The regex now accepts either idiom through a
  backreference to the same name, and still refuses a sliced list
  (`sorted(...)[:5]`) or a sliced loop (`MIGRATIONS[:90]`); checked against
  both refusal cases.
- Verification on the merged tree: `typecheck:all`, `lint:all`, backend
  (152 files, 3,489 tests passed, 1 skipped), frontend (276 files, 3,197
  tests, `assetGate.test.ts` included), `spec:check` (S03 design gates,
  S05/S08 gates, OD-28 Wallet glossary, minor safeguards), `secrets:check`,
  the i18n gate and `tools:test` (449 tests) pass. `database` `npm test`:
  the migration, phase and lifecycle checks over 236 files and the 66
  `node --test` cases pass, both runner self-tests included, and so does
  `railway-migrate.test.mjs` (12 transport scenarios). On a throwaway
  portable PostgreSQL 17 cluster over the whole 236-migration chain:
  `staff:db-verify` 9/9 and `identity:db-verify` 6/6 pass.
- Still open for the orchestrator: browser matrices, `test:all`, and the
  first GitHub-runner run of both database-proof jobs.

## Checkpoint F4-learning

Branch `codex/spec-fix4learning`. Eleven audited SPEC gaps in the learning
area. Each was checked in the code first; all eleven were real (the code
matched the audit's description). Built under the project leader's speed
mode (27 September 2026): complete features, lean verification, full gates at
merge.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | Appendix C 1.1 (Delayed Retention, Time-to-Mastery); 2.1 criterion 3; B.6 | `learning_delayed_retention(since, until, mastery)`: per KC and per 30/60/90-day window, the first spaced review (`review_tier = 'spaced'`, Mentor or course lesson) of a learner's memory card after the learner first reached the mastery bar, and how many were right. `learning.delayed_retention` reads it (no longer `admin_retention_at_distance`) with a new `release_non_decline` threshold: each KC x window of the current release is compared with the latest recorded release (`learning_retention_release_baseline`, frozen by `record_learning_retention_release` / `npm --prefix backend run learning:retention-release`); the first recorded release is the baseline (its row waits in THRESHOLD-RECALIBRATION-LOG.md). Time-to-Mastery reads every evidence source and breaks down per KC and per age band (`learning_kc_learner_age_bands`, bands only). The staff Mentor-quality dashboard lists both breakdowns (three locales) | `database/migrations/0237_learning_delayed_retention.sql`; `backend/src/services/pedagogy/mentorQuality.ts`, `evaluationLoop.ts`; `backend/src/scripts/retention-release.ts`; `frontend/src/rebuild/staff/MentorQualityDashboard.tsx`; THRESHOLD-RECALIBRATION-LOG.md |
| 2 | Appendix C 1.2 (Session Efficiency Ratio); B.28; Appendix P 7.5 | v2 time on task as an analytics field only: optional `time_spent_seconds` (0-7200) on the v2 grade and view routes, written after the receipt or view exists by `record_v2_time_on_task` (set once, own rows only); `learning_session_efficiency` sums v1 attempts plus v2 receipts and views, capped at the day's session time. The lesson route sends an idle-capped time per step (`timeOnTask.ts`: a gap between activity counts at most 60 s, hidden time never) | `0238_v2_time_on_task.sql`; `backend/src/routes/learn.ts`, `supabaseRest.ts`; `frontend/src/rebuild/learning/timeOnTask.ts`, `routes/app/learn/LessonRoute.tsx` |
| 3 | Appendix C 2.2 B.1 (b)/(c); 2.1 criterion 2 | `placement.postgres.test.ts` is portable (LF_PG_*, or a throwaway cluster), prepares the whole chain, and drives Core's routes for all four methods (adaptive_quiz with a lost response, learner_chose_start, learner_adjusted, no_probe_content_fallback), each asserting commit, credits, progress and badge attainability; under CI with no cluster it fails. backend-ci.yml runs it on postgres:17. `learning-db-verify.mjs` (shared runner) runs placement, v2 learning, learning rounds 2-4, OD-25 pathway, completion and course publish over the whole chain; database-ci.yml gains the `learning-db-verify` job; release readiness calls it. Placement and course-publish verifiers gain a full-chain mode; completion reads LF_PG_*; the whole chain found `verify-v2-learning`'s manifest gate list stale since the carried gates (now read from `forge_v2_manifest_gates`). `verify-grade-postgres.py` needs a full Supabase stack and is listed with that reason | `backend/src/__tests__/placement.postgres.test.ts`; `database/scripts/learning-db-verify*.mjs`, `pg-verify-runner.mjs`, `verify-*.py`; `.github/workflows/backend-ci.yml`, `database-ci.yml`; `agent/tools/release-readiness.sh` |
| 4 | Appendix P Parts 1-3 ages, 4.10; Bible 05 §7; B.23; OD-16 | `V2_AGE_SCOPE` rows for M2, L1, L5, L6, $9, L10, $10, L12, $11, $1, $2; `v2PayloadScopeProblem` adds: 6-9 flowchart walks at most 3 decisions; 10-12 rule builders at most 2 inputs; L1 abstract/causal rules (`rule_kind`) from 13; L5 nesting, diagram choice and occupancy from 10, syllogisms from 13; L10 6-9 single-rule sorts (no switch, no "it depends"). Forge emits with a byte copy of Core's families (sync-v2-segment-families) and blocks three new red-team plans on gate 1; the 6-9 coin tray and making change moved to the new young-money fixture (plan 42); plan 43 adds the teen syllogism and abstract rule | `backend/src/services/v2SegmentFamilies.ts` (+ browser and Forge copies); `coursegen/src/v2/emit.ts`; `coursegen/src/v2/fixtures/plans/42-*.json`, `43-*.json`, `red-team/scope0*.json` |
| 5 | Appendix P L5, L10; 4.1; Bible 05 §4 | Euler: `choose_relation` + `sentence` (the rubric holds the relation), `mark_occupancy` (rubric `occupied`), 13+ `conclusion` (necessarily / possibly / never); graded in order structure, placement, `occupancy`, `conclusion`. Sort: `switch_after` + `second_rule` + `second_bins`, graded per phase (`rule_switch` a structure error). New codes in the receipt CHECK and the error split (0239); the staff panel names them. Behaviour gate enumerates every diagram, flag set and conclusion, and both phases. Boards: pointer drag onto regions and bins, tap the chip then the place, and one "Move to…" menu (the shared WAI-ARIA menu) for the picked-up item | `v2VisualScorer.ts`, `forgeV2Behaviour.ts`; `0239_v2_euler_sort_diagnostics.sql`; `familyBoards.tsx`, `segmentKit.tsx` (`useDragPlace`, `MoveToChoice`); `design/display.tsx` (`ChoiceChip` drag); `LearningQualityPanel.tsx` |
| 6 | Bible 05 §2, §7 Money; Appendix P $1, $2 | The coin tray draws with `CoinGroupsVisual`: reward coins with the ridge outline and notes as a simplified reward token, one pile per denomination filling as the steppers change; the $2 count-up sits beside the tray. The mint and sky borders are gone | `familyBoards.tsx`, `familyBoards.css`, `pizarron/visuals.tsx`, `pizarron.css` |
| 7 | Bible 05 §3, §5, §6 | `BoardShell` has a control strip with Reset (restore and disabled state per board) on every family, build and concept board; every concept chart has Show as table (`ChartOrTable`, locale-formatted tables); concept word labels are HTML; interactive pictures are groups with an `aria-hidden` drawing, the handles pointer-only (`DragPoint presentational`) and the steppers the accessible path | `segmentKit.tsx`, `conceptBoards.tsx`, `buildBoards.tsx`, `operations/operations.tsx`, `pizarron/conceptVisuals.tsx` |
| 8 | Appendix P 8 DoD; Bible 05 §8; CLAUDE.md audits | Preview `fixture` screen stages one Forge fixture segment as a lesson (`?seg=`); 36 lane states cover every kind that had none (logic, money, story, Mentor, unit price, decide-justify, one chart per chart group, all eight concept boards). Findings fixed: 48 px chips, off-scale 17 px plate text, flowchart and inline-stepper tap gaps, bar and lane mark contrast, the concept line draw animation, chart labels re-fitted after WCAG spacing, and first-view copy (one Move-to menu per board, cues after flagging, shorter fixture copy) | `preview/registry/learn.tsx`, `preview/fixtures/v2FixtureDocuments.generated.json` (`agent/tools/sync-v2-preview-fixtures.mjs`, in spec:check); `scripts/audits/lanes/learn.mjs`; the CSS and board files above; `charts/TeachingChart.tsx` |
| 9 | B.7; Bible 05 V1 | Euler through `VennVisual` (now overlap, subset and disjoint, with a neither region and drop targets), sort through `SortBinsVisual`, coin tray through `CoinGroupsVisual`, rule cards through `TextCardsVisual`; the inflation, rule-of-72 and debt lines through `GrowthLinesVisual` (threshold line, marker, fixed scale); new shared `SupplyDemandVisual`, `RiskReturnVisual`, `StackedColumnsVisual`. Tests pin one component per concept on both surfaces and no inline SVG in the family, build and concept boards | `pizarron/*`, `familyBoards.tsx`, `conceptBoards.tsx`, `operations.tsx`; `oneComponentSet.test.tsx`, `mentor/screen/__tests__/boardVisuals.test.tsx` |
| 10 | Appendix P 5; Bible 05 §5 | `pluralUnit` / `pluralAmount` (Intl.PluralRules by CLDR category, "other" fallback) on every board unit, the concept money formatter and the rhythm view; pt-BR 0 takes "one" | `design/plural.ts` |
| 11 | OD-28; V-12; OD-7/B.20; OD-24 | The v1 results screen mounts the shared `Celebration` + `MotionAsset` confetti for Core's lesson-complete in a medal register; static frame under reduced motion or a revisit; nothing otherwise. Celebration budget and asset gate pins name the v1 player | `lesson-engine/player/LessonPlayer.tsx`; `celebrationBudget.test.ts`, `assetGate.test.ts`, `celebrationResults.test.tsx` |

### Verification (local)

- Native PostgreSQL 17.6 (lane cluster, port 15620): `verify-learning-r4-postgres.py` (8 checks: retention windows per KC, release freezing and chaining, service-role only, age bands, time on task set once and bounded, the new codes and the error split, efficiency counting v2); `learning-db-verify.mjs` ran all 8 verifiers over the whole chain (7 passed first; `verify-v2-learning` failed on its stale gate list, fixed and rerun green); `verify-learning-r3` rerun green on the new CHECK.
- Placement E2E (`placement.postgres.test.ts`) against the lane cluster: 4/4 methods pass (about 7 minutes on this Windows machine, most of it applying the chain).
- Core: forge-v2:check 129 rows, 231/231 graded segments pass the behaviour gate; focused vitest (mentor quality, evaluation loop, learning signals, v2 mixed routes, age scope, logic active parts, scorers, learn, pathway, forge); type-check and lint clean.
- Forge: v2 emit, release and carried-gate tests; red team blocks every sample on its own gate; type-check and lint clean.
- Frontend: learning, design, copy-budget, mentor screen, staff, lesson route, v1 player tests (about 1,000 tests); type-check and lint clean. Audit of the 36 new states (text fit, proportion, copy budget) at en-US/light/375: clean after the fixes above. The same 36 states over the full matrix (3 locales, 2 themes, 4 widths, +40% text, WCAG 1.4.12 spacing) found two more classes, both fixed and rerun clean on their states: an org-chart tag 1 px wider than its lane (the chart refit now checks the range width) and the rule-card measure above 75 characters at 768/1280 px (cards capped at 48ch). The final full-matrix rerun of every state together is left to the orchestrator's merge audit.
- Root: spec:check (with the new preview-fixture parity), secrets:check, i18n gate; database migration and phase checks and the runner self-tests.
- Not run here (orchestrator, per merge): full suites, browser matrices, `audit:rebuild` over every lane.

### Decisions taken with the SPEC's conservative default (owner questions)

1. **Delayed Retention windows and decline rule.** Windows are [30, 60), [60, 90) and [90, 120) days after the first mastery (posterior 0.85); the first spaced review in a window counts. A decline is a fall of more than 0.05 below the latest recorded release, judged only with 20+ learners on both sides. Proposed, pending calibration.
2. **Release baseline.** Releases are frozen by an operator at release time (`learning:retention-release`); the release-1 baseline row stays pending until the first production release.
3. **Time on task.** An idle gap counts at most 60 s; reading time on a step with no Check or Continue record counts toward the next recorded step.
4. **Adults.** The logic tasks (L1, L5, L6/$9) and scam spotting (L12/$11) open to the adult pathway, following Appendix P's evidence column.
5. **Bible 05 §7 "2 inputs for 10-12"** is applied to the L2 rule builder (at most two conditions); Appendix P sets no 10-12 cap on flowchart walks, so none was added.
6. **L5/L10 gates.** Nesting, choosing the diagram and occupancy flags from 10; syllogism conclusions from 13 (and adults). L10 has no rule switch and no "it depends" bin at 6-9; $10 keeps "it depends" at 6-9 as Appendix P $10 says.
7. **Coin trays** may still show a market's real money to children (Appendix P $1 recognition tasks); ratio and unit-price boards keep coins for children.
8. **One "Move to…" menu per board**, acting on the picked-up item, replaces one set of regions per item (the first-view copy budget); **scam cues** appear once a message is flagged.
9. **v1 confetti key.** The moment id is the lesson id, so a second completion of the same lesson in one browser session shows the static frame.
10. **`verify-grade-postgres.py`** stays outside the native gate (it drives a full Supabase stack); its receipts are re-proved by `verify-v2-learning`.

### Migrations (renumbered by the orchestrator at merge)

- `0237_learning_delayed_retention.sql` (expand)
- `0238_v2_time_on_task.sql` (expand)
- `0239_v2_euler_sort_diagnostics.sql` (contract by classifier, widening in fact: apply before the Core release that grades Euler occupancy or conclusion steps or sort rule switches)

### What remains

- The first production release's Delayed Retention baseline and its log row; the first CI runs of `learning-db-verify` and the backend placement E2E (no push from this lane).
- The full `audit:rebuild` matrix across every lane at merge, and the owner's visual review of the rebuilt boards.
- The Mentor's own use of the new diagnostic codes (the Mentor lane owns it).
- The ten owner questions above.

## Checkpoint F4-learning-finish

Final summary of the learning lane. Implementation and local verification only; nothing is accepted or released, and nothing was pushed.

- **Sync.** `codex/spec-migration-s02` (14232a10) was already merged into the lane. There were no conflicts.
- **Adversarial pass over the 11 gaps.**
  - Every gap is built end to end, as the table above shows.
  - Time on task is checked at the Core boundary. Negative, over 7200, fractional and text values are refused with a 400, and nothing is recorded (`learnV2Mixed.test.ts`). The write goes through a service-role function that sets the time once, only on the learner's own receipt or view.
  - The Delayed Retention and Time-to-Mastery breakdowns sit behind the staff `view_analytics` permission.
  - The rebuilt boards import no legacy component.
  - New copy exists in EN, es-MX and pt-BR, and the i18n gate is green.
- **Fixed in this pass.** The full frontend suite found three class hooks that the lane added but no stylesheet defined: `lf-op-chart-table`, `lf-pz-plot` and `lf-move-to-button` (`designClasses.test.ts`). Nothing selected them, so they were removed. Rendering does not change.
- **Verification (one full run per touched service).**
  - Core: type-check, lint and 3,497 tests pass. The 4 placement E2E tests skip without a cluster; they ran 4/4 against the lane cluster at F4-learning.
  - Frontend: type-check and lint pass. 3,266 of 3,267 tests passed on the full run. The one red was the class-hook finding above. After the fix, it and the affected board suites pass.
  - Forge: type-check, lint and 839 tests pass.
  - Database: migration, phase and lifecycle checks pass, and 58 node tests pass. `railway-migrate.test.mjs` hangs on this Windows machine and was stopped. It spawns `bash`, which resolves to WSL here (the known trap). The lane did not touch that test or its runner, and it runs on Linux in CI.
  - Root: `spec:check` and `secrets:check` pass.
- **Still open.**
  - The first production release's Delayed Retention baseline and its log row.
  - The first CI runs of `learning-db-verify` and the placement E2E.
  - The full `audit:rebuild` matrix at merge.
  - The owner's visual review of the rebuilt boards.
  - The Mentor lane's use of the new diagnostic codes.
  - Migrations were renumbered 0235-0237 to 0237-0239 at merge. 0239 must deploy before the Core release that grades the new steps.
  - The ten owner questions listed above.

### F4-learning merge integration

Merged into `codex/spec-migration-s02` after the identity-site and staff-ops
lanes.

- Migrations renumbered to follow the integration branch's 0236: 0235 to
  `0237_learning_delayed_retention.sql`, 0236 to `0238_v2_time_on_task.sql`,
  0237 to `0239_v2_euler_sort_diagnostics.sql`. Bare mentions in Core
  comments, `verify-learning-r4-postgres.py`, REQUIREMENTS B.7 and B.28 and
  this record now name the new numbers. `0239` must deploy before the Core
  release that grades Euler occupancy or conclusion steps or sort rule
  switches. No SQL function or trigger is redefined by both lanes.
- `verify-course-publish-postgres.py` was rewritten for the whole chain by
  both this lane and staff-ops. The merged file keeps the staff-ops version
  (whole chain only, stale-watermark and browser-role checks) and adds this
  lane's check that an attestation missing one required Forge gate is refused
  (`VERIFICATION_INCOMPLETE`) and the `LF_PG_DATA` data-directory guard. This
  lane's minimal-catalog default mode was not kept: the staff-analytics
  self-test forbids a verifier that hand-writes `public.courses`, and both
  runners now call the verifier over the whole chain.
- `database-ci.yml` keeps the `identity-db-verify`, `staff-db-verify` and
  `learning-db-verify` jobs side by side; root and `database/package.json`
  and `release-readiness.sh` run all three gates; `database` `npm test` runs
  all three self-tests. `release-readiness.sh` keeps mode 100755.
- Verified on the merged tree: typecheck:all, lint:all, spec:check,
  secrets:check, the i18n gate, backend (3513, including the B.1 placement
  E2E over all 239 migrations), coursegen (839) and frontend (3274) unit
  suites, `database` tests (70, `railway-migrate.test.mjs` excluded locally
  for the WSL bash hang), `learning:db-verify` 8/8 and `staff:db-verify` 9/9
  over the whole merged chain.

## Checkpoint F4-mentor

Branch `codex/spec-fix4mentor`. One audited gap: the Extended Mastery
Engine's Stage 7 kill switch.

### The gap, checked in the code first

The gap is real. Appendix F Part 3 Stage 7 gives the Extended Mastery Engine
an explicit rollback condition: the Mastery Declaration Reversal Rate over 8%,
or the Corroborating-Evidence Compliance Rate below 100%. The response is to
revert to single-observation BKT thresholds for the affected KCs until the
cause is found. Appendix F §1.3 lists the engine in the Kill-Switch Trigger
Log. Before this checkpoint:

- `summarizeMasteryEvidence` (`backend/src/services/pedagogy/mentorIntegrity.ts`)
  computed one aggregate reversal rate. It only printed "roll affected KCs back
  only through the logged operator procedure". There was no per-KC rate to
  decide which KCs to roll back.
- The only rollback was the Oracle env var `TUTOR_CORROBORATION_ROLLBACK_KC_KEYS`,
  read once at boot. `grep` found no `mentor.kill_switch.mastery.*` action in
  `backend/src` and no logging of the variable in `oracle/src`, although the
  `env.ts` comment said "Every use is logged in the Kill-Switch Trigger Log".
- The C.24 `kill_switch.open` signal (which reads `audit_logs mentor.kill_switch.*`)
  could not show a mastery-engine trip. The Behavioral Telemetry Layer, the
  Alliance Controller, the spaced-review router and the live-content judge
  already had Core-evaluated, audit-logged rollbacks.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | Appendix F Part 3 Stage 7 ("for affected knowledge components"); §1.1; C.10 | `summarizeMasteryEvidence` now returns `byKc` (per KC: triggers, compliance misses, compliance rate, `underRollback`, declarations, reversals, reversal rate and status), with the 20-declaration floor applied to each KC. It also returns `unattributedMisses` (compliance misses on a move with no KC). A per-KC defect line is added for each KC over the ceiling. The aggregate numbers are unchanged. | `backend/src/services/pedagogy/mentorIntegrity.ts` |
| 2 | Stage 7 ("every new real-time component carries an explicit, pre-defined automatic-rollback condition"); §1.3 Kill-Switch Trigger Log | `evaluateMasteryKillSwitch` (pure) trips a KC whose own reversal rate is over 8%, or that has any compliance miss in the trailing 14-day window. `getMasteryKillSwitch` works like `killSwitchCacheMs` and caches its result for 10 minutes per process. It reads the audit trail, re-evaluates over rows after the latest resolution (at most the 90-day reversal window), maps KC ids to `kc.key`, and writes `mentor.kill_switch.mastery.triggered` with the kc keys, causes and per-KC numbers (no learner ids, no text). The trip holds until `mentor.kill_switch.mastery.resolved`. While it is open, a newly tripping KC is added with another trigger row, and a KC already in force is not logged again. A failed read trips nothing, is not cached, and keeps KCs already in force. `resolveMasteryKillSwitch`, `masteryTripInForce` and `masteryKillSwitchLog` are also new. | `mentorIntegrity.ts` |
| 3 | Stage 7; the Oracle context contract | New negotiated context field `corroborationRollbackKcKeys`: added to Core's and Oracle's `CONTEXT_OPTIONAL_FIELDS` (kept in parity by `telemetry:check`) and to Oracle's strict `SessionContextSchema` (at most 200 `kc.key`-shaped strings). It is sent only to an Oracle that announces it, and it is server-side only: it is not one of the 14 model-context fields. | `backend/src/routes/tutor.ts`, `services/pedagogy/behavioralTelemetry.ts`, `oracle/src/core/client.ts` |
| 4 | Stage 7 rollback applied; C.10 | `corroborationRollback(envKeys, coreKeys, plan)` builds the union of Core's keys and the env override. The orchestrator passes the union to the controller and logs one line per session when a rolled-back KC is in the plan, with its source (`core`, `env`, `core+env`). | `oracle/src/tutor/controller.ts`, `oracle/src/tutor/orchestrator.ts` |
| 5 | §1.3 Kill-Switch Trigger Log; C.24 | `tutor:integrity-report` gains `--resolve="<root cause>"` (same as `telemetry-report`). It also prints the per-KC table of KCs that meet the condition and the engine's Kill-Switch Trigger Log with resolution times (in `--json` too), and it counts an unattributed compliance miss as a defect. The dashboard's `kill_switch.open` reading already parses every `mentor.kill_switch.<component>.*` action, so a mastery trip shows as `component:mastery` until it is resolved. This is now pinned by a test. | `backend/src/scripts/mentor-integrity-report.ts`, `backend/src/__tests__/mentorQuality.test.ts` |
| 6 | C.22 Tier 1 change record | New rows for `mentor.non_negotiables` and `measurement.stage7_and_thresholds` (origin human, both sign-offs pending). No threshold value changed. | `docs/rebuild/mentor/governance/tier1-change-record.json` |
| 7 | Documentation | MENTOR-INTEGRITY-POLICY §3.3 rewritten for the automatic rollback, the operator override and `--resolve`. THRESHOLD-RECALIBRATION-LOG gains a row for the operating defaults (14 days, 10 minutes, 20,000 rows, 200 keys) and its Kill-Switch Trigger Log note. The `env.ts` comment and `oracle/.env.example` now state the truth: the env list is an override, applied as a union, logged once per session to stdout, and recorded in the log by hand. | `docs/rebuild/mentor/*.md`, `oracle/src/env.ts`, `oracle/.env.example` |

### Tests added

- `backend/src/__tests__/masteryKillSwitch.test.ts` (17): per-KC floor and
  rates; per-KC compliance and unattributed misses; `underRollback` per KC and
  in aggregate (such a decision is still compliant); a trip on one KC rolls back
  only that KC; one compliance miss trips its KC, and a legacy miss outside the
  window does not; the trip holds until resolved, and after resolution only data
  since the resolution counts; a KC already in force is not logged again, and a
  new KC joins the open trip; each failed read (audit, trajectory, kc map) trips
  nothing and is not cached; a failed trajectory read keeps KCs already in force;
  an unattributed miss opens one logged trip; the resolution row.
- `backend/src/__tests__/tutor.test.ts` (4, context route): the keys reach an
  Oracle that announced the field, and the trip is logged; a healthy window sends
  `[]`; a failed read opens the session with `[]` and no log; an Oracle that did
  not announce the field gets neither the field nor the reads.
- `backend/src/__tests__/mentorQuality.test.ts` (1): `component:mastery` stays
  open across two triggers and closes on resolution.
- `oracle/src/__tests__/controller.test.ts` (2): the union and its source per
  plan KC; Core's rolled-back KC is judged on one observation while the other
  KCs stay on the rule.
- `oracle/src/__tests__/contextFields.test.ts` (1 new, 1 updated): the field is
  announced and parsed strictly (a bad key, a non-array or 201 keys refuse the
  context).
- `oracle/src/__tests__/masteryRollbackSession.test.ts` (3): the orchestrator
  applies Core's keys and logs once with the KC and its source (no learner
  identity); a rolled-back KC outside the plan is applied but not logged;
  nothing in force means nothing is logged.

### Verification (local)

- Backend: `type-check` and `lint` green. Focused vitest green:
  `masteryKillSwitch`, `mentorIntegrity`, `mentorQuality`, and the Stage 7,
  kill-switch and mastery cases of `tutor.test.ts`.
- Oracle: `type-check` and `lint` green. Focused vitest green: `controller`,
  `contextFields`, `masteryRollbackSession`, `privacy-contract-docs`,
  `live-session`, `orchestrator`. Leftover `.boot-test-` processes were checked
  afterwards.
- Root: `telemetry:check` (context-field parity), `governance:check`,
  `spec:check` and `secrets:check` green.
- No migration: the trip lives in `audit_logs`, like the other Stage 7 switches.

### Remaining (not closed here)

- Acceptance: production data to exercise a real trip; both leads' Tier 1
  sign-offs on the two new change-record rows; owner/pedagogy review of the new
  operating defaults.
- Deploy order: Core may deploy before or after Oracle, because the field is
  negotiated. Until the new Oracle is live, only the env override applies.
- The env override itself still writes no `audit_logs` row. By policy it is
  recorded by hand, and Oracle logs it per session to stdout.

### Owner questions (conservative defaults implemented)

- M-F4-1: The SPEC sets the trigger and the per-KC response, not the operating
  values. Implemented defaults: compliance judged over a trailing 14 days (so
  legacy rows from before C.10 recorded its evidence do not trip), reversal over
  the existing 90-day window, a 10-minute cache per Core process, and one
  resolution closing the whole trip. Confirm, or set other values.
- M-F4-2: A compliance miss on a move that names no KC trips and is logged, but
  rolls nothing back, because no KC can be named. Confirm that this, plus the
  report's defect line, is the intended response.

## Checkpoint F4-mentor-finish

Lane finish for `codex/spec-fix4mentor`. The worktree was clean, and the sync
with `codex/spec-migration-s02` was already up to date (no conflicts).

### Adversarial pass: one half-built part found and built

Stage 7 says "revert to single-observation BKT thresholds for affected
knowledge components". F4-mentor applied that only in Oracle's controller.
Core's persisted side still required the C.10 corroboration (two correct
answers in a row) for the same KC, in three places:

- the learning map (`deriveNodeState`, `buildTutorMap`),
- the session planner's frontier (`rankPlanKcs`, `buildSessionPlan`),
- the parent's mastery evidence (`displayStateOf`, `buildMasteryEvidence`).

So a KC that the live session declared mastered under the rollback still showed
"in progress" on the map and in the parent's view, and the planner kept it on
the frontier.

| SPEC clause | What was built | Where |
|---|---|---|
| Appendix F Part 3 Stage 7; C.10 | `corroborationMinFor(kcKey, rolledBack)`: the C.10 minimum, or `MASTERY_ROLLBACK_CORROBORATION_MIN = 1` (the same value Oracle's controller uses) for a rolled-back KC. Only the corroboration is lowered: the posterior bar and the 3-attempt evidence bar stay. | `backend/src/services/pedagogy/bkt.ts` |
| Stage 7; §1.14 | `getMasteryRollbackKcKeys()`: a read-only accessor that returns the `kc.key`s of the trip in force. It never evaluates the condition and never writes a trigger. It reuses a fresh `getMasteryKillSwitch` verdict, otherwise it reads `audit_logs` and caches the result for 10 minutes. A failed read returns the empty set, so the stricter C.10 rule stays in force, and that result is not cached. | `backend/src/services/pedagogy/mentorIntegrity.ts` |
| Stage 7; C.10 | The map and the parent's evidence read those keys and apply `corroborationMinFor`. The planner takes the keys as a parameter. The context route now evaluates the mastery switch before it builds the plan and passes it the same keys it sends to that Oracle. An Oracle that did not announce `corroborationRollbackKcKeys` gets a plan on the C.10 rule, which matches what it will apply. | `tutorMap.ts`, `masteryEvidence.ts`, `sessionPlan.ts`, `backend/src/routes/tutor.ts` |
| C.22 | New Tier 1 change-record rows for `mentor.non_negotiables` and `measurement.stage7_and_thresholds` (origin human, both sign-offs pending). No threshold value changed. | `docs/rebuild/mentor/governance/tier1-change-record.json` |
| Docs | MENTOR-INTEGRITY-POLICY §3.3 item 3 covers the persisted side. The REQUIREMENTS C.10 row is updated and not marked Accepted. | `docs/rebuild/mentor/MENTOR-INTEGRITY-POLICY.md`, `docs/rebuild/REQUIREMENTS.md` |

Also checked, with no change needed:

- Authorization is enforced at the server. The context route is internal-only (`x-internal-api-key`). `--resolve` is an operator CLI that uses the service role. No learner-facing surface can set or clear a trip.
- No UI and no copy changed in this lane, so there is no legacy-component or locale exposure and the i18n gate does not apply.

### Tests added

- `backend/src/__tests__/masteryRollbackPersisted.test.ts` (11): the shared rule; the map state (one correct answer counts as mastered only under the rollback, a last answer that was wrong never does, and the posterior and evidence bars still hold); the planner (only the rolled-back KC leaves the frontier); the accessor (keys in force, a resolved trip, no writes, no trajectory read, a failed read keeps C.10 and is not cached, a cache hit); the map, the parent's evidence and the plan end to end, including a failed read.
- `backend/src/__tests__/tutor.test.ts` (1): on the context route, the plan drops the rolled-back KC for an Oracle that announced the field, and keeps it on the C.10 rule for one that did not.

### Verification (local, lane finish)

- Backend: `type-check` and `lint` green. The full unit suite is green (153 files passed and 1 skipped; 3,511 tests passed and 1 skipped).
- Oracle (touched in F4-mentor): `type-check` and `lint` green. The full unit suite is green (67 files, 1,767 tests). No `.boot-test-` processes were left over.
- Root: `spec:check`, `secrets:check`, `telemetry:check` and `governance:check` green (governance after the change-record rows above).
- No migration in this lane.

### Lane summary and what remains

The lane closes the one audited gap. The Extended Mastery Engine now has an automatic, per-KC, logged Stage 7 rollback: Core evaluates it and writes it to the Kill-Switch Trigger Log, it holds until an operator resolves it, and Oracle, the map, the planner and the parent's evidence all apply it. Status: implemented and locally verified. It is not accepted and not released.

What is still open:

- Acceptance needs production data from a real trip.
- Both leads must sign the four pending Tier 1 change-record rows.
- The owner must confirm the operating defaults (M-F4-1, M-F4-2).
- The env override `TUTOR_CORROBORATION_ROLLBACK_KC_KEYS` still writes no `audit_logs` row, and Core's persisted side does not know about it. Only Core's automatic trip reaches the map and the parent's view. By policy the operator records a manual override by hand.
- Deploy order: either order works, because the field is negotiated.

Owner question added:

- M-F4-3: While a KC is rolled back, the parent's mastery view uses the single-observation baseline, following the SPEC's "revert … for affected knowledge components". The conservative alternative is to keep the parent's view on the C.10 rule during a trip. The SPEC text was implemented; confirm it.

### Merge integration (F4-mentor into `codex/spec-migration-s02`)

- Conflict: this record (add/add). Resolved as a union: every lane section
  already on the integration branch, then the F4-mentor and F4-mentor-finish
  sections. No code conflict; `REQUIREMENTS.md` (C.10, C.24),
  `THRESHOLD-RECALIBRATION-LOG.md` and `tier1-change-record.json` merged
  cleanly with both sides' rows kept.
- Integration defect: `governance:check` failed on the merged tree.
  `measurement.stage7_and_thresholds` covers both `mentorIntegrity.ts` (this
  lane) and `mentorQuality.ts` (F4-learning's Appendix C 1.1 readers), so the
  merged content hash matched neither lane's recorded row. Fixed with the
  gate's own `--record`: one new change-record row for the merged hash
  (origin human, both sign-offs pending), as in earlier merge integrations. No
  threshold value changed by the merge. Both leads now have five pending rows
  from this lane to sign.
- Migrations: none; nothing renumbered.
- Verified on the merged tree: typecheck:all, lint:all, spec:check,
  secrets:check, telemetry:check, governance:check, the i18n gate, backend
  (3547) and Oracle (1767) unit suites. The first Oracle run shared the
  machine with the backend suite and timed out in six boot and lock files; a
  quiet rerun passed all 67 files, so that red was load, not the merge.

## F4-family

Branch `codex/spec-fix4family`. Two audited gaps on the family money
surfaces. Both were checked in the code first and both were real:

- A confirmed coin split showed "Coins added." inside the payout's own slot,
  and the hosts re-read at once, so the payout left `chores.toSplit` /
  `coins.credits`, the slot unmounted and the only confirmation went with it.
  The teen's `/wallet` said only "Added {n} coins.". No test asserted a result.
- The registered pocket icons (`pocket.{save,spend,share}.icon`) were drawn
  only by `PocketRow` on `/tasks`; the split chooser, the usual split, the
  child's coin account and both teen-wallet pocket lists showed a hue swatch
  or tint plus the word, and no split bar existed anywhere.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | Bible 02 §9.2 (confirm the coin split); mockup K18; OD-7; D.13 | New copy `split.result` ("Done: {save} to Save, {spend} to Spend, {share} to Share.") in EN, es-MX, pt-BR replaces the unused `split.added`; `teenWallet.income.added` becomes `income.result` ("Added {n} coins: {save} to Save, …"). `AllocationPanel` reports the accepted split through `onDone(split, goal)` and then renders nothing for that payout (it never offers the split again, even if the re-read fails). The `split` slots of `ChildTasks` and `ChildCoins` now pass `settled(result)`: the board holds the last result in state and renders it as a live success `InlineNotice` (`data-family-part="split-result"`) at the top of the primary column (Tasks) or right under the coin account and its pockets (family wallet), outside the per-payout slot, so it survives the re-read. `TasksPage` and `BankingPage` format it with `splitResultText` (`routes/app/family/moneyHabitsCopy.ts`). A reached goal still celebrates only on the goals panel, which re-reads (OD-7); the split itself is a status, no confetti, no XP. TeenWallet `submitIncome` states the three placed counts (and the reached goal after it) | `frontend/src/routes/app/tasks/AllocationPanel.tsx`, `TasksPage.tsx`, `routes/app/banking/BankingPage.tsx`, `routes/app/family/moneyHabitsCopy.ts`, `rebuild/family/tasks/ChildTasks.tsx`, `rebuild/banking/coins/ChildCoins.tsx`, `rebuild/wallet/TeenWallet.tsx`, `src/i18n/*/moneyHabits.json`, `src/i18n/*/teenWallet.json` |
| 2 | Bible 02 §4.3 (colour, icon and label at once; the split bar under the pockets beside labelled steppers); 02 §4.4; 07 §1 class B | One pocket identity component, `PocketMark` (the manifest pocket icon at sm 24 / md 32 / lg 48 px, decorative beside the word). Used by `PocketSplit` in every mode (stepper, typed, readonly; it replaces the hue swatch, which rendered empty on the lesson board), `PocketRow` (Tasks), the `CoinAccount` pocket list and its statement lines, both `TeenWallet` pocket lists, and the Share section heading of `ShareGiving`. `SplitBar`: one token-hue segment per pocket sized by its count (flex-grow), an empty pocket hidden, the unplaced rest as a sunken segment, gaps between, no border, `aria-hidden`, a `flex-grow` transition only without reduced motion. `PocketSplit` draws it under the rows by default (`total` = payout coins in the chooser, 10 in the usual split); the lesson allocation board passes `bar={false}` because it draws its own teaching chart; the teen income form draws it under its count fields. The pocket rows on Tasks and the coin account now wrap (02 §7 rule 6) | `frontend/src/rebuild/family/PocketMark.tsx`, `pocketMark.css`, `PocketSplit.tsx`, `SplitChooser.tsx`, `UsualSplit.tsx`, `ShareGiving.tsx`, `moneyHabits.css`, `moneyRegister.ts`, `tasks/taskParts.tsx`, `tasks/money.css`, `rebuild/banking/CoinAccount.tsx`, `coinAccount.css`, `rebuild/wallet/TeenWallet.tsx`, `teenWallet.css`, `rebuild/learning/AllocationBoard.tsx` |
| 3 | Bible 02 §4.3 gate | `pocketIdentityGate.test.ts`: every JSX element marked `data-pocket="…"` in `rebuild/family`, `rebuild/banking` and `rebuild/wallet` must contain `<PocketMark>` (7 elements today). Component tests: PocketSplit marks every pocket in all three modes, draws three segments sized by the counts plus the unplaced rest, and omits the bar with `bar={false}`; TeenWallet draws the live bar and marks every pocket | `frontend/src/rebuild/family/pocketIdentityGate.test.ts`, `PocketSplit.test.tsx`, `rebuild/wallet/TeenWallet.test.tsx` |
| 4 | Result tests; audit states | `SplitResult.test.tsx` wires the real `AllocationPanel` into `ChildTasks` and `ChildCoins` exactly as the routes do: after "Use my split" the re-read removes the payout and the chooser, the status still reads "Done: 5 to Save, 4 to Spend, 1 to Share.", the pockets re-read, and nothing with `data-celebration` renders; the formatter is checked in all three locales. The audit lane gains `/tasks@split-confirmed` and `/family-wallet@split-confirmed` (open the payout, keep the usual split; the synthetic Core answers both allocate routes). The browser journeys `verify-money-habits.mjs` and `verify-teen-wallet.mjs` now wait for the new result lines | `frontend/src/routes/app/tasks/__tests__/SplitResult.test.tsx`, `MoneyHabitsPanels.test.tsx`, `frontend/scripts/audits/lanes/family.mjs`, `scripts/verify-money-habits.mjs`, `scripts/verify-teen-wallet.mjs` |

### Verification (local)

- Frontend `type-check` and `lint` clean.
- Focused vitest (3 workers): SplitResult, MoneyHabitsPanels, PocketSplit,
  pocketIdentityGate, moneyHabitsCopy, teen wallet (component and copy),
  `rebuild/family/tasks`, `rebuild/banking`, MoneyHabits, TasksPage, the
  banking route tests and `rebuild/learning` (the lesson board): all green.
- Real-Chrome audit (`audit-rebuild.mjs all`) on the seven pocket-bearing
  states (`/tasks@child`, `/tasks@split-confirmed`, `/tasks@teen-linked`,
  `/family-wallet@child`, `/family-wallet@split-confirmed`,
  `/family-wallet@teen-linked`, `/wallet@teen`) × 3 locales × 2 themes ×
  320/375 px: text fit 336, proportion 84, copy budget 84 configurations,
  no findings, no JS errors.
- Looked at: `/tasks@split-confirmed` light 375 (the status above the
  chores after the split), `/family-wallet@split-confirmed` dark 320 and 375
  (pocket icons in the coin account; the status under it), and the open
  split chooser dark 320 (icons and the three-segment bar under the rows).
- Root `spec:check` (asset gate included), `secrets:check` and
  `check-i18n.sh` green.

### Remaining

- The full audit matrix at 768/1280 px and the browser journeys
  (`verify-money-habits`, `verify-teen-wallet`) were not run here (speed
  mode; the orchestrator runs the full gates per merge).
- The synthetic Core keeps no state, so in the `split-confirmed` audit
  states the settled payout stays on the board as an empty slot; the real
  re-read removes it (proven by `SplitResult.test.tsx`).
- The pockets asset family still awaits the owner's first-family style
  review (OD-14); human design review.

### Owner questions (conservative defaults implemented)

- Placement of the result status on `/tasks`: Bible 02 §9.2 says the split
  "settles into place" in the pockets, but on the child's Tasks board the
  pockets sit in the secondary column (below everything on a phone). The
  status is shown at the top of the primary column, where the payout was, so
  the child sees it where they pressed; on the family wallet it sits right
  under the pockets. Confirm, or move it into the pockets card.
- The result replaces "Coins added." (EN "Done: …", es-MX "Listo: …", pt-BR
  "Pronto: …"); native copy review of the three lines.

## F4-family-finish

Lane close. The sync with `codex/spec-migration-s02` was already up to date,
so there were no conflicts. An adversarial pass over the two gaps found one
place where Gap 2 was only half-built, and it is now fixed:

| # | SPEC clause | Finding and fix | Where |
|---|---|---|---|
| 5 | Bible 02 §4.3; 07 §1 class B | The Tutor's coin-correction form (the pocket choice and the goal-move destination), the Tutor's correction history and the child's own coin history (`WalletActivity`) named a pocket with the word only. Now the shared `SegmentedControl` takes an optional decorative `art` node per option. This is additive: no existing caller changes. The pocket choices pass `<PocketMark size="sm">`, and both history lists mark each line with `data-pocket` and its icon. The segmented label's minimum width now applies only to the label span, not to the mark. | `frontend/src/rebuild/design/fields.tsx`, `controls.css`, `rebuild/family/WalletCorrections.tsx`, `WalletActivity.tsx` |
| 6 | Gate integrity | `pocketIdentityGate.test.ts` built its nesting regex from a template string where `\s` had collapsed to `s`. As a result, a nested element of the same tag with attributes was not counted, and the element body could be cut short. The escape is fixed, and the floor rises from 7 to 9 `data-pocket` elements. | `frontend/src/rebuild/family/pocketIdentityGate.test.ts` |

The new tests in `FamilyHubLifecycle.test.tsx` check that every pocket radio in both correction forms carries its mark, and that each correction-history and coin-history line carries `data-pocket` and an aria-hidden icon.

Server boundary: the lane changed no Core code. Both allocate routes already accept only the child's own payout (`guardOwnTask`, and the credit equivalent), refuse a frozen account, and validate the split inside the allocate transaction. No legacy component was used. There is no new copy in this pass.

### Final verification (local)

- Frontend `type-check` and `lint` are clean. The full frontend unit suite ran once: 278 files and 3202 tests, all green. Root `spec:check` and `secrets:check` are green.

### Lane summary and what remains

Both audited gaps are implemented and locally verified, not accepted:

- Gap 1 (02 §9.2, K18, OD-7, D.13): the confirmed-split result.
- Gap 2 (02 §4.3, §4.4; 07 §1 class B): pocket identity on every pocket display, plus the split bar.

Still open:

- The 768/1280 px audit matrix, the browser journeys `verify-money-habits` and `verify-teen-wallet`, and an audit state for the correction form. The orchestrator runs these per merge.
- The owner style review of the pockets asset family (OD-14), human design review, and native copy review of the result lines.
- The owner questions listed under F4-family.

### Merge integration (F4-family into `codex/spec-migration-s02`)

- Conflict: this record only (add/add). Resolved as a union: every earlier
  lane's section kept as it was on the integration branch, the F4-family and
  F4-family-finish sections appended after them. `REQUIREMENTS.md` (the D.13
  row), `controls.css` and `AllocationBoard.tsx` merged cleanly.
- Integration defect fixed: the lane scoped the segmented label's minimum
  width to `span[data-copy-role]` for the default size, but the compact size
  (OD-28, V-13) kept its own `> span` rule. That rule also matched the
  `PocketMark` span, so a compact pocket option would give the decorative
  mark a label-width floor. The compact rule now targets the label span too,
  and the `controls.test.tsx` pin follows it.
- Migrations: none; nothing renumbered.
- Verified on the merged tree: typecheck:all, lint:all, the frontend unit
  suite (281 files, 3286 tests), spec:check, secrets:check and the i18n
  gate. The lane changed no Core code. The 768/1280 px audit matrix and the
  browser journeys `verify-money-habits` and `verify-teen-wallet` were not
  run in this merge step.

## Checkpoint F4-social

Branch `codex/spec-fix4social`. Three audited gaps, each confirmed in the code before it was fixed.

### The gaps, confirmed in code

1. **No tone gate read the profile and social-layer copy** (Appendix J Part 3 Stage 4; F.3; Law 2). The only copy tone gate was `agent/tools/check-family-copy-tone.mjs`. Its scope named the Family namespaces and some `rebuild-family` groups, and its surfaces only `rebuild/{family,banking,wallet}` and `routes/app/{banking,tasks,family,wallet}`. No tone check read `rebuild-profile.json`. The goals-together copy was also unread (`rebuild-learn.json` `together`), and so were the surfaces `rebuild/social`, `rebuild/account`, `routes/app/profile` and `TogetherRoute.tsx`. The copy-budget tests count words, sentences and dashes, not register.
2. **The Bible audits never rendered the Family Connections panels, the end/report dialogs or `/learn/together`** (02 §7, 03 §5, 06 §3). The problems:
   - `lanes/family.mjs` had no state that opened a Connections panel, and its synthetic Core answered none of their reads.
   - `lanes/learn.mjs` had no together state.
   - `verify-family-social.mjs` mocked `canEnd:false`, so the new row actions never rendered.
   - The verifier had also decayed. Its retry and more presses matched the first "Try again" and "Show more" on the page, and newer Family panels now carry those same labels, so the script timed out even before this change (confirmed by running the committed version).
3. **A Tutor saw a child's goals together only as a count, and the coop audit rows never reached the Family history** (E.2, Law 5, OD-27 (1)). Two parts:
   - `CoopGuardianView` was `{ ageFits, enabled, openGoals }`.
   - `getGuardianSocialAuditPage` filtered `action=in.(social.follow,social.unfollow,social.block,social.unblock)`, and its zod enum accepted only those four actions.

### What was built

| SPEC clause | What was built | Where |
|---|---|---|
| E.2, Law 5, OD-27 (1), OD-3 Option B | `public.coop_goal_guardian_goals(p_guardian, p_kid)`, service role only. It refuses a caller without a verified guardian link (`COOP_GUARDIAN_NOT_LINKED`) and a child outside the guardian social tier (`COOP_NOT_ALLOWED`: a self-registered teen's goals are its own, even with a linked Tutor). It reconciles each open goal first. It returns at most 50 open goals the child is asked to or in: kind, target, window, whether the child started it, the child's status, and each other person as invited, active or ended-after-joining. No progress of any kind | `database/migrations/0240_coop_goal_guardian_goals.sql` |
| E.2, Law 5 | `GET /api/v1/family/kids/:kidId/coop-goals`. The route: <ul><li>runs `guardKid`;</li><li>refuses any query;</li><li>refuses a non-guardian tier with `403 ACCOUNT_SELF_MANAGED`;</li><li>reads as the session guardian;</li><li>names each person only through `mayDiscoverProfile(guardian, id)` (else `null`);</li><li>runs `guardKid` again after the reads.</li></ul> The answer is `{ goals: [{ id, kind, target, startsAt, endsAt, startedByChild, childStatus: joined|asked, people: [{ name, status: joined|asked|left }] }] }`, with no account ids and no numbers per person | `backend/src/routes/family.ts`, `backend/src/services/coopGoals.ts` (`readCoopGuardianGoals`, `CoopGuardianGoals`) |
| E.2 | The guardian history also reads the `social.coop_*` rows where the child is the actor or the subject, and `social.coop_goal_closed` for the goals the child joined and was still in (at most 100, read first). Only fixed fields leave Core: the action, the people, the goal id, the reason code and the preset target. An unknown reason or origin is a 502, and a row about another family is dropped even if the transport returns it | `backend/src/services/supabaseRest.ts` (`COOP_AUDIT_ACTIONS`, `CoopAuditRow`, `getGuardianSocialAuditPage`) |
| E.2 (Family surfaces), 06 | The goals-together card lists each goal: the target and end date, who started it, and each person as a row with a status pill. It says "private account" for a person the Tutor may not see and shows no progress. The history renders each goal event as one sentence, with a reason-specific sentence for left, removed, declined and withdrawn. Copy is in EN, es-MX and pt-BR (`familyCoopGoals`: 11 keys; `socialHistory`: 11 keys), within the budget | `frontend/src/rebuild/family/CoopGoalsConsent.tsx`, `coopGuardianGoals.ts`, `rebuild/social/SocialHistory.tsx`, `app-routes/CoopGoalsConsentPanel.tsx`, `routes/app/family/SocialHistoryPanel.tsx` |
| Appendix J Part 3 Stage 4, F.3, Law 2, E.10 | `check-social-copy-tone.mjs` runs the D.8 engine with a second scope file, `social-copy-tone.lexicon.json`. Scope: <ul><li>every `rebuild-profile` group (`complete`: a new group fails until it is listed);</li><li>`rebuild-learn` `together` and the learner-home card's three together keys;</li><li>the Family connection groups.</li></ul> Surfaces: `rebuild/social`, `rebuild/account`, `routes/app/profile`, `TogetherRoute.tsx`, `TogetherView.tsx` and `together.ts`. Categories: guarantee, messaging (E.10), glossary (Tutor, Mentor, coins), bank register, legal register, shouting and B.14. The engine gains `scope.coverage`, `scope.complete` and `scope.accessors` (for example `learnCopy[locale].together`). It no longer counts a comparison of `error.message` as rendering it. There are 14 reviewed keyed exceptions, among them the report note that names the safety team. `accountDeletion.reauth` was reworded in three locales ("to confirm it is you") | `agent/tools/check-social-copy-tone.mjs`, `social-copy-tone.lexicon.json`, `check-family-copy-tone.mjs`, `docs/operations/SOCIAL-COPY-TONE-GATE.md` |
| Bible 02 §7, 03 §5, 06 §3; E.1-E.3; OD-27 (1) | The synthetic Core now answers the graph (`canEnd` true for the parent-created child and false for the linked self-registered teen), requests, history (with goal events), notices (one named, one not), badge links, the coop opt-in view (on, off, not a teen) and the guardian goals read (with the self-managed refusal). New family states: <ul><li>`connections-graph` and `connections-graph-self-managed`;</li><li>`connections-requests` and `connections-history`;</li><li>`social-notices`;</li><li>`connection-end-confirm` and `connection-report`;</li><li>`badge-links`;</li><li>`coop-goals-consent`, `coop-goals-off` and `coop-goals-not-teen`.</li></ul> Each is reached with real presses and waits until the token-bound panels have remounted. The learn lane gains three scenarios (teen with goals, teen asked, a child it is closed to) and the states `/learn@home-together`, `/learn/together@goals`, `@invitation`, `@start-goal`, `@report` and `@closed` | `frontend/scripts/audits/lanes/family.mjs`, `lanes/learn.mjs` |
| E.1/E.3 browser | `verify-family-social.mjs` now answers `canEnd:true` and the DELETE and report writes. In every locale, theme and width it presses End (the confirmation must state the consequence and nothing is sent before confirming), confirms (exactly one DELETE, "Connection ended."), then opens and cancels the report dialog (nothing is sent). Presses are scoped to the graph panel | `frontend/scripts/verify-family-social.mjs` |
| Gates | `social:check` section 9 pins the latest SQL (link, tier, reconcile, no progress), the Core route order, the coop actions of the history read, the card and the history rendering, and the policy line, with 3 new mutation tests. The social tone gate runs in `spec:check` and in the repo gates (`.github/workflows/repo-gates.yml`), with 33 tests | `agent/tools/check-social-tiers.mjs`, `.test.mjs`, `package.json`, `docs/rebuild/policies/SOCIAL-TIERS.md` §1.2 |

Findings the audit pass fixed:

- `/learn/together` ran over the 40-word first view: 43 words for the goals state and 49 for the invitation state. The fixes:
  - The intro and rules were shortened in 3 locales.
  - The invitation heading became "Invitations", and the invited-by line became "{name} asked you".
  - The "With {names}" line was removed, because the members list right below already names them.
  - The empty "No goals yet" state now waits while an invitation is shown.
- The closed page put two sentences (16 words) in one body. The hint is now its own paragraph.
- `invite-link` (GAP-FIX-R3) failed at random with "Missing mint". The toggle was pressed before the token-bound panels remounted, and once the social and goals reads were answered the press was lost often enough to abort a run. The state now also waits for `SOCIAL.settled`.
- The `<time>` elements of the history and requests lacked `data-copy-role`.
- The goals-together paragraphs and the guardian invite notice ran 76 to 89 characters wide at 768 and 1280 px, over the 03 §3 measure. They are now capped at 30rem.

### Verification (local)

- **PostgreSQL 17.6** (owned cluster, port 15650). `verify-coop-goals-postgres.py` applies all 235 migrations and passes 12 checks, one of them new. The Tutor reads the open goal with the child's status and each person asked or joined, and no progress. The invited sibling sees it as asked. An unlinked adult is refused, and so is the linked Tutor of a self-registered teen (`COOP_NOT_ALLOWED`). anon and authenticated cannot call it.
- **Core (vitest).** `family.test.ts` has 95 tests: 6 new for the guardian goals route and 3 for the coop history (fixed fields only, another family dropped, an unknown reason or origin refused). `coopGoals.test.ts` (21) passes. Type-check and lint are clean.
- **Frontend (vitest).** New `CoopGoalsConsent.test.tsx` (7 tests). Also passing: `Together.test.tsx`, `AccountDeletion.test.tsx`, and the family, learn, profile and namespace copy-budget tests. Type-check and lint are clean.
- **Root.** All of these pass: `spec:check`, `secrets:check`, `tools:test` (478 tests), `social:check` and its 30 tests, `check-social-copy-tone.mjs` (1,998 strings, 100%), `check-family-copy-tone.mjs` (4,797 strings, 100%), and the i18n gate.
- **Browser.** `verify-family-social.mjs` passes 12 of 12 runs (3 locales x 2 themes x 375/1280 px): end confirmed, report dialog opened and cancelled, 0 axe violations. `npm run audit:rebuild` covered the 17 new states plus the touched `two-children`, `one-child`, `invite-link` and `teen-selected` states: text fit, proportion and copy budget over 3 locales, 2 themes and 320/375/768/1280 px. The final run of those 21 states is clean: 2,016 text-fit, 504 proportion and 504 copy-budget configurations with no finding and no JS error, and no social, coop or badge read left unanswered. An earlier full run of all 37 `/family` states found only the measure findings fixed above. Their proportion rerun at 768 and 1280 px after the fix is clean (444 configurations).

### Decisions taken with the conservative default (owner questions)

1. **A goal member the Tutor may not discover appears as "private account".** Their name is never shown. For a guardian-tier child, every connection needed the Tutor's approval, so members are normally named.
2. **"Left" means ended after joining.** Someone who declined, was withdrawn or lapsed without ever joining is not listed on the card. The history still records those events.
3. **The Tutor's own opt-in changes (`social.coop_guardian_enabled`/`disabled`) appear in the child's history**, because the child is the subject of those rows. Another verified Tutor of the same child sees them too.
4. **The Spanish and Portuguese noun for "safety"** ("seguridad", "segurança") stays a guarantee word in the social lexicon. The existing labels that name the safety team or a safety list carry keyed exceptions. English "safety" is not in the lexicon; "safe" and "protected" are.

### Migrations (the orchestrator renumbers at merge)

- `0240_coop_goal_guardian_goals.sql` (`@phase: expand`, 4,348 bytes; one function; no table, no row change).

### Open items

- `database/types/database.ts` is not regenerated for `coop_goal_guardian_goals`. Regeneration needs `db:types` against a Supabase stack, and this lane may not touch the shared one.
- The Stage 4 human spot-check of the social copy, and a native es-MX/pt-BR read of the new goals-together and history sentences.
- ~~A linked self-registered teen's goals-together card says "Only for ages 13 to 17, by the birth date you gave".~~ Fixed at lane finish (below).

## Checkpoint F4-social-finish

Lane finish. The base branch `codex/spec-migration-s02` (`14232a10`) was already merged, so the sync had nothing to add and no conflicts.

### Adversarial pass against the three gaps

- **Gap 3 (E.2, Law 5, OD-27 (1), OD-3 Option B).** The server enforces the guardian link twice, the guardian tier and a query-free request. Only fixed fields leave Core. One half-built edge was found and fixed: a linked self-registered teen's card said "Only for ages 13 to 17, by the birth date you gave". That sentence is Core's `ageFits:false` for a non-child account, and it is wrong for a teen who is 13 to 17. The card now says "{name} manages goals together on their own account." (new key `familyCoopGoals.selfManaged` in EN, es-MX and pt-BR). It shows no switch and no goals, and the panel makes neither read when the family list says `accountType: 'teen'`. Core is unchanged and still refuses the goals read with `403 ACCOUNT_SELF_MANAGED`. Where: `rebuild/family/CoopGoalsConsent.tsx`, `app-routes/CoopGoalsConsentPanel.tsx`, `routes/app/family/FamilyPage.tsx`.
- **Gap 1 (Appendix J Stage 4, F.3, Law 2).** The new key falls within the tone gate's `familyCoopGoals` scope and passes it.
- **Gap 2 (Bible 02 §7, 03 §5, 06 §3).** The audit state `connections-graph-self-managed` now renders the new sentence. It still meets `SOCIAL.settled` (a body paragraph in the card). No legacy component was added: the card uses only the rebuild controls.

### Verification (local, lane finish)

- Frontend: type-check and lint clean. The full unit suite passes (278 files, 3,201 tests), including 2 new card tests and the new `CoopGoalsConsentPanel.test.tsx` (2 tests: the self-managed teen gets no read and no switch, and a parent-created child is read).
- Backend: type-check and lint clean. The full unit suite passes (151 files, 3,486 tests, 1 skipped).
- Root: `spec:check`, `secrets:check`, `social:check`, the i18n gate, `check-social-copy-tone.mjs` (2,001 strings, 100%) and `check-family-copy-tone.mjs` (4,800 strings, 100%) all pass.
- Root `tools:test`: 478 tests pass.
- Database: `check-migrations`, `check-migration-phase` and `check-family-lifecycle` pass (235 files), and the `node --test` group passes (54 tests). The last step, `railway-migrate.test.mjs`, did not finish in over 20 minutes on this Windows machine and was stopped. It drives `railway-migrate.sh` through `bash`, which resolves to WSL here. This lane does not touch that runner, and another lane's run of the same script was hanging at the same time. It is left to the orchestrator's merge gates.
- Not rerun at finish: the browser matrices and `audit:rebuild` (the orchestrator runs them per merge). The new sentence is 8 words in a body paragraph, within the budget test.

### Lane summary

Three audited gaps are closed, each implemented and locally verified, and none is accepted. Gap 3: the Tutor sees each goal together, who is in it, and the goal history, with no progress shown (migration `0240_coop_goal_guardian_goals.sql`). Gap 1: the social copy tone gate. Gap 2: the Connections panels and `/learn/together` in the Bible audits. Requirement rows E.2, E.10, F.3 and B.23 were updated. Still open:

- `database/types/database.ts` does not include `coop_goal_guardian_goals`. Regenerating it needs `db:types` against a Supabase stack.
- The Stage 4 human spot-check of the social copy, and a native es-MX and pt-BR read of the goals-together, history and self-managed sentences.
- W3-SOCIAL-ANSWERS.md (lines 53 and 111) and the GAP-FIX-R3 F3-social "visual pass" item are now covered by this round's audit evidence. They are left unedited for the orchestrator to reconcile.

### Merge integration (F4-social into `codex/spec-migration-s02`)

- Migrations: the lane's `0235_coop_goal_guardian_goals.sql` is renumbered
  to `0240_coop_goal_guardian_goals.sql`, after the integration branch's
  `0235`-`0239` from the staff-ops and learning lanes. Every reference was
  rewritten. None of `0235`-`0239` touches `coop_goal_*`, `social_tier` or
  `guardian_links`, so the apply order needs no reconciling migration. The
  counts "235 migrations" and "235 files" above are the lane's own evidence
  and stay as recorded; the merged chain has 240 files. The file is 4,348
  bytes, under the transport cap.
- Conflicts resolved as a union:
  - `package.json` `spec:check`: the lane's `check-social-copy-tone.mjs` and
    the learning lane's `sync-v2-preview-fixtures.mjs --check` are both kept.
  - `REQUIREMENTS.md`: F.2 keeps the F4-identity-site record; F.3 takes the
    lane's tone-gate record on top of the unchanged earlier text.
  - This file: both lanes' records are kept, the social lane after the
    family lane.
- Integration defect found by the merge gates, not caused by this lane:
  `agent/tools/check-behavioral-telemetry-parity.test.mjs` failed in
  `tools:test` on the integration branch. Its mutation fixture anchored on
  `'canary'` being the last Core context field, and the F4-mentor lane added
  `corroborationRollbackKcKeys` after it. The fixture now anchors on the last
  field; the gate itself is unchanged and the test is RED-then-green as
  designed.
- Verified on the merged tree: `typecheck:all`, `lint:all`, the backend
  suite (155 files, 3,556 tests), the frontend suite (283 files, 3,297
  tests), `spec:check` (the social tone gate reads 2,001 strings at 100%),
  `check-family-copy-tone.mjs` (4,800 strings, 100%), `secrets:check`, the
  i18n gate and `tools:test` (485 tests). Database: `check-migrations`,
  `check-migration-phase` and `check-family-lifecycle` pass on 240 files,
  and the `node --test` group passes (70 tests). `railway-migrate.test.mjs`
  again did not finish on this Windows machine (stopped after 400 s with no
  output; `bash` from a native process resolves to WSL here). It is left
  open for a Linux or CI run. The browser matrices and `audit:rebuild` were
  not run in this merge step.
