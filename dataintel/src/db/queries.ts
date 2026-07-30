export interface QueryResult {
  sql: string;
  params: unknown[];
}

const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertIdentifier(col: string): string {
  if (!VALID_IDENTIFIER.test(col)) {
    throw new Error(`Invalid identifier: ${col}`);
  }
  return col;
}

/**
 * Thrown when a caller-supplied `metric` has no corresponding column in the
 * per-bucket rollup these queries compute from (see resolveBucketMetricColumn).
 */
export class UnsupportedMetricError extends Error {
  constructor(metric: string) {
    super(
      `Metric '${metric}' is not supported by this per-bucket query — only events, dau, users, sessions are (wau/mau/retention/activation/completions need a dedicated cohort/window query, not a flat bucket rollup).`,
    );
    this.name = 'UnsupportedMetricError';
  }
}

/**
 * Maps the public metric name to the actual rollup column name computed by
 * anomalyQuery/forecastQuery/compareQuery's inner subqueries. Previously
 * these functions ran `assertIdentifier(metric)` (a syntax-only check) and
 * interpolated the raw metric string as a column name directly — 'events'
 * doesn't match the rollup's `event_count` column and 'sessions'/'dau'/'wau'/
 * 'mau'/etc. weren't computed by the subquery at all, so every metric except
 * the one that happened to literally match a column name ('users') threw a
 * DuckDB "column not found" error. This resolves through an explicit
 * allowlist instead, so unsupported metrics fail fast and clearly rather
 * than as an opaque 502.
 */
export function resolveBucketMetricColumn(metric: string): string {
  switch (metric) {
    case 'events':
      return 'event_count';
    case 'dau':
    case 'users':
      return 'users';
    case 'sessions':
      return 'sessions';
    default:
      throw new UnsupportedMetricError(metric);
  }
}

export function buildWhere(filters: Record<string, unknown>): QueryResult {
  const entries = Object.entries(filters).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return { sql: '', params: [] };

  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of entries) {
    const col = assertIdentifier(key);
    if (Array.isArray(value)) {
      const start = params.length + 1;
      params.push(...value);
      const placeholders = value.map((_, i) => `$${start + i}`);
      clauses.push(`${col} IN (${placeholders.join(', ')})`);
    } else {
      params.push(value);
      clauses.push(`${col} = $${params.length}`);
    }
  }

  return { sql: `WHERE ${clauses.join(' AND ')}`, params };
}

export function dailyUsersQuery(days: number): QueryResult {
  const sql = `\
    WITH dates AS (
      SELECT UNNEST(GENERATE_SERIES(
        CURRENT_DATE - INTERVAL '${days}' DAY,
        CURRENT_DATE,
        INTERVAL 1 DAY
      )) AS day
    )
    SELECT
      d.day,
      COUNT(DISTINCT fe.user_id) FILTER (WHERE fe.user_id IS NOT NULL) AS users,
      COUNT(DISTINCT fe.session_id) FILTER (WHERE fe.session_id IS NOT NULL) AS sessions,
      COUNT(DISTINCT fe.anon_id) FILTER (WHERE fe.anon_id IS NOT NULL) AS anon_users,
      COUNT(*) AS events
    FROM dates d
    LEFT JOIN fact_events fe ON fe.created_at::DATE = d.day
    GROUP BY d.day
    ORDER BY d.day`;
  return { sql, params: [] };
}

export function dailyActivityQuery(days: number): QueryResult {
  const sql = `\
    SELECT
      created_at::DATE AS day,
      role,
      event_type,
      COALESCE(route_class, '') AS route_class,
      COALESCE(device, '') AS device,
      COALESCE(locale, '') AS locale,
      COUNT(*) AS events,
      COUNT(DISTINCT user_id) AS users,
      COUNT(DISTINCT session_id) AS sessions,
      SUM(COALESCE(value, 0)) AS total_value
    FROM fact_events
    WHERE created_at >= CURRENT_DATE - INTERVAL '${days}' DAY
    GROUP BY day, role, event_type, route_class, device, locale
    ORDER BY day`;
  return { sql, params: [] };
}

export function cohortRetentionQuery(weeks: number): QueryResult {
  const sql = `\
    WITH first_appearance AS (
      SELECT
        user_id,
        MIN(created_at::DATE) AS cohort_week
      FROM fact_events
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    ),
    weekly_activity AS (
      SELECT DISTINCT
        user_id,
        date_trunc('week', created_at)::DATE AS active_week
      FROM fact_events
      WHERE user_id IS NOT NULL
    ),
    cohort_sizes AS (
      SELECT
        date_trunc('week', cohort_week)::DATE AS cohort,
        COUNT(DISTINCT user_id) AS size
      FROM first_appearance
      GROUP BY cohort
    )
    SELECT
      fa.cohort_week AS cohort,
      cs.size AS cohort_size,
      ((wa.active_week - fa.cohort_week) / 7)::INTEGER AS week_number,
      COUNT(DISTINCT fa.user_id) AS retained_users,
      ROUND(COUNT(DISTINCT fa.user_id) * 100.0 / NULLIF(cs.size, 0), 2) AS retention_pct
    FROM first_appearance fa
    JOIN weekly_activity wa ON fa.user_id = wa.user_id
    JOIN cohort_sizes cs ON date_trunc('week', fa.cohort_week)::DATE = cs.cohort
    WHERE wa.active_week >= fa.cohort_week
      AND fa.cohort_week >= CURRENT_DATE - INTERVAL '${weeks}' WEEK
    GROUP BY fa.cohort_week, cs.size, week_number
    ORDER BY cohort, week_number`;
  return { sql, params: [] };
}

export function activationFunnelQuery(): QueryResult {
  const sql = `\
    WITH steps AS (
      SELECT
        user_id,
        MAX(CASE WHEN event_type = 'page_view'         THEN 1 ELSE 0 END) AS visited,
        MAX(CASE WHEN event_type = 'signup_start'      THEN 1 ELSE 0 END) AS started_signup,
        MAX(CASE WHEN event_type = 'signup_complete'   THEN 1 ELSE 0 END) AS completed_signup,
        MAX(CASE WHEN event_type = 'lesson_start'      THEN 1 ELSE 0 END) AS started_lesson,
        MAX(CASE WHEN event_type = 'lesson_complete'   THEN 1 ELSE 0 END) AS completed_lesson
      FROM fact_events
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    )
    SELECT 'visited'          AS step, COUNT(*) FILTER (WHERE visited = 1)          AS users FROM steps
    UNION ALL
    SELECT 'started_signup'  , COUNT(*) FILTER (WHERE started_signup = 1)           FROM steps
    UNION ALL
    SELECT 'completed_signup', COUNT(*) FILTER (WHERE completed_signup = 1)         FROM steps
    UNION ALL
    SELECT 'started_lesson'  , COUNT(*) FILTER (WHERE started_lesson = 1)           FROM steps
    UNION ALL
    SELECT 'completed_lesson', COUNT(*) FILTER (WHERE completed_lesson = 1)         FROM steps
    ORDER BY users DESC`;
  return { sql, params: [] };
}

export function lessonDropoffQuery(limit: number): QueryResult {
  const sql = `\
    WITH lesson_starts AS (
      SELECT
        l.lesson_id,
        l.slug,
        l.title_en,
        COUNT(*) AS starts
      FROM fact_events fe
      JOIN dim_lessons l ON fe.lesson_id = l.lesson_id
      WHERE fe.event_type = 'lesson_start'
      GROUP BY l.lesson_id, l.slug, l.title_en
    ),
    lesson_completes AS (
      SELECT
        l.lesson_id,
        COUNT(*) AS completes
      FROM fact_events fe
      JOIN dim_lessons l ON fe.lesson_id = l.lesson_id
      WHERE fe.event_type = 'lesson_complete'
      GROUP BY l.lesson_id
    )
    SELECT
      ls.slug,
      ls.title_en,
      ls.starts,
      COALESCE(lc.completes, 0) AS completes,
      CASE
        WHEN ls.starts > 0
        THEN ROUND((1.0 - COALESCE(lc.completes, 0)::DOUBLE / ls.starts::DOUBLE) * 100, 2)
        ELSE NULL
      END AS dropoff_pct,
      ls.starts - COALESCE(lc.completes, 0) AS dropped_users
    FROM lesson_starts ls
    LEFT JOIN lesson_completes lc ON ls.lesson_id = lc.lesson_id
    ORDER BY dropoff_pct DESC NULLS LAST
    LIMIT $1`;
  return { sql, params: [limit] };
}

export function segmentCalibrationQuery(
  minLearners: number,
  limit: number,
): QueryResult {
  const sql = `\
    WITH segment_attempts AS (
      SELECT
        lesson_id,
        segment_id,
        COUNT(*) AS attempts,
        COUNT(DISTINCT user_id) AS learners,
        SUM(CASE WHEN value > 0.5 THEN 1 ELSE 0 END) AS successes,
        AVG(value) AS avg_score
      FROM fact_events
      WHERE event_type = 'segment_answer'
        AND user_id IS NOT NULL
      GROUP BY lesson_id, segment_id
      HAVING COUNT(DISTINCT user_id) >= $1
    )
    SELECT
      dl.slug AS lesson_slug,
      dl.title_en AS lesson_title,
      sa.segment_id,
      sa.learners,
      sa.attempts,
      ROUND(sa.avg_score, 4) AS avg_score,
      ROUND(sa.successes::DOUBLE / NULLIF(sa.attempts, 0)::DOUBLE, 4) AS success_rate,
      CASE
        WHEN sa.avg_score >= 0.85 THEN 'mastery'
        WHEN sa.avg_score >= 0.65 THEN 'proficient'
        WHEN sa.avg_score >= 0.40 THEN 'developing'
        ELSE 'needs_revision'
      END AS calibration
    FROM segment_attempts sa
    JOIN dim_lessons dl ON sa.lesson_id = dl.lesson_id
    ORDER BY sa.avg_score ASC
    LIMIT $2`;
  return { sql, params: [minLearners, limit] };
}

export function featureAdoptionQuery(): QueryResult {
  const sql = `\
    SELECT
      route_class,
      role,
      COUNT(DISTINCT user_id) AS users,
      COUNT(DISTINCT session_id) AS sessions,
      COUNT(*) AS events,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen
    FROM fact_events
    WHERE route_class IS NOT NULL
    GROUP BY route_class, role
    ORDER BY users DESC`;
  return { sql, params: [] };
}

export function sessionDepthQuery(days: number, limit: number): QueryResult {
  const sql = `\
    SELECT
      session_id,
      user_id,
      COUNT(*) AS event_count,
      COUNT(DISTINCT route_class) AS surfaces,
      COUNT(DISTINCT lesson_id) AS lessons_touched,
      MAX(ordinal) AS max_ordinal,
      EXTRACT(EPOCH FROM MAX(created_at) - MIN(created_at)) AS duration_sec,
      MIN(created_at) AS started_at,
      MAX(created_at) AS ended_at
    FROM fact_events
    WHERE created_at >= CURRENT_DATE - INTERVAL '${days}' DAY
      AND session_id IS NOT NULL
    GROUP BY session_id, user_id
    ORDER BY event_count DESC
    LIMIT $1`;
  return { sql, params: [limit] };
}

export function timeToValueQuery(limit: number): QueryResult {
  const sql = `\
    WITH first_touch AS (
      SELECT
        user_id,
        MIN(created_at) AS first_seen
      FROM fact_events
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    ),
    first_lesson AS (
      SELECT
        user_id,
        MIN(created_at) AS first_lesson_at
      FROM fact_events
      WHERE user_id IS NOT NULL
        AND event_type = 'lesson_start'
      GROUP BY user_id
    ),
    first_complete AS (
      SELECT
        user_id,
        MIN(created_at) AS first_complete_at
      FROM fact_events
      WHERE user_id IS NOT NULL
        AND event_type = 'lesson_complete'
      GROUP BY user_id
    )
    SELECT
      ft.user_id,
      du.role,
      du.locale,
      ft.first_seen,
      fl.first_lesson_at,
      fc.first_complete_at,
      EXTRACT(EPOCH FROM fl.first_lesson_at - ft.first_seen)    AS sec_to_first_lesson,
      EXTRACT(EPOCH FROM fc.first_complete_at - ft.first_seen)  AS sec_to_first_complete
    FROM first_touch ft
    LEFT JOIN first_lesson fl    ON ft.user_id = fl.user_id
    LEFT JOIN first_complete fc  ON ft.user_id = fc.user_id
    LEFT JOIN dim_users du       ON ft.user_id = du.user_id
    WHERE fl.first_lesson_at IS NOT NULL
    ORDER BY sec_to_first_lesson ASC
    LIMIT $1`;
  return { sql, params: [limit] };
}

export function engagementQuery(limit: number): QueryResult {
  const sql = `\
    SELECT
      fe.user_id,
      du.role,
      du.xp_points,
      du.lessons_completed,
      du.streak_days,
      du.longest_streak,
      COUNT(*) AS total_events,
      COUNT(DISTINCT fe.session_id) AS sessions,
      COUNT(DISTINCT fe.lesson_id) AS lessons_touched,
      COUNT(DISTINCT fe.created_at::DATE) AS active_days,
      MAX(fe.created_at) AS last_active
    FROM fact_events fe
    LEFT JOIN dim_users du USING (user_id)
    WHERE fe.user_id IS NOT NULL
    GROUP BY fe.user_id, du.role, du.xp_points, du.lessons_completed, du.streak_days, du.longest_streak
    ORDER BY total_events DESC
    LIMIT $1`;
  return { sql, params: [limit] };
}

export function customFunnelQuery(
  steps: string[],
  windowDays: number,
): QueryResult {
  const safeSteps = steps.map((s) => s.replace(/'/g, "''"));
  const stepPlaceholders = safeSteps.map((_, i) => `step${i}`);
  const stepCases = safeSteps
    .map(
      (step, i) =>
        `MAX(CASE WHEN event_type = '${step}' AND created_at <= us.created_at + INTERVAL '${windowDays}' DAYS THEN 1 ELSE 0 END) AS "${stepPlaceholders[i]}"`,
    )
    .join(',\n      ');

  const sql = `\
    WITH user_start AS (
      SELECT user_id, MIN(created_at) AS created_at
      FROM fact_events
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    )
    SELECT
      ${stepCases},
      COUNT(*) AS users
    FROM fact_events fe
    JOIN user_start us ON fe.user_id = us.user_id
    WHERE fe.user_id IS NOT NULL
    GROUP BY fe.user_id`;
  return { sql, params: [] };
}

export function segmentMetricsQuery(
  filters: Record<string, unknown>,
  metric: string,
): QueryResult {
  const { sql: whereClause, params } = buildWhere(filters);
  const where = whereClause ? `AND ${whereClause.replace('WHERE ', '')}` : '';
  const col = assertIdentifier(metric);

  const sql = `\
    SELECT
      lesson_id,
      segment_id,
      COUNT(*) AS attempts,
      COUNT(DISTINCT user_id) AS learners,
      AVG(value) AS avg_value,
      MIN(value) AS min_value,
      MAX(value) AS max_value,
      MEDIAN(value) AS median_value,
      AVG(${col}) AS metric_avg
    FROM fact_events
    WHERE event_type = 'segment_answer'
      AND user_id IS NOT NULL
      ${where}
    GROUP BY lesson_id, segment_id
    ORDER BY metric_avg ASC`;
  return { sql, params };
}

/**
 * Deliberately unlimited: risk_score is a 3-factor JS-computed value
 * (days_since_active bucket, active_days_last_7d, lessons_completed), not a
 * SQL column, so it can't be the SQL ORDER BY key. Truncating here by any
 * other column (e.g. days_since_active) before risk_score is computed can
 * silently drop the users who are actually highest-risk by the service's
 * own formula. The caller computes risk_score for every row, sorts by it,
 * and slices to the requested limit — see getChurnRisk().
 */
export function churnRiskQuery(): QueryResult {
  const sql = `\
    WITH user_activity AS (
      SELECT
        user_id,
        MAX(created_at) AS last_active,
        MIN(created_at) AS first_active,
        COUNT(*) AS total_events,
        COUNT(DISTINCT created_at::DATE) AS active_days,
        COUNT(DISTINCT lesson_id) AS lessons_touched
      FROM fact_events
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    ),
    recent_activity AS (
      SELECT
        user_id,
        COUNT(*) AS events_last_7d,
        COUNT(DISTINCT created_at::DATE) AS active_days_last_7d
      FROM fact_events
      WHERE user_id IS NOT NULL
        AND created_at >= CURRENT_DATE - INTERVAL 7 DAY
      GROUP BY user_id
    )
    SELECT
      ua.user_id,
      du.role,
      du.xp_points,
      du.lessons_completed,
      du.streak_days,
      ua.last_active,
      (CURRENT_DATE - ua.last_active::DATE)::INTEGER AS days_since_active,
      ua.active_days,
      ua.lessons_touched,
      COALESCE(ra.events_last_7d, 0)      AS events_last_7d,
      COALESCE(ra.active_days_last_7d, 0) AS active_days_last_7d,
      CASE
        WHEN ua.last_active < CURRENT_DATE - INTERVAL 14 DAY THEN 'high_risk'
        WHEN ua.last_active < CURRENT_DATE - INTERVAL 7  DAY THEN 'medium_risk'
        WHEN COALESCE(ra.active_days_last_7d, 0) <= 1   THEN 'at_risk'
        ELSE 'active'
      END AS churn_risk
    FROM user_activity ua
    LEFT JOIN dim_users du      ON ua.user_id = du.user_id
    LEFT JOIN recent_activity ra ON ua.user_id = ra.user_id
    ORDER BY days_since_active DESC`;
  return { sql, params: [] };
}

export function churnFactorsQuery(): QueryResult {
  const sql = `\
    WITH user_activity AS (
      SELECT
        user_id,
        MAX(created_at) AS last_active,
        COUNT(*) AS total_events,
        COUNT(DISTINCT created_at::DATE) AS active_days,
        COUNT(DISTINCT lesson_id) AS lessons_touched,
        COUNT(DISTINCT session_id) AS sessions,
        AVG(CASE WHEN route_class IS NOT NULL THEN 1 ELSE 0 END) AS feature_diversity_ratio
      FROM fact_events
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    ),
    churn_labels AS (
      SELECT
        ua.*,
        CASE WHEN ua.last_active < CURRENT_DATE - INTERVAL 14 DAY THEN 1 ELSE 0 END AS churned
      FROM user_activity ua
    )
    SELECT
      churned,
      COUNT(*) AS user_count,
      AVG(total_events)             AS avg_total_events,
      AVG(active_days)              AS avg_active_days,
      AVG(lessons_touched)          AS avg_lessons_touched,
      AVG(sessions)                 AS avg_sessions,
      AVG(feature_diversity_ratio)  AS avg_feature_diversity
    FROM churn_labels
    GROUP BY churned
    ORDER BY churned`;
  return { sql, params: [] };
}

export function anomalyQuery(
  metric: string,
  days: number,
  threshold: number,
): QueryResult {
  const col = resolveBucketMetricColumn(metric);

  const sql = `\
    WITH hourly_metric AS (
      SELECT
        date_trunc('hour', created_at) AS hour_bucket,
        COUNT(*) AS event_count,
        COUNT(DISTINCT user_id) AS users,
        COUNT(DISTINCT session_id) AS sessions,
        AVG(COALESCE(value, 0)) AS avg_value,
        SUM(COALESCE(value, 0)) AS total_value
      FROM fact_events
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days}' DAY
      GROUP BY hour_bucket
    ),
    stats AS (
      SELECT
        AVG(${col}) AS mean_val,
        STDDEV(${col}) AS std_val
      FROM hourly_metric
    )
    SELECT
      hm.hour_bucket,
      hm.${col} AS metric_value,
      s.mean_val AS expected_value,
      s.std_val,
      ABS(hm.${col} - s.mean_val) / NULLIF(s.std_val, 0) AS z_score,
      CASE
        WHEN ABS(hm.${col} - s.mean_val) > $1 * NULLIF(s.std_val, 0) THEN 'anomaly'
        ELSE 'normal'
      END AS classification
    FROM hourly_metric hm, stats s
    WHERE ABS(hm.${col} - s.mean_val) > $1 * NULLIF(s.std_val, 0)
    ORDER BY hm.hour_bucket`;
  return { sql, params: [threshold] };
}

export function trendQuery(
  metric: string,
  granularity: string,
  days: number,
): QueryResult {
  let trunc: string;
  switch (granularity) {
    case 'hour':
      trunc = "date_trunc('hour', created_at)";
      break;
    case 'week':
      trunc = "date_trunc('week', created_at)::DATE";
      break;
    default:
      trunc = 'created_at::DATE';
  }

  const sql = `\
    SELECT
      ${trunc} AS bucket,
      COUNT(*) AS event_count,
      COUNT(DISTINCT user_id) AS users,
      COUNT(DISTINCT session_id) AS sessions,
      SUM(COALESCE(value, 0)) AS total_value,
      AVG(COALESCE(value, 0)) AS avg_value
    FROM fact_events
    WHERE created_at >= CURRENT_DATE - INTERVAL '${days}' DAY
    GROUP BY bucket
    ORDER BY bucket`;
  return { sql, params: [] };
}

export function pathQuery(fromEvent: string, limit: number): QueryResult {
  const sql = `\
    WITH events_ordered AS (
      SELECT
        session_id,
        user_id,
        event_type,
        ordinal,
        LEAD(event_type) OVER (
          PARTITION BY session_id ORDER BY ordinal
        ) AS next_event,
        created_at
      FROM fact_events
      WHERE session_id IS NOT NULL
    ),
    transitions AS (
      SELECT
        event_type AS from_event,
        next_event AS to_event,
        COUNT(*) AS count
      FROM events_ordered
      WHERE event_type = $1
        AND next_event IS NOT NULL
      GROUP BY event_type, next_event
    ),
    total AS (
      SELECT SUM(count) AS total_count FROM transitions
    )
    SELECT
      t.from_event,
      t.to_event,
      t.count,
      ROUND(t.count * 100.0 / tot.total_count, 2) AS pct
    FROM transitions t, total tot
    ORDER BY t.count DESC
    LIMIT $2`;
  return { sql, params: [fromEvent, limit] };
}

export function sankeyQuery(
  funnelSteps: string[],
  windowDays: number,
): QueryResult {
  const safeSteps = funnelSteps.map((s) => s.replace(/'/g, "''"));
  const sql = `\
    WITH step_users AS (
      SELECT
        event_type,
        user_id,
        MIN(created_at) AS first_seen
      FROM fact_events
      WHERE user_id IS NOT NULL
        AND event_type IN (${funnelSteps.map(() => '?').join(', ')})
      GROUP BY event_type, user_id
    ),
    step_pairs AS (
      ${safeSteps
        .slice(0, -1)
        .map(
          (_, i) =>
            `SELECT '${safeSteps[i]}' AS from_step, '${safeSteps[i + 1]}' AS to_step`,
        )
        .join('\n      UNION ALL\n      ')}
    )
    SELECT
      sp.from_step,
      sp.to_step,
      COUNT(DISTINCT su_from.user_id) AS users_from,
      COUNT(DISTINCT su_to.user_id)   AS users_to,
      COUNT(DISTINCT su_to.user_id)   AS value
    FROM step_pairs sp
    LEFT JOIN step_users su_from ON sp.from_step = su_from.event_type
    LEFT JOIN step_users su_to
      ON sp.to_step = su_to.event_type
      AND su_to.user_id = su_from.user_id
      AND su_to.first_seen > su_from.first_seen
      AND su_to.first_seen <= su_from.first_seen + INTERVAL '${windowDays}' DAYS
    GROUP BY sp.from_step, sp.to_step
    ORDER BY sp.from_step, sp.to_step`;
  return { sql, params: funnelSteps };
}

export function forecastQuery(
  metric: string,
  daysHistory: number,
  daysForecast: number,
): QueryResult {
  const col = resolveBucketMetricColumn(metric);

  const sql = `\
    WITH daily_data AS (
      SELECT
        day,
        (EXTRACT(EPOCH FROM day) / 86400.0)::DOUBLE AS day_idx,
        ${col} AS metric_value
      FROM (
        SELECT
          created_at::DATE AS day,
          COUNT(*) AS event_count,
          COUNT(DISTINCT user_id) AS users,
          COUNT(DISTINCT session_id) AS sessions
        FROM fact_events
        WHERE created_at::DATE >= CURRENT_DATE - INTERVAL '${daysHistory}' DAY
          AND created_at::DATE < CURRENT_DATE
        GROUP BY created_at::DATE
      )
    ),
    regression AS (
      SELECT
        REGR_SLOPE(metric_value, day_idx)     AS slope,
        REGR_INTERCEPT(metric_value, day_idx)  AS intercept
      FROM daily_data
    ),
    forecast_days AS (
      SELECT UNNEST(GENERATE_SERIES(0, ${daysForecast})) AS offset_days
    )
    SELECT
      CURRENT_DATE + (fd.offset_days::INTEGER) AS day,
      r.intercept + r.slope * (
        EXTRACT(EPOCH FROM CURRENT_DATE) / 86400.0 + fd.offset_days::DOUBLE
      ) AS forecast_value,
      r.slope,
      r.intercept
    FROM forecast_days fd, regression r
    ORDER BY fd.offset_days`;
  return { sql, params: [] };
}

export function compareQuery(
  metric: string,
  currentStart: string,
  currentEnd: string,
  previousStart: string,
  previousEnd: string,
): QueryResult {
  // Unlike forecastQuery/anomalyQuery, this is called by
  // metrics.ts#getComparison with an ALREADY-RESOLVED column name (via that
  // module's own METRIC_COLUMN map) — resolving again here would reject an
  // already-real column name like 'event_count'. Just validate it's a safe
  // SQL identifier, as before.
  const col = assertIdentifier(metric);

  const sql = `\
    WITH current_period AS (
      SELECT ${col} AS metric_current
      FROM (
        SELECT
          COUNT(*) AS event_count,
          COUNT(DISTINCT user_id) AS users,
          COUNT(DISTINCT session_id) AS sessions
        FROM fact_events
        WHERE created_at BETWEEN $1::TIMESTAMP AND $2::TIMESTAMP
      )
    ),
    previous_period AS (
      SELECT ${col} AS metric_previous
      FROM (
        SELECT
          COUNT(*) AS event_count,
          COUNT(DISTINCT user_id) AS users,
          COUNT(DISTINCT session_id) AS sessions
        FROM fact_events
        WHERE created_at BETWEEN $3::TIMESTAMP AND $4::TIMESTAMP
      )
    )
    SELECT
      cur.metric_current                                        AS current_value,
      prev.metric_previous                                      AS previous_value,
      cur.metric_current - prev.metric_previous                 AS absolute_change,
      CASE
        WHEN prev.metric_previous > 0
        THEN ROUND(
          (cur.metric_current - prev.metric_previous) * 100.0
          / prev.metric_previous,
          2
        )
        ELSE NULL
      END AS pct_change
    FROM current_period cur, previous_period prev`;
  return {
    sql,
    params: [currentStart, currentEnd, previousStart, previousEnd],
  };
}

// ─────────────────────────────────────────────────────────────
// Game Engine funnels
// ─────────────────────────────────────────────────────────────
//
// The Arcade surface emits three closed-vocabulary events (migration 0028):
//   game_open      — the games hub was looked at
//   game_start     — a game actually mounted and play began
//   game_complete  — the SERVER accepted a replayed run (never a client claim)
//
// Everything above this block hardcodes lesson_start/lesson_complete, so
// without these queries the game events would be captured by Insights and
// then never analysed. These mirror the lesson funnels rather than replacing
// them: `lessons_completed` is deliberately not touched by games (GAME_ENGINE
// §7), so games and lessons are separate engagement surfaces that get
// COMPARED, never summed.

/** The Arcade funnel, in play order. Exported so a service layer can order steps. */
export const GAME_FUNNEL_STEPS = [
  'game_open',
  'game_start',
  'game_complete',
] as const;

export type GameFunnelStep = (typeof GAME_FUNNEL_STEPS)[number];

/**
 * Guards a day/window count that is INTERPOLATED into an INTERVAL literal
 * rather than bound as a parameter (DuckDB will not accept a parameter inside
 * `INTERVAL '?' DAY`). Callers Zod-validate at the edge; this is the
 * defence-in-depth twin of `assertIdentifier` for the numeric side, so a
 * non-integer can never reach the SQL text.
 */
function assertDayCount(days: number, label: string): number {
  if (!Number.isInteger(days) || days < 0 || days > 3650) {
    throw new Error(
      `${label} must be an integer between 0 and 3650 (got ${String(days)})`,
    );
  }
  return days;
}

/**
 * Ordered game engagement funnel: game_open → game_start → game_complete,
 * counted in DISTINCT USERS per step.
 *
 * The funnel is ORDERED, not a flat `MAX(CASE ...)` per event like
 * `activationFunnelQuery` — each step requires the previous step to have
 * happened FIRST, and the whole progression to fit inside `windowDays` of the
 * user's first open. A flat count reports a user who somehow completed a game
 * without ever opening the hub (a deep link, a lost beacon) as a converted
 * "started" user, which makes a funnel that can widen as it descends.
 *
 * `windowDays` is measured from each user's own first `game_open`, matching
 * `sankeyQuery`'s per-user window semantics — NOT a calendar cutoff on the
 * events themselves, so a user who opened the hub long ago is still counted
 * at the top of the funnel.
 */
export function gameFunnelQuery(windowDays: number): QueryResult {
  const days = assertDayCount(windowDays, 'windowDays');

  const sql = `\
    WITH firsts AS (
      SELECT
        user_id,
        MIN(created_at) FILTER (WHERE event_type = 'game_open')     AS opened_at,
        MIN(created_at) FILTER (WHERE event_type = 'game_start')    AS started_at,
        MIN(created_at) FILTER (WHERE event_type = 'game_complete') AS completed_at
      FROM fact_events
      WHERE user_id IS NOT NULL
        AND event_type IN ('game_open', 'game_start', 'game_complete')
      GROUP BY user_id
    ),
    staged AS (
      SELECT
        CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END AS opened,
        CASE
          WHEN opened_at IS NOT NULL
           AND started_at IS NOT NULL
           AND started_at >= opened_at
           AND started_at <= opened_at + INTERVAL '${days}' DAY
          THEN 1 ELSE 0
        END AS started,
        CASE
          WHEN opened_at IS NOT NULL
           AND started_at IS NOT NULL
           AND started_at >= opened_at
           AND started_at <= opened_at + INTERVAL '${days}' DAY
           AND completed_at IS NOT NULL
           AND completed_at >= started_at
           AND completed_at <= opened_at + INTERVAL '${days}' DAY
          THEN 1 ELSE 0
        END AS completed
      FROM firsts
    ),
    totals AS (
      SELECT
        SUM(opened)    AS opened,
        SUM(started)   AS started,
        SUM(completed) AS completed
      FROM staged
    )
    SELECT
      1 AS step_order,
      'game_open' AS step,
      t.opened::BIGINT AS users,
      ROUND(t.opened::DOUBLE * 100.0 / NULLIF(t.opened, 0)::DOUBLE, 2) AS pct_of_top,
      NULL::DOUBLE AS pct_of_previous
    FROM totals t
    UNION ALL
    SELECT
      2,
      'game_start',
      t.started::BIGINT,
      ROUND(t.started::DOUBLE * 100.0 / NULLIF(t.opened, 0)::DOUBLE, 2),
      ROUND(t.started::DOUBLE * 100.0 / NULLIF(t.opened, 0)::DOUBLE, 2)
    FROM totals t
    UNION ALL
    SELECT
      3,
      'game_complete',
      t.completed::BIGINT,
      ROUND(t.completed::DOUBLE * 100.0 / NULLIF(t.opened, 0)::DOUBLE, 2),
      ROUND(t.completed::DOUBLE * 100.0 / NULLIF(t.started, 0)::DOUBLE, 2)
    FROM totals t
    ORDER BY step_order`;
  return { sql, params: [] };
}

/**
 * Play-level completion and abandonment for the games surface over the last
 * `days` calendar days: one row of totals.
 *
 * Counted per PLAY (raw event counts), not per user — a learner who starts a
 * game five times and finishes three of them is 3/5, which is the question
 * "do games get finished?" actually asks. `players`/`finishers` carry the
 * distinct-user view alongside it.
 *
 * `abandons` is floored at 0: a `game_complete` whose matching `game_start`
 * beacon was lost (page hidden before the beacon flushed) would otherwise
 * produce a negative abandon count. `completion_pct` is deliberately NOT
 * capped at 100 for the same input — a rate above 100 is a visible signal
 * that starts are being under-counted, and silently clamping it would hide
 * exactly that.
 */
export function gameCompletionQuery(days: number): QueryResult {
  const window = assertDayCount(days, 'days');

  const sql = `\
    WITH plays AS (
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'game_start')    AS starts,
        COUNT(*) FILTER (WHERE event_type = 'game_complete') AS completes,
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'game_start')    AS players,
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'game_complete') AS finishers,
        AVG(value) FILTER (WHERE event_type = 'game_complete') AS avg_completed_value
      FROM fact_events
      WHERE event_type IN ('game_start', 'game_complete')
        AND created_at >= CURRENT_DATE - INTERVAL '${window}' DAY
    )
    SELECT
      p.starts::BIGINT     AS starts,
      p.completes::BIGINT  AS completes,
      p.players::BIGINT    AS players,
      p.finishers::BIGINT  AS finishers,
      GREATEST(p.starts - p.completes, 0)::BIGINT AS abandons,
      ROUND(p.completes::DOUBLE * 100.0 / NULLIF(p.starts, 0)::DOUBLE, 2) AS completion_pct,
      ROUND(
        GREATEST(p.starts - p.completes, 0)::DOUBLE * 100.0
        / NULLIF(p.starts, 0)::DOUBLE,
        2
      ) AS abandonment_pct,
      ROUND(p.avg_completed_value, 4) AS avg_completed_value
    FROM plays p`;
  return { sql, params: [] };
}

/**
 * Games vs lessons engagement over the last `days` days — two rows, one per
 * surface, with identical arithmetic on both sides so the numbers are
 * genuinely comparable.
 *
 * `reach` is the top-of-funnel signal (`game_open` / `course_open` plus any
 * play event); `starts`/`completes` are the play-level counts. Games and
 * lessons are never added together: a game reinforces a lesson concept, so
 * summing them would double-count one learning act.
 */
export function gamesVsLessonsQuery(days: number): QueryResult {
  const window = assertDayCount(days, 'days');

  const sql = `\
    WITH surface_events AS (
      SELECT
        CASE
          WHEN event_type IN ('game_open', 'game_start', 'game_complete') THEN 'games'
          WHEN event_type IN ('course_open', 'lesson_start', 'lesson_complete') THEN 'lessons'
        END AS surface,
        CASE WHEN event_type IN ('game_start', 'lesson_start')       THEN 1 ELSE 0 END AS is_start,
        CASE WHEN event_type IN ('game_complete', 'lesson_complete') THEN 1 ELSE 0 END AS is_complete,
        user_id,
        session_id,
        created_at,
        value
      FROM fact_events
      WHERE created_at >= CURRENT_DATE - INTERVAL '${window}' DAY
        AND event_type IN (
          'game_open', 'game_start', 'game_complete',
          'course_open', 'lesson_start', 'lesson_complete'
        )
    ),
    rolled AS (
      SELECT
        surface,
        SUM(is_start)    AS starts,
        SUM(is_complete) AS completes,
        COUNT(DISTINCT user_id) FILTER (WHERE is_start = 1) AS players,
        COUNT(DISTINCT user_id)          AS reach,
        COUNT(DISTINCT session_id)       AS sessions,
        COUNT(DISTINCT created_at::DATE) AS active_days,
        AVG(value) FILTER (WHERE is_complete = 1) AS avg_completed_value
      FROM surface_events
      WHERE surface IS NOT NULL
      GROUP BY surface
    )
    SELECT
      r.surface,
      r.starts::BIGINT      AS starts,
      r.completes::BIGINT   AS completes,
      r.players::BIGINT     AS players,
      r.reach::BIGINT       AS reach,
      r.sessions::BIGINT    AS sessions,
      r.active_days::BIGINT AS active_days,
      ROUND(r.completes::DOUBLE * 100.0 / NULLIF(r.starts, 0)::DOUBLE, 2) AS completion_pct,
      ROUND(r.starts::DOUBLE / NULLIF(r.players, 0)::DOUBLE, 2)           AS starts_per_player,
      ROUND(r.avg_completed_value, 4) AS avg_completed_value
    FROM rolled r
    ORDER BY r.surface`;
  return { sql, params: [] };
}

// ── Per-game / per-mechanic breakdown (requires the game_id dimension) ──
//
// BLOCKED ON THE SYNC, BY DESIGN. As of this commit `fact_events` has NO
// `game_id` column: migration 0028 added `learning_events.game_id` in Vault,
// but `dataintel_events_sync` (migration 0026) does not select it,
// `db/schema.sql` does not declare it and `db/sync.ts#mapEventRow` does not
// map it. Emitting the breakdown SQL unconditionally would reproduce this
// file's own worst historical bug — a query referencing a column that does
// not exist in what it queries, failing as an opaque 502 for every caller.
//
// So the breakdown is CAPABILITY-GATED: callers run
// `gameDimensionProbeQuery()` first and only reach `gameBreakdownQuery` when
// the warehouse actually carries the dimension. Until then the honest answer
// is "not available", never a broken query and never a fabricated zero.

/** Thrown when a caller asks to break games down by a dimension the warehouse cannot express. */
export class UnsupportedGameDimensionError extends Error {
  constructor(dimension: string) {
    super(
      `Game breakdown dimension '${dimension}' is not supported — only 'game' (fact_events.game_id) and 'mechanic' (dim_games.mechanic) are.`,
    );
    this.name = 'UnsupportedGameDimensionError';
  }
}

export type GameBreakdownDimension = 'game' | 'mechanic';

interface GameDimensionSql {
  /** The already-qualified column expression. NEVER caller-supplied text. */
  column: string;
  /** The join needed to reach it, or '' when none is. */
  join: string;
  /** Warehouse objects that must exist before this SQL can run at all. */
  requires: readonly string[];
}

/**
 * Resolves a public dimension name to a REAL column expression through an
 * explicit allowlist — the same discipline as `resolveBucketMetricColumn`,
 * for the same reason. A caller-supplied string is never interpolated into
 * the SQL text; only one of the two constants below ever is.
 */
export function resolveGameDimension(dimension: string): GameDimensionSql {
  switch (dimension) {
    case 'game':
      return {
        column: 'fe.game_id',
        join: '',
        requires: ['fact_events.game_id'],
      };
    case 'mechanic':
      // COALESCE, not a NULL that gets filtered away: a played game that is
      // missing from dim_games (deleted and recreated on republish — the
      // identity-migration case migration 0028 documents) must show up as
      // 'unknown', not silently vanish. Dropping it would make the
      // per-mechanic totals stop reconciling with gameCompletionQuery, and
      // an analytics number that quietly fails to add up is worse than one
      // that names its own gap.
      return {
        column: "COALESCE(dg.mechanic, 'unknown')",
        join: 'LEFT JOIN dim_games dg ON fe.game_id = dg.game_id',
        requires: ['fact_events.game_id', 'dim_games.mechanic'],
      };
    default:
      throw new UnsupportedGameDimensionError(dimension);
  }
}

/**
 * Asks the live warehouse whether the game dimension exists yet. One row:
 * `{ has_game_id, has_dim_games_mechanic }`. Run this BEFORE
 * `gameBreakdownQuery` — it is the whole reason that query is safe to ship
 * ahead of the sync that feeds it.
 */
export function gameDimensionProbeQuery(): QueryResult {
  const sql = `\
    SELECT
      (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'fact_events' AND column_name = 'game_id'
      ) > 0 AS has_game_id,
      (
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = 'dim_games' AND column_name = 'mechanic'
      ) > 0 AS has_dim_games_mechanic`;
  return { sql, params: [] };
}

/**
 * Per-game (or per-mechanic) starts / completes / abandonment.
 *
 * The `LIMIT` here is safe, unlike the one `churnRiskQuery` had to give up:
 * the ORDER BY key (`starts`) is a real SQL column computed in the `rolled`
 * CTE before the limit is applied, so the rows dropped are genuinely the
 * lowest-traffic ones by the same measure the caller asked to rank by. No
 * post-hoc score is computed in JS afterwards. If a caller ever adds one,
 * this LIMIT must move out of SQL exactly as churn's did.
 *
 * Only rows carrying a `game_id` participate; the lesson stream cannot leak
 * in. Requires the columns named by `resolveGameDimension(...).requires` —
 * see `gameDimensionProbeQuery()`.
 */
export function gameBreakdownQuery(
  dimension: GameBreakdownDimension,
  limit: number,
): QueryResult {
  const { column, join } = resolveGameDimension(dimension);

  const sql = `\
    WITH game_events AS (
      SELECT
        ${column}::VARCHAR AS dimension_key,
        CASE WHEN fe.event_type = 'game_start'    THEN 1 ELSE 0 END AS is_start,
        CASE WHEN fe.event_type = 'game_complete' THEN 1 ELSE 0 END AS is_complete,
        fe.user_id AS user_id,
        fe.value   AS value
      FROM fact_events fe
      ${join}
      WHERE fe.event_type IN ('game_start', 'game_complete')
        AND fe.game_id IS NOT NULL
    ),
    rolled AS (
      SELECT
        dimension_key,
        SUM(is_start)    AS starts,
        SUM(is_complete) AS completes,
        COUNT(DISTINCT user_id) AS players,
        AVG(value) FILTER (WHERE is_complete = 1) AS avg_completed_value
      FROM game_events
      WHERE dimension_key IS NOT NULL
      GROUP BY dimension_key
    )
    SELECT
      r.dimension_key,
      r.starts::BIGINT    AS starts,
      r.completes::BIGINT AS completes,
      r.players::BIGINT   AS players,
      GREATEST(r.starts - r.completes, 0)::BIGINT AS abandons,
      ROUND(r.completes::DOUBLE * 100.0 / NULLIF(r.starts, 0)::DOUBLE, 2) AS completion_pct,
      ROUND(
        GREATEST(r.starts - r.completes, 0)::DOUBLE * 100.0
        / NULLIF(r.starts, 0)::DOUBLE,
        2
      ) AS abandonment_pct,
      ROUND(r.avg_completed_value, 4) AS avg_completed_value
    FROM rolled r
    ORDER BY r.starts DESC, r.dimension_key
    LIMIT $1`;
  return { sql, params: [limit] };
}

export function exportQuery(
  filters: Record<string, unknown>,
  limit: number,
  offset: number,
): QueryResult {
  const { sql: whereClause, params } = buildWhere(filters);
  const where = whereClause || '';
  const offsetIdx = params.length + 1;
  const limitIdx = params.length + 2;

  const sql = `\
    SELECT
      fe.event_id,
      fe.user_id,
      fe.anon_id,
      fe.session_id,
      fe.lesson_id,
      fe.segment_id,
      fe.event_type,
      fe.role,
      fe.route_class,
      fe.device,
      fe.locale,
      fe.referrer_class,
      fe.ordinal,
      fe.value,
      fe.created_at,
      fe.ingested_at,
      dl.slug AS lesson_slug,
      dl.title_en AS lesson_title
    FROM fact_events fe
    LEFT JOIN dim_lessons dl ON fe.lesson_id = dl.lesson_id
    ${where}
    ORDER BY fe.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
  return { sql, params: [...params, offset, limit] };
}
