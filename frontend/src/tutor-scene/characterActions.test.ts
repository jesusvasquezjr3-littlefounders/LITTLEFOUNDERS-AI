import { describe, expect, it } from 'vitest';
import { Bone, Object3D, Quaternion } from 'three';
import { bindRig, resetRig } from './rig';
import { applyCharacterFrame, ACTION_SECONDS } from './characterActions';
import { CHARACTER_ACTIONS, CHARACTER_EMOTIONS } from '@/components/characters/control/types';

/*
 * Builds the exact 24-joint biped skeleton the character exports ship, so the
 * tests exercise the real bone names rather than an idealised rig.
 */
function buildBiped(): Object3D {
  const root = new Object3D();
  const names = [
    'Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
    'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
    'Spine02', 'Spine01', 'Spine', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'neck', 'Head', 'head_end', 'headfront',
  ];
  let parent: Object3D = root;
  for (const name of names) {
    const bone = new Bone();
    bone.name = name;
    // A non-identity rest orientation on every bone — the point of the
    // premultiply regression below is that it must hold with real rest poses,
    // and an identity skeleton would hide the bug entirely.
    bone.quaternion.setFromAxisAngle({ x: 0, y: 1, z: 0 } as never, 0.4);
    parent.add(bone);
    parent = bone;
  }
  return root;
}

function buildQuadruped(): Object3D {
  const root = new Object3D();
  for (const name of ['Hips', 'chest', 'head', 'tail', 'tail1', 'tail2', 'earend', 'frontleg']) {
    const bone = new Bone();
    bone.name = name;
    root.add(bone);
  }
  return root;
}

describe('bindRig', () => {
  it('binds every biped slot from the shipped joint names', () => {
    const rig = bindRig(buildBiped());
    expect(rig.kind).toBe('biped');
    for (const slot of ['hips', 'spine', 'chest', 'neck', 'head', 'leftArm', 'rightArm', 'rightForeArm'] as const) {
      expect(rig[slot], slot).toBeDefined();
    }
  });

  it('detects the quadruped rig and collects its tail chain', () => {
    const rig = bindRig(buildQuadruped());
    expect(rig.kind).toBe('quadruped');
    expect(rig.head).toBeDefined();
    expect(rig.tail?.length).toBeGreaterThan(1);
  });

  it('restores the captured rest pose exactly', () => {
    const rig = bindRig(buildBiped());
    const before = rig.head!.quaternion.clone();
    rig.head!.quaternion.set(0.5, 0.5, 0.5, 0.5);
    resetRig(rig);
    expect(rig.head!.quaternion.angleTo(before)).toBeLessThan(1e-6);
  });
});

describe('applyCharacterFrame', () => {
  /*
   * THE REGRESSION THIS FILE EXISTS FOR.
   *
   * The first implementation post-multiplied (`quaternion.multiply`), rotating
   * each bone about its OWN axes. On these rigs a bone's local +Y runs along
   * its length, so the intended arm swing came out as a twist around the limb
   * — mathematically a real rotation, visually nothing at all. Type-checking,
   * linting and every structural assertion passed; only a screenshot revealed
   * it. Asserting that a gesture actually MOVES the bone it targets is what
   * closes that gap.
   */
  it('wave visibly rotates the waving arm away from its rest pose', () => {
    const rig = bindRig(buildBiped());
    const rest = rig.rightArm!.quaternion.clone();
    resetRig(rig);
    applyCharacterFrame(rig, 'neutral', 'wave', { progress: 0.5, time: 0.5, lift: 0 });
    // A wave that moves the arm less than ~11° is not a wave.
    expect(rig.rightArm!.quaternion.angleTo(rest)).toBeGreaterThan(0.2);
  });

  /*
   * Sampled across the whole arc, not at a single instant: the oscillating
   * gestures (nod, shake) cross zero at exactly progress 0.5, so a one-shot
   * probe there reports "moved nothing" for a driver that is working
   * perfectly. An action is required to move something SOMEWHERE, not
   * everywhere.
   */
  it('every action moves at least one bone somewhere in its arc', () => {
    for (const action of CHARACTER_ACTIONS) {
      if (action === 'idle') continue;
      const rig = bindRig(buildBiped());
      const rest = [...rig.base].map(([bone]) => bone.quaternion.clone());

      const moved = [0.1, 0.25, 0.5, 0.75, 0.9].some((progress) => {
        resetRig(rig);
        applyCharacterFrame(rig, 'neutral', action, { progress, time: progress * 2, lift: 0 });
        return [...rig.base].some(([bone], i) => bone.quaternion.angleTo(rest[i]!) > 1e-3);
      });

      expect(moved, `${action} moved nothing at any point in its arc`).toBe(true);
    }
  });

  it('emotion posture survives an action that touches the same bone', () => {
    const neutral = bindRig(buildBiped());
    resetRig(neutral);
    applyCharacterFrame(neutral, 'neutral', 'nod', { progress: 0.25, time: 0, lift: 0 });
    const neutralHead = neutral.head!.quaternion.clone();

    const proud = bindRig(buildBiped());
    resetRig(proud);
    applyCharacterFrame(proud, 'proud', 'nod', { progress: 0.25, time: 0, lift: 0 });

    // If the action assigned instead of accumulating, `proud` would be erased
    // and both heads would land on the identical orientation.
    expect(proud.head!.quaternion.angleTo(neutralHead)).toBeGreaterThan(1e-3);
  });

  it('accepts every emotion and action without throwing on a rig missing bones', () => {
    const sparse = new Object3D();
    const lonely = new Bone();
    lonely.name = 'Hips';
    sparse.add(lonely);
    const rig = bindRig(sparse);
    for (const emotion of CHARACTER_EMOTIONS) {
      for (const action of CHARACTER_ACTIONS) {
        resetRig(rig);
        expect(() => applyCharacterFrame(rig, emotion, action, { progress: 0.5, time: 1, lift: 0 })).not.toThrow();
      }
    }
  });

  it('returns lift only for the actions that leave the ground', () => {
    const rig = bindRig(buildBiped());
    resetRig(rig);
    const jump = applyCharacterFrame(rig, 'neutral', 'jump', { progress: 0.5, time: 0, lift: 0 });
    resetRig(rig);
    const nod = applyCharacterFrame(rig, 'neutral', 'nod', { progress: 0.5, time: 0, lift: 0 });
    expect(jump).toBeGreaterThan(0.2);
    expect(nod).toBe(0);
  });

  it('declares a duration for every action', () => {
    for (const action of CHARACTER_ACTIONS) {
      expect(ACTION_SECONDS[action], action).toBeTypeOf('number');
    }
  });
});

describe('quaternion sanity', () => {
  it('keeps bone orientations normalised after a frame', () => {
    const rig = bindRig(buildBiped());
    resetRig(rig);
    applyCharacterFrame(rig, 'excited', 'dance', { progress: 0.3, time: 2.2, lift: 0 });
    for (const [bone] of rig.base) {
      expect(Math.abs(new Quaternion().copy(bone.quaternion).length() - 1)).toBeLessThan(1e-6);
    }
  });
});
