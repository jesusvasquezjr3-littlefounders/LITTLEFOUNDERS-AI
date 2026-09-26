import type { Outcome, Session } from './familyHubApi';

/*
 * S07.4 client API layer: D.13 (a recommended default split with an easy
 * override), D.14 (a real destination for the Share pocket), D.15 (the
 * next-goal prompt at the celebration) and D.16 (goal progress by
 * provenance). Core is the only service called; every response is
 * shape-checked so a surface never renders a state the server did not
 * return. Nothing here authorizes anything: Core and the database are the
 * boundary. The transport is injected by the route wrappers.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isCount = (v: unknown): v is number => isInt(v) && v >= 0;
const isInstant = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

async function call<T>(path: string, session: Session, check: (data: unknown) => data is T, init: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH'; body?: unknown } = {}): Promise<Outcome<T>> {
  if (!session.token) return { ok: false, code: 'UNAUTHORIZED' };
  const result = await session.transport(path, { token: session.token, method: init.method, body: init.body });
  if (result.error) return { ok: false, code: result.error.code };
  return check(result.data) ? { ok: true, data: result.data } : { ok: false, code: 'INVALID_RESPONSE' };
}

// ── D.13: the usual split ───────────────────────────────────────────────────

export type Bucket = 'save' | 'spend' | 'share';
export const BUCKETS: readonly Bucket[] = ['save', 'spend', 'share'];
export interface Split { save: number; spend: number; share: number }
export interface UsualSplit { usual: Split; custom: boolean; recommended: Split }

const isPercentSplit = (v: unknown): v is Split => isObject(v) && BUCKETS.every((b) => isCount(v[b]) && (v[b] as number) <= 100)
  && (v.save as number) + (v.spend as number) + (v.share as number) === 100;
const isUsualSplit = (v: unknown): v is UsualSplit => isObject(v) && isPercentSplit(v.usual) && typeof v.custom === 'boolean' && isPercentSplit(v.recommended);

/**
 * Whole coins for an amount under a ratio, exactly as the database's
 * wallet_split_coins() records the default: each pocket gets the floor of its
 * share, and the one or two coins left go to the largest remainders (ties:
 * Save, Spend, Share). Pinned to database/scripts/fixtures/split-coins.json.
 */
export function splitCoins(amount: number, pct: Split): Split {
  const parts = BUCKETS.map((b, ord) => ({ ord, base: Math.floor((amount * pct[b]) / 100), rem: (amount * pct[b]) % 100 }));
  const left = amount - parts.reduce((sum, p) => sum + p.base, 0);
  const extra = new Set([...parts].sort((a, b) => b.rem - a.rem || a.ord - b.ord).slice(0, left).map((p) => p.ord));
  const coins = parts.map((p) => p.base + (extra.has(p.ord) ? 1 : 0));
  return { save: coins[0]!, spend: coins[1]!, share: coins[2]! };
}

export const sameSplit = (a: Split, b: Split) => a.save === b.save && a.spend === b.spend && a.share === b.share;

export function fetchUsualSplit(session: Session) {
  return call('/tasks/wallet/split', session, isUsualSplit);
}

export function fetchKidUsualSplit(kidId: string, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/wallet/split`, session, isUsualSplit);
}

export function saveUsualSplit(split: Split, session: Session) {
  return call('/tasks/wallet/split', session, (data): data is UsualSplit => isUsualSplit(data) && sameSplit((data as UsualSplit).usual, split),
    { method: 'PUT', body: split });
}

/** A chore reward split. `goal` is the goal as the database now has it (reached in the same transaction when covered). */
export function allocateTask(taskId: string, split: Split, goalId: string | null, session: Session) {
  return call(`/tasks/${encodeURIComponent(taskId)}/allocate`, session,
    (data): data is { allocated: true; goal: HabitGoal | null } => isObject(data) && data.allocated === true && (data.goal === null || data.goal === undefined || isHabitGoal(data.goal)),
    { method: 'POST', body: { ...split, goalId } });
}

/** An allowance payout split; its Save part may go to a goal too. */
export function allocateCredit(creditId: string, split: Split, goalId: string | null, session: Session) {
  return call(`/banking/wallet/pending-credits/${encodeURIComponent(creditId)}/allocate`, session,
    (data): data is { allocated: true } => isObject(data) && data.allocated === true, { method: 'POST', body: { ...split, goalId } });
}

// ── D.16 / D.15: goals with provenance and their next step ───────────────────

export interface GoalProgressParts { own: number; bonus: number; family: number; total: number }
export type NextStepState = 'pending' | 'prompted' | 'set' | 'declined';
export interface HabitGoal {
  id: string;
  title: string;
  target: number;
  icon: string;
  status: 'active' | 'reached' | 'archived';
  reachedAt: string | null;
  followsGoalId: string | null;
  saved: number;
  progress: GoalProgressParts;
  nextStep: { state: NextStepState; nextGoalId: string | null } | null;
}

export function isProgress(v: unknown): v is GoalProgressParts {
  return isObject(v) && isCount(v.own) && isCount(v.bonus) && isCount(v.family) && isCount(v.total)
    && (v.own as number) + (v.bonus as number) + (v.family as number) === v.total;
}

export function isHabitGoal(v: unknown): v is HabitGoal {
  if (!isObject(v)) return false;
  const step = v.nextStep;
  return isUuid(v.id) && typeof v.title === 'string' && isInt(v.target) && typeof v.icon === 'string' && ['active', 'reached', 'archived'].includes(v.status as string)
    && (v.reachedAt === null || isInstant(v.reachedAt)) && (v.followsGoalId === null || isUuid(v.followsGoalId))
    && isProgress(v.progress) && v.saved === (v.progress as GoalProgressParts).total
    && (step === null || (isObject(step) && ['pending', 'prompted', 'set', 'declined'].includes(step.state as string) && (step.nextGoalId === null || isUuid(step.nextGoalId))));
}

const isGoalList = (data: unknown): data is { goals: HabitGoal[] } => isObject(data) && Array.isArray(data.goals) && data.goals.every(isHabitGoal);

export function fetchHabitGoals(session: Session) {
  return call('/tasks/goals', session, isGoalList);
}

export function fetchKidHabitGoals(kidId: string, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/goals`, session, isGoalList);
}

export const GOAL_TITLE_MAX = 80;
export const GOAL_TARGET_MAX = 100000;

export function createHabitGoal(input: { title: string; target: number; followsGoalId: string | null }, session: Session) {
  return call('/tasks/goals', session, (data): data is { goal: HabitGoal } => isObject(data) && isHabitGoal(data.goal)
    && (data.goal as HabitGoal).followsGoalId === input.followsGoalId, { method: 'POST', body: { title: input.title.trim(), target: input.target, followsGoalId: input.followsGoalId } });
}

export function archiveHabitGoal(goalId: string, session: Session) {
  return call(`/tasks/goals/${encodeURIComponent(goalId)}`, session, (data): data is { goal: HabitGoal } => isObject(data) && isHabitGoal(data.goal)
    && (data.goal as HabitGoal).status === 'archived', { method: 'PATCH', body: {} });
}

export function markNextStepSeen(goalId: string, session: Session) {
  return call(`/tasks/goals/${encodeURIComponent(goalId)}/next-step/seen`, session,
    (data): data is { celebrate: boolean } => isObject(data) && typeof data.celebrate === 'boolean', { method: 'POST', body: {} });
}

export function declineNextStep(goalId: string, session: Session) {
  return call(`/tasks/goals/${encodeURIComponent(goalId)}/next-step/decline`, session,
    (data): data is { declined: boolean } => isObject(data) && typeof data.declined === 'boolean', { method: 'POST', body: {} });
}

/** A reached goal whose "what's your next goal?" is still due (D.15). */
export const nextStepDue = (g: HabitGoal) => g.status === 'reached' && g.nextStep !== null && (g.nextStep.state === 'pending' || g.nextStep.state === 'prompted');

// ── D.14: the Share destination ──────────────────────────────────────────────

export type DestinationKind = 'charity' | 'gift' | 'community';
export const DESTINATION_KINDS: readonly DestinationKind[] = ['charity', 'gift', 'community'];
export interface Destination { id: string; title: string; kind: DestinationKind; chosenBy: 'tutor' | 'holder'; status: 'active' | 'archived'; createdAt: string }
export type GiftStatus = 'pledged' | 'given' | 'returned';
export interface Gift {
  id: string; destinationId: string; amount: number; status: GiftStatus; pledgedAt: string; settledAt: string | null;
  settledBy: 'holder' | 'tutor' | null; note: string | null;
}
export interface ShareView { destinations: Destination[]; gifts: Gift[] }

const isDestination = (v: unknown): v is Destination => isObject(v) && isUuid(v.id) && typeof v.title === 'string' && DESTINATION_KINDS.includes(v.kind as DestinationKind)
  && (v.chosenBy === 'tutor' || v.chosenBy === 'holder') && (v.status === 'active' || v.status === 'archived') && isInstant(v.createdAt);
const isGift = (v: unknown): v is Gift => isObject(v) && isUuid(v.id) && isUuid(v.destinationId) && isInt(v.amount) && (v.amount as number) >= 1
  && ['pledged', 'given', 'returned'].includes(v.status as string) && isInstant(v.pledgedAt) && (v.settledAt === null || isInstant(v.settledAt))
  && (v.settledBy === null || v.settledBy === 'holder' || v.settledBy === 'tutor') && (v.note === null || typeof v.note === 'string')
  && (v.status === 'pledged') === (v.settledAt === null) && (v.status !== 'given' || typeof v.note === 'string');
const isShareView = (data: unknown): data is ShareView => isObject(data) && Array.isArray(data.destinations) && data.destinations.every(isDestination)
  && Array.isArray(data.gifts) && data.gifts.every(isGift);

export const DESTINATION_TITLE_MAX = 60;
export const GIFT_NOTE_MAX = 240;
export const GIFT_MAX_COINS = 1000;

export function fetchShare(session: Session) { return call('/tasks/share', session, isShareView); }
export function fetchKidShare(kidId: string, session: Session) { return call(`/tasks/${encodeURIComponent(kidId)}/share`, session, isShareView); }

export function pledgeGift(destinationId: string, amount: number, session: Session) {
  return call('/tasks/share/gifts', session, (data): data is { giftId: string } => isObject(data) && isUuid(data.giftId), { method: 'POST', body: { destinationId, amount } });
}

const isOutcome = (expected: 'given' | 'returned') => (data: unknown): data is { outcome: 'given' | 'returned' } => isObject(data) && data.outcome === expected;

/** The holder takes a pledge back, or (a teen, own destination) records what happened. */
export function settleOwnGift(giftId: string, outcome: 'given' | 'returned', note: string | null, session: Session) {
  return call(`/tasks/share/gifts/${encodeURIComponent(giftId)}/settle`, session, isOutcome(outcome), { method: 'POST', body: { outcome, note: note?.trim() || null } });
}

export function settleKidGift(kidId: string, giftId: string, outcome: 'given' | 'returned', note: string, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/share/gifts/${encodeURIComponent(giftId)}/settle`, session, isOutcome(outcome),
    { method: 'POST', body: { outcome, note: note.trim() } });
}

const isCreated = (data: unknown): data is { destinationId: string } => isObject(data) && isUuid(data.destinationId);

export function createOwnDestination(input: { title: string; kind: DestinationKind }, session: Session) {
  return call('/tasks/share/destinations', session, isCreated, { method: 'POST', body: { title: input.title.trim(), kind: input.kind } });
}

export function createKidDestination(kidId: string, input: { title: string; kind: DestinationKind }, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/share/destinations`, session, isCreated, { method: 'POST', body: { title: input.title.trim(), kind: input.kind } });
}

const isArchived = (data: unknown): data is { archived: boolean } => isObject(data) && typeof data.archived === 'boolean';

export function archiveOwnDestination(destinationId: string, session: Session) {
  return call(`/tasks/share/destinations/${encodeURIComponent(destinationId)}/archive`, session, isArchived, { method: 'POST', body: {} });
}

export function archiveKidDestination(kidId: string, destinationId: string, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/share/destinations/${encodeURIComponent(destinationId)}/archive`, session, isArchived, { method: 'POST', body: {} });
}
