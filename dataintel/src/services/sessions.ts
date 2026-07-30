import { query } from '../db/duckdb.js';
import { sessionDepthQuery } from '../db/queries.js';

export interface DepthEntry {
  session_id: string;
  started_at: string;
  role: string;
  device: string;
  events: number;
  surfaces: number;
  lessons_started: number;
  visible_seconds: number;
}

interface SessionDepthRow {
  session_id: string;
  user_id: string;
  event_count: number;
  surfaces: number;
  lessons_touched: number;
  max_ordinal: number;
  duration_sec: number | null;
  started_at: string;
  ended_at: string;
}

interface UserRoleRow {
  user_id: string;
  role: string;
  device: string;
}

export async function getSessionDepth(
  days: number,
  limit: number,
): Promise<DepthEntry[] | null> {
  try {
    const { sql, params } = sessionDepthQuery(days, limit);
    const rows = await query<SessionDepthRow>(sql, ...params);

    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];

    const roleMap: Map<string, { role: string; device: string }> = new Map();
    if (userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
      const userRows = await query<UserRoleRow>(
        `SELECT user_id, role, '' AS device FROM dim_users WHERE user_id IN (${placeholders})`,
        ...userIds,
      );
      for (const ur of userRows) {
        roleMap.set(ur.user_id, { role: ur.role, device: ur.device });
      }
    }

    return rows.map((r) => {
      const meta = roleMap.get(r.user_id);
      return {
        session_id: r.session_id,
        started_at: r.started_at,
        role: meta?.role ?? 'unknown',
        device: meta?.device ?? 'unknown',
        events: Number(r.event_count),
        surfaces: Number(r.surfaces),
        lessons_started: Number(r.lessons_touched),
        visible_seconds: r.duration_sec !== null ? Number(r.duration_sec) : 0,
      };
    });
  } catch (err) {
    console.error('[dataintel][sessions] getSessionDepth failed:', err);
    return null;
  }
}
