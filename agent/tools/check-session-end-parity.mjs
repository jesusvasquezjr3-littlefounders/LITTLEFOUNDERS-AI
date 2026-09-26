#!/usr/bin/env node
/**
 * C.16 + C.8/C.12 — ONE SESSION-END RECORD, HAND-WRITTEN IN EVERY PACKAGE.
 *
 * The 11 packages share no types (CLAUDE.md), so the session-end vocabularies
 * are typed out more than once:
 *
 *   Oracle   oracle/src/tutor/sessionClosing.ts   CLOSING_SCRIPTS, SESSION_OPENINGS,
 *                                                  EFFORT_ACTS, CLOSING_SCRIPT_FOR_REASON
 *            oracle/src/tutor/sessionEndSignal.ts EventSchema (fields, mode), OFFER_OUTCOMES
 *            oracle/src/core/client.ts            CloseReason
 *   Core     backend/src/services/pedagogy/sessionEnd.ts  the same four, plus
 *                                                  SessionEndEventBody and CLOSE_REASONS
 *            backend/src/routes/tutor.ts          CloseBody.closeReason
 *   DB       database/migrations/*_mentor_session_end_and_closing.sql  the CHECKs
 *   Client   frontend/src/rebuild/mentor/session/types.ts, frontend/src/rebuild/mentor/SessionEnd.tsx
 *
 * A drift fails in the worst direction for these metrics: Core's validator
 * refuses the close's new fields (the close is REFUSED — a 400), or the
 * Session-Closing Script Accuracy is measured against a different table than
 * the one Oracle closes with. This gate fails first.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FILES = {
  oracleClosing: 'oracle/src/tutor/sessionClosing.ts',
  oracleSignal: 'oracle/src/tutor/sessionEndSignal.ts',
  oracleClient: 'oracle/src/core/client.ts',
  core: 'backend/src/services/pedagogy/sessionEnd.ts',
  coreRoute: 'backend/src/routes/tutor.ts',
  clientTypes: 'frontend/src/rebuild/mentor/session/types.ts',
  clientRebuild: 'frontend/src/rebuild/mentor/SessionEnd.tsx',
};

const quoted = (text) => [...text.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
const same = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/** `NAME = [ 'a', 'b' ] as const` → ['a', 'b']; null when absent. */
export function constArray(source, name) {
  const m = new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(source);
  return m ? quoted(m[1]) : null;
}

/** `NAME: Record<…> = { key: 'value', … }` → { key: value }; null when absent. */
export function constRecord(source, name) {
  const at = source.indexOf(`${name}:`);
  if (at === -1) return null;
  const open = source.indexOf('{', source.indexOf('=', at));
  const close = source.indexOf('};', open);
  if (open === -1 || close === -1) return null;
  return Object.fromEntries([...source.slice(open + 1, close).matchAll(/(\w+):\s*'([a-z_]+)'/g)].map((m) => [m[1], m[2]]));
}

/** `export type NAME = 'a' | 'b';` (possibly multi-line) → ['a', 'b']. */
export function unionType(source, name) {
  const m = new RegExp(`type ${name}\\s*=([^;]*);`).exec(source);
  return m ? quoted(m[1]) : null;
}

/** The field names of the zod object that follows `anchor`. */
export function zodFields(source, anchor) {
  const at = source.indexOf(anchor);
  if (at === -1) return null;
  const open = source.indexOf('.object({', at);
  const close = source.indexOf('.strict()', open);
  if (open === -1 || close === -1) return null;
  return [...source.slice(open, close).matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);
}

/** The `z.enum([...])` on `field:` inside the zod object after `anchor`. */
export function zodEnum(source, anchor, field) {
  const at = source.indexOf(anchor);
  if (at === -1) return null;
  const rest = source.slice(at);
  const m = new RegExp(`${field}:\\s*z\\.enum\\(\\s*\\[([^\\]]*)\\]`).exec(rest);
  return m ? quoted(m[1]) : null;
}

function migrationVocab(sql, column) {
  const m = new RegExp(`${column}\\s+IN\\s*\\(([^)]*)\\)`, 'i').exec(sql);
  return m ? quoted(m[1]) : null;
}

export function checkSessionEndParity(read, migrationSql) {
  const problems = [];
  const src = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, read(f)]));
  if (migrationSql === null) return ['database/migrations: no *_mentor_session_end_and_closing.sql migration found'];

  const compare = (label, reference, others) => {
    if (reference === null || reference.length === 0) {
      problems.push(`${label}: could not resolve the reference vocabulary in Oracle`);
      return;
    }
    for (const [where, values] of others) {
      if (values === null) problems.push(`${where}: could not find ${label}`);
      else if (!same(values, reference)) problems.push(`${where}: ${label} [${values.join(', ')}] ≠ Oracle's [${reference.join(', ')}]`);
    }
  };

  // The four closing scripts.
  const scripts = constArray(src.oracleClosing, 'CLOSING_SCRIPTS');
  compare('closing scripts', scripts, [
    [FILES.core, constArray(src.core, 'CLOSING_SCRIPTS')],
    ['migration CHECK on closing_script', migrationVocab(migrationSql, 'closing_script')],
    [FILES.clientTypes, unionType(src.clientTypes, 'ClosingScript')],
    [FILES.clientRebuild, unionType(src.clientRebuild, 'ClosingScript')],
  ]);

  // The openings.
  compare('session openings', constArray(src.oracleClosing, 'SESSION_OPENINGS'), [
    [FILES.core, constArray(src.core, 'SESSION_OPENINGS')],
    ['migration CHECK on opening', migrationVocab(migrationSql, 'opening')],
  ]);

  // The acts a completed close names.
  compare('effort acts', constArray(src.oracleClosing, 'EFFORT_ACTS'), [
    [FILES.clientTypes, unionType(src.clientTypes, 'EffortAct')],
    [FILES.clientRebuild, unionType(src.clientRebuild, 'EffortAct')],
  ]);

  // Close reasons: Oracle's union, Core's list, Core's route.
  compare('close reasons', unionType(src.oracleClient, 'CloseReason'), [
    [FILES.core, constArray(src.core, 'CLOSE_REASONS')],
    [FILES.coreRoute, zodEnum(src.coreRoute, 'const CloseBody', 'closeReason')],
  ]);

  // The reason → script table, entry by entry.
  const oracleTable = constRecord(src.oracleClosing, 'CLOSING_SCRIPT_FOR_REASON');
  const coreTable = constRecord(src.core, 'CLOSING_SCRIPT_FOR_REASON');
  if (!oracleTable || !coreTable) problems.push('could not read CLOSING_SCRIPT_FOR_REASON on both sides');
  else {
    for (const reason of new Set([...Object.keys(oracleTable), ...Object.keys(coreTable)])) {
      if (oracleTable[reason] !== coreTable[reason]) {
        problems.push(`CLOSING_SCRIPT_FOR_REASON.${reason}: Oracle '${oracleTable[reason]}' ≠ Core '${coreTable[reason]}'`);
      }
    }
  }

  // The session-end signal's firing record.
  const oracleFields = zodFields(src.oracleSignal, 'const EventSchema');
  const coreFields = zodFields(src.core, 'export const SessionEndEventBody');
  if (!oracleFields || !coreFields) problems.push('could not read the firing record fields on both sides');
  else {
    const missing = oracleFields.filter((f) => !coreFields.includes(f));
    const extra = coreFields.filter((f) => !oracleFields.includes(f));
    if (missing.length) problems.push(`${FILES.core}: SessionEndEventBody lacks ${missing.join(', ')}`);
    if (extra.length) problems.push(`${FILES.core}: SessionEndEventBody has ${extra.join(', ')} that Oracle does not send`);
  }
  // Oracle reports `pending` as `unanswered`, so it never reaches Core.
  const reported = (constArray(src.oracleSignal, 'OFFER_OUTCOMES') ?? []).filter((o) => o !== 'pending');
  compare('reported offer outcomes', reported, [
    [FILES.core, zodEnum(src.core, 'export const SessionEndEventBody', 'outcome')],
    ['migration CHECK on outcome', migrationVocab(migrationSql, 'outcome')],
  ]);
  compare('signal modes', zodEnum(src.oracleSignal, 'const EventSchema', 'mode'), [
    [FILES.core, zodEnum(src.core, 'export const SessionEndEventBody', 'mode')],
    ['migration CHECK on mode', migrationVocab(migrationSql, 'mode')],
  ]);
  return problems;
}

export function readMigration() {
  const dir = path.join(ROOT, 'database/migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_mentor_session_end_and_closing.sql'));
  return file ? readFileSync(path.join(dir, file), 'utf8') : null;
}

function main() {
  const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
  const problems = checkSessionEndParity(read, readMigration());
  if (problems.length > 0) {
    console.error('session-end:check FAILED — the session-end copies disagree:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    'session-end:check OK — Oracle, Core, the migration and the client agree on the closing scripts, openings and the signal record',
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
