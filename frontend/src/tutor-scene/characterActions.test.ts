import { describe, expect, it } from 'vitest';
import { Bone, Object3D, Quaternion } from 'three';
import { bindRig, resetRig } from './rig';
import {
  applyCharacterFrame,
  ACTION_SECONDS,
  CLIP_LIFT,
  arc,
  limitFaceLift,
  MAX_FACE_LIFT,
} from './characterActions';
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

describe('CLIP_LIFT', () => {
  it('covers exactly the actions that leave the ground', () => {
    // A clip carries the crouch, extension and landing as rotations; the
    // TRAVEL is the runtime's, because a distance baked in the authoring rig's
    // units is neither correct on another skeleton nor scaled to the jumper.
    expect(Object.keys(CLIP_LIFT).sort()).toEqual(['hop', 'jump']);
  });

  it('lifts more for a jump than a hop, and both by a fraction of height', () => {
    expect(CLIP_LIFT.jump!).toBeGreaterThan(CLIP_LIFT.hop!);
    for (const amount of Object.values(CLIP_LIFT)) {
      expect(amount).toBeGreaterThan(0);
      expect(amount).toBeLessThan(1);
    }
  });

  it('peaks in the middle of the action and returns to the ground', () => {
    // A jump that ends off zero leaves the character hovering; one that starts
    // off zero teleports on the first frame.
    expect(arc(0)).toBeCloseTo(0, 6);
    expect(arc(1)).toBeCloseTo(0, 6);
    expect(arc(0.5)).toBeCloseTo(1, 6);
  });
});

/*
 * THE LEARNER MUST BE ABLE TO SEE THE FACE.
 *
 * Measured on the live skeleton, chest + neck + head against the rest pose:
 * `marketing.banner` (neutral + celebrate) lifts the face 30.5 degrees and
 * reads perfectly; `celebrate.lesson` (proud + celebrate) lifted it 59.7, put
 * Zara's chin at the camera, and held it there for the whole loop — on the
 * results screen of a finished lesson. Neither layer is wrong alone, which is
 * why the rule cannot live in either of them.
 */
describe('limitFaceLift', () => {
  /** Rotates a bone about X, the way a lean does, on top of its rest pose. */
  function pitch(bone: Bone, radians: number): void {
    const twist = new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 } as never, radians);
    bone.quaternion.multiply(twist);
  }

  function bipedRig() {
    const root = buildBiped();
    const rig = bindRig(root);
    const chest = root.getObjectByName('Spine02') as Bone;
    const neck = root.getObjectByName('neck') as Bone;
    const head = root.getObjectByName('Head') as Bone;
    return { rig, chest, neck, head };
  }

  it('LEAVES A POSE UNDER THE LIMIT EXACTLY ALONE', () => {
    /*
     * The most important assertion here. A cap that quietly re-poses every
     * character would be a much bigger change than the defect it fixes, and it
     * would be invisible — everyone would just think the cast looked slightly
     * different. Byte-identical, not approximately identical.
     */
    const { rig, chest, head } = bipedRig();
    pitch(chest, -0.2);
    pitch(head, -0.25);
    const chestBefore = chest.quaternion.clone();
    const headBefore = head.quaternion.clone();

    const lift = limitFaceLift(rig);

    expect(lift).toBeCloseTo(0.45, 6);
    expect(chest.quaternion.equals(chestBefore)).toBe(true);
    expect(head.quaternion.equals(headBefore)).toBe(true);
  });

  it('pulls an over-lifted pose back to exactly the limit', () => {
    const { rig, chest, neck, head } = bipedRig();
    pitch(chest, -0.42);
    pitch(neck, -0.04);
    pitch(head, -0.58);

    const before = limitFaceLift(rig);
    expect(before).toBeCloseTo(1.04, 6);

    // Re-measuring is what the next frame does, so this is the real check.
    expect(limitFaceLift(rig)).toBeCloseTo(MAX_FACE_LIFT, 5);
  });

  it('keeps the SHAPE of the gesture — every bone is scaled by the same factor', () => {
    // Clamping one joint to soak up the whole excess would fix the number and
    // break the pose: a celebration would end up with a bent neck on a
    // straight back.
    const { rig, chest, head } = bipedRig();
    pitch(chest, -0.3);
    pitch(head, -0.9);

    limitFaceLift(rig);

    const restChest = rig.base.get(chest)!;
    const restHead = rig.base.get(head)!;
    const chestNow = restChest.clone().invert().multiply(chest.quaternion);
    const headNow = restHead.clone().invert().multiply(head.quaternion);
    const chestAngle = 2 * Math.atan2(chestNow.x, chestNow.w);
    const headAngle = 2 * Math.atan2(headNow.x, headNow.w);
    // The original ratio was 0.3 : 0.9, so it must still be 1 : 3.
    expect(headAngle / chestAngle).toBeCloseTo(3, 4);
  });

  it('is IDEMPOTENT — a second call on the same frame changes nothing', () => {
    /*
     * This runs once per frame, forever. Every compounding defect in this
     * codebase looked fine the first time: the remount that inherited the
     * previous gesture, the rig base captured from a drifted skeleton. A cap
     * that shaved a few degrees off every frame would bow the character over
     * in about a second.
     */
    const { rig, chest, head } = bipedRig();
    pitch(chest, -0.5);
    pitch(head, -0.7);
    limitFaceLift(rig);
    const chestSettled = chest.quaternion.clone();
    const headSettled = head.quaternion.clone();

    for (let i = 0; i < 120; i += 1) limitFaceLift(rig);

    expect(chest.quaternion.angleTo(chestSettled)).toBeLessThan(1e-9);
    expect(head.quaternion.angleTo(headSettled)).toBeLessThan(1e-9);
  });

  it('never touches a forward lean — a bow is a real gesture', () => {
    const { rig, chest, head } = bipedRig();
    pitch(chest, 0.9);
    pitch(head, 0.6);
    const chestBefore = chest.quaternion.clone();
    const headBefore = head.quaternion.clone();

    expect(limitFaceLift(rig)).toBe(0);
    expect(chest.quaternion.equals(chestBefore)).toBe(true);
    expect(head.quaternion.equals(headBefore)).toBe(true);
  });

  it('a forward-leaning bone does not buy budget for a backward-leaning one', () => {
    // Summing signed twists would let a deep bow at the chest pay for a head
    // thrown all the way back, which is a stranger pose than either.
    const { rig, chest, head } = bipedRig();
    pitch(chest, 1.0);
    pitch(head, -0.9);

    expect(limitFaceLift(rig)).toBeCloseTo(0.9, 6);
    expect(limitFaceLift(rig)).toBeCloseTo(MAX_FACE_LIFT, 5);
  });

  it('works on the quadruped, which has no neck slot', () => {
    const root = buildQuadruped();
    const rig = bindRig(root);
    expect(rig.kind).toBe('quadruped');
    const head = root.getObjectByName('head') as Bone;
    pitch(head, -1.2);

    expect(limitFaceLift(rig)).toBeCloseTo(1.2, 6);
    expect(limitFaceLift(rig)).toBeCloseTo(MAX_FACE_LIFT, 5);
  });
});
