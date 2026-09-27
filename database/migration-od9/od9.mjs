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
//   node od9.mjs spot-check --label before --families 10   (section 4.5 sample)
//   node od9.mjs spot-check --label after --from before     (exit 1 on a change)
//   node od9.mjs plan --applied-through 0082   (no database: the ordered
//                                               migration plan for the cutover)
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
const COMMANDS = ['install', 'inventory', 'compare', 'defects', 'kc-credit', 'consent', 'findings', 'spot-check', 'plan'];

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
    else if (flag === '--from') opts.from = value();
    else if (flag === '--families') opts.families = value();
    else if (flag === '--applied-through') opts.appliedThrough = value();
    else if (flag === '--migrations') opts.migrations = value();
    else throw new UsageError(`unknown option ${flag}`);
  }
  if (opts.apply && !['defects', 'kc-credit', 'consent'].includes(command)) throw new UsageError(`--apply does not apply to ${command}`);
  if (command === 'inventory' && !LABEL.test(opts.label ?? '')) throw new UsageError('inventory needs --label (1-40 of a-z 0-9 _ -)');
  if (command === 'compare' && !(LABEL.test(opts.before ?? '') && LABEL.test(opts.after ?? ''))) {
    throw new UsageError('compare needs --before and --after labels');
  }
  if (opts.cutover !== undefined && Number.isNaN(Date.parse(opts.cutover))) throw new UsageError('--cutover must be an ISO timestamp');
  if (command === 'spot-check') {
    if (!LABEL.test(opts.label ?? '')) throw new UsageError('spot-check needs --label (1-40 of a-z 0-9 _ -)');
    if (opts.from !== undefined && !LABEL.test(opts.from)) throw new UsageError('--from must be a label');
    if (opts.from !== undefined && opts.families !== undefined) throw new UsageError('--from reuses the earlier sample; --families does not apply');
    if (opts.from === undefined) {
      const n = Number(opts.families ?? 10);
      if (!Number.isInteger(n) || n < 1 || n > 500) throw new UsageError('--families must be an integer from 1 to 500');
      opts.families = n;
    }
  } else if (opts.from !== undefined || opts.families !== undefined) throw new UsageError('--from and --families belong to spot-check');
  if (command === 'plan') {
    if (!/^\d{1,4}$/.test(opts.appliedThrough ?? '')) throw new UsageError('plan needs --applied-through NNNN (the production high-water mark)');
    opts.appliedThrough = Number(opts.appliedThrough);
  } else if (opts.appliedThrough !== undefined || opts.migrations !== undefined) throw new UsageError('--applied-through and --migrations belong to plan');
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
    'spot-check': () => `SELECT * FROM od9.capture_spot_check(${lit(opts.label)}, ${opts.from ? 'NULL' : Number(opts.families)}, ${opts.from ? lit(opts.from) : 'NULL'})`,
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

const PHASE = /^-- @phase:\s*(expand|contract)\s*$/m;
const SNAKE = /[a-z][a-z0-9]*(?:_[a-z0-9]+)*_\*|[a-z][a-z0-9]*(?:_[a-z0-9]+)+/g;

/** The `@after-release` clause of a migration header, continuation lines joined. */
export function afterReleaseText(sql) {
  const lines = sql.split(/\r?\n/);
  const start = lines.findIndex((l) => /^-- @after-release:/.test(l));
  if (start < 0) return null;
  const parts = [lines[start].replace(/^-- @after-release:\s*/, '')];
  for (const line of lines.slice(start + 1)) {
    const m = /^--\s{2,}(\S.*)$/.exec(line);
    if (!m) break;
    parts.push(m[1]);
  }
  return parts.join(' ').trim();
}

/**
 * The ordering a header states: every snake_case name (or `prefix_*` glob)
 * after the word "after" or "before", up to the next of those words or the
 * end of the sentence, that names another migration.
 */
export function orderingRefs(text, bases) {
  const refs = { after: new Set(), before: new Set() };
  if (!text) return refs;
  for (const sentence of text.split(/[.;](?=\s|$)/)) {
    const words = sentence.split(/\b(after|before)\b/i);
    for (let i = 1; i < words.length; i += 2) {
      const kind = words[i].toLowerCase();
      for (const token of words[i + 1].match(SNAKE) ?? []) {
        const test = token.endsWith('_*') ? (b) => b.startsWith(token.slice(0, -1)) : (b) => b === token;
        for (const b of bases.filter(test)) refs[kind].add(b);
      }
    }
  }
  return refs;
}

/**
 * The cutover migration plan: every migration above the production
 * high-water mark in the order it must be applied (filename order), its
 * declared phase and the release it waits for, and every ordering its header
 * states that the filename order would break.
 */
export function migrationPlan(files, appliedThrough) {
  const all = files.filter((f) => /^\d{4}_.+\.sql$/.test(f.file)).sort((a, b) => a.file.localeCompare(b.file))
    .map((f) => ({ ...f, number: Number(f.file.slice(0, 4)), base: f.file.slice(5, -4) }));
  const byBase = new Map();
  for (const f of all) byBase.set(f.base, [...(byBase.get(f.base) ?? []), f]);
  const bases = [...byBase.keys()];
  const pending = [];
  const violations = [];
  const undeclared = [];
  for (const f of all.filter((m) => m.number > appliedThrough)) {
    const phase = PHASE.exec(f.sql)?.[1] ?? null;
    if (!phase) undeclared.push(f.file);
    const afterRelease = afterReleaseText(f.sql);
    const refs = orderingRefs(afterRelease, bases.filter((b) => b !== f.base));
    const resolve = (set) => [...set].flatMap((b) => byBase.get(b)).sort((a, b) => a.file.localeCompare(b.file));
    const after = resolve(refs.after);
    const before = resolve(refs.before);
    for (const r of after) if (r.number > f.number) violations.push(`${f.file} states it applies after ${r.file}, which sorts later`);
    for (const r of before) if (r.number < f.number) violations.push(`${f.file} states it applies before ${r.file}, which sorts earlier`);
    pending.push({ file: f.file, phase, afterRelease, after: after.map((r) => r.file), before: before.map((r) => r.file) });
  }
  return {
    ok: violations.length === 0 && undeclared.length === 0,
    appliedThrough,
    pending,
    counts: { pending: pending.length, expand: pending.filter((p) => p.phase === 'expand').length, contract: pending.filter((p) => p.phase === 'contract').length },
    violations,
    undeclared,
  };
}

const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');

/** The operator's checklist for a plan: one line per migration, in order. */
export function planMarkdown(plan) {
  const lines = [`# Cutover migration plan above ${String(plan.appliedThrough).padStart(4, '0')}`, '',
    `${plan.counts.pending} pending: ${plan.counts.expand} expand, ${plan.counts.contract} contract. Apply in this order, one transaction per file.`, ''];
  if (!plan.ok) lines.push('**Refused:** fix these before the cutover.', '', ...plan.violations.map((v) => `- ${v}`), ...plan.undeclared.map((u) => `- ${u} declares no phase`), '');
  lines.push('| Done | Migration | Phase | Waits for |', '|---|---|---|---|');
  for (const p of plan.pending) lines.push(`| [ ] | ${p.file} | ${p.phase ?? 'undeclared'} | ${cell(p.phase === 'contract' ? p.afterRelease : '')} |`);
  return `${lines.join('\n')}\n`;
}

/** Section 4.5 sign-off sheet for a spot-check comparison. */
export function spotCheckMarkdown(result, opts) {
  const lines = [`# OD-9 spot check: ${opts.from ? `${opts.from} vs ${opts.label}` : opts.label}`, '',
    opts.from
      ? `${result.families} families, ${result.accounts} accounts, ${result.rows.length} values compared: ${result.same} same, ${result.changed} changed, ${result.missing} missing after, ${result.newAfter} new after. Verdict: ${result.ok ? 'no promised value changed' : '**a promised value changed or disappeared**'}.`
      : `${result.families} families, ${result.accounts} accounts, ${result.rows.length} values captured.`,
    '', '| Family | Account | Item | Before | After | Verdict |', '|---|---|---|---|---|---|'];
  for (const r of result.rows) {
    lines.push(`| ${r.family_key.slice(0, 8)} | ${cell(r.username ?? r.user_id.slice(0, 8))} | ${cell(r.item)} | ${cell(r.before_value)} | ${cell(r.after_value)} | ${r.verdict} |`);
  }
  lines.push('', 'Reviewed by (name, role): ____________________   Date: ____________   Signature: ____________', '');
  return lines.join('\n');
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

function writeReport(opts, name, value) {
  const out = opts.out ?? join(ROOT, 'audit-results', 'od9');
  mkdirSync(out, { recursive: true });
  const file = join(out, name);
  writeFileSync(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

export function run(opts, { env = process.env, log = console.log } = {}) {
  if (opts.command === 'plan') {
    const dir = opts.migrations ?? join(ROOT, 'database', 'migrations');
    const plan = migrationPlan(readdirSync(dir).map((file) => ({ file, sql: readFileSync(join(dir, file), 'utf8') })), opts.appliedThrough);
    const tag = String(opts.appliedThrough).padStart(4, '0');
    const report = writeReport(opts, `plan-${tag}.json`, plan);
    const sheet = writeReport(opts, `plan-${tag}.md`, planMarkdown(plan));
    log(JSON.stringify({ ok: plan.ok, ...plan.counts, violations: plan.violations, undeclared: plan.undeclared, report, sheet }, null, 2));
    return plan;
  }
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
  } else if (opts.command === 'spot-check') {
    const count = (v) => rows.filter((r) => r.verdict === v).length;
    result = {
      ok: count('changed') === 0 && count('missing_after') === 0, mode: opts.from ? 'compare' : 'capture',
      families: new Set(rows.map((r) => r.family_key)).size, accounts: new Set(rows.map((r) => r.user_id)).size,
      same: count('same'), changed: count('changed'), missing: count('missing_after'), newAfter: count('new_after'), rows,
    };
    result.sheet = writeReport(opts, `spot-check-${opts.label}.md`, spotCheckMarkdown(result, opts));
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
