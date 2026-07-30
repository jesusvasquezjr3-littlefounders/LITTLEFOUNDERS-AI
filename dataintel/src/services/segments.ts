import { query, execute } from '../db/duckdb.js';

const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const ENSURE_SEGMENTS_TABLE = `\
CREATE TABLE IF NOT EXISTS segment_definitions (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  filters TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

export interface SegmentDefinition {
  id?: string;
  name: string;
  filters: SegmentFilter[];
}

export interface SegmentFilter {
  field: string;
  op: 'eq' | 'neq' | 'in';
  value: string | string[];
}

export interface SegmentMetrics {
  segmentId: string;
  name: string;
  userCount: number;
  avgEngagement: number;
  retentionRate: number;
  avgSessionsPerUser: number;
}

interface SegmentRow {
  id: string;
  name: string;
  filters: string;
  created_at: string;
}

interface MetricRow {
  users: number;
  avg_events: number;
  avg_sessions: number;
  retention_7d: number;
}

function buildFilterCondition(filters: SegmentFilter[]): string {
  if (filters.length === 0) return 'TRUE';

  return filters
    .map((f) => {
      const col = f.field;
      if (!VALID_IDENTIFIER.test(col)) {
        throw new Error(`Invalid identifier in filter field: ${col}`);
      }
      if (f.op === 'in' && Array.isArray(f.value)) {
        const quoted = f.value.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
        return `${col} IN (${quoted})`;
      }
      if (f.op === 'neq') {
        return `${col} != '${String(f.value).replace(/'/g, "''")}'`;
      }
      return `${col} = '${String(f.value).replace(/'/g, "''")}'`;
    })
    .join(' AND ');
}

export async function createSegment(
  def: SegmentDefinition,
): Promise<SegmentDefinition | null> {
  try {
    await execute(ENSURE_SEGMENTS_TABLE);

    const id = def.id ?? crypto.randomUUID();
    const filtersJson = JSON.stringify(def.filters);

    await execute(
      `INSERT INTO segment_definitions (id, name, filters) VALUES ($1, $2, $3)`,
      id,
      def.name,
      filtersJson,
    );

    return { id, name: def.name, filters: def.filters };
  } catch (err) {
    console.error('[dataintel][segments] createSegment failed:', err);
    return null;
  }
}

export async function listSegments(): Promise<SegmentDefinition[] | null> {
  try {
    await execute(ENSURE_SEGMENTS_TABLE);

    const rows = await query<SegmentRow>(
      `SELECT id, name, filters, created_at FROM segment_definitions ORDER BY created_at DESC`,
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      filters: parseFilters(r.filters),
    }));
  } catch (err) {
    console.error('[dataintel][segments] listSegments failed:', err);
    return null;
  }
}

function parseFilters(raw: string): SegmentFilter[] {
  try {
    return JSON.parse(raw) as SegmentFilter[];
  } catch (err) {
    console.error('[dataintel][segments] parseFilters failed:', err);
    return [];
  }
}

export async function getSegmentMetrics(
  segmentId: string,
): Promise<SegmentMetrics | null> {
  try {
    const segRows = await query<SegmentRow>(
      `SELECT id, name, filters, created_at FROM segment_definitions WHERE id = $1`,
      segmentId,
    );
    const seg = segRows[0];
    if (!seg) return null;

    const filters = parseFilters(seg.filters);
    const condition = buildFilterCondition(filters);

    const metricRows = await query<MetricRow>(
      `SELECT
        COUNT(DISTINCT fe.user_id) AS users,
        COALESCE(AVG(evt_count), 0) AS avg_events,
        COALESCE(AVG(sess_count), 0) AS avg_sessions,
        COALESCE(
          COUNT(DISTINCT CASE
            WHEN fe2.created_at >= fe.first_seen - INTERVAL 7 DAY
              AND fe2.created_at < fe.first_seen
            THEN fe.user_id
          END) * 100.0 / NULLIF(COUNT(DISTINCT fe.user_id), 0),
          0
        ) AS retention_7d
      FROM (
        SELECT
          user_id,
          MIN(created_at) AS first_seen
        FROM fact_events
        WHERE ${condition}
        GROUP BY user_id
      ) fe
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS evt_count
        FROM fact_events
        GROUP BY user_id
      ) evt ON fe.user_id = evt.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(DISTINCT session_id) AS sess_count
        FROM fact_events
        GROUP BY user_id
      ) sess ON fe.user_id = sess.user_id
      LEFT JOIN fact_events fe2 ON fe.user_id = fe2.user_id`,
    );

    const m = metricRows[0];

    return {
      segmentId: seg.id,
      name: seg.name,
      userCount: Number(m?.users ?? 0),
      avgEngagement: Math.round(Number(m?.avg_events ?? 0) * 100) / 100,
      retentionRate: Math.round(Number(m?.retention_7d ?? 0) * 100) / 100,
      avgSessionsPerUser: Math.round(Number(m?.avg_sessions ?? 0) * 100) / 100,
    };
  } catch (err) {
    console.error('[dataintel][segments] getSegmentMetrics failed:', err);
    return null;
  }
}

export async function compareSegments(
  segmentA: string,
  segmentB: string,
): Promise<{ a: SegmentMetrics; b: SegmentMetrics } | null> {
  try {
    const [a, b] = await Promise.all([
      getSegmentMetrics(segmentA),
      getSegmentMetrics(segmentB),
    ]);

    if (!a || !b) return null;

    return { a, b };
  } catch (err) {
    console.error('[dataintel][segments] compareSegments failed:', err);
    return null;
  }
}

export async function deleteSegment(segmentId: string): Promise<boolean> {
  try {
    await execute(
      `DELETE FROM segment_definitions WHERE id = $1`,
      segmentId,
    );
    return true;
  } catch (err) {
    console.error('[dataintel][segments] deleteSegment failed:', err);
    return false;
  }
}
