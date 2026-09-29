
/*
 * S07.1 client API layer for the Family Hub lifecycle flows (D.5 / OD-21).
 * Core is the only service called; every response is shape-checked here so a
 * surface never renders a state the server did not actually return. Nothing
 * in this file authorizes anything: Core and the database are the boundary.
 * The transport is injected by the caller (the routes wrappers pass the
 * shared Core client), so this layer imports nothing outside the rebuild.
 */

import { isProgress, type GoalProgressParts } from './moneyHabitsApi';

export type TransportResult = { data: unknown; error: null } | { data: null; error: { code: string } };
export type Transport = (path: string, options: { token: string; method?: 'GET' | 'POST' | 'PATCH' | 'PUT'; body?: unknown }) => Promise<TransportResult>;
export interface Session { token: string | null; transport: Transport }

export type Outcome<T> = { ok: true; data: T } | { ok: false; code: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

async function call<T>(path: string, session: Session, check: (data: unknown) => data is T, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<Outcome<T>> {
  if (!session.token) return { ok: false, code: 'UNAUTHORIZED' };
  const result = await session.transport(path, { token: session.token, method: init.method, body: init.body });
  if (result.error) return { ok: false, code: result.error.code };
  return check(result.data) ? { ok: true, data: result.data } : { ok: false, code: 'INVALID_RESPONSE' };
}

// ── Guardian links ─────────────────────────────────────────────────────────

export type LinkStatus = 'pending' | 'verified' | 'rejected' | 'revoked';
const LINK_STATUSES: readonly LinkStatus[] = ['pending', 'verified', 'rejected', 'revoked'];
const isLinkStatus = (value: unknown): value is LinkStatus => LINK_STATUSES.includes(value as LinkStatus);

export interface CoGuardian {
  linkId: string;
  displayName: string | null;
  status: LinkStatus;
  isMe: boolean;
  since: string;
  decidedAt: string | null;
  revokedAt: string | null;
}

function isCoGuardian(value: unknown): value is CoGuardian {
  const g = value as CoGuardian;
  return typeof value === 'object' && value !== null && isUuid(g.linkId) && isNullableString(g.displayName) && isLinkStatus(g.status)
    && typeof g.isMe === 'boolean' && isInstant(g.since) && (g.decidedAt === null || isInstant(g.decidedAt)) && (g.revokedAt === null || isInstant(g.revokedAt));
}

export function fetchCoGuardians(kidId: string, session: Session) {
  return call(`/family/kids/${encodeURIComponent(kidId)}/guardians`, session,
    (data): data is { guardians: CoGuardian[] } => Array.isArray((data as { guardians?: unknown })?.guardians) && (data as { guardians: unknown[] }).guardians.every(isCoGuardian));
}

export function decideCoGuardian(kidId: string, linkId: string, decision: 'confirm' | 'reject', session: Session) {
  const expected = decision === 'confirm' ? 'verified' : 'rejected';
  return call(`/family/kids/${encodeURIComponent(kidId)}/guardians/${encodeURIComponent(linkId)}/decision`, session,
    (data): data is { linkId: string; status: 'verified' | 'rejected' } => (data as { linkId?: unknown })?.linkId === linkId && (data as { status?: unknown }).status === expected,
    { method: 'POST', body: { decision } });
}

export function leaveChild(kidId: string, session: Session) {
  return call(`/family/kids/${encodeURIComponent(kidId)}/guardians/leave`, session,
    (data): data is { status: 'revoked' } => (data as { status?: unknown })?.status === 'revoked', { method: 'POST', body: {} });
}

/** S07.2: `awaiting` says who confirms a pending adult: the child's Tutor, or the teen who issued the invite. */
export interface OwnLink { linkId: string; kidDisplayName: string | null; status: Exclude<LinkStatus, 'verified'>; awaiting?: 'tutor' | 'account_holder' | null; updatedAt: string }

export function fetchOwnLinks(session: Session) {
  return call('/family/guardian-links/mine', session,
    (data): data is { links: OwnLink[] } => Array.isArray((data as { links?: unknown })?.links) && (data as { links: OwnLink[] }).links.every((l) =>
      isUuid(l.linkId) && isNullableString(l.kidDisplayName) && ['pending', 'rejected', 'revoked'].includes(l.status) && isInstant(l.updatedAt)
      && (l.awaiting === undefined || l.awaiting === null || l.awaiting === 'tutor' || l.awaiting === 'account_holder')));
}

// ── Guardian money actions and reward delivery ────────────────────────────

export type Bucket = 'save' | 'spend' | 'share';
const isBucket = (value: unknown): value is Bucket => value === 'save' || value === 'spend' || value === 'share';

export interface GuardianAction {
  id: string;
  kind: 'manual_adjustment' | 'goal_withdrawal';
  bucket: Bucket;
  goalId: string | null;
  amount: number;
  reason: string;
  byMe: boolean;
  createdAt: string;
}

export function fetchGuardianActions(kidId: string, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/wallet/guardian-actions`, session,
    (data): data is { actions: GuardianAction[] } => Array.isArray((data as { actions?: unknown })?.actions) && (data as { actions: GuardianAction[] }).actions.every((a) =>
      isUuid(a.id) && (a.kind === 'manual_adjustment' || a.kind === 'goal_withdrawal') && isBucket(a.bucket) && (a.goalId === null || isUuid(a.goalId))
      && isInt(a.amount) && typeof a.reason === 'string' && typeof a.byMe === 'boolean' && isInstant(a.createdAt)));
}

export function postWalletAdjustment(kidId: string, input: { bucket: Bucket; amount: number; reason: string }, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/wallet/adjustments`, session,
    (data): data is { actionId: string } => isUuid((data as { actionId?: unknown })?.actionId), { method: 'POST', body: input });
}

/** S07.4 (D.16): a goal always arrives with its provenance; one without it is refused, never shown as a mixed number. */
export interface KidGoal { id: string; title: string; target: number; status: 'active' | 'reached' | 'archived'; saved: number; progress: GoalProgressParts }

function isGoal(value: unknown): value is KidGoal {
  const g = value as KidGoal;
  return typeof value === 'object' && value !== null && isUuid(g.id) && typeof g.title === 'string' && isInt(g.target) && isInt(g.saved)
    && ['active', 'reached', 'archived'].includes(g.status) && isProgress(g.progress) && g.progress.total === g.saved;
}

export function fetchKidGoals(kidId: string, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/goals`, session,
    (data): data is { goals: KidGoal[] } => Array.isArray((data as { goals?: unknown })?.goals) && (data as { goals: unknown[] }).goals.every(isGoal));
}

export function postGoalWithdrawal(kidId: string, goalId: string, input: { amount: number; destination: 'spend' | 'save'; reason: string }, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/goals/${encodeURIComponent(goalId)}/withdrawals`, session,
    (data): data is { actionId: string; goal: KidGoal } => isUuid((data as { actionId?: unknown })?.actionId) && isGoal((data as { goal?: unknown }).goal),
    { method: 'POST', body: input });
}

export type RedemptionStatus = 'requested' | 'approved' | 'denied' | 'fulfilled';
export interface Redemption { id: string; catalogId: string; status: RedemptionStatus; createdAt: string; decidedAt: string | null; fulfilledAt: string | null }

function isRedemption(value: unknown): value is Redemption {
  const r = value as Redemption;
  return typeof value === 'object' && value !== null && isUuid(r.id) && isUuid(r.catalogId)
    && ['requested', 'approved', 'denied', 'fulfilled'].includes(r.status) && isInstant(r.createdAt)
    && (r.decidedAt === null || isInstant(r.decidedAt)) && (r.fulfilledAt === null || isInstant(r.fulfilledAt));
}

export function fetchKidRedemptions(kidId: string, session: Session) {
  return call(`/tasks/redemptions?kidId=${encodeURIComponent(kidId)}`, session,
    (data): data is { redemptions: Redemption[] } => Array.isArray((data as { redemptions?: unknown })?.redemptions) && (data as { redemptions: unknown[] }).redemptions.every(isRedemption));
}

export interface CatalogTitle { id: string; title: string }
const isCatalog = (data: unknown): data is { items: CatalogTitle[] } =>
  Array.isArray((data as { items?: unknown })?.items) && (data as { items: CatalogTitle[] }).items.every((i) => isUuid(i.id) && typeof i.title === 'string');

/** The caller's own catalog (a co-guardian's reward titles fall back to a generic label). */
export function fetchOwnCatalog(session: Session) {
  return call('/tasks/catalog', session, isCatalog);
}

export function fulfillRedemption(redemptionId: string, session: Session) {
  return call(`/tasks/redemptions/${encodeURIComponent(redemptionId)}/fulfill`, session,
    (data): data is { fulfilled: true } => (data as { fulfilled?: unknown })?.fulfilled === true, { method: 'POST', body: {} });
}

// ── The child's own history ──────────────────────────────────────────────

// S07.2: a teen who linked a parent keeps their own entries (logged income,
// a personal reward, coins moved out of their own goal) on the same history.
// S07.4 (D.14): coins directed to a Share destination, and a pledge that came back.
export type LedgerReason = 'task_approved' | 'redemption' | 'manual_adjustment' | 'goal_withdrawal' | 'allowance' | 'savings_bonus'
  | 'self_income' | 'personal_reward' | 'goal_release' | 'share_gift' | 'share_gift_returned';
const LEDGER_REASONS: readonly LedgerReason[] = ['task_approved', 'redemption', 'manual_adjustment', 'goal_withdrawal', 'allowance', 'savings_bonus',
  'self_income', 'personal_reward', 'goal_release', 'share_gift', 'share_gift_returned'];

export interface LedgerEntry { id: number; bucket: Bucket; amount: number; reason: LedgerReason; note: string | null; createdAt: string }

/** One history line as Core serves it; a guardian movement must carry its reason, or it is not shown as if explained. */
export function isLedgerEntry(value: unknown): value is LedgerEntry {
  const e = value as LedgerEntry | null;
  return typeof e === 'object' && e !== null && isInt(e.id) && isBucket(e.bucket) && isInt(e.amount) && LEDGER_REASONS.includes(e.reason)
    && isNullableString(e.note) && isInstant(e.createdAt)
    && ((e.reason !== 'manual_adjustment' && e.reason !== 'goal_withdrawal') || (typeof e.note === 'string' && e.note.length > 0));
}

/** S07.2 (H-06): the entries a linked teen makes without an approval step; a Tutor sees them after the fact. */
export const SELF_DIRECTED_REASONS: readonly LedgerReason[] = ['self_income', 'personal_reward', 'goal_release'];

export function fetchOwnLedger(session: Session) {
  return call('/tasks/wallet/ledger', session,
    (data): data is { entries: LedgerEntry[] } => Array.isArray((data as { entries?: unknown })?.entries) && (data as { entries: unknown[] }).entries.every(isLedgerEntry));
}

export interface KidPockets { save: number; spend: number; share: number }

/** GAP-FIX-R6 (D.5): a child's three pockets as their Tutor reads them, beside a correction (Core re-checks the guardian link). */
export function fetchKidPockets(kidId: string, session: Session) {
  return call(`/tasks/${encodeURIComponent(kidId)}/wallet`, session, (data): data is { balances: KidPockets } => {
    const b = (data as { balances?: Record<string, unknown> } | null)?.balances;
    return typeof b === 'object' && b !== null && isInt(b.save) && isInt(b.spend) && isInt(b.share);
  });
}

export function fetchOwnRedemptions(session: Session) {
  return call('/tasks/redemptions/mine', session,
    (data): data is { redemptions: Redemption[] } => Array.isArray((data as { redemptions?: unknown })?.redemptions) && (data as { redemptions: unknown[] }).redemptions.every(isRedemption));
}

export function fetchAvailableCatalog(session: Session) {
  return call('/tasks/catalog/available', session, isCatalog);
}
