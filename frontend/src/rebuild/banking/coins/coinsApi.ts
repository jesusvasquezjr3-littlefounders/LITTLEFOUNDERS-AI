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
