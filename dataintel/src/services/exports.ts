import crypto from 'node:crypto';
import { query } from '../db/duckdb.js';
import { exportQuery } from '../db/queries.js';

/*
 * H.3: the async export-JOB machinery (create/list/get + the export_jobs
 * table) was removed — jobs could be created and listed but no processor
 * ever advanced them, so staff could create an artifact that could never
 * complete. The direct, synchronous /export/events surface below was
 * already the working mechanism and is now the only one.
 */

interface ExportEventRow {
  session_id: string | null;
  lesson_id: string | null;
  segment_id: string | null;
  event_type: string;
  role: string | null;
  route_class: string | null;
  device: string | null;
  locale: string | null;
  referrer_class: string | null;
  ordinal: number | null;
  value: number | null;
  created_at: string;
  ingested_at: string | null;
  lesson_slug: string | null;
  lesson_title: string | null;
}

const EXPORT_FILTER_KEYS = new Set([
  'event_type', 'role', 'route_class', 'device', 'locale', 'lesson_id', 'segment_id',
]);

function hasOnlyAllowedFilters(filters: Record<string, unknown>): boolean {
  return Object.keys(filters).every((key) => EXPORT_FILTER_KEYS.has(key));
}

function exportRow(row: ExportEventRow, salt: string): Record<string, unknown> {
  const { session_id: sessionId, ...safeRow } = row;
  return {
    ...safeRow,
    // A stable session ID is still a pseudonymous identifier. Re-key it for
    // every response so exports cannot be joined into a longitudinal profile.
    session_ref: sessionId
      ? crypto.createHash('sha256').update(`${salt}:${sessionId}`).digest('hex')
      : null,
  };
}

export async function exportEvents(
  filters: Record<string, unknown>,
  limit: number,
  offset: number,
): Promise<{
  rows: Record<string, unknown>[];
  truncated: boolean;
  nextOffset: number | null;
} | null> {
  try {
    if (!hasOnlyAllowedFilters(filters)) return null;
    const fetchLimit = limit + 1;
    const { sql, params } = exportQuery(filters, fetchLimit, offset);
    const rows = await query<ExportEventRow>(sql, ...params);

    const truncated = rows.length > limit;
    if (truncated) {
      rows.pop();
    }

    const salt = crypto.randomUUID();
    return {
      rows: rows.map((row) => exportRow(row, salt)),
      truncated,
      nextOffset: truncated ? offset + limit : null,
    };
  } catch (err) {
    console.error('[dataintel][exports] exportEvents failed:', err);
    return null;
  }
}
