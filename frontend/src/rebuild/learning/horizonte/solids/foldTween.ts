import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the fold button takes to run the whole fold. The scrub slider has no time at all: it is the unhurried path. */
export const FOLD_MS = 250;

/**
 * Motion runs only when the person has not asked for less. With no `matchMedia` (a test, an old browser) or any error asking, the
 * answer is no, so the fold jumps to its end instead of moving.
 */
export function motionAllowed(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  } catch {
    return false;
  }
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const ease = (k: number): number => k * k * (3 - 2 * k);

/** The share of the fold done (0 flat, 1 closed). `go` runs to a share, tweened only under no-preference; `set` jumps to it. */
export function useFoldTween() {
  const [t, setT] = useState(0);
  const now = useRef(0);
  const frame = useRef<number | null>(null);
  const stop = useCallback(() => {
    if (frame.current !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const put = useCallback((value: number) => { now.current = value; setT(value); }, []);
  const set = useCallback((value: number) => { stop(); put(clamp(value)); }, [stop, put]);
  const go = useCallback((target: number) => {
    stop();
    const to = clamp(target);
    if (!motionAllowed() || typeof requestAnimationFrame !== 'function') { put(to); return; }
    const from = now.current;
    const start = performance.now();
    const step = (time: number) => {
      const k = Math.min(1, Math.max(0, (time - start) / FOLD_MS));
      put(from + (to - from) * ease(k));
      frame.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
  }, [stop, put]);
  useEffect(() => stop, [stop]);
  return { t, go, set };
}
