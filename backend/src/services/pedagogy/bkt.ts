/*
 * Bayesian Knowledge Tracing — the four-parameter update (Corbett & Anderson).
 *
 * Pure math, no I/O. This runs inside Core's grade request (the "decision
 * clock"), never inside Oracle's voice turn — the posterior it produces rides
 * back to the tutor on the segment_graded event. Oracle mirrors the same
 * arithmetic locally for display, but THIS persisted value is authoritative.
 *
 * Parameter constraints (enforced in the schema too, migration 0052):
 *   p_g ≤ 0.30, p_s ≤ 0.10 — the classic degeneracy guards. `clampParams`
 * re-asserts them here so a hand-edited params_override can never push the
 * model into an uninterpretable region.
 */

export interface BktParams {
  /** P(L0) — probability the KC was known before any evidence. */
  pL0: number;
  /** P(T) — probability of learning after one opportunity. */
  pT: number;
  /** P(G) — probability of a correct answer without knowing (guess). */
  pG: number;
  /** P(S) — probability of a wrong answer while knowing (slip). */
  pS: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function clampParams(p: BktParams): BktParams {
  return {
    pL0: clamp01(p.pL0),
    pT: clamp01(p.pT),
    pG: Math.min(0.3, clamp01(p.pG)),
    pS: Math.min(0.1, clamp01(p.pS)),
  };
}

/**
 * One evidence update: posterior given the observation, then the learning
 * transition. Returns the new P(known), clamped to (epsilon, 1 - epsilon) so
 * a run of identical answers can never freeze the model at exactly 0 or 1 —
 * a frozen posterior stops responding to evidence forever.
 */
export function bktUpdate(pKnown: number, correct: boolean, params: BktParams): number {
  const { pT, pG, pS } = clampParams(params);
  const p = clamp01(pKnown);

  let posterior: number;
  if (correct) {
    const num = p * (1 - pS);
    const den = num + (1 - p) * pG;
    posterior = den > 0 ? num / den : p;
  } else {
    const num = p * pS;
    const den = num + (1 - p) * (1 - pG);
    posterior = den > 0 ? num / den : p;
  }
  const learned = posterior + (1 - posterior) * pT;
  const EPS = 0.001;
  return Math.min(1 - EPS, Math.max(EPS, learned));
}

/** Predicted P(correct on the next attempt) — the ZPD targeting input. */
export function predictCorrect(pKnown: number, params: BktParams): number {
  const { pG, pS } = clampParams(params);
  const p = clamp01(pKnown);
  return p * (1 - pS) + (1 - p) * pG;
}

/** The mastery bar used across v3: prerequisites count as met at ≥ 0.80. */
export const MASTERY_PREREQ_THRESHOLD = 0.8;
/** A KC is presented as "mastered" at ≥ 0.85 with enough evidence. */
export const MASTERY_DISPLAY_THRESHOLD = 0.85;
