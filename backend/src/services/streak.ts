/*
 * Pure streak computation for POST /learn/lessons/:id/complete.
 *
 * DOCUMENTED LIMITATION: no schema change was in scope for this session, so
 * there is no dedicated "last activity date" column — `learning_stats` has
 * no other writer than this endpoint (0006: system-written only, no client
 * INSERT/UPDATE), so its `updated_at` doubles as a reasonably faithful proxy
 * for "the last day the learner passed a lesson". A future session that adds
 * a real `last_active_date` column should replace this proxy.
 */
const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);

export function nextStreak(lastUpdatedAt: string, currentStreakDays: number, now: Date = new Date()): number {
  const today = dateOnly(now);
  const yesterday = dateOnly(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const lastDate = dateOnly(new Date(lastUpdatedAt));

  if (lastDate === today) return Math.max(currentStreakDays, 1); // already logged today — don't double-increment, but a first-ever pass still counts as day 1
  if (lastDate === yesterday) return currentStreakDays + 1; // consecutive day
  return 1; // gap (or clock skew) — restart the streak
}

/** True when this is the first learning activity of the (UTC) day — the moment worth the full-screen streak celebration (v1's `was_first_today`). */
export function isFirstActivityToday(lastUpdatedAt: string, now: Date = new Date()): boolean {
  return dateOnly(new Date(lastUpdatedAt)) !== dateOnly(now);
}
