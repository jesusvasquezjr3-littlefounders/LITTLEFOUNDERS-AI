// The ONE scaling primitive for every mechanic canvas (GAME_ENGINE.md §10, /CLAUDE.md
// §1.11). v1 shipped two competing approaches — percentage-positioned zones in some
// games and a fixed 900x540 stage with a CSS `transform: scale()` in others — so
// nothing looked or behaved the same across breakpoints. Here a mechanic renders in
// STABLE DESIGN COORDINATES and this module maps them onto whatever viewport the
// child actually has: 375px and 1280px are both first-class, neither is a stretched
// version of the other.
//
// Two modes:
//  - 'contain' — letterbox. The design box is preserved exactly (aspect ratio intact),
//    scaled to fit, and centred; `offsetX/offsetY` are the letterbox bars. Use it when
//    the mechanic's layout is authored (a launcher's trajectory field, a board).
//  - 'fluid'  — fill. The scale is driven by width and the REAL design-space height is
//    reported back, so a mechanic can reflow (spawn more lanes, extend a runway)
//    instead of being letterboxed. Use it when the playfield is generative.
//
// Safe-area insets are respected by construction: `containerStyle` pads the measured
// element with `env(safe-area-inset-*)`, and measurement reads the CONTENT box, so the
// notch/home-indicator area is subtracted by the browser rather than guessed in JS.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

export type StageMode = 'contain' | 'fluid'

/** Default design box. Mechanics may pick their own; this is only a shared starting
 *  point so two mechanics do not invent two different "natural" sizes. */
export const DEFAULT_DESIGN_WIDTH = 900
export const DEFAULT_DESIGN_HEIGHT = 540

export interface StagePoint {
  x: number
  y: number
}

export interface StageMetrics {
  /** Design px -> CSS px. */
  scale: number
  /** Design-space width. Constant in 'contain', reflows in 'fluid'. */
  width: number
  /** Design-space height. Constant in 'contain', reflows in 'fluid'. */
  height: number
  /** The rendered size of the stage box, in CSS px. */
  cssWidth: number
  cssHeight: number
  /** Letterbox bars in CSS px (always 0 in 'fluid'). */
  offsetX: number
  offsetY: number
  /** False until the container has been measured — the metrics are then the
   *  unscaled design box (scale 1) rather than a collapsed zero-size stage. */
  measured: boolean
}

export interface ComputeStageInput {
  containerWidth: number
  containerHeight: number
  designWidth: number
  designHeight: number
  mode: StageMode
  /** Optional cap on upscaling, so a small design box does not become a blurry
   *  wall of sprites on a large desktop. */
  maxScale?: number
}

/**
 * Pure metric computation — no DOM, no React. Exported so it can be unit-tested
 * directly at both breakpoints and reused anywhere a container size is known.
 */
export function computeStage(input: ComputeStageInput): StageMetrics {
  const { containerWidth, containerHeight, designWidth, designHeight, mode, maxScale } = input
  const usable =
    Number.isFinite(containerWidth) &&
    Number.isFinite(containerHeight) &&
    containerWidth > 0 &&
    containerHeight > 0 &&
    designWidth > 0 &&
    designHeight > 0

  if (!usable) {
    return {
      scale: 1,
      width: designWidth,
      height: designHeight,
      cssWidth: designWidth,
      cssHeight: designHeight,
      offsetX: 0,
      offsetY: 0,
      measured: false,
    }
  }

  const cap = maxScale ?? Number.POSITIVE_INFINITY

  if (mode === 'fluid') {
    const scale = Math.min(containerWidth / designWidth, cap)
    return {
      scale,
      width: containerWidth / scale,
      height: containerHeight / scale,
      cssWidth: containerWidth,
      cssHeight: containerHeight,
      offsetX: 0,
      offsetY: 0,
      measured: true,
    }
  }

  const scale = Math.min(containerWidth / designWidth, containerHeight / designHeight, cap)
  const cssWidth = designWidth * scale
  const cssHeight = designHeight * scale
  return {
    scale,
    width: designWidth,
    height: designHeight,
    cssWidth,
    cssHeight,
    offsetX: (containerWidth - cssWidth) / 2,
    offsetY: (containerHeight - cssHeight) / 2,
    measured: true,
  }
}

export interface UseStageScaleOptions {
  designWidth?: number
  designHeight?: number
  /** Defaults to 'contain'. */
  mode?: StageMode
  /** Pad the measured element with the device safe-area insets. Default true —
   *  pass false for a stage that is not full-bleed. */
  safeArea?: boolean
  maxScale?: number
}

export interface StageScale extends StageMetrics {
  /** Callback ref for the element that DEFINES the available space. Spread
   *  `containerStyle` on that same element. */
  ref: (node: HTMLElement | null) => void
  containerStyle: CSSProperties
  /** The stage box itself, in CSS px — centre it inside the container. */
  stageStyle: CSSProperties
  /** Design coordinates -> CSS px offsets inside the stage box. */
  toStage: (x: number, y: number) => StagePoint
  /** Client (pointer) coordinates -> design coordinates. */
  toDesign: (clientX: number, clientY: number) => StagePoint
}

interface ContentBox {
  width: number
  height: number
  /** Offset of the content box from the border-box origin (border + padding). */
  left: number
  top: number
}

const EMPTY_BOX: ContentBox = { width: 0, height: 0, left: 0, top: 0 }

const SAFE_AREA_STYLE: CSSProperties = {
  paddingTop: 'env(safe-area-inset-top, 0px)',
  paddingRight: 'env(safe-area-inset-right, 0px)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  paddingLeft: 'env(safe-area-inset-left, 0px)',
}

function px(value: string | undefined): number {
  const n = Number.parseFloat(value ?? '')
  return Number.isFinite(n) ? n : 0
}

/** Fallback measurement for hosts without ResizeObserver (jsdom) and for the very
 *  first paint. Mirrors what `ResizeObserverEntry.contentRect` reports. */
function contentBoxOf(el: HTMLElement): ContentBox {
  const rect = el.getBoundingClientRect()
  const style = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(el) : null
  const left = px(style?.borderLeftWidth) + px(style?.paddingLeft)
  const right = px(style?.borderRightWidth) + px(style?.paddingRight)
  const top = px(style?.borderTopWidth) + px(style?.paddingTop)
  const bottom = px(style?.borderBottomWidth) + px(style?.paddingBottom)
  return {
    width: Math.max(0, rect.width - left - right),
    height: Math.max(0, rect.height - top - bottom),
    left,
    top,
  }
}

/**
 * Measure a container and expose stable design-space metrics for a mechanic canvas.
 */
export function useStageScale(options: UseStageScaleOptions = {}): StageScale {
  const {
    designWidth = DEFAULT_DESIGN_WIDTH,
    designHeight = DEFAULT_DESIGN_HEIGHT,
    mode = 'contain',
    safeArea = true,
    maxScale,
  } = options

  // A callback ref rather than a ref object: the measured element may mount later
  // or be swapped (pause overlay, interlude), and state re-triggers the effect.
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [box, setBox] = useState<ContentBox>(EMPTY_BOX)
  const ref = useCallback((node: HTMLElement | null) => setEl(node), [])

  useEffect(() => {
    if (!el) {
      setBox(EMPTY_BOX)
      return
    }
    const apply = (next: ContentBox) =>
      setBox((prev) =>
        prev.width === next.width &&
        prev.height === next.height &&
        prev.left === next.left &&
        prev.top === next.top
          ? prev
          : next,
      )
    const measure = () => apply(contentBoxOf(el))
    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      window.addEventListener('orientationchange', measure)
      return () => {
        window.removeEventListener('resize', measure)
        window.removeEventListener('orientationchange', measure)
      }
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const r = entry.contentRect
        apply({ width: r.width, height: r.height, left: r.left, top: r.top })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [el])

  const metrics = useMemo(
    () =>
      computeStage({
        containerWidth: box.width,
        containerHeight: box.height,
        designWidth,
        designHeight,
        mode,
        maxScale,
      }),
    [box.width, box.height, designWidth, designHeight, mode, maxScale],
  )

  const toStage = useCallback(
    (x: number, y: number): StagePoint => ({ x: x * metrics.scale, y: y * metrics.scale }),
    [metrics.scale],
  )

  const toDesign = useCallback(
    (clientX: number, clientY: number): StagePoint => {
      if (!el || metrics.scale <= 0) return { x: 0, y: 0 }
      const rect = el.getBoundingClientRect()
      return {
        x: (clientX - rect.left - box.left - metrics.offsetX) / metrics.scale,
        y: (clientY - rect.top - box.top - metrics.offsetY) / metrics.scale,
      }
    },
    [el, box.left, box.top, metrics.offsetX, metrics.offsetY, metrics.scale],
  )

  const containerStyle = useMemo<CSSProperties>(
    () => (safeArea ? SAFE_AREA_STYLE : {}),
    [safeArea],
  )

  const stageStyle = useMemo<CSSProperties>(
    () => ({ width: `${metrics.cssWidth}px`, height: `${metrics.cssHeight}px` }),
    [metrics.cssWidth, metrics.cssHeight],
  )

  return { ...metrics, ref, containerStyle, stageStyle, toStage, toDesign }
}
