import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkMentorHonestyParity, FILES, readMigration } from './check-mentor-honesty-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const real = Object.fromEntries(
  Object.values(FILES).map((f) => [f, readFileSync(path.join(ROOT, f), 'utf8')]),
);
const readReal = (f) => real[f];
const sql = readMigration();

test('the shipped repo agrees with itself across all four copies', () => {
  assert.deepEqual(checkMentorHonestyParity(readReal, sql), []);
});

test('RED when Core’s body validator lacks a field Oracle sends', () => {
  const read = (f) =>
    f === FILES.coreBody ? real[f].replace('      revealPhrase: z.boolean(),\n', '') : real[f];
  const problems = checkMentorHonestyParity(read, sql);
  assert.ok(problems.some((p) => p.includes(FILES.coreBody) && p.includes('revealPhrase')));
});

test('RED when a vocabulary drifts on one side', () => {
  const read = (f) =>
    f === FILES.coreInput ? real[f].replace("'hint_ladder' | 'repair' | 'open_activity' | 'none'", "'hint_ladder' | 'repair' | 'none'") : real[f];
  const problems = checkMentorHonestyParity(read, sql);
  assert.ok(problems.some((p) => p.includes(FILES.coreInput) && p.includes('sequenceKind')));
});

test('RED when the migration CHECK disagrees', () => {
  const problems = checkMentorHonestyParity(readReal, sql.replace("'specific', 'generic'", "'specific'"));
  assert.ok(problems.some((p) => p.includes('praise')));
});

test('RED when Oracle adds a hint level the table does not know', () => {
  const read = (f) =>
    f === FILES.oracleLadder ? real[f].replace("'fill_blank', 'tell'", "'fill_blank', 'worked', 'tell'") : real[f];
  const problems = checkMentorHonestyParity(read, sql);
  assert.ok(problems.some((p) => p.includes('hint_level')));
});
