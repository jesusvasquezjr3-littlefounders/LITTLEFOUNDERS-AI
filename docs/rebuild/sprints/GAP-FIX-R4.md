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
