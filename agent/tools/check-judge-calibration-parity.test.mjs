import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrayConst, checkJudgeCalibrationParity, FILES, judgeBlock, numericField, sqlFloor, sqlVocab } from './check-judge-calibration-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const real = Object.fromEntries(Object.values(FILES).map((f) => [f, readFileSync(path.join(ROOT, f), 'utf8')]));
const readReal = (f) => real[f] ?? null;
const dir = path.join(ROOT, 'database/migrations');
const sql = readFileSync(path.join(dir, readdirSync(dir).find((f) => /_mentor_judge_calibration_registry\.sql$/.test(f))), 'utf8');
const patched = (file, from, to) => (f) => {
  if (f !== file) return readReal(f);
  assert.ok(real[f].includes(from), `fixture drift: ${from} not in ${f}`);
  return real[f].replace(from, to);
};

test('the shipped repo agrees with itself', () => {
  assert.deepEqual(checkJudgeCalibrationParity(readReal, sql), []);
});

test('the parsers read the real values (a vacuous pass is a failure)', () => {
  assert.deepEqual(arrayConst(real[FILES.core], 'JUDGE_IDS'), ['live_content_judge', 'transcript_judge']);
  assert.deepEqual(sqlVocab(sql, 'judge_id'), ['live_content_judge', 'transcript_judge']);
  assert.deepEqual(sqlVocab(sql, 'stratum'), ['standard', 'sensitive', 'routine', 'hard']);
  assert.equal(sqlVocab(sql, 'scope').length, 7);
  assert.equal(sqlVocab(sql, 'failure_reasons').length, 7);
  assert.equal(numericField(real[FILES.core], 'export const CALIBRATION_FLOORS', 'judgeKappa'), 0.7);
  assert.deepEqual(sqlFloor(sql, 'threshold_agreement'), { low: 0.9, high: 1 });
  assert.match(judgeBlock(real[FILES.core], 'transcript_judge'), /minItemsPerStratum: 10/);
});

test('RED when a Core floor is lowered', () => {
  const p = checkJudgeCalibrationParity(patched(FILES.core, 'judgeAgreement: 0.9,', 'judgeAgreement: 0.8,'), sql);
  assert.ok(p.some((x) => x.includes('judgeAgreement')), p.join('\n'));
  const gap = checkJudgeCalibrationParity(patched(FILES.core, 'lengthBiasMaxGap: 0.15,', 'lengthBiasMaxGap: 0.3,'), sql);
  assert.ok(gap.some((x) => x.includes('lengthBiasMaxGap')), gap.join('\n'));
});

test('RED when a judge minimum or the cadence is loosened', () => {
  const p = checkJudgeCalibrationParity(patched(FILES.core, 'minItemsPerStratum: 20,', 'minItemsPerStratum: 12,'), sql);
  assert.ok(p.some((x) => x.includes('live_content_judge.minItemsPerStratum')), p.join('\n'));
  const age = checkJudgeCalibrationParity(patched(FILES.core, 'maxAgeDays: 35,', 'maxAgeDays: 98,'), sql);
  assert.ok(age.some((x) => x.includes('cadence')), age.join('\n'));
});

test('RED when the migration lowers a floor, drops a vocabulary member or stops recomputing', () => {
  const low = checkJudgeCalibrationParity(readReal, sql.replace('CHECK (threshold_judge_kappa BETWEEN 0.70 AND 1)', 'CHECK (threshold_judge_kappa BETWEEN 0.50 AND 1)'));
  assert.ok(low.some((x) => x.includes('threshold_judge_kappa')), low.join('\n'));
  const vocab = checkJudgeCalibrationParity(readReal, sql.replace("stratum         text NOT NULL CHECK (stratum IN ('standard', 'sensitive', 'routine', 'hard'))", "stratum         text NOT NULL CHECK (stratum IN ('standard', 'sensitive', 'routine'))"));
  assert.ok(vocab.some((x) => x.includes('strata')), vocab.join('\n'));
  const fam = checkJudgeCalibrationParity(readReal, sql.replace('AND NOT same_family', ''));
  assert.ok(fam.some((x) => x.includes('same_family')), fam.join('\n'));
  const policy = checkJudgeCalibrationParity(readReal, `${sql}\nCREATE POLICY anyone ON public.mentor_judge_calibration FOR SELECT USING (true);`);
  assert.ok(policy.some((x) => x.includes('RLS')), policy.join('\n'));
});

test('RED when Oracle stops carrying the gold batch, the age band or the author model, or a live run loses its approval', () => {
  const src = checkJudgeCalibrationParity(patched(FILES.oracleJudge, "source: z.enum(['fixtures', 'gold_set'])", "source: z.enum(['fixtures'])"), sql);
  assert.ok(src.some((x) => x.includes('gold_set')), src.join('\n'));
  const author = checkJudgeCalibrationParity(patched(FILES.oracleJudge, 'authorModel: string | null', 'authorModel?: string'), sql);
  assert.ok(author.some((x) => x.includes('author model')), author.join('\n'));
  const live = checkJudgeCalibrationParity(patched(FILES.oracleContent, "CONTENT_JUDGE_CALIBRATION_LIVE !== 'approved'", "CONTENT_JUDGE_CALIBRATION_LIVE === 'never'"), sql);
  assert.ok(live.some((x) => x.includes('refuses a live run')), live.join('\n'));
});

test('RED when the live gate or the dashboard stops reading the registry', () => {
  const gate = checkJudgeCalibrationParity(patched(FILES.liveGate, "readCalibrationRows('live_content_judge'", "readCalibrationRows('transcript_judge'"), sql);
  assert.ok(gate.some((x) => x.includes('live gate')), gate.join('\n'));
  assert.deepEqual(checkJudgeCalibrationParity(readReal, null), ['the *_mentor_judge_calibration_registry.sql migration is missing']);
});
