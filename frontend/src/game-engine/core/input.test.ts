// Pointer-layer + stage-scaling regression tests. These cover the three failure
// modes v1's per-game drag code kept re-introducing — a tap being swallowed as a
// drag, a drop landing on the wrong (or no) zone, and the synthetic click firing a
// second action after a drag — plus the scaling maths at both mandated breakpoints
// (~375px mobile and ~1280px desktop, /CLAUDE.md §1.11).
//
// jsdom implements neither PointerEvent, ResizeObserver nor elementFromPoint, so
// each is stubbed explicitly here rather than assumed.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { DRAG_THRESHOLD_PX, resolveDropZone, useGameDrag, useTapPlacement } from './input'
import { computeStage, useStageScale } from './stage'

// ---- fixtures ---------------------------------------------------------------

/** A React pointer event carries far more than the hook reads; only the fields the
 *  hook actually uses are provided. */
function reactPointerDown(x: number, y: number, pointerId = 1): ReactPointerEvent {
  return { button: 0, clientX: x, clientY: y, pointerId } as unknown as ReactPointerEvent
}

/** jsdom has no PointerEvent constructor: a MouseEvent of the right type reaches
 *  the same listeners, and `pointerId` is attached by hand. */
function firePointer(type: 'pointermove' | 'pointerup' | 'pointercancel', x: number, y: number, pointerId = 1) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, cancelable: true, bubbles: true })
  Object.assign(event, { pointerId })
  act(() => {
    window.dispatchEvent(event)
  })
}

function makeZone(id: string): { zone: HTMLElement; child: HTMLElement } {
  const zone = document.createElement('div')
  zone.setAttribute('data-dropzone', id)
  const child = document.createElement('span')
  zone.appendChild(child)
  document.body.appendChild(zone)
  return { zone, child }
}

/** Point `document.elementFromPoint` at a fixed element (jsdom does no layout). */
function stubElementFromPoint(el: Element | null) {
  const doc = document as Document & { elementFromPoint: (x: number, y: number) => Element | null }
  doc.elementFromPoint = () => el
}

function clearElementFromPoint() {
  Reflect.deleteProperty(document, 'elementFromPoint')
}

/** Yield one macrotask so the suppress-click guard's `setTimeout(..., 0)` runs. */
async function nextTick() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

afterEach(() => {
  document.body.innerHTML = ''
  clearElementFromPoint()
})

// ---- resolveDropZone --------------------------------------------------------

describe('resolveDropZone', () => {
  it('resolves the nearest [data-dropzone] ancestor of the element under the pointer', () => {
    const { child } = makeZone('bucket-a')
    stubElementFromPoint(child)
    expect(resolveDropZone(10, 10)).toBe('bucket-a')
  })

  it('returns null when nothing under the pointer is inside a drop zone', () => {
    const loose = document.createElement('div')
    document.body.appendChild(loose)
    stubElementFromPoint(loose)
    expect(resolveDropZone(10, 10)).toBeNull()
  })

  it('returns null instead of throwing where elementFromPoint does not exist', () => {
    clearElementFromPoint()
    expect(resolveDropZone(10, 10)).toBeNull()
  })
})

// ---- useGameDrag ------------------------------------------------------------

describe('useGameDrag', () => {
  it('treats a movement under the threshold as a tap, not a drag', () => {
    const onDrop = vi.fn()
    const onMove = vi.fn()
    const { child } = makeZone('bucket-a')
    stubElementFromPoint(child)

    const { result } = renderHook(() => useGameDrag({ onDrop, onMove }))
    act(() => {
      result.current.dragHandleProps('item-1').onPointerDown(reactPointerDown(100, 100))
    })
    // 3px of jitter — a finger never lands perfectly still.
    firePointer('pointermove', 100 + (DRAG_THRESHOLD_PX - 3), 100)

    expect(result.current.drag).toBeNull()
    expect(onMove).not.toHaveBeenCalled()

    firePointer('pointerup', 100 + (DRAG_THRESHOLD_PX - 3), 100)
    expect(onDrop).not.toHaveBeenCalled()
    expect(result.current.drag).toBeNull()
  })

  it('drags past the threshold and drops on the zone under the pointer', () => {
    const onDrop = vi.fn()
    const onMove = vi.fn()
    const { child } = makeZone('bucket-a')
    stubElementFromPoint(child)

    const { result } = renderHook(() => useGameDrag({ onDrop, onMove }))
    act(() => {
      result.current.dragHandleProps('item-1').onPointerDown(reactPointerDown(100, 100))
    })
    firePointer('pointermove', 140, 100)

    expect(result.current.drag).toEqual({ itemId: 'item-1', x: 140, y: 100, zone: 'bucket-a' })
    expect(result.current.hoverZone).toBe('bucket-a')
    expect(result.current.isDragging('item-1')).toBe(true)
    expect(onMove).toHaveBeenCalledTimes(1)

    firePointer('pointerup', 140, 100)
    expect(onDrop).toHaveBeenCalledWith('item-1', 'bucket-a')
    expect(result.current.drag).toBeNull()
  })

  it('drops nothing when the drag ends outside every zone', () => {
    const onDrop = vi.fn()
    const loose = document.createElement('div')
    document.body.appendChild(loose)
    stubElementFromPoint(loose)

    const { result } = renderHook(() => useGameDrag({ onDrop }))
    act(() => {
      result.current.dragHandleProps('item-1').onPointerDown(reactPointerDown(0, 0))
    })
    firePointer('pointermove', 60, 60)
    firePointer('pointerup', 60, 60)

    expect(onDrop).not.toHaveBeenCalled()
  })

  it('ignores a drag while disabled', () => {
    const onDrop = vi.fn()
    const { child } = makeZone('bucket-a')
    stubElementFromPoint(child)

    const { result } = renderHook(() => useGameDrag({ onDrop, disabled: true }))
    act(() => {
      result.current.dragHandleProps('item-1').onPointerDown(reactPointerDown(0, 0))
    })
    firePointer('pointermove', 60, 60)
    firePointer('pointerup', 60, 60)

    expect(result.current.drag).toBeNull()
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('suppresses only the synthetic click of the drag gesture, then clears itself', async () => {
    const onDrop = vi.fn()
    const { child } = makeZone('bucket-a')
    stubElementFromPoint(child)

    const { result } = renderHook(() => useGameDrag({ onDrop }))
    act(() => {
      result.current.dragHandleProps('item-1').onPointerDown(reactPointerDown(100, 100))
    })
    firePointer('pointermove', 140, 100)
    firePointer('pointerup', 140, 100)

    const dragClick = { preventDefault: vi.fn(), stopPropagation: vi.fn() }
    result.current.dragHandleProps('item-1').onClickCapture(dragClick as unknown as ReactMouseEvent)
    expect(dragClick.preventDefault).toHaveBeenCalledTimes(1)
    expect(dragClick.stopPropagation).toHaveBeenCalledTimes(1)

    // The guard must not survive the gesture: the very next real tap has to work.
    await nextTick()
    const laterTap = { preventDefault: vi.fn(), stopPropagation: vi.fn() }
    result.current.dragHandleProps('item-1').onClickCapture(laterTap as unknown as ReactMouseEvent)
    expect(laterTap.preventDefault).not.toHaveBeenCalled()
  })

  it('never suppresses the click of a plain tap', () => {
    const onDrop = vi.fn()
    const { child } = makeZone('bucket-a')
    stubElementFromPoint(child)

    const { result } = renderHook(() => useGameDrag({ onDrop }))
    act(() => {
      result.current.dragHandleProps('item-1').onPointerDown(reactPointerDown(100, 100))
    })
    firePointer('pointermove', 102, 100)
    firePointer('pointerup', 102, 100)

    const tap = { preventDefault: vi.fn(), stopPropagation: vi.fn() }
    result.current.dragHandleProps('item-1').onClickCapture(tap as unknown as ReactMouseEvent)
    expect(tap.preventDefault).not.toHaveBeenCalled()
  })

  it('honours a custom threshold', () => {
    const onDrop = vi.fn()
    const { child } = makeZone('bucket-a')
    stubElementFromPoint(child)

    const { result } = renderHook(() => useGameDrag({ onDrop, threshold: 40 }))
    act(() => {
      result.current.dragHandleProps('item-1').onPointerDown(reactPointerDown(0, 0))
    })
    firePointer('pointermove', 20, 0)
    expect(result.current.drag).toBeNull()
    firePointer('pointermove', 50, 0)
    expect(result.current.drag).not.toBeNull()
  })
})

// ---- useTapPlacement --------------------------------------------------------

describe('useTapPlacement', () => {
  it('places a selected item on the tapped zone (the drag-free path, §1.11)', () => {
    const onPlace = vi.fn()
    const { result } = renderHook(() => useTapPlacement({ onPlace }))

    act(() => result.current.select('item-1'))
    expect(result.current.selected).toBe('item-1')
    expect(result.current.itemProps('item-1')['aria-pressed']).toBe(true)

    act(() => result.current.place('bucket-a'))
    expect(onPlace).toHaveBeenCalledWith('item-1', 'bucket-a')
    expect(result.current.selected).toBeNull()
  })

  it('toggles selection off and places nothing without a selection', () => {
    const onPlace = vi.fn()
    const { result } = renderHook(() => useTapPlacement({ onPlace }))

    act(() => result.current.select('item-1'))
    act(() => result.current.select('item-1'))
    expect(result.current.selected).toBeNull()

    act(() => result.current.place('bucket-a'))
    expect(onPlace).not.toHaveBeenCalled()
  })

  it('exposes the same data-dropzone attribute the drag path resolves', () => {
    const onPlace = vi.fn()
    const { result } = renderHook(() => useTapPlacement({ onPlace }))
    expect(result.current.zoneProps('bucket-a')['data-dropzone']).toBe('bucket-a')
  })

  it('does nothing while disabled', () => {
    const onPlace = vi.fn()
    const { result } = renderHook(() => useTapPlacement({ onPlace, disabled: true }))
    act(() => result.current.select('item-1'))
    expect(result.current.selected).toBeNull()
    expect(result.current.itemProps('item-1').disabled).toBe(true)
  })
})

// ---- computeStage / useStageScale -------------------------------------------

const DESIGN = { designWidth: 900, designHeight: 540 }

describe('computeStage', () => {
  it("letterboxes in 'contain' mode on a 375px mobile viewport", () => {
    const m = computeStage({ ...DESIGN, containerWidth: 375, containerHeight: 600, mode: 'contain' })
    expect(m.scale).toBeCloseTo(375 / 900, 10)
    expect(m.width).toBe(900)
    expect(m.height).toBe(540)
    expect(m.cssWidth).toBeCloseTo(375, 10)
    expect(m.cssHeight).toBeCloseTo(225, 10)
    expect(m.offsetX).toBeCloseTo(0, 10)
    expect(m.offsetY).toBeCloseTo(187.5, 10)
    expect(m.measured).toBe(true)
  })

  it("letterboxes in 'contain' mode on a 1280px desktop viewport", () => {
    const m = computeStage({ ...DESIGN, containerWidth: 1280, containerHeight: 800, mode: 'contain' })
    // Width binds here (1280/900 < 800/540), so the bars are horizontal-free and
    // vertical: the desktop stage uses the full width and centres vertically.
    expect(m.scale).toBeCloseTo(1280 / 900, 10)
    expect(m.cssWidth).toBeCloseTo(1280, 10)
    expect(m.cssHeight).toBeCloseTo(540 * (1280 / 900), 10)
    expect(m.offsetX).toBeCloseTo(0, 10)
    expect(m.offsetY).toBeCloseTo((800 - 540 * (1280 / 900)) / 2, 10)
  })

  it("lets height bind in 'contain' mode on a short, wide container", () => {
    const m = computeStage({ ...DESIGN, containerWidth: 1280, containerHeight: 400, mode: 'contain' })
    expect(m.scale).toBeCloseTo(400 / 540, 10)
    expect(m.cssHeight).toBeCloseTo(400, 10)
    expect(m.offsetY).toBeCloseTo(0, 10)
    expect(m.offsetX).toBeGreaterThan(0)
  })

  it("fills and reflows the design space in 'fluid' mode", () => {
    const mobile = computeStage({ ...DESIGN, containerWidth: 375, containerHeight: 600, mode: 'fluid' })
    expect(mobile.scale).toBeCloseTo(375 / 900, 10)
    expect(mobile.width).toBeCloseTo(900, 10)
    expect(mobile.height).toBeCloseTo(600 / (375 / 900), 10) // taller design space
    expect(mobile.cssWidth).toBe(375)
    expect(mobile.cssHeight).toBe(600)
    expect(mobile.offsetX).toBe(0)
    expect(mobile.offsetY).toBe(0)

    const desktop = computeStage({ ...DESIGN, containerWidth: 1280, containerHeight: 800, mode: 'fluid' })
    expect(desktop.scale).toBeCloseTo(1280 / 900, 10)
    expect(desktop.height).toBeCloseTo(800 / (1280 / 900), 10) // shorter design space
  })

  it('caps upscaling at maxScale', () => {
    const m = computeStage({ ...DESIGN, containerWidth: 2700, containerHeight: 1620, mode: 'contain', maxScale: 2 })
    expect(m.scale).toBe(2)
    expect(m.cssWidth).toBe(1800)
  })

  it('falls back to the unscaled design box while the container is unmeasured', () => {
    const m = computeStage({ ...DESIGN, containerWidth: 0, containerHeight: 0, mode: 'contain' })
    expect(m.measured).toBe(false)
    expect(m.scale).toBe(1)
    expect(m.cssWidth).toBe(900)
  })
})

// A minimal ResizeObserver (jsdom ships none) whose callback can be driven by hand.
class ResizeObserverStub {
  static last: ResizeObserverStub | null = null
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ResizeObserverStub.last = this
  }

  observe() {}
  unobserve() {}
  disconnect() {}

  emit(width: number, height: number, left = 0, top = 0) {
    const contentRect = {
      width,
      height,
      left,
      top,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }
    const entry = { contentRect } as ResizeObserverEntry
    act(() => {
      this.callback([entry], this as unknown as ResizeObserver)
    })
  }
}

describe('useStageScale', () => {
  beforeEach(() => {
    ResizeObserverStub.last = null
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver')
  })

  it('reports scale and design size from the observed content box, in both modes', () => {
    const contain = renderHook(() => useStageScale({ ...DESIGN, mode: 'contain' }))
    const host = document.createElement('div')
    document.body.appendChild(host)
    act(() => contain.result.current.ref(host))

    expect(contain.result.current.measured).toBe(false) // jsdom lays nothing out
    ResizeObserverStub.last?.emit(375, 600)
    expect(contain.result.current.measured).toBe(true)
    expect(contain.result.current.scale).toBeCloseTo(375 / 900, 10)
    expect(contain.result.current.height).toBe(540)
    expect(contain.result.current.stageStyle.height).toBe('225px')

    ResizeObserverStub.last?.emit(1280, 800)
    expect(contain.result.current.scale).toBeCloseTo(1280 / 900, 10)

    const fluid = renderHook(() => useStageScale({ ...DESIGN, mode: 'fluid' }))
    const host2 = document.createElement('div')
    document.body.appendChild(host2)
    act(() => fluid.result.current.ref(host2))
    ResizeObserverStub.last?.emit(1280, 800)
    expect(fluid.result.current.scale).toBeCloseTo(1280 / 900, 10)
    expect(fluid.result.current.height).toBeCloseTo(800 / (1280 / 900), 10)
  })

  it('converts design coordinates to CSS px and pointer coordinates back to design space', () => {
    const { result } = renderHook(() => useStageScale({ ...DESIGN, mode: 'contain' }))
    const host = document.createElement('div')
    // DOMRect exposes its fields as prototype getters, so a plain object literal is
    // the only stub that survives being read field by field.
    host.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 900,
      bottom: 1080,
      width: 900,
      height: 1080,
      toJSON: () => ({}),
    })
    document.body.appendChild(host)
    act(() => result.current.ref(host))
    ResizeObserverStub.last?.emit(900, 1080)

    expect(result.current.scale).toBe(1)
    expect(result.current.offsetY).toBe(270) // (1080 - 540) / 2
    expect(result.current.toStage(100, 50)).toEqual({ x: 100, y: 50 })
    // A tap at the stage's top-left corner maps to design origin.
    expect(result.current.toDesign(0, 270)).toEqual({ x: 0, y: 0 })
  })

  it('applies safe-area padding by default and drops it on request', () => {
    const withSafe = renderHook(() => useStageScale(DESIGN))
    expect(withSafe.result.current.containerStyle.paddingBottom).toBe('env(safe-area-inset-bottom, 0px)')

    const without = renderHook(() => useStageScale({ ...DESIGN, safeArea: false }))
    expect(without.result.current.containerStyle.paddingBottom).toBeUndefined()
  })
})
