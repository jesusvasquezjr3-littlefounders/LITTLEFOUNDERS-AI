/*
 * S07.6 client API layer for the rebuilt coin account (D.7, D.12). Core is the
 * only service called. Every response is shape-checked against the register
 * it declares: a young reader's answer carrying a ratio or a percentage, an
 * account not declared a simulation, a freeze hold nobody enforces or a
 * freeze without its author is refused here, never rendered. Nothing in this
 * file authorizes anything: Core and the database are the boundary.
 */

import type { Outcome, Session } from '../family/familyHubApi';
import { isMoneyRegister, type MoneyRegister } from '../family/moneyRegister';

/** What a freeze really holds (Core's FREEZE_HOLDS, pinned by docs/operations/block-d-controls.json). */
export const FREEZE_HOLDS = ['rewards', 'splits', 'credits', 'share'] as const;
export type FreezeHold = (typeof FREEZE_HOLDS)[number];
export const CARD_DESIGNS = ['indigo', 'emerald', 'violet', 'amber', 'sunrise', 'ocean'] as const;
export type CardDesign = (typeof CARD_DESIGNS)[number];

export interface Freeze { frozen: boolean; by: 'you' | 'tutor' | 'child' | null; since: string | null; holds: FreezeHold[]; canChange: boolean }
export interface CoinCard { nickname: string; design: CardDesign; simulated: true; freeze: Freeze }

export type SpendLimit =
  | { configured: false }
  | { configured: true; period: 'weekly' | 'monthly'; remaining: number; cap?: number; used?: number; usedPercent?: number };

export interface MonthLine { id: number; bucket: 'save' | 'spend' | 'share'; amount: number; reason: string; createdAt: string }
export interface Month { month: string; earned: number; spent: number; saved: number; given?: number; adjusted?: number; lines?: MonthLine[] }

export interface CoinAccountView {
  register: MoneyRegister;
  account: CoinCard | null;
  pockets: { save: number; spend: number; share: number };
  pendingCredits: number;
  spendLimit: SpendLimit;
  statement: Month;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const isCount = (value: unknown): value is number => isInt(value) && value >= 0;
const isInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const keysAre = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');

function isFreeze(value: unknown, reader: 'child' | 'tutor'): value is Freeze {
  if (!isObject(value) || !keysAre(value, ['frozen', 'by', 'since', 'holds', 'canChange'])) return false;
  const holds = value.holds;
  if (!Array.isArray(holds) || holds.length === 0 || new Set(holds).size !== holds.length || !holds.every((h) => FREEZE_HOLDS.includes(h as FreezeHold))) return false;
  if (typeof value.frozen !== 'boolean' || typeof value.canChange !== 'boolean') return false;
  if (!value.frozen) return value.by === null && value.since === null && value.canChange === true;
  const authors = reader === 'child' ? ['you', 'tutor'] : ['you', 'tutor', 'child'];
  if (!authors.includes(value.by as string) || !(value.since === null || isInstant(value.since))) return false;
  // A child can lift only their own freeze; a Tutor can always change it.
  return reader === 'tutor' ? value.canChange === true : value.canChange === (value.by === 'you');
}

function isCard(value: unknown, reader: 'child' | 'tutor'): value is CoinCard {
  return isObject(value) && keysAre(value, ['nickname', 'design', 'simulated', 'freeze']) && typeof value.nickname === 'string'
    && value.nickname.length > 0 && CARD_DESIGNS.includes(value.design as CardDesign) && value.simulated === true && isFreeze(value.freeze, reader);
}

/** A register may only carry its own numbers: the young reader never receives a ratio or a percentage. */
export function isSpendLimit(value: unknown, register: MoneyRegister): value is SpendLimit {
  if (!isObject(value)) return false;
  if (value.configured === false) return keysAre(value, ['configured']);
  if (value.configured !== true || (value.period !== 'weekly' && value.period !== 'monthly') || !isCount(value.remaining)) return false;
  if (register === 'young') return keysAre(value, ['configured', 'period', 'remaining']);
  if (!isCount(value.cap) || !isCount(value.used) || value.remaining !== Math.max(0, value.cap - value.used)) return false;
  if (register === 'transition') return keysAre(value, ['configured', 'period', 'remaining', 'cap', 'used']);
  return keysAre(value, ['configured', 'period', 'remaining', 'cap', 'used', 'usedPercent']) && isCount(value.usedPercent) && value.usedPercent <= 100;
}

export function isMonth(value: unknown, register: MoneyRegister): value is Month {
  if (!isObject(value) || typeof value.month !== 'string' || !/^\d{4}-\d{2}$/.test(value.month)) return false;
  if (!isCount(value.earned) || !isCount(value.spent) || !isInt(value.saved)) return false;
  if (register === 'young') return keysAre(value, ['month', 'earned', 'spent', 'saved']);
  if (!isCount(value.given) || !isInt(value.adjusted)) return false;
  if (register === 'transition') return keysAre(value, ['month', 'earned', 'spent', 'saved', 'given', 'adjusted']);
  return keysAre(value, ['month', 'earned', 'spent', 'saved', 'given', 'adjusted', 'lines']) && Array.isArray(value.lines) && value.lines.length <= 8
    && value.lines.every((l) => isObject(l) && isInt(l.id) && ['save', 'spend', 'share'].includes(l.bucket as string) && isInt(l.amount)
      && typeof l.reason === 'string' && isInstant(l.createdAt));
}

export function isCoinAccountView(value: unknown): value is CoinAccountView {
  if (!isObject(value) || !isMoneyRegister(value.register)) return false;
  const register = value.register;
  const pockets = value.pockets;
  return (value.account === null || isCard(value.account, 'child'))
    && isObject(pockets) && keysAre(pockets, ['save', 'spend', 'share']) && isInt(pockets.save) && isInt(pockets.spend) && isInt(pockets.share)
    && isCount(value.pendingCredits) && isSpendLimit(value.spendLimit, register) && isMonth(value.statement, register);
}

async function call<T>(path: string, session: Session, check: (data: unknown) => data is T, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<Outcome<T>> {
  if (!session.token) return { ok: false, code: 'UNAUTHORIZED' };
  const result = await session.transport(path, { token: session.token, method: init.method, body: init.body });
  if (result.error) return { ok: false, code: result.error.code };
  return check(result.data) ? { ok: true, data: result.data } : { ok: false, code: 'INVALID_RESPONSE' };
}

/** The child's own coin account, shaped by their register at the server. */
export function fetchCoinAccount(session: Session) {
  return call('/banking/overview', session, isCoinAccountView);
}

/** The child freezes or unfreezes their own account; the caller re-reads the account (never assumes the new state). */
export function setOwnFreeze(frozen: boolean, session: Session) {
  return call('/banking/account/freeze', session,
    (data): data is { account: { frozen: boolean } } => isObject(data) && isObject(data.account) && data.account.frozen === frozen,
    { method: 'POST', body: { frozen } });
}

export interface TutorFreezeView { register: MoneyRegister; account: CoinCard | null }

export function fetchTutorFreeze(kidId: string, session: Session) {
  return call(`/banking/accounts/${encodeURIComponent(kidId)}/freeze`, session,
    (data): data is TutorFreezeView => isObject(data) && isMoneyRegister(data.register) && keysAre(data, ['register', 'account'])
      && (data.account === null || isCard(data.account, 'tutor')));
}

export function setTutorFreeze(kidId: string, frozen: boolean, session: Session) {
  return call(`/banking/accounts/${encodeURIComponent(kidId)}/freeze`, session,
    (data): data is { account: { frozen: boolean } } => isObject(data) && isObject(data.account) && data.account.frozen === frozen,
    { method: 'POST', body: { frozen } });
}
