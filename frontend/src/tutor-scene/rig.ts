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

/*
 * THE REST POSE OF A SHARED MODEL, CAPTURED ONCE AND ONLY ONCE.
 *
 * `useSceneModel` hands out ONE Object3D per character, deliberately - the
 * model is downloaded, decoded and uploaded to the GPU a single time. So when a
 * character remounts, the bones it comes back to are not the ones it was
 * authored with: they are wherever the OUTGOING instance left them, which after
 * a clamped one-shot is the last frame of that gesture.
 *
 * `bindRig` captures `bone.quaternion` as the rest orientation every procedural
 * offset is applied relative to. Capturing that from a drifted skeleton bakes
 * the drift in as the new rest, and the next gesture composes on top of it.
 * MEASURED: stepping the pose lab through sixteen poses and returning to the
 * first one did not return to the first POSE - Dina came back with her head
 * cocked and her body twisted, and by the fortieth she was a ball with no face.
 * It compounds, so the first mount is always right and every screenshot and
 * every test exercises exactly that one.
 *
 * The fix is to remember what the model looked like when it was LOADED, and to
 * restore that before capturing. The snapshot covers every bone rather than the
 * bound slots alone, because clips and drivers reach bones the slot set does
 * not name - fingers, individual tail segments, ears.
 *
 * A WeakMap keyed on the model root: the entry dies with the cached model, and
 * nothing has to be told when that happens.
 */
const REST_POSE = new WeakMap<Object3D, Map<Bone, Quaternion>>();

function restoreRestPose(root: Object3D): void {
  const known = REST_POSE.get(root);
  if (known) {
    for (const [bone, quaternion] of known) bone.quaternion.copy(quaternion);
    return;
  }
  // FIRST bind of this model: the bones are as loaded, so this IS the rest
  // pose. Recording it here is what makes the first mount byte-identical to
  // what it was before this existed, and every later mount identical to the
  // first.
  const snapshot = new Map<Bone, Quaternion>();
  root.traverse((node) => {
    if ((node as Bone).isBone) snapshot.set(node as Bone, (node as Bone).quaternion.clone());
  });
  REST_POSE.set(root, snapshot);
}

/** Test seam: forget a model's remembered rest pose. */
export function forgetRestPose(root: Object3D): void {
  REST_POSE.delete(root);
}

/**
 * Binds a rig. Must be called AFTER the authored clip has been evaluated into
 * a pose — the captured base orientations are what every procedural offset is
 * applied relative to, so capturing them from the bind pose instead would make
 * each action fight the character's resting posture.
 */
/**
 * Which kind of rig this model carries, derived from the model ALONE.
 *
 * Exported and pure because the answer must be available during RENDER. It used
 * to be React state set from `bindRig` in an effect, which lags the model by one
 * render — invisible in the Tutor, where a character's element never changes
 * identity, and a real defect in a lesson, where ONE narrator slot shows dina on
 * this segment and liruf on the next. For that one render the component held
 * "biped" while already holding Dina's skeleton, so the shared biped clip
 * library was played on a 27-joint quadruped: 23 `THREE.PropertyBinding: No
 * target node found for track: LeftUpLeg.quaternion` warnings, and a gesture
 * silently dropped on the floor.
 */
export function rigKindOf(root: Object3D): RigKind {
  const bones = collectBones(root);
  return bones.has('tail') || bones.has('frontleg') ? 'quadruped' : 'biped';
}

export function bindRig(root: Object3D): Rig {
  // Before anything is measured: put the shared skeleton back where it was
  // loaded, so the base captured below is the model's rest pose and not the
  // previous instance's last frame. See REST_POSE above.
  restoreRestPose(root);
  const bones = collectBones(root);
  const quadruped = rigKindOf(root) === 'quadruped';

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
