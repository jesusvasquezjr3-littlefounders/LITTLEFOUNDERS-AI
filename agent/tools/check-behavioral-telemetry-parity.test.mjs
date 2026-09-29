import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkTelemetryParity, constArray, FILES, interfaceFields, readMigration } from './check-behavioral-telemetry-parity.mjs';
import { zodFields } from './check-session-end-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const real = Object.fromEntries(Object.values(FILES).map((f) => [f, readFileSync(path.join(ROOT, f), 'utf8')]));
const readReal = (f) => real[f];
const sql = readMigration();
const patched = (file, from, to) => (f) => {
  if (f !== file) return real[f];
  assert.ok(real[f].includes(from), `fixture drifted: ${from} not in ${f}`);
  return real[f].replace(from, to);
};

test('the shipped repo agrees with itself across every copy', () => {
  assert.deepEqual(checkTelemetryParity(readReal, sql), []);
});

test('the parsers actually read the real vocabularies (a vacuous pass is a failure)', () => {
  assert.equal(constArray(real[FILES.oracle], 'TELEMETRY_CHANNELS').length, 8);
  assert.ok(constArray(real[FILES.oracle], 'REPORTED_CHECK_IN_OUTCOMES').includes('undelivered'));
  assert.ok(zodFields(real[FILES.core], 'export const TelemetryEventBody').includes('repairOffered'));
  assert.deepEqual(interfaceFields(real[FILES.oracle], 'BehavioralTelemetryReport'), ['mode', 'evaluatedTurns', 'actionTurns', 'events']);
});

test('RED when Core lacks a channel Oracle measures', () => {
  const problems = checkTelemetryParity(patched(FILES.core, "  'hintAbuse',\n  'fastKnownMiss',\n] as const;", "  'hintAbuse',\n] as const;"), sql);
  assert.ok(problems.some((p) => p.includes('telemetry channels')));
});

test('RED when the migration has no column for a channel', () => {
  const problems = checkTelemetryParity(readReal, sql.replace(/^\s*hint_abuse\s+numeric.*$/m, ''));
  assert.ok(problems.some((p) => p.includes('hint_abuse')));
});

test('RED when the outcome CHECK lacks an outcome Oracle reports', () => {
  const problems = checkTelemetryParity(readReal, sql.replace("'undelivered',", ''));
  assert.ok(problems.some((p) => p.includes('migration CHECK on outcome')));
});

test('RED when Core lacks a firing field Oracle sends', () => {
  const problems = checkTelemetryParity(patched(FILES.core, '    repairOffered: z.boolean().nullable(),\n', ''), sql);
  assert.ok(problems.some((p) => p.includes('TelemetryEventBody lacks repairOffered')));
});

test('RED when Core would send a context field Oracle cannot parse', () => {
  const problems = checkTelemetryParity(
    patched(FILES.core, "  'canary',\n] as const;", "  'canary',\n  'mood',\n] as const;"),
    sql,
  );
  assert.ok(problems.some((p) => p.includes('optional context fields')));
});

test('RED when the client forgets the check-in answer frame', () => {
  const problems = checkTelemetryParity((f) => (f === FILES.clientTypes ? real[f].replaceAll("'check_in_response'", "'x'") : real[f]), sql);
  assert.ok(problems.some((p) => p.includes("no 'check_in_response' frame")));
});
