# Backup, restore and rollback

How the cutover backup is taken and encrypted, how a restore is rehearsed and verified, and when and how the cutover is rolled back. The ordered cutover is [`CUTOVER-RUNBOOK.md`](CUTOVER-RUNBOOK.md); the incident-response baseline is [`GOVERNANCE.md`](GOVERNANCE.md) section 5.

**Status (27 September 2026).** The encrypted backup, its verification and the restore were rehearsed locally on native PostgreSQL 17.6 with synthetic data (lane record [`S10-CUTOVER.md`](../rebuild/sprints/S10-CUTOVER.md), section S10.2). No production backup has been encrypted with this procedure yet, and no production restore has been rehearsed with it. Both are owner steps.

## 1. Encryption at rest (H.5)

Backups hold family and Mentor data, so H.5 requires them to be encrypted at rest and the status to be written down.

| Backup | How it is made | Encrypted at rest? |
|---|---|---|
| Cutover backup (this document) | `pg_dump -Fc`, then AES-256-GCM with `database/migration-od9/backup-crypto.mjs` before it is stored anywhere; plaintext deleted | **Yes**, by the file itself, whatever the storage does. Proven locally (section 6) |
| Daily Vault backup (`vault-backup.yml`) | `pg_dump -Fc` copied to the runner, encrypted there with `database/migration-od9/backup-crypto.mjs` (key: the `BACKUP_ENCRYPTION_KEY` GitHub secret), plaintext deleted; only the `.dump.lfbk` file and its manifest are written to `/data/backups` on the Depot (filebase) Railway volume | **Yes, by the file itself** once the change is live. The workflow fails on a missing key, an empty ciphertext or a surviving plaintext, and `agent/tools/backup-workflows.test.mjs` refuses a backup workflow that uploads a file without the `.lfbk` suffix. Owner steps: create the secret (keygen below) and push the workflow. Dumps written before the change are plaintext and age out with the 30-day prune |
| Daily Pulse backup (`pulse-backup.yml`) | Same pattern, analytics database (`pulse-*.dump.lfbk`) | Same as above |

Restoring a daily backup uses the procedure below unchanged: decrypt the `.lfbk` file with the key whose fingerprint its manifest names, then `pg_restore`.

### The key

- `node database/migration-od9/backup-crypto.mjs keygen --key-file <path>` writes 32 random bytes (base64). It refuses to overwrite an existing key.
- The key lives in the team's secret store under two named custodians, **never** next to the backup, never in the repository, never in a chat or ticket.
- Every encrypted file has a manifest (`<file>.manifest.json`) with the key's fingerprint (the first 16 hex of its SHA-256), so the right key can be identified without revealing it. A restore with another key is refused before any decryption.
- Losing the key loses the backup. Check the custodians can both retrieve it before the window.

## 2. Taking the cutover backup

After the freeze and the before inventory (runbook steps 1 and 2):

```bash
# 1. Dump inside the db service, copy it out, remove the remote copy.
railway ssh --service db -i <key> -- pg_dump -U supabase_admin -d postgres -Fc -f /tmp/cutover.dump
railway ssh --service db -i <key> -- cat /tmp/cutover.dump > cutover.dump
railway ssh --service db -i <key> -- rm -f /tmp/cutover.dump
test -s cutover.dump

# 2. Encrypt at once; the plaintext is deleted by the command.
node database/migration-od9/backup-crypto.mjs encrypt --in cutover.dump --out cutover-<UTC timestamp>.dump.lfbk --key-file <key path>
```

The Railway CLI does not return remote exit codes: check the file size, not `$?`. The plaintext exists only on the operator's machine and only until the encrypt command finishes; the operator's disk must itself be encrypted. Store the `.lfbk` file and its manifest in two places: the Depot volume (`/data/backups/`) and the team's off-platform backup storage.

Format LFBK1: magic `LFBK1\n`, a 12-byte IV, the ciphertext, a 16-byte GCM tag. The manifest records both SHA-256 digests (plaintext and ciphertext), the sizes, the key fingerprint and the time.

## 3. Verifying a backup

A backup is not a backup until a restore of it has been checked. For the cutover, before any migration (runbook step 4):

```bash
node database/migration-od9/backup-crypto.mjs decrypt --in cutover-….dump.lfbk --out verify.dump --key-file <key path>
pg_restore --list verify.dump | head            # the archive's table of contents is readable
createdb <scratch database>                     # a disposable database, never production
pg_restore -d <scratch database> --exit-on-error verify.dump
rm verify.dump
cd database
npm run od9 -- inventory --label backup_check --db <scratch>
npm run od9 -- compare --before before --after backup_check --db <scratch>     # must exit 0
npm run od9 -- spot-check --label backup_check --from before --db <scratch>    # must exit 0
```

`decrypt` refuses a wrong key (fingerprint), a damaged or altered file (GCM tag) and a plaintext whose SHA-256 differs from the manifest, and leaves no output behind when it refuses. The `before` inventory travels inside the backup (the `od9` schema), so the scratch copy can be compared against it directly. Drop the scratch database afterwards.

## 4. Restore rehearsal procedure

Run before the window (runbook "Before the window", item 1) and again after any material schema change:

1. Take and verify a backup as in sections 2 and 3, from a restored copy of production or from production itself.
2. On a disposable database server with the same PostgreSQL major version, decrypt and `pg_restore --exit-on-error` into a fresh database.
3. Run the whole cutover runbook against it, then restore the same backup into another fresh database and check it equals the pre-migration state: `compare --before before --after restored` exits 0, the rebuild tables (for example `public.legacy_kc_credits`) do not exist, `od9.findings` is empty, and the spot check matches.
4. Record the elapsed times of decrypt, restore and verification: their sum is the restore time the rollback decision points below depend on.

`npm --prefix database run od9:rehearse` does all of this locally on synthetic data (section 6).

## 5. Rollback

### Decision points

| Point | When | Situation | Decision |
|---|---|---|---|
| A | Runbook step 4 | The backup does not verify | **Abort.** Nothing changed: lift the freeze, move the window |
| B1 | Step 5 | A migration fails and only expand migrations are in | **Reopen the legacy platform without a restore:** expand migrations are safe with the legacy code. Roll back any service deploy, lift the freeze |
| B2 | Step 5 | A migration fails after a contract migration is in | Fix forward within the window if the cause is understood; otherwise **restore** (below). The legacy code cannot run on a contracted schema |
| C | Step 7 | The comparison or the spot check fails | **No switch.** Fix the cause (the report names account, family, category) and re-run step 7; if not fixable in the window, **restore** |
| D | Step 8 | A smoke check fails | Fix forward if it is a service defect (redeploy); if it is data, **restore** |
| E | After the switch | Families are writing to the new platform | A restore loses every write since the switch. Prefer fix forward. Restore only for a data-integrity or child-safety incident, decided by the owner, with the procedure below plus the lost-writes step |

The owner decides at B2, C, D and E; the operator decides at A and B1 and records it.

### Restore steps (points B2, C, D, E)

1. **Stop writes.** Re-apply the freeze (runbook step 1) and stop Core, Oracle and every service that writes.
2. **Point E only: capture what will be lost.** `npm run od9 -- inventory --label rollback` then `compare --before after --after rollback`: every `new_after` and changed row is a write the restore removes. Export it before going on; the owner decides how families are told (GOVERNANCE section 5 timeline).
3. **Restore into a fresh database, never over the failed one.** Decrypt the verified cutover backup, `CREATE DATABASE postgres_restore`, `pg_restore -d postgres_restore --exit-on-error`, then verify it as in section 3 (inventory, compare against `before`, spot check).
4. **Swap.** With every Supabase service stopped: `ALTER DATABASE postgres RENAME TO postgres_failed_<date>; ALTER DATABASE postgres_restore RENAME TO postgres;` The failed database is kept for the post-mortem; it is deleted only by a later, recorded decision.
5. **Redeploy the legacy release** of every service (the commits recorded at the go/no-go meeting) and restart the Supabase services.
6. **Reopen.** Lift the freeze, re-enable the workflows, and check the legacy platform's `/health` and one QA-family read and write.
7. **Record.** The log, the reports, the time lost, and a post-mortem within one week (GOVERNANCE section 5).

The swap in step 4 (renaming the `postgres` database under Supabase) has not been rehearsed: the local rehearsal restores into a fresh database and compares it, but runs no Supabase services. Rehearse the swap on a Railway copy before the window.

## 6. Local rehearsal evidence

`npm --prefix database run od9:rehearse` (script `database/migration-od9/rehearse-cutover.mjs`) runs freeze, before inventory, encrypted backup, backup verification, plan, migrations, toolkit, reconcile, smoke checks, switch, post-release checks and restore, on a disposable database of the lane's native PostgreSQL. It refuses any cluster whose data directory is not `LF_PG_DATA`, and it deletes the key and every plaintext dump when it ends. Results and timings: lane record [`S10-CUTOVER.md`](../rebuild/sprints/S10-CUTOVER.md), section S10.2.
