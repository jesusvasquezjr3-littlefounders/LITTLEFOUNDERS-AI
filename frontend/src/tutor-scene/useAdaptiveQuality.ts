import { useCallback, useMemo, useRef, useState } from 'react';
import {
  getDeviceProbe,
  pickInitialTier,
  resolveSettings,
  type DeviceProbe,
  type QualitySettings,
} from './quality';
import { initialGovernorState, stepGovernor, type GovernorState } from './governor';

/*
 * The measured half of the quality system (quality.ts holds the static half,
 * governor.ts holds the decision). Frame times are the authority; the static
 * probe only chose where to start.
 *
 * This hook does nothing but time the measurement windows and mirror the pure
 * governor's output into React state. All state transitions belong in
 * `stepGovernor` — putting any of them back in a `setState` updater
 * reintroduces the StrictMode double-invocation bug documented there.
 */

const WINDOW_MS = 1000;

export interface AdaptiveQuality {
  settings: QualitySettings;
  probe: DeviceProbe;
  /** Last completed measurement window's frame rate; 0 until the first window closes. */
  fps: number;
  /** True once the tier can no longer be promoted (the device proved it can't hold one). */
  locked: boolean;
  /**
   * Feed one rendered frame. Called from inside the Canvas via `useFrame`.
   * Accumulates in refs and only touches React state when a window closes, so
   * the governor never costs a re-render per frame.
   */
  onFrame: (deltaSeconds: number) => void;
}

export function useAdaptiveQuality(): AdaptiveQuality {
  // Memoized page-wide — probing creates and destroys a real WebGL context.
  const probe = useMemo(() => getDeviceProbe(), []);

  const governor = useRef<GovernorState>(initialGovernorState(pickInitialTier(probe)));
  const [visible, setVisible] = useState<GovernorState>(governor.current);
  const [fps, setFps] = useState(0);

  const elapsedMs = useRef(0);
  const frames = useRef(0);

  const onFrame = useCallback((deltaSeconds: number) => {
    // R3F emits a large delta on the first frame and again whenever a
    // backgrounded tab resumes. Measuring those would fake a ~1fps window and
    // demote a perfectly capable device, so implausible frames are dropped
    // rather than counted.
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 0.5) return;

    elapsedMs.current += deltaSeconds * 1000;
    frames.current += 1;
    if (elapsedMs.current < WINDOW_MS) return;

    const windowFps = (frames.current * 1000) / elapsedMs.current;
    elapsedMs.current = 0;
    frames.current = 0;
    setFps(Math.round(windowFps));

    const next = stepGovernor(governor.current, windowFps);
    governor.current = next;
    // Only re-render when something the scene actually depends on moved.
    if (next.tier !== visible.tier || next.locked !== visible.locked) setVisible(next);
  }, [visible.tier, visible.locked]);

  const settings = useMemo(
    () => resolveSettings(visible.tier, probe.prefersReducedMotion),
    [visible.tier, probe.prefersReducedMotion],
  );

  return { settings, probe, fps, locked: visible.locked, onFrame };
}
