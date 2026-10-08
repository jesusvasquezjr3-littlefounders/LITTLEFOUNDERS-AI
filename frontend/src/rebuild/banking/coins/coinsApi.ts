/*
 * W2 Lane 4 (W2F.2): the client API layer of the rebuilt coin screens (F5-P,
 * the Tutor's coin cards; F5-K, the child's wallet), through the transport
 * the route adapter injects. Imports nothing outside the rebuild.
 *
 * D.7, no unbacked guarantee: Core no longer mints, stores or serves a
 * card-shaped number (F1-family); this layer never passed one on either, so
 * no rebuilt surface can show a number laid out like a real card's. The
 * freeze itself is read and changed by the S07.6 freeze card (bankingApi.ts),
 * never here.
 *
 * Client checks mirror Core's (`backend/src/routes/banking.ts`): an allowance
 * of 1-1,000 coins, weekly or every two weeks on a day of the week (0-6) or
 * monthly on day 1-28; a spending limit of 1 or more coins over the last 7 or
 * 30 days; a card name of 1-40 characters in one of six colours. Core and the
 * database stay the boundary.
 */

import type { ConsoleTransport, Outcome } from '../../family/console/consoleApi';
import { isLedgerEntry, type LedgerEntry } from '../../family/familyHubApi';
import { CARD_DESIGNS, shiftMonth, STATEMENT_MONTHS_BACK, type CardDesign } from '../bankingApi';

export { CARD_DESIGNS, type CardDesign };

export const ALLOWANCE_MAX = 1000;
export const CARD_NAME_MAX = 40;
export type Frequency = 'weekly' | 'biweekly' | 'monthly';
export type LimitWindow = 'weekly' | 'monthly';

/** `frozen` only tells a split it will be held (D.1); the freeze card reads and changes the freeze itself. */
export interface Card { nickname: string; design: CardDesign; frozen: boolean }
export interface Allowance { amount: number; frequency: Frequency; anchorDay: number; active: boolean; nextRunAt: string }
export type Limit = { configured: false } | { configured: true; period: LimitWindow; cap: number; used: number; remaining: number };
export interface PendingCredit { id: string; amount: number }

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

async function call<T>(transport: ConsoleTransport, path: string, check: (data: unknown) => T | undefined,
  init: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH'; body?: unknown } = {}): Promise<Outcome<T>> {
  const result = await transport(path, init);
  if (result.error) return { ok: false, code: result.error.code };
  const data = check(result.data);
  return data === undefined ? { ok: false, code: 'INVALID_RESPONSE' } : { ok: true, data };
}

/** The card as a rebuilt surface may show it: a name and a colour. Never the legacy number. */
function toCard(value: unknown): Card | null | undefined {
  if (value === null) return null;
  if (!isObject(value) || typeof value.nickname !== 'string' || value.nickname.length === 0 || !CARD_DESIGNS.includes(value.cardDesign as CardDesign)) return undefined;
  return { nickname: value.nickname, design: value.cardDesign as CardDesign, frozen: value.frozen === true };
}
const cardOf = (data: unknown) => isObject(data) && 'account' in data ? toCard(data.account) : undefined;

function toAllowance(value: unknown): Allowance | null | undefined {
  if (value === null) return null;
  if (!isObject(value) || !isCount(value.amount) || !['weekly', 'biweekly', 'monthly'].includes(value.frequency as string) || !isCount(value.anchorDay)
    || typeof value.active !== 'boolean' || !isInstant(value.nextRunAt)) return undefined;
  return { amount: value.amount, frequency: value.frequency as Frequency, anchorDay: value.anchorDay, active: value.active, nextRunAt: value.nextRunAt };
}

function toLimit(value: unknown): Limit | undefined {
  if (!isObject(value)) return undefined;
  if (value.configured === false) return { configured: false };
  if (value.configured !== true || (value.period !== 'weekly' && value.period !== 'monthly') || !isCount(value.cap) || !isCount(value.used) || !isCount(value.remaining)) return undefined;
  return { configured: true, period: value.period, cap: value.cap, used: value.used, remaining: value.remaining };
}

const kid = (id: string) => encodeURIComponent(id);

// ── F5-P: the Tutor's view of one child's coins ─────────────────────────────

export interface ChildCoinsSetup { card: Card | null; allowance: Allowance | null; limit: Limit }

export async function fetchSetup(transport: ConsoleTransport, kidId: string): Promise<Outcome<ChildCoinsSetup>> {
  const [card, allowance, limit] = await Promise.all([
    call(transport, `/banking/accounts/${kid(kidId)}`, cardOf),
    call(transport, `/banking/allowance/${kid(kidId)}`, (data) => isObject(data) && 'rule' in data ? toAllowance(data.rule) : undefined),
    call(transport, `/banking/spend-limit/${kid(kidId)}`, (data) => isObject(data) ? toLimit(data.status) : undefined),
  ]);
  if (!card.ok) return card;
  if (!allowance.ok) return allowance;
  if (!limit.ok) return limit;
  return { ok: true, data: { card: card.data, allowance: allowance.data, limit: limit.data } };
}

export function openCard(transport: ConsoleTransport, kidId: string, input: { nickname: string; cardDesign: CardDesign }) {
  return call(transport, `/banking/accounts/${kid(kidId)}`, (data) => cardOf(data) ?? undefined, { method: 'POST', body: input });
}

/** Core's rule: weekly or every two weeks on a weekday (0 Sunday - 6 Saturday); monthly on day 1-28. */
export function validAllowance(input: { amount: number; frequency: Frequency; anchorDay: number }): boolean {
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > ALLOWANCE_MAX || !Number.isInteger(input.anchorDay)) return false;
  return input.frequency === 'monthly' ? input.anchorDay >= 1 && input.anchorDay <= 28 : input.anchorDay >= 0 && input.anchorDay <= 6;
}

export function saveAllowance(transport: ConsoleTransport, kidId: string, input: { amount: number; frequency: Frequency; anchorDay: number; active: boolean }) {
  return call(transport, `/banking/allowance/${kid(kidId)}`, (data) => isObject(data) ? toAllowance(data.rule) ?? undefined : undefined, { method: 'PUT', body: input });
}

export function saveLimit(transport: ConsoleTransport, kidId: string, input: { period: LimitWindow; cap: number; active: boolean }) {
  return call(transport, `/banking/spend-limit/${kid(kidId)}`, (data) => isObject(data) ? toLimit(data.status) : undefined, { method: 'PUT', body: input });
}

// ── F5-K: the child's own card and the coins waiting to be split ────────────

export interface OwnCoins { card: Card | null; credits: PendingCredit[] }

export async function fetchOwnCoins(transport: ConsoleTransport): Promise<Outcome<OwnCoins>> {
  const [card, credits] = await Promise.all([
    call(transport, '/banking/account', cardOf),
    call(transport, '/banking/wallet/pending-credits', (data) => {
      if (!isObject(data) || !Array.isArray(data.credits)) return undefined;
      const list = data.credits.map((c: unknown) => isObject(c) && typeof c.id === 'string' && isCount(c.amount) && c.amount > 0 ? { id: c.id, amount: c.amount } : null);
      return list.every((c): c is PendingCredit => c !== null) ? list : undefined;
    }),
  ]);
  if (!card.ok) return card;
  if (!credits.ok) return credits;
  return { ok: true, data: { card: card.data, credits: credits.data } };
}

export function updateOwnCard(transport: ConsoleTransport, input: { nickname: string; cardDesign: CardDesign }) {
  return call(transport, '/banking/account', (data) => cardOf(data) ?? undefined, { method: 'PATCH', body: input });
}

// ── GAP-FIX-R6: what the Tutor sees of one child's coins (OD-3 §2, Law 5) ───
// Read-only: the three pockets, a month of the statement and the latest coin
// history, a linked teen's self-directed entries included. Core admits each
// read only for a verified guardian of this child (404 otherwise).

export interface ChildPockets { save: number; spend: number; share: number }
/** A month as the Tutor reads it: the totals and every line of the month, each with its reason. */
export interface ChildMonth { month: string; earned: number; spent: number; saved: number; given: number; adjusted: number; entries: LedgerEntry[] }

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function toPockets(data: unknown): ChildPockets | undefined {
  const b = isObject(data) ? data.balances : undefined;
  if (!isObject(b) || !isInt(b.save) || !isInt(b.spend) || !isInt(b.share)) return undefined;
  return { save: b.save, spend: b.spend, share: b.share };
}

/** Earned and spent are counts; given, corrections and what Save gained are net figures and may be below zero. */
function toMonth(data: unknown): ChildMonth | undefined {
  const s = isObject(data) ? data.statement : undefined;
  if (!isObject(s) || typeof s.month !== 'string' || !MONTH.test(s.month) || !isCount(s.earned) || !isCount(s.spent) || !isInt(s.saved) || !isInt(s.given)
    || !isInt(s.adjusted) || !Array.isArray(s.entries) || !s.entries.every(isLedgerEntry)) return undefined;
  return { month: s.month, earned: s.earned, spent: s.spent, saved: s.saved, given: s.given, adjusted: s.adjusted, entries: s.entries };
}

export function fetchChildPockets(transport: ConsoleTransport, kidId: string) {
  return call(transport, `/tasks/${kid(kidId)}/wallet`, toPockets);
}

/** This month (null) or another one inside Core's paging window; Core refuses a month outside it. */
export function fetchChildMonth(transport: ConsoleTransport, kidId: string, month: string | null) {
  const query = month === null ? '' : `?month=${encodeURIComponent(month)}`;
  return call(transport, `/banking/statement/${kid(kidId)}${query}`, toMonth);
}

export function fetchChildHistory(transport: ConsoleTransport, kidId: string) {
  return call(transport, `/tasks/${kid(kidId)}/wallet/ledger`, (data) =>
    isObject(data) && Array.isArray(data.entries) && data.entries.every(isLedgerEntry) ? data.entries as LedgerEntry[] : undefined);
}

/** Core's window, mirrored: never after this month, at most STATEMENT_MONTHS_BACK months back (this month included). */
export function monthInWindow(month: string, current: string): boolean {
  return MONTH.test(month) && month <= current && month >= shiftMonth(current, -(STATEMENT_MONTHS_BACK - 1));
}

// ── The holder's own money: moving coins, the goals they live in, the allowance ──
// Core's rules mirrored by the database (wallet_moves): whole coins, nothing leaves the account, no approval.

export type Pocket = 'save' | 'spend' | 'share';
export interface OwnGoal { id: string; title: string; target: number; status: 'active' | 'reached' | 'archived'; saved: number }

export function fetchOwnGoals(transport: ConsoleTransport): Promise<Outcome<OwnGoal[]>> {
  return call(transport, '/tasks/goals', (data) => {
    if (!isObject(data) || !Array.isArray(data.goals)) return undefined;
    const goals = data.goals.map((g: unknown) => isObject(g) && typeof g.id === 'string' && typeof g.title === 'string' && isCount(g.target) && isCount(g.saved)
      && (g.status === 'active' || g.status === 'reached' || g.status === 'archived') ? { id: g.id, title: g.title, target: g.target, status: g.status, saved: g.saved } : null);
    return goals.every((g): g is OwnGoal => g !== null) ? goals : undefined;
  });
}

/** The child's own allowance rule, so "when does my allowance come" is never a guess. Null: none is set. */
export function fetchOwnAllowance(transport: ConsoleTransport): Promise<Outcome<Allowance | null>> {
  return call(transport, '/banking/allowance', (data) => isObject(data) && 'rule' in data ? toAllowance(data.rule) : undefined);
}

const movedOf = (data: unknown): { moveId: string } | undefined => isObject(data) && typeof data.moveId === 'string' ? { moveId: data.moveId } : undefined;

export function moveOwnCoins(transport: ConsoleTransport, input: { from: Pocket; to: Pocket; amount: number }) {
  return call(transport, '/tasks/wallet/moves', movedOf, { method: 'POST', body: input });
}

/** `in`: plain Save into the goal. `out`: the goal's coins back to plain Save. */
export function moveOwnGoalCoins(transport: ConsoleTransport, goalId: string, direction: 'in' | 'out', amount: number) {
  return call(transport, `/tasks/goals/${encodeURIComponent(goalId)}/moves`, movedOf, { method: 'POST', body: { direction, amount } });
}

/** The three pockets as the database holds them (Save includes whatever is tied to a goal). */
export function fetchOwnPockets(transport: ConsoleTransport): Promise<Outcome<Record<Pocket, number>>> {
  return call(transport, '/tasks/wallet', (data) => {
    const b = isObject(data) ? data.balances : undefined;
    return isObject(b) && isInt(b.save) && isInt(b.spend) && isInt(b.share) ? { save: b.save, spend: b.spend, share: b.share } : undefined;
  });
}

// ── Asking for a bigger allowance (allowance_requests): the child asks, the Tutor answers ──

export const ASK_REASONS = ['saving_goal', 'more_needs', 'worked_more', 'other'] as const;
export type AskReason = (typeof ASK_REASONS)[number];
export const DENIAL_CODES = ['later_date', 'not_suitable', 'talk_first'] as const;
export type DenialCode = (typeof DENIAL_CODES)[number];
export const ASK_NOTE_MAX = 120;

export interface AllowanceRequest {
  id: string; fromAmount: number; amount: number; reasonKind: AskReason; note: string | null; status: 'requested' | 'approved' | 'denied' | 'withdrawn';
  createdAt: string; decidedAt: string | null; decisionCode: DenialCode | null; decisionReason: string | null; revisitOn: string | null;
}

function toRequest(value: unknown): AllowanceRequest | undefined {
  if (!isObject(value) || typeof value.id !== 'string' || !isCount(value.fromAmount) || !isCount(value.amount) || !ASK_REASONS.includes(value.reasonKind as AskReason)
    || !['requested', 'approved', 'denied', 'withdrawn'].includes(value.status as string) || !isInstant(value.createdAt)
    || (value.note !== null && typeof value.note !== 'string') || (value.decidedAt !== null && !isInstant(value.decidedAt))
    || (value.decisionCode !== null && !DENIAL_CODES.includes(value.decisionCode as DenialCode))
    || (value.decisionReason !== null && typeof value.decisionReason !== 'string') || (value.revisitOn !== null && typeof value.revisitOn !== 'string')) return undefined;
  return {
    id: value.id, fromAmount: value.fromAmount, amount: value.amount, reasonKind: value.reasonKind as AskReason, note: value.note as string | null,
    status: value.status as AllowanceRequest['status'], createdAt: value.createdAt, decidedAt: value.decidedAt as string | null,
    decisionCode: value.decisionCode as DenialCode | null, decisionReason: value.decisionReason as string | null, revisitOn: value.revisitOn as string | null,
  };
}

/** The child's latest request (waiting, answered or taken back), or null when they never asked. */
export function fetchOwnAllowanceRequest(transport: ConsoleTransport): Promise<Outcome<AllowanceRequest | null>> {
  return call(transport, '/banking/allowance-request', (data) => isObject(data) && 'request' in data ? (data.request === null ? null : toRequest(data.request)) : undefined);
}

export function askMoreAllowance(transport: ConsoleTransport, input: { amount: number; reasonKind: AskReason; note?: string }) {
  return call(transport, '/banking/allowance-request', (data) => isObject(data) ? toRequest(data.request) : undefined, { method: 'POST', body: input });
}

export function withdrawAllowanceAsk(transport: ConsoleTransport) {
  return call(transport, '/banking/allowance-request/withdraw', (data) => isObject(data) && data.withdrawn === true ? true : undefined, { method: 'POST', body: {} });
}

/** The Tutor's view of one child's requests, newest first. */
export function fetchAllowanceRequests(transport: ConsoleTransport, kidId: string): Promise<Outcome<AllowanceRequest[]>> {
  return call(transport, `/banking/allowance-requests/${kid(kidId)}`, (data) => {
    if (!isObject(data) || !Array.isArray(data.requests)) return undefined;
    const list = data.requests.map(toRequest);
    return list.every((r): r is AllowanceRequest => r !== undefined) ? list : undefined;
  });
}

export function answerAllowanceRequest(transport: ConsoleTransport, requestId: string,
  answer: { approve: true } | { approve: false; reasonCode: DenialCode; reason: string; revisitOn: string | null }) {
  return call(transport, `/banking/allowance-requests/${encodeURIComponent(requestId)}/decide`, (data) => isObject(data) && (data.outcome === 'approved' || data.outcome === 'denied') ? data.outcome : undefined,
    { method: 'POST', body: answer });
}
