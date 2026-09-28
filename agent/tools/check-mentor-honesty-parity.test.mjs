import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkMentorHonestyParity, checkReplyChipParity, FILES, readMigration } from './check-mentor-honesty-parity.mjs';

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

// GAP-FIX-R2: the reply-chip cap and budget, Oracle against the frontend.
test('the shipped reply-chip cap and budget agree', () => {
  assert.deepEqual(checkReplyChipParity(readReal), []);
});

test('RED when the frontend shows a fourth chip Oracle never sends', () => {
  const read = (f) => (f === FILES.frontendSocket ? real[f].replace('export const REPLY_CHIP_MAX = 3;', 'export const REPLY_CHIP_MAX = 4;') : real[f]);
  assert.ok(checkReplyChipParity(read).some((p) => p.includes('REPLY_CHIP_MAX')));
});

test('RED when the option budget drifts from the frontend Copy Budget', () => {
  const read = (f) => (f === FILES.oracle ? real[f].replace('youngWords: 5', 'youngWords: 6') : real[f]);
  assert.ok(checkReplyChipParity(read).some((p) => p.includes('youngWords')));
});

test('RED when Core loses the pre-delivery reveal check', () => {
  const read = (f) => (f === FILES.coreBody ? real[f].replace("'/segments/:segmentId/reveal-check'", "'/segments/:segmentId/x'") : real[f]);
  assert.ok(checkReplyChipParity(read).some((p) => p.includes('reveal-check')));
});
