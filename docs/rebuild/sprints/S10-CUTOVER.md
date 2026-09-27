# S10: legacy-data migration and cutover toolkit

Status: in progress (S10.1 and S10.2 implemented and locally verified on native PostgreSQL; no production run, sign-off, acceptance or release approval is recorded). Recorded 27 September 2026 on branch `codex/spec-s10data`. Owner: Engineering for implementation; the owner for the decisions listed at the end; an operator and a named reviewer for the section 4.5 sign-off.

## Binding acceptance sources

- Owner log section 4 (OD-9): 4.1 nothing promised is lost, 4.2 consent carries over only for the practices it covered, 4.3 legacy defects are flagged and corrected (A.5, A.2, A.3/A.4, F.2), 4.4 usernames and guardian links unchanged, 4.5 row counts and per-family spot checks signed off before the legacy platform is switched off.
- OD-24: the legacy catalog is replaced, every earned record kept, and every completed legacy topic credits the matching knowledge components so new courses start learners at the right place.
- `S05-B6-PATHWAY-POLICY.md` rules E1, E2, T3, F8, B4, B5 and the legacy-credit equivalence (section 6). OD-13 (the default share window), OD-20 (no new public badge links), OD-23 (zero spend).

Risk classification: **data migration of every family's record**. A defect here loses what a family earned or carries a legacy safety defect into the new platform, so every step is dry-run first, idempotent, and proven against the real migration chain.

## Point-by-point checkpoints

| ID | Scope | Acceptance | State |
|---|---|---|---|
| S10.1a | Before/after inventory (4.1, 4.5) | Every promised category counted and checksummed per account and per family on the legacy and the migrated schema; a comparison that fails on any loss | Implemented and locally verified |
| S10.1b | Legacy defects (4.3) | A.5, A.2, A.3/A.4 and F.2 each flagged with a dry run and corrected by an idempotent apply, audited, never inventing an age or removing a parent role | Implemented and locally verified |
| S10.1c | OD-24 KC credit | Completed legacy topics credit the KCs they teach, durable past the content's retirement; Core reads them as course evidence; badges frozen | Implemented and locally verified |
| S10.1d | Identifiers (4.4) | Usernames and guardian links compared verbatim | Implemented and locally verified |
| S10.1e | Consent carry-over (4.2) | Rebuild practices listed with the consent each needs; migrated children lacking it marked | Implemented and locally verified (marking only; see open items) |
| S10.1f | Synthetic fixture and native proof | No real data; the full chain applied over legacy data; expectations computed independently | Locally verified |
| S10.2a | Cutover runbook | Ordered steps: freeze, backup, verify backup, migrations by hand in their stated order, OD-9 toolkit, reconcile, smoke checks, switch, post-release checks | Written; rehearsed locally (production execution is an owner step) |
| S10.2b | Backup, restore and rollback | Encrypted backup (H.5), restore rehearsal procedure, rollback decision points and steps | Written; encryption, verification and restore rehearsed locally; the Supabase database swap not rehearsed |
| S10.2c | Migration plan | Pending migrations in apply order with phase and stated waits; refuses an order the filenames break | Implemented and locally verified |
| S10.2d | Section 4.5 spot check | Readable values of a deterministic family sample before and after, as a sign-off sheet | Implemented and locally verified (the signature is a person's) |
| S10.2e | Full local rehearsal | Backup, migrate, toolkit, reconcile, restore on native PostgreSQL with the synthetic dataset, timed | Locally verified at two volumes |

## S10.1 what was built

**Toolkit** `database/migration-od9/` (README there is the operator procedure): a Node runner (`npm run od9 -- <command>` in `database/`) over five idempotent SQL files that install an `od9` evidence schema closed to every browser role and to the service role.

- **Inventory** (`sql/10_inventory.sql`): 16 categories per account (lesson progress, placement credits, placement records, XP, learning streak current and best, chore streak current and best, coin balances per pocket, the coin ledger, course badges through the badge reader, savings goals including reached-goal badges, chore history, rewards, Mentor plans, notebooks, memory and mastery), each with a row count and an md5 over a canonical `jsonb` form under UTC. Only columns the legacy platform had are hashed, so a rebuild column never changes a checksum; an unreadable category is recorded as a gap. Families are the connected components of the live guardian graph. Usernames and guardian links are captured verbatim. `compare` fails on a changed or missing account row, a changed family, a new gap, or a changed or missing identifier; new records after are informational.
- **Defects** (`sql/20_defects.sql`): A.5 — a parent role with no ID-verified latest verification and no `admin.parent_role_justification` audit row is marked `staff-granted` (a new `parent_verifications` row, the distinct trust level A.5 asks for) and kept `review_required`; a later justification resolves it; a role that outlived a revoked verification is flagged for review only; no role is removed. A.2 — a legacy guest with a stored birth date gets the declaration that date implies (under 13 includes the origin marker); a guest with no age evidence gets the protective under-13 marker. A.3/A.4 — Google and other accounts with no age evidence are flagged; nothing is invented, since Core already makes the age screen mandatory for any account without a declaration and treats it as a child until then. Carry-over — an account whose profile or ID-verified birth date answers the screen gets its declaration from it. F.2 — any live share whose window is longer than the 30-day default gets it from its own creation date. Every data change writes an `audit_logs` row (`od9.<kind>`) and an `od9.findings` row.
- **OD-24 KC credit** (`sql/30_kc_credit.sql`): a topic is complete when every published lesson is passed or placement-credited (E1); each KC it *teaches* (never *reviews*) is credited with the legacy chapter's stage, basis (lessons passed, placement credit or mixed), lesson count, completion date and map version. The same run re-freezes every badge the live rule grants (B5), so badges earned after the 0123 backfill are frozen before content is retired.
- **Consent** (`sql/40_consent.sql`): for every legacy account whose youngest possible age is under 18 or unknown (role is never evidence), each rebuild practice is `consented` or `missing`, with who could give it: the verified Tutor, the teen themselves for H.1-style analytics classes only, or nobody yet (`none_available`: a guest, or an independent teen for a guardian-only practice).

**Migration** `*_od9_legacy_migration.sql` (expand, 16.9 KB): `legacy_kc_credits` (source topic kept as values, not foreign keys, so retiring the topic never removes the credit; RLS: the learner and their verified Tutor read, the service role inserts), `legacy_kc_credit_covers` (the equivalence rule: same KC, same or older stage content), the `data_practices` registry seeded with 14 practices, `data_practice_consents` (RLS: the child and their verified Tutor read, the service role writes), `has_data_practice_consent`, and `get_completed_course_badges` rewritten so a stored badge survives its course being archived.

**New finding fixed here:** the 0125 badge reader filtered stored badges on `courses.status = 'published'`, so retiring a legacy course (OD-24) would have hidden every frozen badge of it from the profile, the Family Hub and the B.2 check. The rewrite keeps stored badges of published and archived courses; the live rule is unchanged. **Second finding (documented, not code):** `lesson_progress`, `placement_credits`, `course_placements` and `course_pathway_badges` cascade on delete of a lesson or course, so the legacy catalog must be retired by archiving, never deleting.

**Core** (`backend/src/services/pathway/`): `pathwayData.ts` reads the learner's `legacy_kc_credits` (active KCs only, as the Mentor does; a failed read is 502, never "no credit"); `pathwayPolicy.ts` counts them as course evidence under E2, so a new course opens a topic whose skill a completed legacy topic taught as "known" (F8) and unblocks its dependents, without completing anything (B2).

**Fixture** `fixtures/generate-legacy-fixture.mjs`: a seeded generator (no real data; `example.test` addresses) writing against the legacy schema: named populations for every defect (a staff-granted parent with and without a justification, a parent with a revoked verification, guests with no, child and adult birth dates, Google accounts with and without one, an email account without one, an independent 15-year-old, kids with and without a birth date) plus 12 random verified families; a catalog built from real B.6 map paths (the whole lemonade stand, two financial-education sagas at tier 1, one entrepreneurship saga at tier 4; a draft lesson that must never count). It returns expectations computed in JavaScript, independently of the SQL.

## S10.1 verification (27 September 2026)

- `npm run od9:prove` on the lane's portable PostgreSQL 17.6 (port 15480, data under `.lane-cache/pg`), 13 checks, about 140 s: the legacy schema (82 migrations, through `0082_rename_banking_accounts.sql`) with 54 accounts, 479 progress rows and 76 ledger rows; the before inventory with no gap; the three correction steps refused on the legacy schema (`OD9_REBUILD_SCHEMA_REQUIRED`); the remaining 97 migrations applied over that data; each step's dry run writes no product row and reports exactly the independent expectation; apply performs it and a second apply writes nothing; 307 KC credits equal to the independently computed set, with all three bases; covers-rule checks in both directions; 476 consent gaps over 34 children with the expected grantor split, a granted consent resolving its gap and a revoked one no longer counting; after retiring the whole legacy catalog, 0 comparison failures, 24/24 families identical; a one-day streak change and one renamed username fail exactly at that account, family and identifier; the 0125 reader restored hides the archived course's badge and this migration brings it back; RLS and grants through the browser roles. Report: `audit-results/od9/prove-od9-postgres.json` (git-ignored).
- `database`: `check-migrations`, `check-migration-phase` (134 expand, 45 contract), `check-family-lifecycle` and 37 node tests including the 9 new toolkit tests passed. The Railway transport test was not rerun in this checkpoint (lean mode); the migration is under the size cap.
- `backend`: type-check and lint passed; focused tests passed: `pathwayPolicy` (45, one new), `learnPathway` (24, three new: legacy credit opens the topic as course evidence without completing it; no cross-learner leak and drafts ignored; 502 on an unreadable credit table), `learnNarrative`, `coursePathway`, `kcTopicMap`, `topicKcSeed`, `family` (68).
- Not run here (orchestrator per merge): full backend suite, root `test:all`, browser matrices.

## S10.2 what was built

**Runbooks.** [`docs/operations/CUTOVER-RUNBOOK.md`](../../operations/CUTOVER-RUNBOOK.md): roles, the before-the-window checklist (rehearsal on a restored copy, the frozen plan, the held release, Legal and the family notice, the backup key, go/no-go) and ten ordered steps: freeze (every scheduled workflow and `database-cd.yml` disabled; the Supabase login roles `authenticator`, `supabase_auth_admin` and `supabase_storage_admin` made read-only, verified with a refused write), before inventory and spot sample, encrypted backup, backup verification, migrations by hand in plan order (expand, deploy, contract, `seed:kc`), toolkit (dry run, review, apply), reconcile, smoke checks while still frozen, switch, and post-release checks at 15 minutes, 1 hour, 1 day and 7 days. [`docs/operations/BACKUP-RESTORE-ROLLBACK.md`](../../operations/BACKUP-RESTORE-ROLLBACK.md): the H.5 encryption status of every backup, key custody, taking and verifying the cutover backup, the restore rehearsal procedure, and rollback decision points A to E with the restore steps (restore into a fresh database, verify, swap by rename, keep the failed database, redeploy the legacy release).

**Toolkit additions** (`database/migration-od9/`):

- `backup-crypto.mjs` (`npm run od9:backup`): AES-256-GCM encryption of a `pg_dump -Fc` file (format LFBK1: magic, IV, ciphertext, tag) with a manifest holding both SHA-256 digests, the sizes and the key fingerprint (never the key). Decrypt refuses a wrong key before decrypting, a damaged or altered file, and a plaintext whose digest differs from the manifest, and leaves no output when it refuses. `keygen` refuses to overwrite a key. The plaintext is deleted after encryption.
- `od9 plan --applied-through NNNN` (no database): the pending migrations in apply order with phase and `@after-release` text, the orderings each header states ("after X", "before Y", `prefix_*` globs) resolved to files, and exit 1 on an order the filenames break or an undeclared phase. On the current chain above the legacy baseline: 97 pending, 68 expand, 29 contract, 15 files stating orderings, no violation (pinned by a unit test over the real chain).
- `od9 spot-check` (`sql/50_spot_check.sql`, table `od9.spot_values`): readable values (account, username, XP, learning and chore streaks current/best, coins per pocket, lessons passed, course badges, reached goals) for a deterministic sample of families (multi-member families first, ordered by md5 of the family key); with `--from`, the side-by-side comparison against the earlier sample. Exit 1 on a changed or missing value. Writes the section 4.5 sign-off sheet `spot-check-<label>.md`.
- `rehearse-cutover.mjs` (`npm run od9:rehearse`): the runbook end to end on a disposable database of the lane cluster (phases R0 to R12 below). It refuses any cluster that is not `LF_PG_DATA` and deletes the key and every plaintext dump when it ends; `LF_OD9_FAMILIES` scales the synthetic dataset.

**Defect found and fixed.** In the volume rehearsal `od9 compare` ran for minutes once a third inventory label existed (the planner chose nested loops over stale statistics on `od9.inventory`); the same comparison with hash joins took 0.4 s. `compare_inventory` now runs with `enable_nestloop = off`, and `capture_inventory` analyzes `od9.inventory` and `od9.identifiers` after each capture. At production volume this would have stalled the post-release or rollback comparison inside the window.

**Finding (documented, owner decision).** The daily `vault-backup.yml` and `pulse-backup.yml` dumps are plaintext `pg_dump -Fc` files on the Depot volume; their encryption at rest depends on Railway's volume encryption, which nothing in the repository confirms. The backup document treats them as unencrypted until the ops owner confirms (GOVERNANCE section 5 makes that release-blocking) and recommends piping them through `backup-crypto.mjs encrypt`.

## S10.2 verification (27 September 2026)

Full local rehearsal on the lane's portable PostgreSQL 17.6 (port 15480, data under `.lane-cache/pg`), synthetic data only, no production, no provider. Each phase asserts its result and the run stops at the first miss. Seconds per phase:

| Phase | 12 random families (54 accounts, 479 progress rows) | 1,500 random families (4,971 accounts, 58,761 progress rows, 7,160 ledger rows) |
|---|---|---|
| R0 legacy stand-in: 82 legacy migrations and the dataset (not part of the window) | 19.1 | 42.6 |
| R1 freeze: `authenticated` and `service_role` writes refused (`read-only transaction`); operator override | 0.4 | 0.3 |
| R2 before inventory (18 categories and identifier sets, no gap) and spot sample of 5 families | 0.7 | 1.7 |
| R3 backup: `pg_dump -Fc` (0.5 MB / 6.0 MB) encrypted, plaintext deleted, no `PGDMP` signature in the stored file | 0.3 | 0.7 |
| R4 verify: a flipped byte and a wrong key refused; decrypt with digest check; 867 TOC entries; restore to scratch; inventory equals before (24/24 and 1,512/1,512 families); spot values equal | 5.0 | 5.7 |
| R5 plan: 97 pending (68 expand, 29 contract), no violation, identical to the chain order | 0.0 | 0.0 |
| R6 migrations in plan order over the frozen data (expand / contract seconds 13.1 / 5.0 and 13.3 / 4.2; slowest `0119_social_age_tiers` at 2.0 s at volume) | 18.1 | 17.4 |
| R7 toolkit dry run, apply, re-apply, equal to the fixture's independent expectations (307 / 37,293 KC credits; 476 / 42,084 consent gaps over 34 / 3,006 children) | 2.4 | 12.1 |
| R8 reconcile: 0 failures, every family identical, spot check 103/103 and 86/86 values same | 0.7 | 2.0 |
| R9 smoke: KC credits read by the learner and verified Tutor only; a frozen badge through Core's reader, which stays closed to browser roles; registry and helper; od9 closed; freeze still holding | 1.2 | 1.1 |
| R10 switch: freeze lifted, an application write succeeds | 0.3 | 0.3 |
| R11 post-release: post-switch inventory equals after; findings queue counted (485 / 42,374 open) | 0.6 | 2.0 |
| R12 restore: decrypt and restore into a fresh database equal to the pre-migration state (families identical, no rebuild table, no finding, spot values equal); negative control: one extra day on one sampled best streak fails the spot check at exactly that value | 3.6 | 6.0 |
| Cutover path R1 to R12 | 33 | 49 |

Reports: `audit-results/od9/rehearsal/<database>/rehearsal.json`, with the per-step JSON and sign-off sheets beside it (git-ignored).

Also run: `npm run od9:prove` (the S10.1 proof, 13 checks) passes after the SQL changes; the `database` package tests (16 toolkit tests, 7 new: plan parsing and violations, the real chain, spot-check arguments and sheet, backup round trip, refusals, keygen and CLI) with `check-migrations`, `check-migration-phase` and `check-family-lifecycle`; root `spec:check` and `secrets:check`. No migration in this checkpoint.

What the local rehearsal does not show: production volume and network time (the dump and restore travel over `railway ssh`), the Supabase services under a role-level freeze, the database swap by rename under Supabase, the real deploys, and a human reviewer's signature. The runbook keeps each as an owner step, and the backup document requires the swap to be rehearsed on a Railway copy.

## Open items

- The toolkit has not run against a restored copy of production data; the section 4.5 sign-off (a person reviewing the comparison and per-family spot checks) is outstanding by design.
- Consent: the registry and the per-child marks exist, but no Core route lets a Tutor grant a `data_practice_consents` row yet, and no consumer gates its practice on `has_data_practice_consent` for migrated children. Until both exist, section 4.2 is marked, not enforced.
- Upgraded former guests cannot be told apart from accounts that were never guests (Supabase keeps no history), so A.2 correction reaches only accounts that are still anonymous.
- The fixture's retirement step archives rows with triggers bypassed; the real retirement path (a release function that archives the legacy catalog) belongs to the Forge phase and must be followed by `od9 inventory --label after` and `compare`.
- `legacy_kc_credit_covers` is ready for the Forge phase's reviewed lesson equivalences; no new course content consumes it yet.
- S10.2: the runbooks have not been executed against production or a Railway copy. The Supabase database swap by rename (rollback step 4) and the role-level freeze with the Supabase services restarted are unrehearsed. The daily backups' encryption at rest is unconfirmed (H.5). The product has no maintenance page, so writes fail with an error during the freeze. Legal sign-off of the consent carry-over and the family notice are outstanding.

## Owner questions (conservative defaults implemented)

1. **Unjustified staff-granted parents (A.5).** Default: keep the role, mark it `staff-granted`, require a staff justification (review queue); never revoke automatically. Alternative: revoke roles still unjustified after a deadline.
2. **Legacy guests with no age evidence (A.2).** Default: the protective under-13 marker (the refusal path cannot be ruled out); it lifts only through a verified guardian link or adult evidence, as A.2 requires. Alternative: mark only guests created after the refusal path shipped.
3. **Consent registry.** Default: the 14 practices listed in the migration, with self-consent for teens only on the seven analytics classes (H.1 model) and a verified Tutor for Mentor memory types, sharing surfaces, the decision journal and research. Please confirm the list and the grantor rule.
4. **Unknown age in the consent step.** Default: an account with no age evidence is a child until the age screen answers (Rule P3), so adults who never gave an age are marked too. Alternative: exclude accounts holding a parent role.
5. **Daily backup encryption (H.5).** Default: the daily Vault and Pulse dumps are treated as unencrypted until the ops owner confirms Railway volume encryption. Recommended: encrypt each daily dump with `backup-crypto.mjs` and a key held in a GitHub secret; that changes a production workflow, so it is not done in this lane.
6. **Cutover freeze scope.** Default: all three Supabase login roles read-only for the window (sign-in and sign-up pause too) and every scheduled workflow disabled, with families told in advance. Alternative: keep `supabase_auth_admin` writable so sign-in works, accepting sign-ups that fail at profile creation.
7. **Rollback after the switch (decision point E).** Default: fix forward; a restore after the switch only for a data-integrity or child-safety incident, decided by the owner, with the lost writes captured first and families told. Please confirm, and name the time after which a restore is no longer considered.
