import type { Config } from '../env.js';

/*
 * When a session should start wrapping up, and when it must stop.
 *
 * A PURE REDUCER, deliberately, and the reason is written on the 3D scene's
 * quality governor in /TUTOR_3D.md §6: state that lives inside a React or
 * timer callback gets double-invoked, re-entered, or fired twice on a
 * reconnect, and a budget that latches early cuts a child off mid-lesson. A
 * function of (elapsed, turns) has no such failure mode and can be tested
 * exhaustively in milliseconds.
 *
 * Three states, and the middle one is the whole point (/ORACLE.md §9.5):
 *
 *   running  → normal turns
 *   wrapping → the tutor is told to begin closing, IN CHARACTER. It finishes
 *              the current activity, recaps and says goodbye properly.
 *   ended    → no further turns. A hard stop still gets a scripted farewell,
 *              never a socket that simply dies.
 */

export type BudgetState = 'running' | 'wrapping' | 'ended';

export interface BudgetInput {
  startedAtMs: number;
  nowMs: number;
  turnCount: number;
  /**
   * True for a staff account (`admin`/`superadmin`), which is exempt from the
   * learner-facing usage limits — see `STAFF_*` below. Optional so every
   * existing caller and test keeps the learner budget by omission: the
   * exemption must be asked for, never inherited.
   */
  isStaff?: boolean;
}

/**
 * The staff exemption's budget — LARGE, and deliberately still FINITE.
 *
 * Added 2026-09-01 (owner request), extending the exemption that already
 * covered the daily session cap (`STAFF_SESSION_CAP`, `backend/src/routes/
 * tutor.ts`) to the limits that were still cutting a staff session short:
 * twenty-five minutes and a hundred and twenty turns. Testing the Tutor
 * properly — walking a whole lesson, then the adaptation path, then the
 * close — does not fit inside a budget shaped for a child's attention span.
 *
 * WHY NOT `Infinity`, which is what "unlimited" literally asks for. The hard
 * budget is the only thing that ever closes a session nobody is sitting in
 * front of, and a forgotten staff tab with no session cap, no turn cap and
 * no clock is precisely the runaway AGENTS.md §1.14 prices in dollars. Eight
 * hours is past any real testing session and still terminates an abandoned
 * one the same day. This is the identical judgement `STAFF_SESSION_CAP`
 * already made when it chose Postgres's `int4` ceiling over
 * `Number.MAX_SAFE_INTEGER` — and that constant's own comment records what
 * happens when an "unlimited" value is chosen without asking what will
 * later have to hold it.
 *
 * The soft budget stays a fixed interval BELOW the hard one rather than a
 * fraction of it, so the wind-down is the same real fifteen minutes a
 * learner gets. A proportional soft budget would have put staff into
 * "wrapping" — the tutor audibly saying goodbye — for the last two and a
 * half HOURS, which would make the one state this reducer exists to model
 * untestable for the only people who test it.
 */
export const STAFF_HARD_BUDGET_MS = 8 * 60 * 60_000;
export const STAFF_SOFT_BUDGET_MS = STAFF_HARD_BUDGET_MS - 15 * 60_000;
export const STAFF_MAX_TURNS = 5_000;

export interface BudgetVerdict {
  state: BudgetState;
  /** Why, for the session's close_reason and for telemetry. */
  reason: 'ok' | 'soft_budget' | 'hard_budget' | 'turn_cap';
  /** Milliseconds until the hard stop; negative once past it. */
  remainingMs: number;
}

export function evaluateBudget(input: BudgetInput, config: Config): BudgetVerdict {
  const elapsed = input.nowMs - input.startedAtMs;
  /*
   * The staff exemption swaps the three THRESHOLDS and nothing else — the
   * reducer keeps one code path, so a staff session is still capable of
   * every state a learner's is, just further out. Branching to an early
   * `return { state: 'running' }` was the obvious alternative and is worse:
   * it would make `wrapping` and both `ended` reasons unreachable for
   * exactly the accounts used to test them, which is how a state nobody can
   * reach stops being tested and then stops working (this file's sibling
   * lesson in `controller.ts`, where TRANSFER sat dead behind an unreachable
   * condition for weeks with its own skill file and its own budgets).
   */
  const hardBudgetMs = input.isStaff ? STAFF_HARD_BUDGET_MS : config.SESSION_HARD_BUDGET_MS;
  const softBudgetMs = input.isStaff ? STAFF_SOFT_BUDGET_MS : config.SESSION_SOFT_BUDGET_MS;
  const maxTurns = input.isStaff ? STAFF_MAX_TURNS : config.SESSION_MAX_TURNS;
  const remainingMs = hardBudgetMs - elapsed;

  if (elapsed >= hardBudgetMs) {
    return { state: 'ended', reason: 'hard_budget', remainingMs };
  }
  // The turn cap is a cost and abuse control rather than a pedagogical one, so
  // it ends rather than wraps: a session that has produced 120 turns in under
  // fifteen minutes is not a lesson.
  if (input.turnCount >= maxTurns) {
    return { state: 'ended', reason: 'turn_cap', remainingMs };
  }
  if (elapsed >= softBudgetMs) {
    return { state: 'wrapping', reason: 'soft_budget', remainingMs };
  }
  return { state: 'running', reason: 'ok', remainingMs };
}

/**
 * The instruction appended to the model's context once wrapping starts.
 *
 * Appended rather than swapped in: the tutor must keep everything it knows
 * about the learner while it says goodbye, or the farewell reads as a
 * different character walking in.
 */
export const WRAP_UP_INSTRUCTION = [
  '',
  '## Time',
  '',
  'This session is nearly over. Begin wrapping up now, in character: finish the',
  'thread you are on, say briefly what the learner did well and what they',
  'learned, and invite them back. Do not start a new topic and do not request a',
  'new activity. When you have said goodbye, set "next" to "close".',
].join('\n');
