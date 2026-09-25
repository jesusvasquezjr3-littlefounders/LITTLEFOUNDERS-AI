import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkAllianceParity, FILES, migrationVocab, readMigration, unionType } from './check-alliance-parity.mjs';
import { constArray, interfaceFields } from './check-behavioral-telemetry-parity.mjs';
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
  assert.deepEqual(checkAllianceParity(readReal, sql), []);
});

test('the parsers actually read the real vocabularies (a vacuous pass is a failure)', () => {
  assert.deepEqual(constArray(real[FILES.alliance], 'CONTINUITY_KINDS'), ['first_meeting', 'persona_switch', 'memory_gap', 'continuing']);
  assert.equal(constArray(real[FILES.lexicon], 'CONCEPT_FAMILIES').length, 9);
  assert.ok(interfaceFields(real[FILES.alliance], 'AllianceReport').includes('renegotiations'));
  assert.ok(zodFields(real[FILES.coreAlliance], 'export const AllianceReportBody').includes('goalSettledAtTurn'));
  assert.ok(zodFields(real[FILES.disposition], 'export const DispositionProfileSchema').includes('persistentlyDeclined'));
  assert.deepEqual(unionType(real[FILES.clientApi], 'Persistence'), ['persists', 'disengages_early', 'unknown']);
  assert.deepEqual(migrationVocab(sql, 'bond_proxy'), ['yes', 'partly', 'no']);
});

test('RED when Core lacks a goal-agreement value Oracle reports', () => {
  const problems = checkAllianceParity(patched(FILES.coreAlliance, "'unconfirmed', 'not_reached'", "'unconfirmed'"), sql);
  assert.ok(problems.some((p) => p.includes('goal agreements')));
});

test('RED when the migration CHECK lacks a renegotiation outcome', () => {
  const renegotiation = sql.indexOf('tutor_alliance_renegotiation (');
  const broken = sql.slice(0, renegotiation) + sql.slice(renegotiation).replace("'session_ended', 'superseded', 'shadow'", "'superseded', 'shadow'");
  const problems = checkAllianceParity(readReal, broken);
  assert.ok(problems.some((p) => p.includes('renegotiation outcome')));
});

test('RED when Core lacks a field of the alliance report Oracle sends', () => {
  const problems = checkAllianceParity(patched(FILES.coreAlliance, '    bondGenericTurns: turns,\n', ''), sql);
  assert.ok(problems.some((p) => p.includes('alliance report')));
});

test('RED when a concept family is missing from the migration', () => {
  const problems = checkAllianceParity(readReal, sql.replace("'earning', 'trade', 'sharing', 'time'", "'earning', 'trade', 'sharing'"));
  assert.ok(problems.some((p) => p.includes('concept families')));
});

test('RED when the projection Core sends has a field Oracle cannot parse', () => {
  const problems = checkAllianceParity(
    patched(FILES.coreDisposition, '  typicalSpokenReplyMs: number | null;\n}', '  typicalSpokenReplyMs: number | null;\n  mood: string;\n}'),
    sql,
  );
  assert.ok(problems.some((p) => p.includes('disposition projection')));
});

test('RED when the client offers a bond-proxy answer Core refuses', () => {
  const problems = checkAllianceParity(patched(FILES.clientApi, "['yes', 'partly', 'no']", "['yes', 'partly', 'no', 'meh']"), sql);
  assert.ok(problems.some((p) => p.includes('bond-proxy answers')));
});

test('RED when the client forgets the goal answer frame', () => {
  const problems = checkAllianceParity((f) => (f === FILES.clientTypes ? real[f].replaceAll("'goal_response'", "'x'") : real[f]), sql);
  assert.ok(problems.some((p) => p.includes("'goal_response'")));
});

test('RED when no migration exists at all', () => {
  assert.deepEqual(checkAllianceParity(readReal, null), ['database/migrations: no *_mentor_alliance_and_disposition.sql migration found']);
});
