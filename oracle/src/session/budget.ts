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
}

export interface BudgetVerdict {
  state: BudgetState;
  /** Why, for the session's close_reason and for telemetry. */
  reason: 'ok' | 'soft_budget' | 'hard_budget' | 'turn_cap';
  /** Milliseconds until the hard stop; negative once past it. */
  remainingMs: number;
}

export function evaluateBudget(input: BudgetInput, config: Config): BudgetVerdict {
  const elapsed = input.nowMs - input.startedAtMs;
  const remainingMs = config.SESSION_HARD_BUDGET_MS - elapsed;

  if (elapsed >= config.SESSION_HARD_BUDGET_MS) {
    return { state: 'ended', reason: 'hard_budget', remainingMs };
  }
  // The turn cap is a cost and abuse control rather than a pedagogical one, so
  // it ends rather than wraps: a session that has produced 120 turns in under
  // fifteen minutes is not a lesson.
  if (input.turnCount >= config.SESSION_MAX_TURNS) {
    return { state: 'ended', reason: 'turn_cap', remainingMs };
  }
  if (elapsed >= config.SESSION_SOFT_BUDGET_MS) {
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
