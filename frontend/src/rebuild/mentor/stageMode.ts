/*
 * How the Mentor stage renders on this device (Frontend Bible 08 §7), as a
 * pure decision so every branch is tested without a GPU:
 *
 *   live   the real-time 3D character on its Diorama, animated;
 *   held   the same real-time 3D, each pose HELD at one frame and switched by a
 *          short cross-fade: `prefers-reduced-motion` (08 §7, 04 §3). The idle
 *          loop stops and every state stays visible;
 *   still  pre-rendered stills of the same character (07 §4): no WebGL, a
 *          low-power device, data saver on, a device that cannot hold the
 *          frame-rate floor, or a renderer that failed. The layout does not
 *          change.
 */

export type MentorStageMode = 'live' | 'held' | 'still';
export type MentorStageFallback = 'no-webgl' | 'low-power' | 'data-saver' | 'frame-rate' | 'render-error';
export type MentorStageFailure = Extract<MentorStageFallback, 'frame-rate' | 'render-error'>;

/** First render of the stage on a mid-range phone (08 §7). */
export const FIRST_RENDER_BUDGET_MS = 2500;
/** The steady frame-rate floor (08 §7). */
export const FRAME_RATE_FLOOR = 30;
/**
 * Consecutive one-second readings under the floor, at the renderer's lowest
 * quality tier, before the stage gives up on real-time 3D. Above the lowest
 * tier the renderer's own governor steps quality down first.
 */
export const FRAME_RATE_STRIKES = 3;

export interface StageEnvironment {
  /** The browser can create a WebGL context. */
  webgl: boolean;
  /** The renderer's device probe starts this device at its lowest tier. */
  lowPower: boolean;
  /** The browser asks for reduced data use (`navigator.connection.saveData`). */
  saveData: boolean;
  /** `prefers-reduced-motion: reduce`. */
  reducedMotion: boolean;
}

export interface StageModeDecision {
  mode: MentorStageMode;
  /** Why the stage is not live, when it falls back to stills; null otherwise. */
  fallback: MentorStageFallback | null;
}

export function decideStageMode(environment: StageEnvironment, failure: MentorStageFailure | null = null): StageModeDecision {
  if (failure) return { mode: 'still', fallback: failure };
  if (!environment.webgl) return { mode: 'still', fallback: 'no-webgl' };
  if (environment.saveData) return { mode: 'still', fallback: 'data-saver' };
  if (environment.lowPower) return { mode: 'still', fallback: 'low-power' };
  return { mode: environment.reducedMotion ? 'held' : 'live', fallback: null };
}

/** Folds one renderer reading into the count of consecutive readings under the floor at the lowest tier. */
export function frameRateStrikes(strikes: number, reading: { fps: number; tier: string }): number {
  if (reading.tier !== 'low' || reading.fps <= 0) return 0;
  return reading.fps < FRAME_RATE_FLOOR ? strikes + 1 : 0;
}
