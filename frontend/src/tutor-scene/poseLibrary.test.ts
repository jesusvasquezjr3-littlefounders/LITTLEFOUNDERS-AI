import { describe, expect, it } from 'vitest';
import {
  CHARACTER_ACTIONS,
  CHARACTER_EMOTIONS,
  CHARACTER_IDS,
} from '@/components/characters/control/types';
import { LOOPABLE_ACTIONS } from '@/components/characters/control/types';
import { LOOPING_ACTIONS } from './characterActions';
import { POSES, POSE_IDS, poseById, posesByCategory, resolvePose } from './poseLibrary';

/*
 * The pose library is CONTENT, and content that names a thing which does not
 * exist fails at the moment a learner sees it rather than at build time. These
 * assertions are what make a row in that catalog a promise the code can keep.
 */

describe('pose library', () => {
  it('carries at least 50 poses — the size the library was commissioned at', () => {
    expect(POSES.length).toBeGreaterThanOrEqual(50);
  });

  it('has no duplicate ids, because an id is how content addresses a pose', () => {
    expect(new Set(POSE_IDS).size).toBe(POSE_IDS.length);
  });

  it('every pose resolves to a REAL emotion and a REAL action', () => {
    // The whole design rests on poses being expressed in the vocabulary both
    // rigs already speak. A typo here would render as a silent idle.
    for (const pose of POSES) {
      expect(CHARACTER_EMOTIONS, pose.id).toContain(pose.emotion);
      expect(CHARACTER_ACTIONS, pose.id).toContain(pose.action);
    }
  });

  it('only loops actions that CAN loop', () => {
    /*
     * `ACTION_DURATION_MS` auto-returns a one-shot to idle, so asking a `nod`
     * to loop does not produce a repeating nod - it produces one nod and a
     * flag nobody honours. The 2D control layer names the loopable set; this
     * asserts the catalog agrees with it rather than inventing its own.
     */
    for (const pose of POSES.filter((p) => p.loop)) {
      expect(LOOPABLE_ACTIONS.has(pose.action), `${pose.id} loops a one-shot action`).toBe(true);
    }
  });

  it('documents what every pose is FOR', () => {
    // The `use` field is the reason this file beats enumerating 7x12. A blank
    // one turns the catalog back into a grid.
    for (const pose of POSES) {
      expect(pose.use.trim().length, pose.id).toBeGreaterThan(10);
    }
  });

  it('every pose is playable by every character', () => {
    /*
     * DINA INCLUDED, and this is the assertion that keeps her that way. The
     * first draft of the library marked every pose needing hands as
     * biped-only, which would have dropped her from most of the catalog —
     * while `characterActions.ts` already carries a QUADRUPED driver for all
     * twelve actions, expressed through head, chest, ears and tail.
     *
     * A pose narrowed with `only` must therefore be a deliberate,
     * character-specific piece, never a quiet exclusion of the quadruped.
     */
    for (const pose of POSES) {
      for (const id of CHARACTER_IDS) {
        expect(resolvePose(pose.id, id), `${pose.id} for ${id}`).not.toBeNull();
      }
    }
    expect(POSES.filter((p) => p.only)).toEqual([]);
  });

  it('resolves an unknown id to null rather than guessing', () => {
    expect(poseById('greet.doesnotexist')).toBeNull();
    expect(resolvePose('greet.doesnotexist', 'zara')).toBeNull();
  });

  it('covers every category with more than one option', () => {
    // A category with a single pose is a category the caller has no choice in,
    // which means it is not a category — it is one pose with a label.
    for (const [category, poses] of posesByCategory()) {
      expect(poses.length, category).toBeGreaterThan(1);
    }
  });

  it('gives the Lesson Engine a pose for every moment it actually has', () => {
    /*
     * The moments the player genuinely reaches, from LessonPlayer: a right
     * answer, a wrong one, a hint, a completed lesson, and the resting state
     * between them. A library that cannot name these is decoration.
     */
    for (const id of [
      'ambient.idle',
      'feedback.correct',
      'feedback.retry',
      'feedback.hint',
      'celebrate.lesson',
      'think.wait',
    ]) {
      expect(poseById(id), id).not.toBeNull();
    }
  });

  it('THE TWO RENDERERS AGREE ON WHAT LOOPS — and today they do not', () => {
    /*
     * `clipLibrary.ts` says of its LOOPING_CLIPS set: "Must agree with LOOPING
     * in `scripts/author-clips.py` and with LOOPING_ACTIONS in
     * `characterActions.ts` - three sources, one truth, and the test below is
     * what keeps them from drifting."
     *
     * The test below it does no such thing: it asserts that `celebrate@rho`
     * resolves and is loopable, and never compares the sets. They have since
     * drifted — the 3D procedural layer loops `think`, the 2D one does not, and
     * the clip set loops `idle` instead. That divergence is real and is left
     * alone here, because `LOOPING_CLIPS` (which authored clips play in loop
     * mode) and `LOOPING_ACTIONS` (which procedural actions continue) are not
     * the same question, and collapsing them would be a guess.
     *
     * What the CATALOG must guarantee is narrower and checkable: a pose looks
     * the same whichever renderer draws it. So it takes the intersection, and
     * this asserts it — including the part that would silently break if someone
     * "fixed" the divergence by widening the 2D set.
     */
    const shared = [...LOOPABLE_ACTIONS].filter((a) => LOOPING_ACTIONS.has(a));
    for (const pose of POSES.filter((p) => p.loop)) {
      expect(shared, `${pose.id} loops in only one renderer`).toContain(pose.action);
    }
    // The divergence itself, pinned so a change to either set is deliberate.
    expect([...LOOPABLE_ACTIONS].sort()).toEqual(['celebrate', 'dance']);
    expect([...LOOPING_ACTIONS].sort()).toEqual(['celebrate', 'dance', 'think']);
  });
});
