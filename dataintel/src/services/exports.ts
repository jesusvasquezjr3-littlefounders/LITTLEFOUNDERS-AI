import { query, execute } from '../db/duckdb.js';
import { exportQuery } from '../db/queries.js';

const ENSURE_EXPORTS_TABLE = `\
CREATE TABLE IF NOT EXISTS export_jobs (
  job_id VARCHAR PRIMARY KEY,
  status VARCHAR NOT NULL DEFAULT 'pending',
  filters TEXT,
  format VARCHAR NOT NULL DEFAULT 'json',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  download_url VARCHAR,
  rows INTEGER,
  error VARCHAR
)`;

export interface ExportJob {
  jobId: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  filters: Record<string, unknown>;
  format: 'csv' | 'json' | 'parquet';
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  rows?: number;
  error?: string;
}

interface ExportJobRow {
  job_id: string;
  status: string;
  filters: string;
  format: string;
  created_at: string;
  completed_at: string | null;
  download_url: string | null;
  row_count: number | null;
  error: string | null;
}

interface ExportEventRow {
  [key: string]: unknown;
}

function rowToJob(r: ExportJobRow): ExportJob {
  return {
    jobId: r.job_id,
    status: r.status as ExportJob['status'],
    filters: parseFilters(r.filters),
    format: r.format as ExportJob['format'],
    createdAt: r.created_at,
    completedAt: r.completed_at ?? undefined,
    downloadUrl: r.download_url ?? undefined,
    rows: r.row_count ?? undefined,
    error: r.error ?? undefined,
  };
}

function parseFilters(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    console.error('[dataintel][exports] parseFilters failed:', err);
    return {};
  }
}

export async function createExportJob(
  filters: Record<string, unknown>,
  format: 'csv' | 'json' | 'parquet',
): Promise<ExportJob | null> {
  try {
    await execute(ENSURE_EXPORTS_TABLE);

    const jobId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const filtersJson = JSON.stringify(filters);

    await execute(
      `INSERT INTO export_jobs (job_id, status, filters, format, created_at)
       VALUES ($1, 'pending', $2, $3, $4)`,
      jobId,
      filtersJson,
      format,
      createdAt,
    );

    return {
      jobId,
      status: 'pending',
      filters,
      format,
      createdAt,
    };
  } catch (err) {
    console.error('[dataintel][exports] createExportJob failed:', err);
    return null;
  }
}

export async function getExportJob(
  jobId: string,
): Promise<ExportJob | null> {
  try {
    const rows = await query<ExportJobRow>(
      `SELECT job_id, status, filters, format, created_at, completed_at, download_url, rows AS row_count, error
       FROM export_jobs
       WHERE job_id = $1`,
      jobId,
    );

    const row = rows[0];
    if (!row) return null;

    return rowToJob(row);
  } catch (err) {
    console.error('[dataintel][exports] getExportJob failed:', err);
    return null;
  }
}

export async function listExportJobs(
  limit: number,
): Promise<ExportJob[] | null> {
  try {
    await execute(ENSURE_EXPORTS_TABLE);

    const rows = await query<ExportJobRow>(
      `SELECT job_id, status, filters, format, created_at, completed_at, download_url, rows AS row_count, error
       FROM export_jobs
       ORDER BY created_at DESC
       LIMIT $1`,
      limit,
    );

    return rows.map(rowToJob);
  } catch (err) {
    console.error('[dataintel][exports] listExportJobs failed:', err);
    return null;
  }
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
    const fetchLimit = limit + 1;
    const { sql, params } = exportQuery(filters, fetchLimit, offset);
    const rows = await query<ExportEventRow>(sql, ...params);

    const truncated = rows.length > limit;
    if (truncated) {
      rows.pop();
    }

    return {
      rows: rows as Record<string, unknown>[],
      truncated,
      nextOffset: truncated ? offset + limit : null,
    };
  } catch (err) {
    console.error('[dataintel][exports] exportEvents failed:', err);
    return null;
  }
}
