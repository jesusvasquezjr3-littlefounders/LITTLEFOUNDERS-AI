import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkDemoStepParity } from './check-demo-step-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = {
  oracleSchema: 'oracle/src/tutor/turnSchema.ts',
  oracleWire: 'oracle/src/ws/protocol.ts',
  coreBody: 'backend/src/routes/tutor.ts',
  coreData: 'backend/src/services/tutorData.ts',
  frontendWire: 'frontend/src/rebuild/mentor/session/types.ts',
};
const real = Object.fromEntries(
  Object.values(FILES).map((f) => [f, readFileSync(path.join(ROOT, f), 'utf8')]),
);
const readReal = (f) => real[f];

test('the shipped repo agrees with itself across all six copies', () => {
  assert.deepEqual(checkDemoStepParity(readReal), []);
});

test('RED when the wire type is missing a kind the model schema defines', () => {
  const read = (f) =>
    f === FILES.oracleWire
      ? real[f].replace(
          "kind: 'add' | 'remove' | 'pause' | 'place' | 'assign' | 'pair' | 'move';",
          "kind: 'add' | 'remove' | 'pause' | 'place' | 'assign' | 'pair';",
        )
      : real[f];
  const problems = checkDemoStepParity(read);
  assert.ok(problems.some((p) => p.includes(FILES.oracleWire) && p.includes('move')));
});

test('RED when Core\'s body validator has a field the model schema does not', () => {
  const read = (f) =>
    f === FILES.coreBody
      ? real[f].replace(
          'value: z.number().optional(),\n',
          'value: z.number().optional(),\n          extra: z.string().optional(),\n',
        )
      : real[f];
  const problems = checkDemoStepParity(read);
  assert.ok(problems.some((p) => p.includes(FILES.coreBody) && p.includes('extra')));
});

test('RED when Core\'s TS interface and its OWN Zod revalidator disagree with each other', () => {
  // The two copies inside tutorData.ts are compared against the canonical
  // (turnSchema.ts) independently, so a drift between just those two still
  // surfaces — the interface loses `pair` while the Zod schema next to it
  // keeps it.
  const read = (f) =>
    f === FILES.coreData
      ? real[f].replace(
          "kind: 'add' | 'remove' | 'pause' | 'place' | 'assign' | 'pair' | 'move';",
          "kind: 'add' | 'remove' | 'pause' | 'place' | 'assign' | 'move';",
        )
      : real[f];
  const problems = checkDemoStepParity(read);
  assert.ok(problems.some((p) => p.includes(FILES.coreData) && p.includes('TutorTurnDemonstrateStep') && p.includes('pair')));
});

test('RED when the frontend wire mirror is missing a field the others carry', () => {
  const read = (f) =>
    f === FILES.frontendWire ? real[f].replace('  bucket?: string;\n', '') : real[f];
  const problems = checkDemoStepParity(read);
  assert.ok(problems.some((p) => p.includes(FILES.frontendWire) && p.includes('bucket')));
});

console.log('check-demo-step-parity OK — 5 tests, 4 deliberately desynchronised');
