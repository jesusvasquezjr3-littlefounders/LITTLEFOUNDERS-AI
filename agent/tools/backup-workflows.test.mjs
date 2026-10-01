import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * H.5 (Appendix O 1.2 Backup-Encryption-at-Rest Confirmation): every workflow
 * that stores a database dump stores only encrypted files. An unencrypted
 * backup is a Critical-priority gap, so this lint pins, for each workflow
 * that writes to /data/backups (found by grepping every workflow, never a
 * fixed list: the daily Vault and Pulse backups and the pre-migration restore
 * points of database-cd.yml and tutor-deploy.yml, and the cutover backup of
 * cutover.yml, today):
 *
 *   - every file written to /data/backups is an `.lfbk` ciphertext or its
 *     manifest (`.lfbk.manifest.json`), never the plaintext dump;
 *   - the dump is encrypted with the tested tool (database/migration-od9/
 *     backup-crypto.mjs) using the BACKUP_ENCRYPTION_KEY secret, before the
 *     first upload, and the workflow fails on an empty ciphertext or a
 *     surviving plaintext;
 *   - the prune step covers the `<prefix>-*.dump.lfbk` files, the prefix
 *     read from the workflow's own FILE="<prefix>-..." name;
 *   - the key file is removed even when the job fails.
 */

const repo = fileURLToPath(new URL('../../', import.meta.url));
const workflowsDir = `${repo}.github/workflows/`;

/** Every workflow that writes into /data/backups, with the dump-name prefix it declares. */
export function backupWorkflows(names = readdirSync(workflowsDir), read = (name) => readFileSync(`${workflowsDir}${name}`, 'utf8')) {
  return names.filter((name) => /\.ya?ml$/.test(name)).sort().flatMap((name) => {
    const yaml = read(name);
    if (!yaml.includes('cat > /data/backups/')) return [];
    const prefix = /FILE="([a-z][a-z-]*?)-(?:\$\{TS\}|\$\(date)/.exec(yaml)?.[1] ?? null;
    return [{ path: `.github/workflows/${name}`, prefix, yaml }];
  });
}

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

const WORKFLOWS = backupWorkflows();

test('every workflow that writes to /data/backups is found, with its dump prefix', () => {
  const found = Object.fromEntries(WORKFLOWS.map((w) => [w.path, w.prefix]));
  assert.deepEqual(found, {
    '.github/workflows/cutover.yml': 'cutover',
    '.github/workflows/database-cd.yml': 'pre-migration',
    '.github/workflows/pulse-backup.yml': 'pulse',
    '.github/workflows/tutor-deploy.yml': 'pre-migration',
    '.github/workflows/vault-backup.yml': 'vault',
  });
});

for (const { path, prefix, yaml } of WORKFLOWS) {
  test(`${path} stores only encrypted backups`, () => {
    assert.ok(prefix, `${path} writes to /data/backups but declares no FILE="<prefix>-..." dump name`);
    assert.deepEqual(backupWorkflowFailures(yaml, prefix), []);
  });
}

test('a new workflow writing a plaintext dump to /data/backups is discovered and fails', () => {
  const rogue = [
    'steps:',
    '  - run: |',
    '      FILE="rogue-${TS}.dump"',
    '      cat "$FILE" | railway ssh --service filebase -- sh -c "cat > /data/backups/$FILE"',
    '',
  ].join('\n');
  const found = backupWorkflows(['rogue.yml', 'other.yml'], (name) => (name === 'rogue.yml' ? rogue : 'steps: []\n'));
  assert.deepEqual(found.map((w) => [w.path, w.prefix]), [['.github/workflows/rogue.yml', 'rogue']]);
  assert.match(backupWorkflowFailures(found[0].yaml, 'rogue').join('\n'), /uploads \$FILE, which is not an \.lfbk/);
});

test('the lint fails on a plaintext upload and on an upload before encryption', () => {
  const real = readFileSync(`${workflowsDir}vault-backup.yml`, 'utf8');
  const plaintext = real.replace('for PART in "$FILE.lfbk"', 'for PART in "$FILE"');
  assert.match(backupWorkflowFailures(plaintext, 'vault').join('\n'), /uploads \$FILE, which is not an \.lfbk/);
  const noEncrypt = real.replace(/node database\/migration-od9\/backup-crypto\.mjs encrypt[^\n]*\n/, '');
  assert.match(backupWorkflowFailures(noEncrypt, 'vault').join('\n'), /not encrypted/);
  const noKey = real.replace('${{ secrets.BACKUP_ENCRYPTION_KEY }}', 'not-a-secret');
  assert.match(backupWorkflowFailures(noKey, 'vault').join('\n'), /BACKUP_ENCRYPTION_KEY/);
});

test('the pre-migration restore points are encrypted in both migrating workflows', () => {
  for (const name of ['database-cd.yml', 'tutor-deploy.yml']) {
    const yaml = readFileSync(`${workflowsDir}${name}`, 'utf8');
    assert.deepEqual(backupWorkflowFailures(yaml, 'pre-migration'), [], name);
    // The plaintext dumps written before H.5 covered this path are cleaned up.
    assert.ok(yaml.includes("find /data/backups -name 'pre-migration-*.dump' -delete"), `${name} never removes the old plaintext restore points`);
  }
});

test('cutover rehearsal checks restored findings against the source backup', () => {
  const yaml = readFileSync(`${workflowsDir}cutover.yml`, 'utf8');
  const before = yaml.slice(yaml.indexOf('          p_before() {'), yaml.indexOf('          p_backup() {'));
  const restore = yaml.slice(yaml.indexOf('          p_restore_rehearsal() {'), yaml.indexOf("          phase 'start the copy"));
  assert.match(before, /copy_admin rehearsal\).*\n\s+\[\[ "\$source_findings" =~ \^\[0-9\]\+\$ \]\]/);
  assert.match(before, /"\$source_findings" > "\$LF\/source\.findings"/);
  assert.match(restore, /source_findings="\$\(cat "\$LF\/source\.findings"\)"/);
  assert.match(restore, /copy_admin restored/);
  assert.match(restore, /\[ "\$restored_findings" = "\$source_findings" \]/);
  assert.doesNotMatch(restore, /\[ "\$restored_findings" = 0 \]/);
});
