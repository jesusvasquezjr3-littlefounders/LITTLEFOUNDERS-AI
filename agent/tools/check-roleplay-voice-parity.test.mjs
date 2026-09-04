import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkRoleplayVoiceParity,
  oracleLemonadeBeats,
  frontendLemonadeBeats,
} from './check-roleplay-voice-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = {
  oracle: 'oracle/src/tutor/roleplayScenes.ts',
  scenes: 'frontend/src/tutor/roleplay/scenes.ts',
  enUS: 'frontend/src/i18n/en-US/tutor.json',
  esMX: 'frontend/src/i18n/es-MX/tutor.json',
  ptBR: 'frontend/src/i18n/pt-BR/tutor.json',
};
const real = Object.fromEntries(
  Object.entries(FILES).map(([k, f]) => [f, readFileSync(path.join(ROOT, f), 'utf8')]),
);
const readReal = (f) => real[f];

test('the shipped repo agrees with itself', () => {
  assert.deepEqual(checkRoleplayVoiceParity(readReal), []);
});

test('parses all 4 beats from both sides, not an empty or partial match', () => {
  const oracle = oracleLemonadeBeats(real[FILES.oracle]);
  const frontend = frontendLemonadeBeats(real[FILES.scenes]);
  assert.equal(oracle.length, 4);
  assert.equal(frontend.length, 4);
  assert.deepEqual(
    oracle.map((b) => b.speaker),
    ['companion', 'lead', 'companion', 'lead'],
  );
  assert.deepEqual(
    frontend.map((b) => b.speaker),
    ['companion', 'lead', 'companion', 'lead'],
  );
});

test('RED when a speaker role disagrees between oracle and the frontend', () => {
  const read = (f) =>
    f === FILES.oracle ? real[f].replace("speaker: 'companion'", "speaker: 'lead'") : real[f];
  const problems = checkRoleplayVoiceParity(read);
  assert.ok(problems.some((p) => p.includes('speaker disagrees')));
});

test('RED when the oracle-side text drifts from what the frontend actually captions', () => {
  const read = (f) =>
    f === FILES.oracle ? real[f].replace('lemonade, please', 'lemonade, right now') : real[f];
  const problems = checkRoleplayVoiceParity(read);
  assert.ok(problems.some((p) => p.includes('text disagrees')));
});

test('RED when a textKey points at a path the i18n tree does not have', () => {
  const read = (f) =>
    f === FILES.scenes ? real[f].replace('lemonade_change.beat1', 'lemonade_change.beat9') : real[f];
  const problems = checkRoleplayVoiceParity(read);
  assert.ok(problems.some((p) => p.includes('does not resolve')));
});

test('RED when the two sides disagree on how many beats the scene has', () => {
  const read = (f) =>
    f === FILES.oracle
      ? real[f].replace(
          /const LEMONADE_CHANGE: RoleplayVoiceScene = \{\n  beats: \[/,
          'const LEMONADE_CHANGE: RoleplayVoiceScene = {\n  beats: [\n    { speaker: \'lead\', text: { \'en-US\': "x", \'es-MX\': \'x\', \'pt-BR\': \'x\' } },',
        )
      : real[f];
  const problems = checkRoleplayVoiceParity(read);
  assert.ok(problems.some((p) => p.includes('beat count disagrees')));
});

console.log('check-roleplay-voice-parity OK — 6 tests, 4 deliberately desynchronised');
