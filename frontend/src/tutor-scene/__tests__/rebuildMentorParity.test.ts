import { describe, expect, it } from 'vitest';
import { CHARACTER_ACTIONS, CHARACTER_EMOTIONS, CHARACTER_IDS } from '@/components/characters/control/types';
import { SHOT_IDS } from '../shots';
import { poseById, POSES } from '../poseLibrary';
import { HELD_ACTION_PROGRESS, LOOPING_ACTIONS } from '../characterActions';
import * as vocabulary from '@/rebuild/mentor/session/vocabulary';
import { MENTOR_STAGE_POSES, MENTOR_STAGE_STATES, resolveMentorPose } from '@/rebuild/mentor/stageStates';
import { MENTOR_CHARACTERS } from '@/rebuild/design/assets';

/*
 * The rebuilt Mentor (W2 Mentor lane) may not import the engine it drives,
 * except through the named stage bridge (Frontend Bible 02 rule 23,
 * `npm run spec:check`), so it writes out the engine's vocabulary and names
 * catalogue poses by id. This file lives beside the engine, which may import
 * the rebuilt code, and fails the moment either side drifts.
 */
describe('rebuilt Mentor ↔ 3D engine parity', () => {
  it('speaks exactly the engine vocabulary: characters, emotions, actions and shots', () => {
    expect([...vocabulary.CHARACTER_IDS].sort()).toEqual([...CHARACTER_IDS].sort());
    expect([...MENTOR_CHARACTERS].sort()).toEqual([...CHARACTER_IDS].sort());
    expect([...vocabulary.CHARACTER_EMOTIONS]).toEqual([...CHARACTER_EMOTIONS]);
    expect([...vocabulary.CHARACTER_ACTIONS]).toEqual([...CHARACTER_ACTIONS]);
    expect([...vocabulary.MENTOR_SHOTS]).toEqual([...SHOT_IDS]);
  });

  it('plays every Mentor stage state with a real catalogue pose, as the catalogue defines it (02 §11 item 14)', () => {
    expect(MENTOR_STAGE_POSES.length).toBeGreaterThan(0);
    for (const pose of MENTOR_STAGE_POSES) {
      const row = poseById(pose.id);
      expect(row, pose.id).not.toBeNull();
      expect({ emotion: row!.emotion, action: row!.action }, pose.id).toEqual({ emotion: pose.emotion, action: pose.action });
      for (const character of CHARACTER_IDS) expect(row!.only ? row!.only.includes(character) : true, `${pose.id} ${character}`).toBe(true);
    }
    for (const state of MENTOR_STAGE_STATES) for (const ageBand of ['6-9', '10-12', '13-17', 'adult'] as const) {
      expect(POSES.map((row) => row.id), `${ageBand} ${state}`).toContain(resolveMentorPose({ state, ageBand, milestone: 'badge-earned' }).pose.id);
    }
  });

  it('holds every action at one frame under reduced motion, and never in the air (08 §7)', () => {
    expect(Object.keys(HELD_ACTION_PROGRESS).sort()).toEqual([...CHARACTER_ACTIONS].sort());
    for (const action of CHARACTER_ACTIONS) {
      const progress = HELD_ACTION_PROGRESS[action];
      expect(progress, action).toBeGreaterThanOrEqual(0);
      expect(progress, action).toBeLessThanOrEqual(1);
    }
    // The travel actions hold at rest; a gesture holds at a visible frame, not at its start or end (where the arc is zero).
    expect(HELD_ACTION_PROGRESS.jump).toBe(0);
    expect(HELD_ACTION_PROGRESS.hop).toBe(0);
    for (const action of ['wave', 'point', 'nod', 'bow', 'peek', ...LOOPING_ACTIONS] as const) {
      expect(HELD_ACTION_PROGRESS[action], action).toBeGreaterThan(0);
      expect(HELD_ACTION_PROGRESS[action], action).toBeLessThan(1);
    }
  });
});
