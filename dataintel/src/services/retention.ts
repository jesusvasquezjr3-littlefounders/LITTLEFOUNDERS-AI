import { query } from '../db/duckdb.js';
import { cohortRetentionQuery } from '../db/queries.js';

export interface CohortEntry {
  cohortWeek: string;
  weekOffset: number;
  users: number;
  cohortSize: number;
  retentionPct: number;
}

export interface RetentionCurve {
  cohortLabel: string;
  points: { week: number; retention: number }[];
}

interface CohortRetentionRow {
  cohort: string;
  cohort_size: number;
  week_number: number;
  retained_users: number;
  retention_pct: number;
}

export async function getCohortRetention(
  weeks: number,
): Promise<CohortEntry[] | null> {
  try {
    const { sql, params } = cohortRetentionQuery(weeks);
    const rows = await query<CohortRetentionRow>(sql, ...params);

    return rows.map((r) => ({
      cohortWeek: r.cohort,
      weekOffset: r.week_number,
      users: Number(r.retained_users),
      cohortSize: Number(r.cohort_size),
      retentionPct: Number(r.retention_pct),
    }));
  } catch (err) {
    console.error('[dataintel][retention] getCohortRetention failed:', err);
    return null;
  }
}

export async function getRetentionCurves(
  cohorts: string[],
): Promise<RetentionCurve[] | null> {
  try {
    const maxWeeks = 26;
    const { sql, params } = cohortRetentionQuery(maxWeeks);
    const rows = await query<CohortRetentionRow>(sql, ...params);

    return cohorts.map((cohortLabel) => {
      const cohortRows = rows.filter((r) => r.cohort === cohortLabel);

      const points = cohortRows.map((r) => ({
        week: r.week_number,
        retention: Number(r.retention_pct),
      }));

      return {
        cohortLabel,
        points,
      };
    });
  } catch (err) {
    console.error('[dataintel][retention] getRetentionCurves failed:', err);
    return null;
  }
}
