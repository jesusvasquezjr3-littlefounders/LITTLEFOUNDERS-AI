import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CharacterLayerProvider, CharacterSlot } from '../CharacterLayer'

/*
 * THE DEFECT THIS PINS SHIPPED TO PRODUCTION AND KILLED THE LESSON ENGINE.
 *
 * The character layer is a FULL-VIEWPORT overlay above the lesson's own
 * content. React Three Fiber writes `pointer-events: auto` INLINE on its own
 * container, which beats a `pointer-events: none` class inherited from a
 * wrapper — so the canvas became the topmost element over every control in the
 * product. `document.elementFromPoint` on "Start lesson" returned CANVAS and
 * the button did nothing.
 *
 * Every audit stayed green because they all drove the app with
 * `element.click()`, which dispatches straight at the node and does no
 * hit-testing. jsdom cannot hit-test either, so what is checkable HERE is the
 * contract: the layer must declare itself non-interactive, and the overlay must
 * carry `pointer-events: none` (`.lf-character-layer`). The behaviour itself is checked with real mouse
 * events in a browser.
 */

vi.mock('../CharacterLayerCanvas', () => ({
  CharacterLayerCanvas: (props: { interactive?: boolean }) => (
    <div data-testid="layer-canvas" data-interactive={String(props.interactive ?? true)} />
  ),
}))

describe('CharacterLayerProvider', () => {
  it('renders its overlay with pointer-events-none', () => {
    const { container } = render(
      <CharacterLayerProvider className="z-20">
        <button type="button">Start lesson</button>
      </CharacterLayerProvider>,
    )
    const overlay = container.querySelector('[data-character-layer]')
    expect(overlay).not.toBeNull()
    // The layer's own class (sceneCanvas.css): the Tailwind utilities load only with the OD-24 island's sheet.
    expect(overlay?.className).toContain('lf-character-layer')
    const css = readFileSync(resolve(__dirname, '../sceneCanvas.css'), 'utf8')
    expect(css).toMatch(/\.lf-character-layer \{[^}]*position: fixed;[^}]*pointer-events: none;/)
  })

  it('keeps the page it covers rendered and reachable in the DOM', () => {
    // The overlay is a SIBLING of the children, not a wrapper around them: a
    // wrapper would put every control inside a `pointer-events: none` subtree.
    const { getByText, container } = render(
      <CharacterLayerProvider>
        <button type="button">Start lesson</button>
      </CharacterLayerProvider>,
    )
    const button = getByText('Start lesson')
    const overlay = container.querySelector('[data-character-layer]')
    expect(overlay?.contains(button)).toBe(false)
  })

  it('a slot outside a provider still renders a character', () => {
    const { container } = render(<CharacterSlot character="zara" />)
    expect(container.querySelector('[data-character="zara"]')).not.toBeNull()
    expect(container.querySelector('[data-render="2d"]')).not.toBeNull()
  })

  /*
   * THE PROMISE IN THIS FILE'S OWN HEADER — "a lesson never shows a hole where
   * a character should be" — and it was not kept.
   *
   * The layer's `drawing` flag used to mean "the quality settings resolved",
   * which is true on the canvas's FIRST COMMIT: before a .glb has downloaded,
   * before a slot is measured, before a frame has drawn anything. The 2D
   * stand-in was dropped on that signal, so every failure after it — a slow
   * model, a lost WebGL context, a backgrounded tab — presented to a child as
   * an EMPTY BOX. Reproduced live in production before the fix.
   *
   * `drawing` now comes from the frame loop reporting frames it actually drew
   * (CharacterLayerCanvas), with a watchdog that puts the flat characters back
   * when they stop. jsdom cannot run that loop, so what is checkable here is
   * the contract it depends on: while the layer is not drawing, a slot INSIDE
   * a provider is still a visible 2D character and never an empty div. The
   * mocked canvas never reports a draw, which is exactly that state.
   */
  it('a slot inside a provider stays a visible 2D character until the layer draws', () => {
    const { container } = render(
      <CharacterLayerProvider>
        <CharacterSlot character="dina" />
      </CharacterLayerProvider>,
    )

    const slot = container.querySelector('[data-character="dina"]')
    expect(slot).not.toBeNull()
    expect(slot?.getAttribute('data-render')).toBe('2d')
    // The thing that actually matters: something is IN the well.
    expect(slot?.childElementCount).toBeGreaterThan(0)
  })
})
