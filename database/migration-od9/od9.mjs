#!/usr/bin/env node
// OD-9 migration toolkit runner. Drives the SQL in ./sql through psql against
// any PostgreSQL that holds the project schema (legacy or migrated). See
// README.md for the cutover procedure.
//
//   node od9.mjs install
//   node od9.mjs inventory --label before
//   node od9.mjs defects            (dry run)    node od9.mjs defects --apply
//   node od9.mjs kc-credit          (dry run)    node od9.mjs kc-credit --apply
//   node od9.mjs consent            (dry run)    node od9.mjs consent --apply
//   node od9.mjs inventory --label after
//   node od9.mjs compare --before before --after after   (exit 1 on any loss)
//   node od9.mjs findings
//
// Connection: --db <conninfo or URL>, else OD9_DATABASE_URL, else the libpq
// PG* environment. psql comes from LF_PG_BIN when set, else PATH. Reports go
// to --out (default audit-results/od9 at the repository root).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..', '..');
const LABEL = /^[a-z0-9_-]{1,40}$/;
const COMMANDS = ['install', 'inventory', 'compare', 'defects', 'kc-credit', 'consent', 'findings'];

export class UsageError extends Error {}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!COMMANDS.includes(command)) throw new UsageError(`unknown command ${command ?? '(none)'}; expected one of ${COMMANDS.join(', ')}`);
  const opts = { command, apply: false };
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    const value = () => {
      const v = rest[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError(`${flag} needs a value`);
      return v;
    };
    if (flag === '--apply') opts.apply = true;
    else if (flag === '--label') opts.label = value();
    else if (flag === '--before') opts.before = value();
    else if (flag === '--after') opts.after = value();
    else if (flag === '--db') opts.db = value();
    else if (flag === '--out') opts.out = value();
    else if (flag === '--cutover') opts.cutover = value();
    else throw new UsageError(`unknown option ${flag}`);
  }
  if (opts.apply && !['defects', 'kc-credit', 'consent'].includes(command)) throw new UsageError(`--apply does not apply to ${command}`);
  if (command === 'inventory' && !LABEL.test(opts.label ?? '')) throw new UsageError('inventory needs --label (1-40 of a-z 0-9 _ -)');
  if (command === 'compare' && !(LABEL.test(opts.before ?? '') && LABEL.test(opts.after ?? ''))) {
    throw new UsageError('compare needs --before and --after labels');
  }
  if (opts.cutover !== undefined && Number.isNaN(Date.parse(opts.cutover))) throw new UsageError('--cutover must be an ISO timestamp');
  return opts;
}

const lit = (value) => `'${String(value).replace(/'/g, "''")}'`;

/** The one SQL statement a command runs, wrapped to return a single JSON array. */
export function commandSql(opts) {
  const cutover = opts.cutover ? `${lit(new Date(opts.cutover).toISOString())}::timestamptz` : 'now()';
  const body = {
    inventory: () => `SELECT * FROM od9.capture_inventory(${lit(opts.label)})`,
    compare: () => `SELECT * FROM od9.compare_inventory(${lit(opts.before)}, ${lit(opts.after)})`,
    defects: () => `SELECT * FROM od9.run_defects(${opts.apply}, ${cutover})`,
    'kc-credit': () => `SELECT * FROM od9.run_kc_credit(${opts.apply})`,
    consent: () => `SELECT * FROM od9.run_consent(${opts.apply}, ${cutover})`,
    findings: () => 'SELECT kind, status, count(*) AS n FROM od9.findings GROUP BY kind, status ORDER BY kind, status',
  }[opts.command];
  return `SELECT COALESCE(json_agg(t), '[]'::json) FROM (${body()}) t;`;
}

/** Sign-off verdict for a comparison: every lost or changed promised record fails it. */
export function summarizeComparison(rows) {
  const failures = rows.filter((r) =>
    (r.scope === 'account' && (r.verdict === 'changed' || r.verdict === 'missing_after'))
    || (r.scope === 'family' && r.verdict !== 'same')
    || r.scope === 'gap'
    || (r.scope === 'identifier' && r.verdict !== 'new_after'));
  const families = rows.filter((r) => r.scope === 'family');
  return {
    ok: failures.length === 0,
    failures,
    families: { total: families.length, same: families.filter((r) => r.verdict === 'same').length },
    categories: rows.filter((r) => r.scope === 'category').map(({ category, before_rows, after_rows, verdict }) => ({ category, before_rows, after_rows, verdict })),
    newAfter: rows.filter((r) => r.scope === 'account' && r.verdict === 'new_after').length,
  };
}

/** Counts by a key, for the printed summary of the row-level reports. */
export function tally(rows, keyOf) {
  const out = {};
  for (const row of rows) {
    const key = keyOf(row);
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export function psqlCommand(env = process.env) {
  const bin = env.LF_PG_BIN;
  if (!bin) return 'psql';
  const exe = join(bin, process.platform === 'win32' ? 'psql.exe' : 'psql');
  return existsSync(exe) ? exe : join(bin, 'psql');
}

export function runPsql(sql, { db, env = process.env } = {}) {
  if (typeof sql !== 'string' || sql.trim() === '') throw new TypeError('runPsql needs SQL text');
  const conn = db ?? env.OD9_DATABASE_URL;
  const args = ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...(conn ? ['-d', conn] : [])];
  const result = spawnSync(psqlCommand(env), args, { input: sql, encoding: 'utf8', env, maxBuffer: 256 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `psql exited ${result.status}`);
  return result.stdout.replace(/\r\n/g, '\n'); // psql on Windows ends lines with CRLF
}

export function installSql() {
  const dir = join(HERE, 'sql');
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
}

export function run(opts, { env = process.env, log = console.log } = {}) {
  if (opts.command === 'install') {
    runPsql(installSql(), { db: opts.db, env });
    log('od9 toolkit installed (schema od9)');
    return { ok: true };
  }
  const stdout = runPsql(commandSql(opts), { db: opts.db, env });
  // json_agg separates elements with newlines: the whole output is one value.
  const rows = JSON.parse(stdout.trim() || '[]');
  let result;
  if (opts.command === 'compare') result = { ...summarizeComparison(rows), rows };
  else if (opts.command === 'defects') result = { ok: true, mode: opts.apply ? 'apply' : 'dry_run', counts: tally(rows, (r) => `${r.kind}:${r.action}`), rows };
  else if (opts.command === 'kc-credit') {
    result = {
      ok: true, mode: opts.apply ? 'apply' : 'dry_run', learners: new Set(rows.map((r) => r.user_id)).size,
      kcs_credited: rows.reduce((n, r) => n + Number(r.kcs_credited), 0), new_credits: rows.reduce((n, r) => n + Number(r.new_credits), 0), rows,
    };
  } else if (opts.command === 'consent') {
    const missing = rows.filter((r) => r.status === 'missing');
    result = {
      ok: true, mode: opts.apply ? 'apply' : 'dry_run', children: new Set(rows.map((r) => r.user_id)).size,
      missing: missing.length, byPractice: tally(missing, (r) => r.practice_key), byGrantor: tally(missing, (r) => r.grantor), rows,
    };
  } else result = { ok: true, rows };

  const out = opts.out ?? join(ROOT, 'audit-results', 'od9');
  mkdirSync(out, { recursive: true });
  const tag = opts.label ?? (opts.command === 'compare' ? `${opts.before}-vs-${opts.after}` : result.mode ?? 'report');
  const file = join(out, `${opts.command}-${tag}.json`);
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  const { rows: _rows, failures, ...summary } = result;
  log(JSON.stringify({ ...summary, ...(failures ? { failures: failures.length } : {}), report: file }, null, 2));
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = run(parseArgs(process.argv.slice(2)));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof UsageError ? `usage: ${error.message}` : error.message);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
}
