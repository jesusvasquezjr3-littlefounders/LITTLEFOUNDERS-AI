import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkReviewCalibrationParity, FILES, migrationVocab, numericObject, readMigration, unionType } from './check-review-calibration-parity.mjs';
import { constArray, interfaceFields } from './check-behavioral-telemetry-parity.mjs';
import { zodFields } from './check-session-end-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const real = Object.fromEntries(Object.values(FILES).map((f) => [f, readFileSync(path.join(ROOT, f), 'utf8')]));
const readReal = (f) => real[f];
const sql = readMigration();
const patched = (file, from, to) => (f) => {
  if (f !== file) return real[f];
  assert.ok(real[f].includes(from), `fixture drifted: ${from} not in ${f}`);
  return real[f].replace(from, to);
};

test('the shipped repo agrees with itself across every copy', () => {
  assert.deepEqual(checkReviewCalibrationParity(readReal, sql), []);
});

test('the parsers actually read the real vocabularies (a vacuous pass is a failure)', () => {
  assert.deepEqual(constArray(real[FILES.review], 'REVIEW_TIERS'), ['within_session', 'cross_session']);
  assert.equal(constArray(real[FILES.review], 'ROUTING_REASONS').length, 8);
  const rule = numericObject(real[FILES.review], 'SPACED_REVIEW_THRESHOLDS');
  assert.equal(rule.minMsUntilWrap, 240_000);
  assert.equal(rule.nearThresholdFloor, 0.5);
  assert.ok(zodFields(real[FILES.coreReview], 'export const RoutingDecisionBody').includes('msUntilWrap'));
  assert.ok(interfaceFields(real[FILES.review], 'SpacedReviewReport').includes('decisions'));
  assert.deepEqual(constArray(real[FILES.dialogue], 'DIALOGUE_BANDS'), ['young_child', 'tween', 'teen', 'adult']);
  assert.ok(zodFields(real[FILES.coreDialogue], 'export const DialogueCalibrationReportBody').includes('unilateralStyleChanges'));
  assert.deepEqual(unionType(real[FILES.coreFsrs], 'ReviewTier'), ['spaced', 'short_horizon']);
  assert.deepEqual(migrationVocab(sql, 'review_tier'), ['spaced', 'short_horizon']);
});

test('RED when Core re-evaluates a different rule than Oracle runs', () => {
  const problems = checkReviewCalibrationParity(patched(FILES.coreReview, 'nearThresholdFloor: 0.5,', 'nearThresholdFloor: 0.4,'), sql);
  assert.ok(problems.some((p) => p.includes('the rule thresholds')));
});

test('RED when the controller abandons a re-check on a different turn count than the router', () => {
  const problems = checkReviewCalibrationParity(patched(FILES.controller, 'export const REVIEW_OPEN_TURNS = 3;', 'export const REVIEW_OPEN_TURNS = 4;'), sql);
  assert.ok(problems.some((p) => p.includes('REVIEW_OPEN_TURNS')));
});

test('RED when the migration CHECK lacks a routing reason Oracle records', () => {
  const problems = checkReviewCalibrationParity(readReal, sql.replace("'reexposure_cap', 'far_from_threshold', 'queue_full', 'near_threshold'", "'reexposure_cap', 'far_from_threshold', 'near_threshold'"));
  assert.ok(problems.some((p) => p.includes('routing reasons')));
});

test('RED when Core lacks a field of the routing decision Oracle sends', () => {
  const problems = checkReviewCalibrationParity(patched(FILES.coreReview, '    queuedBefore: z.number().int().min(0).max(50),\n', ''), sql);
  assert.ok(problems.some((p) => p.includes('routing decision')));
});

test('RED when Core lacks a dialogue assignment Oracle reports', () => {
  const problems = checkReviewCalibrationParity(patched(FILES.coreDialogue, "  'tier_fallback',\n  'operator_off',\n] as const;", "  'tier_fallback',\n] as const;"), sql);
  assert.ok(problems.some((p) => p.includes('dialogue assignments')));
});

test('RED when the report Oracle sends carries a field Core refuses', () => {
  const problems = checkReviewCalibrationParity(patched(FILES.dialogue, '  unilateralStyleChanges: number;\n}', '  unilateralStyleChanges: number;\n  learnerAge: number;\n}'), sql);
  assert.ok(problems.some((p) => p.includes('dialogue calibration report')));
});

// OD-26 (owner review M-12): C.17 may enrol adults, teens (own opt-in) and
// tweens 10-12 (guardian consent); a young child never.
test('the real default opens C.17 to adults, teens and tweens only', () => {
  assert.deepEqual(checkReviewCalibrationParity(readReal, sql), []);
});

test('RED (OD-26) when the default, the config schema or the resolver would enrol a young child', () => {
  const cases = [
    [FILES.coreConfig, ".default('adult,teen,tween')", ".default('adult,teen,tween,young_child')", 'would enrol young_child by default'],
    [FILES.coreConfig, "['tween', 'teen', 'adult'].includes(band)", "['young_child', 'tween', 'teen', 'adult'].includes(band)", 'must not accept young_child'],
    [FILES.coreDialogue, "DIALOGUE_EXPERIMENT_OPENABLE_BANDS: readonly DialogueBand[] = ['adult', 'teen', 'tween'];", "DIALOGUE_EXPERIMENT_OPENABLE_BANDS: readonly DialogueBand[] = ['adult', 'teen', 'tween', 'young_child'];", 'must be exactly adult, teen, tween'],
    [FILES.coreDialogue, ' || !DIALOGUE_EXPERIMENT_OPENABLE_BANDS.includes(input.band)', '', 'must refuse every band outside'],
  ];
  for (const [file, from, to, message] of cases) {
    const problems = checkReviewCalibrationParity(patched(file, from, to), sql);
    assert.ok(problems.some((p) => p.includes(message)), `${message}: ${problems.join(' | ')}`);
  }
});

test('RED (OD-26) when a tween could be enrolled on a guess or without the guardian', () => {
  for (const [from, to, message] of [
    ["input.band === 'tween' && (input.age === null || input.age < 10 || input.age > 12)", "input.band === 'tween' && input.age !== null && input.age > 12", 'exact age of 10 to 12'],
    ["case 'tween':\n      return guardianConsent();", "case 'tween':\n      return allowsSelfManagedAnalytics(input.userId, input.screening);", "verified guardian's analytics consent"],
  ]) {
    const problems = checkReviewCalibrationParity(patched(FILES.coreDialogue, from, to), sql);
    assert.ok(problems.some((p) => p.includes(message)), `${message}: ${problems.join(' | ')}`);
  }
});

test('RED when no migration exists at all', () => {
  assert.deepEqual(checkReviewCalibrationParity(readReal, null), ['database/migrations: no *_mentor_spaced_review_and_dialogue_calibration.sql migration found']);
});
