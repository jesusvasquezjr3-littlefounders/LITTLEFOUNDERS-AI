import { describe, expect, it } from 'vitest';
import {
  activationFunnelQuery,
  andWindow,
  engagementQuery,
  lessonDropoffQuery,
  normalizeWindow,
  pathQuery,
  segmentCalibrationQuery,
  timeToValueQuery,
  windowLabel,
  windowSql,
  type AnalyticsWindow,
} from '../db/queries.js';

/*
 * The period selector used to reach four of seventeen requests. Ten queries had
 * no time bound at all — `engagementQuery` aggregated all of history while
 * returning fields named `sessions_30d` — so the console showed lifetime totals
 * under a "last 7 days" label. These tests hold the line: every query that a
 * period label is displayed next to must actually be bounded by it.
 */

const DAYS: AnalyticsWindow = { days: 30 };
const RANGE: AnalyticsWindow = { days: 30, from: '2026-06-01', to: '2026-06-30' };

describe('window predicate', () => {
  it('bounds a trailing window', () => {
    expect(windowSql('created_at', DAYS)).toBe("created_at >= CURRENT_DATE - INTERVAL '30' DAY");
  });

  it('includes the whole final day of an explicit range', () => {
    // A range ending today must not silently drop today's events, which a bare
    // `<= DATE 'to'` comparison against a TIMESTAMP would do.
    expect(windowSql('created_at', RANGE)).toBe(
      "created_at >= DATE '2026-06-01' AND created_at < DATE '2026-06-30' + INTERVAL 1 DAY",
    );
  });

  it('refuses anything that is not a calendar day', () => {
    for (const bad of ["2026-06-01'; DROP TABLE fact_events_raw --", '2026-6-1', 'yesterday', '']) {
      expect(() => windowSql('created_at', { days: 30, from: bad, to: '2026-06-30' })).toThrow();
    }
  });

  it('clamps an absurd day count instead of trusting it', () => {
    expect(normalizeWindow({ days: 0 }).days).toBe(1);
    expect(normalizeWindow({ days: 99_999 }).days).toBe(3650);
    expect(normalizeWindow({ days: 30.7 }).days).toBe(30);
  });

  it('labels a window the way an export footer needs to state it', () => {
    expect(windowLabel(DAYS)).toBe('last 30 days');
    expect(windowLabel(RANGE)).toBe('2026-06-01 to 2026-06-30');
  });

  it('prefixes AND for appending to an existing WHERE', () => {
    expect(andWindow('fe.created_at', DAYS)).toMatch(/^AND fe\.created_at >= /);
  });
});

describe('every period-labelled query carries the bound', () => {
  const cases: [string, string][] = [
    ['engagement', engagementQuery(10, DAYS).sql],
    ['time to value', timeToValueQuery(10, DAYS).sql],
    ['lesson dropoff', lessonDropoffQuery(10, DAYS).sql],
    ['segment calibration', segmentCalibrationQuery(2, 10, DAYS).sql],
    ['activation funnel', activationFunnelQuery(DAYS).sql],
    ['paths', pathQuery('lesson_start', 10, DAYS).sql],
  ];

  for (const [name, sql] of cases) {
    it(`${name} is bounded`, () => {
      expect(sql).toContain('INTERVAL');
      expect(sql).toMatch(/created_at|first_seen/);
    });

    it(`${name} honours an explicit range`, () => {
      const ranged = {
        engagement: () => engagementQuery(10, RANGE).sql,
        'time to value': () => timeToValueQuery(10, RANGE).sql,
        'lesson dropoff': () => lessonDropoffQuery(10, RANGE).sql,
        'segment calibration': () => segmentCalibrationQuery(2, 10, RANGE).sql,
        'activation funnel': () => activationFunnelQuery(RANGE).sql,
        paths: () => pathQuery('lesson_start', 10, RANGE).sql,
      }[name]!();
      expect(ranged).toContain("DATE '2026-06-01'");
      expect(ranged).toContain("DATE '2026-06-30'");
    });
  }

  it('no longer promises a 30-day figure it did not compute', () => {
    // The old engagement query was unbounded but its result fields were named
    // sessions_30d / active_days_30d. The window is now real, so the names may
    // not re-appear hard-coded in the SQL.
    expect(engagementQuery(10, DAYS).sql).not.toContain('30d');
  });
});
