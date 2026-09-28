#!/usr/bin/env node
/**
 * C.18 — ONE MENTOR-HONESTY RECORD, FOUR HAND-WRITTEN COPIES.
 *
 * `oracle` and `backend` share no types (CLAUDE.md "No shared types across
 * the 11 packages, by design"), so the per-turn honesty facts behind the
 * Answer-Reveal Rate and the Sycophancy Audit are typed out four times:
 *
 *   1. Oracle's `TurnHonesty` interface     oracle/src/tutor/feedbackHonesty.ts
 *   2. Core's request validator             backend/src/routes/tutor.ts  (TurnHonestyBody)
 *   3. Core's writer input                  backend/src/services/pedagogy/turnHonesty.ts
 *   4. The table's CHECK vocabularies       database/migrations/*_mentor_integrity_evidence.sql
 *
 * A field added on one side and missed on another degrades SILENTLY in the
 * worst direction for a monitoring metric: Core's `.strict()` body refuses the
 * honesty object and the turn lands without its row — the reveal rate is then
 * computed over fewer turns and nobody is told. This gate fails first.
 *
 * It checks (a) the FIELD NAMES of copies 1–3 agree, and (b) the closed
 * VOCABULARIES of the four enum-valued facts agree across all four copies.
 *
 * GAP-FIX-R2 adds (c) the REPLY CHIPS the honesty screen clears (Frontend
 * Bible 08 §2, §4, §9): Oracle's three-chip cap (`REPLY_CHIP_MAX`,
 * turnSchema.ts) and its `option` word budget (`REPLY_CHIP_BUDGET`,
 * feedbackHonesty.ts) must match the frontend's cap (`REPLY_CHIP_MAX`,
 * useTutorSocket.ts) and Copy Budget (copyBudget.ts), and Core's
 * pre-delivery reveal-check route must exist for Oracle's client call. A
 * drift here shows a fourth chip, or a chip the screen's budget rejects.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FILES = {
  oracle: 'oracle/src/tutor/feedbackHonesty.ts',
  oracleLadder: 'oracle/src/tutor/hintLadder.ts',
  coreBody: 'backend/src/routes/tutor.ts',
  coreInput: 'backend/src/services/pedagogy/turnHonesty.ts',
  oracleTurn: 'oracle/src/tutor/turnSchema.ts',
  oracleClient: 'oracle/src/core/client.ts',
  frontendSocket: 'frontend/src/rebuild/mentor/session/useTutorSocket.ts',
  frontendBudget: 'frontend/src/rebuild/design/copyBudget.ts',
};

/** (c) GAP-FIX-R2: the reply-chip cap and budget, Oracle against the frontend, and the Core route Oracle calls. */
export function checkReplyChipParity(read) {
  const problems = [];
  const num = (source, re) => { const m = re.exec(source); return m ? Number(m[1]) : null; };
  const oracleMax = num(read(FILES.oracleTurn), /export const REPLY_CHIP_MAX = (\d+);/);
  const frontMax = num(read(FILES.frontendSocket), /export const REPLY_CHIP_MAX = (\d+);/);
  if (oracleMax === null || frontMax === null) problems.push('REPLY_CHIP_MAX: not found in Oracle turnSchema.ts or the frontend useTutorSocket.ts');
  else if (oracleMax !== frontMax) problems.push(`REPLY_CHIP_MAX: Oracle ${oracleMax} ≠ frontend ${frontMax}`);
  const honesty = read(FILES.oracle);
  const budget = /REPLY_CHIP_BUDGET = \{([^}]*)\}/.exec(honesty)?.[1] ?? '';
  const words = num(budget, /(?:^|[\s,])words:\s*(\d+)/);
  const young = num(budget, /youngWords:\s*(\d+)/);
  const max = num(budget, /(?:^|[\s,])max:\s*(\d+)/);
  const copy = read(FILES.frontendBudget);
  const app = /const app = \{([^}]*)\}/.exec(copy)?.[1] ?? '';
  if (words === null || words !== num(app, /option:\s*(\d+)/)) problems.push(`REPLY_CHIP_BUDGET.words ${words} ≠ the frontend option budget`);
  if (young === null || !copy.includes(`if (role === 'option') limit = ${young}`)) problems.push(`REPLY_CHIP_BUDGET.youngWords ${young} ≠ the frontend 6-9 option budget`);
  if (max !== oracleMax) problems.push(`REPLY_CHIP_BUDGET.max ${max} ≠ REPLY_CHIP_MAX ${oracleMax}`);
  if (!read(FILES.oracleClient).includes('/reveal-check')) problems.push(`${FILES.oracleClient}: no reveal-check call`);
  if (!read(FILES.coreBody).includes("'/segments/:segmentId/reveal-check'")) problems.push(`${FILES.coreBody}: no /segments/:segmentId/reveal-check route`);
  return problems;
}

/** field (camelCase) → DB column holding its vocabulary. */
const VOCAB_FIELDS = {
  sequenceKind: 'sequence_kind',
  hintLevel: 'hint_level',
  verdictContext: 'verdict_context',
  praise: 'praise',
};

function block(source, anchor) {
  const at = source.indexOf(anchor);
  if (at === -1) return null;
  const open = source.indexOf('{', at);
  const close = /\n\s*\}/.exec(source.slice(open));
  return close ? source.slice(open + 1, open + close.index) : null;
}

const fieldsOf = (region) => [...region.matchAll(/^\s*(\w+)\??:\s/gm)].map((m) => m[1]);
const quoted = (text) => [...text.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

function lineOf(region, field) {
  const m = new RegExp(`^\\s*${field}\\??:\\s*(.*)$`, 'm').exec(region);
  return m ? m[1] : '';
}

/** Oracle types its enums through aliases; resolve them in the same file (or HINT_LEVELS). */
function oracleVocab(source, ladderSource, field, region) {
  const line = lineOf(region, field);
  if (/HintLevel/.test(line)) {
    const levels = /HINT_LEVELS\s*=\s*\[([^\]]*)\]/.exec(ladderSource);
    return levels ? quoted(levels[1]) : [];
  }
  const alias = /\b([A-Z]\w+)\b/.exec(line)?.[1];
  if (alias) {
    const decl = new RegExp(`export type ${alias}\\s*=\\s*([^;]*);`).exec(source);
    return decl ? quoted(decl[1]) : [];
  }
  return quoted(line);
}

function migrationVocab(sql, column) {
  const m = new RegExp(`${column}\\s+IN\\s*\\(([^)]*)\\)`, 'i').exec(sql);
  return m ? quoted(m[1]) : null;
}

const same = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

export function checkMentorHonestyParity(read, migrationSql) {
  const problems = [];
  const oracleSrc = read(FILES.oracle);
  const ladderSrc = read(FILES.oracleLadder);
  const sites = [
    { name: FILES.oracle, region: block(oracleSrc, 'export interface TurnHonesty') },
    { name: FILES.coreBody, region: block(read(FILES.coreBody), 'const TurnHonestyBody') },
    { name: FILES.coreInput, region: block(read(FILES.coreInput), 'export interface TurnHonestyInput') },
  ];
  for (const site of sites) {
    if (site.region === null) problems.push(`${site.name}: could not find the honesty shape to check`);
  }
  if (problems.length > 0) return problems;
  if (migrationSql === null) return ['database/migrations: no *_mentor_integrity_evidence.sql migration found'];

  const canonical = fieldsOf(sites[0].region);
  for (const site of sites.slice(1)) {
    const fields = fieldsOf(site.region);
    const missing = canonical.filter((f) => !fields.includes(f));
    const extra = fields.filter((f) => !canonical.includes(f));
    if (missing.length > 0) problems.push(`${site.name}: missing field(s) ${missing.join(', ')} present in ${FILES.oracle}`);
    if (extra.length > 0) problems.push(`${site.name}: has field(s) ${extra.join(', ')} that ${FILES.oracle} does not`);
  }

  for (const [field, column] of Object.entries(VOCAB_FIELDS)) {
    const reference = oracleVocab(oracleSrc, ladderSrc, field, sites[0].region);
    if (reference.length === 0) {
      problems.push(`${FILES.oracle}: could not resolve the vocabulary of ${field}`);
      continue;
    }
    for (const site of sites.slice(1)) {
      const values = quoted(lineOf(site.region, field));
      if (!same(values, reference)) {
        problems.push(`${site.name}: ${field} vocabulary [${values.join(', ')}] ≠ Oracle's [${reference.join(', ')}]`);
      }
    }
    const db = migrationVocab(migrationSql, column);
    if (db === null || !same(db, reference)) {
      problems.push(`migration CHECK on ${column}: [${(db ?? []).join(', ')}] ≠ Oracle's [${reference.join(', ')}]`);
    }
  }
  return problems;
}

export function readMigration() {
  const dir = path.join(ROOT, 'database/migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_mentor_integrity_evidence.sql'));
  return file ? readFileSync(path.join(dir, file), 'utf8') : null;
}

function main() {
  const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
  const problems = [...checkMentorHonestyParity(read, readMigration()), ...checkReplyChipParity(read)];
  if (problems.length > 0) {
    console.error('honesty:check FAILED — the Mentor-honesty copies disagree:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('honesty:check OK — Oracle, Core (body + writer) and the migration agree on the honesty record; the reply-chip cap and budget match the frontend');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
