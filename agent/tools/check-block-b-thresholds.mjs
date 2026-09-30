// check-block-b-thresholds.mjs — Appendix C's Threshold Recalibration Log for
// Block B as a gate, not a document.
//
// docs/operations/BLOCK-B-THRESHOLD-LOG.md lists every learning threshold
// (Copy Budget, redundancy, tone, concept cap, misjudgment, regional, the
// practice band, the judgment floor, the guided review, the engagement trend,
// the register boundaries) with its value. Each value is enforced in Forge or
// Core, and some also in a migration. A recalibration that edits one and
// forgets another would leave the product enforcing a threshold nobody
// reviewed. This gate reads the log and the real files and fails on any
// disagreement. It runs in the unfiltered repo gates, so a doc-only change is
// checked too; backend/src/__tests__/blockBThresholds.test.ts and
// coursegen/src/__tests__/blockBThresholds.test.ts check the same values
// against the live constants, including the counts marked `twin` here, which
// no text match can read.
//
// Appendix C Part 1.3 / Stage 6 (GAP-FIX-R6): the threshold review and the
// quarterly Age-Band Register Differentiation Audit (MN-03) have due dates
// (block-b-review-cadence.mjs). An overdue review warns here and fails with
// --strict, which release readiness passes.
//
// Appendix C 1.3 "Defect Escape Rate" / Stage 6 (gap-fix round 7): so does a
// gate-effectiveness review (opened by every defect escape) left open longer
// than `gate_effectiveness.review_max_open_days`. The open reviews are read
// from --gate-reviews=<file.json> or, with SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY set, from gate_effectiveness_reviews_open(); with
// neither, the check says it did not run. Under --strict a source that was
// named but could not be read fails.
//
// Snippets: `{v}` is the logged value; `{0}`, `{1}`, … are the parts of a
// comma-separated list value, in the order the log's Source column names.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBlockBCadence, checkGateEffectivenessReviews, DARK_PATTERN_RECORD, LOG, loadOpenGateReviews } from './block-b-review-cadence.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Every `| \`key\` | value |` row of the log. */
export function readLog(text) {
  return new Map([...text.matchAll(/^\| `([a-z0-9_.]+)` \| ([^|]+) \|/gm)].map((m) => [m[1], m[2].trim()]));
}

const BUDGETS = 'coursegen/src/contentGates/budgets.ts';
const REDUNDANCY = 'coursegen/src/contentGates/redundancy.ts';
const TONE = 'coursegen/src/contentGates/tone.ts';
const CAP = 'coursegen/src/contentGates/conceptCap.ts';
const MISJUDGMENT = 'coursegen/src/contentGates/misjudgment.ts';
const REGIONAL = 'coursegen/src/contentGates/regional.ts';
const QUALITY = 'backend/src/services/learningQuality.ts';
const REGISTER = 'backend/src/services/learnerRegisterPolicy.ts';
const ENGAGEMENT = 'backend/src/services/engagementHealth.ts';
const SESSION = 'backend/src/services/pedagogy/sessionPlan.ts';
const DARK = 'agent/tools/check-dark-patterns.mjs';
const PRACTICE_SQL = '_practice_difficulty_calibration';
const QA_SIGNALS = 'backend/src/services/learningQaSignals.ts';
const CADENCE = 'agent/tools/block-b-review-cadence.mjs';

/**
 * The rules: for each log key, the source files that must contain each
 * snippet, the migration that must, or `twin` (the named package's unit test
 * checks it against the live constant).
 */
export const RULES = [
  // Forge (S05.4a, S05.4b).
  { key: 'copy_budget.heading', src: [[BUDGETS, ['heading: { words: {0}, sentences: {1} },']]] },
  { key: 'copy_budget.prompt', src: [[BUDGETS, ['prompt: { words: {0}, youngWords: {1}, sentences: {2} },']]] },
  { key: 'copy_budget.option', src: [[BUDGETS, ['option: { words: {0}, youngWords: {1}, sentences: {2} },']]] },
  { key: 'copy_budget.mentor', src: [[BUDGETS, ['mentor: { words: {0}, youngWords: {1}, sentences: {2} },']]] },
  { key: 'copy_budget.body', src: [[BUDGETS, ['body: { words: {0}, sentences: {1} },']]] },
  { key: 'copy_budget.detail', src: [[BUDGETS, ['detail: { words: {0} },']]] },
  { key: 'copy_budget.es_pt_factor', src: [[BUDGETS, ["{ 'en-US': 1, 'es-MX': {v}, 'pt-BR': {v} }"]]] },
  { key: 'copy_budget.young_max_age', src: [[BUDGETS, ['export const YOUNG_AUDIENCE_MAX_AGE = {v};']]] },
  { key: 'redundancy.verbatim_run_words', src: [[REDUNDANCY, ['export const VERBATIM_RUN_WORDS = {v};']]] },
  { key: 'redundancy.threshold', src: [[REDUNDANCY, ['export const REDUNDANCY_THRESHOLD = {v};']]] },
  { key: 'redundancy.script_repeat_threshold', src: [[REDUNDANCY, ['export const SCRIPT_REPEAT_THRESHOLD = {v};']]] },
  { key: 'tone.negation_window_words', src: [[TONE, ['export const NEGATION_WINDOW_WORDS = {v};']]] },
  { key: 'tone.warning_cue_window_words', src: [[TONE, ['export const WARNING_CUE_WINDOW_WORDS = {v};']]] },
  { key: 'tone.lexicon_phrases', twin: 'coursegen' },
  { key: 'concept_cap.6_9', src: [[CAP, ["'6-9': { target: {0}, ceiling: {1} },"]]] },
  { key: 'concept_cap.10_12', src: [[CAP, ["'10-12': { target: {0}, ceiling: {1} },"]]] },
  { key: 'concept_cap.13_plus', src: [[CAP, ["'13+': { target: {0}, ceiling: {1} },"]]] },
  { key: 'concept_cap.band_max_ages', src: [[CAP, ["export const WORKING_MEMORY_BAND_MAX_AGE = { '6-9': {0}, '10-12': {1} } as const;"]]] },
  { key: 'misjudgment.min_episodes_per_course', src: [[MISJUDGMENT, ['export const MIN_MISJUDGMENT_EPISODES_PER_COURSE = {v};']]] },
  { key: 'misjudgment.min_voiced_moments', src: [[MISJUDGMENT, ['export const MIN_EPISODE_VOICED_MOMENTS = {v};']]] },
  { key: 'misjudgment.shame_lexicon_phrases', twin: 'coursegen' },
  { key: 'regional.scenario_copy_threshold', src: [[REGIONAL, ['export const SCENARIO_COPY_THRESHOLD = {v};']]] },
  { key: 'regional.market_anchors', twin: 'coursegen' },
  // Core (S05.3d, S05.3f).
  { key: 'practice_band.default', src: [[QUALITY, ['DEFAULT_PRACTICE_BAND = { lowerPct: {0}, upperPct: {1}, minSample: {2} } as const;']]],
    sql: [PRACTICE_SQL, ['SELECT NULL, {0}, {1}, {2},']] },
  { key: 'practice_band.guard_rails', src: [[QUALITY, ['PRACTICE_BAND_GUARD_RAILS = { lowestLower: {0}, highestUpper: {1}, minimumWidth: {2} } as const;']]],
    sql: [PRACTICE_SQL, ['lower_pct >= {0} AND upper_pct <= {1} AND upper_pct - lower_pct >= {2}']] },
  { key: 'practice_band.review_window_days', src: [[QUALITY, ['export const REVIEW_WINDOW_DAYS = {v};']]] },
  { key: 'practice_band.review_consecutive_windows', sql: [PRACTICE_SQL, ['practice_success_band_metrics(p_now - {v} * v_window, p_now - v_window)']] },
  { key: 'practice_band.review_cadence_days', src: [[QUALITY, ['export const BAND_REVIEW_CADENCE_DAYS = {v};']]] },
  { key: 'mentor.zpd_target', src: [[SESSION, ['export const ZPD_TARGET = {v};']]] },
  { key: 'judgment.divergence_floor', src: [[QUALITY, ['export const JUDGMENT_DIVERGENCE_FLOOR = {v};']]] },
  { key: 'judgment.min_attempts', src: [[QUALITY, ['export const JUDGMENT_MIN_ATTEMPTS = {v};']]] },
  { key: 'replay_notice.target', src: [[QUALITY, ['export const REPLAY_NOTICE_TARGET = {v};']]] },
  { key: 'guided_review.miss_threshold', src: [[REGISTER, ['export const GUIDED_REVIEW_MISS_THRESHOLD = {v};']]] },
  { key: 'guided_review.max_tracked', src: [[REGISTER, ['export const GUIDED_REVIEW_MAX_TRACKED = {v};']]] },
  { key: 'engagement.trend_window_weeks', src: [[ENGAGEMENT, ['export const TREND_WINDOW_WEEKS = {v};']]] },
  { key: 'engagement.trend_tolerance', src: [[ENGAGEMENT, ['export const TREND_TOLERANCE = {v};']]] },
  { key: 'engagement.trend_min_weekly_sample', src: [[ENGAGEMENT, ['export const TREND_MIN_WEEKLY_SAMPLE = {v};']]] },
  { key: 'engagement.history_weeks', src: [[ENGAGEMENT, ['export const ENGAGEMENT_HEALTH_WEEKS = {v};']]] },
  { key: 'register.transition_age', src: [[REGISTER, ["age < {v}) return 'young';", "{ from: 'young', to: 'transition', atAge: {v} }"]]] },
  { key: 'register.teen_age', src: [[REGISTER, ["if (age < {v}) return 'transition';", "{ from: 'transition', to: 'teen', atAge: {v} }"]]] },
  { key: 'register.adult_age', src: [[REGISTER, ["if (age < {v}) return 'teen';"]]] },
  { key: 'dark_pattern.release_audit_max_age_days', src: [[DARK, ['export const RELEASE_AUDIT_MAX_AGE_DAYS = {v};']]] },
  // Appendix C 1.3 / Stage 6 (gap-fix round 7): the staff panel's overdue flag and the release check.
  { key: 'gate_effectiveness.review_max_open_days', src: [[QA_SIGNALS, ['export const GATE_REVIEW_MAX_OPEN_DAYS = {v};']], [CADENCE, ['export const GATE_REVIEW_MAX_OPEN_DAYS = {v};']]] },
];

/** A snippet with `{v}` and `{0}`, `{1}`, … filled from the logged value. */
export function fill(snippet, value) {
  const parts = value.split(',').map((part) => part.trim());
  return snippet.replaceAll('{v}', value).replace(/\{(\d+)\}/g, (whole, i) => parts[Number(i)] ?? whole);
}

/** Pure check over in-memory inputs, so the gate can be tested against known-bad fixtures. */
export function checkThresholds({ log, readSource, readMigration, rules = RULES }) {
  const failures = [];
  const values = readLog(log);
  const known = new Set(rules.map((r) => r.key));
  for (const key of values.keys()) if (!known.has(key)) failures.push(`${key}: in the log but no rule checks it`);
  for (const rule of rules) {
    const value = values.get(rule.key);
    if (value === undefined) { failures.push(`${rule.key}: missing from ${LOG}`); continue; }
    for (const [file, snippets] of rule.src ?? []) {
      const source = readSource(file);
      if (source === null) { failures.push(`${rule.key}: ${file} is missing`); continue; }
      for (const snippet of snippets) {
        const expected = fill(snippet, value);
        if (!source.includes(expected)) failures.push(`${rule.key}: log says ${value}, ${file} does not contain "${expected}"`);
      }
    }
    if (rule.sql) {
      const [suffix, snippets] = rule.sql;
      const sql = readMigration(suffix);
      if (sql === null) { failures.push(`${rule.key}: no migration ending ${suffix}.sql`); continue; }
      for (const snippet of snippets) {
        const expected = fill(snippet, value);
        if (!sql.includes(expected)) failures.push(`${rule.key}: migration *${suffix}.sql does not contain "${expected}"`);
      }
    }
  }
  if (!/## Review history[\s\S]*\| \d{4}-\d{2}-\d{2} \|/.test(log)) failures.push(`${LOG}: the review history has no dated entry`);
  return failures;
}

export function liveInputs(root = ROOT) {
  const dir = join(root, 'database/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let record = null;
  try { record = JSON.parse(readFileSync(join(root, DARK_PATTERN_RECORD), 'utf8')); } catch { /* reported by the cadence check */ }
  return {
    log: readFileSync(join(root, LOG), 'utf8').replace(/\r\n/g, '\n'),
    record,
    readSource: (path) => { try { return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } },
    readMigration: (suffix) => {
      const name = files.find((f) => f.endsWith(`${suffix}.sql`));
      return name ? readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n') : null;
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const strict = process.argv.includes('--strict');
  const inputs = liveInputs();
  const failures = checkThresholds(inputs);
  const today = new Date().toISOString().slice(0, 10);
  const cadence = checkBlockBCadence({ markdown: inputs.log, record: inputs.record, today, strict });
  const source = await loadOpenGateReviews({ argv: process.argv, env: process.env, readFile: (path) => readFileSync(path, 'utf8') });
  const gateReviews = checkGateEffectivenessReviews({ reviews: source.reviews, unread: source.unread, today, strict });
  if (strict && source.failed) gateReviews.failures.push(`open gate-effectiveness reviews could not be read: ${source.unread}`);
  for (const warning of [...cadence.warnings, ...gateReviews.warnings]) console.warn(`WARN: ${warning}`);
  const all = [...failures, ...cadence.failures, ...gateReviews.failures];
  if (all.length > 0) {
    for (const failure of all) console.error(`FAIL: ${failure}`);
    process.exit(1);
  }
  const { thresholds, 'register-audit': register } = cadence.schedules;
  console.log(`block-b-thresholds OK — ${RULES.length} thresholds agree across the log, Forge, Core and the migrations; next human review due ${thresholds.due}, next register audit due ${register.due}${strict ? ' (not overdue)' : ''}; gate-effectiveness reviews: ${source.reviews ? `${source.reviews.length} open, none overdue (${source.source})` : 'not checked'}`);
}
