/*
 * The closed vocabulary the game-host screens speak in, as the rebuilt UI sees
 * it. A rebuilt file imports only `src/rebuild` and `src/i18n` (the new-UI
 * boundary), so the screens cannot read the protocol's constants from
 * `src/games/kartrush`; these lists are the hand-mirrored copy, and
 * `src/games/kartrush/vocabulary.test.ts` pins them to the protocol so the two
 * cannot drift. The word lists are exactly KRV1-CONTRACT §1.
 */

export { MENTOR_CHARACTERS as MENTORS, MENTOR_NAMES, type MentorCharacter as Mentor } from '../design/assets';

export const CIRCUITS = ['jungleNeck', 'boulevard', 'fossilFire', 'factory', 'saltBay', 'glacier'] as const;
export type Circuit = typeof CIRCUITS[number];

export const MODES = ['single', 'timeTrial', 'practice'] as const;
export type Mode = typeof MODES[number];

/** The embed offers 100cc and 150cc only (contract §1). */
export const SPEEDS = ['100cc', '150cc'] as const;
export type Speed = typeof SPEEDS[number];

/** The pit-stop lens keys Core chooses (contract §5). */
export const LENSES = ['item_hold', 'drift_patient', 'drift_early', 'steady', 'swingy', 'neutral'] as const;
export type Lens = typeof LENSES[number];

export const REPLIES = ['a', 'b', 'unsure'] as const;
export type Reply = typeof REPLIES[number];

/** What the Garage lets the learner pick. */
export interface GarageSelection { circuit: Circuit; mode: Mode; driver: import('../design/assets').MentorCharacter; speed: Speed }

/** The screens of one visit (KRV1-CONTRACT §6). */
export type PlayPhase = 'garage' | 'loading' | 'gate' | 'racing' | 'paused' | 'pitstop' | 'soft' | 'closed' | 'error';
export type ClosedKind = 'limit' | 'ended' | 'disabled';
export type ErrorKind = 'webgl' | 'offline' | 'unavailable';

/** What Core said about the finished race, as the pit stop reads it. */
export type PitOutcome = { status: 'pending' } | { status: 'none' } | { status: 'failed' } | { status: 'ready'; lens: Lens };
