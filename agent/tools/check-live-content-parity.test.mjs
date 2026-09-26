import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkLiveContentParity, FILES, lexiconBlock, migrationSignals, migrationVocab, numericField, readMigration } from './check-live-content-parity.mjs';
import { constArray } from './check-behavioral-telemetry-parity.mjs';

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
  assert.deepEqual(checkLiveContentParity(readReal, sql), []);
});

test('the parsers actually read the real vocabularies (a vacuous pass is a failure)', () => {
  assert.ok(lexiconBlock(real[FILES.coreRisk]).includes('financial_hardship'));
  assert.equal(constArray(real[FILES.coreRisk], 'CONTENT_RISK_SIGNALS').length, 6);
  assert.equal(migrationSignals(sql).length, 7);
  assert.deepEqual(migrationVocab(sql, 'outcome'), ['catalog', 'bank', 'needs_generation', 'live_suspended', 'live_served', 'live_refused']);
  assert.deepEqual(migrationVocab(sql, 'review_issue'), ['quality', 'safety']);
  assert.equal(numericField(real[FILES.coreGovernance], 'LIVE_CONTENT_THRESHOLDS', 'concordanceFloor'), 0.9);
});

test('RED when one side of the lexicon changes', () => {
  const problems = checkLiveContentParity(patched(FILES.oracleRisk, "'died|dies|death|funeral|passed away'", "'died|death|funeral'"), sql);
  assert.ok(problems.some((p) => p.includes('lexicon differs')), problems.join('\n'));
});

test('RED when a signal is added in code but not to the migration CHECK', () => {
  const problems = checkLiveContentParity(
    patched(FILES.coreRisk, "  'learner_classifier_match',\n] as const;", "  'learner_classifier_match',\n  'new_signal',\n] as const;"),
    sql,
  );
  assert.ok(problems.some((p) => p.includes('content-risk signals')), problems.join('\n'));
});

test('RED when a ladder outcome drifts from the migration', () => {
  const problems = checkLiveContentParity(patched(FILES.coreGovernance, "'live_refused'] as const;", "'live_refused', 'live_skipped'] as const;"), sql);
  assert.ok(problems.some((p) => p.includes('ladder outcomes')), problems.join('\n'));
});

test('RED (Tier 1 guard) when the standard floor is lowered in code', () => {
  const problems = checkLiveContentParity(patched(FILES.coreGovernance, '{ standard: 0.15, sensitive: 0.5 }', '{ standard: 0.1, sensitive: 0.5 }'), sql);
  assert.ok(problems.some((p) => p.includes('Tier 1')), problems.join('\n'));
});

test('RED (Tier 1 guard) when the sensitive floor is lowered in the migration', () => {
  const lowered = sql.replace("(risk_category = 'sensitive' AND sample_rate >= 0.50)", "(risk_category = 'sensitive' AND sample_rate >= 0.30)");
  assert.notEqual(lowered, sql);
  const problems = checkLiveContentParity(readReal, lowered);
  assert.ok(problems.some((p) => p.includes('sensitive floor')), problems.join('\n'));
});

test('RED when a configured baseline defaults below its floor, or the env example does', () => {
  const config = checkLiveContentParity(patched(FILES.coreConfig, 'TUTOR_LIVE_REVIEW_SENSITIVE_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.5)', 'TUTOR_LIVE_REVIEW_SENSITIVE_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.25)'), sql);
  assert.ok(config.some((p) => p.includes('below the sensitive floor')), config.join('\n'));
  const env = checkLiveContentParity(patched(FILES.coreEnv, 'TUTOR_LIVE_REVIEW_SAMPLE_RATE=0.15', 'TUTOR_LIVE_REVIEW_SAMPLE_RATE=0.05'), sql);
  assert.ok(env.some((p) => p.includes('below the standard floor')), env.join('\n'));
});

test('RED when the concordance floor is lowered (the calibration floors moved to judge-calibration:check)', () => {
  const problems = checkLiveContentParity(patched(FILES.coreGovernance, 'concordanceFloor: 0.9,', 'concordanceFloor: 0.8,'), sql);
  assert.ok(problems.some((p) => p.includes('concordanceFloor')), problems.join('\n'));
});

test('RED when Oracle stops parsing the suspension (it would pay for items Core refuses)', () => {
  const problems = checkLiveContentParity(patched(FILES.oracleClient, 'liveSuspended: z.literal(true)', 'liveSuspended: z.boolean()'), sql);
  assert.ok(problems.some((p) => p.includes('does not parse')), problems.join('\n'));
});

test('RED when the migration is missing', () => {
  assert.deepEqual(checkLiveContentParity(readReal, null), ['the *_live_content_governance_and_curated_packs.sql migration is missing']);
});
