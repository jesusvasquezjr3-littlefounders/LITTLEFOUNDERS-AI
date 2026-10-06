/*
 * Play limits for games in /learn (docs/games/KRV1-CONTRACT.md section 3; design
 * 5.5). The platform sets a ceiling, mirroring the Mentor's own daily limits;
 * a verified guardian may only lower it, never raise it. Active time counts
 * only while the tab is visible and the game frame focused (heartbeats), so a
 * learner who walks away is not charged for it and a hidden tab earns nothing.
 *
 * Pure, so every boundary is a table-driven test; nothing here reads a clock
 * or the database.
 */

export const PLATFORM_MAX_SESSIONS_PER_DAY = 2;
export const PLATFORM_MAX_SESSION_MINUTES = 25;
export const MIN_SESSION_MINUTES = 5;
/** The calm break card appears after at most this many active minutes. */
export const SOFT_BREAK_MINUTES = 15;
/** The break card is always at least this long before the hard stop. */
export const SOFT_LEAD_MINUTES = 5;
/** Without a visible, focused heartbeat for this long the session is idle and closes. */
export const IDLE_MS = 10 * 60_000;
/** A heartbeat credits at most this much elapsed time, so a long gap is never billed as play. */
export const MAX_CREDIT_SECONDS = 90;
/** A session's wall-clock life is its active minutes plus this slack, so a tab left open all afternoon cannot keep reporting. */
export const SESSION_SLACK_MINUTES = 10;

/** How long a new session lives on the wall clock, whatever the active clock says (database: reopening never exceeds the same bound). */
export function sessionLifeMs(maxSessionMinutes: number): number {
  return (capsFor(maxSessionMinutes).hardMs / 60_000 + SESSION_SLACK_MINUTES) * 60_000;
}

export interface PlayLimits {
  maxSessionsPerDay: number;
  maxSessionMinutes: number;
}

export const PLATFORM_LIMITS: PlayLimits = {
  maxSessionsPerDay: PLATFORM_MAX_SESSIONS_PER_DAY,
  maxSessionMinutes: PLATFORM_MAX_SESSION_MINUTES,
};

export interface Caps {
  softMs: number;
  hardMs: number;
  idleMs: number;
}

/** soft = max(1, min(15, hardMinutes - 5)) minutes. */
export function capsFor(maxSessionMinutes: number): Caps {
  const hardMinutes = Math.min(PLATFORM_MAX_SESSION_MINUTES, Math.max(MIN_SESSION_MINUTES, Math.floor(maxSessionMinutes)));
  const softMinutes = Math.max(1, Math.min(SOFT_BREAK_MINUTES, hardMinutes - SOFT_LEAD_MINUTES));
  return { softMs: softMinutes * 60_000, hardMs: hardMinutes * 60_000, idleMs: IDLE_MS };
}

/** The sessions a learner may start today: the guardian's number, never above the platform's. */
export function dailySessionCap(limits: PlayLimits): number {
  return Math.max(0, Math.min(PLATFORM_MAX_SESSIONS_PER_DAY, Math.floor(limits.maxSessionsPerDay)));
}

export type SessionState = 'ok' | 'soft' | 'hard' | 'idle';

/**
 * The state a heartbeat reports. `idleGapMs` is the time between the previous
 * visible, focused heartbeat and this one. Hard wins over idle: a session that
 * is out of time is out of time whether or not the learner also wandered off.
 */
export function sessionState(input: { activeSeconds: number; maxSessionMinutes: number; idleGapMs: number }): SessionState {
  const caps = capsFor(input.maxSessionMinutes);
  const activeMs = input.activeSeconds * 1000;
  if (activeMs >= caps.hardMs) return 'hard';
  if (input.idleGapMs > caps.idleMs) return 'idle';
  if (activeMs >= caps.softMs) return 'soft';
  return 'ok';
}
