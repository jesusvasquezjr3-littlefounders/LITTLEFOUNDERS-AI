import { withConnection, type DuckConnection } from '../db/duckdb.js';

/*
 * Product 10 E.6 — the warehouse step of an account erasure.
 *
 * Core erases the account in Vault first; this removes every row the
 * warehouse copied about it: first-party events by the account or by the
 * pre-signup visitor ids that converted into it, authoritative lesson
 * attempts, derived skill states, sessions, the user dimension and the
 * visitor-conversion links. Aggregates (agg_daily_*) hold counts only and
 * are left as they are.
 *
 * The deletions and the tombstones commit together on a connection of their
 * own. `applyErasureTombstones` repeats the deletion for every tombstone after
 * each sync, closing the one window a deletion alone cannot: a sync batch
 * read from Vault moments before the account was erased and written moments
 * after.
 */

const TABLES: { table: string; byUser: boolean; byAnon: boolean }[] = [
  { table: 'fact_events_raw', byUser: true, byAnon: true },
  { table: 'fact_segment_attempts_raw', byUser: true, byAnon: false },
  { table: 'learner_skill_states', byUser: true, byAnon: false },
  { table: 'dim_sessions_raw', byUser: true, byAnon: false },
  { table: 'dim_users_raw', byUser: true, byAnon: false },
  { table: 'dim_anon_conversions', byUser: true, byAnon: true },
];

function where(byUser: boolean, byAnon: boolean, anonCount: number): string | null {
  const parts: string[] = [];
  if (byUser) parts.push('user_id = ?::UUID');
  if (byAnon && anonCount > 0) parts.push(`anon_id IN (${Array.from({ length: anonCount }, () => '?::UUID').join(', ')})`);
  return parts.length === 0 ? null : parts.join(' OR ');
}

async function deleteFor(connection: DuckConnection, userId: string, anonIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const { table, byUser, byAnon } of TABLES) {
    const clause = where(byUser, byAnon, anonIds.length);
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
export async function applyErasureTombstones(): Promise<number> {
  return withConnection(async (connection) => {
    await connection.exec('BEGIN TRANSACTION');
    try {
      let removed = 0;
      for (const { table, byUser, byAnon } of TABLES) {
        const parts: string[] = [];
        if (byUser) parts.push("user_id IN (SELECT subject_id FROM erased_subjects WHERE kind = 'user')");
        if (byAnon) parts.push("anon_id IN (SELECT subject_id FROM erased_subjects WHERE kind = 'anon')");
        const clause = parts.join(' OR ');
        const rows = await connection.query<{ n: number | bigint }>(`SELECT count(*) AS n FROM ${table} WHERE ${clause}`);
        removed += Number(rows[0]?.n ?? 0);
        await connection.exec(`DELETE FROM ${table} WHERE ${clause}`);
      }
      await connection.exec("DELETE FROM erased_subjects WHERE erased_at < CURRENT_TIMESTAMP - INTERVAL 30 DAY");
      await connection.exec('COMMIT');
      return removed;
    } catch (error) {
      await connection.exec('ROLLBACK').catch(() => undefined);
      throw error;
    }
  });
}
