import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkSessionEndParity, constArray, constRecord, FILES, readMigration, zodFields } from './check-session-end-parity.mjs';

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
  assert.deepEqual(checkSessionEndParity(readReal, sql), []);
});

test('the parsers actually read the real vocabularies (a vacuous pass is a failure)', () => {
  assert.deepEqual(constArray(real[FILES.oracleClosing], 'CLOSING_SCRIPTS'), ['completed', 'interrupted', 'learner_left', 'safety_stop']);
  assert.equal(Object.keys(constRecord(real[FILES.core], 'CLOSING_SCRIPT_FOR_REASON')).length, 8);
  assert.ok(zodFields(real[FILES.oracleSignal], 'const EventSchema').includes('surpriseRateWindow'));
});

test('RED when Core maps a close reason to a different script than Oracle', () => {
  const problems = checkSessionEndParity(patched(FILES.core, "  safety_stop: 'safety_stop',", "  safety_stop: 'completed',"), sql);
  assert.ok(problems.some((p) => p.includes('CLOSING_SCRIPT_FOR_REASON.safety_stop')));
});

test('RED when the migration CHECK lacks a closing script', () => {
  const problems = checkSessionEndParity(readReal, sql.replace("'learner_left', 'safety_stop')", "'learner_left')"));
  assert.ok(problems.some((p) => p.includes('closing_script')));
});

test('RED when Core lacks a firing field Oracle sends', () => {
  const problems = checkSessionEndParity(patched(FILES.core, '    confirmed: z.boolean().nullable(),\n', ''), sql);
  assert.ok(problems.some((p) => p.includes('SessionEndEventBody lacks confirmed')));
});

test('RED when the client forgets a closing script', () => {
  const problems = checkSessionEndParity(
    patched(FILES.clientTypes, "export type ClosingScript = 'completed' | 'interrupted' | 'learner_left' | 'safety_stop';",
      "export type ClosingScript = 'completed' | 'interrupted' | 'learner_left';"),
    sql,
  );
  assert.ok(problems.some((p) => p.includes(FILES.clientTypes)));
});

test('RED when Oracle adds a new opening that Core and the table do not know', () => {
  const problems = checkSessionEndParity(
    patched(FILES.oracleClosing, "  'reengage_interrupted_fresh',\n] as const;", "  'reengage_interrupted_fresh',\n  'reengage_holiday',\n] as const;"),
    sql,
  );
  assert.ok(problems.some((p) => p.includes('session openings')));
});

test('RED when a close reason is added on one side only', () => {
  const problems = checkSessionEndParity(patched(FILES.oracleClient, "  | 'error';", "  | 'error'\n  | 'timeout';"), sql);
  assert.ok(problems.some((p) => p.includes('close reasons')));
});

test('RED when a graded observation drops the conversational latency again (C.8/C.12 gap-fix)', () => {
  const problems = checkSessionEndParity(
    patched(FILES.oracleOrchestrator, 'latencyMs: this.behavioralTelemetry.replyLatency(input.onsetAtMs),\n        latencySource: input.source,', 'latencyMs: null,\n        latencySource: input.source,'),
    sql,
  );
  assert.ok(problems.some((p) => p.includes('latencyMs: null')));
});

test('RED when the signal and C.9 disagree on the latency channels', () => {
  const problems = checkSessionEndParity(patched(FILES.oracleSignal, "['typed', 'spoken', 'activity']", "['typed', 'activity']"), sql);
  assert.ok(problems.some((p) => p.includes('latency channels')));
});
