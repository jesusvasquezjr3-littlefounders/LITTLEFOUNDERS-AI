/*
 * The lapse-tolerant chore streak (D.2), on the product's ONE streak model.
 *
 * D.2 mandates extending B.21's lapse-tolerant model to the Chore Streak
 * entity "so the two are not implemented as independent, potentially
 * conflicting efforts". The S07 lane and the S05 lane (B.21, habitStreak.ts)
 * were built in parallel and each wrote that model; at the S07 merge the
 * chore streak moved onto habitStreak.ts, the copy the learning streak's SQL
 * twin inside complete_lesson is pinned to by shared vectors. This module
 * keeps only what is chore-specific: the recorded chore days as input, the
 * legacy best as a floor, the child's local today, the lapse list for the
 * Appendix H rest-day metric and the OD-7 milestone check for a completion.
 * The rules themselves (Frontend Bible 02 §9.6) are habitStreak.ts's:
 *
 *   1. Two rest days a week are free and automatic: not earned, not bought.
 *   2. The best streak and the total days practised are permanent; a broken
 *      streak never erases them.
 *   3. A Tutor can pause the streak for a holiday: a paused day neither
 *      counts nor breaks the streak and uses no rest day.
 *   4. No loss or guilt framing: a broken streak is "resting", with the best
 *      streak still shown.
 *   5. Only 7, 30 and 100 celebrate (OD-7); an ordinary day never does.
 *
 * Days are the child's LOCAL calendar days (YYYY-MM-DD); a practised day has
 * at least one chore marked done (the database records it only from the
 * task itself; see the chore_streak_rest_days migration). Today is never a
 * miss. The streak number counts PRACTISED days in the current run, so a
 * pause or a rest day can never pad it toward a milestone (the same honesty
 * rule D.16 applies to goal progress).
 *
 * One behaviour changed at the merge: a run that restarts inside a week gets
 * that week's two rest days afresh (habitStreak.ts), where the lane's copy
 * carried the broken run's used rest days over. The sprint record's "S07
 * merge integration" section has the reasoning.
 *
 * The thresholds live in docs/operations/BLOCK-D-THRESHOLD-LOG.md and a test
 * pins these constants to it; choreStreak.test.ts pins them to habitStreak.ts.
 */

import { advanceHabitStreak, habitStreakLapses, pausedDays, readHabitStreak, type HabitStreakState } from './habitStreak.js';

// Literal on purpose: check-block-d-thresholds reads them from this file.
export const REST_DAYS_PER_WEEK = 2;
export const STREAK_MILESTONES = [7, 30, 100] as const;
export type StreakMilestone = `streak-${(typeof STREAK_MILESTONES)[number]}`;

export interface StreakPause {
  startsOn: string;
  endsOn: string;
}

export interface StreakInput {
  /** Practised local days, any order, duplicates ignored. */
  practisedDays: readonly string[];
  /** Live pauses (cancelled ones excluded by the caller). */
  pauses: readonly StreakPause[];
  /** The child's local today. */
  today: string;
  /** A best streak recorded before this model existed (the permanent floor). */
  legacyBest?: number;
}

export type StreakStatus = 'none' | 'practised_today' | 'alive' | 'resting';

export interface StreakState {
  status: StreakStatus;
  /** Practised days in the unbroken run; 0 when resting or never started. */
  current: number;
  best: number;
  totalDays: number;
  /** Rest days used this week while the streak was alive. */
  restDaysUsedThisWeek: number;
  restDaysLeftThisWeek: number;
  pausedToday: boolean;
  lastPractisedDay: string | null;
}

/** One missed day while a streak was alive: covered by a rest day, or where the run ended. */
export interface StreakLapse {
  day: string;
  covered: boolean;
}

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toEpochDay(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

function fromEpochDay(epochDay: number): string {
  return new Date(epochDay * DAY_MS).toISOString().slice(0, 10);
}

export function isStreakDay(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function evaluateStreak(input: StreakInput): { state: StreakState; lapses: StreakLapse[] } {
  if (!isStreakDay(input.today)) throw new RangeError('today must be YYYY-MM-DD');
  const practised = new Set<number>();
  for (const day of input.practisedDays) if (isStreakDay(day)) practised.add(toEpochDay(day));
  const paused = pausedDays(input.pauses.filter((pause) => isStreakDay(pause.startsOn) && isStreakDay(pause.endsOn)));

  const today = toEpochDay(input.today);
  const days = [...practised].sort((a, b) => a - b);
  const legacyBest = Math.max(0, Math.trunc(input.legacyBest ?? 0));
  // A practised day ahead of `today` (the child's clock is ahead of the
  // caller's) is treated as today: the walk ends on the later of the two.
  const end = fromEpochDay(days.length > 0 ? Math.max(today, days[days.length - 1]!) : today);

  let habit: HabitStreakState = { current: 0, best: 0, lastActiveDate: null, restDaysUsed: 0, daysPracticed: 0 };
  const lapses: StreakLapse[] = [];
  for (const epochDay of days) {
    const day = fromEpochDay(epochDay);
    lapses.push(...habitStreakLapses(habit, day, paused));
    habit = advanceHabitStreak(habit, day, paused).state;
  }
  lapses.push(...habitStreakLapses(habit, end, paused));

  const read = readHabitStreak(habit, end, paused);
  const alive = read.status === 'practiced_today' || read.status === 'open' || read.status === 'paused';
  const status: StreakStatus = read.status === 'practiced_today' ? 'practised_today' : alive ? 'alive' : days.length > 0 ? 'resting' : 'none';
  const restDaysLeft = alive ? read.restDaysLeft : REST_DAYS_PER_WEEK;
  return {
    state: {
      status,
      current: alive ? read.current : 0,
      best: Math.max(read.best, legacyBest),
      totalDays: habit.daysPracticed,
      restDaysUsedThisWeek: REST_DAYS_PER_WEEK - restDaysLeft,
      restDaysLeftThisWeek: restDaysLeft,
      pausedToday: paused.has(today),
      lastPractisedDay: days.length > 0 ? fromEpochDay(days[days.length - 1]!) : null,
    },
    lapses,
  };
}

/**
 * The OD-7 milestone a completion reached, if any: only when this completion
 * made `day` a practised day for the first time and the run it extended now
 * stands exactly at 7, 30 or 100. A second chore the same day never
 * celebrates again.
 */
export function milestoneReached(before: StreakState, after: StreakState, firstPractiseOfDay: boolean): StreakMilestone | null {
  if (!firstPractiseOfDay || after.current <= before.current) return null;
  return (STREAK_MILESTONES as readonly number[]).includes(after.current) ? (`streak-${after.current}` as StreakMilestone) : null;
}

/**
 * Resolves the local today a caller claims. A calendar day within one day of
 * the server's UTC day is accepted (every real time zone); anything else, or
 * nothing, falls back to the server's UTC day. The database applies the same
 * bound to the completion day itself.
 */
export function resolveLocalToday(claimed: unknown, now = new Date()): string {
  const serverDay = now.toISOString().slice(0, 10);
  if (typeof claimed !== 'string' || !isStreakDay(claimed)) return serverDay;
  return Math.abs(toEpochDay(claimed) - toEpochDay(serverDay)) <= 1 ? claimed : serverDay;
}

/** The server's UTC day shifted by `offset` days (pause bounds are enforced on the UTC day). */
export function utcDayOffset(offset: number, now = new Date()): string {
  return fromEpochDay(toEpochDay(now.toISOString().slice(0, 10)) + offset);
}

export function dayDifference(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** Appendix H "Chore Streak rest-day utilization": missed days covered by a rest day versus the ones that ended a run, inside [since, today). */
export function lapseCounts(lapses: readonly StreakLapse[], since: string): { covered: number; ended: number } {
  let covered = 0;
  let ended = 0;
  for (const lapse of lapses) {
    if (lapse.day < since) continue;
    if (lapse.covered) covered++;
    else ended++;
  }
  return { covered, ended };
}
