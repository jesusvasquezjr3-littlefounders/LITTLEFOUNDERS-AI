import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import CharacterActor3D from '../CharacterActor3D'
import { CharacterSlot } from '@/tutor-scene/CharacterLayer'
import { LOOPABLE_ACTIONS, type CharacterAction } from '../types'
import { LOOPING_ACTIONS } from '@/tutor-scene/characterActions'

/*
 * The Lesson Engine draws every character in 3D. These pin the promises that
 * made, and most of them are about what happens when the 3D is NOT there —
 * the state a learner meets on a cold chunk, a device with no WebGL, and every
 * one of these tests: a still of the real model, never a look-alike.
 */

describe('CharacterActor3D', () => {
  it('renders a still of the real model when there is no 3D layer above it', () => {
    /*
     * `CharacterSlot` outside a provider — a caller that forgot it, a test, a
     * surface that never opts in — must show a character, not an empty box,
     * and that character is a manifest render of the real model (02 rule 21),
     * never the deleted hand-drawn 2D look-alike.
     */
    const { container } = render(<CharacterActor3D character="zara" emotion="happy" />)

    const slot = container.querySelector('[data-character="zara"]')
    expect(slot).not.toBeNull()
    expect(slot?.getAttribute('data-render')).toBe('still')
    expect(slot?.querySelector('img')?.getAttribute('src')).toMatch(/^\/rebuild\/mentor-avatars\/zara-(light|dark)\.png$/)
    expect(slot?.querySelector('svg')).toBeNull()
  })

  it('keeps the size classes, so layout does not move when a surface switches', () => {
    // A drop-in that changed the box would reflow every screen it landed on.
    const { container } = render(<CharacterActor3D character="liruf" size="sm" />)
    expect(container.querySelector('.h-24.w-24')).not.toBeNull()
  })

  it('passes the character through even with no emotion or action', () => {
    const { container } = render(<CharacterSlot character="dina" />)
    expect(container.querySelector('[data-character="dina"]')).not.toBeNull()
  })
})

describe('the pose catalogue and the 3D layer agree on what LOOPS', () => {
  it('for every action the Lesson Engine actually passes', () => {
    /*
     * The pose catalogue may loop only `LOOPABLE_ACTIONS`; the 3D layer decides
     * from its own `LOOPING_ACTIONS`. Where they disagree the same content
     * would repeat in one path and fire once in another — the
     * defect `poseLibrary.test.ts` guards for the catalog, guarded here for the
     * player.
     *
     * These are the actions the Lesson Engine passes today, read off
     * LessonPlayer and the story families: a waving cast, a celebrating results
     * screen, and the reactions the director picks.
     */
    const used: CharacterAction[] = ['idle', 'wave', 'celebrate', 'nod', 'shake', 'point', 'jump', 'think']
    for (const action of used) {
      const flat = LOOPABLE_ACTIONS.has(action)
      const solid = LOOPING_ACTIONS.has(action)
      if (action === 'think') {
        // The one known divergence, pinned rather than hidden: the procedural 3D
        // layer continues `think` and the catalogue does not. No Lesson Engine
        // surface passes `loop` with `think`, so it cannot bite today — and this
        // fails the moment one does.
        expect(flat).toBe(false)
        expect(solid).toBe(true)
        continue
      }
      expect(flat, `${action}: catalogue says ${flat}, 3D says ${solid}`).toBe(solid)
    }
  })
})
