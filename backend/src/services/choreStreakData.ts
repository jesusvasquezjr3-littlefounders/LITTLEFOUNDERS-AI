import { z } from 'zod';
import { evaluateStreak, lapseCounts, type StreakPause, type StreakState } from './choreStreak.js';
import { rpc } from './familyLifecycle.js';
import { serviceRest } from './supabaseRest.js';

/*
 * S07.3 (D.2): the facts the chore streak is computed from, read with the
 * service role, and the Tutor's holiday pauses. The database is the boundary
 * (chore_streak_rest_days migration): practised days come only from a chore
 * marked done, pauses only from a verified guardian within the bounds. This
 * file never writes a day.
 *
 * Every read degrades to null ("unreadable, refuse"), never to an empty
 * history: an unreadable history shown as "no streak" would tell a child
 * they lost something they did not lose.
 */

const UUID = z.string().uuid();
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const PAGE = 1000;
/** A hard ceiling for the staff metric's scan (rows, not families). */
export const METRIC_ROW_CEILING = 200_000;

const DayRow = z.object({ kid_user_id: UUID, local_date: Day, completions: z.number().int().min(0), legacy: z.boolean() });
const PauseRow = z.object({
  id: UUID,
  kid_user_id: UUID,
  starts_on: Day,
  ends_on: Day,
  created_by: UUID.nullable(),
  created_at: z.string(),
  cancelled_at: z.string().nullable(),
});
const BestRow = z.object({ kid_user_id: UUID, longest_streak_days: z.number().int().min(0) });

export type PauseRecord = z.infer<typeof PauseRow>;

function inFilter(ids: string[]): string {
  return `in.(${ids.map((id) => UUID.parse(id)).join(',')})`;
}

/** Every row of a filtered, ordered read, page by page. null = unreadable or over the ceiling. */
async function readAll<T>(path: string, row: z.ZodType<T>, ceiling = METRIC_ROW_CEILING): Promise<T[] | null> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const raw = await serviceRest<unknown>(`${path}&offset=${offset}&limit=${PAGE}`);
    const parsed = z.array(row).safeParse(raw);
    if (!parsed.success) return null;
    out.push(...parsed.data);
    if (out.length > ceiling) return null;
    if (parsed.data.length < PAGE) return out;
  }
}

export interface StreakFacts {
  practisedDays: string[];
  pauses: PauseRecord[];
  legacyBest: number;
}

/** Practised days, live and past pauses, and the legacy best for each child. */
export async function readStreakFacts(kidIds: string[]): Promise<Map<string, StreakFacts> | null> {
  const facts = new Map<string, StreakFacts>(kidIds.map((id) => [id, { practisedDays: [], pauses: [], legacyBest: 0 }]));
  if (kidIds.length === 0) return facts;
  const filter = inFilter(kidIds);
  const [days, pauses, bests] = await Promise.all([
    readAll(`/chore_streak_days?kid_user_id=${filter}&or=(completions.gt.0,legacy.is.true)&select=kid_user_id,local_date,completions,legacy&order=kid_user_id.asc,local_date.asc`, DayRow),
    readAll(`/chore_streak_pauses?kid_user_id=${filter}&select=id,kid_user_id,starts_on,ends_on,created_by,created_at,cancelled_at&order=kid_user_id.asc,starts_on.asc`, PauseRow),
    readAll(`/kid_task_streaks?kid_user_id=${filter}&select=kid_user_id,longest_streak_days&order=kid_user_id.asc`, BestRow),
  ]);
  if (days === null || pauses === null || bests === null) return null;
  for (const d of days) facts.get(d.kid_user_id)?.practisedDays.push(d.local_date);
  for (const p of pauses) facts.get(p.kid_user_id)?.pauses.push(p);
  for (const b of bests) {
    const entry = facts.get(b.kid_user_id);
    if (entry) entry.legacyBest = b.longest_streak_days;
  }
  return facts;
}

export function livePauses(pauses: readonly PauseRecord[]): StreakPause[] {
  return pauses.filter((p) => p.cancelled_at === null).map((p) => ({ startsOn: p.starts_on, endsOn: p.ends_on }));
}

export function streakFromFacts(facts: StreakFacts, today: string): StreakState {
  return evaluateStreak({ practisedDays: facts.practisedDays, pauses: livePauses(facts.pauses), today, legacyBest: facts.legacyBest }).state;
}

/** The streak of each child as of `today`. null = unreadable. */
export async function readStreakStates(kidIds: string[], today: string): Promise<Map<string, StreakState> | null> {
  const facts = await readStreakFacts(kidIds);
  if (!facts) return null;
  return new Map([...facts].map(([id, f]) => [id, streakFromFacts(f, today)]));
}

// ── The Tutor's holiday pause (verified guardian, enforced by the database) ─

export function pauseChoreStreak(input: { kidId: string; actorId: string; startsOn: string; endsOn: string }) {
  return rpc('guardian_pause_chore_streak', {
    p_kid: UUID.parse(input.kidId),
    p_actor: UUID.parse(input.actorId),
    p_starts_on: Day.parse(input.startsOn),
    p_ends_on: Day.parse(input.endsOn),
  }, UUID);
}

export function endChoreStreakPause(pauseId: string, actorId: string) {
  return rpc('guardian_end_chore_streak_pause', { p_pause: UUID.parse(pauseId), p_actor: UUID.parse(actorId) },
    z.enum(['cancelled', 'ended']));
}

export async function getPauseKid(pauseId: string): Promise<string | null | undefined> {
  const rows = z.array(z.object({ kid_user_id: UUID })).max(1).safeParse(
    await serviceRest<unknown>(`/chore_streak_pauses?id=eq.${encodeURIComponent(UUID.parse(pauseId))}&select=kid_user_id&limit=1`),
  );
  if (!rows.success) return undefined;
  return rows.data[0]?.kid_user_id ?? null;
}

// ── Appendix H: Chore Streak rest-day utilization (Diagnostic) ─────────────

/**
 * Over every child with a practised day in the window (their whole history
 * is read, because whether a run was alive depends on it): missed days that
 * a rest day covered versus missed days that ended a run, inside
 * [since, today). Counts only, never an identity. null = unreadable, or more
 * rows than the scan ceiling (reported as unavailable, never as a partial).
 */
export async function choreStreakRestDayUtilization(sinceDay: string, today: string) {
  const active = await readAll(
    `/chore_streak_days?local_date=gte.${Day.parse(sinceDay)}&completions=gt.0&select=kid_user_id&order=kid_user_id.asc`,
    z.object({ kid_user_id: UUID }),
  );
  if (active === null) return null;
  const kids = [...new Set(active.map((r) => r.kid_user_id))];
  let covered = 0;
  let ended = 0;
  for (let i = 0; i < kids.length; i += 100) {
    const facts = await readStreakFacts(kids.slice(i, i + 100));
    if (!facts) return null;
    for (const f of facts.values()) {
      const { lapses } = evaluateStreak({ practisedDays: f.practisedDays, pauses: livePauses(f.pauses), today, legacyBest: f.legacyBest });
      const counts = lapseCounts(lapses, sinceDay);
      covered += counts.covered;
      ended += counts.ended;
    }
  }
  return { children: kids.length, restDayCovered: covered, runsEnded: ended };
}
