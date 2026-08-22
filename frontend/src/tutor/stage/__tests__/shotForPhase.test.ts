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

  it('gives a live segment and an adaptation offer their own framings', () => {
    const base = { phase: 'conversing' as StagePhase, articulates: true };
    expect(shotForPhase(base)).toBe('closeup');
    expect(shotForPhase({ ...base, segmentLive: true })).toBe('over-shoulder');
    // An adaptation is a question one character asks in front of another, so it
    // outranks the segment framing even while a segment is up.
    expect(shotForPhase({ ...base, segmentLive: true, adaptationOffered: true })).toBe('two-shot');
  });

  it('never leaves a phase without a shot', () => {
    // The union and the runtime list must agree, or a phase added later maps to
    // undefined and the director damps toward a pose that does not exist.
    expect(STAGE_PHASES).toHaveLength(6);
    const covered = new Set(STAGE_PHASES.map((phase) => shotForPhase({ phase, articulates: true })));
    expect(covered.size).toBeGreaterThan(1);
  });
});
