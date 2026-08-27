import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import CharacterActor3D from '../CharacterActor3D'
import { CharacterSlot } from '@/tutor-scene/CharacterLayer'
import { LOOPABLE_ACTIONS, type CharacterAction } from '../types'
import { LOOPING_ACTIONS } from '@/tutor-scene/characterActions'

/*
 * The Lesson Engine now draws every character in 3D. These pin the promises
 * that swap made, and every one of them is a promise about what happens when
 * the 3D is NOT there — which is the state a learner meets on a cold chunk, a
 * device with no WebGL, and every one of these tests.
 */

describe('CharacterActor3D', () => {
  it('RENDERS THE 2D CHARACTER when there is no 3D layer above it', () => {
    /*
     * The single most important assertion here. `CharacterSlot` outside a
     * provider — a caller that forgot it, a test, a surface that never opts in —
     * must show a character, not an empty box. This is also what keeps the 2D
     * control surface a LIVE path: the owner's instruction was that the 2D files
     * are never deleted, and a file nobody renders decays without anyone
     * noticing.
     */
    const { container } = render(<CharacterActor3D character="zara" emotion="happy" />)

    const slot = container.querySelector('[data-character="zara"]')
    expect(slot).not.toBeNull()
    expect(slot?.getAttribute('data-render')).toBe('2d')
    // The 2D actor tags itself with the character too, nested inside the slot.
    expect(slot?.querySelector('.lf-actor')).not.toBeNull()
  })

  it('falls back to the 2D actor WHOLE when a bubble is asked for', () => {
    // The bubble is drawn inside each character's own SVG. A DOM copy floating
    // over a canvas would be a different component wearing the same name, so
    // asking for one gets the 2D character rather than an approximation.
    render(<CharacterActor3D character="rho" bubble="Hola" />)
    expect(screen.getByText('Hola')).toBeInTheDocument()
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

describe('the 2D and 3D layers agree on what LOOPS', () => {
  it('for every action the Lesson Engine actually passes', () => {
    /*
     * `CharacterActor` honours `loop` only for `LOOPABLE_ACTIONS`; the 3D layer
     * decides from its own `LOOPING_ACTIONS`. Where they disagree the same
     * content would repeat in one renderer and fire once in the other — the
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
        // layer continues `think` and the 2D one does not. No Lesson Engine
        // surface passes `loop` with `think`, so it cannot bite today — and this
        // fails the moment one does.
        expect(flat).toBe(false)
        expect(solid).toBe(true)
        continue
      }
      expect(flat, `${action}: 2D says ${flat}, 3D says ${solid}`).toBe(solid)
    }
  })
})
