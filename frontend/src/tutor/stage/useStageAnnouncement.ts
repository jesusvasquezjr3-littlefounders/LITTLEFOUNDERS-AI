import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * WHEN THE CONVERSATION IS TOLD THE STAGE IS UP — AND THE DEADLINE ON IT.
 *
 * `onReady` is the speech gate. Until it fires, the tutor's audio URL is nulled
 * and the tutor is captioned and silent. That gate used to wait for the scene's
 * first rendered frame and nothing else, which is correct right up until the
 * frame never comes — no WebGL, a background tab, an asset that fails, a device
 * too slow to finish. Those are reachable states, and in each of them the gate
 * stayed shut for the entire session.
 *
 * The damage was not confined to the stage. `speaking` is derived from the
 * audio URL, and hands-free listening waits for the tutor to STOP speaking, so
 * a tutor that never speaks opens the learner's microphone immediately on every
 * turn — while they are still reading the caption. Reported from a real session
 * on 2026-08-29: never once heard, and a spoken question transcribed as "Ah.",
 * a fragment from a listening window that had already started expiring.
 *
 * So the gate has a deadline. The frame opens it if it arrives; otherwise the
 * timeout does, exactly once, loudly. The veil is lifted by the same deadline,
 * so a line released this way plays over whatever is actually true rather than
 * over a blank canvas — possibly the honest "this device cannot show 3D" line,
 * which is a cosmetic flaw next to a tutor that never speaks at all.
 */

export interface StageAnnouncement {
  /** True once the veil should lift — a first frame, or the deadline. */
  ready: boolean;
  /** Call when the scene renders its first frame. */
  onFirstFrame: () => void;
  /** True when the gate was opened by the deadline rather than by a frame. */
  timedOut: boolean;
}

export function useStageAnnouncement(
  onReady: (() => void) | undefined,
  timeoutMs: number,
): StageAnnouncement {
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  /** So the deadline cannot re-announce a stage a frame already announced. */
  const announced = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const announce = useCallback(() => {
    if (announced.current) return false;
    announced.current = true;
    onReadyRef.current?.();
    return true;
  }, []);

  const onFirstFrame = useCallback(() => {
    setReady(true);
    announce();
  }, [announce]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReady(true);
      if (announce()) {
        setTimedOut(true);
        // LOUD, because from the outside this is indistinguishable from a
        // healthy session: every line is captioned either way.
        console.warn(
          '[tutor] the 3D stage never reported a first frame; releasing the speech gate on the ' +
            'timeout so the tutor is not silent for the whole session',
        );
      }
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [announce, timeoutMs]);

  return { ready, onFirstFrame, timedOut };
}
