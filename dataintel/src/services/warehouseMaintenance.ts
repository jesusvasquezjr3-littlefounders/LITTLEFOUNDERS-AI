import { query, execute, type DuckConnection } from '../db/duckdb.js';

/*
 * H.4 and the Block H non-negotiables (GAP-FIX-R8): the warehouse's two
 * maintenance steps that keep a promise to families are watched, not only
 * logged.
 *
 *   warehouse_retention  services/warehouseRetention.ts: the 400-day window
 *                        over the raw event copy and the experiment rows (H.2,
 *                        Appendix O 1.2)
 *   erasure_reapply      services/erasure.ts applyErasureTombstones: an erased
 *                        account's rows never come back with a later sync (E.6)
 *
 * Both run after every sync (db/sync.ts). Every run writes to
 * warehouse_maintenance_log, a failed run included (ok = FALSE, the error
 * text, removed = 0): a successful run's rows commit in the same transaction
 * as its deletes, a failed run's row is written after the rollback.
 *
 * H.3 ("no job may be built to record without a real consumer"): the log's
 * consumer is GET /api/v1/intel/maintenance/status (internal key), which
 * Core's services/warehouseMaintenance.ts reads into the `warehouse_retention`
 * watched job of GET /internal/ops/job-status. ops-job-watch.yml fails and
 * opens the ops-watchdog issue when either step has no successful run inside
 * Core's window, or the warehouse cannot be read.
 *
 * Every `ran_at` is written explicitly in UTC (a DuckDB CURRENT_TIMESTAMP cast
 * to TIMESTAMP follows the host time zone), because Core ages it.
 */

export const RETENTION_JOB = 'warehouse_retention';
export const ERASURE_REAPPLY_JOB = 'erasure_reapply';
export const MAINTENANCE_STEPS = [RETENTION_JOB, ERASURE_REAPPLY_JOB] as const;
export type MaintenanceStep = (typeof MAINTENANCE_STEPS)[number];

/** services/erasure.ts forgets a tombstone after this many days; the window the re-apply logs. */
export const ERASURE_TOMBSTONE_DAYS = 30;

/** The table_name of a row that covers every table of a step (a failure, or the erasure re-apply). */
export const ALL_TABLES = 'all';

const ERROR_TEXT_LIMIT = 200;

/** A UTC TIMESTAMP literal DuckDB accepts. */
export function utcTimestamp(at: Date): string {
  return at.toISOString().replace('T', ' ').replace('Z', '');
}

/** One successful run's row, inside the caller's transaction. */
export async function logMaintenanceRun(
  connection: DuckConnection,
  row: { job: MaintenanceStep; table: string; retainDays: number; removed: number; ranAt: Date },
): Promise<void> {
  await connection.execute(
    'INSERT INTO warehouse_maintenance_log (job, table_name, retain_days, removed, ok, error, ran_at) VALUES (?, ?, ?, ?, TRUE, NULL, ?::TIMESTAMP)',
    row.job,
    row.table,
    row.retainDays,
    row.removed,
    utcTimestamp(row.ranAt),
  );
}

/**
 * One failed run's row, on the shared connection after the step's rollback.
 * Never throws: when even this write fails, the step's last success ages out
 * of Core's window and the watch fails on staleness instead.
 */
export async function logMaintenanceFailure(job: MaintenanceStep, retainDays: number, error: unknown, ranAt: Date): Promise<boolean> {
  const message = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').trim().slice(0, ERROR_TEXT_LIMIT) || 'unknown error';
  try {
    await execute(
      'INSERT INTO warehouse_maintenance_log (job, table_name, retain_days, removed, ok, error, ran_at) VALUES (?, ?, ?, 0, FALSE, ?, ?::TIMESTAMP)',
      job,
      ALL_TABLES,
      retainDays,
      message,
      utcTimestamp(ranAt),
    );
    return true;
  } catch (logError) {
    console.error(`[dataintel][maintenance] could not record the failed ${job} run:`, logError);
    return false;
  }
}

export interface MaintenanceStepStatus {
  step: MaintenanceStep;
  /** The last run that succeeded, and the rows it removed across tables. */
  lastSuccessAt: string | null;
  lastSuccessRemoved: number | null;
  /** The last run of any outcome. */
  lastAttemptAt: string | null;
  lastAttemptOk: boolean | null;
  lastError: string | null;
}

const iso = (value: Date | string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
};

/** The last successful and the last attempted run of one step. Throws when the log cannot be read. */
export async function getMaintenanceStep(step: MaintenanceStep): Promise<MaintenanceStepStatus> {
  const success = await query<{ ran_at: Date | string | null; removed: number | bigint | null }>(
    `SELECT max(ran_at) AS ran_at, sum(removed) AS removed FROM warehouse_maintenance_log
     WHERE job = ? AND ok IS NOT FALSE
       AND ran_at = (SELECT max(ran_at) FROM warehouse_maintenance_log WHERE job = ? AND ok IS NOT FALSE)`,
    step,
    step,
  );
  const attempt = await query<{ ran_at: Date | string | null; ok: boolean | null; error: string | null }>(
    `SELECT ran_at, ok, error FROM warehouse_maintenance_log WHERE job = ?
     ORDER BY ran_at DESC, ok ASC LIMIT 1`,
    step,
  );
  const lastSuccessAt = iso(success[0]?.ran_at);
  const last = attempt[0];
  return {
    step,
    lastSuccessAt,
    lastSuccessRemoved: lastSuccessAt === null ? null : Number(success[0]?.removed ?? 0),
    lastAttemptAt: iso(last?.ran_at),
    lastAttemptOk: last ? last.ok !== false : null,
    lastError: last && last.ok === false ? (last.error ?? null) : null,
  };
}

/** Every maintenance step, or null when the log could not be read (never "never ran"). */
export async function getMaintenanceStatus(): Promise<{ steps: MaintenanceStepStatus[] } | null> {
  try {
    const steps: MaintenanceStepStatus[] = [];
    for (const step of MAINTENANCE_STEPS) steps.push(await getMaintenanceStep(step));
    return { steps };
  } catch (err) {
    console.error('[dataintel][maintenance] status read failed:', err);
    return null;
  }
}
