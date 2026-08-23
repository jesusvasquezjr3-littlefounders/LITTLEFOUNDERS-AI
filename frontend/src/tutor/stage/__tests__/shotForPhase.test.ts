import { describe, expect, it } from 'vitest';
import { shotForPhase, STAGE_PHASES, type StagePhase } from '../phases';
import { SHOT_IDS } from '@/tutor-scene/shots';

/*
 * The phase-to-shot mapping, tested headless.
 *
 * It is pure arithmetic over two closed unions, so it can be checked without a
 * GPU, a socket or a browser — which matters more here than it sounds: framing
 * mistakes on this stage have historically only ever been found by looking at
 * them, and looking requires a running Oracle and a DeepSeek balance. A shot
 * that silently degrades to the island view is indistinguishable from one that
 * is framed correctly, until somebody screenshots it.
 */

describe('shotForPhase', () => {
  it('names a real shot for every phase, in both articulation states', () => {
    for (const phase of STAGE_PHASES) {
      for (const articulates of [true, false]) {
        const shot = shotForPhase({ phase, articulates });
        expect(SHOT_IDS, `${phase} / articulates=${articulates}`).toContain(shot);
      }
    }
  });

  it('opens wide and alive, and closes by pulling back to the same shot', () => {
    // The goodbye is a camera move, not a screen (/ORACLE.md §9.5), so the
    // close has to land on the shot the session opened at.
    expect(shotForPhase({ phase: 'arriving', articulates: true })).toBe('establishing');
    expect(shotForPhase({ phase: 'closing', articulates: true })).toBe('establishing');
  });

  it('walks the camera in rather than cutting to the tutor', () => {
    expect(shotForPhase({ phase: 'personalizing', articulates: true })).toBe('approach');
  });

  it('frames liruf and dina wider instead of on a mouth that cannot move', () => {
    // /ORACLE.md §2.2's PRIMARY decision. The shipped behaviour applied its
    // fallback instead and left them at the island shot, where nothing about
    // them was legible either.
    expect(shotForPhase({ phase: 'introducing', articulates: true })).toBe('closeup');
    expect(shotForPhase({ phase: 'introducing', articulates: false })).toBe('closeup-wide');
  });

  it('gives the adaptation offer its own framing, and nothing else during a conversation', () => {
    const base = { phase: 'conversing' as StagePhase, articulates: true };
    expect(shotForPhase(base)).toBe('closeup');
    // An adaptation is a question one character asks in front of another
    // (/ORACLE.md §9.4), so it is the one thing that moves the camera here.
    expect(shotForPhase({ ...base, adaptationOffered: true })).toBe('two-shot');
    expect(shotForPhase({ ...base, articulates: false })).toBe('closeup-wide');
  });

  it('cannot be told that a segment is live, because a segment may not move the camera', () => {
    /*
     * THE DEFECT, AS A TYPE. `segmentLive: true` used to return `over-shoulder`,
     * which at 375x812 filled the phone with the back of Dr Rho's head and one
     * ear. Three authoritative documents forbid the framing change that caused
     * it — /ORACLE.md §9.3, /ORACLE.md §16's shipping gate, and /DESIGN.md →
     * Screen Recipes → Tutor all say the character's on-screen height is
     * IDENTICAL with and without a live segment — and every shot in the
     * vocabulary sits at its own distance, so any shot change breaks that.
     *
     * The guard is therefore the input shape itself rather than an assertion
     * about a return value: `StageShotInput` has no `segmentLive` field, so a
     * call site that reintroduces the coupling fails `npm run type-check`
     * instead of failing a screenshot six weeks later. `@ts-expect-error` is the
     * assertion — it FAILS if the property ever becomes assignable again.
     */
    // @ts-expect-error — a live segment must never reach the shot mapping.
    expect(shotForPhase({ phase: 'conversing', articulates: true, segmentLive: true })).toBe('closeup');
  });

  it('replays a conversation at the shot it happened at, and ends it by pulling back', () => {
    /*
     * A REPLAY IS THE SESSION HAPPENING AGAIN (/ORACLE.md §12), so the camera
     * does what it did: the speaking shot for the length of the conversation,
     * and the same pull back to the island that IS the goodbye (§9.5). A replay
     * that simply stopped on a close-up would end by freezing on a face.
     *
     * The articulation split carries over unchanged, because its reason is the
     * character's mouth (/TUTOR_3D.md §3.1) and not the tense.
     */
    expect(shotForPhase({ phase: 'replaying', articulates: true })).toBe('closeup');
    expect(shotForPhase({ phase: 'replaying', articulates: false })).toBe('closeup-wide');
    expect(shotForPhase({ phase: 'replaying', articulates: true, replayEnded: true })).toBe('establishing');
  });

  it('never leaves a phase without a shot', () => {
    // The union and the runtime list must agree, or a phase added later maps to
    // undefined and the director damps toward a pose that does not exist.
    expect(STAGE_PHASES).toHaveLength(7);
    const covered = new Set(STAGE_PHASES.map((phase) => shotForPhase({ phase, articulates: true })));
    expect(covered.size).toBeGreaterThan(1);
  });
});
