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
