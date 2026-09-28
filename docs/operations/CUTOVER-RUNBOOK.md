# Cutover runbook: legacy platform to the rebuild

The ordered procedure for switching production from the legacy platform to the rebuilt one, with the OD-9 legacy-data migration (owner log section 4) and the OD-24 knowledge-component credit in the middle of it. Backups, the restore procedure and every rollback decision are in [`BACKUP-RESTORE-ROLLBACK.md`](BACKUP-RESTORE-ROLLBACK.md); the toolkit itself is documented in [`database/migration-od9/README.md`](../../database/migration-od9/README.md).

**Status (27 September 2026).** Rehearsed end to end on a local native PostgreSQL with synthetic data (evidence and timings: [`docs/rebuild/sprints/S10-CUTOVER.md`](../rebuild/sprints/S10-CUTOVER.md), section S10.2). It has **never been run against production**. Running it in production, the section 4.5 sign-off and the Legal sign-off are owner steps.

## Roles

| Role | Who | Does |
|---|---|---|
| Owner | The product owner | Chooses the window, gives the go at each decision point, signs the go/no-go record |
| Operator | One engineer with Railway and database access | Runs every command in this document, keeps the log |
| Reviewer | A second person, not the operator | Reviews the dry-run reports and the comparison, signs the section 4.5 spot-check sheet |
| Legal | Legal counsel | Signs off the consent carry-over (section 4.2) and the family notice before the window |

Keep one timestamped log of the window (command, time, result, who decided). The log, the reports under `audit-results/od9/` and the signed sheets are the cutover record.

## Before the window

1. **Rehearse on a restored copy.** Restore the latest production backup into a disposable database (never production), and run this whole runbook against it, including the restore at the end. Record the timings; they size the window. `npm --prefix database run od9:rehearse` repeats the local rehearsal on synthetic data.
2. **Freeze the plan.** From `database/`: `npm run od9 -- plan --applied-through <production high-water mark>`. It lists every pending migration in the order it will be applied (filename order, one transaction per file), marks each `expand` or `contract`, prints what each contract migration waits for, and refuses (exit 1) if a header states an order the filenames break or a file declares no phase. Keep `plan-NNNN.md` as the window's checklist. The high-water mark is the last receipt in production's `public.schema_migrations`; `db:railway:migrate -- --dry-run` prints it.
3. **Build and hold the release.** Every service at the commit that matches the plan passes its gates (README "Mandatory testing"). The Railway and Vercel deploys are prepared but not promoted.
4. **Legal and families.** Legal has signed off the consent carry-over list (`public.data_practices`) and the family notice. Families are told the window in advance: the platform is read-only during it (by the owner, through the normal family channel).
5. **Backup key.** Generate the cutover backup key with `node database/migration-od9/backup-crypto.mjs keygen --key-file <path outside the repository>` and store it in the team's secret store under two custodians. Confirm (H.5) the encryption status of the daily backups (see the backup document, section 1).
6. **Go/no-go meeting (T minus 1 day).** The rehearsal passed, the plan is refused-free, the release is green, Legal has signed, the window is announced, the reviewer is booked. Any "no" moves the window.

## The window

Times are from the rehearsal at the largest synthetic volume (section S10.2 of the lane record); a production copy's rehearsal replaces them.

### Step 1. Freeze

Nothing a family was promised may change between the two inventories: an ordinary lesson or coin between them would show up in the comparison as a change.

1. Stop the automatic migration path and every scheduled job, so nothing runs in the window. On 27 September 2026 that is `database-cd.yml` plus the scheduled workflows `account-deletion`, `badge-link-retirement`, `family-retention`, `insights-maintenance`, `mentor-bias-audit`, `mentor-evaluation-loop`, `mentor-live-content-monitor`, `mentor-review-routing-audit`, `nsm-weekly-export`, `pulse-backup`, `social-retention`, `tutor-content-bridge`, `tutor-retention`, `tutor-skill-curation`, `vault-backup` and `vault-drift` (`gh workflow disable <file>` for each; list again with `grep -l "schedule:" .github/workflows/*.yml` in case one was added). Leave `tutor-retention-watch` enabled and expect it to report the pause. The window's own backup (step 3) replaces the daily one.
2. Make the application roles read-only (the Supabase login roles every product write goes through), then restart those services so pooled connections pick it up:
   ```sql
   ALTER ROLE authenticator SET default_transaction_read_only = on;
   ALTER ROLE supabase_auth_admin SET default_transaction_read_only = on;
   ALTER ROLE supabase_storage_admin SET default_transaction_read_only = on;
   ```
   The operator's role (`supabase_admin`) is not affected. Restart the `rest`, `auth` and `storage` services.
3. **Verify the freeze.** A write through PostgREST with the service key (for example a no-op update of one test account's `learning_stats`) must fail with `cannot execute UPDATE in a read-only transaction`. If it succeeds, the freeze did not take: stop here.

The rehearsal freezes the whole database with `ALTER DATABASE … SET default_transaction_read_only = on` and gives the operator's sessions an explicit override; both application roles it tested were refused. Production freezes the login roles instead, because Supabase's own services reach the database through them.

### Step 2. Before inventory

From `database/`, with `OD9_DATABASE_URL` pointing at production as the operator (read the toolkit README, "Connecting"):

```bash
npm run od9 -- install
npm run od9 -- inventory --label before
npm run od9 -- spot-check --label before --families 10
```

The inventory must report every category `captured` (no `absent:` line). The spot check draws a deterministic sample of families and records their readable values (balances per pocket, streaks, XP, badges, reached goals, lessons passed, usernames).

### Step 3. Backup

Take a fresh backup now, after the freeze, so it holds exactly the state the inventory describes. Follow [`BACKUP-RESTORE-ROLLBACK.md`](BACKUP-RESTORE-ROLLBACK.md) section 2: `pg_dump -Fc`, encrypt immediately with the cutover key, delete every plaintext copy, store the encrypted file and its manifest in two places.

### Step 4. Verify the backup

Section 3 of the backup document: decrypt, `pg_restore --list`, restore into a scratch database, run `inventory --label backup_check` there and `compare --before before --after backup_check`, and `spot-check --label backup_check --from before`. **Decision point A:** if the backup does not verify, lift the freeze (reverse step 1) and move the window. Nothing has changed yet.

### Step 5. Apply the migrations by hand, in plan order

1. **Expand migrations** in the plan that production does not have yet are applied first; they are safe with the legacy code, so the legacy platform could still be reopened on them without a restore.
2. **Deploy the new services** (Core before Oracle when a wire shape changed, per README), still frozen.
3. **Contract migrations**, in the plan's order, each after the release it names (`@after-release`). The transport applies every pending file in filename order, one transaction per file, which the plan has checked against every stated order:
   ```bash
   RAILWAY_TOKEN=… RAILWAY_SSH_KEY_PATH=… npm --prefix database run db:railway:migrate -- --dry-run            # must list exactly plan-NNNN.md
   RAILWAY_TOKEN=… RAILWAY_SSH_KEY_PATH=… npm --prefix database run db:railway:migrate -- --confirm-production
   ```
   Tick each file on `plan-NNNN.md` as its receipt appears. The Railway CLI does not return remote exit codes: read the output.
4. `npm run seed:kc` in `backend/` (the KC graph the OD-24 credit maps onto).

**Decision point B:** a migration failed. Its own transaction rolled back. If only expand migrations have been applied, the legacy platform can be reopened on this schema (roll back the service deploys, lift the freeze). Once any contract migration is in, the legacy code cannot run on the schema: fix forward within the window, or restore (backup document, section 5).

### Step 6. Run the OD-9 toolkit

Each step is a dry run, reviewed by the reviewer, then applied. The cutover instant is the time the freeze took effect.

```bash
npm run od9 -- install
npm run od9 -- defects   --cutover <freeze time, ISO>        # review, then:
npm run od9 -- defects   --cutover <freeze time, ISO> --apply
npm run od9 -- kc-credit                                     # review, then:
npm run od9 -- kc-credit --apply
npm run od9 -- consent   --cutover <freeze time, ISO>        # review, then:
npm run od9 -- consent   --cutover <freeze time, ISO> --apply
```

What each step corrects and what it never touches is in the toolkit README ("Rules the toolkit enforces").

### Step 7. Reconcile

```bash
npm run od9 -- inventory --label after
npm run od9 -- compare --before before --after after          # exit 1 on any lost or changed record, family or identifier
npm run od9 -- spot-check --label after --from before         # exit 1 on any changed or missing value
```

The reviewer reads the comparison report and signs the spot-check sheet (`spot-check-after.md`, section 4.5). **Decision point C:** any failure means no switch. Find the cause in the report (it names the account, family and category); if it cannot be fixed within the window, restore.

### Step 8. Smoke checks (still frozen)

Reads only; the freeze stays on.

- Core, Oracle and every service `/health` green on the new release.
- As a seeded QA family (never a real family): the learner's course map opens topics credited by the legacy record as known; the Family Hub shows the same balances and streaks as the spot-check sheet; a frozen legacy badge is visible on the profile.
- `npm run od9 -- findings`: the counts match the dry runs (A.5 justifications, A.3/A.4 accounts awaiting the age screen, consent gaps).
- Consent enforcement (section 4.2): `SELECT count(*) FROM public.legacy_consent_subjects WHERE released_at IS NULL` equals the consent step's `children`; for the QA child, `public.data_practice_applies(<child>, 'mentor.disposition_profile')` is false until the QA Tutor says yes in the Family Hub, then true.

**Decision point D:** a smoke check failed. Fix forward if the cause is in a service (redeploy), otherwise restore.

### Step 9. Switch

1. Lift the freeze: `ALTER ROLE <role> RESET default_transaction_read_only;` for the three roles, then restart `rest`, `auth` and `storage`.
2. Promote the frontend release (Vercel), confirm the build actually happened (a push does not imply a deploy).
3. One real write as the QA family (complete a lesson) succeeds.
4. Re-enable the workflows disabled in step 1 (the retention sweeps first: their promises to families have dates).

Record the switch time. From here on, families write to the new platform, and a restore would lose those writes (decision point E, backup document).

### Step 10. Post-release checks

- **T plus 15 minutes:** `npm run od9 -- inventory --label post` and `compare --before after --after post`: no promised record changed by the switch itself (new records after are informational).
- **T plus 1 hour:** error rates on Core and Oracle at their normal level; the first scheduled jobs ran green after re-enabling.
- **T plus 1 day:** the daily backup ran and verified (encrypted); the findings queue is assigned: A.5 justifications to staff, consent gaps to the Tutor-consent flow, undated accounts to the age screen.
- **T plus 7 days:** retire the legacy catalog with the toolkit: `npm run od9 -- retire-catalog` (dry run: the rows to archive and any learner still missing a KC credit), then `npm run od9 -- retire-catalog --apply`. It refuses without the `before` inventory or a recorded `kc-credit --apply`, archives only (never deletes; the database refuses deleting a catalog row learners depend on), and compares the `pre_retire` and `retired` inventories it captures around the archive: exit 1 on any loss.

## What is not in this runbook

- The reviewed lesson equivalences of the Forge phase (the legacy catalog's retirement itself is step 10, T plus 7 days).
- A maintenance page: the product has none, so during the freeze writes fail with an error. The family notice sets that expectation.
