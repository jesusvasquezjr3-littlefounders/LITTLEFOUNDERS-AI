import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * H.5 (Appendix O 1.2 Backup-Encryption-at-Rest Confirmation): the daily
 * Vault and Pulse backups store only encrypted files. An unencrypted backup is
 * a Critical-priority gap, so this lint pins, for each backup workflow:
 *
 *   - every file written to /data/backups is an `.lfbk` ciphertext or its
 *     manifest (`.lfbk.manifest.json`), never the plaintext dump;
 *   - the dump is encrypted with the tested tool (database/migration-od9/
 *     backup-crypto.mjs) using the BACKUP_ENCRYPTION_KEY secret, before the
 *     first upload, and the workflow fails on an empty ciphertext or a
 *     surviving plaintext;
 *   - the prune step covers the `*.dump.lfbk` files;
 *   - the key file is removed even when the job fails.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const WORKFLOWS = { vault: '.github/workflows/vault-backup.yml', pulse: '.github/workflows/pulse-backup.yml' };

export function backupWorkflowFailures(yaml, prefix) {
  const failures = [];
  // A `$PART` target is resolved to every item of its `for PART in ...` list.
  const parts = [...yaml.matchAll(/for PART in ([^;\n]+);/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((q) => q[1]));
  const uploads = [...yaml.matchAll(/cat > \/data\/backups\/([^"'\s;]+)/g)].flatMap((m) => (m[1] === '$PART' ? parts : [m[1]]));
  if (uploads.length === 0) failures.push('no upload to /data/backups found');
  for (const target of uploads) {
    if (!/\.lfbk(\.manifest\.json)?$/.test(target)) failures.push(`uploads ${target}, which is not an .lfbk ciphertext or its manifest`);
  }
  const encrypt = yaml.search(/node database\/migration-od9\/backup-crypto\.mjs encrypt --in "\$FILE" --out "\$FILE\.lfbk" --key-file "\$RUNNER_TEMP\/backup\.key"/);
  if (encrypt < 0) failures.push('the dump is not encrypted with backup-crypto.mjs');
  const firstUpload = yaml.search(/cat > \/data\/backups\//);
  if (encrypt >= 0 && firstUpload >= 0 && encrypt > firstUpload) failures.push('an upload happens before the encryption');
  if (!/\$\{\{ secrets\.BACKUP_ENCRYPTION_KEY \}\}/.test(yaml)) failures.push('the key does not come from the BACKUP_ENCRYPTION_KEY secret');
  if (!/test -s "\$RUNNER_TEMP\/backup\.key"/.test(yaml)) failures.push('a missing key does not fail the job');
  if (!/test -s "\$FILE\.lfbk"/.test(yaml)) failures.push('an empty ciphertext does not fail the job');
  if (!/test ! -e "\$FILE"/.test(yaml)) failures.push('a surviving plaintext does not fail the job');
  if (!yaml.includes(`${prefix}-*.dump.lfbk`)) failures.push(`the prune step does not cover ${prefix}-*.dump.lfbk`);
  if (!/if: always\(\)\s*\n\s*run: rm -f "\$RUNNER_TEMP\/backup\.key"/.test(yaml)) failures.push('the key file is not removed on every outcome');
  if (!/uses: actions\/checkout@v4/.test(yaml) || !/uses: actions\/setup-node@v4/.test(yaml)) failures.push('the encryption tool is not checked out with Node set up');
  return failures;
}

for (const [prefix, path] of Object.entries(WORKFLOWS)) {
  test(`${path} stores only encrypted backups`, () => {
    assert.deepEqual(backupWorkflowFailures(readFileSync(`${repo}${path}`, 'utf8'), prefix), []);
  });
}

test('the lint fails on a plaintext upload and on an upload before encryption', () => {
  const real = readFileSync(`${repo}${WORKFLOWS.vault}`, 'utf8');
  const plaintext = real.replace('for PART in "$FILE.lfbk"', 'for PART in "$FILE"');
  assert.match(backupWorkflowFailures(plaintext, 'vault').join('\n'), /uploads \$FILE, which is not an \.lfbk/);
  const noEncrypt = real.replace(/node database\/migration-od9\/backup-crypto\.mjs encrypt[^\n]*\n/, '');
  assert.match(backupWorkflowFailures(noEncrypt, 'vault').join('\n'), /not encrypted/);
  const noKey = real.replace('${{ secrets.BACKUP_ENCRYPTION_KEY }}', 'not-a-secret');
  assert.match(backupWorkflowFailures(noKey, 'vault').join('\n'), /BACKUP_ENCRYPTION_KEY/);
});
