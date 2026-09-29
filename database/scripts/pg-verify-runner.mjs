// pg-verify-runner.mjs — the shared harness behind the native-PostgreSQL
// release gates (social-db-verify.mjs, family-db-verify.mjs, identity-db-verify.mjs).
//
// A gate names its verifiers (database/scripts/verify-*.py); this runs each
// against the full migration chain on one PostgreSQL cluster and fails on any
// failure. Each verifier creates its own database.
//
// Cluster:
//   * LF_PG_PORT set: use that running cluster (CI's postgres service
//     container). LF_PG_USER (default postgres), LF_PG_DATA (its
//     data_directory, which the verifiers check before touching anything) and
//     psql from LF_PG_PSQL, LF_PG_BIN or PATH. The verifiers that locate psql
//     through LF_PG_BIN get the directory of that psql.
//   * otherwise: start a THROWAWAY cluster (initdb into a temp directory,
//     trust auth on 127.0.0.1, a free port) from LF_PG_BIN, `pg_config
//     --bindir`, /usr/lib/postgresql/*/bin or the repo's portable audit
//     binaries, and remove it afterwards.
//   * no PostgreSQL binary anywhere: a clean SKIP (exit 0) that says so. A
//     skip is not a pass; release-readiness prints it.
//
// Python: LF_PYTHON, else python3, else python.
// Parallelism: LF_PG_VERIFY_JOBS (default 2). The verifiers open one psql
// connection per statement, so many in parallel can exhaust the client's
// ephemeral ports (Windows reports it as a refused or dropped connection). A
// verifier that failed only on the connection is rerun once, alone, and the
// report says so; any assertion failure stays a failure.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');
const EXE = process.platform === 'win32' ? '.exe' : '';

function firstExisting(candidates) {
  return candidates.find((dir) => dir && existsSync(join(dir, `initdb${EXE}`)) && existsSync(join(dir, `psql${EXE}`))) ?? null;
}

/** Where initdb/pg_ctl/psql live, or null when this machine has none. */
export function findPgBin(env = process.env) {
  const candidates = [env.LF_PG_BIN];
  const config = spawnSync(`pg_config${EXE}`, ['--bindir'], { encoding: 'utf8' });
  if (config.status === 0) candidates.push(config.stdout.trim());
  if (existsSync('/usr/lib/postgresql')) {
    for (const v of readdirSync('/usr/lib/postgresql').sort((a, b) => Number(b) - Number(a))) candidates.push(`/usr/lib/postgresql/${v}/bin`);
  }
  candidates.push(join(ROOT, '.codex/audit-db/pgsql/bin'));
  return firstExisting(candidates);
}

/** The directory holding `psql`: from an explicit path, else the first PATH entry that has it. */
export function psqlDir(psql, path = process.env.PATH ?? '', exists = existsSync) {
  if (psql && (isAbsolute(psql) || /[\\/]/.test(psql))) return dirname(psql);
  const name = psql || 'psql';
  for (const dir of path.split(delimiter).filter(Boolean)) {
    if (exists(join(dir, `${name}${EXE}`)) || exists(join(dir, name))) return dir;
  }
  return null;
}

function findPython(env = process.env) {
  for (const cmd of [env.LF_PYTHON, 'python3', 'python'].filter(Boolean)) {
    const probe = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0 && /Python 3\./.test(`${probe.stdout}${probe.stderr}`)) return cmd;
  }
  return null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function must(cmd, args, what) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${what} failed: ${r.stderr || r.stdout || r.error}`);
  return r.stdout;
}

export async function throwawayCluster(bin, label) {
  const dir = mkdtempSync(join(tmpdir(), `lf-${label}-`));
  const data = join(dir, 'data');
  const user = 'lf_verify';
  const port = String(await freePort());
  must(join(bin, `initdb${EXE}`), ['-D', data, '-U', user, '-A', 'trust', '-E', 'UTF8', '--no-locale'], 'initdb');
  // stdio ignored, not piped: the postmaster pg_ctl starts inherits its
  // handles, and a captured pipe would never reach EOF (spawnSync hangs on
  // Windows). The server log goes to -l instead.
  const started = spawnSync(join(bin, `pg_ctl${EXE}`), ['-D', data, '-l', join(dir, 'server.log'), '-w', '-o', `-p ${port} -c listen_addresses=127.0.0.1 -c max_connections=200`, 'start'], { stdio: 'ignore' });
  if (started.status !== 0) throw new Error(`pg_ctl start failed (see ${join(dir, 'server.log')})`);
  const stop = () => {
    spawnSync(join(bin, `pg_ctl${EXE}`), ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' });
    rmSync(dir, { recursive: true, force: true });
  };
  return { env: { LF_PG_BIN: bin, LF_PG_PSQL: join(bin, `psql${EXE}`), LF_PG_PORT: port, LF_PG_USER: user, LF_PG_DATA: data }, stop };
}

/** The environment every verifier gets for an already-running cluster (CI's service container). */
export function externalClusterEnv(env, locate = psqlDir) {
  const psql = env.LF_PG_PSQL ?? (env.LF_PG_BIN ? join(env.LF_PG_BIN, `psql${EXE}`) : `psql${EXE}`);
  // The Block D verifiers find psql as LF_PG_BIN/psql, not through LF_PG_PSQL.
  const bin = env.LF_PG_BIN ?? locate(psql);
  return { LF_PG_PSQL: psql, LF_PG_PORT: env.LF_PG_PORT, LF_PG_USER: env.LF_PG_USER ?? 'postgres', LF_PG_DATA: env.LF_PG_DATA ?? '/var/lib/postgresql/data', ...(bin ? { LF_PG_BIN: bin } : {}) };
}

// The Supabase API roles exist cluster-wide before any verifier runs. The
// older verifiers (decisions, audit, the block race) assume them, as on the
// shared audit cluster, and verifiers running in parallel would otherwise race
// to create them.
const BOOTSTRAP = `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;`;

function bootstrap(env) {
  const r = spawnSync(env.LF_PG_PSQL, ['-X', '-h', '127.0.0.1', '-p', env.LF_PG_PORT, '-U', env.LF_PG_USER, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
    { input: BOOTSTRAP, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`creating the API roles failed: ${r.stderr || r.error}`);
}

const CONNECTION_FAILURE = /connection to server at .* failed|server closed the connection unexpectedly|could not connect to server/;

function runOne(python, script, env) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(python, [join(HERE, script)], { cwd: ROOT, env: { ...process.env, ...env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ script, ok: code === 0, seconds: Math.round((Date.now() - started) / 1000), out }));
    child.on('error', (error) => resolve({ script, ok: false, seconds: 0, out: String(error) }));
  });
}

const tail = (out) => out.split('\n').slice(-25).map((l) => `    ${l}`).join('\n');

/**
 * Run a gate. `name` labels the output, `verifiers` is the ordered list of
 * script names, `env` is added to every verifier's environment (e.g.
 * LF_PG_FULL_CHAIN). A name missing from disk is a failure, never a skip.
 */
export async function runGate({ name, verifiers, env = {}, argv = [] }) {
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const list = verifiers.filter((s) => !only || s.includes(only));
  if (argv.includes('--list')) { console.log(list.join('\n')); return 0; }
  if (list.length === 0) { console.error(`${name}: no verifier matched`); return 1; }
  const missing = list.filter((s) => !existsSync(join(HERE, s)));
  if (missing.length) { console.error(`${name}: verifier(s) missing from database/scripts: ${missing.join(', ')}`); return 1; }

  const python = findPython();
  const external = Boolean(process.env.LF_PG_PORT);
  const bin = external ? null : findPgBin();
  if (!python || (!external && !bin)) {
    console.log(`${name} SKIP — no ${python ? 'PostgreSQL binary (set LF_PG_BIN, or LF_PG_PORT for a running cluster)' : 'Python 3 (set LF_PYTHON)'}; the database gate did NOT run`);
    return 0;
  }
  const cluster = external ? { env: externalClusterEnv(process.env), stop: () => {} } : await throwawayCluster(bin, name.replace(/[^a-z0-9]+/gi, '-'));
  const runEnv = { ...cluster.env, ...env };
  const jobs = Math.max(1, Number(process.env.LF_PG_VERIFY_JOBS ?? 2) || 2);
  console.log(`${name} — ${list.length} verifier(s) on ${external ? 'the configured' : 'a throwaway'} cluster (port ${cluster.env.LF_PG_PORT}), ${jobs} at a time`);
  const results = [];
  try {
    bootstrap(cluster.env);
    const queue = [...list];
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      while (queue.length) {
        const result = await runOne(python, queue.shift(), runEnv);
        results.push(result);
        console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.script} (${result.seconds}s)`);
        if (!result.ok) console.log(tail(result.out));
      }
    }));
    for (const [index, result] of results.entries()) {
      if (result.ok || !CONNECTION_FAILURE.test(result.out) || /AssertionError/.test(result.out)) continue;
      const retry = await runOne(python, result.script, runEnv);
      results[index] = { ...retry, retried: true };
      console.log(`${retry.ok ? 'PASS' : 'FAIL'} ${retry.script} (${retry.seconds}s, rerun alone after a connection failure)`);
      if (!retry.ok) console.log(tail(retry.out));
    }
  } finally {
    cluster.stop();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`${name} ${failed.length ? 'FAILED' : 'OK'} — ${results.length - failed.length}/${results.length} passed`);
  return failed.length ? 1 : 0;
}

/** Entry point shared by the gate scripts: run and set the exit code. */
export function main(url, gate) {
  if (process.argv[1] && fileURLToPath(url) === process.argv[1]) {
    runGate({ ...gate, argv: process.argv.slice(2) }).then((code) => { process.exitCode = code; }, (error) => { console.error(error.message); process.exitCode = 1; });
  }
}
