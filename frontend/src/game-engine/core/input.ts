// The ONE pointer layer for every mechanic (GAME_ENGINE.md §10). v1 re-implemented
// dragging inside each game; here a mechanic wires `useGameDrag` + `useTapPlacement`
// and gets the same feel, the same thresholds and the same accessibility posture.
//
// The implementation follows the proven in-repo pattern of `useSortingDrag` in
// `frontend/src/lesson-engine/families/arrange/components.tsx`: native Pointer
// Events (no drag-and-drop dependency), a movement threshold before a gesture
// counts as a drag, `preventDefault` on move once dragging so touch-scroll stops,
// drop resolution through `elementFromPoint(...).closest('[data-dropzone]')`, and a
// suppress-click guard cleared on the NEXT TICK so a drag that ends over a zone
// (which fires no click) cannot leave the guard stuck and eat the next real tap.
//
// ACCESSIBILITY — NON-NEGOTIABLE (/CLAUDE.md §1.11, GAME_ENGINE.md §10):
// drag is PROGRESSIVE ENHANCEMENT, never the only way to act. Every mechanic view
// that spreads `dragHandleProps` MUST also wire `useTapPlacement` on the same items
// and zones: select an item with one tap, place it with a second tap on the target.
// Mobile has no hover and a touch drag is not always available to a child with a
// motor impairment, so a drag-only affordance is a bug, not a style choice.
// Every control built on these hooks is at least 44x44px (`HIT_TARGET_CLASS`).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

/** The attribute that marks a drop target. One attribute for BOTH input paths:
 *  `useGameDrag` resolves it under the pointer, `useTapPlacement` puts it on the
 *  same element it makes tappable. */
export const DROP_ZONE_ATTR = 'data-dropzone'

/** Movement (in CSS px) a pointer must travel before the gesture becomes a drag.
 *  Below it the gesture is a TAP and the element's own onClick runs untouched. */
export const DRAG_THRESHOLD_PX = 6

/** Minimum hit area for every control these hooks drive (§1.11: >= 44x44px). */
export const HIT_TARGET_CLASS = 'min-h-11 min-w-11'

/** Applied to a draggable element so the browser does not steal the gesture for
 *  scrolling before the threshold is crossed. */
const DRAG_HANDLE_STYLE: CSSProperties = { touchAction: 'none' }

export interface StagePointerPosition {
  /** Client (viewport) coordinates. Convert to design space with `toDesign` from
   *  `core/stage.ts` when the mechanic renders inside a scaled stage. */
  x: number
  y: number
}

export interface GameDragState extends StagePointerPosition {
  itemId: string
  /** The drop zone id currently under the pointer, or `null` over empty space. */
  zone: string | null
}

export interface UseGameDragOptions {
  /** Called once, on release, when the drag ended over a drop zone. */
  onDrop: (itemId: string, zoneId: string) => void
  /** Called on every move once the threshold is crossed (ghost rendering, hover). */
  onMove?: (state: GameDragState) => void
  /** Defaults to `DRAG_THRESHOLD_PX`. */
  threshold?: number
  disabled?: boolean
}

export interface GameDragHandleProps {
  onPointerDown: (event: ReactPointerEvent) => void
  onClickCapture: (event: ReactMouseEvent) => void
  style: CSSProperties
}

export interface GameDrag {
  /** Null until the threshold is crossed — a tap never produces a drag state. */
  drag: GameDragState | null
  hoverZone: string | null
  isDragging: (itemId: string) => boolean
  /** Spread onto the draggable element. The element keeps its own onClick: the
   *  tap path is untouched, and only the synthetic click of a real drag gesture
   *  is swallowed. */
  dragHandleProps: (itemId: string) => GameDragHandleProps
}

interface ActiveDrag {
  itemId: string
  x0: number
  y0: number
  pointerId: number
  threshold: number
  moved: boolean
}

/**
 * Resolve the drop zone under a pair of client coordinates, or `null`.
 *
 * `document.elementFromPoint` does not exist in jsdom (and would not exist in any
 * non-DOM host), so a missing implementation resolves to "no zone" instead of
 * throwing: a pointer layer must never be able to crash a running game.
 */
export function resolveDropZone(x: number, y: number, doc: Document = document): string | null {
  if (typeof doc.elementFromPoint !== 'function') return null
  const el = doc.elementFromPoint(x, y)
  if (!(el instanceof Element)) return null
  return el.closest(`[${DROP_ZONE_ATTR}]`)?.getAttribute(DROP_ZONE_ATTR) ?? null
}

/**
 * Pointer drag for game items. ADDITIVE over tap — see the accessibility note at
 * the top of this file.
 */
export function useGameDrag(options: UseGameDragOptions): GameDrag {
  const [drag, setDrag] = useState<GameDragState | null>(null)
  const active = useRef<ActiveDrag | null>(null)
  const suppressClick = useRef(false)
  const suppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Window listeners are attached once per gesture and must not be re-created by a
  // re-render mid-drag, so the handlers read the LATEST options through a ref and
  // keep a stable identity for the component's lifetime.
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  // One AbortController per gesture removes all three listeners at once, which
  // keeps the end handler from having to reference itself.
  const gesture = useRef<AbortController | null>(null)
  const stop = useCallback(() => {
    gesture.current?.abort()
    gesture.current = null
  }, [])

  const handleMove = useCallback((event: globalThis.PointerEvent) => {
    const a = active.current
    if (!a || event.pointerId !== a.pointerId) return
    const dx = event.clientX - a.x0
    const dy = event.clientY - a.y0
    // Squared comparison: no Math.hypot, no square root, no rounding surprises.
    if (!a.moved && dx * dx + dy * dy < a.threshold * a.threshold) return
    a.moved = true
    event.preventDefault() // stop touch-scroll once a real drag has started
    const next: GameDragState = {
      itemId: a.itemId,
      x: event.clientX,
      y: event.clientY,
      zone: resolveDropZone(event.clientX, event.clientY),
    }
    setDrag(next)
    latest.current.onMove?.(next)
  }, [])

  const handleEnd = useCallback(
    (event: globalThis.PointerEvent) => {
      const a = active.current
      if (!a || event.pointerId !== a.pointerId) return
      stop()
      if (a.moved) {
        const zone = resolveDropZone(event.clientX, event.clientY)
        if (zone) latest.current.onDrop(a.itemId, zone)
        // Swallow ONLY the click the browser synthesises for this same gesture
        // (it fires when the drag ended on the origin element). Auto-clear on the
        // next tick so a drag ending over a zone — which fires no click at all —
        // does not leave the guard raised and eat the player's next genuine tap.
        suppressClick.current = true
        if (suppressTimer.current) clearTimeout(suppressTimer.current)
        suppressTimer.current = setTimeout(() => {
          suppressClick.current = false
          suppressTimer.current = null
        }, 0)
      }
      active.current = null
      setDrag(null)
    },
    [stop],
  )

  useEffect(
    () => () => {
      stop()
      if (suppressTimer.current) clearTimeout(suppressTimer.current)
    },
    [stop],
  )

  const onPointerDown = useCallback(
    (itemId: string) => (event: ReactPointerEvent) => {
      if (latest.current.disabled || event.button !== 0) return
      stop()
      const controller = new AbortController()
      gesture.current = controller
      active.current = {
        itemId,
        x0: event.clientX,
        y0: event.clientY,
        pointerId: event.pointerId,
        threshold: latest.current.threshold ?? DRAG_THRESHOLD_PX,
        moved: false,
      }
      window.addEventListener('pointermove', handleMove, {
        passive: false,
        signal: controller.signal,
      })
      window.addEventListener('pointerup', handleEnd, { signal: controller.signal })
      window.addEventListener('pointercancel', handleEnd, { signal: controller.signal })
    },
    [handleEnd, handleMove, stop],
  )

  const onClickCapture = useCallback((event: ReactMouseEvent) => {
    if (!suppressClick.current) return
    // Deliberately NOT cleared here: the timer owns the guard's lifetime, so a
    // drag that ends off-element (and fires no click) still clears it.
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const dragHandleProps = useCallback(
    (itemId: string): GameDragHandleProps => ({
      onPointerDown: onPointerDown(itemId),
      onClickCapture,
      style: DRAG_HANDLE_STYLE,
    }),
    [onClickCapture, onPointerDown],
  )

  return {
    drag,
    hoverZone: drag?.zone ?? null,
    isDragging: (itemId: string) => drag?.itemId === itemId,
    dragHandleProps,
  }
}

export interface UseTapPlacementOptions {
  /** Called when a selected item is placed on a zone. */
  onPlace: (itemId: string, zoneId: string) => void
  disabled?: boolean
}

export interface TapItemProps {
  'aria-pressed': boolean
  disabled: boolean
  onClick: () => void
}

export interface TapZoneProps {
  /** Literal on purpose: this is the `DROP_ZONE_ATTR` value and JSX needs the
   *  attribute spelled out. */
  'data-dropzone': string
  onClick: () => void
}

export interface TapPlacement {
  selected: string | null
  isSelected: (itemId: string) => boolean
  select: (itemId: string) => void
  place: (zoneId: string) => void
  clear: () => void
  /** Spread onto the item control (a real `<button>`, so keyboard works for free). */
  itemProps: (itemId: string) => TapItemProps
  /** Spread onto the zone control. It carries `data-dropzone`, so the SAME element
   *  serves the tap path and the drag path. */
  zoneProps: (zoneId: string) => TapZoneProps
}

/**
 * Select-then-tap-target placement — the accessible path that MUST exist wherever
 * `useGameDrag` is wired (§1.11). Tap an item to select it, tap a zone to place it;
 * tapping the selected item again deselects.
 */
export function useTapPlacement(options: UseTapPlacementOptions): TapPlacement {
  const { onPlace, disabled = false } = options
  const [selected, setSelected] = useState<string | null>(null)

  const clear = useCallback(() => setSelected(null), [])

  const select = useCallback(
    (itemId: string) => {
      if (disabled) return
      setSelected((current) => (current === itemId ? null : itemId))
    },
    [disabled],
  )

  const place = useCallback(
    (zoneId: string) => {
      if (disabled || selected === null) return
      onPlace(selected, zoneId)
      setSelected(null)
    },
    [disabled, onPlace, selected],
  )

  return {
    selected,
    isSelected: (itemId: string) => selected === itemId,
    select,
    place,
    clear,
    itemProps: (itemId: string) => ({
      'aria-pressed': selected === itemId,
      disabled,
      onClick: () => select(itemId),
    }),
    zoneProps: (zoneId: string) => ({
      'data-dropzone': zoneId,
      onClick: () => place(zoneId),
    }),
  }
}
