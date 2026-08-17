import { Quaternion, type Bone, type Object3D } from 'three';

/*
 * Maps a loaded skeleton onto the canonical bone slots the action system
 * drives.
 *
 * The exports made this practical: Rho, Zara and Liruf ship the SAME 24-joint
 * skeleton with conventional names (Hips / Spine / neck / Head /
 * Left|RightShoulder-Arm-ForeArm-Hand), so one binding serves all three —
 * including the dinosaur, who is rigged as a biped. Dina is a genuine
 * quadruped on a different 27-joint rig (tail chain, front/back legs, ears)
 * and binds to a reduced slot set.
 *
 * Lookup is case-insensitive and tolerant of prefixes, because exporters
 * routinely decorate joint names ("Armature|", "mixamorig:"). A slot that
 * cannot be found stays undefined and its actions simply do not drive it —
 * a missing bone must never throw mid-frame.
 */

export type RigKind = 'biped' | 'quadruped';

export interface Rig {
  kind: RigKind;
  hips?: Bone;
  spine?: Bone;
  chest?: Bone;
  neck?: Bone;
  head?: Bone;
  leftShoulder?: Bone;
  leftArm?: Bone;
  leftForeArm?: Bone;
  rightShoulder?: Bone;
  rightArm?: Bone;
  rightForeArm?: Bone;
  /** Quadruped only. */
  tail?: Bone[];
  ears?: Bone[];
  /** Rest orientation of every bound bone, captured once. */
  base: Map<Bone, Quaternion>;
}

function collectBones(root: Object3D): Map<string, Bone> {
  const bones = new Map<string, Bone>();
  root.traverse((node) => {
    if ((node as Bone).isBone) bones.set(node.name.toLowerCase(), node as Bone);
  });
  return bones;
}

function find(bones: Map<string, Bone>, ...candidates: string[]): Bone | undefined {
  for (const candidate of candidates) {
    const exact = bones.get(candidate);
    if (exact) return exact;
  }
  // Suffix match, so "mixamorig:LeftArm" still resolves to the leftArm slot.
  for (const candidate of candidates) {
    for (const [name, bone] of bones) {
      if (name.endsWith(candidate)) return bone;
    }
  }
  return undefined;
}

function findAll(bones: Map<string, Bone>, prefix: string): Bone[] {
  return [...bones.entries()]
    .filter(([name]) => name.startsWith(prefix))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, bone]) => bone);
}

/**
 * Binds a rig. Must be called AFTER the authored clip has been evaluated into
 * a pose — the captured base orientations are what every procedural offset is
 * applied relative to, so capturing them from the bind pose instead would make
 * each action fight the character's resting posture.
 */
export function bindRig(root: Object3D): Rig {
  const bones = collectBones(root);
  const quadruped = bones.has('tail') || bones.has('frontleg');

  const rig: Rig = quadruped
    ? {
        kind: 'quadruped',
        hips: find(bones, 'hips'),
        chest: find(bones, 'chest'),
        head: find(bones, 'head'),
        tail: findAll(bones, 'tail'),
        ears: [...findAll(bones, 'earend'), ...findAll(bones, 'r_earend')],
        base: new Map(),
      }
    : {
        kind: 'biped',
        hips: find(bones, 'hips'),
        spine: find(bones, 'spine'),
        chest: find(bones, 'spine02', 'spine01'),
        neck: find(bones, 'neck'),
        head: find(bones, 'head'),
        leftShoulder: find(bones, 'leftshoulder'),
        leftArm: find(bones, 'leftarm'),
        leftForeArm: find(bones, 'leftforearm'),
        rightShoulder: find(bones, 'rightshoulder'),
        rightArm: find(bones, 'rightarm'),
        rightForeArm: find(bones, 'rightforearm'),
        base: new Map(),
      };

  for (const value of Object.values(rig)) {
    if (Array.isArray(value)) {
      for (const bone of value) rig.base.set(bone, bone.quaternion.clone());
    } else if (value && (value as Bone).isBone) {
      rig.base.set(value as Bone, (value as Bone).quaternion.clone());
    }
  }

  return rig;
}

/** Restores every bound bone to its captured rest orientation. */
export function resetRig(rig: Rig): void {
  for (const [bone, quaternion] of rig.base) bone.quaternion.copy(quaternion);
}
