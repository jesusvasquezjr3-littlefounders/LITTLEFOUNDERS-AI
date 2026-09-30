import { query, execute, exec, isReady, withConnection } from './duckdb.js';
import { getConfig } from '../env.js';
import { applyErasureTombstones } from '../services/erasure.js';
import { applyWarehouseRetention } from '../services/warehouseRetention.js';

type TableName = 'learning_events' | 'users' | 'lessons' | 'sessions' | 'attempts' | 'anon_conversions';

interface SyncState {
  table_name: string;
  last_event_id: number;
  last_synced_at: string;
  rows_synced: number;
  last_error: string | null;
}

// ── Sync state management ──

async function ensureSyncStateTable(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS dataintel_sync_state (
      table_name VARCHAR PRIMARY KEY,
      last_event_id BIGINT NOT NULL DEFAULT 0,
      last_synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      rows_synced BIGINT NOT NULL DEFAULT 0,
      last_error VARCHAR
    )
  `);
}

async function getSyncState(tableName: string): Promise<SyncState | null> {
  const rows = await query<SyncState>(
    'SELECT * FROM dataintel_sync_state WHERE table_name = $1',
    tableName,
  );
  return rows[0] ?? null;
}

async function upsertSyncState(
  tableName: string,
  lastEventId: number,
  rowsSynced: number,
): Promise<void> {
  const existing = await getSyncState(tableName);
  if (existing) {
    await execute(
      `UPDATE dataintel_sync_state
       SET last_event_id = $1,
           last_synced_at = CURRENT_TIMESTAMP,
           rows_synced = rows_synced + $2
       WHERE table_name = $3`,
      lastEventId,
      rowsSynced,
      tableName,
    );
  } else {
    await execute(
      `INSERT INTO dataintel_sync_state (table_name, last_event_id, last_synced_at, rows_synced)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
      tableName,
      lastEventId,
      rowsSynced,
    );
  }
}

async function setSyncError(tableName: string, error: string): Promise<void> {
  const existing = await getSyncState(tableName);
  if (existing) {
    await execute(
      'UPDATE dataintel_sync_state SET last_error = $1, last_synced_at = CURRENT_TIMESTAMP WHERE table_name = $2',
      error,
      tableName,
    );
  } else {
    await execute(
      'INSERT INTO dataintel_sync_state (table_name, last_synced_at, last_error) VALUES ($1, CURRENT_TIMESTAMP, $2)',
      tableName,
      error,
    );
  }
}

export interface SyncHealth {
  last_sync_at: string | null;
  sync_error: string | null;
}

/**
 * Read-only summary of the most recently touched sync target, for /health.
 * `last_synced_at` is written on both success (upsertSyncState) and failure
 * (setSyncError), so "most recent" means most recent ACTIVITY, not most
 * recent success — the point is to show whether sync is currently erroring,
 * not to hide it behind a stale success timestamp from before it broke.
 *
 * Never throws (AGENTS.md §1.14 — /health must not depend on optional
 * infrastructure): skips the query entirely while duckdb isn't ready, and
 * swallows any query failure (e.g. the table not existing yet) into the same
 * "nothing has synced" null/null shape a fresh warehouse would report.
 */
export async function getSyncHealth(): Promise<SyncHealth> {
  if (!isReady()) return { last_sync_at: null, sync_error: null };
  try {
    // The duckdb driver returns TIMESTAMP columns as native JS Date objects,
    // not strings — normalize to ISO here rather than leaning on res.json()'s
    // implicit Date.toJSON() serialization, so this function's own return
    // type (and anything that consumes it outside an HTTP response) is honest.
    const rows = await query<{ last_synced_at: Date; last_error: string | null }>(
      'SELECT last_synced_at, last_error FROM dataintel_sync_state ORDER BY last_synced_at DESC LIMIT 1',
    );
    const latest = rows[0];
    if (!latest) return { last_sync_at: null, sync_error: null };
    return { last_sync_at: latest.last_synced_at.toISOString(), sync_error: latest.last_error ?? null };
  } catch {
    return { last_sync_at: null, sync_error: null };
  }
}

// ── Vault API ──

async function fetchFromVault<T = Record<string, unknown>>(
  path: string,
  params?: Record<string, string>,
): Promise<T[]> {
  const config = getConfig();
  const url = new URL(`${config.SUPABASE_URL}/rest/v1/${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      'apikey': config.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
  }).catch((err) => {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error(`Vault request timed out after 30s: ${path}`);
    }
    throw err;
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'unable to read response body');
    throw new Error(`Vault ${res.status}: ${text}`);
  }
  const data = (await res.json()) as T[];
  return data;
}

// ── Mappers ──

function mapEventRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    event_id: row.event_id ?? row.id,
    client_event_id: row.client_event_id ?? null,
    event_version: row.event_version ?? 1,
    occurred_at: row.occurred_at ?? row.created_at ?? new Date().toISOString(),
    user_id: row.user_id ?? null,
    anon_id: row.anon_id ?? null,
    session_id: row.session_id ?? null,
    lesson_id: row.lesson_id ?? null,
    course_id: row.course_id ?? null,
    segment_id: row.segment_id ?? null,
    experiment_id: row.experiment_id ?? null,
    experiment_variant: row.experiment_variant ?? null,
    event_type: (row.event_type ?? row.event ?? ''),
    role: row.role ?? null,
    route_class: row.route_class ?? null,
    device: row.device ?? null,
    locale: row.locale ?? null,
    referrer_class: row.referrer_class ?? null,
    ordinal: row.ordinal ?? null,
    value: row.value ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    ingested_at: row.ingested_at ?? null,
  };
}

function mapUserRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    user_id: row.user_id ?? row.id,
    role: row.role ?? null,
    /*
     * Authoritative staff marker (Vault 0046). Defaults to TRUE when the
     * source does not supply it: an unknown user is treated as staff and
     * therefore EXCLUDED from the metrics. That is the safe direction — a
     * missing flag silently readmitting staff is how the console came to
     * report 90% of its events from two accounts.
     */
    is_staff: row.is_staff === undefined || row.is_staff === null ? true : Boolean(row.is_staff),
    created_at: row.created_at ?? null,
    locale: row.locale ?? null,
    xp_points: row.xp_points ?? 0,
    lessons_completed: row.lessons_completed ?? 0,
    streak_days: row.streak_days ?? 0,
    longest_streak: row.longest_streak ?? 0,
  };
}

function mapLessonRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    lesson_id: row.lesson_id ?? row.id,
    slug: row.slug ?? null,
    title_en: row.title_en ?? null,
    title_es: row.title_es ?? null,
    title_pt: row.title_pt ?? null,
    course_id: row.course_id ?? null,
    course_slug: row.course_slug ?? null,
    course_title_en: row.course_title_en ?? null,
    course_title_es: row.course_title_es ?? null,
    course_title_pt: row.course_title_pt ?? null,
    segment_count: row.segment_count ?? 0,
  };
}

function mapSessionRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    session_id: row.session_id ?? row.id,
    user_id: row.user_id ?? null,
    started_at: row.started_at ?? null,
    ended_at: row.ended_at ?? null,
    device: row.device ?? null,
    locale: row.locale ?? null,
    referrer_class: row.referrer_class ?? null,
    events_count: row.events_count ?? 0,
    surfaces: row.surfaces ?? 0,
    lessons_started: row.lessons_started ?? 0,
    duration_sec: row.duration_sec ?? null,
  };
}

function mapAttemptRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    attempt_id: row.attempt_id ?? row.id,
    user_id: row.user_id ?? null,
    lesson_id: row.lesson_id ?? null,
    course_id: row.course_id ?? null,
    topic_id: row.topic_id ?? null,
    skill_key: row.skill_key ?? null,
    segment_id: row.segment_id ?? null,
    attempt_number: row.attempt_number ?? 0,
    score: row.score ?? 0,
    hints_used: row.hints_used ?? 0,
    time_spent_seconds: row.time_spent_seconds ?? null,
    document_updated_at: row.document_updated_at ?? null,
    diagnostic_code: row.diagnostic_code ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function mapAnonConversionRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    anon_id: row.anon_id,
    user_id: row.user_id,
    converted_at: row.converted_at,
  };
}

// ── Batch insert ──

/**
 * `run` defaults to the shared-connection `execute`, but every caller inside a
 * transaction passes that transaction's own connection instead. Inserting
 * through the shared handle while the BEGIN lives on a private one would write
 * the rows outside the transaction — committed even on a ROLLBACK.
 */
async function batchInsert(
  table: string,
  columns: readonly string[],
  rows: Record<string, unknown>[],
  run: (sql: string, ...params: unknown[]) => Promise<void> = execute,
): Promise<void> {
  if (rows.length === 0) return;

  const colList = columns.join(', ');

  for (const row of rows) {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const values = columns.map((col) => {
      const v = row[col];
      return v === undefined ? null : v;
    });

    await run(
      `INSERT OR IGNORE INTO ${table} (${colList}) VALUES (${placeholders})`,
      ...values,
    );
  }
}

// ── Time dimension ──

export async function generateTimeDimension(
  startDate: string,
  endDate: string,
): Promise<number> {
  const existing = await query<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM dim_time WHERE date BETWEEN $1::DATE AND $2::DATE',
    startDate,
    endDate,
  );
  if ((existing[0]?.cnt ?? 0) > 0) return 0;

  await exec(`
    INSERT INTO dim_time (date, year, month, week, day_of_week, hour, is_weekend)
    SELECT
      d::DATE AS date,
      EXTRACT(YEAR FROM d)::INTEGER AS year,
      EXTRACT(MONTH FROM d)::INTEGER AS month,
      EXTRACT(WEEK FROM d)::INTEGER AS week,
      EXTRACT(ISODOW FROM d)::INTEGER AS day_of_week,
      0 AS hour,
      EXTRACT(ISODOW FROM d) IN (6, 7) AS is_weekend
    FROM GENERATE_SERIES(
      '${startDate}'::DATE,
      '${endDate}'::DATE,
      INTERVAL 1 DAY
    ) AS t(d)
    ON CONFLICT (date) DO NOTHING
  `);

  const result = await query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM dim_time');
  return result[0]?.cnt ?? 0;
}

// ── Events sync (incremental) ──

const EVENT_COLUMNS = [
  'event_id',
  'client_event_id',
  'event_version',
  'occurred_at',
  'user_id',
  'anon_id',
  'session_id',
  'lesson_id',
  'course_id',
  'segment_id',
  'experiment_id',
  'experiment_variant',
  'event_type',
  'role',
  'route_class',
  'device',
  'locale',
  'referrer_class',
  'ordinal',
  'value',
  'created_at',
  'ingested_at',
] as const;

async function syncEventsTable(): Promise<{ rows: number; elapsed: number }> {
  const start = Date.now();
  const state = await getSyncState('learning_events');
  let lastEventId: number = state?.last_event_id ?? 0;
  let totalRows = 0;
  let hasMore = true;

  while (hasMore) {
    const params: Record<string, string> = {
      event_id: `gt.${lastEventId}`,
      order: 'event_id.asc',
      limit: '1000',
    };

    const raw = await fetchFromVault<Record<string, unknown>>(
      'dataintel_events_sync',
      params,
    );

    if (raw.length === 0) {
      hasMore = false;
      break;
    }

    const mapped = raw.map(mapEventRow);

    await withConnection(async (c) => {
      await c.exec('BEGIN TRANSACTION');
      try {
        await batchInsert('fact_events_raw', EVENT_COLUMNS, mapped, c.execute);
        await c.exec('COMMIT');
      } catch (err) {
        await c.exec('ROLLBACK');
        throw err;
      }
    });

    const lastRow = mapped[mapped.length - 1];
    const newId = (lastRow?.event_id as number) ?? lastEventId;
    lastEventId = newId;
    totalRows += mapped.length;

    if (raw.length < 1000) {
      hasMore = false;
    }
  }

  if (totalRows > 0) {
    await upsertSyncState('learning_events', lastEventId, totalRows);
  }

  return { rows: totalRows, elapsed: Date.now() - start };
}

// ── Dimension sync (full refresh) ──

const USER_COLUMNS = [
  'user_id',
  'role',
  'is_staff',
  'created_at',
  'locale',
  'xp_points',
  'lessons_completed',
  'streak_days',
  'longest_streak',
] as const;

const LESSON_COLUMNS = [
  'lesson_id',
  'slug',
  'title_en',
  'title_es',
  'title_pt',
  'course_id',
  'course_slug',
  'course_title_en',
  'course_title_es',
  'course_title_pt',
  'segment_count',
] as const;

const SESSION_COLUMNS = [
  'session_id',
  'user_id',
  'started_at',
  'ended_at',
  'device',
  'locale',
  'referrer_class',
  'events_count',
  'surfaces',
  'lessons_started',
  'duration_sec',
] as const;

const ATTEMPT_COLUMNS = [
  'attempt_id', 'user_id', 'lesson_id', 'course_id', 'topic_id', 'skill_key',
  'segment_id', 'attempt_number', 'score', 'hints_used', 'time_spent_seconds',
  'document_updated_at', 'diagnostic_code', 'created_at',
] as const;

const ANON_CONVERSION_COLUMNS = ['anon_id', 'user_id', 'converted_at'] as const;

async function syncDimTable(
  syncKey: TableName,
  targetTable: string,
  vaultPath: string,
  mapper: (row: Record<string, unknown>) => Record<string, unknown>,
  columns: readonly string[],
  orderColumn: string,
): Promise<{ rows: number; elapsed: number }> {
  const start = Date.now();

  await exec(`TRUNCATE TABLE ${targetTable}`);

  let totalRows = 0;
  let hasMore = true;
  let offset = 0;
  const limit = 5000;

  while (hasMore) {
    // Explicit ORDER BY is required for stable LIMIT/OFFSET pagination —
    // without it Postgres/PostgREST make no ordering guarantee across
    // separate requests, which can skip or duplicate rows between pages.
    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
      order: `${orderColumn}.asc`,
    };

    const raw = await fetchFromVault<Record<string, unknown>>(vaultPath, params);

    if (raw.length === 0) {
      hasMore = false;
      break;
    }

    /*
     * Contract guard for the staff marker.
     *
     * mapUserRow treats a missing `is_staff` as staff, so an un-migrated Vault
     * (0046 not applied) would classify EVERY user as staff and drive every
     * metric to zero. That is the safe direction — an obviously broken console
     * beats a plausible-looking one — but only if the operator is told WHY.
     * A silent floor of zeroes is indistinguishable from "nobody used the
     * product this week", which is exactly the confusion this whole change
     * exists to end.
     */
    if (targetTable === 'dim_users_raw' && raw.length > 0 && !('is_staff' in (raw[0] as object))) {
      throw new Error(
        'dataintel_users_sync is missing is_staff — apply Vault migration 0046 before syncing, ' +
          'otherwise every user is treated as staff and all metrics read zero',
      );
    }

    const mapped = raw.map(mapper);

    await withConnection(async (c) => {
      await c.exec('BEGIN TRANSACTION');
      try {
        await batchInsert(targetTable, columns, mapped, c.execute);
        await c.exec('COMMIT');
      } catch (err) {
        await c.exec('ROLLBACK');
        throw err;
      }
    });

    totalRows += mapped.length;
    offset += limit;

    if (raw.length < limit) {
      hasMore = false;
    }
  }

  await upsertSyncState(syncKey, 0, totalRows);

  return { rows: totalRows, elapsed: Date.now() - start };
}

// ── Aggregates ──

export async function refreshAggregates(): Promise<void> {
  // Recompute a bounded trailing window. Summing per-event counts inflates
  // distinct users and sessions, so both rollups calculate at their reporting
  // grain directly from the event fact table.
  await exec('DELETE FROM agg_daily_activity WHERE day >= CURRENT_DATE - INTERVAL 7 DAY');
  await exec('DELETE FROM agg_daily_users WHERE day >= CURRENT_DATE - INTERVAL 7 DAY');

  await exec(`
    INSERT INTO agg_daily_activity (day, role, event_type, route_class, device, locale, events, users, sessions, total_value)
    SELECT
      created_at::DATE AS day,
      COALESCE(role, 'unknown') AS role,
      event_type,
      COALESCE(route_class, '') AS route_class,
      COALESCE(device, '') AS device,
      COALESCE(locale, '') AS locale,
      COUNT(*) AS events,
      COUNT(DISTINCT COALESCE(user_id::VARCHAR, anon_id::VARCHAR)) AS users,
      COUNT(DISTINCT session_id) AS sessions,
      SUM(COALESCE(value, 0)) AS total_value
    FROM fact_events
    WHERE created_at >= CURRENT_DATE - INTERVAL 7 DAY
    GROUP BY day, role, event_type, route_class, device, locale
  `);

  await exec(`
    INSERT INTO agg_daily_users (day, role, users, sessions)
    SELECT
      created_at::DATE AS day,
      COALESCE(role, 'unknown') AS role,
      COUNT(DISTINCT COALESCE(user_id::VARCHAR, anon_id::VARCHAR)) AS users,
      COUNT(DISTINCT session_id) AS sessions
    FROM fact_events
    WHERE created_at >= CURRENT_DATE - INTERVAL 7 DAY
    GROUP BY day, role
    UNION ALL
    SELECT
      created_at::DATE AS day,
      '' AS role,
      COUNT(DISTINCT COALESCE(user_id::VARCHAR, anon_id::VARCHAR)) AS users,
      COUNT(DISTINCT session_id) AS sessions
    FROM fact_events
    WHERE created_at >= CURRENT_DATE - INTERVAL 7 DAY
    GROUP BY day
  `);
}

// ── Public API ──

export async function syncTable(
  tableName: TableName,
): Promise<{ rows: number; elapsed: number }> {
  if (!isReady()) {
    throw new Error('DuckDB is not ready — run initDb() first');
  }

  await ensureSyncStateTable();

  try {
    switch (tableName) {
      case 'learning_events':
        return await syncEventsTable();
      case 'users':
        return await syncDimTable(
          'users',
          'dim_users_raw',
          'dataintel_users_sync',
          mapUserRow,
          USER_COLUMNS,
          'user_id',
        );
      case 'lessons':
        return await syncDimTable(
          'lessons',
          'dim_lessons',
          'dataintel_lessons_sync',
          mapLessonRow,
          LESSON_COLUMNS,
          'lesson_id',
        );
      case 'sessions':
        return await syncDimTable(
          'sessions',
          'dim_sessions_raw',
          'dataintel_sessions_sync',
          mapSessionRow,
          SESSION_COLUMNS,
          'session_id',
        );
      case 'attempts':
        return await syncDimTable(
          'attempts',
          'fact_segment_attempts_raw',
          'dataintel_attempts_sync',
          mapAttemptRow,
          ATTEMPT_COLUMNS,
          'attempt_id',
        );
      case 'anon_conversions':
        return await syncDimTable(
          'anon_conversions',
          'dim_anon_conversions',
          'dataintel_anon_conversions_sync',
          mapAnonConversionRow,
          ANON_CONVERSION_COLUMNS,
          'anon_id',
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setSyncError(tableName, message).catch(() => {
      /* ignore secondary error */
    });
    throw err;
  }
}

export async function syncAll(): Promise<{
  tables: Record<string, number>;
  elapsed: number;
}> {
  const start = Date.now();
  const tables: Record<string, number> = {};
  const tableNames: TableName[] = [
    'learning_events',
    'users',
    'lessons',
    'sessions',
    'attempts',
    'anon_conversions',
  ];

  for (const name of tableNames) {
    try {
      const result = await syncTable(name);
      tables[name] = result.rows;
    } catch {
      tables[name] = -1;
    }
  }

  // E.6: a batch read from Vault just before an account was erased must not
  // bring its rows back (services/erasure.ts).
  // A failure is recorded in warehouse_maintenance_log (ok = FALSE) by the
  // step itself and fails Core's `warehouse_retention` watched job (H.4).
  try {
    tables.erasure_reapplied = await applyErasureTombstones();
  } catch (err) {
    console.error('[dataintel] erasure re-apply failed:', err);
    tables.erasure_reapplied = -1;
  }

  // H.2 / Appendix O 1.2: the warehouse copy of raw events (and the learner-
  // keyed experiment rows) keeps the raw store's 400-day window, never longer
  // (services/warehouseRetention.ts). Runs after every sync, so a batch that brought an
  // already-expired row in cannot keep it.
  try {
    const removed = await applyWarehouseRetention();
    tables.retention_pruned = Object.values(removed).reduce((sum, n) => sum + n, 0);
  } catch (err) {
    console.error('[dataintel] warehouse retention prune failed:', err);
    tables.retention_pruned = -1;
  }

  return { tables, elapsed: Date.now() - start };
}
