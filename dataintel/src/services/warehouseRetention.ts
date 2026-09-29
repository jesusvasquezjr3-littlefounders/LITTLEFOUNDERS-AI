import { query, withConnection } from '../db/duckdb.js';

/*
 * H.2 and Appendix O 1.2 (retention-window reconciliation): the warehouse's
 * own copy of raw usage events obeys the same written window as the raw store.
 *
 * docs/operations/GOVERNANCE.md section 3 keeps raw usage events for 400 days
 * in the operational store, and Vault enforces it with
 * `prune_learning_events(400)` (.github/workflows/insights-maintenance.yml).
 * The warehouse copies those events into `fact_events_raw` incrementally
 * (db/sync.ts, `event_id gt.<last>`), so without this step a pruned event
 * lived on in the warehouse forever: a third, unbounded window over the same
 * data. The experiment assignment and exposure rows are keyed by a learner and
 * sit under the same bound.
 *
 * ONE HOME FOR THE WINDOW: RAW_EVENT_RETENTION_DAYS below. ci-workflow.test.ts
 * pins the Vault prune call to this constant, so the two windows cannot drift.
 * The daily aggregates (agg_daily_*) hold counts only and are not pruned.
 *
 * Every run writes one warehouse_maintenance_log row per table (rows removed,
 * even when zero), so a prune that stopped running is visible.
 */

export const RAW_EVENT_RETENTION_DAYS = 400;

export const RETENTION_JOB = 'warehouse_retention';

/** The tables under the window and the timestamp each one is aged by. */
export const RETAINED_TABLES = [
  { table: 'fact_events_raw', column: 'created_at' },
  { table: 'experiment_assignments', column: 'assigned_at' },
  { table: 'experiment_exposures', column: 'exposed_at' },
] as const;

const DAY_MS = 86_400_000;

/** The oldest instant still inside the window, as a UTC TIMESTAMP literal DuckDB accepts. */
export function retentionCutoff(now: Date = new Date(), days: number = RAW_EVENT_RETENTION_DAYS): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Deletes every row older than the window from each retained table and logs
 * the run. Returns rows removed per table. The deletes and the log rows commit
 * together on a connection of their own.
 */
export async function applyWarehouseRetention(now: Date = new Date()): Promise<Record<string, number>> {
  const cutoff = retentionCutoff(now);
  return withConnection(async (connection) => {
    await connection.exec('BEGIN TRANSACTION');
    try {
      const removed: Record<string, number> = {};
      for (const { table, column } of RETAINED_TABLES) {
        const rows = await connection.query<{ n: number | bigint }>(
          `SELECT count(*) AS n FROM ${table} WHERE ${column} < ?::TIMESTAMP`,
          cutoff,
        );
        const n = Number(rows[0]?.n ?? 0);
        if (n > 0) await connection.execute(`DELETE FROM ${table} WHERE ${column} < ?::TIMESTAMP`, cutoff);
        await connection.execute(
          'INSERT INTO warehouse_maintenance_log (job, table_name, retain_days, removed) VALUES (?, ?, ?, ?)',
          RETENTION_JOB,
          table,
          RAW_EVENT_RETENTION_DAYS,
          n,
        );
        removed[table] = n;
      }
      await connection.exec('COMMIT');
      return removed;
    } catch (error) {
      await connection.exec('ROLLBACK').catch(() => undefined);
      throw error;
    }
  });
}

export interface RetentionRun {
  ranAt: string;
  removed: number;
}

/** The most recent retention run (rows removed across tables), or null when it has never run. */
export async function getLastRetentionRun(): Promise<RetentionRun | null> {
  const rows = await query<{ ran_at: Date | string | null; removed: number | bigint | null }>(
    `SELECT max(ran_at) AS ran_at, sum(removed) AS removed FROM warehouse_maintenance_log
     WHERE job = ? AND ran_at = (SELECT max(ran_at) FROM warehouse_maintenance_log WHERE job = ?)`,
    RETENTION_JOB,
    RETENTION_JOB,
  );
  const row = rows[0];
  if (!row?.ran_at) return null;
  const ranAt = row.ran_at instanceof Date ? row.ran_at.toISOString() : String(row.ran_at);
  return { ranAt, removed: Number(row.removed ?? 0) };
}
