/*
 * S07.2 client API layer for the self-registered teen's personal wallet
 * (D.3, OD-3 Option B). Core is the only service called; every response is
 * shape-checked here so the surface never renders a state the server did
 * not return. Nothing in this file authorizes anything: Core admits by age
 * and the database re-checks every write. The transport is injected by the
 * routes wrapper, so this layer imports nothing outside the rebuild.
 *
 * Balances, history and goals use the SAME endpoints as a child in a family
 * (/tasks/wallet, /tasks/wallet/ledger, /tasks/goals): the teen's wallet is
 * the one a parent's family mechanics later layer onto.
 */
import type { Outcome, Session } from '../family/familyHubApi';

export type { Session, Transport, TransportResult } from '../family/familyHubApi';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

type Method = 'GET' | 'POST' | 'PATCH';

async function call<T>(path: string, session: Session, check: (data: unknown) => data is T, init: { method?: Method; body?: unknown } = {}): Promise<Outcome<T>> {
  if (!session.token) return { ok: false, code: 'UNAUTHORIZED' };
  const result = await session.transport(path, { token: session.token, method: init.method, body: init.body });
  if (result.error) return { ok: false, code: result.error.code };
  return check(result.data) ? { ok: true, data: result.data } : { ok: false, code: 'INVALID_RESPONSE' };
}

// ── Access ─────────────────────────────────────────────────────────────────

export type HolderKind = 'teen' | 'managed_child';
export interface WalletAccess { holder: HolderKind | null; familyChild: boolean }

export function fetchWalletAccess(session: Session) {
  return call('/wallet/access', session, (data): data is WalletAccess => isObject(data)
    && (data.holder === null || data.holder === 'teen' || data.holder === 'managed_child') && typeof data.familyChild === 'boolean');
}

// ── Balances, history, goals (the family wallet endpoints) ─────────────────

export type Bucket = 'save' | 'spend' | 'share';
const isBucket = (value: unknown): value is Bucket => value === 'save' || value === 'spend' || value === 'share';
export interface Balances { save: number; spend: number; share: number }

export function fetchBalances(session: Session) {
  return call('/tasks/wallet', session, (data): data is { balances: Balances } => {
    const b = isObject(data) ? data.balances : null;
    return isObject(b) && isInt(b.save) && isInt(b.spend) && isInt(b.share);
  });
}

export type LedgerReason = 'task_approved' | 'redemption' | 'manual_adjustment' | 'goal_withdrawal' | 'allowance' | 'savings_bonus'
  | 'self_income' | 'personal_reward' | 'goal_release';
export const LEDGER_REASONS: readonly LedgerReason[] = ['task_approved', 'redemption', 'manual_adjustment', 'goal_withdrawal', 'allowance', 'savings_bonus',
  'self_income', 'personal_reward', 'goal_release'];
export type IncomeSource = 'allowance' | 'gift' | 'earned';
export const INCOME_SOURCES: readonly IncomeSource[] = ['allowance', 'gift', 'earned'];

export interface WalletEntry {
  id: number;
  bucket: Bucket;
  amount: number;
  reason: LedgerReason;
  note: string | null;
  source: IncomeSource | null;
  rewardTitle: string | null;
  createdAt: string;
}

function isEntry(value: unknown): value is WalletEntry {
  if (!isObject(value)) return false;
  const e = value;
  const source = e.source ?? null;
  const rewardTitle = e.rewardTitle ?? null;
  return isInt(e.id) && isBucket(e.bucket) && isInt(e.amount) && LEDGER_REASONS.includes(e.reason as LedgerReason)
    && (e.note === null || typeof e.note === 'string') && (source === null || INCOME_SOURCES.includes(source as IncomeSource))
    && (rewardTitle === null || typeof rewardTitle === 'string') && isInstant(e.createdAt)
    // A Tutor movement must carry its reason; logged income must say where it came from.
    && ((e.reason !== 'manual_adjustment' && e.reason !== 'goal_withdrawal') || (typeof e.note === 'string' && e.note.length > 0))
    && (e.reason !== 'self_income' || source !== null);
}

export function fetchHistory(session: Session) {
  return call('/tasks/wallet/ledger', session, (data): data is { entries: WalletEntry[] } =>
    isObject(data) && Array.isArray(data.entries) && data.entries.every(isEntry)).then((outcome) => outcome.ok
    ? { ...outcome, data: { entries: outcome.data.entries.map((e) => ({ ...e, source: e.source ?? null, rewardTitle: e.rewardTitle ?? null })) } }
    : outcome);
}

export type GoalStatus = 'active' | 'reached' | 'archived';
export interface Goal { id: string; title: string; target: number; status: GoalStatus; saved: number }

function isGoal(value: unknown): value is Goal {
  return isObject(value) && isUuid(value.id) && typeof value.title === 'string' && isInt(value.target) && isInt(value.saved)
    && ['active', 'reached', 'archived'].includes(value.status as string);
}

export function fetchGoals(session: Session) {
  return call('/tasks/goals', session, (data): data is { goals: Goal[] } => isObject(data) && Array.isArray(data.goals) && data.goals.every(isGoal));
}

export function createGoal(input: { title: string; target: number }, session: Session) {
  return call('/tasks/goals', session, (data): data is { goal: Goal } => isObject(data) && isGoal(data.goal), { method: 'POST', body: input });
}

export function archiveGoal(goalId: string, session: Session) {
  return call(`/tasks/goals/${encodeURIComponent(goalId)}`, session,
    (data): data is { goal: Goal } => isObject(data) && isGoal(data.goal) && data.goal.status === 'archived', { method: 'PATCH', body: {} });
}

// ── The teen's own actions ─────────────────────────────────────────────────

export interface IncomeInput { source: IncomeSource; save: number; spend: number; share: number; goalId: string | null }

export function logIncome(input: IncomeInput, session: Session) {
  return call('/wallet/income', session, (data): data is { actionId: string; goal: Goal | null } =>
    isObject(data) && isUuid(data.actionId) && (data.goal === null || isGoal(data.goal)), { method: 'POST', body: input });
}

export interface PersonalReward { id: string; title: string; cost: number; status: 'active' | 'archived'; createdAt: string; archivedAt: string | null }

function isReward(value: unknown): value is PersonalReward {
  return isObject(value) && isUuid(value.id) && typeof value.title === 'string' && isInt(value.cost)
    && (value.status === 'active' || value.status === 'archived') && isInstant(value.createdAt)
    && (value.archivedAt === null || isInstant(value.archivedAt));
}

export function fetchRewards(session: Session) {
  return call('/wallet/rewards', session, (data): data is { rewards: PersonalReward[] } => isObject(data) && Array.isArray(data.rewards) && data.rewards.every(isReward));
}

export function createReward(input: { title: string; cost: number }, session: Session) {
  return call('/wallet/rewards', session, (data): data is { rewardId: string } => isObject(data) && isUuid(data.rewardId), { method: 'POST', body: input });
}

export function claimReward(rewardId: string, session: Session) {
  return call(`/wallet/rewards/${encodeURIComponent(rewardId)}/claim`, session,
    (data): data is { actionId: string } => isObject(data) && isUuid(data.actionId), { method: 'POST', body: {} });
}

export function archiveReward(rewardId: string, session: Session) {
  return call(`/wallet/rewards/${encodeURIComponent(rewardId)}/archive`, session,
    (data): data is { archived: boolean } => isObject(data) && typeof data.archived === 'boolean', { method: 'POST', body: {} });
}

export function releaseGoal(goalId: string, input: { amount: number; destination: 'save' | 'spend' }, session: Session) {
  return call(`/wallet/goals/${encodeURIComponent(goalId)}/release`, session,
    (data): data is { actionId: string } => isObject(data) && isUuid(data.actionId), { method: 'POST', body: input });
}

// ── Inviting a parent later ────────────────────────────────────────────────

export function createParentInvite(session: Session) {
  return call('/wallet/guardian-invite', session, (data): data is { token: string; expiresAt: string } =>
    isObject(data) && typeof data.token === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(data.token) && isInstant(data.expiresAt), { method: 'POST', body: {} });
}

export type ParentStatus = 'pending' | 'verified' | 'rejected' | 'revoked';
export interface ParentLink { linkId: string; displayName: string | null; status: ParentStatus; since: string; decidedAt: string | null; awaitingMe: boolean }

export function fetchParents(session: Session) {
  return call('/wallet/guardians', session, (data): data is { guardians: ParentLink[] } =>
    isObject(data) && Array.isArray(data.guardians) && data.guardians.every((g) => isObject(g) && isUuid(g.linkId)
      && (g.displayName === null || typeof g.displayName === 'string') && ['pending', 'verified', 'rejected', 'revoked'].includes(g.status as string)
      && isInstant(g.since) && (g.decidedAt === null || isInstant(g.decidedAt)) && typeof g.awaitingMe === 'boolean'));
}

export function decideParent(linkId: string, decision: 'confirm' | 'reject', session: Session) {
  const expected = decision === 'confirm' ? 'verified' : 'rejected';
  return call(`/wallet/guardians/${encodeURIComponent(linkId)}/decision`, session,
    (data): data is { linkId: string; status: 'verified' | 'rejected' } => isObject(data) && data.linkId === linkId && data.status === expected,
    { method: 'POST', body: { decision } });
}
