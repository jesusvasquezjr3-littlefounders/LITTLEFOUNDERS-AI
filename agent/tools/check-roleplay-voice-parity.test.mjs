import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkRoleplayVoiceParity,
  oracleLemonadeBeats,
  frontendLemonadeBeats,
  rebuiltLemonadeSpeakers,
  spokenWords,
} from './check-roleplay-voice-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = {
  oracle: 'oracle/src/tutor/roleplayScenes.ts',
  scenes: 'frontend/src/tutor/roleplay/scenes.ts',
  enUS: 'frontend/src/i18n/en-US/tutor.json',
  esMX: 'frontend/src/i18n/es-MX/tutor.json',
  ptBR: 'frontend/src/i18n/pt-BR/tutor.json',
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
  assert.ok(problems.some((p) => p.startsWith('speakers disagree')), problems.join(' | '));
});
