/*
 * THE HABIT STREAK MODEL (B.21, S05.3e): a lapse-tolerant day streak.
 *
 * One pure module, deliberately free of I/O, so every streak in the product
 * can share it. The learning streak uses it now (Core's read model here, and
 * the identical SQL function `habit_streak_advance` inside `complete_lesson`,
 * pinned to this file by the shared vectors in
 * `database/scripts/habit-streak-vectors.json`). The chore streak (D.2, S07)
 * must reuse THIS model rather than invent a second one: Product 10 D.2 says
 * so in as many words. The policy text lives in
 * `docs/rebuild/REWARD-AND-MOTIVATION-POLICY.md` §2.
 *
 * The rules (Frontend Bible 02 §9.6, Product 10 B.21, Appendix B §3.7):
 *
 *  1. A streak counts PRACTISED days in a row. A day is practised when the
 *     learner passes a lesson on that local calendar date (the client's wall
 *     clock, as since 0009).
 *  2. Two rest days a week are free and automatic: not earned, not bought, not
 *     claimed. A missed day inside the current run is a rest day. The week is
 *     the ISO week (Monday to Sunday) of the learner's local calendar. A run
 *     breaks only when some week holds a third missed day. A rest day keeps
 *     the run alive but does not add to it.
 *  3. A guardian may pause the streak for a holiday. A paused day is neither
 *     practised nor missed.
 *  4. The best streak and the total of days practised are permanent. Nothing
 *     here ever lowers either of them.
 *  5. A broken run is "resting", never "lost": the next practised day starts
 *     a new run at 1 and the best stays visible.
 *  6. Only the 7-, 30- and 100-day marks are milestones (OD-7). An ordinary
 *     practised day is not.
 *  7. A date EARLIER than the last practised day (clock skew, a device in
 *     another timezone) changes nothing. The legacy rule restarted the run,
 *     which punished the learner for their device clock.
 *
 * The chore streak (D.2) runs on this model since the S07 merge:
 * choreStreak.ts folds a child's recorded chore days through
 * `advanceHabitStreak`, reads them with `readHabitStreak` and lists its
 * rest-day lapses with `habitStreakLapses`. Nothing chore-specific lives here.
 */

export const HABIT_STREAK_MODEL = 'rest-days-v1' as const;
/** Free, automatic rest days per ISO week (Bible 02 §9.6 rule 1). */
export const REST_DAYS_PER_WEEK = 2;
/** The streak milestones on the OD-7 celebration list; nothing else about a streak celebrates. */
export const STREAK_MILESTONES = [7, 30, 100] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];
/** Longest single holiday pause a guardian may set, in days (a proposal; see the policy). */
export const MAX_PAUSE_DAYS = 21;
/** How far back a guardian may start a pause (an illness noticed late). */
export const PAUSE_BACKDATE_DAYS = 7;
/** How far ahead a pause may start. */
export const PAUSE_LEAD_DAYS = 60;

export interface HabitStreakState {
  /** Practised days in the current run. */
  current: number;
  /** The longest run ever. Permanent. */
  best: number;
  /** Local date (YYYY-MM-DD) of the last practised day, null before the first. */
  lastActiveDate: string | null;
  /** Rest days the current run has used in the ISO week of `lastActiveDate` (0 to REST_DAYS_PER_WEEK). */
  restDaysUsed: number;
  /** Every practised day ever. Permanent. */
  daysPracticed: number;
}

export type StreakOutcome = 'first' | 'same_day' | 'extended' | 'bridged' | 'restarted' | 'earlier_date';

export interface StreakAdvance {
  state: HabitStreakState;
  outcome: StreakOutcome;
  /** Missed days this practice bridged with rest days (0 unless `bridged`). */
  restDaysBridged: number;
  /** The milestone this practice reached, or null. */
  milestone: StreakMilestone | null;
}

export type StreakStatus = 'none' | 'practiced_today' | 'open' | 'paused' | 'resting';

export interface StreakReadModel {
  model: typeof HABIT_STREAK_MODEL;
  status: StreakStatus;
  /** The live run. 0 when resting or before the first practice (the UI shows "resting" and the best, never a zero). */
  current: number;
  best: number;
  daysPracticed: number;
  /** Rest days still free this ISO week for the live run. */
  restDaysLeft: number;
  lastActiveDate: string | null;
}

const DAY_MS = 86_400_000;

function toDay(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday (as a day number) of the ISO week holding `day`. Day 0 (1970-01-01) was a Thursday. */
function isoWeekStart(day: number): number {
  const weekday = (((day + 3) % 7) + 7) % 7; // 0 = Monday
  return day - weekday;
}

/** Expands pause ranges into the set of paused day numbers. */
export function pausedDays(pauses: ReadonlyArray<{ startsOn: string; endsOn: string }>): Set<number> {
  const out = new Set<number>();
  for (const pause of pauses) {
    const start = toDay(pause.startsOn);
    const end = toDay(pause.endsOn);
    for (let day = start; day <= end && day - start <= 366; day += 1) out.add(day);
  }
  return out;
}

interface GapVerdict {
  ok: boolean;
  /** Missed (not paused) days in the gap. */
  missed: number;
  /** Missed days counted against `weekStartOfDay`'s week (the last week the scan touched), when `ok`. */
  lastWeek: number;
  lastWeekCount: number;
}

/**
 * Scans the days strictly between `lastDay` and `endDay`. The run survives
 * when no ISO week holds more than REST_DAYS_PER_WEEK missed days, counting
 * the rest days the run had already used in `lastDay`'s week.
 */
function scanGap(lastDay: number, restDaysUsed: number, endDay: number, paused: ReadonlySet<number>): GapVerdict {
  let week = isoWeekStart(lastDay);
  let count = Math.min(Math.max(restDaysUsed, 0), REST_DAYS_PER_WEEK);
  let missed = 0;
  for (let day = lastDay + 1; day < endDay; day += 1) {
    if (paused.has(day)) continue;
    const dayWeek = isoWeekStart(day);
    if (dayWeek !== week) {
      week = dayWeek;
      count = 0;
    }
    count += 1;
    missed += 1;
    if (count > REST_DAYS_PER_WEEK) return { ok: false, missed, lastWeek: week, lastWeekCount: count };
  }
  return { ok: true, missed, lastWeek: week, lastWeekCount: count };
}

function milestoneFor(current: number): StreakMilestone | null {
  return (STREAK_MILESTONES as readonly number[]).includes(current) ? current as StreakMilestone : null;
}

/**
 * The streak after the learner practises on `today`. Pure: the SQL function
 * `habit_streak_advance` implements exactly this, pinned by shared vectors.
 */
export function advanceHabitStreak(
  state: HabitStreakState,
  today: string,
  paused: ReadonlySet<number> = new Set(),
): StreakAdvance {
  const best = Math.max(state.best, state.current);
  if (!state.lastActiveDate) {
    const next = { current: 1, best: Math.max(best, 1), lastActiveDate: today, restDaysUsed: 0, daysPracticed: state.daysPracticed + 1 };
    return { state: next, outcome: 'first', restDaysBridged: 0, milestone: null };
  }
  const lastDay = toDay(state.lastActiveDate);
  const todayDay = toDay(today);
  if (todayDay === lastDay) {
    const current = Math.max(state.current, 1);
    return { state: { ...state, current, best: Math.max(best, current) }, outcome: 'same_day', restDaysBridged: 0, milestone: null };
  }
  if (todayDay < lastDay) {
    return { state: { ...state, best }, outcome: 'earlier_date', restDaysBridged: 0, milestone: null };
  }
  const gap = scanGap(lastDay, state.restDaysUsed, todayDay, paused);
  if (!gap.ok) {
    const next = { current: 1, best: Math.max(best, 1), lastActiveDate: today, restDaysUsed: 0, daysPracticed: state.daysPracticed + 1 };
    return { state: next, outcome: 'restarted', restDaysBridged: 0, milestone: null };
  }
  const current = state.current + 1;
  const restDaysUsed = gap.lastWeek === isoWeekStart(todayDay) ? gap.lastWeekCount : 0;
  return {
    state: { current, best: Math.max(best, current), lastActiveDate: today, restDaysUsed, daysPracticed: state.daysPracticed + 1 },
    outcome: gap.missed > 0 ? 'bridged' : 'extended',
    restDaysBridged: gap.missed,
    milestone: milestoneFor(current),
  };
}

/**
 * What the learner (or their Tutor) sees on `today`, before practising.
 * Stored values are never rewritten by a read (OD-9): a run that can no
 * longer continue reads as `resting`, and the stored row keeps its numbers
 * until the next practised day starts a new run.
 */
export function readHabitStreak(
  state: HabitStreakState,
  today: string,
  paused: ReadonlySet<number> = new Set(),
): StreakReadModel {
  const base = { model: HABIT_STREAK_MODEL, best: Math.max(state.best, state.current), daysPracticed: state.daysPracticed, lastActiveDate: state.lastActiveDate };
  if (!state.lastActiveDate || state.current <= 0) {
    return { ...base, status: 'none', current: 0, restDaysLeft: REST_DAYS_PER_WEEK };
  }
  const lastDay = toDay(state.lastActiveDate);
  const todayDay = toDay(today);
  if (todayDay <= lastDay) {
    const used = isoWeekStart(todayDay) === isoWeekStart(lastDay) ? state.restDaysUsed : 0;
    return { ...base, status: 'practiced_today', current: state.current, restDaysLeft: Math.max(0, REST_DAYS_PER_WEEK - used) };
  }
  const gap = scanGap(lastDay, state.restDaysUsed, todayDay, paused);
  if (!gap.ok) return { ...base, status: 'resting', current: 0, restDaysLeft: REST_DAYS_PER_WEEK };
  const used = gap.lastWeek === isoWeekStart(todayDay) ? gap.lastWeekCount : 0;
  return {
    ...base,
    status: paused.has(todayDay) ? 'paused' : 'open',
    current: state.current,
    restDaysLeft: Math.max(0, REST_DAYS_PER_WEEK - used),
  };
}

/** A stored `learning_stats` row as the model's state. Missing new columns read as their migration defaults. */
export function habitStateFromStats(row: {
  streak_days: number; longest_streak?: number | null; last_active_date: string | null;
  rest_days_used?: number | null; days_practiced?: number | null;
}): HabitStreakState {
  return {
    current: Math.max(0, row.streak_days ?? 0),
    best: Math.max(0, row.longest_streak ?? 0, row.streak_days ?? 0),
    lastActiveDate: row.last_active_date,
    restDaysUsed: Math.min(REST_DAYS_PER_WEEK, Math.max(0, row.rest_days_used ?? 0)),
    daysPracticed: Math.max(0, row.days_practiced ?? 0),
  };
}

/**
 * The missed (not paused) days strictly between the last practised day and
 * `until`, in order: each one covered by a free rest day, and the last one
 * the day that ended the run when a week ran out of rest days. Exactly the
 * walk `advanceHabitStreak` and `readHabitStreak` make; it only names the
 * days, for the chore streak's rest-day utilization metric (D.2, Appendix H).
 */
export function habitStreakLapses(
  state: HabitStreakState,
  until: string,
  paused: ReadonlySet<number> = new Set(),
): Array<{ day: string; covered: boolean }> {
  if (!state.lastActiveDate || state.current <= 0) return [];
  const lastDay = toDay(state.lastActiveDate);
  const endDay = toDay(until);
  const out: Array<{ day: string; covered: boolean }> = [];
  let week = isoWeekStart(lastDay);
  let count = Math.min(Math.max(state.restDaysUsed, 0), REST_DAYS_PER_WEEK);
  for (let day = lastDay + 1; day < endDay; day += 1) {
    if (paused.has(day)) continue;
    const dayWeek = isoWeekStart(day);
    if (dayWeek !== week) {
      week = dayWeek;
      count = 0;
    }
    count += 1;
    const covered = count <= REST_DAYS_PER_WEEK;
    out.push({ day: fromDay(day), covered });
    if (!covered) break;
  }
  return out;
}

/** Whether a guardian's pause range is one the policy accepts, relative to the guardian's `today`. */
export function pauseRangeRefusal(startsOn: string, endsOn: string, today: string): 'order' | 'too_long' | 'too_early' | 'too_far' | null {
  const start = toDay(startsOn);
  const end = toDay(endsOn);
  const now = toDay(today);
  if (end < start) return 'order';
  if (end - start + 1 > MAX_PAUSE_DAYS) return 'too_long';
  if (start < now - PAUSE_BACKDATE_DAYS) return 'too_early';
  if (start > now + PAUSE_LEAD_DAYS) return 'too_far';
  return null;
}

/** Test and tooling helper: the calendar date `offset` days after `date`. */
export function addDays(date: string, offset: number): string {
  return fromDay(toDay(date) + offset);
}

// ── The weekly strip (GAP-FIX-R1 learning; Bible 02 §9.6 rules 4-5, 04 §4.3) ──

export type StreakDayState = 'practiced' | 'rest' | 'paused' | 'open' | 'today';
export interface StreakDay { date: string; state: StreakDayState }

/**
 * The current ISO week (Monday first) in the learner's calendar, day by day.
 * `practicedDates` are the learner's recorded local practice days
 * (learning_practice_days, 0208). A missed day inside a run that is still
 * alive was bridged by a rest day (the same lapse-tolerant rule as the
 * streak); a paused day is paused; today, not yet practised, is `today`;
 * anything else, including future days, is `open`. Never a "missed" or "lost"
 * state: an ordinary gap reads as open, without judgment.
 */
export function streakWeek(view: Pick<StreakReadModel, 'status' | 'current' | 'lastActiveDate'>, today: string,
  practicedDates: ReadonlySet<string>, paused: ReadonlySet<number> = new Set()): StreakDay[] {
  const todayDay = toDay(today);
  const monday = isoWeekStart(todayDay);
  const alive = view.status !== 'none' && view.status !== 'resting' && view.current > 0;
  const practicedThisWeek = [...practicedDates].map(toDay).filter((day) => day >= monday && day <= todayDay).sort((a, b) => a - b);
  // A run older than this week covers every missed day since Monday; otherwise it starts at its first practised day here.
  const runStart = !alive ? Infinity : view.current > practicedThisWeek.length ? monday : practicedThisWeek[0] ?? todayDay;
  return Array.from({ length: 7 }, (_, offset) => {
    const day = monday + offset;
    const date = fromDay(day);
    const state: StreakDayState = practicedDates.has(date) && day <= todayDay ? 'practiced'
      : day === todayDay ? 'today'
        : day > todayDay ? 'open'
          : paused.has(day) ? 'paused'
            : alive && day > runStart ? 'rest' : 'open';
    return { date, state };
  });
}
