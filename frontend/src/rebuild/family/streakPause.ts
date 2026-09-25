import { streakViewSchema, type StreakView } from '../learning/motivation';

/*
 * B.21 (S05.3e) — the verified parent's holiday pause (Frontend Bible 02 §9.6
 * rule 3), the client of /api/v1/family/learning/kids/:kidId/streak and
 * /streak-pause. Core is the enforcing boundary: a parent role, a current
 * verified adult identity and a verified link to this child on every request,
 * then the database function checks the link and the range again. This module
 * validates shapes and maps refusals; it authorizes nothing (Bible 02 rule 23:
 * transport is injected).
 */

export const MAX_PAUSE_DAYS = 21;

export interface StreakPauseTransport {
  (path: string, init?: { method: 'GET' | 'PUT' | 'DELETE'; body?: unknown }): Promise<{ data: unknown; error: { code: string } | null }>;
}

async function call(request: StreakPauseTransport, path: string, init?: Parameters<StreakPauseTransport>[1]) {
  try {
    return await request(path, init);
  } catch {
    return { data: null, error: { code: 'NETWORK' } };
  }
}

const ACCESS_LOST = new Set(['PARENT_VERIFICATION_REQUIRED', 'FORBIDDEN', 'NOT_FOUND', 'UNAUTHORIZED']);

export type KidStreakState = { status: 'loading' } | { status: 'ready'; streak: StreakView } | { status: 'no-access' } | { status: 'error' };
export type PauseOutcome = { status: 'saved' | 'ended'; streak: StreakView } | { status: 'invalid' | 'no-access' | 'failed' };

const base = (kidId: string) => `/family/learning/kids/${encodeURIComponent(kidId)}`;

function parseStreak(data: unknown): StreakView | null {
  const streak = (data as { streak?: unknown } | null)?.streak;
  const parsed = streakViewSchema.safeParse(streak);
  return parsed.success ? parsed.data : null;
}

export async function fetchKidStreak(request: StreakPauseTransport, kidId: string, today: string): Promise<KidStreakState> {
  const response = await call(request, `${base(kidId)}/streak?local_date=${today}`);
  if (response.error) return ACCESS_LOST.has(response.error.code) ? { status: 'no-access' } : { status: 'error' };
  const streak = parseStreak(response.data);
  return streak ? { status: 'ready', streak } : { status: 'error' };
}

export async function setKidStreakPause(request: StreakPauseTransport, kidId: string, startsOn: string, endsOn: string, today: string): Promise<PauseOutcome> {
  const response = await call(request, `${base(kidId)}/streak-pause`, { method: 'PUT', body: { starts_on: startsOn, ends_on: endsOn, local_date: today } });
  if (response.error) {
    if (response.error.code === 'STREAK_PAUSE_INVALID' || response.error.code === 'VALIDATION_ERROR') return { status: 'invalid' };
    return ACCESS_LOST.has(response.error.code) ? { status: 'no-access' } : { status: 'failed' };
  }
  const streak = parseStreak(response.data);
  return streak ? { status: 'saved', streak } : { status: 'failed' };
}

export async function endKidStreakPause(request: StreakPauseTransport, kidId: string, today: string): Promise<PauseOutcome> {
  const response = await call(request, `${base(kidId)}/streak-pause?local_date=${today}`, { method: 'DELETE' });
  if (response.error) return ACCESS_LOST.has(response.error.code) ? { status: 'no-access' } : { status: 'failed' };
  const streak = parseStreak(response.data);
  return streak ? { status: 'ended', streak } : { status: 'failed' };
}

/** The same range rule Core and the database enforce, checked before sending so the form can say why. */
export function pauseRangeValid(startsOn: string, endsOn: string, today: string): boolean {
  const day = (value: string) => Math.round(Date.parse(`${value}T00:00:00Z`) / 86_400_000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return false;
  const [start, end, now] = [day(startsOn), day(endsOn), day(today)];
  return Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start + 1 <= MAX_PAUSE_DAYS
    && start >= now - 7 && start <= now + 60;
}
