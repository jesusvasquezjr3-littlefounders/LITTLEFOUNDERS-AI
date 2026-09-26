/*
 * S07.6 (D.12): the age register of the rebuilt Family Hub and Digital
 * Banking surfaces. One design system for everyone (OD-4): tokens, components
 * and shapes never change by age. What changes is copy tone, numeric framing
 * and how much detail a surface shows, by the same three registers Block B
 * uses for lessons (B.23): young child, tween-teen transition, teen.
 *
 * The register is decided by the database from age evidence (never role,
 * never this client) and read from Core. Until it is known, and whenever it
 * cannot be read, a surface is presented in the young register: the most
 * legible one, and the same conservative default D.11 and D.17 use.
 *
 * Every child-facing component in rebuild/family and rebuild/banking declares
 * its register policy in REGISTER_POLICY below; moneyRegister.test.ts fails
 * when a new child-facing component is added without one.
 */

import type { AgeBand } from '../design/copyBudget';
import type { Outcome, Session } from './familyHubApi';

export const MONEY_REGISTERS = ['young', 'transition', 'teen'] as const;
export type MoneyRegister = (typeof MONEY_REGISTERS)[number];
export const DEFAULT_REGISTER: MoneyRegister = 'young';

export const isMoneyRegister = (value: unknown): value is MoneyRegister => MONEY_REGISTERS.includes(value as MoneyRegister);

/** The Copy Budget band each register's copy is checked against (Bible 06). */
export const REGISTER_BAND: Record<MoneyRegister, AgeBand> = { young: '6-9', transition: '10-12', teen: '13-17' };

/**
 * How numbers are framed (Appendix G §1.5):
 *   counts   whole coins, one number at a time, never a ratio
 *   per_ten  coins with "out of 10 / out of 100" scaffolding
 *   percent  percentages and rates
 */
export const REGISTER_NUMBERS: Record<MoneyRegister, 'counts' | 'per_ten' | 'percent'> = { young: 'counts', transition: 'per_ten', teen: 'percent' };

export async function fetchMoneyRegister(session: Session): Promise<Outcome<MoneyRegister>> {
  if (!session.token) return { ok: false, code: 'UNAUTHORIZED' };
  const result = await session.transport('/banking/register', { token: session.token });
  if (result.error) return { ok: false, code: result.error.code };
  const register = (result.data as { register?: unknown } | null)?.register;
  return isMoneyRegister(register) ? { ok: true, data: register } : { ok: false, code: 'INVALID_RESPONSE' };
}

/** A register-specific copy set: the base, with the register's own strings over it. */
export function registerCopy<T extends object>(base: T, overlays: Partial<Record<MoneyRegister, Partial<T>>>, register: MoneyRegister): T {
  return { ...base, ...(overlays[register] ?? {}) };
}

/**
 * The register policy of every child-facing component in rebuild/family and
 * rebuild/banking. 'register' components are presented per register (their
 * numbers and explanations change); 'neutral' components carry no numeric
 * framing and are written to the youngest band's budget, which reads plainly
 * at every age, with the reason recorded. Tutor-facing components are adult
 * surfaces and are listed as 'tutor'.
 */
export const REGISTER_POLICY: Record<string, { policy: 'register' | 'neutral' | 'tutor'; why: string }> = {
  CoinAccount: { policy: 'register', why: 'the account, freeze, spending limit and month: tone, numbers and detail per register' },
  UsualSplit: { policy: 'register', why: 'out of 10 (young), out of 10 and 100 (transition), percent (teen)' },
  GoalProgress: { policy: 'register', why: 'coins (young), coins still to go (transition), percent reached (teen)' },
  SavingsGoals: { policy: 'register', why: 'draws GoalProgress in the reader\'s register' },
  SavingsBonusExplainer: { policy: 'register', why: 'D.11 framing, plus the "out of 100" bridge for the transition register' },
  SplitChooser: { policy: 'neutral', why: 'places whole coins of one payout; no ratio is shown' },
  ChoreStreak: { policy: 'neutral', why: 'counts days; milestones are OD-7\'s closed list at every age' },
  ChoreDone: { policy: 'neutral', why: 'marks a chore done with an optional note; no numbers' },
  DecisionNotes: { policy: 'neutral', why: 'shows a Tutor\'s reason in their own words' },
  GoalNextStep: { policy: 'neutral', why: 'asks for a next goal; the numbers are the child\'s own entry' },
  MyLevel: { policy: 'neutral', why: 'counts approvals against the documented rule; no ratio for any age' },
  RewardAsk: { policy: 'neutral', why: 'asks for a reward with a reason; one coin price' },
  ShareGiving: { policy: 'neutral', why: 'whole coins to a named place' },
  WalletActivity: { policy: 'neutral', why: 'a list of whole-coin lines' },
  TeenWallet: { policy: 'register', why: 'always the teen register: only a self-registered teen reaches it, and draws UsualSplit and GoalProgress in it' },
  TutorFreeze: { policy: 'tutor', why: 'the Tutor\'s freeze card' },
  AutonomyLadder: { policy: 'tutor', why: 'the Tutor\'s independence ladder' },
  BadgeShares: { policy: 'tutor', why: 'the Tutor\'s badge sharing' },
  ChoreComposer: { policy: 'tutor', why: 'the Tutor\'s chore composer' },
  CoGuardians: { policy: 'tutor', why: 'the Tutors of a child' },
  DecisionQueue: { policy: 'tutor', why: 'the Tutor\'s decisions' },
  GuardianInvite: { policy: 'tutor', why: 'inviting a Tutor (the teen sees it in the teen register only)' },
  NotYetForm: { policy: 'tutor', why: 'the Tutor\'s reason form' },
  SavingsBonusSettings: { policy: 'tutor', why: 'the Tutor\'s bonus settings' },
  ShareDestinations: { policy: 'tutor', why: 'the Tutor\'s Share places' },
  StreakPauses: { policy: 'tutor', why: 'the Tutor\'s holiday pauses' },
  WalletCorrections: { policy: 'tutor', why: 'the Tutor\'s coin corrections' },  // S07.7 (D.19-D.23).
  MoneyBridge: { policy: 'register', why: 'opens at 15 by age evidence, so always the teen register; the split tool shows whole units, never a percentage' },
  MyResearch: { policy: 'neutral', why: 'the child\'s own research note and no: no numbers, written to the youngest band' },
  CoachingNote: { policy: 'tutor', why: 'the Tutor\'s pricing and limit guidance' },
  CoachingTip: { policy: 'tutor', why: 'the Tutor\'s monthly tip' },
  DataPolicy: { policy: 'tutor', why: 'the retention periods the Tutor reads' },
  ReflectionStep: { policy: 'tutor', why: 'the Tutor\'s reflective prompt before a decision' },
  ResearchConsent: { policy: 'tutor', why: 'the Tutor\'s research answer for a child' },
  ScopeStatement: { policy: 'tutor', why: 'the parent-facing scope statement, adult copy; a self-registered teen reads the same text as the account holder' },
};
