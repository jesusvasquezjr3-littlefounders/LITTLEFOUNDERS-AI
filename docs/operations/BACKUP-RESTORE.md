# Backups and restore

Production's Postgres (Vault) and Pulse's analytics database are dumped daily, encrypted on the runner, and stored on Depot's Railway volume.

| Backup | Workflow | When (UTC) | File |
|---|---|---|---|
| Vault | `vault-backup.yml` | 08:00 daily | `/data/backups/vault-<UTC timestamp>.dump.lfbk` (+ `.manifest.json`) on the `filebase` service |
| Pulse | `pulse-backup.yml` | 08:30 daily | `pulse-<UTC timestamp>.dump.lfbk` (+ manifest), same place |
| Before an auto-applied migration | `database-cd.yml`, `tutor-deploy.yml` (`step: migrate`) | per run | a full `pg_dump -Fc`, same place |

Backups older than 30 days are pruned. The volume is a separate disk from `db`'s, but it is still one volume: it is the single point of failure for backups.

## Encryption

`database/scripts/backup-crypto.mjs` encrypts a `pg_dump -Fc` file with AES-256-GCM and deletes the plaintext. The key (32 random bytes, base64) is the `BACKUP_ENCRYPTION_KEY` GitHub secret and lives in the team's secret store with two named custodians; never next to a backup, never in the repository. Each backup has a manifest with the key's fingerprint (first 16 hex of its SHA-256), both digests and the sizes, so the right key can be identified without revealing it. Losing the key loses every backup.

```bash
node database/scripts/backup-crypto.mjs keygen  --key-file <path>
node database/scripts/backup-crypto.mjs encrypt --in <dump> --out <dump>.lfbk --key-file <path>
node database/scripts/backup-crypto.mjs decrypt --in <dump>.lfbk --out <dump> --key-file <path>
node database/scripts/backup-crypto.mjs verify  --in <dump>.lfbk --key-file <path>
```

`decrypt` refuses a wrong key, an altered file and a plaintext whose digest differs from the manifest, and leaves no output behind when it refuses.

## Restore

Never restore over the live database. Restore into a fresh one, check it, then swap.

```bash
# 1. Fetch the backup and its manifest from the Depot volume.
railway ssh --service filebase -i <key> -- cat /data/backups/<file>.lfbk > <file>.lfbk
railway ssh --service filebase -i <key> -- cat /data/backups/<file>.lfbk.manifest.json > <file>.lfbk.manifest.json

# 2. Decrypt and check it is readable.
node database/scripts/backup-crypto.mjs decrypt --in <file>.lfbk --out restore.dump --key-file <key path>
pg_restore --list restore.dump | head

# 3. Restore into a scratch database of the same PostgreSQL major version.
createdb <scratch>
pg_restore -d <scratch> --exit-on-error restore.dump
```

The Railway CLI does not return remote exit codes: check file sizes, not `$?`. To make the restored database production's, stop the services that write, rename the failed database aside (`ALTER DATABASE postgres RENAME TO postgres_failed_<date>`), rename the restored one to `postgres`, and restart Supabase's services. That swap has not been rehearsed against Railway's Supabase stack; rehearse it on a copy before relying on it. A restore loses every write since the backup was taken.

Re-drill a restore after any material schema change.
