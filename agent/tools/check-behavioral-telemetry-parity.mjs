#!/usr/bin/env node
/**
 * C.9 + C.19 — ONE BEHAVIORAL TELEMETRY RECORD, HAND-WRITTEN IN EVERY PACKAGE.
 *
 * The 11 packages share no types (CLAUDE.md), so the telemetry vocabularies
 * are typed out more than once:
 *
 *   Oracle   oracle/src/tutor/behavioralTelemetry.ts  TELEMETRY_CHANNELS, EventSchema,
 *                                                     REPORTED_CHECK_IN_OUTCOMES,
 *                                                     BehavioralTelemetryReport
 *            oracle/src/core/client.ts               CONTEXT_OPTIONAL_FIELDS
 *            oracle/src/ws/protocol.ts               `check_in` / `check_in_response`
 *   Core     backend/src/services/pedagogy/behavioralTelemetry.ts  the same, as zod
 *                                                     bodies, plus CONTEXT_OPTIONAL_FIELDS
 *   DB       database/migrations/*_mentor_behavioral_telemetry.sql  columns and CHECKs
 *   Client   frontend/src/tutor/types.ts             the two socket frames
 *
 * A drift fails in the worst direction for these metrics: Core's strict body
 * refuses the close (a 400 — the session row stays open), a firing lands in a
 * column that measures another channel, or Core sends a context field an
 * Oracle cannot parse and every session refuses to start. This gate fails
 * first.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodFields } from './check-session-end-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FILES = {
  oracle: 'oracle/src/tutor/behavioralTelemetry.ts',
  oracleClient: 'oracle/src/core/client.ts',
  oracleProtocol: 'oracle/src/ws/protocol.ts',
  core: 'backend/src/services/pedagogy/behavioralTelemetry.ts',
  clientTypes: 'frontend/src/tutor/types.ts',
};

const quoted = (text) => [...text.matchAll(/'([A-Za-z_]+)'/g)].map((m) => m[1]);
const same = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
const snake = (name) => name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** `NAME = [ 'a', 'b' ] as const` → ['a', 'b']; null when absent. */
export function constArray(source, name) {
  const m = new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(source);
  return m ? quoted(m[1]) : null;
}

/** The `z.enum(...)` on `field:` inside the zod object after `anchor` (inline list or a named const). */
export function zodEnum(source, anchor, field) {
  const at = source.indexOf(anchor);
  if (at === -1) return null;
  const rest = source.slice(at);
  const inline = new RegExp(`${field}:\\s*z\\.enum\\(\\s*\\[([^\\]]*)\\]`).exec(rest);
  if (inline) return quoted(inline[1]);
  const named = new RegExp(`${field}:\\s*z\\.enum\\(\\s*(\\w+)\\s*\\)`).exec(rest);
  return named ? constArray(source, named[1]) : null;
}

/** The property names of `export interface NAME { … }`. */
export function interfaceFields(source, name) {
  const at = source.indexOf(`export interface ${name}`);
  if (at === -1) return null;
  const open = source.indexOf('{', at);
  let depth = 0;
  let close = open;
  for (; close < source.length; close += 1) {
    if (source[close] === '{') depth += 1;
    if (source[close] === '}') depth -= 1;
    if (depth === 0) break;
  }
  return [...source.slice(open + 1, close).matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
}

function migrationVocab(sql, column) {
  const m = new RegExp(`\\b${column}\\s+IN\\s*\\(([^)]*)\\)`, 'i').exec(sql);
  return m ? quoted(m[1]) : null;
}

export function checkTelemetryParity(read, migrationSql) {
  const problems = [];
  const src = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, read(f)]));
  if (migrationSql === null) return ['database/migrations: no *_mentor_behavioral_telemetry.sql migration found'];

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

  // The eight channels, and one column per channel in the firing ledger.
  const channels = constArray(src.oracle, 'TELEMETRY_CHANNELS');
  compare('telemetry channels', channels, [[FILES.core, constArray(src.core, 'TELEMETRY_CHANNELS')]]);
  for (const channel of channels ?? []) {
    if (!new RegExp(`^\\s*${snake(channel)}\\s+numeric\\(4, 3\\) NOT NULL CHECK \\(${snake(channel)} BETWEEN 0 AND 1\\)`, 'm').test(migrationSql)) {
      problems.push(`migration: tutor_telemetry_firing has no bounded column ${snake(channel)} for channel ${channel}`);
    }
  }

  // The firing record, field for field.
  const oracleFields = zodFields(src.oracle, 'const EventSchema');
  const coreFields = zodFields(src.core, 'export const TelemetryEventBody');
  if (!oracleFields || !coreFields) problems.push('could not read the firing record fields on both sides');
  else {
    const missing = oracleFields.filter((f) => !coreFields.includes(f));
    const extra = coreFields.filter((f) => !oracleFields.includes(f));
    if (missing.length) problems.push(`${FILES.core}: TelemetryEventBody lacks ${missing.join(', ')}`);
    if (extra.length) problems.push(`${FILES.core}: TelemetryEventBody has ${extra.join(', ')} that Oracle does not send`);
  }

  // The reported check-in outcomes (Oracle's internal pending/open never leave it).
  compare('reported check-in outcomes', constArray(src.oracle, 'REPORTED_CHECK_IN_OUTCOMES'), [
    [FILES.core, constArray(src.core, 'CHECK_IN_OUTCOMES')],
    ['migration CHECK on outcome', migrationVocab(migrationSql, 'outcome')],
  ]);
  compare('layer modes', zodEnum(src.oracle, 'const EventSchema', 'mode'), [
    [FILES.core, constArray(src.core, 'TELEMETRY_MODES')],
    ['migration CHECK on mode', migrationVocab(migrationSql, 'mode')],
    ['migration CHECK on telemetry_mode', migrationVocab(migrationSql, 'telemetry_mode')],
  ]);

  // The close report's top-level shape.
  const oracleReport = interfaceFields(src.oracle, 'BehavioralTelemetryReport');
  const coreReport = zodFields(src.core, 'export const BehavioralTelemetryReportBody');
  if (!oracleReport || !coreReport) problems.push('could not read the close report fields on both sides');
  else if (!same(oracleReport, coreReport)) {
    problems.push(`close report fields: Oracle [${oracleReport.join(', ')}] ≠ Core [${coreReport.join(', ')}]`);
  }

  // The context field negotiation.
  compare('optional context fields', constArray(src.oracleClient, 'CONTEXT_OPTIONAL_FIELDS'), [
    [FILES.core, constArray(src.core, 'CONTEXT_OPTIONAL_FIELDS')],
  ]);

  // The two socket frames exist on both ends.
  for (const frame of ['check_in', 'check_in_response']) {
    const literal = new RegExp(`'${frame}'`);
    if (!literal.test(src.oracleProtocol)) problems.push(`${FILES.oracleProtocol}: no '${frame}' frame`);
    if (!literal.test(src.clientTypes)) problems.push(`${FILES.clientTypes}: no '${frame}' frame`);
  }
  return problems;
}

export function readMigration() {
  const dir = path.join(ROOT, 'database/migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_mentor_behavioral_telemetry.sql'));
  return file ? readFileSync(path.join(dir, file), 'utf8') : null;
}

function main() {
  const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
  const problems = checkTelemetryParity(read, readMigration());
  if (problems.length > 0) {
    console.error('telemetry:check FAILED — the behavioral telemetry copies disagree:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    'telemetry:check OK — Oracle, Core, the migration and the client agree on the channels, the firing record, the outcomes, the context fields and the check-in frames',
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
