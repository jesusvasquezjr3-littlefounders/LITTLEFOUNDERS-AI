import type { TrayDemoStep } from './types';

/*
 * The tray demonstration driver (Tutor v3).
 *
 * "Mira, si agrego esta moneda…" — the tutor MOVES the open money tray while
 * speaking. The tray renderers (coin_count / make_change) are controlled
 * components whose draft the tutor panel owns, so a demonstration is nothing
 * more exotic than a sequence of draft updates on a timer: no new renderer,
 * no ref plumbing into the lesson engine, and the animation is exactly the
 * same state change a real tap produces — which is what makes it honest.
 *
 * Fail-safe by construction: steps naming a denomination the payload does not
 * offer are DROPPED silently (the schema upstream already bounds the shape;
 * this bounds the content), and an abort — the learner interrupting — stops
 * between steps, never mid-update.
 */

export const TRAY_TYPES = new Set(['coin_count', 'make_change']);

/**
 * WHETHER THE TUTOR MAY TOUCH THIS TRAY RIGHT NOW.
 *
 * Four guards, each protecting a child's unsubmitted answer, and they lived
 * inside a `useEffect` in a component with no test file — so the only thing
 * holding them was that nobody edited them. Pulled out here because a rule
 * about when it is safe to write into someone's answer should be checkable
 * without mounting a panel.
 *
 * - A demo already played must not replay: the same `seq` arriving twice is a
 *   re-render, not a second instruction.
 * - A demo aimed at a segment that is not a tray has nothing to move.
 * - A demo for an activity the learner already got right would rewrite an
 *   answer that has been graded and paid.
 * - A payload with no denominations offers no legal move at all.
 */
export function mayDemonstrate(input: {
  demoSeq: number | null;
  lastPlayedSeq: number;
  segmentType: string;
  answeredCorrectly: boolean;
  denominations: unknown;
}): boolean {
  if (input.demoSeq === null || input.demoSeq === input.lastPlayedSeq) return false;
  if (!TRAY_TYPES.has(input.segmentType)) return false;
  if (input.answeredCorrectly) return false;
  return Array.isArray(input.denominations) && input.denominations.length > 0;
}

const DEFAULT_STEP_MS = 700;

export interface TrayDemoIo {
  getPicked: () => number[];
  setPicked: (picked: number[]) => void;
}

const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        resolve();
      },
      { once: true },
    );
  });

/**
 * Runs the steps against the live tray. Resolves when done or aborted.
 * `denominations` is the payload's own set — the only values a demo may add.
 */
export async function runTrayDemo(
  steps: TrayDemoStep[],
  denominations: number[],
  io: TrayDemoIo,
  opts: { signal?: AbortSignal; stepMs?: number } = {},
): Promise<void> {
  const allowed = new Set(denominations);
  const stepMs = opts.stepMs ?? DEFAULT_STEP_MS;

  for (const step of steps.slice(0, 8)) {
    if (opts.signal?.aborted) return;
    if (step.kind === 'pause') {
      await wait(Math.min(Math.max(step.ms ?? 500, 100), 2_000), opts.signal);
      continue;
    }
    const value = step.denomination;
    if (typeof value !== 'number' || !allowed.has(value)) continue; // dropped, fail-safe
    if (step.kind === 'add') {
      io.setPicked([...io.getPicked(), value]);
    } else {
      const picked = io.getPicked();
      const index = picked.lastIndexOf(value);
      if (index === -1) continue;
      io.setPicked(picked.filter((_, i) => i !== index));
    }
    await wait(stepMs, opts.signal);
  }
}
