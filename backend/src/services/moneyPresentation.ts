import { z } from 'zod';
import { isRefusal, rpc, UNAVAILABLE } from './familyLifecycle.js';
import { serviceRest } from './supabaseRest.js';

/*
 * S07.6: how Family Hub and the Wallet (formerly Digital Banking, OD-28) are presented, decided here and
 * in the database, never by a client.
 *
 * D.12, the age register. One design system for everyone (OD-4); what varies
 * by age is copy tone, numeric framing and how much detail a surface shows.
 * The database decides the register from age evidence, never role
 * (family_money_register): the teen register is exactly the children D.11
 * gives a percentage bonus, so the two are one design by construction.
 *
 *   young       6-9, or age unknown: whole coins only, one number at a time
 *   transition  10-12: coins, with "out of 100" scaffolding and totals
 *   teen        13-17: percentages and the full detail
 *
 * Every child-facing read in this file is shaped by the register at the
 * server, so a client never receives a number its reader is not given.
 *
 * D.7, no unbacked guarantee. The freeze card lists only what the database
 * actually holds while an account is frozen (FREEZE_HOLDS). Each entry is
 * pinned to its enforcing SQL and to the adversarial test that proves it in
 * docs/operations/block-d-controls.json, and agent/tools/check-no-unbacked-
 * guarantee.mjs fails CI when this list and that registry disagree.
 */

export const MONEY_REGISTERS = ['young', 'transition', 'teen'] as const;
export type MoneyRegister = (typeof MONEY_REGISTERS)[number];

/** The age at which the transition register starts (Block D threshold log). */
export const REGISTER_TRANSITION_MIN_AGE = 10;
/** The age at which the teen register starts; always the percentage-framing age of D.11 (Block D threshold log). */
export const REGISTER_TEEN_MIN_AGE = 13;

/**
 * What a freeze really holds, and nothing more (D.1, enforced by the database):
 *   rewards  new reward requests, reward approvals and pre-approved rewards
 *   splits   splitting an approved chore's coins or an allowance into pockets
 *   credits  the scheduled allowance and savings bonus (they arrive after)
 *   share    Share gifts
 * Nothing is lost: every held item is still there after the freeze is lifted.
 */
export const FREEZE_HOLDS = ['rewards', 'splits', 'credits', 'share'] as const;
export type FreezeHold = (typeof FREEZE_HOLDS)[number];

const Register = z.enum(MONEY_REGISTERS).nullable();

/** The caller's register; null when the account holds no wallet; UNAVAILABLE when unreadable (never guessed). */
export async function readMoneyRegister(userId: string): Promise<MoneyRegister | null | typeof UNAVAILABLE> {
  const result = await rpc('family_money_register', { p_user: z.string().uuid().parse(userId) }, Register);
  if (result === UNAVAILABLE || isRefusal(result)) return UNAVAILABLE;
  return result;
}

const Distribution = z.array(z.object({ register: z.enum(MONEY_REGISTERS), holders: z.coerce.number().int().min(0) }).strict()).length(3);

/** Appendix H (threshold log, D.12): wallet holders per register, counts only. */
export async function readRegisterDistribution() {
  const parsed = Distribution.safeParse(await serviceRest<unknown>('/rpc/family_money_register_distribution', { method: 'POST', body: '{}' }));
  return parsed.success ? parsed.data : null;
}

// ── Register-shaped numbers ────────────────────────────────────────────────

export type SpendLimitInput = { configured: false } | { configured: true; period: string; cap: number; used: number; remaining: number };

/** The spending limit a reader of this register is shown: the young register gets what is left, never a ratio. */
export function presentSpendLimit(register: MoneyRegister, limit: SpendLimitInput) {
  if (!limit.configured) return { configured: false as const };
  const { period, cap, used, remaining } = limit;
  if (register === 'young') return { configured: true as const, period, remaining };
  if (register === 'transition') return { configured: true as const, period, cap, used, remaining };
  return { configured: true as const, period, cap, used, remaining, usedPercent: cap > 0 ? Math.min(100, Math.round((used * 100) / cap)) : 0 };
}

export interface StatementInput {
  month: string;
  earned: number;
  spent: number;
  adjusted: number;
  given: number;
  saved: number;
  entries: { id: number; bucket: string; amount: number; reason: string; createdAt: string }[];
}

/** How many statement lines a teen reads on the card; the full list stays in the statement itself. */
export const TEEN_STATEMENT_LINES = 8;

/**
 * This month, in the register's detail: young reads three totals, transition
 * adds what was given and corrected, teen adds the latest lines.
 */
export function presentStatement(register: MoneyRegister, s: StatementInput) {
  const base = { month: s.month, earned: s.earned, spent: s.spent, saved: s.saved };
  if (register === 'young') return base;
  const totals = { ...base, given: s.given, adjusted: s.adjusted };
  if (register === 'transition') return totals;
  return {
    ...totals,
    lines: s.entries.slice(0, TEEN_STATEMENT_LINES).map((e) => ({ id: e.id, bucket: e.bucket, amount: e.amount, reason: e.reason, createdAt: e.createdAt })),
  };
}

/** Who froze the account, relative to the reader. A freeze with no recorded author is treated as a Tutor's. */
export function freezeAuthor(frozen: boolean, frozenBy: string | null, readerId: string, childId: string): 'you' | 'tutor' | 'child' | null {
  if (!frozen) return null;
  if (frozenBy !== null && frozenBy === readerId) return 'you';
  if (frozenBy !== null && frozenBy === childId) return 'child';
  return 'tutor';
}
