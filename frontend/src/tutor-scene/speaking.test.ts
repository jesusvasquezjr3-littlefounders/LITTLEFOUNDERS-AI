import { describe, expect, it } from 'vitest'
import { Bone, Object3D, Quaternion } from 'three'
import { bindRig, forgetRestPose } from './rig'
import { applySpeaking, limitFaceLift } from './characterActions'

/*
 * `speaking` is the one behaviour the 2D-to-3D swap owed. It is ARTICULATION,
 * not lip-sync: neither rig has a jaw bone and the viseme card is fitted for
 * only two of the four characters. These pin the properties that make a
 * head-and-chest cadence safe to run every frame of every lesson.
 */

function rigOf(names: string[]) {
  const root = new Object3D()
  let parent: Object3D = root
  for (const name of names) {
    const bone = new Bone()
    bone.name = name
    // Non-identity rest orientations, as the real exports have.
    bone.quaternion.setFromAxisAngle({ x: 0, y: 1, z: 0 } as never, 0.3)
    parent.add(bone)
    parent = bone
  }
  forgetRestPose(root)
  return { root, rig: bindRig(root) }
}

const BIPED = ['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head']
const QUADRUPED = ['Hips', 'chest', 'head', 'tail', 'frontleg']

describe('applySpeaking', () => {
  it('MOVES THE HEAD — a speaking character must not stand inert', () => {
    const { root, rig } = rigOf(BIPED)
    const head = root.getObjectByName('Head') as Bone
    const rest = rig.base.get(head)!.clone()

    // Sample across a beat: at least one frame must differ from rest.
    let moved = false
    for (let t = 0; t < 1; t += 0.02) {
      head.quaternion.copy(rest)
      applySpeaking(rig, t)
      if (head.quaternion.angleTo(rest) > 0.005) moved = true
    }
    expect(moved).toBe(true)
  })

  it('works on the QUADRUPED, which is half the cast', () => {
    // The viseme card cannot serve dina and liruf at all. If this did not work
    // on her rig, "speaking" would still be half a feature.
    const { root, rig } = rigOf(QUADRUPED)
    expect(rig.kind).toBe('quadruped')
    const head = root.getObjectByName('head') as Bone
    const rest = rig.base.get(head)!.clone()
    head.quaternion.copy(rest)
    applySpeaking(rig, 0.14)
    expect(head.quaternion.angleTo(rest)).toBeGreaterThan(0)
  })

  it('STAYS SMALL — it composes on top of a gesture and must not fight it', () => {
    /*
     * The cadence is added to whatever emotion and action already wrote. An
     * amplitude big enough to read on its own would look like a glitch on top
     * of a wave, and one small enough to be invisible at 96 px is not a feature.
     * Six degrees is the ceiling: `nod` is a gesture in its own right and this
     * must never be mistaken for one.
     */
    const { root, rig } = rigOf(BIPED)
    const head = root.getObjectByName('Head') as Bone
    const rest = rig.base.get(head)!.clone()
    let peak = 0
    for (let t = 0; t < 3; t += 0.01) {
      head.quaternion.copy(rest)
      applySpeaking(rig, t)
      peak = Math.max(peak, head.quaternion.angleTo(rest))
    }
    expect(peak).toBeGreaterThan((2 * Math.PI) / 180)
    expect(peak).toBeLessThan((6 * Math.PI) / 180)
  })

  it('NEVER ACCUMULATES over a long conversation', () => {
    /*
     * This runs every frame for as long as a character is speaking, and it
     * PREMULTIPLIES. Every compounding defect in this codebase looked fine for
     * the first few frames — the remount that inherited a gesture, the rig base
     * captured from a drifted skeleton. Here the caller resets the pose each
     * frame; this asserts the property that makes that safe, by resetting the
     * way the frame loop does and checking the drift never grows.
     */
    const { root, rig } = rigOf(BIPED)
    const head = root.getObjectByName('Head') as Bone
    const rest = rig.base.get(head)!.clone()
    let worst = 0
    for (let frame = 0; frame < 600; frame += 1) {
      head.quaternion.copy(rest)
      applySpeaking(rig, frame / 60)
      worst = Math.max(worst, head.quaternion.angleTo(rest))
    }
    expect(worst).toBeLessThan((6 * Math.PI) / 180)
  })

  it('a level of zero is byte-identical to not calling it', () => {
    // The fade-in seam: a caller ramping the level must be able to reach a
    // provably untouched pose, not one that is merely close.
    const { root, rig } = rigOf(BIPED)
    const head = root.getObjectByName('Head') as Bone
    const before = head.quaternion.clone()
    applySpeaking(rig, 0.4, 0)
    expect(head.quaternion.equals(before)).toBe(true)
  })

  it('never pushes a face past the visibility cap', () => {
    // The cadence runs before `limitFaceLift`, so the cap still owns the final
    // pose — a speaking character cannot talk its own face out of frame.
    const { root, rig } = rigOf(BIPED)
    const head = root.getObjectByName('Head') as Bone
    const chest = root.getObjectByName('Spine02') as Bone
    const twist = new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 } as never, -0.5)
    head.quaternion.multiply(twist)
    chest.quaternion.multiply(twist)
    applySpeaking(rig, 0.25)
    const lift = limitFaceLift(rig)
    expect(lift).toBeGreaterThan(0)
    expect(limitFaceLift(rig)).toBeLessThanOrEqual(0.58 + 1e-6)
  })
})
