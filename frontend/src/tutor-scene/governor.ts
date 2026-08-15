import { lowerTier, raiseTier, type QualityTier } from './quality';

/*
 * The tier-stepping decision, as a PURE reducer.
 *
 * It lives outside React deliberately. The first version of this logic ran
 * inside a `setTier` updater and mutated counters there; React StrictMode
 * invokes updaters twice to surface exactly that impurity, and it did — one
 * bad measurement window incremented the demotion counter twice and latched
 * the tier after a single demotion instead of two, permanently barring a
 * device that merely hiccuped from climbing back. A pure `(state, fps) =>
 * state` reducer cannot have that class of bug, and can be tested without
 * rendering anything.
 *
 * Tuning notes — every constant here is an anti-oscillation measure:
 *   - Asymmetric evidence (2 windows down, 5 up): falling back is urgent,
 *     climbing back is not.
 *   - A dead band between the thresholds, so a device sitting at 50fps is left
 *     alone instead of being pulled both ways.
 *   - A demotion latch, so a device that has twice proven it cannot hold a
 *     tier is not asked again.
 */

export const DEMOTE_BELOW_FPS = 45;
export const PROMOTE_ABOVE_FPS = 55;
export const WINDOWS_TO_DEMOTE = 2;
export const WINDOWS_TO_PROMOTE = 5;
export const MAX_DEMOTIONS = 2;

export interface GovernorState {
  tier: QualityTier;
  badWindows: number;
  goodWindows: number;
  demotions: number;
  /** Once true the tier can only go down. */
  locked: boolean;
}

export function initialGovernorState(tier: QualityTier): GovernorState {
  return { tier, badWindows: 0, goodWindows: 0, demotions: 0, locked: false };
}

/** Folds one closed measurement window into the governor state. */
export function stepGovernor(state: GovernorState, windowFps: number): GovernorState {
  if (windowFps < DEMOTE_BELOW_FPS) {
    const badWindows = state.badWindows + 1;
    if (badWindows < WINDOWS_TO_DEMOTE) {
      return { ...state, badWindows, goodWindows: 0 };
    }

    const tier = lowerTier(state.tier);
    if (tier === state.tier) {
      // Already at the floor. Reset the evidence rather than accumulating a
      // demotion that cannot be spent — otherwise a device that simply cannot
      // run the scene would latch on nothing but its own floor.
      return { ...state, badWindows: 0, goodWindows: 0 };
    }

    const demotions = state.demotions + 1;
    return {
      tier,
      badWindows: 0,
      goodWindows: 0,
      demotions,
      locked: state.locked || demotions >= MAX_DEMOTIONS,
    };
  }

  if (windowFps > PROMOTE_ABOVE_FPS) {
    const goodWindows = state.goodWindows + 1;
    if (goodWindows < WINDOWS_TO_PROMOTE || state.locked) {
      return { ...state, goodWindows, badWindows: 0 };
    }
    return { ...state, tier: raiseTier(state.tier), goodWindows: 0, badWindows: 0 };
  }

  // Inside the dead band: healthy enough. Decay both counters so one stutter
  // inside an otherwise fine minute never accumulates into a demotion.
  return { ...state, badWindows: 0, goodWindows: 0 };
}
