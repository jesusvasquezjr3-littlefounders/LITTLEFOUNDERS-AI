/*
 * Pure day-streak computation for POST /learn/lessons/:id/complete.
 *
 * The streak is anchored to learning_stats.last_active_date (0009): the
 * LOCAL calendar date (client-reported, YYYY-MM-DD) of the learner's last
 * passed lesson. A kid's "day" follows their wall clock, not UTC — so the
 * client sends `local_date` and everything here is pure calendar-date math.
 *
 * History: the first implementation proxied "last activity" through the
 * row's updated_at, which nothing ever advanced — after the first UTC
 * rollover every completed lesson read "last activity = yesterday" and the
 * streak grew +1 PER LESSON. Never reintroduce a timestamp proxy here.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole-day difference between two YYYY-MM-DD calendar dates (b - a). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function isCalendarDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * The streak after a lesson PASSED on `todayLocal`:
 * - first pass ever (no anchor) → 1
 * - same day as the anchor      → unchanged (never +1 twice in one day)
 * - exactly the next day        → +1
 * - any gap (or clock skew)     → restart at 1
 */
export function nextStreak(lastActiveDate: string | null, currentStreakDays: number, todayLocal: string): number {
  if (!lastActiveDate) return 1;
  const diff = dayDiff(lastActiveDate, todayLocal);
  if (diff === 0) return Math.max(currentStreakDays, 1);
  if (diff === 1) return currentStreakDays + 1;
  return 1;
}

/** True when no lesson has been passed yet on `todayLocal` — the moment worth the full-screen streak celebration (v1's `was_first_today`). */
export function isFirstActivityToday(lastActiveDate: string | null, todayLocal: string): boolean {
  return lastActiveDate !== todayLocal;
}
