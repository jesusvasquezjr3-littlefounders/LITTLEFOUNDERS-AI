import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkGameProtocolParity, constArray, FILES, manifestLiteral, zodFields } from './check-game-protocol-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const real = Object.fromEntries(Object.values(FILES).map((f) => [f, readFileSync(path.join(ROOT, f), 'utf8')]));
const readReal = (f) => real[f];
const patched = (file, from, to) => (f) => {
  if (f !== file) return real[f];
  assert.ok(real[f].includes(from), `fixture drifted: ${from} not in ${f}`);
  return real[f].replace(from, to);
};

test('the shipped repo agrees with itself across every copy', () => {
  assert.deepEqual(checkGameProtocolParity(readReal), []);
});

test('the parsers actually read the real values (a vacuous pass is a failure)', () => {
  const manifest = JSON.parse(real[FILES.manifest]);
  assert.deepEqual(manifestLiteral(real[FILES.spa], 'KRV1_MANIFEST').gameToHost['kr.runFinished'], manifest.gameToHost['kr.runFinished']);
  assert.equal(constArray(real[FILES.core], 'RUN_REPORT_FIELDS').length, 12);
  assert.deepEqual(constArray(real[FILES.core], 'DRIFT_FIELDS'), ['t0', 't1', 't2', 't3']);
  assert.deepEqual(constArray(real[FILES.core], 'BANDS'), ['6-9', '10-12', '13-17', 'adult']);
  assert.equal(constArray(real[FILES.core], 'LENS_KEYS').length, 6);
  assert.equal(constArray(real[FILES.oracleGame], 'GAME_LENS_KEYS').length, 6);
  assert.ok(zodFields(real[FILES.core], 'export const RunReport =').includes('kartBody'));
  assert.deepEqual(zodFields(real[FILES.core], 'export const Lens ='), ['itemHoldMs', 'boxesPassedWhileHolding', 'itemsUsed', 'driftReleases', 'recoveries']);
  assert.deepEqual(zodFields(real[FILES.core], 'export const DriftReleases ='), ['t0', 't1', 't2', 't3']);
});

test('RED, with a clear message, when the SPA protocol does not exist yet', () => {
  const problems = checkGameProtocolParity((f) => {
    if (f === FILES.spa) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return real[f];
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /frontend\/src\/games\/kartrush\/protocol\.ts: does not exist/);
});

test('RED when the SPA lacks a field the game sends', () => {
  const problems = checkGameProtocolParity(patched(FILES.spa, "'finishMs', 'bestLapMs', 'lapMs', 'rank', 'lens']", "'finishMs', 'bestLapMs', 'lapMs', 'lens']"));
  assert.ok(problems.some((p) => p.includes('kr.runFinished') && p.includes('rank')));
});

test('RED when the SPA invents a message or drops one the contract has', () => {
  const extra = checkGameProtocolParity(patched(FILES.spa, "'kr.runEnded': ['runKey'],", "'kr.runEnded': ['runKey'],\n    'kr.score': ['points'],"));
  assert.ok(extra.some((p) => p.includes('kr.score') && p.includes('the contract does not')));
  const missing = checkGameProtocolParity(patched(FILES.spa, "    'kr.pauseRequested': [],\n", ''));
  assert.ok(missing.some((p) => p.includes("lacks the contract's kr.pauseRequested")));
});

test('RED when the SPA\'s StartSpec or lens fields drift', () => {
  assert.ok(checkGameProtocolParity(patched(FILES.spa, "'startSpec': ['mode', 'trackId', 'character', 'speedClass']", "'startSpec': ['mode', 'trackId', 'character']")).some((p) => p.includes('startSpec')));
  assert.ok(checkGameProtocolParity(patched(FILES.spa, "'driftReleases': ['t0', 't1', 't2', 't3']", "'driftReleases': ['t0', 't1', 't2']")).some((p) => p.includes('driftReleases')));
});

test('RED when Core\'s RUN_REPORT_FIELDS lacks a field the game sends', () => {
  const problems = checkGameProtocolParity(patched(FILES.core, "'finishMs', 'bestLapMs', 'lapMs', 'rank', 'lens',\n]", "'finishMs', 'bestLapMs', 'lapMs', 'lens',\n]"));
  assert.ok(problems.some((p) => p.includes('RUN_REPORT_FIELDS') && p.includes('rank')));
});

test('RED when the zod object stops matching its field list (a decorative list is a failure)', () => {
  const problems = checkGameProtocolParity(patched(FILES.core, '  rank: z.number().int().min(1).max(8),\n', ''));
  assert.ok(problems.some((p) => p.includes('the RunReport zod object')));
  const lens = checkGameProtocolParity(patched(FILES.core, '  recoveries: Count,\n}).strict();\n\nexport const RunKey', '}).strict();\n\nexport const RunKey'));
  assert.ok(lens.some((p) => p.includes('the Lens zod object')));
});

test('RED when Core\'s lens or drift lists drift from the contract', () => {
  assert.ok(checkGameProtocolParity(patched(FILES.core, "'driftReleases', 'recoveries'] as const;\nexport const DRIFT", "'recoveries'] as const;\nexport const DRIFT")).some((p) => p.includes('LENS_FIELDS')));
  assert.ok(checkGameProtocolParity(patched(FILES.core, "DRIFT_FIELDS = ['t0', 't1', 't2', 't3']", "DRIFT_FIELDS = ['t0', 't1', 't2', 't3', 't4']")).some((p) => p.includes('DRIFT_FIELDS')));
});

test('RED when a vocabulary drifts between Core, the SPA and Oracle', () => {
  assert.ok(checkGameProtocolParity(patched(FILES.core, "'factory', 'saltBay', 'glacier'] as const", "'factory', 'saltBay'] as const")).some((p) => p.includes('track ids')));
  assert.ok(checkGameProtocolParity(patched(FILES.spa, "'100cc', '150cc', '200cc'", "'100cc', '150cc'")).some((p) => p.includes('speed classes')));
  assert.ok(checkGameProtocolParity(patched(FILES.spa, "KR_CHARACTERS = ['rho', 'zara', 'liruf', 'dina']", "KR_CHARACTERS = ['rho', 'zara', 'liruf']")).some((p) => p.includes('mentors')));
  assert.ok(checkGameProtocolParity(patched(FILES.spa, "'item_hold', 'drift_patient'", "'item_holding', 'drift_patient'")).some((p) => p.includes('lens keys')));
});

test('RED when Oracle\'s sealed debrief input drifts from Core (the AI line would silently never appear)', () => {
  assert.ok(checkGameProtocolParity(patched(FILES.oracleGame, "'drift_early', 'steady', 'swingy', 'neutral'] as const;\n", "'drift_early', 'steady', 'neutral'] as const;\n")).some((p) => p.includes('GAME_LENS_KEYS')));
  assert.ok(checkGameProtocolParity(patched(FILES.oracleGame, "GAME_BANDS = ['6-9', '10-12', '13-17', 'adult']", "GAME_BANDS = ['6-9', '10-12', '13-17']")).some((p) => p.includes('age bands')));
});

test('RED when practice stops being the one mode Core never records', () => {
  assert.ok(checkGameProtocolParity(patched(FILES.core, "RUN_MODES = ['single', 'timeTrial']", "RUN_MODES = ['single', 'timeTrial', 'practice']")).some((p) => p.includes('run modes')));
});

test('RED when the manifest literal in the SPA cannot be read', () => {
  const problems = checkGameProtocolParity(patched(FILES.spa, "'driftReleases': ['t0', 't1', 't2', 't3'],\n} as const;", "'driftReleases': ['t0', 't1', 't2', 't3'],\n};"));
  assert.ok(problems.some((p) => p.includes('could not read the KRV1_MANIFEST literal')));
});
