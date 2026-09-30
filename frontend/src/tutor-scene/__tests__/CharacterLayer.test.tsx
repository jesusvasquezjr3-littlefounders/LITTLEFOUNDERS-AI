import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CharacterLayerProvider, CharacterSlot } from '../CharacterLayer'
import manifest from '@/rebuild/assets/manifest.json'
import { StaticThemeProvider } from '@/theme/useTheme'
import { findSlotStill, poseForSlot } from '../slotStill'

interface Row { id: string; path: string; slot: string; type: string; character?: string; sourceModel?: string; background?: string; poseId?: string; modes: string }
const ROWS = manifest as readonly Row[]

/** The still inside a slot is a manifest-registered, transparent render of THAT character's real model. */
function expectManifestStill(slot: Element | null, character: string, mode: 'light' | 'dark') {
  expect(slot).not.toBeNull()
  expect(slot?.getAttribute('data-render')).toBe('still')
  // Never an inline SVG character: the legacy look-alikes drew one.
  expect(slot?.querySelector('svg')).toBeNull()
  const img = slot?.querySelector('img')
  expect(img).not.toBeNull()
  expect(img?.getAttribute('alt')).toBe('')
  const row = ROWS.find((entry) => entry.path === img?.getAttribute('src'))
  expect(row, `src ${img?.getAttribute('src')} is not in the asset manifest`).toBeDefined()
  expect(row?.id).toBe(img?.getAttribute('data-still-id'))
  expect(row?.type).toBe('render')
  expect(row?.slot).toBe('mentor.avatar')
  expect(row?.background).toBe('transparent')
  expect(row?.character).toBe(character)
  expect(row?.sourceModel).toBe(`/scenes/${character}.glb`)
  expect([mode, 'both']).toContain(row?.modes)
  expect(slot?.getAttribute('data-still-pose')).toBe(row?.poseId)
}

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

  it('a slot outside a provider renders a manifest still of the real model, never an SVG look-alike', () => {
    const { container } = render(<CharacterSlot character="zara" emotion="happy" action="wave" />)
    expectManifestStill(container.querySelector('[data-character="zara"]'), 'zara', 'light')
  })

  it('picks the still for the colour mode', () => {
    const { container } = render(
      <StaticThemeProvider isDark>
        <CharacterSlot character="rho" crop="bust" />
      </StaticThemeProvider>,
    )
    const slot = container.querySelector('[data-character="rho"]')
    expectManifestStill(slot, 'rho', 'dark')
    expect(slot?.getAttribute('data-crop')).toBe('bust')
  })

  it('keeps the slot box and stays hidden from assistive technology', () => {
    const { container } = render(<CharacterSlot character="liruf" className="h-24 w-24" />)
    const slot = container.querySelector('[data-character="liruf"]')
    expect(slot?.className).toBe('h-24 w-24')
    expect(slot?.getAttribute('aria-hidden')).toBe('true')
    expect(slot?.querySelector('img')?.className).toContain('object-contain')
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
    expectManifestStill(slot, 'dina', 'light')
    // The thing that actually matters: something is IN the well.
    expect(slot?.childElementCount).toBeGreaterThan(0)
  })
})

describe('slot stills', () => {
  it('map emotion and action to the catalogue pose that expresses them', () => {
    expect(poseForSlot()).toBe('ambient.idle')
    expect(poseForSlot('neutral', 'idle')).toBe('ambient.idle')
    expect(poseForSlot('happy', 'idle')).toBe('ambient.idle.happy')
    expect(poseForSlot('happy', 'wave')).toBe('greet.hello')
    expect(poseForSlot('thinking', 'think')).toBe('think.ponder')
    // No catalogue pose holds this pair: the emotion at rest.
    expect(poseForSlot('proud', 'shake')).toBe('marketing.proud')
  })

  it('fall back to the idle avatar render when no transparent render holds the pose, and say which pose they show', () => {
    const still = findSlotStill({ character: 'zara', emotion: 'proud', action: 'celebrate', theme: 'light' })
    expect(still?.requestedPoseId).toBe('feedback.correct.proud')
    expect(still?.id).toBe('mentor.zara.avatar.light')
    expect(still?.poseId).toBe('ambient.idle')
  })

  it('never resolve one character to the render of another character', () => {
    for (const character of ['rho', 'zara', 'liruf', 'dina'] as const) {
      for (const theme of ['light', 'dark'] as const) {
        const still = findSlotStill({ character, theme })
        expect(still?.id.startsWith(`mentor.${character}.`)).toBe(true)
      }
    }
  })
})
