import assert from 'node:assert/strict';
import test from 'node:test';

import { arrayConst, checkEvaluationLoopParity, FILES, readMigration, readRepo, rubricIds, tableVocab } from './check-evaluation-loop-parity.mjs';

const real = Object.fromEntries([...Object.values(FILES), 'backend/src/services/pedagogy/evaluationLoop.ts'].map((f) => [f, readRepo(f)]));
const readReal = (f) => real[f] ?? null;
const sql = readMigration();
const patched = (file, from, to) => (f) => {
  if (f !== file) return real[f] ?? null;
  assert.ok(real[f].includes(from), `fixture drifted: ${from} not in ${f}`);
  return real[f].replace(from, to);
};

test('the shipped repo agrees with itself across every copy', () => {
  assert.deepEqual(checkEvaluationLoopParity(readReal, sql), []);
});

test('the parsers actually read the real vocabularies (a vacuous pass is a failure)', () => {
  assert.equal(rubricIds(real[FILES.rubric]).length, 12);
  assert.equal(tableVocab(sql, 'tutor_transcript_score', 'criterion').length, 12);
  assert.deepEqual(tableVocab(sql, 'tutor_transcript_score', 'scorer'), ['rules']);
  assert.deepEqual(arrayConst(real[FILES.scoring], 'SCORE_OUTCOMES'), ['pass', 'fail', 'observed', 'not_applicable']);
  assert.deepEqual(arrayConst(real[FILES.client], 'OWNER_ROLES'), ['pedagogical_lead', 'safety_trust_lead', 'engineering_lead']);
  assert.equal(tableVocab(sql, 'mentor_quality_flag', 'kind').length, 7);
});

test('RED when a rubric criterion is added in code but not to the migration CHECK', () => {
  const problems = checkEvaluationLoopParity(patched(FILES.rubric, "id: 'scaffold_quality',", "id: 'scaffold_quality_v2',"), sql);
  assert.ok(problems.some((p) => p.includes('rubric criteria')), problems.join('\n'));
});

test('RED when the staff client drifts from Core on flag kinds or owner roles', () => {
  const kinds = checkEvaluationLoopParity(patched(FILES.client, "  'source_unavailable',\n] as const;", "  'source_unavailable',\n  'vibes',\n] as const;"), sql);
  assert.ok(kinds.some((p) => p.includes('flag kinds')), kinds.join('\n'));
  const roles = checkEvaluationLoopParity(patched(FILES.client, "'engineering_lead'] as const;", "'engineering_lead', 'ceo'] as const;"), sql);
  assert.ok(roles.some((p) => p.includes('owner roles')), roles.join('\n'));
});

test('RED when the Oracle judge outcomes drift from the score outcomes', () => {
  const problems = checkEvaluationLoopParity(patched(FILES.judge, "'observed', 'not_applicable'] as const;", "'observed', 'not_applicable', 'maybe'] as const;"), sql);
  assert.ok(problems.some((p) => p.includes('score outcomes')), problems.join('\n'));
});

test('RED (C.23 fence) when the schema starts admitting judge-written scores', () => {
  const problems = checkEvaluationLoopParity(readReal, sql.replace("scorer IN ('rules')", "scorer IN ('rules', 'judge')"));
  assert.ok(problems.some((p) => p.includes('C.23')), problems.join('\n'));
});

test('RED when an Appendix F service level is loosened', () => {
  const fresh = checkEvaluationLoopParity(patched(FILES.quality, 'freshnessHours: 24,', 'freshnessHours: 48,'), sql);
  assert.ok(fresh.some((p) => p.includes('freshnessHours')), fresh.join('\n'));
  const review = checkEvaluationLoopParity(patched(FILES.quality, 'reviewCadenceDays: 7,', 'reviewCadenceDays: 14,'), sql);
  assert.ok(review.some((p) => p.includes('reviewCadenceDays')), review.join('\n'));
});

test('RED when the workflow stops calling the route, or the migration is missing', () => {
  const wf = checkEvaluationLoopParity(patched(FILES.workflow, '/api/v1/tutor/internal/evaluation/run', '/api/v1/tutor/internal/evaluation/start'), sql);
  assert.ok(wf.some((p) => p.includes('does not call')), wf.join('\n'));
  assert.deepEqual(checkEvaluationLoopParity(readReal, null), ['the *_mentor_evaluation_loop_and_quality_dashboard.sql migration is missing']);
});
