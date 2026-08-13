import { query } from '../db/duckdb.js';

/*
 * The ONE place allowed to read the physical `*_raw` tables (see
 * staff-exclusion.test.ts, which fails the build if any other service does).
 *
 * Two jobs, both about trust rather than analysis:
 *
 *  1. DISCLOSURE. Every other number in the console is staff-free, and an
 *     operator has no way to tell a filter that is working from a filter that
 *     silently stopped. Reporting how much was removed makes the exclusion
 *     visible and falsifiable. Measured on production 2026-08-13 this was 90.5%
 *     of all events — a share large enough that seeing it change is itself a
 *     signal worth watching.
 *
 *  2. DIAGNOSIS. "Did the QA pass actually run?" is a legitimate question that
 *     staff-free metrics can no longer answer. This keeps it answerable without
 *     letting the answer leak back into the product metrics.
 */

export interface StaffExclusionReport {
  windowDays: number;
  /** Events kept in every metric. */
  includedEvents: number;
  /** Events hidden by the staff filter. */
  excludedEvents: number;
  /** Excluded / total, 0-1. Null when there is nothing in the window at all. */
  excludedShare: number | null;
  /** Staff accounts known to the warehouse. */
  staffUsers: number;
  /** Segment attempts hidden — the pedagogical evidence base. */
  excludedAttempts: number;
  includedAttempts: number;
  /** Most recent staff activity, so "is anyone testing right now?" is answerable. */
  lastStaffEventAt: string | null;
}

interface CountRow {
  n: number | bigint;
}
const num = (rows: CountRow[]): number => Number(rows[0]?.n ?? 0);

/**
 * Null on any failure — the caller answers 502 rather than rendering a
 * confident "0% excluded", which would be indistinguishable from a filter that
 * has stopped working (§1.14).
 */
export async function getStaffExclusionReport(windowDays: number): Promise<StaffExclusionReport | null> {
  try {
    const since = `CURRENT_DATE - INTERVAL ${Math.trunc(windowDays)} DAY`;

    const [included, total, staff, attemptsTotal, attemptsIncluded, last] = await Promise.all([
      query<CountRow>(`SELECT COUNT(*) AS n FROM fact_events WHERE created_at >= ${since}`),
      query<CountRow>(`SELECT COUNT(*) AS n FROM fact_events_raw WHERE created_at >= ${since}`),
      query<CountRow>('SELECT COUNT(*) AS n FROM v_staff_users'),
      query<CountRow>(`SELECT COUNT(*) AS n FROM fact_segment_attempts_raw WHERE created_at >= ${since}`),
      query<CountRow>(`SELECT COUNT(*) AS n FROM fact_segment_attempts WHERE created_at >= ${since}`),
      query<{ last_at: string | null }>(
        `SELECT MAX(created_at) AS last_at FROM fact_events_raw
         WHERE user_id IN (SELECT user_id FROM v_staff_users) OR COALESCE(role, '') IN ('admin', 'superadmin')`,
      ),
    ]);

    const includedEvents = num(included);
    const totalEvents = num(total);
    const excludedEvents = Math.max(totalEvents - includedEvents, 0);
    const includedAttempts = num(attemptsIncluded);
    const totalAttempts = num(attemptsTotal);

    return {
      windowDays,
      includedEvents,
      excludedEvents,
      excludedShare: totalEvents > 0 ? excludedEvents / totalEvents : null,
      staffUsers: num(staff),
      includedAttempts,
      excludedAttempts: Math.max(totalAttempts - includedAttempts, 0),
      lastStaffEventAt: last[0]?.last_at ? String(last[0].last_at) : null,
    };
  } catch {
    return null;
  }
}
