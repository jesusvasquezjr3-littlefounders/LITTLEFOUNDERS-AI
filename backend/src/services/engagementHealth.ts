import { z } from 'zod';
import { serviceRest } from './supabaseRest.js';

/*
 * B.28 (S05.3f): resolution efficiency, not engagement volume.
 * Policy: docs/rebuild/LEARNER-REGISTER-AND-WELLBEING-POLICY.md §5.
 *
 * The rule: no product decision, experiment or metric may treat more time,
 * more sessions, more events or more Mentor turns as success. A Mentor that
 * resolves a question in fewer turns, and a session where more of the time is
 * spent practising, are the goals. Appendix C Part 1.2's two B.28 metrics are
 * weekly series; each has a good direction, and moving the other way is a
 * regression to investigate, never a neutral "engagement" signal.
 *
 * Enforced by: this registry (a test pins every direction and that no volume
 * signal can be an optimization target), the staff report's trend status, the
 * analytics service refusing an engagement-volume metric as an experiment's
 * success metric (dataintel), and the repository gate forbidding an automatic
 * advance or autoplay into more content (agent/tools/check-dark-patterns.mjs).
 */

export type MetricDirection = 'higher-is-better' | 'lower-is-better' | 'diagnostic';

export interface EngagementHealthMetric {
  id: string;
  /** Appendix C Part 1.2 name. */
  name: string;
  direction: MetricDirection;
  source: string;
}

/** Appendix C Part 1.2, with the direction each one must move in. */
export const ENGAGEMENT_HEALTH_METRICS: readonly EngagementHealthMetric[] = [
  { id: 'session_efficiency_ratio', name: 'Session Efficiency Ratio', direction: 'higher-is-better', source: 'learning_session_efficiency' },
  { id: 'mentor_resolution_turns', name: 'AI Mentor Resolution Efficiency', direction: 'lower-is-better', source: 'mentor_resolution_efficiency' },
  { id: 'streak_anxiety_correlation', name: 'Streak-Anxiety Correlation', direction: 'lower-is-better', source: 'retired: no streak-at-risk notification exists (mentorQuality.ts RETIRED_SIGNALS)' },
  { id: 'rest_day_utilization', name: 'Streak-Freeze (rest day) Utilization Rate', direction: 'diagnostic', source: 'learning_rest_day_utilization' },
  { id: 'dark_pattern_audit_failures', name: 'Dark-Pattern Audit Score', direction: 'lower-is-better', source: 'release_audit_results (dark_pattern) on the C.24 dashboard; docs/rebuild/audits/dark-pattern-audits.json' },
  { id: 'variable_ratio_mechanics', name: 'Variable-Ratio Mechanic Audit Pass Rate', direction: 'higher-is-better', source: 'release_audit_results (variable_ratio) on the C.24 dashboard; agent/tools/check-reward-mechanics.mjs' },
  { id: 'reward_framing_composition', name: 'Reward-Framing Composition Rate', direction: 'higher-is-better', source: 'release_audit_results (reward_framing) on the C.24 dashboard; LessonResultView recognition' },
  { id: 'autonomy_adoption', name: 'Autonomy Mechanism Adoption Rate', direction: 'higher-is-better', source: 'learning_autonomy_adoption' },
  { id: 'parent_time_to_value', name: 'Parent Time-to-Value', direction: 'lower-is-better', source: 'parent_time_to_value (parent_signup_completed to parent_first_value)' },
];

/**
 * Volume signals. They may be reported (a session-length histogram, an event
 * count) but never be a success metric, an experiment's winning criterion or
 * a target any code optimizes toward.
 */
export const ENGAGEMENT_VOLUME_SIGNALS: readonly string[] = [
  'time_on_app', 'session_length', 'session_seconds', 'sessions', 'session_count', 'events', 'event_count',
  'mentor_turns', 'conversation_turns', 'turn_count', 'messages_sent', 'daily_active_minutes', 'screen_time',
];

export function mayOptimizeFor(metric: string): boolean {
  const normalized = metric.trim().toLowerCase();
  return !ENGAGEMENT_VOLUME_SIGNALS.includes(normalized);
}

export type TrendStatus = 'insufficient_data' | 'improving' | 'steady' | 'regression';

export interface WeeklyPoint { week_start: string; value: number | null; sample: number }

export const TREND_WINDOW_WEEKS = 4;
export const TREND_TOLERANCE = 0.1;
export const TREND_MIN_WEEKLY_SAMPLE = 20;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The last TREND_WINDOW_WEEKS weeks against the four before them (weeks with
 * too small a sample are ignored). A change of more than TREND_TOLERANCE, in
 * the metric's bad direction, is a regression; a turn count that grows is
 * never "engagement".
 */
export function classifyTrend(points: readonly WeeklyPoint[], direction: Exclude<MetricDirection, 'diagnostic'>): TrendStatus {
  const usable = points.filter((point) => point.value !== null && point.sample >= TREND_MIN_WEEKLY_SAMPLE)
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
  if (usable.length < TREND_WINDOW_WEEKS * 2) return 'insufficient_data';
  const recent = median(usable.slice(-TREND_WINDOW_WEEKS).map((point) => point.value!));
  const before = median(usable.slice(-TREND_WINDOW_WEEKS * 2, -TREND_WINDOW_WEEKS).map((point) => point.value!));
  if (before === 0) return recent === 0 ? 'steady' : direction === 'lower-is-better' ? 'regression' : 'improving';
  const change = (recent - before) / Math.abs(before);
  const worse = direction === 'lower-is-better' ? change > TREND_TOLERANCE : change < -TREND_TOLERANCE;
  const better = direction === 'lower-is-better' ? change < -TREND_TOLERANCE : change > TREND_TOLERANCE;
  return worse ? 'regression' : better ? 'improving' : 'steady';
}

const count = z.coerce.number().int().nonnegative();
const SessionRow = z.object({
  week_start: z.string(), learners: count, graded_seconds: count, session_seconds: count,
  efficiency_ratio: z.coerce.number().min(0).max(1).nullable(),
});
const ResolutionRow = z.object({
  week_start: z.string(), intent: z.string(), resolved_sessions: count,
  median_turns: z.coerce.number().nonnegative().nullable(), p75_turns: z.coerce.number().nonnegative().nullable(),
});

export interface EngagementHealthReport {
  weeks: number;
  sessionEfficiency: { weekly: z.infer<typeof SessionRow>[]; trend: TrendStatus };
  mentorResolution: { weekly: z.infer<typeof ResolutionRow>[]; trend: TrendStatus };
  thresholds: { windowWeeks: number; tolerance: number; minWeeklySample: number };
}

export const ENGAGEMENT_HEALTH_WEEKS = 12;

async function rpc<T>(name: string, body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T | null> {
  const result = await serviceRest<unknown>(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  const parsed = schema.safeParse(result);
  return parsed.success ? parsed.data : null;
}

/** Null when either function is unreachable (the engagement-health migration is not applied yet). */
export async function loadEngagementHealth(now = new Date()): Promise<EngagementHealthReport | null> {
  const window = {
    p_since: new Date(now.getTime() - ENGAGEMENT_HEALTH_WEEKS * 7 * 86_400_000).toISOString(),
    p_until: now.toISOString(),
  };
  const [sessions, resolution] = await Promise.all([
    rpc('learning_session_efficiency', window, z.array(SessionRow)),
    rpc('mentor_resolution_efficiency', window, z.array(ResolutionRow)),
  ]);
  if (!sessions || !resolution) return null;
  const overall = resolution.filter((row) => row.intent === 'all');
  return {
    weeks: ENGAGEMENT_HEALTH_WEEKS,
    sessionEfficiency: {
      weekly: sessions,
      trend: classifyTrend(sessions.map((row) => ({ week_start: row.week_start, value: row.efficiency_ratio, sample: row.learners })), 'higher-is-better'),
    },
    mentorResolution: {
      weekly: resolution,
      trend: classifyTrend(overall.map((row) => ({ week_start: row.week_start, value: row.median_turns, sample: row.resolved_sessions })), 'lower-is-better'),
    },
    thresholds: { windowWeeks: TREND_WINDOW_WEEKS, tolerance: TREND_TOLERANCE, minWeeklySample: TREND_MIN_WEEKLY_SAMPLE },
  };
}
