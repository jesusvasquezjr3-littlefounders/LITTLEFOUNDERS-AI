import type { Outcome, Session } from './familyHubApi';

/*
 * S07.7 client API layer: D.23 (the monthly coaching tip), D.21 (the retention
 * periods a family reads), D.22 (research participation) and D.19 (the
 * older-teen bridge). Core is the only service called; every response is
 * shape-checked, so a surface never renders a state the server did not
 * return. Nothing here authorizes anything: Core and the database decide who
 * may see a tip, who may say yes to research and who is old enough for the
 * bridge. The bridge's split tool computes in the browser and sends nothing.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isInstant = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

async function call<T>(path: string, session: Session, check: (data: unknown) => data is T, init: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown } = {}): Promise<Outcome<T>> {
  if (!session.token) return { ok: false, code: 'UNAUTHORIZED' };
  const result = await session.transport(path, { token: session.token, method: init.method, body: init.body });
  if (result.error) return { ok: false, code: result.error.code };
  return check(result.data) ? { ok: true, data: result.data } : { ok: false, code: 'INVALID_RESPONSE' };
}

// ── D.23: the monthly tip ───────────────────────────────────────────────────
/** The tips the copy knows; a tip id outside this list is refused, never shown as a raw key. */
export const TIP_IDS = [
  'contribution-vs-bonus', 'price-by-effort', 'keep-promises', 'explain-the-no', 'ask-their-view', 'money-talk-at-home',
  'after-a-goal', 'limits-with-reasons', 'grow-their-say', 'spending-is-not-failing', 'share-for-real', 'bonus-is-not-interest',
] as const;
export type TipId = (typeof TIP_IDS)[number];
export interface CoachingTip { deliveryId: string; tipId: TipId; period: string; opened: boolean; dismissed: boolean }

const isTip = (v: unknown): v is CoachingTip => isObject(v) && isUuid(v.deliveryId) && TIP_IDS.includes(v.tipId as TipId)
  && typeof v.period === 'string' && /^\d{4}-\d{2}$/.test(v.period) && typeof v.opened === 'boolean' && typeof v.dismissed === 'boolean';

export function fetchCoachingTip(session: Session) {
  return call('/family-hub/coaching', session, (d): d is { tip: CoachingTip | null } => isObject(d) && (d.tip === null || isTip(d.tip)));
}

export function markCoachingTip(deliveryId: string, action: 'opened' | 'dismissed', session: Session) {
  return call(`/family-hub/coaching/${encodeURIComponent(deliveryId)}/${action}`, session,
    (d): d is { tip: CoachingTip } => isObject(d) && isTip(d.tip) && d.tip.deliveryId === deliveryId && (action === 'opened' ? d.tip.opened : d.tip.dismissed),
    { method: 'POST', body: {} });
}

// ── D.21: what a family is told ─────────────────────────────────────────────
export const POLICY_CLASSES = ['photos', 'records', 'coins', 'insights', 'research', 'erasure', 'sharing'] as const;
export type PolicyClass = (typeof POLICY_CLASSES)[number];
export interface PolicyLine { id: PolicyClass; days: number | null }
const PERIODIC: readonly PolicyClass[] = ['photos', 'records', 'insights', 'research'];

export const isPolicy = (v: unknown): v is { classes: PolicyLine[] } => isObject(v) && Array.isArray(v.classes)
  && v.classes.length === POLICY_CLASSES.length
  && v.classes.every((c, i) => isObject(c) && c.id === POLICY_CLASSES[i]
    // A period is a positive whole number of days exactly where the rule is a period.
    && (PERIODIC.includes(c.id as PolicyClass) ? isCount(c.days) && (c.days as number) > 0 : c.days === null));

export function fetchDataPolicy(session: Session) {
  return call('/family-hub/data-policy', session, isPolicy);
}

// ── D.22: research participation ────────────────────────────────────────────
export interface Research {
  participating: boolean; recording: boolean; grantor: 'tutor' | 'self' | null; since: string | null; disclosureVersion: number; adult: boolean; months: number;
  /** H-25: the Tutor's yes lapsed at 18 and the young adult is asked again (absent from an older Core = false). */
  lapsed?: boolean;
}
export interface ResearchView { research: Research; currentVersion: number }

const isResearch = (v: unknown): v is Research => isObject(v) && typeof v.participating === 'boolean' && typeof v.recording === 'boolean'
  && (v.grantor === null || v.grantor === 'tutor' || v.grantor === 'self') && (v.since === null || isInstant(v.since))
  && isCount(v.disclosureVersion) && typeof v.adult === 'boolean' && isCount(v.months)
  && (v.lapsed === undefined || (typeof v.lapsed === 'boolean' && (!v.lapsed || (v.participating && v.grantor === 'tutor' && v.adult && !v.recording))))
  // Nobody is recorded without a yes, and a yes always has its grantor and date.
  && (v.participating ? v.grantor !== null && v.since !== null : !v.recording && v.grantor === null && v.since === null);
const isResearchView = (v: unknown): v is ResearchView => isObject(v) && isResearch(v.research) && isCount(v.currentVersion) && v.currentVersion >= 1;

export function fetchKidResearch(kidId: string, session: Session) {
  return call(`/family-hub/kids/${encodeURIComponent(kidId)}/research`, session, isResearchView);
}

export function setKidResearch(kidId: string, input: { participate: true; disclosureVersion: number } | { participate: false }, session: Session) {
  return call(`/family-hub/kids/${encodeURIComponent(kidId)}/research`, session,
    (d): d is ResearchView => isResearchView(d) && d.research.participating === input.participate, { method: 'PUT', body: input });
}

export function fetchMyResearch(session: Session) {
  return call('/family-hub/research/me', session, isResearchView);
}

export function stopMyResearch(session: Session) {
  return call('/family-hub/research/me', session, (d): d is ResearchView => isResearchView(d) && !d.research.participating && d.research.months === 0,
    { method: 'PUT', body: { participate: false } });
}

/** H-25: an adult's own yes (the young adult answering after their Tutor's yes lapsed at 18); the database decides who may. */
export function joinMyResearch(disclosureVersion: number, session: Session) {
  return call('/family-hub/research/me', session, (d): d is ResearchView => isResearchView(d) && d.research.participating && d.research.grantor === 'self',
    { method: 'PUT', body: { participate: true, disclosureVersion } });
}

// ── D.19: the older-teen bridge ─────────────────────────────────────────────
export const BRIDGE_MOMENTS = ['first_pay', 'first_account', 'first_budget'] as const;
export type BridgeMoment = (typeof BRIDGE_MOMENTS)[number];
export interface BridgeState { eligible: boolean; minAge: number; moments: { milestone: BridgeMoment; arrived: boolean; steps: number[] }[] }

export const isBridge = (v: unknown): v is BridgeState => isObject(v) && typeof v.eligible === 'boolean' && isCount(v.minAge) && Array.isArray(v.moments)
  && (v.eligible
    ? v.moments.length === BRIDGE_MOMENTS.length && v.moments.every((m, i) => isObject(m) && m.milestone === BRIDGE_MOMENTS[i] && typeof m.arrived === 'boolean'
      && Array.isArray(m.steps) && m.steps.every((s) => s === 1 || s === 2 || s === 3) && (m.arrived || m.steps.length === 0))
    : v.moments.length === 0);

export function fetchBridge(session: Session) {
  return call('/family-hub/bridge', session, isBridge);
}

export function markBridge(input: { milestone: BridgeMoment; step: 0 | 1 | 2 | 3; done: boolean }, session: Session) {
  return call('/family-hub/bridge', session, (d): d is BridgeState => isBridge(d) && d.eligible, { method: 'POST', body: input });
}

/**
 * The teen's usual split applied to a real amount, in the browser only:
 * whole units by largest remainder so the parts always add up to the amount.
 * Never sent anywhere.
 */
export function splitAmount(amount: number, split: { save: number; spend: number; share: number }): { save: number; spend: number; share: number } | null {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return null;
  const total = split.save + split.spend + split.share;
  if (total <= 0) return null;
  const whole = Math.round(amount);
  const raw = { save: (whole * split.save) / total, spend: (whole * split.spend) / total, share: (whole * split.share) / total };
  const out = { save: Math.floor(raw.save), spend: Math.floor(raw.spend), share: Math.floor(raw.share) };
  let left = whole - out.save - out.spend - out.share;
  for (const key of (['save', 'spend', 'share'] as const).slice().sort((a, b) => (raw[b] - out[b]) - (raw[a] - out[a]))) {
    if (left <= 0) break;
    out[key] += 1;
    left -= 1;
  }
  return out;
}
