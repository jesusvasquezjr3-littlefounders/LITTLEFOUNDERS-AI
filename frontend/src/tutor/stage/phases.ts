import type { CharacterId } from '@/components/characters/control/types';
import type { ShotId } from '@/tutor-scene/shots';

/*
 * The phase vocabulary, and the one function that turns a phase into a camera
 * shot.
 *
 * SPLIT OUT OF `StageShell` ON PURPOSE, for the same reason `shots.ts` imports
 * nothing: this file is pure, so the mapping can be unit-tested without a GPU, a
 * socket or a WebGL context. `StageShell` pulls in `three` through the renderer,
 * and a test that has to boot the renderer to check an arithmetic table is a
 * test nobody runs. `StageShell` re-exports everything here, so product code
 * still has one place to import from.
 */

/**
 * The phases of a session, as the STAGE sees them.
 *
 * Named for what the camera is doing rather than for what the client is
 * fetching, because that is the only thing the shell reacts to. The product
 * lifecycle these correspond to is /ORACLE.md §9.
 */
export type StagePhase =
  /** Waiting on the token, the preferences and the island. The wide, living shot. */
  | 'arriving'
  /** Making the place theirs, in the place itself (/ORACLE.md §10). */
  | 'personalizing'
  /** The tutor greets and offers, in close-up. */
  | 'introducing'
  /** The lesson itself. */
  | 'conversing'
  /** The kind goodbye: a pull back to the island, not a summary box. */
  | 'closing'
  /** The Tutor API could not be reached. The island stays; the talking rests. */
  | 'unavailable';

/**
 * The runtime mirror of the union.
 *
 * Written out rather than derived, so `satisfies` fails to compile when the two
 * drift. A phase the union knows about and this list does not is a phase no
 * test ever visits.
 */
export const STAGE_PHASES = [
  'arriving',
  'personalizing',
  'introducing',
  'conversing',
  'closing',
  'unavailable',
] as const satisfies readonly StagePhase[];

/**
 * Who should be STANDING on the island, beyond the tutor and their companion.
 *
 * The whole cast, and only while it is being chosen from. Before this existed,
 * the picker hung a name plate at each stage mark while the scene rendered two
 * characters, so two of the four plates floated over empty grass and "choose
 * your tutor by looking at them" was a menu laid out in world coordinates.
 *
 * It is a function rather than a ternary at the call site so that the one
 * sentence this feature rests on — the candidates are really there, during
 * exactly one phase — is a thing a test can ask about without a renderer.
 * Returns null, never an empty array: null is what the scene reads as "the
 * ordinary cast", and an empty audition would be an island with nobody on it.
 */
export function auditionFor(
  phase: StagePhase,
  characters: readonly CharacterId[] | undefined,
): readonly CharacterId[] | null {
  if (phase !== 'personalizing') return null;
  return characters && characters.length > 0 ? characters : null;
}

/** Everything the shot choice depends on, and nothing else. */
export interface StageShotInput {
  phase: StagePhase;
  /**
   * True when the speaking character's mouth actually moves.
   *
   * `liruf` and `dina` have no mouth card (/TUTOR_3D.md §7.1), so closing the
   * camera on them frames the one thing that is not working. They get
   * `closeup-wide` instead: off-axis, further back, hands in shot. That is
   * /ORACLE.md §2.2's PRIMARY decision ("they frame wider"), not the fallback
   * that shipped, which left them at the island shot where nothing about them
   * was legible either.
   */
  articulates: boolean;
  /** True while the tutor is waiting on an answer to an adaptation offer. */
  adaptationOffered?: boolean;
  /*
   * THERE IS DELIBERATELY NO `segmentLive` HERE ANY MORE. Removed 2026-08-21.
   *
   * It used to swing the camera to `over-shoulder` the moment an activity
   * reached the plate, and what that put on a 375 px phone was the back of the
   * tutor's head, filling the screen, with one ear in the middle of it. The
   * geometry is dissected in `shots.ts` beside the shot's own removal.
   *
   * The mapping was wrong before the geometry was: three authoritative
   * documents say a live segment must not change the framing at all.
   * /ORACLE.md §9.3 — "the character's on-screen height is the same with a
   * segment and without one; a lesson that visibly shoves the tutor aside to
   * make room for itself reads as two products sharing a screen". /ORACLE.md
   * §16 makes it a shipping gate — "the character's measured on-screen height
   * unchanged with and without a live segment". /DESIGN.md → Screen Recipes →
   * Tutor repeats it as "identical". Every shot in the vocabulary sits at its
   * own distance, so ANY shot change changes that height; the flag therefore
   * cannot legally reach this function.
   *
   * Getting the tutor out from behind the plate is `composition.ts`'s job, and
   * it does it by shifting the AIM and never the distance, which is exactly the
   * property those three sentences are asking for.
   */
}

/** Which shot a phase is. */
export function shotForPhase({
  phase,
  articulates,
  adaptationOffered = false,
}: StageShotInput): ShotId {
  const speaking: ShotId = articulates ? 'closeup' : 'closeup-wide';

  switch (phase) {
    case 'arriving':
    case 'unavailable':
      return 'establishing';
    case 'personalizing':
      // Walked in, not cut to. The learner is about to change this place, so
      // the camera closes the distance to it first.
      return 'approach';
    case 'introducing':
      return speaking;
    case 'conversing':
      /*
       * An adaptation is a question one character asks in front of another, so
       * it wants both of them in frame (/ORACLE.md §9.4). It is the ONLY thing
       * that moves the camera during a conversation: an arriving activity does
       * not, because the plate is chrome laid over the same shot rather than a
       * new scene, and the learner should not feel the room change because a
       * question appeared.
       */
      if (adaptationOffered) return 'two-shot';
      return speaking;
    case 'closing':
      // The pull back IS the goodbye (/ORACLE.md §9.5). The director damps
      // toward it over roughly two seconds, and that travel is the performance.
      return 'establishing';
  }
}
