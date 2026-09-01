import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GROW_STEP_MS, TutorWhiteboard } from '../TutorWhiteboard';

/*
 * Confirmed by adversarial review sweep tutor-review-sweep-101
 * (whiteboard-at-scale dimension), MEDIUM, closed round 101 (RUNBOOK.md):
 * when a NEW whiteboard turn (`seq` bumped, `board.values` often shorter)
 * arrived before the PREVIOUS turn's bar-by-bar reveal had finished, the
 * stale `shown` count was reset only by a `useEffect` keyed on `seq` — which
 * runs AFTER React commits a render, never before. The render that used the
 * NEW, shorter `board.values` together with the OLD, larger `shown` value
 * committed and PAINTED FIRST: every one of the new sequence's bars showed
 * fully grown in one frame, then visibly collapsed back to one bar and
 * re-grew correctly once the effect fired a tick later. A jarring glitch,
 * exactly when a child is trying to follow a fast-moving story.
 *
 * `act()` — and this library's own `render`/`rerender`, which wrap every
 * call in one — synchronously drains passive effects before returning
 * control to the test. That is exactly why a plain "rerender, then assert on
 * the settled DOM" test (see the pre-existing "replays from the start" case
 * in `tutorWhiteboard.test.tsx`) cannot see this bug: by the time the
 * assertion runs, the corrective effect has already fired and overwritten
 * the bad commit, in this test environment — never on a real device, where
 * the effect is scheduled on a LATER task and a real frame paints the bad
 * commit in between. To catch the transient frame itself, this test spies on
 * `setAttribute` and records every value this component ever commits to its
 * own `aria-label` (which encodes exactly `board.values.slice(0, shown)`,
 * the same quantity the bug corrupts) — not just the last one standing.
 */

const BOARD_A = {
  kind: 'sequence' as const,
  start: 10,
  // Irrelevant to what this component draws (it renders `values`, computed
  // server-side, never redoing the arithmetic) but part of the honest wire
  // shape (`TutorWhiteboardWire`) all the same.
  steps: [
    { op: 'add' as const, value: 2 },
    { op: 'add' as const, value: 2 },
    { op: 'add' as const, value: 2 },
    { op: 'add' as const, value: 2 },
  ],
  unit: 'day' as const,
  values: [10, 12, 14, 16, 18],
  label: 'Historia A',
  currency: null,
};

const BOARD_B = {
  kind: 'sequence' as const,
  start: 20,
  steps: [{ op: 'add' as const, value: 3 }],
  unit: 'day' as const,
  values: [20, 23],
  label: 'Historia B',
  currency: null,
};

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the reveal-timing race between two whiteboard turns', () => {
  it('never commits a frame for the new board with more bars grown than a fresh reveal allows', async () => {
    stubMatchMedia(false);

    // Every `aria-label` value this component EVER assigns, in commit order —
    // including one this test expects to be immediately overwritten by a
    // second, corrective commit, which a post-hoc DOM query would never see.
    const committedLabels: string[] = [];
    const originalSetAttribute = Element.prototype.setAttribute;
    vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (
      this: Element,
      name: string,
      value: string,
    ) {
      if (name === 'aria-label' && (value.startsWith('Historia A') || value.startsWith('Historia B'))) {
        committedLabels.push(value);
      }
      return originalSetAttribute.call(this, name, value);
    });

    const { rerender } = render(<TutorWhiteboard board={BOARD_A} seq={1} />);

    // Let board A's reveal run genuinely mid-way — 3 of its 5 bars grown —
    // never reaching the end on its own before the next turn interrupts it.
    for (let i = 0; i < 2; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(GROW_STEP_MS);
      });
    }
    expect(committedLabels.at(-1)).toBe('Historia A. Start: 10, Day 1: 12, Day 2: 14');

    // A NEW turn arrives — board B, SHORTER than how far A had already
    // revealed (`shown === 3` against B's own 2 values) — exactly the
    // shape of the confirmed defect.
    rerender(<TutorWhiteboard board={BOARD_B} seq={2} />);

    const boardBLabels = committedLabels.filter((label) => label.startsWith('Historia B'));
    expect(boardBLabels.length).toBeGreaterThan(0);

    // The defect: the stale `shown = 3` applied against B's 2-value array
    // marks EVERY bar grown (`i < 3` is true for i = 0 and i = 1), so B's
    // full board — both values — paints in one frame before ever growing
    // bar by bar. That committed frame must never happen.
    for (const label of boardBLabels) {
      expect(label).not.toBe('Historia B. Start: 20, Day 1: 23');
    }

    // The board is fresh: it must have started, and stayed, at exactly one
    // grown bar — the new sequence's own reveal, not a leftover from the old
    // one — until this test advances time again.
    expect(boardBLabels.at(-1)).toBe('Historia B. Start: 20');
  });
});
