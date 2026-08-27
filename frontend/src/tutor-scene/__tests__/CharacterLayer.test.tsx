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
 * carry `pointer-events-none`. The behaviour itself is checked with real mouse
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
    expect(overlay?.className).toContain('pointer-events-none')
    expect(overlay?.className).toContain('fixed')
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
})
