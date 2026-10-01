/**
 * Local integration test for railway-migrate.sh.
 *
 * The fake Railway executable mimics the live CLI 5.30.3 transport contract
 * verified in production: the remote command arrives as ONE positional
 * argument and the remote exit status NEVER propagates (local exit is always
 * 0). The fake psql answers each query family from env knobs, so every
 * scenario runs without contacting Railway or mutating a database. Because
 * the transport exit code is worthless, the runner must judge success from
 * psql output alone — these scenarios pin that contract.
 */
import { chmodSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const dbDir = dirname(scriptsDir);
const runner = join(scriptsDir, 'railway-migrate.sh');
const fixtureRoot = join(tmpdir(), `littlefounders-railway-migrate-${process.pid}-${Date.now()}`);
const binDir = join(fixtureRoot, 'bin');
const keyPath = join(fixtureRoot, 'test-railway-key');

mkdirSync(binDir, { recursive: true });
writeFileSync(keyPath, 'test-key');

writeFileSync(
  join(binDir, 'railway'),
  `#!/usr/bin/env node
import { appendFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
appendFileSync(process.env.RAILWAY_FAKE_ARGS, JSON.stringify(args) + '\\n');
// Mimic CLI 5.30.3: the legacy \`-- sh -c\` shape word-splits and never reaches
// psql, and even that failure exits 0 locally.
if (args.includes('--')) {
  process.stderr.write('sh: usage: printf FORMAT [ARGUMENT ...]\\n');
  process.exit(0);
}
let command = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === 'ssh') continue;
  if (args[i] === '--service' || args[i] === '-i') { i += 1; continue; }
  command = args[i];
}
if (command !== null) {
  // RUN THE COMMAND FROM A FILE, NOT FROM \`sh -c\`.
  //
  // The payload is a base64 blob of a whole migration — 13 KB for 0023, 31 KB
  // for 0025. On Windows, MSYS \`sh.exe\` spawned by a native process (node)
  // silently TRUNCATES its command line at 8191 characters and still exits 0,
  // so \`echo <b64> | base64 -d | psql\` lost its own pipeline and printed the
  // base64 instead of the sentinel. The runner then refused, correctly, a
  // reply that carried no sentinel — a real defect report about a fake
  // transport. Measured: the cut is exact and silent (8163 chars round-trips,
  // 8193 comes back as the raw echo argument, status 0, stderr empty).
  //
  // A script FILE has no command-line length at all, so the fake behaves the
  // same on every OS. The contract these scenarios exist to pin is untouched:
  // the remote command still arrives as ONE positional argument, and the
  // remote exit status below is still discarded.
  const scriptPath = join(tmpdir(), \`lf-fake-railway-\${process.pid}-\${Date.now()}.sh\`);
  writeFileSync(scriptPath, command);
  const result = spawnSync('sh', [scriptPath], { env: process.env, encoding: 'utf8' });
  rmSync(scriptPath, { force: true });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
}
// The remote exit status is NOT propagated — always exit 0, like the real CLI.
process.exit(0);
`,
);

writeFileSync(
  join(binDir, 'psql'),
  `#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs';
const sql = readFileSync(0, 'utf8');
appendFileSync(process.env.RAILWAY_FAKE_CALLS, sql + '\\n---\\n');
const mode = process.env.RAILWAY_FAKE_PSQL_MODE ?? 'ok';
if (mode === 'error') {
  process.stderr.write('psql:<stdin>:1: ERROR:  boom\\n');
  process.exit(1);
}
if (mode === 'silent') {
  // Exit 0 with no sentinel: the exact lie the production transport told.
  process.exit(0);
}
const lines = [];
if (sql.includes('AS has_ledger') && sql.includes('\\\\if :has_ledger')) {
  // The preflight is now a psql \\gset/\\if two-phase script (a scalar
  // subquery beside to_regclass ERRORed on ledger-less databases — the real
  // pre-baseline production state). The fake answers with the same single
  // state|count|courses line the runner parses.
  lines.push(process.env.RAILWAY_FAKE_LEDGER ?? 'absent|-1|present');
} else if (sql.includes("'baseline-ok'")) {
  lines.push(process.env.RAILWAY_FAKE_SIGNATURE ?? 'baseline-ok');
} else if (sql.includes('SELECT checksum FROM public.schema_migrations')) {
  const match = sql.match(/filename = '([^']+)'/);
  const receipts = JSON.parse(process.env.RAILWAY_FAKE_RECEIPTS ?? '{}');
  if (match && receipts[match[1]]) lines.push(receipts[match[1]]);
} else if (sql.includes('SELECT count(*) FROM public.schema_migrations;')) {
  lines.push(process.env.RAILWAY_FAKE_COUNT ?? '0');
}
for (const line of lines) process.stdout.write(line + '\\n');
process.stdout.write('LF_MIGRATION_OK\\n');
if (mode === 'notice-after-sentinel') {
  // psql NOTICEs travel on stderr unbuffered, and the CLI's channel
  // forwarding can deliver them AFTER the sentinel in the runner's 2>&1
  // merge (the fake railway writes stdout then stderr, reproducing exactly
  // that ordering). 0024/0033 DO emit NOTICEs on the production path.
  process.stderr.write('psql:<stdin>:12: NOTICE:  relation "anon_visitors" already exists, skipping\\n');
}
if (mode === 'error-after-sentinel') {
  // An ERROR line must refuse even though the sentinel already printed.
  process.stderr.write('psql:<stdin>:12: ERROR:  deadlock detected\\n');
}
`,
);
const referenceBin = join(fixtureRoot, 'reference-bin');
mkdirSync(referenceBin);
for (const executable of ['railway', 'psql']) {
  writeFileSync(join(referenceBin, executable), readFileSync(join(binDir, executable)));
  chmodSync(join(referenceBin, executable), 0o755);
  writeFileSync(join(binDir, executable), readFileSync(join(scriptsDir, 'fixtures', executable + '-fake.sh')));
}
chmodSync(join(binDir, 'railway'), 0o755);
chmodSync(join(binDir, 'psql'), 0o755);

const migrationFiles = readdirSync(join(dbDir, 'migrations'))
  .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
  .sort();
const checksums = Object.fromEntries(
  migrationFiles.map((f) => [
    f,
    createHash('sha256').update(readFileSync(join(dbDir, 'migrations', f))).digest('hex'),
  ]),
);

// Differential proof keeps the original Node transport as the reference.
async function verifyFakeParity() {
  const sqls = [
    ['ok', 'SELECT 1;'],
    ['ok', String.raw`SELECT 1 AS has_ledger; \if :has_ledger`],
    ['ok', "SELECT 'baseline-ok';"],
    ['ok', "SELECT checksum FROM public.schema_migrations WHERE filename = '0023_learning_insights.sql';"],
    ['ok', 'SELECT count(*) FROM public.schema_migrations;'],
    ['silent', 'SELECT 1;'], ['error', 'SELECT 1;'],
    ['notice-after-sentinel', 'SELECT 1;'], ['error-after-sentinel', 'SELECT 1;'],
    // A real 22 KB migration pins the script-file fix above the 8191-byte boundary.
    ['ok', readFileSync(join(dbDir, 'migrations', '0025_insights_scale.sql'), 'utf8')],
  ];
  for (const [index, [mode, sql]] of sqls.entries()) {
    const results = [];
    for (const [kind, directory] of [['node', referenceBin], ['bash', binDir]]) {
      const callsLog = join(fixtureRoot, `parity-${index}-${kind}.sql`);
      const argsLog = join(fixtureRoot, `parity-${index}-${kind}.jsonl`);
      const receiptsFile = join(fixtureRoot, `parity-${index}-${kind}.tsv`);
      const receipts = { '0023_learning_insights.sql': 'deadbeef' };
      writeFileSync(receiptsFile, '0023_learning_insights.sql\tdeadbeef\n');
      const inheritedPath = Object.entries(process.env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? '';
      const inheritedEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PATH'));
      const command = `echo ${Buffer.from(sql).toString('base64')} | base64 -d | psql -U supabase_admin -d postgres -t -A -v ON_ERROR_STOP=1 -f -`;
      const argv = ['ssh', '--service', 'db', '-i', keyPath, command];
      // Native Node -> MSYS Bash also truncates long argv; launch Bash from
      // a short script FILE, then its own shell passes the real positional argv.
      const launcher = join(fixtureRoot, `parity-${index}-launch.sh`);
      const shellQuote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
      if (kind === 'bash') writeFileSync(launcher, 'exec ' + [join(directory, 'railway'), ...argv].map(shellQuote).join(' ') + '\n');
      const result = await new Promise((resolve, reject) => {
        const child = spawn(kind === 'node' ? process.execPath : 'bash', kind === 'node' ? [join(directory, 'railway'), ...argv] : [launcher], {
          env: { ...inheritedEnv, PATH: `${directory}${delimiter}${inheritedPath}`,
            RAILWAY_FAKE_CALLS: callsLog, RAILWAY_FAKE_ARGS: argsLog,
            RAILWAY_FAKE_PSQL_MODE: mode, RAILWAY_FAKE_RECEIPTS: JSON.stringify(receipts),
            RAILWAY_FAKE_RECEIPTS_FILE: receiptsFile }, stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '', stderr = '';
        child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
        child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
        child.once('error', reject);
        child.once('close', (status) => resolve({ status, stdout, stderr }));
      });
      results.push({ ...result, sql: readFileSync(callsLog, 'utf8'), args: readFileSync(argsLog, 'utf8') });
    }
    assert(JSON.stringify(results[0]) === JSON.stringify(results[1]), `fake-parity-${index}`, 'Bash and Node fake transport behavior differs', { ...results[1], stdout: JSON.stringify(results.map(({ status, stdout, stderr }) => ({ status, stdout, stderr }))) });
  }
  console.log(`railway fake differential parity OK — ${sqls.length} payloads, stdout/stderr/status/raw SQL/JSON argv, plus the full ${migrationFiles.length}-migration scenario suite below`);
}

let scenarioIndex = 0;
async function run(args, envOverrides = {}) {
  scenarioIndex += 1;
  const callsLog = join(fixtureRoot, `psql-calls-${scenarioIndex}.log`);
  const argsLog = join(fixtureRoot, `railway-args-${scenarioIndex}.log`);
  const receiptsFile = join(fixtureRoot, `receipts-${scenarioIndex}.tsv`);
  writeFileSync(receiptsFile, Object.entries(JSON.parse(envOverrides.RAILWAY_FAKE_RECEIPTS ?? '{}')).map(([file, checksum]) => `${file}\t${checksum}\n`).join(''));
  // Windows may expose both Path and PATH. Keep one canonical key so the
  // child cannot resolve WSL's bash instead of the intended Git Bash/fakes.
  const inheritedPath = Object.entries(process.env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? '';
  const inheritedEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PATH'));
  const result = await new Promise((resolve, reject) => {
    const child = spawn('bash', [runner, ...args], {
      cwd: dbDir,
      env: {
        ...inheritedEnv,
        PATH: `${binDir}${delimiter}${inheritedPath}`,
        RAILWAY_TOKEN: 'test-railway-token',
        RAILWAY_SSH_KEY_PATH: keyPath,
        RAILWAY_SSH_ATTEMPTS: '1',
        RAILWAY_SSH_RETRY_SECONDS: '0',
        RAILWAY_FAKE_CALLS: callsLog,
        RAILWAY_FAKE_ARGS: argsLog,
        RAILWAY_FAKE_RECEIPTS_FILE: receiptsFile,
        ...envOverrides,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
  const calls = existsSync(callsLog) ? readFileSync(callsLog, 'utf8') : '';
  const railwayArgs = existsSync(argsLog) ? readFileSync(argsLog, 'utf8') : '';
  return { ...result, calls, railwayArgs };
}

function assert(condition, scenario, message, result) {
  if (condition) return;
  throw new Error(
    `${scenario}: ${message}\n--- status ---\n${result.status}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`,
  );
}

const scenarios = [];

try {
  await new Promise((resolve, reject) => {
    const child = spawn('bash', [join(scriptsDir, 'fixtures', 'runner-output-parity.sh'), runner, fixtureRoot], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('close', (status) => { if (status === 0) { console.log(output.trim()); resolve(); } else reject(new Error(`runner builtin parity failed (${status}): ${output}`)); });
  });
  await verifyFakeParity();
  // 0. Static DDL cross-check. The fake psql answers signature probes from an
  //    env knob without ever executing the SQL — exactly the blind spot that
  //    let a probe naming a table NO migration creates ship green
  //    (generation_run_snapshots; 0020 creates generation_heartbeat_snapshots),
  //    which made every real `--baseline 0022` run refuse against a correct
  //    production database. So: every to_regclass('public.X') target in the
  //    runner's baseline signature map, and every one in DEPLOYMENT.md's
  //    operator signature table, must be an object the migrations actually
  //    create (the schema_migrations ledger is created by the runner itself).
  {
    const staticResult = { status: 'static', stdout: '', stderr: '' };
    const runnerSource = readFileSync(runner, 'utf8');
    const allMigrationSql = migrationFiles
      .map((f) => readFileSync(join(dbDir, 'migrations', f), 'utf8'))
      .join('\n');
    const createdByMigrations = (name) =>
      new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${name}\\b`, 'i').test(allMigrationSql) ||
      new RegExp(`create\\s+(or\\s+replace\\s+)?function\\s+(public\\.)?${name}\\b`, 'i').test(allMigrationSql) ||
      new RegExp(`alter\\s+publication\\s+\\w+\\s+add\\s+table\\s+(public\\.)?${name}\\b`, 'i').test(allMigrationSql);

    const probeMap = runnerSource.match(/baseline_signature_sql\(\) \{[\s\S]*?\n\}/);
    assert(Boolean(probeMap), 'probe-map-ddl', 'baseline_signature_sql() not found in railway-migrate.sh', staticResult);
    const probeTargets = [...probeMap[0].matchAll(/to_regclass\('public\.([a-z_]+)'\)/g)].map((m) => m[1]);
    assert(probeTargets.length >= 8, 'probe-map-ddl', `expected the probe map to name at least 8 to_regclass targets, found ${probeTargets.length}`, staticResult);
    for (const target of probeTargets) {
      assert(createdByMigrations(target), 'probe-map-ddl', `signature probe names public.${target}, but no migration creates it — a real baseline run would refuse against a correct database`, staticResult);
    }

  }

  // 1. Dry-run against the verified production shape: absent ledger, baseline
  //    0022. Must pass the signature probe and enumerate exactly 0023–0033.
  scenarios.push(async () => {
    const r = await run(['--dry-run', '--baseline', '0022']);
    assert(r.status === 0, 'dry-run-0022', 'runner should exit 0', r);
    assert(r.stdout.includes('signature probe passed'), 'dry-run-0022', 'baseline signature probe did not pass', r);
    assert(r.stdout.includes('DRY RUN — no ledger or migration SQL will be written.'), 'dry-run-0022', 'dry-run guard output missing', r);
    assert(r.stdout.includes('pending 0023_') && r.stdout.includes('pending 0033_'), 'dry-run-0022', 'expected pending range 0023–0033', r);
    assert(!r.stdout.includes('pending 0022_'), 'dry-run-0022', 'baselined 0022 must not be pending', r);
    assert(!r.stdout.includes('applied '), 'dry-run-0022', 'dry-run reported an applied migration', r);
    const transportCalls = r.railwayArgs.trim().split('\n').map((l) => JSON.parse(l));
    for (const argv of transportCalls) {
      assert(!argv.includes('--'), 'dry-run-0022', 'transport must not use the broken `-- sh -c` shape', r);
      const command = argv[argv.length - 1];
      assert(/^echo [A-Za-z0-9+/=]+ \| base64 -d \| psql /.test(command), 'dry-run-0022', 'remote pipeline must be one positional argument', r);
    }
    assert(r.calls.includes("to_regclass('public.schema_migrations')"), 'dry-run-0022', 'preflight SQL did not reach fake psql', r);
    assert(r.calls.includes("pg_publication_tables"), 'dry-run-0022', 'signature probe SQL did not reach fake psql', r);
  });

  // 2. Confirm-production apply: transaction wrapping, per-file receipt, and
  //    a sentinel terminating every payload so success is output-verified.
  scenarios.push(async () => {
    const r = await run(['--confirm-production', '--baseline', '0022'], { RAILWAY_FAKE_COUNT: '33' });
    assert(r.status === 0, 'confirm-apply', 'runner should exit 0', r);
    assert(r.stdout.includes('Recorded immutable baseline through 0022.'), 'confirm-apply', 'baseline receipts were not recorded', r);
    assert(r.stdout.includes('applied 0023_') && r.stdout.includes('applied 0033_'), 'confirm-apply', 'apply range 0023–0033 missing', r);
    assert(!r.stdout.includes('applied 0022_'), 'confirm-apply', 'baselined 0022 must not be re-applied', r);
    assert(r.stdout.includes('OK: production migration ledger is current (33 receipt(s))'), 'confirm-apply', 'postflight receipt count missing', r);
    const payloads = r.calls.split('\n---\n');
    const baselinePayload = payloads.find((p) => p.includes('refusing baseline: schema_migrations is not empty'));
    assert(Boolean(baselinePayload), 'confirm-apply', 'baseline payload must refuse a non-empty ledger', r);
    assert(baselinePayload.includes("VALUES ('0001_identity.sql'") && baselinePayload.includes("VALUES ('0022_realtime_publication.sql'"), 'confirm-apply', 'baseline receipts must cover 0001–0022', r);
    assert(!baselinePayload.includes("VALUES ('0023_"), 'confirm-apply', 'baseline receipts must stop at 0022', r);
    const applyPayload = payloads.find((p) => p.includes("VALUES ('0023_learning_insights.sql'") && !p.includes('refusing baseline'));
    assert(Boolean(applyPayload), 'confirm-apply', 'apply payload for 0023 missing', r);
    assert(applyPayload.startsWith('BEGIN;') && applyPayload.includes('COMMIT;'), 'confirm-apply', 'apply payload must be one wrapped transaction', r);
    assert(applyPayload.includes(`'${checksums['0023_learning_insights.sql']}'`), 'confirm-apply', 'apply receipt must carry the real checksum', r);
    assert(applyPayload.trimEnd().endsWith('\\echo LF_MIGRATION_OK'), 'confirm-apply', 'every payload must end with the success sentinel', r);
  });

  // 3. Sentinel-missing refusal: fake psql exits 0 but prints nothing — the
  //    exact lie the production transport told. Must hard-refuse.
  scenarios.push(async () => {
    const r = await run(['--dry-run', '--baseline', '0022'], { RAILWAY_FAKE_PSQL_MODE: 'silent' });
    assert(r.status !== 0, 'sentinel-missing', 'runner must refuse a sentinel-free success', r);
    assert(r.stderr.includes('success sentinel missing'), 'sentinel-missing', 'refusal must name the missing sentinel', r);
  });

  // 4. ERROR-printing psql (transport still exits 0): must hard-refuse.
  scenarios.push(async () => {
    const r = await run(['--dry-run', '--baseline', '0022'], { RAILWAY_FAKE_PSQL_MODE: 'error' });
    assert(r.status !== 0, 'psql-error', 'runner must refuse on psql ERROR output', r);
    assert(r.stderr.includes('remote psql reported an error'), 'psql-error', 'refusal must name the psql error', r);
  });

  // 4b. NOTICE-after-sentinel must pass: success judgment is order-independent
  //     because psql NOTICEs (stderr, unbuffered) can be forwarded after the
  //     sentinel across the CLI's channels. A trailing NOTICE landing after a
  //     COMMITTED apply must not turn into a spurious refusal, and captured
  //     query results (signature probe, postflight count) must survive the
  //     NOTICE noise unparsed-into.
  scenarios.push(async () => {
    const r = await run(['--confirm-production', '--baseline', '0022'], {
      RAILWAY_FAKE_PSQL_MODE: 'notice-after-sentinel',
      RAILWAY_FAKE_COUNT: '33',
    });
    assert(r.status === 0, 'notice-after-sentinel', 'a NOTICE after the sentinel must not refuse a successful run', r);
    assert(r.stdout.includes('signature probe passed'), 'notice-after-sentinel', 'signature probe result must survive NOTICE interleaving', r);
    assert(r.stdout.includes('applied 0023_') && r.stdout.includes('applied 0033_'), 'notice-after-sentinel', 'apply range must complete despite trailing NOTICEs', r);
    assert(r.stdout.includes('OK: production migration ledger is current (33 receipt(s))'), 'notice-after-sentinel', 'postflight count must survive NOTICE filtering', r);
  });

  // 4c. ERROR co-present with the sentinel must still refuse — the sentinel
  //     never outvotes an ERROR line, whatever order they arrive in.
  scenarios.push(async () => {
    const r = await run(['--dry-run', '--baseline', '0022'], { RAILWAY_FAKE_PSQL_MODE: 'error-after-sentinel' });
    assert(r.status !== 0, 'error-with-sentinel', 'ERROR output must refuse even when the sentinel printed', r);
    assert(r.stderr.includes('remote psql reported an error'), 'error-with-sentinel', 'refusal must name the psql error', r);
  });

  // 5. Checksum drift: a recorded receipt that no longer matches the local
  //    file refuses before anything else happens to that file.
  scenarios.push(async () => {
    const receipts = { ...checksums, '0023_learning_insights.sql': 'deadbeef' };
    const r = await run(['--dry-run'], {
      RAILWAY_FAKE_LEDGER: 'present|33|present',
      RAILWAY_FAKE_RECEIPTS: JSON.stringify(receipts),
    });
    assert(r.status !== 0, 'checksum-drift', 'runner must refuse checksum drift', r);
    assert(r.stderr.includes('migration drift detected for 0023_learning_insights.sql'), 'checksum-drift', 'drift refusal must name the file', r);
  });

  // 6. Ledger present with matching receipts: every file skips, nothing pends.
  scenarios.push(async () => {
    const r = await run(['--dry-run'], {
      RAILWAY_FAKE_LEDGER: 'present|33|present',
      RAILWAY_FAKE_RECEIPTS: JSON.stringify(checksums),
    });
    assert(r.status === 0, 'ledger-skip', 'runner should exit 0', r);
    assert(r.stdout.includes('skip 0001_identity.sql (recorded)') && r.stdout.includes('skip 0033_retire_unused_game_schema.sql (recorded)'), 'ledger-skip', 'recorded files must skip', r);
    assert(!r.stdout.includes('pending '), 'ledger-skip', 'no file may be pending with full receipts', r);
  });

  // 7. Baseline guards.
  scenarios.push(async () => {
    const r = await run(['--dry-run', '--baseline', '0022'], { RAILWAY_FAKE_LEDGER: 'present|11|present' });
    assert(r.status !== 0 && r.stderr.includes('do not baseline a non-empty ledger'), 'baseline-nonempty-ledger', 'must refuse baselining an existing ledger', r);
  });
  scenarios.push(async () => {
    const r = await run(['--dry-run', '--baseline', '0022'], { RAILWAY_FAKE_LEDGER: 'absent|-1|absent' });
    assert(r.status !== 0 && r.stderr.includes('only valid for an existing application schema'), 'baseline-missing-schema', 'must refuse baselining a schemaless database', r);
  });
  scenarios.push(async () => {
    const r = await run(['--dry-run', '--baseline', '9999']);
    assert(r.status !== 0 && r.stderr.includes('newer than the latest local migration'), 'baseline-too-new', 'must refuse a baseline newer than local files', r);
  });

  // 8. Baseline signature probe: refuse a mismatched database and refuse a
  //    baseline the signature map does not know.
  scenarios.push(async () => {
    const r = await run(['--dry-run', '--baseline', '0022'], { RAILWAY_FAKE_SIGNATURE: 'found-later-objects' });
    assert(r.status !== 0 && r.stderr.includes('signature probe refused: found-later-objects'), 'signature-refuse', 'must refuse a failed signature probe', r);
  });
  scenarios.push(async () => {
    const r = await run(['--dry-run', '--baseline', '0015']);
    assert(r.status !== 0 && r.stderr.includes('has no signature-object map'), 'signature-unmapped', 'must refuse an unmapped baseline', r);
  });

  // Every scenario still executes the real transport runner over all migrations.
  // Only independent fake transports overlap; each has separate argument/SQL logs
  // and child environments. Bound process fan-out on Windows rather than spending
  // an hour serially starting thousands of short-lived Git Bash/Node processes.
  const workerCount = Math.min(3, scenarios.length);
  let nextScenario = 0;
  const failures = [];
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextScenario < scenarios.length) {
      const index = nextScenario++;
      try {
        await scenarios[index]();
        console.log(`railway-migrate scenario ${index + 1}/${scenarios.length} OK`);
      } catch (error) {
        failures.push(error);
      }
    }
  }));
  // Wait for every child before cleaning the shared fixture directory, even
  // when one scenario fails; otherwise cleanup can hide the original failure.
  if (failures.length) throw new AggregateError(failures, 'railway-migrate scenarios failed');

  console.log('railway-migrate integration OK — 13 transport scenarios + static probe-map/DEPLOYMENT.md DDL cross-checks: transport shape, order-independent sentinel verification, apply receipts, drift/skip, baseline guards, signature probe');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
