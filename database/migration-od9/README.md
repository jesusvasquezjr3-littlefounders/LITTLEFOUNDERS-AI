# OD-9 legacy-data migration toolkit

Owner log section 4 (OD-9) and OD-24: when the rebuild replaces the legacy platform, nothing a family was promised is lost, legacy defects are corrected rather than carried forward, identifiers stay the same, consent carries over only for what it covered, and every completed legacy topic credits the shared knowledge graph before the legacy catalog is retired.

Lane record: [`docs/rebuild/sprints/S10-CUTOVER.md`](../../docs/rebuild/sprints/S10-CUTOVER.md). Policy for the KC credit: [`S05-B6-PATHWAY-POLICY.md`](../../docs/rebuild/sprints/S05-B6-PATHWAY-POLICY.md), sections 6 and 7.

## What is here

| Path | Purpose |
|---|---|
| `od9.mjs` | The runner (`npm run od9 -- <command>` from `database/`). Drives the SQL through `psql`. |
| `sql/00_schema.sql` | The `od9` evidence schema: runs, inventories, identifiers, findings. Closed to every browser role and to the service role. |
| `sql/10_inventory.sql` | Section 4.1 and 4.5: per-account and per-family row counts and checksums of every promised record; section 4.4: usernames and guardian links verbatim; the before/after comparison. |
| `sql/20_defects.sql` | Section 4.3: A.5, A.2, A.3/A.4 and F.2, each with a dry run and an idempotent apply. |
| `sql/30_kc_credit.sql` | OD-24: completed legacy topics credit the KCs they teach (`public.legacy_kc_credits`); legacy course badges are frozen (Rule B5). |
| `sql/40_consent.sql` | Section 4.2: which migrated children lack a specific consent for each practice the rebuild introduced; apply marks them so the product enforces it. |
| `sql/60_retire_catalog.sql` | OD-24: archive the legacy catalog after the KC credit, refusing before it; never delete. |
| `sql/50_spot_check.sql` | Section 4.5: readable values (balances per pocket, streaks, XP, badges, reached goals, lessons passed, usernames) of a deterministic family sample, and the side-by-side comparison a person signs. |
| `backup-crypto.mjs` | H.5: encrypts a `pg_dump -Fc` file (AES-256-GCM, format LFBK1, manifest with digests and key fingerprint), decrypts and verifies it (`npm run od9:backup -- <keygen\|encrypt\|decrypt\|verify>`). |
| `rehearse-cutover.mjs` | The full local cutover rehearsal (`npm run od9:rehearse`): freeze, inventory, encrypted backup, verification, plan, migrations, toolkit, reconcile, smoke, switch, post-release, restore; timed. |
| `fixtures/generate-legacy-fixture.mjs` | Deterministic synthetic legacy dataset (no real data) with independently computed expectations. |
| `prove-od9-postgres.mjs` | The end-to-end proof on native PostgreSQL (`npm run od9:prove`). |
| `od9.test.mjs`, `backup-crypto.test.mjs` | Unit tests of the runner, the plan, the spot-check sheet, the backup encryption and the generator (part of `npm test`). |

The product side lives in the migration `*_od9_legacy_migration.sql`: `legacy_kc_credits`, the `data_practices` registry, `data_practice_consents`, `has_data_practice_consent`, `legacy_kc_credit_covers`, and a badge reader that keeps a frozen badge when its course is archived.

## Connecting

`--db "<libpq conninfo or URL>"`, else `OD9_DATABASE_URL`, else the libpq `PG*` variables. `psql` is taken from `LF_PG_BIN` when set, else from `PATH`. Reports are written as JSON to `--out` (default `audit-results/od9/`, which git ignores). The runner never connects anywhere on its own: it runs against the database it is given, so point it at a restored copy first.

## Procedure

Each step is safe to repeat. Every correction step has a dry run (no product row written) that is reviewed before `--apply`.

1. **Restore a copy** of the legacy database and rehearse the whole procedure on it. Never run a first apply on production. For the real cutover, hold the legacy platform read-only from step 3 to step 9: ordinary activity between the two inventories (a lesson passed, a coin earned) would show up in the comparison as a change.
2. `od9 install` — creates or refreshes the `od9` schema. Works on the legacy schema.
3. `od9 inventory --label before` — on the legacy database, before any rebuild migration. Captures 16 categories: lesson progress, placement credits, placement records, XP, learning streak, chore streak, coin balances, the coin ledger, course badges, savings goals (reached goals are the goal badges), chore history, rewards, Mentor plans, notebooks, memory and mastery; plus every username and guardian link.
4. Apply the migration chain (the operator's normal migration procedure), then `npm run seed:kc` in `backend/`.
5. `od9 install` again (the functions may have changed with the toolkit version).
6. `od9 defects`, review the report, then `od9 defects --apply`.
7. `od9 kc-credit`, review, then `od9 kc-credit --apply`. Run it **before** any legacy lesson is retired: a topic whose lessons are gone can no longer be shown complete.
8. `od9 consent`, review, then `od9 consent --apply`.
9. `od9 inventory --label after`, then `od9 compare --before before --after after`. Exit code 1 means a promised record, a family or an identifier changed; the report names each one. Section 4.5 requires this comparison, and per-family spot checks on balances, streaks and badges, to be **signed off by a person before the legacy platform is switched off**.
10. `od9 spot-check --label before --families 10` (at step 3) and `od9 spot-check --label after --from before` (at step 9) give the reviewer the readable values of the same families before and after, as a sign-off sheet (`spot-check-after.md`); exit 1 on a changed or missing value.
11. **T plus 7 days (OD-24):** `od9 retire-catalog`, review the list (every legacy course, adventure, saga, topic and lesson that existed at the `before` inventory, plus any learner whose complete topic still lacks its KC credit), then `od9 retire-catalog --apply`. It refuses without the `before` inventory or a recorded `kc-credit --apply`, and while any KC credit is missing; it archives only (never deletes), is idempotent, and snapshots `pre_retire` and `retired` inventories around the archive and compares them (exit 1 on any loss). The `legacy_catalog_delete_guard` migration refuses deleting a lesson, topic or course that any learner record depends on, for every role.
12. `od9 findings` lists what still needs a person (A.5 justifications, A.3/A.4 accounts that have not answered the age screen, consent gaps). Re-running a step resolves findings that no longer apply.

`od9 plan --applied-through NNNN` needs no database: it lists the migrations above the production high-water mark in the order they will be applied, their phase and what each contract migration waits for, and exits 1 if a header states an order the filenames break or a file declares no phase. The production procedure around all of this (freeze, encrypted backup, verification, switch, rollback) is [`docs/operations/CUTOVER-RUNBOOK.md`](../../docs/operations/CUTOVER-RUNBOOK.md) and [`BACKUP-RESTORE-ROLLBACK.md`](../../docs/operations/BACKUP-RESTORE-ROLLBACK.md).

`--cutover <ISO timestamp>` fixes the cutover instant for `defects` and `consent` (accounts created after it are not legacy). It defaults to now.

## Rules the toolkit enforces

- **Nothing promised is rewritten.** Progress, credits, XP, coins, streaks, goals, chores, rewards and Mentor records are only read. The comparison hashes the columns the legacy platform already had, so a column the rebuild adds never changes a checksum, and a category that cannot be read is reported as a gap, never skipped.
- **Retire legacy content by archiving it, never by deleting it.** `lesson_progress`, `placement_credits`, `course_placements` and `course_pathway_badges` cascade when a lesson or course row is deleted. Archiving keeps them, and a frozen badge stays visible after its course is archived (this lane's badge reader).
- **No age is invented.** A.2: a legacy guest with a stored birth date gets the declaration that date implies; one with no age evidence gets the protective under-13 marker (the refusal path cannot be ruled out). A.3/A.4: an account with no evidence is flagged; Core already makes the age screen mandatory for any account without a declaration, and treats it as a child until then (Rule P3). An account whose stored birth date answers the screen gets its declaration from that date.
- **A.5 never removes a parent role.** An unjustified staff grant is marked `staff-granted` (the distinct trust level A.5 requires) and stays `review_required` until a staff member records a justification. A parent role that outlived a revoked verification is flagged for review only.
- **F.2.** Migration 0109 gave every legacy share the 30-day window from its own creation date; the step catches any public share whose window is still longer and applies the default.
- **OD-24 credit** follows Rules E1, E2, T3 and B5 of the B.6 policy: only complete topics (every published lesson passed or placement-credited), only the KCs a topic *teaches*, recorded with the stage of the legacy chapter. The credit satisfies prerequisites at every stage and opens a new topic that teaches the same skill as "known" (Rule F8); it never completes a new topic. `legacy_kc_credit_covers` answers the equivalence rule (same KC, same or older stage content) for the reviewed lesson equivalences of the Forge phase.
- **Consent (section 4.2).** The registry `public.data_practices` lists the 15 practices the rebuild introduced (analytics event classes, Mentor memory types, sharing surfaces, a learner record and the D.22 research instrumentation; the cooperative goals practice was registered by `*_cooperative_goals_data_practice.sql`) with who may consent. Every later table tying two accounts must name a registered practice (`backend/src/__tests__/dataPractices.test.ts`). A migrated child is any legacy account whose youngest possible age is under 18 or unknown; role is never evidence. `od9 consent --apply` marks every migrated child in `public.legacy_consent_subjects` (S10.3, migration `*_od9_consent_enforcement.sql`); from then on each rebuild practice applies to that child only with its specific consent. `data_practice_applies(subject, practice)` answers it, BEFORE triggers on the practice tables skip the row (or strip the practice's columns) when it does not apply, a social request or a bridge prompt is refused by name, and Core asks before the one write that carries no child identifier (the achievement-share count). A consent counts only while its grantor may still give it (a Tutor grant lapses with the guardian link; a teen's own yes only for the usage counts, and only while no Tutor is linked). A verified Tutor answers in the Family Hub (`/family-hub/kids/:kidId/data-practices`); the account itself answers at `/family-hub/data-practices/me` (a child's own no always counts). The mark is released when a later consent run finds adult age evidence. Until the step runs, the table is empty and every practice applies as before.

## Proving it

```bash
cd database
LF_PG_BIN=<psql dir> LF_PG_PORT=<port> LF_PG_USER=<superuser> LF_PG_DATA=<data dir> npm run od9:prove
```

`npm run od9:rehearse` (same variables, plus `LF_OD9_FAMILIES` to scale the synthetic dataset) rehearses the whole cutover runbook on a disposable database and writes `audit-results/od9/rehearsal/<database>/rehearsal.json` with the timing of every phase.

The proof refuses any cluster whose data directory is not `LF_PG_DATA`. It builds the legacy schema, loads the synthetic dataset, applies the rest of the chain over it, runs every step as dry run, apply and re-apply, retires the legacy catalog, and requires the before/after comparison to pass; a tampered copy must fail it. Report: `audit-results/od9/prove-od9-postgres.json`.
