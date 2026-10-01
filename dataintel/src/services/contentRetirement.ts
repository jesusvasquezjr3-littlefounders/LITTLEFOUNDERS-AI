import { createHash, randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { exec, execute, isReady, query, type DuckConnection, withConnection } from '../db/duckdb.js';
import { fetchFromVault, syncTable } from '../db/sync.js';
import { refreshLearnerSkillStates } from './learning.js';
import { isAlertWorkerIdle, pauseAlertWorker, resumeAlertWorker } from '../workers/alerts.js';
import { isSyncWorkerIdle, pauseSyncWorker, resumeSyncWorker } from '../workers/sync.js';

export const CONTENT_RESET_OPERATION = 'legacy-content-reset-2026-10-01';
const COURSE_DIGEST = '3bcfc7658ef34753f358d23d6d46f1611e1c09db6000301cf66125fbf6742d60';
const LESSON_DIGEST = 'ee0943e524b0cfa9eeb0ddac62256609f95d4f363b4d45735195602dd46593fa';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Phase = 'idle' | 'preparing' | 'backed_up' | 'purging' | 'facts_purged' | 'complete';
type Inventory = {
  lessons: number; lessonTotal: number;
  events: number; eventTotal: number; unrelatedEventDigest: string;
  attempts: number; attemptTotal: number;
  skillStates: number; skillStateTotal: number;
  sessionLessonStarts: number; userXp: number; userCompletions: number;
};
type Lease = {
  id: string;
  courseIds: string[];
  lessonIds: string[];
  startedAt: string;
  inventory: Inventory;
  backupSha256?: string;
};

let phase: Phase = 'idle';
let lease: Lease | null = null;
let inFlight = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const number = (value: unknown): number => Number(value ?? 0);

function release(): void {
  lease = null;
  phase = 'idle';
  resumeSyncWorker();
  resumeAlertWorker();
}

export function holdContentRetirementUntilInitialized(): void {
  phase = 'preparing';
  pauseSyncWorker();
  pauseAlertWorker();
}

export const contentRetirementGate: RequestHandler = (req, res, next) => {
  if (req.path.startsWith('/content-retirement/')) return next();
  if (phase !== 'idle') {
    res.status(503).json({ data: null, error: { code: 'CONTENT_RETIREMENT', message: 'Warehouse maintenance in progress' } });
    return;
  }
  inFlight++;
  let released = false;
  const done = () => {
    if (released) return;
    released = true;
    inFlight--;
  };
  // An aborted socket does not cancel an Express async handler. Keep its
  // admission counted until a response finishes; if it never does, fail the
  // maintenance drain rather than checkpoint over a possible late writer.
  // Restarting the process clears both the handler and this conservative hold.
  res.once('finish', done);
  next();
};

async function waitForQuiescence(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (inFlight > 0 || !isSyncWorkerIdle() || !isAlertWorkerIdle()) {
    if (Date.now() > deadline) throw new Error('active warehouse work did not drain in 30 seconds');
    await sleep(50);
  }
}

export function digestIds(ids: string[]): string {
  return createHash('sha256').update([...ids].sort().join('\n')).digest('hex');
}

async function vaultIds(table: 'courses' | 'lessons'): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await fetchFromVault<{ id: string }>(table, {
      select: 'id', order: 'id.asc', limit: '1000', offset: String(offset),
    });
    for (const row of rows) {
      if (typeof row.id !== 'string' || !UUID.test(row.id)) throw new Error(`invalid ${table} id from Vault`);
      ids.push(row.id.toLowerCase());
    }
    if (rows.length < 1000) break;
    if (offset > 10_000) throw new Error(`unexpected ${table} pagination size`);
  }
  if (new Set(ids).size !== ids.length) throw new Error(`duplicate ${table} id from Vault`);
  return ids;
}

async function insertIds(connection: DuckConnection, courses: string[], lessons: string[]): Promise<void> {
  await connection.exec('CREATE TEMP TABLE lf_retired_courses (id UUID)');
  await connection.exec('CREATE TEMP TABLE lf_retired_lessons (id UUID)');
  // UUID validation and the pinned digests happen before constructing this
  // fixed VALUES list. No SQL, table name or predicate comes from the caller.
  await connection.exec(`INSERT INTO lf_retired_courses VALUES ${courses.map((id) => `('${id}')`).join(',')}`);
  await connection.exec(`INSERT INTO lf_retired_lessons VALUES ${lessons.map((id) => `('${id}')`).join(',')}`);
}

const courseMatch = 'course_id IN (SELECT id FROM lf_retired_courses)';
const lessonMatch = 'lesson_id IN (SELECT id FROM lf_retired_lessons)';
const linked = `(${courseMatch} OR ${lessonMatch})`;

export async function inventoryRetiredContent(connection: DuckConnection): Promise<Inventory> {
  const rows = await connection.query<Record<string, unknown>>(`
    SELECT
      (SELECT count(*) FROM dim_lessons WHERE ${linked}) AS lessons,
      (SELECT count(*) FROM dim_lessons) AS lesson_total,
      (SELECT count(*) FROM fact_events_raw WHERE ${linked}) AS events,
      (SELECT count(*) FROM fact_events_raw) AS event_total,
      (SELECT coalesce(md5(string_agg(md5(cast(row(event_id, user_id, anon_id, session_id,
         lesson_id, course_id, event_type, created_at, value) AS VARCHAR)), ',' ORDER BY event_id)), md5(''))
       FROM fact_events_raw WHERE NOT coalesce(${linked}, false)) AS unrelated_event_digest,
      (SELECT count(*) FROM fact_segment_attempts_raw WHERE ${linked}) AS attempts,
      (SELECT count(*) FROM fact_segment_attempts_raw) AS attempt_total,
      (SELECT count(*) FROM learner_skill_states WHERE ${courseMatch}) AS skill_states,
      (SELECT count(*) FROM learner_skill_states) AS skill_state_total,
      (SELECT coalesce(sum(lessons_started),0) FROM dim_sessions_raw) AS session_lesson_starts,
      (SELECT coalesce(sum(xp_points),0) FROM dim_users_raw) AS user_xp,
      (SELECT coalesce(sum(lessons_completed),0) FROM dim_users_raw) AS user_completions
  `);
  const r = rows[0]!;
  return {
    lessons: number(r.lessons), lessonTotal: number(r.lesson_total),
    events: number(r.events), eventTotal: number(r.event_total),
    unrelatedEventDigest: String(r.unrelated_event_digest),
    attempts: number(r.attempts), attemptTotal: number(r.attempt_total),
    skillStates: number(r.skill_states), skillStateTotal: number(r.skill_state_total),
    sessionLessonStarts: number(r.session_lesson_starts),
    userXp: number(r.user_xp), userCompletions: number(r.user_completions),
  };
}

function requireLease(id: string): Lease {
  if (!lease || lease.id !== id || phase === 'idle' || phase === 'preparing') {
    throw new Error('content-retirement lease is missing or expired');
  }
  return lease;
}

export async function restoreContentRetirementLease(): Promise<void> {
  // Startup fails closed if the marker cannot be read or validated.
  holdContentRetirementUntilInitialized();
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM content_retirement_state WHERE operation = $1', CONTENT_RESET_OPERATION,
  );
  if (rows.length === 0) { release(); return; }
  if (rows.length !== 1) throw new Error('invalid content-retirement state count');
  const row = rows[0]!;
  const courseIds = JSON.parse(String(row.course_ids)) as string[];
  const lessonIds = JSON.parse(String(row.lesson_ids)) as string[];
  if (courseIds.length !== 3 || digestIds(courseIds) !== COURSE_DIGEST
      || lessonIds.length !== 2296 || digestIds(lessonIds) !== LESSON_DIGEST
      || typeof row.lease_id !== 'string'
      || !['backed_up', 'facts_purged', 'complete'].includes(String(row.phase))) {
    throw new Error('invalid persisted content-retirement scope or phase');
  }
  lease = {
    id: String(row.lease_id), courseIds, lessonIds,
    startedAt: String(row.started_at), inventory: JSON.parse(String(row.inventory)) as Inventory,
    backupSha256: row.backup_sha256 ? String(row.backup_sha256) : undefined,
  };
  phase = row.phase as Phase;
  pauseSyncWorker();
  pauseAlertWorker();
}

export async function beginContentRetirement(): Promise<{ leaseId: string; startedAt: string; inventory: Inventory }> {
  if (phase !== 'idle') throw new Error('content-retirement already active');
  if (!isReady()) throw new Error('warehouse is not ready');
  phase = 'preparing';
  pauseSyncWorker();
  pauseAlertWorker();
  let persisted = false;
  try {
    await waitForQuiescence();
    const [courseIds, lessonIds] = await Promise.all([vaultIds('courses'), vaultIds('lessons')]);
    if (courseIds.length !== 3 || digestIds(courseIds) !== COURSE_DIGEST
        || lessonIds.length !== 2296 || digestIds(lessonIds) !== LESSON_DIGEST) {
      throw new Error('Vault catalog no longer matches the pinned content-reset scope');
    }
    const counts = await withConnection(async (connection) => {
      await insertIds(connection, courseIds, lessonIds);
      return inventoryRetiredContent(connection);
    });
    if (counts.lessonTotal !== counts.lessons
        || counts.attemptTotal !== counts.attempts
        || counts.skillStateTotal !== counts.skillStates) {
      throw new Error('warehouse has content outside the pinned catalog');
    }
    lease = {
      id: randomUUID(), courseIds, lessonIds,
      startedAt: new Date().toISOString(), inventory: counts,
    };
    await execute(`INSERT INTO content_retirement_state
      (operation, lease_id, phase, course_ids, lesson_ids, inventory, started_at)
      VALUES ($1, $2, 'backed_up', $3, $4, $5, $6)`,
      CONTENT_RESET_OPERATION, lease.id, JSON.stringify(courseIds), JSON.stringify(lessonIds),
      JSON.stringify(counts), lease.startedAt);
    persisted = true;
    // All writers are paused. The marker survives a process restart; startup
    // restores the pause before any sync. An SSH read is safe after checkpoint.
    phase = 'backed_up';
    await exec('CHECKPOINT');
    return {
      leaseId: lease.id, startedAt: lease.startedAt, inventory: counts,
    };
  } catch (error) {
    if (!persisted) release();
    throw error;
  }
}

export function contentRetirementStatus(id: string): {
  phase: Phase; startedAt: string; inventory: Inventory; backupSha256?: string;
} {
  const current = requireLease(id);
  return {
    phase, startedAt: current.startedAt,
    inventory: current.inventory, backupSha256: current.backupSha256,
  };
}

async function deleteFacts(current: Lease): Promise<void> {
  await withConnection(async (connection) => {
    await insertIds(connection, current.courseIds, current.lessonIds);
    const before = await inventoryRetiredContent(connection);
    if (JSON.stringify(before) !== JSON.stringify(current.inventory)) {
      throw new Error('warehouse changed after its checkpoint backup');
    }
    await connection.exec('BEGIN TRANSACTION');
    try {
      await connection.exec(`CREATE TEMP TABLE lf_affected_days AS
        SELECT DISTINCT created_at::DATE AS day FROM fact_events_raw WHERE ${linked}`);
      await connection.exec(`DELETE FROM fact_events_raw WHERE ${linked}`);
      await connection.exec(`DELETE FROM fact_segment_attempts_raw WHERE ${linked}`);
      await connection.exec(`DELETE FROM dim_lessons WHERE ${linked}`);
      await connection.exec(`DELETE FROM learner_skill_states WHERE ${courseMatch}`);
      await connection.exec('DELETE FROM agg_daily_activity WHERE day IN (SELECT day FROM lf_affected_days)');
      await connection.exec('DELETE FROM agg_daily_users WHERE day IN (SELECT day FROM lf_affected_days)');
      await connection.exec(`
        INSERT INTO agg_daily_activity (day, role, event_type, route_class, device, locale, events, users, sessions, total_value)
        SELECT created_at::DATE, coalesce(role,'unknown'), event_type, coalesce(route_class,''),
               coalesce(device,''), coalesce(locale,''), count(*),
               count(DISTINCT coalesce(user_id::VARCHAR, anon_id::VARCHAR)),
               count(DISTINCT session_id), sum(coalesce(value,0))
        FROM fact_events WHERE created_at::DATE IN (SELECT day FROM lf_affected_days)
        GROUP BY 1,2,3,4,5,6
      `);
      await connection.exec(`
        INSERT INTO agg_daily_users (day, role, users, sessions)
        SELECT created_at::DATE, coalesce(role,'unknown'),
               count(DISTINCT coalesce(user_id::VARCHAR, anon_id::VARCHAR)),
               count(DISTINCT session_id)
        FROM fact_events WHERE created_at::DATE IN (SELECT day FROM lf_affected_days)
        GROUP BY 1,2
        UNION ALL
        SELECT created_at::DATE, '',
               count(DISTINCT coalesce(user_id::VARCHAR, anon_id::VARCHAR)),
               count(DISTINCT session_id)
        FROM fact_events WHERE created_at::DATE IN (SELECT day FROM lf_affected_days)
        GROUP BY 1
      `);
      const after = await inventoryRetiredContent(connection);
      if (after.events !== 0 || after.attempts !== 0 || after.lessons !== 0 || after.skillStates !== 0
          || after.eventTotal !== before.eventTotal - before.events
          || after.unrelatedEventDigest !== before.unrelatedEventDigest) {
        throw new Error('scoped warehouse fact deletion failed verification');
      }
      await connection.exec(`UPDATE content_retirement_state SET phase = 'facts_purged'
        WHERE operation = '${CONTENT_RESET_OPERATION}'`);
      await connection.exec('COMMIT');
    } catch (error) {
      await connection.exec('ROLLBACK').catch(() => {});
      throw error;
    }
  });
}

async function reconcileDimensions(): Promise<Inventory> {
  for (const table of ['users', 'lessons', 'sessions', 'attempts'] as const) {
    const result = await syncTable(table);
    if (table === 'lessons' && result.rows !== 0) throw new Error('Vault still supplies retired lessons');
    if (table === 'attempts' && result.rows !== 0) throw new Error('Vault still supplies retired attempts');
  }
  await refreshLearnerSkillStates();
  const current = lease!;
  const counts = await withConnection(async (connection) => {
    await insertIds(connection, current.courseIds, current.lessonIds);
    return inventoryRetiredContent(connection);
  });
  if (counts.lessons !== 0 || counts.events !== 0 || counts.attempts !== 0 || counts.skillStates !== 0
      || counts.userXp !== 0 || counts.userCompletions !== 0 || counts.sessionLessonStarts !== 0
      || counts.eventTotal !== current.inventory.eventTotal - current.inventory.events
      || counts.unrelatedEventDigest !== current.inventory.unrelatedEventDigest) {
    throw new Error('warehouse reconciliation left retired content or changed unrelated events');
  }
  await exec('CHECKPOINT');
  await execute(`UPDATE content_retirement_state SET phase = 'complete' WHERE operation = $1`, CONTENT_RESET_OPERATION);
  return counts;
}

export async function purgeRetiredContent(id: string, backupSha256: string): Promise<Inventory> {
  const current = requireLease(id);
  if (phase !== 'backed_up' && phase !== 'facts_purged') throw new Error('content-retirement is not ready to purge');
  if (!/^[0-9a-f]{64}$/i.test(backupSha256)) throw new Error('verified local backup SHA-256 is required');
  const entryPhase = phase;
  // Claim exclusivity before any await: otherwise two requests can both pass
  // the phase check and race through deletion and reconciliation.
  phase = 'purging';
  let factsCommitted = entryPhase === 'facts_purged';
  try {
    if ((await vaultIds('courses')).length !== 0 || (await vaultIds('lessons')).length !== 0) {
      throw new Error('Vault still contains lessons or courses');
    }
    current.backupSha256 = backupSha256.toLowerCase();
    await execute('UPDATE content_retirement_state SET backup_sha256 = $1 WHERE operation = $2',
      current.backupSha256, CONTENT_RESET_OPERATION);
    if (!factsCommitted) {
      await deleteFacts(current);
      factsCommitted = true;
    }
    const counts = await reconcileDimensions();
    phase = 'complete';
    return counts;
  } catch (error) {
    phase = factsCommitted ? 'facts_purged' : entryPhase;
    throw error;
  }
}

export async function finishContentRetirement(id: string): Promise<void> {
  requireLease(id);
  if (phase !== 'complete') throw new Error('warehouse purge has not completed');
  phase = 'purging';
  try {
    await execute('DELETE FROM content_retirement_state WHERE operation = $1', CONTENT_RESET_OPERATION);
    release();
  } catch (error) {
    phase = 'complete';
    throw error;
  }
}

// Tests can clear a lease without waiting for its timer. Never called by routes.
export function resetContentRetirementForTest(): void { release(); }
