import { describe, expect, it } from 'vitest';
import { Bone, Object3D } from 'three';
import { bindRig, forgetRestPose, resetRig } from './rig';

/*
 * THE DEFECT THESE PIN.
 *
 * `useSceneModel` hands out ONE Object3D per character, so a remount comes back
 * to a skeleton the OUTGOING instance left mid-gesture. `bindRig` captures
 * `bone.quaternion` as the rest orientation every procedural offset is applied
 * relative to, so capturing it from a drifted skeleton bakes that drift in as
 * the new rest - and the next gesture composes on top of it.
 *
 * It compounds, and it is invisible to every screenshot, because the FIRST
 * mount is always correct. It was found by stepping the pose lab through
 * sixteen poses and returning to the first: Dina came back with her head cocked
 * and her body twisted, and forty poses in she was a ball with no face.
 */

function quadruped(): Object3D {
  const root = new Object3D();
  const hips = new Bone();
  hips.name = 'Hips';
  const chest = new Bone();
  chest.name = 'Chest';
  const head = new Bone();
  head.name = 'Head';
  // `bindRig` decides the rig KIND on an exact `tail`/`frontleg` bone, while
  // the tail CHAIN is collected by prefix - so a real quadruped export carries
  // both, and a fixture with only `Tail01` binds as a biped.
  const tail = new Bone();
  tail.name = 'Tail';
  const tailTip = new Bone();
  tailTip.name = 'Tail01';
  hips.add(chest);
  chest.add(head);
  hips.add(tail);
  tail.add(tailTip);
  root.add(hips);
  // An authored rest pose that is NOT the identity, which is the whole point:
  // an identity default would pass this test without the code being right.
  head.quaternion.set(0.1, 0.2, 0.05, 0.97).normalize();
  tail.quaternion.set(0, 0.3, 0, 0.95).normalize();
  tailTip.quaternion.set(0, 0, 0.25, 0.97).normalize();
  return root;
}

describe('bindRig rest pose', () => {
  it('captures the pose the model was LOADED in', () => {
    const root = quadruped();
    forgetRestPose(root);
    const head = root.getObjectByName('Head') as Bone;
    const authored = head.quaternion.clone();

    const rig = bindRig(root);

    expect(rig.kind).toBe('quadruped');
    expect(rig.base.get(head)?.equals(authored)).toBe(true);
  });

  it('REBINDING A DRIFTED SKELETON RETURNS THE SAME BASE, not the drift', () => {
    const root = quadruped();
    forgetRestPose(root);
    const head = root.getObjectByName('Head') as Bone;

    const first = bindRig(root);
    const firstBase = first.base.get(head)!.clone();

    // What a clamped one-shot leaves behind: the last frame of a gesture, still
    // written into the shared skeleton when the next instance mounts.
    head.quaternion.set(0.6, 0.1, 0.2, 0.76).normalize();
    const drifted = head.quaternion.clone();
    expect(drifted.equals(firstBase)).toBe(false);

    const second = bindRig(root);

    expect(second.base.get(head)!.equals(firstBase)).toBe(true);
    // And the skeleton itself is back at rest, so the gesture about to play
    // composes on the model's own posture rather than on the previous gesture.
    expect(head.quaternion.equals(firstBase)).toBe(true);
  });

  it('does not drift over many rebinds — the failure MODE was compounding', () => {
    /*
     * One rebind off by a little looks like a tuning problem. Forty of them
     * looks like a broken model, which is what the pose lab actually showed.
     * Asserting one rebind would have passed on a fix that merely halved it.
     */
    const root = quadruped();
    forgetRestPose(root);
    const head = root.getObjectByName('Head') as Bone;
    const rest = bindRig(root).base.get(head)!.clone();

    for (let i = 0; i < 40; i += 1) {
      head.quaternion.set(0.5 + i * 0.001, 0.2, 0.1, 0.83).normalize();
      bindRig(root);
    }

    expect(head.quaternion.angleTo(rest)).toBeLessThan(1e-6);
  });

  it('restores bones OUTSIDE the bound slot set', () => {
    // Clips and drivers reach bones the slot map does not name - fingers,
    // individual tail segments, ears. Snapshotting only the bound slots would
    // leave those drifting, which is the same bug with a smaller blast radius.
    const root = quadruped();
    forgetRestPose(root);
    const tail = root.getObjectByName('Tail01') as Bone;
    const authored = tail.quaternion.clone();

    bindRig(root);
    tail.quaternion.set(0.7, 0, 0, 0.71).normalize();
    bindRig(root);

    expect(tail.quaternion.equals(authored)).toBe(true);
  });

  it('resetRig still returns every bound bone to the captured base', () => {
    const root = quadruped();
    forgetRestPose(root);
    const rig = bindRig(root);
    const head = root.getObjectByName('Head') as Bone;
    const rest = rig.base.get(head)!.clone();

    head.quaternion.set(0, 0.8, 0, 0.6).normalize();
    resetRig(rig);

    expect(head.quaternion.equals(rest)).toBe(true);
  });
});
