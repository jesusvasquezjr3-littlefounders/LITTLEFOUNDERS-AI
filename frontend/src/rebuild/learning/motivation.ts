import { z } from 'zod';

/*
 * B.21 / B.24 (S05.3e): the learner's side of the habit streak and their
 * autonomy levers.
 *
 *   GET /learn/rhythm?local_date   the streak as the model reads it today
 *                                  (practised today, open, paused, resting),
 *                                  the learner's pace and their Mentor.
 *   PUT /learn/pace                the learner's own daily plan (1, 2 or 3).
 *
 * Core decides everything. A malformed payload is unavailable, never partly
 * shown. Transport is injected, so this module imports nothing from the
 * legacy app (Bible 02 rule 23). The guardian's pause lives in
 * rebuild/family/streakPause.ts.
 */

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const streakViewSchema = z.object({
  model: z.literal('rest-days-v1'),
  status: z.enum(['none', 'practiced_today', 'open', 'paused', 'resting']),
  current: z.number().int().nonnegative(),
  best: z.number().int().nonnegative(),
  daysPracticed: z.number().int().nonnegative(),
  restDaysLeft: z.number().int().min(0).max(2),
  lastActiveDate: calendarDate.nullable(),
  pause: z.object({ startsOn: calendarDate, endsOn: calendarDate }).nullable(),
}).refine((view) => view.status !== 'resting' || view.current === 0, 'A resting streak has no live run');
export type StreakView = z.infer<typeof streakViewSchema>;

export const paceSchema = z.object({
  goal: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  chosen: z.boolean(),
  passedToday: z.number().int().nonnegative(),
  goalMet: z.boolean(),
});
export type Pace = z.infer<typeof paceSchema>;

export const MENTOR_NAMES = { rho: 'Dr. Rho', zara: 'Zara', liruf: 'Liruf', dina: 'Dina' } as const;
const rhythmSchema = z.object({
  streak: streakViewSchema,
  pace: paceSchema,
  mentor: z.object({ character: z.enum(['rho', 'zara', 'liruf', 'dina']), chosen: z.boolean() }),
  levers: z.array(z.string()),
});
export type Rhythm = z.infer<typeof rhythmSchema>;

export interface MotivationTransport {
  (path: string, init?: { method: 'GET' | 'PUT' | 'DELETE'; body?: unknown }): Promise<{ data: unknown; error: { code: string } | null }>;
}

async function call(request: MotivationTransport, path: string, init?: Parameters<MotivationTransport>[1]) {
  try {
    return await request(path, init);
  } catch {
    return { data: null, error: { code: 'NETWORK' } };
  }
}

/** The learner's local calendar date: a child's day follows their wall clock, as the streak does. */
export function localDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export type RhythmState = { status: 'loading' } | { status: 'ready'; rhythm: Rhythm } | { status: 'error' };

export async function fetchRhythm(request: MotivationTransport, today = localDate()): Promise<RhythmState> {
  const response = await call(request, `/learn/rhythm?local_date=${today}`);
  if (response.error) return { status: 'error' };
  const parsed = rhythmSchema.safeParse(response.data);
  return parsed.success ? { status: 'ready', rhythm: parsed.data } : { status: 'error' };
}

/** Saves the learner's own pace. Null when it could not be saved. */
export async function savePace(request: MotivationTransport, goal: 1 | 2 | 3, today = localDate()): Promise<Pace | null> {
  const response = await call(request, '/learn/pace', { method: 'PUT', body: { daily_lesson_goal: goal, local_date: today } });
  if (response.error) return null;
  const parsed = z.object({ pace: paceSchema }).safeParse(response.data);
  return parsed.success ? parsed.data.pace : null;
}
