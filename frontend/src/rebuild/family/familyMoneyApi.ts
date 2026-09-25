import type { Outcome, Session } from './familyHubApi';

/*
 * S07.3 client API layer: D.2 (the lapse-tolerant chore streak and the
 * Tutor's holiday pause), D.10 (expected contribution versus bonus task) and
 * D.11 (the savings bonus framed by age). Core is the only service called;
 * every response is shape-checked so a surface never renders a state the
 * server did not return. Nothing here authorizes anything: Core and the
 * database are the boundary. The transport is injected (routes wrappers pass
 * the shared Core client), so this layer imports nothing outside the rebuild.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const isDay = (v: unknown): v is string => typeof v === 'string' && DAY.test(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

async function call<T>(path: string, session: Session, check: (data: unknown) => data is T, init: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown } = {}): Promise<Outcome<T>> {
  if (!session.token) return { ok: false, code: 'UNAUTHORIZED' };
  const result = await session.transport(path, { token: session.token, method: init.method, body: init.body });
  if (result.error) return { ok: false, code: result.error.code };
  return check(result.data) ? { ok: true, data: result.data } : { ok: false, code: 'INVALID_RESPONSE' };
}

/** The child's local calendar day (the streak's day follows their wall clock). */
export function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ── D.10: chores ────────────────────────────────────────────────────────────

export type ChoreKind = 'contribution' | 'bonus';
export const CONTRIBUTION_MAX_COINS = 2;
export const BONUS_MAX_COINS = 500;

export interface NewChore {
  assignedTo: string;
  title: string;
  kind: ChoreKind;
  rewardCoins: number;
  recurrence: 'once' | 'weekly';
  requiresEvidence: boolean;
}

export interface CreatedChore { id: string; title: string; kind: ChoreKind; rewardCoins: number; assignedTo: string }

export function isValidChore(input: NewChore): boolean {
  const coinsOk = input.kind === 'bonus'
    ? isInt(input.rewardCoins) && input.rewardCoins >= 1 && input.rewardCoins <= BONUS_MAX_COINS
    : isInt(input.rewardCoins) && input.rewardCoins >= 0 && input.rewardCoins <= CONTRIBUTION_MAX_COINS;
  const title = input.title.trim();
  return coinsOk && title.length >= 1 && title.length <= 120 && isUuid(input.assignedTo);
}

export function createChore(input: NewChore, session: Session) {
  return call('/tasks', session, (data): data is { task: CreatedChore } => {
    const t = (data as { task?: CreatedChore })?.task;
    return isObject(t) && isUuid(t.id) && t.kind === input.kind && t.rewardCoins === input.rewardCoins && t.assignedTo === input.assignedTo;
  }, { method: 'POST', body: { ...input, title: input.title.trim() } });
}

// ── D.2: the chore streak ───────────────────────────────────────────────────

export type StreakStatus = 'none' | 'practised_today' | 'alive' | 'resting';
export interface ChoreStreak {
  status: StreakStatus;
  current: number;
  best: number;
  totalDays: number;
  restDaysLeftThisWeek: number;
  restDaysPerWeek: number;
  pausedUntil: string | null;
  today: string;
}

export function isChoreStreak(value: unknown): value is ChoreStreak {
  const s = value as ChoreStreak;
  return isObject(value) && ['none', 'practised_today', 'alive', 'resting'].includes(s.status) && isInt(s.current) && isInt(s.best)
    && isInt(s.totalDays) && isInt(s.restDaysLeftThisWeek) && isInt(s.restDaysPerWeek) && (s.pausedUntil === null || isDay(s.pausedUntil)) && isDay(s.today)
    && s.current >= 0 && s.best >= s.current;
}

export type StreakMilestone = 'streak-7' | 'streak-30' | 'streak-100';
export const isStreakMilestone = (value: unknown): value is StreakMilestone => value === 'streak-7' || value === 'streak-30' || value === 'streak-100';

export function fetchOwnStreak(session: Session, today = localDay()) {
  return call(`/tasks/streak?today=${encodeURIComponent(today)}`, session,
    (data): data is { streak: ChoreStreak } => isChoreStreak((data as { streak?: unknown })?.streak));
}

export interface StreakPause { id: string; startsOn: string; endsOn: string; state: 'running' | 'upcoming' }

export function fetchKidStreak(kidId: string, session: Session, today = localDay()) {
  return call(`/tasks/${encodeURIComponent(kidId)}/streak?today=${encodeURIComponent(today)}`, session,
    (data): data is { streak: ChoreStreak; pauses: StreakPause[] } => isChoreStreak((data as { streak?: unknown })?.streak)
      && Array.isArray((data as { pauses?: unknown }).pauses)
      && (data as { pauses: StreakPause[] }).pauses.every((p) => isUuid(p.id) && isDay(p.startsOn) && isDay(p.endsOn) && (p.state === 'running' || p.state === 'upcoming')));
}

export const PAUSE_MAX_DAYS = 21;
export const PAUSE_MAX_BACKDATE_DAYS = 7;

export function pauseStreak(kidId: string, input: { startsOn: string; endsOn: string }, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/streak/pauses`, session,
    (data): data is { pauseId: string } => isUuid((data as { pauseId?: unknown })?.pauseId), { method: 'POST', body: input });
}

export function endPause(kidId: string, pauseId: string, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/streak/pauses/${encodeURIComponent(pauseId)}/end`, session,
    (data): data is { outcome: 'cancelled' | 'ended' } => ['cancelled', 'ended'].includes((data as { outcome?: string })?.outcome ?? ''), { method: 'POST', body: {} });
}

// ── D.11: the savings bonus ─────────────────────────────────────────────────

export type BonusFraming = 'per_ten' | 'percent';
export interface BonusRule { rateBp: number; active: boolean; nextRunAt: string; reframedFromRateBp?: number | null }

function isRule(value: unknown): value is BonusRule {
  const r = value as BonusRule;
  return isObject(value) && isInt(r.rateBp) && typeof r.active === 'boolean' && typeof r.nextRunAt === 'string'
    && (r.reframedFromRateBp === undefined || r.reframedFromRateBp === null || isInt(r.reframedFromRateBp));
}

interface FramingShape { framing: BonusFraming; perTen: { unit: number; coins: number } | null; maxRateBp: number | null }
function isFraming(value: unknown): value is FramingShape {
  const f = value as FramingShape;
  if (!isObject(value)) return false;
  if (f.framing === 'per_ten') return isObject(f.perTen) && isInt(f.perTen.unit) && isInt(f.perTen.coins) && f.maxRateBp === null;
  return f.framing === 'percent' && f.perTen === null && isInt(f.maxRateBp);
}

export type KidBonus = FramingShape & { rule: BonusRule | null };

export function fetchKidBonus(kidId: string, session: Session) {
  return call(`/banking/savings-bonus/${encodeURIComponent(kidId)}`, session,
    (data): data is KidBonus => isFraming(data) && ((data as KidBonus).rule === null || isRule((data as KidBonus).rule)));
}

export function saveKidBonus(kidId: string, input: { active: boolean; rateBp?: number }, session: Session) {
  return call(`/banking/savings-bonus/${encodeURIComponent(kidId)}`, session,
    (data): data is KidBonus => isFraming(data) && isRule((data as KidBonus).rule) && (data as KidBonus).rule!.active === input.active
      && (input.rateBp === undefined || (data as KidBonus).rule!.rateBp === input.rateBp),
    { method: 'PUT', body: input });
}

export type OwnBonus = FramingShape & {
  rule: { rateBp: number; active: boolean; nextRunAt: string } | null;
  saved: number;
  nextBonus: number;
  example: { shown: boolean; completed: boolean } | null;
};

export function fetchOwnBonus(session: Session) {
  return call('/banking/savings-bonus', session, (data): data is OwnBonus => {
    const d = data as OwnBonus;
    return isFraming(data) && (d.rule === null || isRule(d.rule)) && isInt(d.saved) && isInt(d.nextBonus) && d.nextBonus >= 0
      && (d.example === null || (isObject(d.example) && typeof d.example.shown === 'boolean' && typeof d.example.completed === 'boolean'));
  });
}

export function recordExampleShown(session: Session) {
  return call('/banking/savings-bonus/example', session, (data): data is { shown: true } => (data as { shown?: unknown })?.shown === true,
    { method: 'POST', body: { step: 'shown' } });
}

export function answerExample(input: { exampleSaved: number; answer: number }, session: Session) {
  return call('/banking/savings-bonus/example', session, (data): data is { correct: boolean } => typeof (data as { correct?: unknown })?.correct === 'boolean',
    { method: 'POST', body: { step: 'answered', ...input } });
}

/** The same arithmetic as the database's weekly credit, for previews only (the credit is never computed here). */
export function previewBonus(framing: BonusFraming, saved: number, rateBp: number): number {
  const balance = Math.max(0, Math.trunc(saved));
  return framing === 'per_ten' ? Math.floor(balance / 10) : Math.floor((balance * rateBp) / 10000);
}
