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
