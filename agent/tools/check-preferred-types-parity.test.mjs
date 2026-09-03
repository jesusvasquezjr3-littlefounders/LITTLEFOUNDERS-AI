import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkPreferredTypesParity, coreTypes, oracleTypes } from './check-preferred-types-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = {
  oracle: 'oracle/src/tutor/turnSchema.ts',
  core: 'backend/src/routes/tutor.ts',
};
const real = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [f, readFileSync(path.join(ROOT, f), 'utf8')]));
const readReal = (f) => real[f];

test('the shipped repo agrees with itself', () => {
  assert.deepEqual(checkPreferredTypesParity(readReal), []);
});

test('both lists actually parse to the 10-value vocabulary, not an empty match', () => {
  const expected = [
    'coin_count',
    'make_change',
    'piggy_split',
    'needs_wants',
    'price_compare',
    'budget_fit',
    'savings_goal',
    'fair_trade',
    'interest_peek',
    'number_line',
  ];
  assert.deepEqual(oracleTypes(real[FILES.oracle]), expected);
  assert.deepEqual(coreTypes(real[FILES.core]), expected);
});

test('RED when Core is missing a type Oracle can hint at', () => {
  const read = (f) => (f === FILES.core ? real[f].replace("'fair_trade',\n", '') : real[f]);
  const problems = checkPreferredTypesParity(read);
  assert.ok(problems.some((p) => p.includes(FILES.core) && p.includes('fair_trade')));
});

test('RED when Oracle is missing a type Core accepts', () => {
  const read = (f) => (f === FILES.oracle ? real[f].replace("'fair_trade',\n", '') : real[f]);
  const problems = checkPreferredTypesParity(read);
  assert.ok(problems.some((p) => p.includes(FILES.oracle) && p.includes('fair_trade')));
});

console.log('check-preferred-types-parity OK — 4 tests, 2 deliberately desynchronised');
