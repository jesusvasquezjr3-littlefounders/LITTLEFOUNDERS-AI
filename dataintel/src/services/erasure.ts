import { withConnection, type DuckConnection } from '../db/duckdb.js';
import { ALL_TABLES, ERASURE_REAPPLY_JOB, ERASURE_TOMBSTONE_DAYS, logMaintenanceFailure, logMaintenanceRun } from './warehouseMaintenance.js';

/*
 * Product 10 E.6 — the warehouse step of an account erasure.
 *
 * Core erases the account in Vault first; this removes every row the
 * warehouse copied about it: first-party events by the account or by the
 * pre-signup visitor ids that converted into it, authoritative lesson
 * attempts, derived skill states, sessions, the user dimension, the
 * visitor-conversion links and the experiment assignments and exposures.
 * Aggregates (agg_daily_*) hold counts only and are left as they are.
 *
 * The deletions and the tombstones commit together on a connection of their
 * own. `applyErasureTombstones` repeats the deletion for every tombstone after
 * each sync, closing the one window a deletion alone cannot: a sync batch
 * read from Vault moments before the account was erased and written moments
 * after.
 *
 * GAP-FIX-R8 (H.4): every re-apply writes one `erasure_reapply` row to
 * warehouse_maintenance_log, in its own transaction when it succeeds and after
 * the rollback when it fails, and Core's `warehouse_retention` watched job
 * reads it (services/warehouseMaintenance.ts). A re-apply that fails or stops
 * running therefore fails ops-job-watch instead of letting an erased child's
 * rows come back unnoticed.
 */

/*
 * `textUser`: the experiment tables (services/experiments.ts) store the learner
 * id as TEXT, not UUID, so they are matched on the canonical lowercase text
 * form. They hold a learner's assignment and exposure, so an erasure removes
 * them too (H.2 / Appendix O 1.2 gap-fix round 6).
 */
const TABLES: { table: string; byUser: boolean; byAnon: boolean; textUser?: boolean }[] = [
  { table: 'fact_events_raw', byUser: true, byAnon: true },
  { table: 'fact_segment_attempts_raw', byUser: true, byAnon: false },
  { table: 'learner_skill_states', byUser: true, byAnon: false },
  { table: 'dim_sessions_raw', byUser: true, byAnon: false },
  { table: 'dim_users_raw', byUser: true, byAnon: false },
  { table: 'dim_anon_conversions', byUser: true, byAnon: true },
  { table: 'experiment_assignments', byUser: true, byAnon: false, textUser: true },
  { table: 'experiment_exposures', byUser: true, byAnon: false, textUser: true },
];

function where(byUser: boolean, byAnon: boolean, anonCount: number, textUser = false): string | null {
  const parts: string[] = [];
  if (byUser) parts.push(textUser ? 'lower(user_id) = lower(?)' : 'user_id = ?::UUID');
  if (byAnon && anonCount > 0) parts.push(`anon_id IN (${Array.from({ length: anonCount }, () => '?::UUID').join(', ')})`);
  return parts.length === 0 ? null : parts.join(' OR ');
}

async function deleteFor(connection: DuckConnection, userId: string, anonIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const { table, byUser, byAnon, textUser } of TABLES) {
    const clause = where(byUser, byAnon, anonIds.length, textUser);
    if (!clause) continue;
    const params = [...(byUser ? [userId] : []), ...(byAnon ? anonIds : [])];
    const rows = await connection.query<{ n: number | bigint }>(`SELECT count(*) AS n FROM ${table} WHERE ${clause}`, ...params);
    counts[table] = Number(rows[0]?.n ?? 0);
    await connection.execute(`DELETE FROM ${table} WHERE ${clause}`, ...params);
  }
  return counts;
}

export async function eraseSubject(userId: string, anonIds: string[]): Promise<Record<string, number>> {
  return withConnection(async (connection) => {
    await connection.exec('BEGIN TRANSACTION');
    try {
      const counts = await deleteFor(connection, userId, anonIds);
      await connection.execute(
        "INSERT INTO erased_subjects (subject_id, kind) VALUES (?::UUID, 'user') ON CONFLICT DO NOTHING",
        userId,
      );
      for (const anonId of anonIds) {
        await connection.execute(
          "INSERT INTO erased_subjects (subject_id, kind) VALUES (?::UUID, 'anon') ON CONFLICT DO NOTHING",
          anonId,
        );
      }
      await connection.exec('COMMIT');
      return counts;
    } catch (error) {
      await connection.exec('ROLLBACK').catch(() => undefined);
      throw error;
    }
  });
}

/** Re-applies every erasure (after a sync) and forgets tombstones older than 30 days. Returns rows removed. */
export async function applyErasureTombstones(now: Date = new Date()): Promise<number> {
  try {
    return await withConnection(async (connection) => {
      await connection.exec('BEGIN TRANSACTION');
      try {
        let removed = 0;
        for (const { table, byUser, byAnon, textUser } of TABLES) {
          const parts: string[] = [];
          if (byUser && textUser) parts.push("lower(user_id) IN (SELECT subject_id::VARCHAR FROM erased_subjects WHERE kind = 'user')");
          else if (byUser) parts.push("user_id IN (SELECT subject_id FROM erased_subjects WHERE kind = 'user')");
          if (byAnon) parts.push("anon_id IN (SELECT subject_id FROM erased_subjects WHERE kind = 'anon')");
          const clause = parts.join(' OR ');
          const rows = await connection.query<{ n: number | bigint }>(`SELECT count(*) AS n FROM ${table} WHERE ${clause}`);
          removed += Number(rows[0]?.n ?? 0);
          await connection.exec(`DELETE FROM ${table} WHERE ${clause}`);
        }
        await connection.exec(`DELETE FROM erased_subjects WHERE erased_at < CURRENT_TIMESTAMP - INTERVAL ${ERASURE_TOMBSTONE_DAYS} DAY`);
        await logMaintenanceRun(connection, { job: ERASURE_REAPPLY_JOB, table: ALL_TABLES, retainDays: ERASURE_TOMBSTONE_DAYS, removed, ranAt: now });
        await connection.exec('COMMIT');
        return removed;
      } catch (error) {
        await connection.exec('ROLLBACK').catch(() => undefined);
        throw error;
      }
    });
  } catch (error) {
    await logMaintenanceFailure(ERASURE_REAPPLY_JOB, ERASURE_TOMBSTONE_DAYS, error, now);
    throw error;
  }
}
