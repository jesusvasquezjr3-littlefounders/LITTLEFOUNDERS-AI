#!/usr/bin/env node
// social-db-verify.mjs — the data-gateway half of the social release gate.
//
// Appendix J 1.3 asks for a per-release adversarial test that a kid-role
// profile cannot be found, searched or followed by an unconnected account
// through ANY path, the data gateway included (DoD 2.1(2)). Core's stubbed
// suites cover the API; the database path is proven only by the native
// PostgreSQL verifiers in this directory. Before this runner they were run by
// hand, once per lane. This runs every one of them, against the full
// migration chain, and fails on any failure.
//
//   node database/scripts/social-db-verify.mjs [--only <substring>] [--list]
//
// The verifiers (VERIFIERS below): every verify-social-*.py, plus
// verify-teen-discoverable-postgres.py, verify-coop-goals-postgres.py and
// verify-account-erasure-postgres.py. Each creates and drops its own database.
//
// Cluster:
//   * LF_PG_PORT set: use that running cluster (CI's postgres service
//     container). LF_PG_USER (default postgres), LF_PG_DATA (its
//     data_directory, which the verifiers check before touching anything) and
//     psql from LF_PG_PSQL, LF_PG_BIN or PATH.
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
// report says so; any assertion failure stays a failure. Exit 1 on any failure.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');
const EXE = process.platform === 'win32' ? '.exe' : '';
const EXTRA = ['verify-teen-discoverable-postgres.py', 'verify-coop-goals-postgres.py', 'verify-account-erasure-postgres.py'];

/** Every verifier this gate runs, in a stable order. */
export function verifiers(files = readdirSync(HERE)) {
  const social = files.filter((f) => /^verify-social-.+\.py$/.test(f)).sort();
  return [...social, ...EXTRA.filter((f) => files.includes(f))];
}

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

async function throwawayCluster(bin) {
  const dir = mkdtempSync(join(tmpdir(), 'lf-social-db-verify-'));
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

function externalCluster(env) {
  const bin = env.LF_PG_BIN ?? null;
  const psql = env.LF_PG_PSQL ?? (bin ? join(bin, `psql${EXE}`) : `psql${EXE}`);
  return {
    env: { LF_PG_PSQL: psql, LF_PG_PORT: env.LF_PG_PORT, LF_PG_USER: env.LF_PG_USER ?? 'postgres', LF_PG_DATA: env.LF_PG_DATA ?? '/var/lib/postgresql/data', ...(bin ? { LF_PG_BIN: bin } : {}) },
    stop: () => {},
  };
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
    const child = spawn(python, [join(HERE, script)], { cwd: ROOT, env: { ...process.env, ...env, PYTHONIOENCODING: 'utf-8' } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ script, ok: code === 0, seconds: Math.round((Date.now() - started) / 1000), out }));
    child.on('error', (error) => resolve({ script, ok: false, seconds: 0, out: String(error) }));
  });
}

async function main(argv) {
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const list = verifiers().filter((s) => !only || s.includes(only));
  if (argv.includes('--list')) { console.log(list.join('\n')); return 0; }
  if (list.length === 0) { console.error('social:db-verify: no verifier matched'); return 1; }

  const python = findPython();
  const external = Boolean(process.env.LF_PG_PORT);
  const bin = external ? null : findPgBin();
  if (!python || (!external && !bin)) {
    console.log(`social:db-verify SKIP — no ${python ? 'PostgreSQL binary (set LF_PG_BIN, or LF_PG_PORT for a running cluster)' : 'Python 3 (set LF_PYTHON)'}; the data-gateway gate did NOT run`);
    return 0;
  }
  const cluster = external ? externalCluster(process.env) : await throwawayCluster(bin);
  const jobs = Math.max(1, Number(process.env.LF_PG_VERIFY_JOBS ?? 2) || 2);
  console.log(`social:db-verify — ${list.length} verifier(s) on ${external ? 'the configured' : 'a throwaway'} cluster (port ${cluster.env.LF_PG_PORT}), ${jobs} at a time`);
  const results = [];
  try {
    bootstrap(cluster.env);
    const queue = [...list];
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      while (queue.length) {
        const result = await runOne(python, queue.shift(), cluster.env);
        results.push(result);
        console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.script} (${result.seconds}s)`);
        if (!result.ok) console.log(result.out.split('\n').slice(-25).map((l) => `    ${l}`).join('\n'));
      }
    }));
    for (const [index, result] of results.entries()) {
      if (result.ok || !CONNECTION_FAILURE.test(result.out) || /AssertionError/.test(result.out)) continue;
      const retry = await runOne(python, result.script, cluster.env);
      results[index] = { ...retry, retried: true };
      console.log(`${retry.ok ? 'PASS' : 'FAIL'} ${retry.script} (${retry.seconds}s, rerun alone after a connection failure)`);
      if (!retry.ok) console.log(retry.out.split('\n').slice(-25).map((l) => `    ${l}`).join('\n'));
    }
  } finally {
    cluster.stop();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`social:db-verify ${failed.length ? 'FAILED' : 'OK'} — ${results.length - failed.length}/${results.length} passed`);
  return failed.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => { console.error(error.message); process.exitCode = 1; });
}
