import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkRoleplayVoiceParity,
  oracleLemonadeBeats,
  rebuiltLemonadeSpeakers,
  spokenWords,
} from './check-roleplay-voice-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = {
  oracle: 'oracle/src/tutor/roleplayScenes.ts',
  rebuiltScenes: 'frontend/src/rebuild/mentor/session/roleplay.ts',
  rebuiltEnUS: 'frontend/src/i18n/en-US/rebuild-mentor.json',
  rebuiltEsMX: 'frontend/src/i18n/es-MX/rebuild-mentor.json',
  rebuiltPtBR: 'frontend/src/i18n/pt-BR/rebuild-mentor.json',
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
  assert.equal(oracle.length, 4);
  assert.deepEqual(oracle.map((b) => b.speaker), ['companion', 'lead', 'companion', 'lead']);
  assert.deepEqual(rebuiltLemonadeSpeakers(real[FILES.rebuiltScenes]), ['companion', 'lead', 'companion', 'lead']);
});

test('RED when a speaker role disagrees between oracle and the rebuilt scene', () => {
  const read = (f) =>
    f === FILES.oracle ? real[f].replace("speaker: 'companion'", "speaker: 'lead'") : real[f];
  const problems = checkRoleplayVoiceParity(read);
  assert.ok(problems.some((p) => p.includes('speaker disagrees')), problems.join(' | '));
});

test('RED when the oracle-side text drifts from what the rebuilt screen captions', () => {
  const read = (f) =>
    f === FILES.oracle ? real[f].replace('lemonade, please', 'lemonade, right now') : real[f];
  const problems = checkRoleplayVoiceParity(read);
  assert.ok(problems.some((p) => p.includes("rebuilt caption's words disagree")), problems.join(' | '));
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
  assert.ok(problems.some((p) => p.includes('beat count disagrees')), problems.join(' | '));
});

console.log('check-roleplay-voice-parity OK — 7 tests, 5 deliberately desynchronised');

test('W2M.3: the rebuilt scene table and captions agree with oracle, word for word', () => {
  assert.deepEqual(rebuiltLemonadeSpeakers(real[FILES.rebuiltScenes]), ['companion', 'lead', 'companion', 'lead']);
  assert.equal(spokenWords('You help me figure out the change — go ahead!'), spokenWords('You help me figure out the change, go ahead!'));
});

test('RED when a rebuilt caption says a word the pre-generated clip does not', () => {
  const read = (f) => (f === FILES.rebuiltEsMX ? real[f].replace('cinco pesos!', 'seis pesos!') : real[f]);
  const problems = checkRoleplayVoiceParity(read);
  assert.ok(problems.some((p) => p.includes('beat 0/es-MX') && p.includes("rebuilt caption's words disagree")), problems.join(' | '));
});

test('RED when a rebuilt beat changes speaker', () => {
  const read = (f) => (f === FILES.rebuiltScenes ? real[f].replace("{ speaker: 'companion', emotion: 'happy'", "{ speaker: 'lead', emotion: 'happy'") : real[f]);
  const problems = checkRoleplayVoiceParity(read);
  assert.ok(problems.some((p) => p.startsWith('speaker disagrees')), problems.join(' | '));
});
