import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BAND_REVIEW_CADENCE_DAYS, DEFAULT_PRACTICE_BAND, JUDGMENT_DIVERGENCE_FLOOR, JUDGMENT_MIN_ATTEMPTS, PRACTICE_BAND_GUARD_RAILS,
  REPLAY_NOTICE_TARGET, REVIEW_WINDOW_DAYS,
} from '../services/learningQuality.js';
import {
  GRADUATIONS, GUIDED_REVIEW_MAX_TRACKED, GUIDED_REVIEW_MISS_THRESHOLD, offersGuidedReview, registerForAge,
} from '../services/learnerRegisterPolicy.js';
import { ENGAGEMENT_HEALTH_WEEKS, TREND_MIN_WEEKLY_SAMPLE, TREND_TOLERANCE, TREND_WINDOW_WEEKS } from '../services/engagementHealth.js';
import { ZPD_TARGET } from '../services/pedagogy/sessionPlan.js';
import { GATE_REVIEW_MAX_OPEN_DAYS } from '../services/learningQaSignals.js';

/*
 * GAP-FIX-R6 (Appendix C Part 1.3, Threshold Recalibration Log; B.19, B.12,
 * B.26, B.28, B.23): Block B's log is enforced, not only written. Every Core
 * value in docs/operations/BLOCK-B-THRESHOLD-LOG.md must equal the constant
 * Core uses and, where one exists, the number the migration enforces. A
 * recalibration that changes one without the others fails here. The Forge
 * values are checked by coursegen/src/__tests__/blockBThresholds.test.ts, and
 * agent/tools/check-block-b-thresholds.mjs checks both in the repo gates.
 */

const root = fileURLToPath(new URL('../../../', import.meta.url));
const log = readFileSync(join(root, 'docs/operations/BLOCK-B-THRESHOLD-LOG.md'), 'utf8').replace(/\r\n/g, '\n');
const migrations = readdirSync(join(root, 'database/migrations')).filter((f) => f.endsWith('.sql'));
const migration = (suffix: string) => {
  const name = migrations.find((f) => f.endsWith(`${suffix}.sql`));
  if (!name) throw new Error(`no migration ending ${suffix}`);
  return readFileSync(join(root, 'database/migrations', name), 'utf8');
};

const values = new Map([...log.matchAll(/^\| `([a-z0-9_.]+)` \| ([^|]+) \|/gm)].map((m) => [m[1]!, m[2]!.trim()]));
const num = (key: string) => {
  const raw = values.get(key);
  if (raw === undefined) throw new Error(`threshold ${key} is missing from the log`);
  return Number(raw);
};
const list = (key: string) => {
  const raw = values.get(key);
  if (raw === undefined) throw new Error(`threshold ${key} is missing from the log`);
  return raw.split(',').map((part) => Number(part.trim()));
};

const CORE_KEYS = [
  'dark_pattern.release_audit_max_age_days',
  'engagement.history_weeks',
  'engagement.trend_min_weekly_sample',
  'engagement.trend_tolerance',
  'engagement.trend_window_weeks',
  'gate_effectiveness.review_max_open_days',
  'guided_review.max_tracked',
  'guided_review.miss_threshold',
  'judgment.divergence_floor',
  'judgment.min_attempts',
  'mentor.zpd_target',
  'practice_band.default',
  'practice_band.guard_rails',
  'practice_band.review_cadence_days',
  'practice_band.review_consecutive_windows',
  'practice_band.review_window_days',
  'register.adult_age',
  'register.teen_age',
  'register.transition_age',
  'replay_notice.target',
];

describe('Block B threshold log, Core half (Appendix C Part 1.3)', () => {
  const practice = migration('_practice_difficulty_calibration');

  it('lists every Core threshold exactly once', () => {
    expect(CORE_KEYS.filter((key) => !values.has(key))).toEqual([]);
    const rows = [...log.matchAll(/^\| `([a-z0-9_.]+)` \|/gm)].map((m) => m[1]!);
    expect(rows.length).toBe(new Set(rows).size);
  });

  it('matches the B.19 practice band in Core and in the database', () => {
    const [lower, upper, sample] = list('practice_band.default');
    expect(DEFAULT_PRACTICE_BAND).toEqual({ lowerPct: lower, upperPct: upper, minSample: sample });
    expect(practice).toContain(`SELECT NULL, ${lower}, ${upper}, ${sample},`);
    const [lowest, highest, width] = list('practice_band.guard_rails');
    expect(PRACTICE_BAND_GUARD_RAILS).toEqual({ lowestLower: lowest, highestUpper: highest, minimumWidth: width });
    expect(practice).toContain(`lower_pct >= ${lowest} AND upper_pct <= ${highest} AND upper_pct - lower_pct >= ${width}`);
    expect(num('practice_band.review_window_days')).toBe(REVIEW_WINDOW_DAYS);
    expect(practice).toContain(`practice_success_band_metrics(p_now - ${num('practice_band.review_consecutive_windows')} * v_window, p_now - v_window)`);
    expect(num('practice_band.review_cadence_days')).toBe(BAND_REVIEW_CADENCE_DAYS);
    // The Mentor's target sits inside the band by construction.
    expect(num('mentor.zpd_target')).toBe(ZPD_TARGET);
    expect(ZPD_TARGET * 100).toBeGreaterThanOrEqual(lower!);
    expect(ZPD_TARGET * 100).toBeLessThanOrEqual(upper!);
  });

  it('matches the gate-effectiveness review cadence (Appendix C 1.3 Defect Escape Rate, Stage 6)', () => {
    expect(num('gate_effectiveness.review_max_open_days')).toBe(GATE_REVIEW_MAX_OPEN_DAYS);
    expect(GATE_REVIEW_MAX_OPEN_DAYS).toBe(num('practice_band.review_cadence_days'));
  });

  it('matches the B.12 judgment floor and the B.5 replay target', () => {
    expect(num('judgment.divergence_floor')).toBe(JUDGMENT_DIVERGENCE_FLOOR);
    expect(num('judgment.min_attempts')).toBe(JUDGMENT_MIN_ATTEMPTS);
    expect(num('replay_notice.target')).toBe(REPLAY_NOTICE_TARGET);
  });

  it('matches the B.26 guided review, and the offer fires where the log says', () => {
    const threshold = num('guided_review.miss_threshold');
    const max = num('guided_review.max_tracked');
    expect(threshold).toBe(GUIDED_REVIEW_MISS_THRESHOLD);
    expect(max).toBe(GUIDED_REVIEW_MAX_TRACKED);
    const fires = Array.from({ length: max + threshold }, (_, i) => i + 1).filter((misses) => offersGuidedReview(misses));
    expect(fires).toEqual(Array.from({ length: max / threshold }, (_, i) => threshold * (i + 1)));
  });

  it('matches the B.28 engagement trend', () => {
    expect(num('engagement.trend_window_weeks')).toBe(TREND_WINDOW_WEEKS);
    expect(num('engagement.trend_tolerance')).toBe(TREND_TOLERANCE);
    expect(num('engagement.trend_min_weekly_sample')).toBe(TREND_MIN_WEEKLY_SAMPLE);
    expect(num('engagement.history_weeks')).toBe(ENGAGEMENT_HEALTH_WEEKS);
    // The history holds the two windows the trend compares.
    expect(ENGAGEMENT_HEALTH_WEEKS).toBeGreaterThanOrEqual(TREND_WINDOW_WEEKS * 2);
  });

  it('matches the B.23 register boundaries, by behavior and in the graduations', () => {
    const transition = num('register.transition_age');
    const teen = num('register.teen_age');
    const adult = num('register.adult_age');
    expect([registerForAge(transition - 1), registerForAge(transition)]).toEqual(['young', 'transition']);
    expect([registerForAge(teen - 1), registerForAge(teen)]).toEqual(['transition', 'teen']);
    expect([registerForAge(adult - 1), registerForAge(adult)]).toEqual(['teen', 'adult']);
    expect(GRADUATIONS.map((g) => g.atAge)).toEqual([transition, teen]);
  });

  it('matches the B.25 release audit freshness', () => {
    const tool = readFileSync(join(root, 'agent/tools/check-dark-patterns.mjs'), 'utf8');
    expect(tool).toContain(`export const RELEASE_AUDIT_MAX_AGE_DAYS = ${num('dark_pattern.release_audit_max_age_days')};`);
  });

  it('states when the human review is due, and marks each history and register audit row engineering or human', () => {
    expect(log).toMatch(/First human review due: \d{4}-\d{2}-\d{2}/);
    for (const heading of ['## Review history', '## Register audit log']) {
      const start = log.indexOf(heading);
      expect(start, heading).toBeGreaterThan(0);
      const section = log.slice(start, log.indexOf('\n## ', start + 1));
      expect(section).toMatch(/^\| Date \| Kind \|/m);
      const rows = section.split('\n').filter((line) => /^\| \d{4}-\d{2}-\d{2} \|/.test(line));
      expect(rows.length, heading).toBeGreaterThan(0);
      for (const row of rows) expect(row).toMatch(/^\| \d{4}-\d{2}-\d{2} \| (engineering|human) \|/);
    }
  });
});
