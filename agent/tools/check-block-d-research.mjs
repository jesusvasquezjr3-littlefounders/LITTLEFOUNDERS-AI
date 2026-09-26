// check-block-d-research.mjs — D.9's research foundation as a gate, plus the
// Block D Part 4 governance boundary and OD-23's experiment rule.
//
// Appendix G is the authoritative basis for D.10 onward and is revisited on
// the same cadence as Appendices B and D. docs/operations/block-d-research.json
// records, for every requirement, the Appendix G sections it rests on, the
// honest strength of that evidence and the metric through which the
// product's own data can test it, plus the recalibration log. This gate
// fails when:
//   - a requirement from D.10 to D.23 has no entry, cites a section Appendix G
//     does not have, uses an unknown strength, or names no metric;
//   - the written foundation stops naming a requirement or its strength;
//   - the recalibration log has no dated entry or a next review before its
//     own date; with --strict (release readiness) it also fails when the
//     next review is overdue;
//   - parent-facing copy (the app's Block D namespaces, the shared strings
//     and the marketing site, in three locales) claims proof: "scientifically
//     proven", "studies show" and their es-MX and pt-BR equivalents (Block D
//     Part 4: nothing here is marketed as proven);
//   - a Block D table gains an experiment, variant or treatment column
//     (OD-23: experiments on adults only; a minor's Block D data is observed,
//     never assigned).
// It runs in the unfiltered repo gates.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liveTables } from './check-block-d-retention.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const REGISTRY = 'docs/operations/block-d-research.json';
export const FOUNDATION = 'docs/operations/BLOCK-D-RESEARCH-FOUNDATION.md';
const RETENTION = 'docs/operations/block-d-retention.json';
const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
const REQUIRED = Array.from({ length: 14 }, (_, i) => `D.${i + 10}`);
const TYPES = 'uuid|text|integer|int|bigint|smallint|numeric|boolean|timestamptz|timestamp|date|jsonb|real|double|varchar|character';

function flatten(node, prefix = '') {
  if (typeof node === 'string') return [[prefix, node]];
  if (!node || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

/** The columns of each table: its CREATE TABLE statement plus every ADD COLUMN on it. */
export function tableColumns(migrations) {
  const tables = liveTables(migrations);
  const out = new Map();
  for (const [name, create] of tables) {
    const cols = [...create.matchAll(new RegExp(`^\\s*([a-z_][a-z0-9_]*)\\s+(?:${TYPES})\\b`, 'gim'))].map((m) => m[1].toLowerCase());
    out.set(name, new Set(cols));
  }
  for (const { sql } of migrations) {
    for (const m of sql.matchAll(/\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)([\s\S]*?);/gi)) {
      const set = out.get(m[1].toLowerCase());
      if (!set) continue;
      for (const c of m[2].matchAll(/\badd\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)) set.add(c[1].toLowerCase());
    }
  }
  return out;
}

/** Pure check over in-memory inputs, so the gate can be tested against known-bad fixtures. */
export function checkResearch({ registry, readFile, locales, migrations, retentionTables, today, strict = false }) {
  const failures = [];
  const warnings = [];
  const appendix = readFile(registry.appendix) ?? '';
  const sections = new Set([...appendix.matchAll(/^### (\d+\.\d+) /gm)].map((m) => m[1]));
  const foundation = readFile(FOUNDATION);
  if (foundation === null) failures.push(`${FOUNDATION} is missing`);
  for (const id of REQUIRED) {
    const entry = registry.requirements[id];
    if (!entry) { failures.push(`${id}: no entry in ${REGISTRY}`); continue; }
    if (!Array.isArray(entry.sections) || entry.sections.length === 0) failures.push(`${id}: cites no Appendix G section`);
    for (const s of entry.sections ?? []) if (!sections.has(s)) failures.push(`${id}: Appendix G has no section ${s}`);
    if (!registry.strengths[entry.strength]) failures.push(`${id}: unknown evidence strength "${entry.strength}"`);
    if (!entry.metric || entry.metric.trim().length < 5) failures.push(`${id}: names no metric through which the product's own data can test it`);
    if (!/^S07\.\d+$/.test(entry.implementedIn ?? '')) failures.push(`${id}: names no checkpoint`);
    if (foundation !== null) {
      const row = foundation.split('\n').find((line) => line.startsWith(`| ${id} |`));
      if (!row) failures.push(`${FOUNDATION} has no row for ${id}`);
      else if (!row.includes(entry.strength)) failures.push(`${FOUNDATION}: the ${id} row does not state its strength (${entry.strength})`);
    }
  }

  const log = registry.recalibration?.log ?? [];
  const dated = log.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(e.nextDue ?? '') && e.by && e.decision);
  if (dated.length === 0) failures.push('the recalibration log has no complete dated entry');
  for (const e of dated) if (e.nextDue <= e.date) failures.push(`recalibration ${e.date}: its next review (${e.nextDue}) is not after it`);
  const next = dated.map((e) => e.nextDue).sort().at(-1);
  if (next && today > next) (strict ? failures : warnings).push(`the Appendix G recalibration was due ${next} and has not been recorded`);

  const excepted = new Set((registry.claims.exceptions ?? []).map((e) => e.key));
  for (const e of registry.claims.exceptions ?? []) if (!e.why || e.why.trim().length < 20) failures.push(`claim exception ${e.key}: needs a reason a reviewer can check`);
  let screened = 0;
  for (const locale of LOCALES) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${registry.claims.patterns[locale].join('|')})(?![\\p{L}\\p{N}])`, 'iu');
    for (const ns of registry.claims.namespaces) {
      const file = locales(locale, ns);
      if (file === null) { failures.push(`${ns}.json (${locale}) is missing`); continue; }
      for (const [key, text] of flatten(file)) {
        screened++;
        const hit = pattern.exec(text);
        if (hit && !excepted.has(`${ns}:${key}`)) failures.push(`${ns}:${key} [${locale}] claims proof ("${hit[0]}"); Block D mechanics are theoretically coherent, not proven`);
      }
    }
  }

  const columns = tableColumns(migrations);
  const experiment = new RegExp(registry.experiments.columnPattern, 'i');
  for (const table of retentionTables) {
    for (const col of columns.get(table) ?? []) {
      if (experiment.test(col) && !registry.experiments.allowed?.[`${table}.${col}`]) {
        failures.push(`${table}.${col}: an experiment column on a Block D table (OD-23: experiments on adults only; a minor's Block D data is observed, never assigned)`);
      }
    }
  }
  return { failures, warnings, screened };
}

export function liveInputs(root = ROOT) {
  const dir = join(root, 'database/migrations');
  const cache = new Map();
  return {
    registry: JSON.parse(readFileSync(join(root, REGISTRY), 'utf8')),
    readFile: (path) => { try { return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } },
    locales: (locale, ns) => {
      const key = `${locale}/${ns}`;
      if (!cache.has(key)) {
        try { cache.set(key, JSON.parse(readFileSync(join(root, 'frontend/src/i18n', locale, `${ns}.json`), 'utf8'))); } catch { cache.set(key, null); }
      }
      return cache.get(key);
    },
    migrations: readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n') })),
    retentionTables: Object.keys(JSON.parse(readFileSync(join(root, RETENTION), 'utf8')).tables),
    today: new Date().toISOString().slice(0, 10),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const strict = process.argv.includes('--strict');
  const inputs = liveInputs();
  const { failures, warnings, screened } = checkResearch({ ...inputs, strict });
  for (const warning of warnings) console.warn(`WARN: ${warning}`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  console.log(`block-d-research OK — ${REQUIRED.length} requirements traced to Appendix G with their evidence strength and metric; ${screened} parent-facing strings in three locales make no claim of proof; no experiment column on ${inputs.retentionTables.length} Block D tables${strict ? '; the recalibration is not overdue' : ''}`);
}
