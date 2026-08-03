/**
 * Local integration test for railway-migrate.sh.
 *
 * The fake Railway executable forwards the received `sh -c` payload to a fake
 * psql binary. This proves that the remote base64/psql pipeline is executable
 * without contacting Railway or mutating a database.
 */
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const runner = join(scriptsDir, 'railway-migrate.sh');
const fixtureRoot = join(tmpdir(), `littlefounders-railway-migrate-${process.pid}-${Date.now()}`);
const binDir = join(fixtureRoot, 'bin');
const callsLog = join(fixtureRoot, 'psql-calls.log');
const keyPath = join(fixtureRoot, 'test-railway-key');

mkdirSync(binDir, { recursive: true });
writeFileSync(keyPath, 'test-key');

writeFileSync(
  join(binDir, 'railway'),
  `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const separator = process.argv.indexOf('--');
if (separator === -1) process.exit(2);
const command = process.argv.slice(separator + 1);
const result = spawnSync(command[0], command.slice(1), {
  env: process.env,
  encoding: 'utf8',
  stdio: ['inherit', 'pipe', 'pipe'],
});
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
`,
);

writeFileSync(
  join(binDir, 'psql'),
  `#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs';
const sql = readFileSync(0, 'utf8');
appendFileSync(process.env.RAILWAY_FAKE_CALLS, sql + '\\n---\\n');
if (sql.includes("to_regclass('public.schema_migrations')")) {
  process.stdout.write('absent|-1|present\\n');
}
`,
);
chmodSync(join(binDir, 'railway'), 0o755);
chmodSync(join(binDir, 'psql'), 0o755);

const result = spawnSync('bash', [runner, '--dry-run', '--baseline', '0011'], {
  cwd: dirname(scriptsDir),
  env: {
    ...process.env,
    PATH: `${binDir}:${process.env.PATH ?? ''}`,
    RAILWAY_TOKEN: 'test-railway-token',
    RAILWAY_SSH_KEY_PATH: keyPath,
    RAILWAY_FAKE_CALLS: callsLog,
  },
  encoding: 'utf8',
});

try {
  if (result.status !== 0) {
    throw new Error(`runner exited ${result.status}: ${result.stdout}\n${result.stderr}`);
  }
  if (!existsSync(callsLog)) throw new Error('fake psql was never reached');
  const calls = readFileSync(callsLog, 'utf8');
  if (!calls.includes("to_regclass('public.schema_migrations')")) {
    throw new Error('preflight SQL did not reach fake psql');
  }
  if (!result.stdout.includes('DRY RUN — no ledger or migration SQL will be written.')) {
    throw new Error('dry-run guard output is missing');
  }
  if (!result.stdout.includes('pending 0012_') || !result.stdout.includes('pending 0033_')) {
    throw new Error('dry-run did not enumerate the expected migration range');
  }
  if (result.stdout.includes('applied ')) throw new Error('dry-run reported an applied migration');
  console.log('railway-migrate integration OK — remote pipeline executed in a no-write fake Railway session');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
