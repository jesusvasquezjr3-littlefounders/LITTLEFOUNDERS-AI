import { query } from '../db/duckdb.js';

export interface DataQualityReport {
  generatedAt: string;
  freshness: Array<{
    source: string;
    lastSyncedAt: string | null;
    rowsSynced: number;
    lastError: string | null;
    stale: boolean;
  }>;
  events: {
    total: number;
    idempotencyCoveragePct: number;
    contextCoveragePct: number;
    lateArrivalPct: number;
  };
  attempts: {
    total: number;
    skillCoveragePct: number;
    timingCoveragePct: number;
    documentVersionCoveragePct: number;
  };
}

interface SyncRow {
  table_name: string;
  last_synced_at: string | Date;
  rows_synced: number;
  last_error: string | null;
  stale: boolean;
}

interface EventQualityRow {
  total: number;
  idempotent: number;
  contextual: number;
  late: number;
}

interface AttemptQualityRow {
  total: number;
  skill_contextual: number;
  timed: number;
  versioned: number;
}

const pct = (value: number, total: number) => total === 0 ? 100 : Math.round((value / total) * 10_000) / 100;

export async function getDataQualityReport(): Promise<DataQualityReport | null> {
  try {
    const [syncRows, eventRows, attemptRows] = await Promise.all([
      query<SyncRow>(`
        SELECT *, last_synced_at < CURRENT_TIMESTAMP - INTERVAL 15 MINUTE AS stale
        FROM dataintel_sync_state
        ORDER BY table_name
      `),
      query<EventQualityRow>(`
        SELECT
          COUNT(*) AS total,
          COUNT(client_event_id) AS idempotent,
          COUNT(*) FILTER (WHERE
            (event_type = 'course_open' AND course_id IS NOT NULL)
            OR (event_type IN (
              'lesson_start', 'lesson_complete', 'lesson_abandon',
              'segment_view', 'segment_submit', 'segment_retry', 'hint_open',
              'explanation_view', 'audio_replay', 'results_view'
            ) AND lesson_id IS NOT NULL)
            OR event_type NOT IN (
              'course_open', 'lesson_start', 'lesson_complete', 'lesson_abandon',
              'segment_view', 'segment_submit', 'segment_retry', 'hint_open',
              'explanation_view', 'audio_replay', 'results_view'
            )
          ) AS contextual,
          COUNT(*) FILTER (WHERE occurred_at IS NOT NULL AND created_at - occurred_at > INTERVAL 5 MINUTE) AS late
        FROM fact_events
      `),
      query<AttemptQualityRow>(`
        SELECT
          COUNT(*) AS total,
          COUNT(skill_key) AS skill_contextual,
          COUNT(time_spent_seconds) AS timed,
          COUNT(document_updated_at) AS versioned
        FROM fact_segment_attempts
      `),
    ]);
    const event = eventRows[0] ?? { total: 0, idempotent: 0, contextual: 0, late: 0 };
    const attempt = attemptRows[0] ?? { total: 0, skill_contextual: 0, timed: 0, versioned: 0 };
    const now = Date.now();
    return {
      generatedAt: new Date(now).toISOString(),
      freshness: syncRows.map((row) => {
        const last = new Date(row.last_synced_at).getTime();
        return {
          source: row.table_name,
          lastSyncedAt: Number.isFinite(last) ? new Date(last).toISOString() : null,
          rowsSynced: Number(row.rows_synced),
          lastError: row.last_error,
          // Compare inside DuckDB. Its TIMESTAMP values are timezone-naive by
          // design, while JavaScript parses them as UTC; comparing them in JS
          // would mark a freshly synced warehouse stale in non-UTC deploys.
          stale: row.stale,
        };
      }),
      events: {
        total: Number(event.total),
        idempotencyCoveragePct: pct(Number(event.idempotent), Number(event.total)),
        contextCoveragePct: pct(Number(event.contextual), Number(event.total)),
        lateArrivalPct: pct(Number(event.late), Number(event.total)),
      },
      attempts: {
        total: Number(attempt.total),
        skillCoveragePct: pct(Number(attempt.skill_contextual), Number(attempt.total)),
        timingCoveragePct: pct(Number(attempt.timed), Number(attempt.total)),
        documentVersionCoveragePct: pct(Number(attempt.versioned), Number(attempt.total)),
      },
    };
  } catch (err) {
    console.error('[dataintel][quality] getDataQualityReport failed:', err);
    return null;
  }
}
