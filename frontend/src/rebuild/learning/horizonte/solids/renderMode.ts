import { useCallback, useState } from 'react';
import { getDeviceProbe, pickInitialTier } from '../../../../tutor-scene/quality';

export type SolidRenderRequest = 'auto' | 'svg' | 'webgl';
export type SolidRenderMode = 'svg' | 'webgl';

export interface RenderSignals {
  webgl: 'webgl2' | 'webgl1' | 'none';
  lowPower: boolean;
  saveData: boolean;
  reducedMotion: boolean;
}

/**
 * No WebGL and reduced motion always draw the SVG; low power and data saving do too unless the lesson asks for 'webgl'.
 * 'svg' forces the SVG (tests, previews). The SVG carries the full feature set, so this is a choice of renderer only.
 */
export function chooseRenderMode(request: SolidRenderRequest, signals: RenderSignals): SolidRenderMode {
  if (request === 'svg' || signals.webgl === 'none' || signals.reducedMotion) return 'svg';
  if (request === 'webgl') return 'webgl';
  return signals.lowPower || signals.saveData ? 'svg' : 'webgl';
}

export function readRenderSignals(): RenderSignals {
  const probe = getDeviceProbe();
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const live = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { webgl: probe.webgl, lowPower: pickInitialTier(probe) === 'low', saveData: connection?.saveData === true, reducedMotion: probe.prefersReducedMotion || live };
}

/** The renderer for this mount, and a way for the 3D scene to hand over to the SVG (error, or the shared governor reaching the low tier). */
export function useSolidRenderMode(request: SolidRenderRequest = 'auto'): { mode: SolidRenderMode; yieldToSvg: () => void } {
  const [chosen] = useState<SolidRenderMode>(() => (typeof window === 'undefined' ? 'svg' : chooseRenderMode(request, readRenderSignals())));
  const [yielded, setYielded] = useState(false);
  const yieldToSvg = useCallback(() => setYielded(true), []);
  return { mode: yielded ? 'svg' : chosen, yieldToSvg };
}
