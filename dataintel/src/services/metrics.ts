import { query } from '../db/duckdb.js';
import {
  dailyUsersQuery,
  engagementQuery,
  trendQuery,
  compareQuery,
  timeToValueQuery,
  featureAdoptionQuery,
  anomalyQuery,
  cohortRetentionQuery,
  activationFunnelQuery,
  type AnalyticsWindow,
} from '../db/queries.js';

export interface MetricsSummary {
  dau: number;
  wau: number;
  mau: number;
  totalEvents: number;
  week1Retention: number;
  activationRate: number;
  medianTimeToValue: number | null;
  peakDailyUsers: number;
  adoption: AdoptionEntry[];
  anomalies: number;
}

export interface AdoptionEntry {
  role: string;
  routeClass: string;
  users: number;
  sessions: number;
  events: number;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface CompareResult {
  current: number;
  previous: number;
  change: number;
  changePct: number;
}

export interface EngagementEntry {
  user_id: string;
  engagement_score: number;
  lessons_completed: number;
  longest_streak: number;
  sessions_30d: number;
  active_days_30d: number;
}

export interface TimeToValueEntry {
  user_id: string;
  first_seen: string;
  activated_at: string | null;
  hours_to_value: number | null;
}

interface DailyUserRow {
  day: string;
  users: number;
  sessions: number;
  anon_users: number;
  events: number;
}

interface AdoptionRow {
  route_class: string;
  role: string;
  users: number;
  sessions: number;
  events: number;
}

interface RetentionRow {
  cohort: string;
  cohort_size: number;
  week_number: number;
  retained_users: number;
  retention_pct: number;
}

interface FunnelRow {
  step: string;
  users: number;
}

interface TTVRow {
  user_id: string;
  first_seen: string;
  first_complete_at: string | null;
  sec_to_first_complete: number | null;
}

interface AnomalyRow {
  classification: string;
}

interface TrendRow {
  bucket: string;
  event_count: number;
  users: number;
  sessions: number;
  total_value: number;
  avg_value: number;
}

interface CompareRow {
  current_value: number;
  previous_value: number;
  absolute_change: number;
  pct_change: number | null;
}

interface EngagementRow {
  user_id: string;
  total_events: number;
  sessions: number;
  lessons_touched: number;
  active_days: number;
  lessons_completed: number;
  longest_streak: number;
  streak_days: number;
  xp_points: number;
}

const METRIC_COLUMN: Record<string, string> = {
  dau: 'users',
  users: 'users',
  events: 'event_count',
  sessions: 'sessions',
};

export async function getMetricsSummary(days: number): Promise<MetricsSummary | null> {
  try {
    const windowDays = Math.max(days, 7);
    /*
     * The summary's sub-queries used to be unbounded while the header said
     * "last N days": adoption, activation and time-to-value were computed over
     * all of history and displayed under the selected period. They now share
     * the selection.
     */
    const summaryWindow: AnalyticsWindow = { days: windowDays };

    const [
      dailyRaw,
      adoptionRaw,
      retentionRaw,
      funnelRaw,
      timeToValueRaw,
      anomalyRaw,
      wauRaw,
      mauRaw,
    ] = await Promise.all([
      (async (): Promise<DailyUserRow[]> => {
        const { sql, params } = dailyUsersQuery(windowDays);
        return query<DailyUserRow>(sql, ...params);
      })(),
      (async (): Promise<AdoptionRow[]> => {
        const { sql, params } = featureAdoptionQuery(summaryWindow);
        return query<AdoptionRow>(sql, ...params);
      })(),
      (async (): Promise<RetentionRow[]> => {
        const { sql, params } = cohortRetentionQuery(windowDays);
        return query<RetentionRow>(sql, ...params);
      })(),
      (async (): Promise<FunnelRow[]> => {
        const { sql, params } = activationFunnelQuery(summaryWindow);
        return query<FunnelRow>(sql, ...params);
      })(),
      (async (): Promise<TTVRow[]> => {
        const { sql, params } = timeToValueQuery(10000, summaryWindow);
        return query<TTVRow>(sql, ...params);
      })(),
      (async (): Promise<AnomalyRow[]> => {
        const { sql, params } = anomalyQuery('users', windowDays, 2.0);
        return query<AnomalyRow>(sql, ...params);
      })(),
      query<{ users: number }>(
        `SELECT COUNT(DISTINCT user_id) AS users FROM fact_events WHERE created_at >= CURRENT_DATE - INTERVAL 7 DAY AND user_id IS NOT NULL`,
      ),
      query<{ users: number }>(
        `SELECT COUNT(DISTINCT user_id) AS users FROM fact_events WHERE created_at >= CURRENT_DATE - INTERVAL 30 DAY AND user_id IS NOT NULL`,
      ),
    ]);

    const sortedDays = [...dailyRaw].sort(
      (a, b) => new Date(b.day).getTime() - new Date(a.day).getTime(),
    );
    const today = sortedDays[0];

    const dau = today ? Number(today.users) : 0;
    const wau = wauRaw[0]?.users ?? 0;
    const mau = mauRaw[0]?.users ?? 0;

    const totalEvents = dailyRaw.reduce((sum, r) => sum + Number(r.events), 0);
    const peakDailyUsers = dailyRaw.reduce(
      (max, r) => Math.max(max, Number(r.users)),
      0,
    );

    const week1 = retentionRaw.filter((r) => r.week_number === 0);
    const week1Retention =
      week1.length > 0
        ? week1.reduce((sum, r) => sum + r.retention_pct, 0) / week1.length
        : 0;

    const funnelVisited = funnelRaw.find((r) => r.step === 'visited');
    const funnelCompleted = funnelRaw.find((r) => r.step === 'completed_lesson');
    const visitedUsers = funnelVisited ? Number(funnelVisited.users) : 0;
    const completedUsers = funnelCompleted ? Number(funnelCompleted.users) : 0;
    const activationRate =
      visitedUsers > 0
        ? Math.round((completedUsers / visitedUsers) * 10000) / 100
        : 0;

    const ttvs = timeToValueRaw
      .filter((r) => r.sec_to_first_complete !== null)
      .map((r) => r.sec_to_first_complete as number)
      .sort((a, b) => a - b);

    let medianTimeToValue: number | null = null;
    if (ttvs.length > 0) {
      const mid = Math.floor(ttvs.length / 2);
      const medianSec =
        ttvs.length % 2 === 0
          ? ((ttvs[mid - 1] ?? 0) + (ttvs[mid] ?? 0)) / 2
          : (ttvs[mid] ?? 0);
      medianTimeToValue = Math.round((medianSec / 60) * 100) / 100;
    }

    const adoption: AdoptionEntry[] = adoptionRaw.map((r) => ({
      role: r.role,
      routeClass: r.route_class,
      users: Number(r.users),
      sessions: Number(r.sessions),
      events: Number(r.events),
    }));

    const anomalies = anomalyRaw.length;

    return {
      dau,
      wau: Number(wau),
      mau: Number(mau),
      totalEvents,
      week1Retention: Math.round(week1Retention * 100) / 100,
      activationRate,
      medianTimeToValue,
      peakDailyUsers,
      adoption,
      anomalies,
    };
  } catch (err) {
    console.error('[dataintel][metrics] getMetricsSummary failed:', err);
    return null;
  }
}

export async function getTrend(
  metric: string,
  granularity: string,
  days: number,
): Promise<TrendPoint[] | null> {
  try {
    const column = METRIC_COLUMN[metric];
    if (!column) return null;
    const { sql, params } = trendQuery(column, granularity, days);
    const rows = await query<TrendRow>(sql, ...params);

    return rows.map((r) => ({
      date: r.bucket,
      value: Number(r[column as keyof TrendRow] ?? 0),
    }));
  } catch (err) {
    console.error('[dataintel][metrics] getTrend failed:', err);
    return null;
  }
}

export async function getComparison(
  metric: string,
  currentStart: string,
  currentEnd: string,
  previousStart: string,
  previousEnd: string,
): Promise<CompareResult | null> {
  try {
    const column = METRIC_COLUMN[metric];
    if (!column) return null;
    const { sql, params } = compareQuery(
      column,
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    );
    const rows = await query<CompareRow>(sql, ...params);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      current: Number(row.current_value),
      previous: Number(row.previous_value),
      change: Number(row.absolute_change),
      changePct: row.pct_change ?? 0,
    };
  } catch (err) {
    console.error('[dataintel][metrics] getComparison failed:', err);
    return null;
  }
}

export async function getEngagement(
  limit: number,
  window: AnalyticsWindow,
): Promise<EngagementEntry[] | null> {
  try {
    const { sql, params } = engagementQuery(limit, window);
    const rows = await query<EngagementRow>(sql, ...params);

    return rows.map((r) => ({
      user_id: r.user_id,
      engagement_score:
        Number(r.total_events) +
        Number(r.sessions) * 2 +
        Number(r.lessons_touched) * 5 +
        Number(r.active_days) * 3,
      lessons_completed: Number(r.lessons_completed),
      longest_streak: Number(r.longest_streak),
      sessions_30d: Number(r.sessions),
      active_days_30d: Number(r.active_days),
    }));
  } catch (err) {
    console.error('[dataintel][metrics] getEngagement failed:', err);
    return null;
  }
}

export async function getTimeToValue(
  limit: number,
  window: AnalyticsWindow,
): Promise<TimeToValueEntry[] | null> {
  try {
    const { sql, params } = timeToValueQuery(limit, window);
    const rows = await query<TTVRow>(sql, ...params);

    return rows.map((r) => ({
      user_id: r.user_id,
      first_seen: r.first_seen,
      activated_at: r.first_complete_at,
      hours_to_value:
        r.sec_to_first_complete !== null
          ? Math.round((r.sec_to_first_complete / 3600) * 100) / 100
          : null,
    }));
  } catch (err) {
    console.error('[dataintel][metrics] getTimeToValue failed:', err);
    return null;
  }
}
