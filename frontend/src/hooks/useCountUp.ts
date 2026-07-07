import { useEffect, useRef, useState } from "react";

interface UseCountUpOptions {
  /** Duration in ms. Default: 800 */
  duration?: number;
  /** Start value. Default: 0 */
  start?: number;
  /** Whether to animate. Default: true */
  animate?: boolean;
  /** Delay before starting in ms. Default: 0 */
  delay?: number;
}

/**
 * Animates a number from `start` to `target` over `duration` ms.
 * Respects `prefers-reduced-motion` — instant value if user prefers reduced motion.
 */
export function useCountUp(
  target: number,
  options: UseCountUpOptions = {}
): number {
  const { duration = 800, start = 0, animate = true, delay = 0 } = options;
  const [value, setValue] = useState(start);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!animate || prefersReducedMotion) {
      setValue(target);
      return;
    }

    const startVal = start;
    const diff = target - startVal;

    if (diff === 0) {
      setValue(target);
      return;
    }

    const delayMs = delay;

    const animateFrame = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutExpo for a decelerating count-up
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(startVal + diff * eased);

      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animateFrame);
      }
    };

    const startTimeout = window.setTimeout(() => {
      rafRef.current = requestAnimationFrame(animateFrame);
    }, delayMs);

    return () => {
      window.clearTimeout(startTimeout);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration, start, animate, delay]);

  return value;
}
