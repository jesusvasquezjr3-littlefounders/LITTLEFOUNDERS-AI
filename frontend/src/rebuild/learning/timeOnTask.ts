/*
 * Time on task for a v2 lesson step (GAP-FIX-R4; Appendix C 1.2 Session
 * Efficiency Ratio; Appendix P Part 7.5: an analytics field, never a grading
 * input).
 *
 * The clock runs from the moment a step is shown (the lesson entered, or the
 * previous step's Check or Continue) to this step's Check or Continue. Idle
 * time is capped: a gap between two signs of activity (a pointer, a key, a
 * scroll) counts at most IDLE_CAP_MS, and time with the page hidden does not
 * count at all. Each reading is whole seconds, bounded to what Core accepts.
 */

export const TIME_ON_TASK_IDLE_CAP_MS = 60_000;
export const TIME_ON_TASK_MAX_SECONDS = 7200;

export interface TimeOnTaskClock {
  /** A sign the learner is here (pointer, key, scroll). */
  activity(): void;
  /** The page became visible or hidden. */
  visibility(visible: boolean): void;
  /** Seconds since the step was shown (idle capped), then restart for the next step. */
  take(): number;
}

export function createTimeOnTask(now: () => number = () => performance.now(), visible = true): TimeOnTaskClock {
  let last = now();
  let accumulated = 0;
  let shown = visible;
  const tick = () => {
    const at = now();
    if (shown) accumulated += Math.max(0, Math.min(at - last, TIME_ON_TASK_IDLE_CAP_MS));
    last = at;
  };
  return {
    activity: tick,
    visibility(next) {
      tick();
      shown = next;
    },
    take() {
      tick();
      const seconds = Math.max(0, Math.min(TIME_ON_TASK_MAX_SECONDS, Math.round(accumulated / 1000)));
      accumulated = 0;
      return seconds;
    },
  };
}

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;

/** Feeds a clock from the window's activity and visibility; returns the cleanup. */
export function watchTimeOnTask(clock: TimeOnTaskClock, target: Window = window): () => void {
  let lastMove = 0;
  const onActivity = (event: Event) => {
    // pointermove fires constantly; one sign per second is enough to keep the clock honest.
    if (event.type === 'pointermove') {
      if (event.timeStamp - lastMove < 1000) return;
      lastMove = event.timeStamp;
    }
    clock.activity();
  };
  const onVisibility = () => clock.visibility(target.document.visibilityState !== 'hidden');
  for (const name of ACTIVITY_EVENTS) target.addEventListener(name, onActivity, { passive: true, capture: true });
  target.document.addEventListener('visibilitychange', onVisibility);
  return () => {
    for (const name of ACTIVITY_EVENTS) target.removeEventListener(name, onActivity, { capture: true });
    target.document.removeEventListener('visibilitychange', onVisibility);
  };
}
