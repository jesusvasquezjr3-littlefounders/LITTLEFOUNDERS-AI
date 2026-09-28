import { Router } from 'express';
import { z } from 'zod';
import { fail, ok } from '../lib/http.js';
import { authedUser } from '../middleware/auth.js';
import { AUTONOMY_LEVERS, PACE_GOALS, paceStatus } from '../services/autonomy.js';
import { habitStateFromStats, pausedDays, readHabitStreak, streakWeek, type StreakDay, type StreakReadModel } from '../services/habitStreak.js';
import { isCalendarDate } from '../services/streak.js';
import { getHabitStreakRow, getPacePreference, getPracticeDays, getStreakPauses, upsertPacePreference, type StreakPauseRow } from '../services/supabaseRest.js';
import { getTutorPreferences } from '../services/tutorData.js';

/*
 * /api/v1/learn/rhythm and /api/v1/learn/pace (S05.3e). Mounted inside
 * learnRouter, behind its requireAuth + requireAgeScreen. Only ever the
 * caller's own data: there is no id in any path.
 *
 * B.21 — the learner's habit streak as the model reads it today (practised
 *        today, open, paused, resting), with the best streak, the days
 *        practised and the rest days left this week. A read never rewrites
 *        the stored streak (OD-9).
 * B.24 — the learner's three autonomy levers: path (the course path's
 *        frontier, B.6), Mentor (the character they chose) and pace (their
 *        own daily plan, which only they can set; a guardian cannot).
 */

const DATA_UNAVAILABLE = 'DATA_UNAVAILABLE';
const LocalDate = z.string().refine(isCalendarDate, 'local_date must be YYYY-MM-DD');
const RhythmQuery = z.object({ local_date: LocalDate.optional() }).strict();
const PaceBody = z.object({ daily_lesson_goal: z.union([z.literal(1), z.literal(2), z.literal(3)]), local_date: LocalDate.optional() }).strict();

const EPOCH = new Date(0).toISOString();
const serverToday = () => new Date().toISOString().slice(0, 10);

export interface StreakView extends StreakReadModel {
  /** The open or upcoming holiday pause a verified guardian set, if any. */
  pause: { startsOn: string; endsOn: string } | null;
  /** GAP-FIX-R1 (Bible 04 §4.3): the current week's seven days, Monday first, in the learner's calendar. */
  week: StreakDay[];
}

/** The Monday of `today`'s ISO week as YYYY-MM-DD. */
function mondayOf(today: string): string {
  const date = new Date(`${today}T00:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - weekday * 86_400_000).toISOString().slice(0, 10);
}

/** The streak as it reads on `today`, with the pause that matters now. Shared with the guardian's route. */
export async function loadStreakView(userId: string, today: string): Promise<StreakView | null> {
  const row = await getHabitStreakRow(userId);
  if (!row) return null;
  const state = habitStateFromStats(row);
  const monday = mondayOf(today);
  const from = state.lastActiveDate && state.lastActiveDate < monday ? state.lastActiveDate : monday;
  const [pauses, practiced] = await Promise.all([getStreakPauses(userId, from), getPracticeDays(userId, monday, today)]);
  if (!pauses || !practiced) return null;
  const paused = pausedDays(pauses.map((p) => ({ startsOn: p.starts_on, endsOn: p.ends_on })));
  const view = readHabitStreak(state, today, paused);
  const current = pauses.find((p: StreakPauseRow) => p.ends_on >= today) ?? null;
  // The stats' own last day always counts, even before 0208 recorded it.
  const days = new Set(practiced);
  if (state.lastActiveDate && state.lastActiveDate >= monday && state.lastActiveDate <= today) days.add(state.lastActiveDate);
  return { ...view, pause: current ? { startsOn: current.starts_on, endsOn: current.ends_on } : null, week: streakWeek(view, today, days, paused) };
}

export function learnMotivationRouter(): Router {
  const router = Router();

  router.get('/rhythm', async (req, res) => {
    const query = RhythmQuery.safeParse(req.query);
    if (!query.success) return fail(res, 400, 'VALIDATION_ERROR', 'local_date must be YYYY-MM-DD');
    const user = authedUser(res);
    const today = query.data.local_date ?? serverToday();
    const [streak, row, pace, mentor] = await Promise.all([
      loadStreakView(user.id, today), getHabitStreakRow(user.id), getPacePreference(user.id), getTutorPreferences(user.id),
    ]);
    if (!streak || !row || pace === undefined || !mentor) return fail(res, 502, DATA_UNAVAILABLE, 'Could not load your rhythm');
    const passedToday = row.last_active_date === today ? row.day_lessons_passed : 0;
    return ok(res, {
      streak,
      pace: paceStatus(pace, passedToday),
      mentor: { character: mentor.character, chosen: mentor.updated_at !== EPOCH },
      levers: AUTONOMY_LEVERS,
    });
  });

  router.put('/pace', async (req, res) => {
    const body = PaceBody.safeParse(req.body);
    if (!body.success || Object.keys(req.query).length > 0) {
      return fail(res, 400, 'VALIDATION_ERROR', `daily_lesson_goal must be one of ${PACE_GOALS.join(', ')}`);
    }
    const user = authedUser(res);
    const saved = await upsertPacePreference(user.id, body.data.daily_lesson_goal);
    if (!saved) return fail(res, 502, DATA_UNAVAILABLE, 'Could not save your pace');
    const row = await getHabitStreakRow(user.id);
    const today = body.data.local_date ?? serverToday();
    return ok(res, { pace: paceStatus({ daily_lesson_goal: body.data.daily_lesson_goal }, row && row.last_active_date === today ? row.day_lessons_passed : 0) });
  });

  return router;
}
