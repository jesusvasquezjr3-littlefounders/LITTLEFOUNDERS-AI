import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TutorWhiteboard } from '../TutorWhiteboard';

/*
 * THE LIVE WHITEBOARD (V4). The owner's exact complaint: the tutor narrated a
 * growth story in pure text while an unrelated activity sat on screen. These
 * tests care about the two guarantees that make this trustworthy: the numbers
 * drawn are EXACTLY the `values` the server computed (this component never
 * redoes the arithmetic), and reduced motion shows the whole board at once
 * rather than making a child wait through an animation they asked to skip.
 */

const BOARD = {
  kind: 'sequence' as const,
  start: 10,
  unit: 'day' as const,
  values: [10, 12, 14],
  label: 'Cada día te dan 2 más',
  currency: 'MXN' as const,
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
});

describe('what it draws', () => {
  it('shows the label and never more values than the server sent', () => {
    stubMatchMedia(true);
    render(<TutorWhiteboard board={BOARD} seq={1} />);
    expect(screen.getByText('Cada día te dan 2 más')).toBeInTheDocument();
    // Reduced motion: the whole board is visible immediately, and its
    // accessible name carries EXACTLY the server's three values, formatted —
    // never a fourth invented by this component.
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toContain('MX$10');
    expect(img.getAttribute('aria-label')).toContain('MX$12');
    expect(img.getAttribute('aria-label')).toContain('MX$14');
  });

  it('formats as plain numbers when no currency was set', () => {
    stubMatchMedia(true);
    render(<TutorWhiteboard board={{ ...BOARD, currency: null }} seq={1} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).not.toContain('$');
    expect(img.getAttribute('aria-label')).toContain('10');
  });

  /*
   * RUNBOOK.md Round 101: a screen-reader user got a bare "10, 12, 14" with
   * no idea these were week-by-week totals, while a sighted user saw the
   * full "Start / Week 1 / Week 2" story under each bar — the exact
   * story-cadence match the `unit` field (§20.5) exists to guarantee, lost
   * for assistive tech. The accessible name must carry the SAME per-bar
   * caption a sighted user reads (reusing the visible strings, not inventing
   * new wording), not merely the numbers.
   */
  it('gives the accessible name the SAME per-bar time-step captions a sighted user sees, not bare numbers', () => {
    stubMatchMedia(true);
    const weeklyBoard = { ...BOARD, unit: 'week' as const, values: [10, 18, 26] };
    render(<TutorWhiteboard board={weeklyBoard} seq={1} />);
    const img = screen.getByRole('img');
    const label = img.getAttribute('aria-label');
    // The exact visible captions ("Start", "Week 1", "Week 2" in en-US, the
    // test suite's active locale) must appear paired with their own value —
    // not just present somewhere, and not just the bare numbers alone.
    expect(label).toContain('Start: MX$10');
    expect(label).toContain('Week 1: MX$18');
    expect(label).toContain('Week 2: MX$26');
    // The old bug's exact shape: numbers with no captions at all.
    expect(label).not.toBe('Cada día te dan 2 más. MX$10, MX$18, MX$26');
  });
});

describe('the zero-value bar height', () => {
  /*
   * ZERO_EPSILON (oracle/src/tutor/whiteboard.ts) exists precisely because a
   * legitimate "spend it down to zero" sequence is a designed case, not an
   * edge case — round 107, RUNBOOK.md. The bar for a value that landed at
   * (or a hair within floating-point noise of) zero must be visually flush,
   * not the same 6% floor a genuinely small nonzero value gets — a child
   * seeing "$0" in text right above a bar that still has height is exactly
   * the contradiction this feature exists to prevent.
   */
  it('renders a running value that computed to exactly zero as visually flush, not the 6% visibility floor', () => {
    stubMatchMedia(true);
    const spentDown = { ...BOARD, start: 10, values: [10, 5, 0], label: 'Te la gastas toda' };
    const { container } = render(<TutorWhiteboard board={spentDown} seq={1} />);
    const bars = container.querySelectorAll('.rounded-t-md');
    expect(bars).toHaveLength(3);
    expect(bars[2]).toHaveStyle({ height: '0%' });
  });

  it('still treats a value within ZERO_EPSILON of zero (floating-point noise, not a real amount) as flush', () => {
    stubMatchMedia(true);
    const noisy = { ...BOARD, start: 10, values: [10, 1e-10], label: 'Ruido de punto flotante' };
    const { container } = render(<TutorWhiteboard board={noisy} seq={1} />);
    const bars = container.querySelectorAll('.rounded-t-md');
    expect(bars[1]).toHaveStyle({ height: '0%' });
  });

  it('keeps the 6% visibility floor for a genuinely small but nonzero value', () => {
    stubMatchMedia(true);
    const almostGone = { ...BOARD, start: 1000, values: [1000, 5], label: 'Casi nada, pero no cero' };
    const { container } = render(<TutorWhiteboard board={almostGone} seq={1} />);
    const bars = container.querySelectorAll('.rounded-t-md');
    expect(bars[1]).toHaveStyle({ height: '6%' });
  });
});

describe('the growth animation', () => {
  it('reveals one bar at a time under normal motion', () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={BOARD} seq={1} />);
    // Only the first value is announced at first, WITH its time-step caption.
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Cada día te dan 2 más. Start: MX$10');
  });

  it('reveals the whole board immediately under reduced motion', () => {
    stubMatchMedia(true);
    render(<TutorWhiteboard board={BOARD} seq={1} />);
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).toContain('MX$10');
    expect(label).toContain('MX$14');
  });

  it('replays from the start when a NEW turn carries a different seq', async () => {
    stubMatchMedia(false);
    const { rerender } = render(<TutorWhiteboard board={BOARD} seq={1} />);
    // Advance in small increments so each scheduled timer gets a chance to
    // flush its state update and schedule the NEXT one before time moves on.
    for (let i = 0; i < 10; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
    }
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('MX$14');

    const nextBoard = { ...BOARD, start: 20, values: [20, 23], label: 'Otra historia' };
    await act(async () => {
      rerender(<TutorWhiteboard board={nextBoard} seq={2} />);
    });
    // Fresh turn: back to one bar, the new board's own first value and caption.
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Otra historia. Start: MX$20');
  });
});

/*
 * THE MISSING LIVE ANNOUNCEMENT (round 101, HIGH — review sweep
 * tutor-review-sweep-101, whiteboard-at-scale dimension). Before this round,
 * the board's only accessibility surface was a static `aria-label` on a node
 * that is never removed or re-inserted between turns — so a screen-reader
 * user who had already encountered the board once got NO notice that a new
 * turn had redrawn it with new values. Mirrors `LiveSegmentPanel.tsx`'s own
 * round-87 fix for the identical class of gap: a `key`-remounted
 * `role="status" aria-live="polite"` span, proven here the same way that one
 * was — announced on mount, untouched by a re-render of the SAME turn,
 * remounted (and re-announced) by a genuinely NEW one.
 */
describe('TutorWhiteboard — a screen reader is told when a NEW turn redraws the board', () => {
  it('announces once, in words, the moment the board first mounts', () => {
    stubMatchMedia(true);
    render(<TutorWhiteboard board={BOARD} seq={1} />);
    // `getByRole` is accessibility-aware: it would refuse to resolve to a
    // single node if this span were hidden, which is exactly the property
    // this fix adds.
    expect(screen.getByRole('status')).toHaveTextContent('The whiteboard updated.');
  });

  it('does not re-announce a re-render of the SAME turn, only a genuinely new one', () => {
    stubMatchMedia(true);
    const { rerender, container } = render(<TutorWhiteboard board={BOARD} seq={1} />);
    const firstNode = container.querySelector('[role="status"][aria-live="polite"]');
    expect(firstNode).not.toBeNull();

    // A re-render carrying the identical `seq` — a fresh `board` object
    // reference, exactly what an ancestor re-rendering for an unrelated
    // reason produces — must leave this exact DOM node in place. `key={seq}`
    // is what gives this guarantee; without it a naive implementation could
    // recreate the node (and re-announce) on every unrelated re-render.
    rerender(<TutorWhiteboard board={{ ...BOARD }} seq={1} />);
    expect(container.querySelector('[role="status"][aria-live="polite"]')).toBe(firstNode);

    // A GENUINELY new turn, by contrast, must remount the node — this is the
    // mechanism the announcement actually relies on to reach assistive tech
    // for the next redraw, proven rather than assumed.
    const nextBoard = { ...BOARD, start: 20, values: [20, 23], label: 'Otra historia' };
    rerender(<TutorWhiteboard board={nextBoard} seq={2} />);
    const secondNode = container.querySelector('[role="status"][aria-live="polite"]');
    expect(secondNode).not.toBeNull();
    expect(secondNode).not.toBe(firstNode);
    expect(secondNode).toHaveTextContent('The whiteboard updated.');
  });

  it('does not nest the live region inside the role="img" node, which would swallow its semantics', () => {
    stubMatchMedia(true);
    const { container } = render(<TutorWhiteboard board={BOARD} seq={1} />);
    const status = container.querySelector('[role="status"][aria-live="polite"]');
    const img = screen.getByRole('img');
    expect(status).not.toBeNull();
    expect(img.contains(status)).toBe(false);
  });
});

/*
 * `categories` — the first bounded slice of "UI generativa acotada"
 * (blueprint §10.4, ORACLE.md §20.5): a comparison across named things at
 * one moment, rendered by the SAME component and reusing every mechanism
 * proven above (reveal race, live announcement, zero-height floor) — the
 * one thing genuinely different is where each bar's own caption comes
 * from: the model's own per-category label, not a translated time-axis word.
 */
const CATEGORIES_BOARD = {
  kind: 'categories' as const,
  categories: [
    { label: 'Necesito', value: 40 },
    { label: 'Quiero', value: 35 },
    { label: 'Ahorré', value: 25 },
  ],
  values: [40, 35, 25],
  label: 'Cómo repartiste tus 100 pesos',
  currency: 'MXN' as const,
};

describe('the categories kind (V4 backlog slice)', () => {
  it('shows the board label and one bar per category, never more than the server sent', () => {
    stubMatchMedia(true);
    const { container } = render(<TutorWhiteboard board={CATEGORIES_BOARD} seq={1} />);
    expect(screen.getByText('Cómo repartiste tus 100 pesos')).toBeInTheDocument();
    const bars = container.querySelectorAll('.rounded-t-md');
    expect(bars).toHaveLength(3);
  });

  it("captions each bar with the category's OWN label, never a translated time-axis word", () => {
    stubMatchMedia(true);
    render(<TutorWhiteboard board={CATEGORIES_BOARD} seq={1} />);
    const label = screen.getByRole('img').getAttribute('aria-label');
    // The old sequence-only caption source ("Start", "Week 1"...) must not
    // leak in here — a categories board has no time axis at all.
    expect(label).toContain('Necesito: MX$40');
    expect(label).toContain('Quiero: MX$35');
    expect(label).toContain('Ahorré: MX$25');
    expect(label).not.toContain('Start');
    expect(label).not.toMatch(/Week \d/);
  });

  it('reveals one bar at a time under normal motion, same mechanism as sequence', () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={CATEGORIES_BOARD} seq={1} />);
    // Only the FIRST category is announced at first — the shared reveal
    // machinery, exercised through the new kind rather than duplicated for it.
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Cómo repartiste tus 100 pesos. Necesito: MX$40',
    );
  });

  it('announces a genuinely new categories turn the same way a sequence turn is announced', () => {
    stubMatchMedia(true);
    const { rerender, container } = render(<TutorWhiteboard board={CATEGORIES_BOARD} seq={1} />);
    const firstNode = container.querySelector('[role="status"][aria-live="polite"]');
    const nextBoard = {
      ...CATEGORIES_BOARD,
      categories: [{ label: 'Renta', value: 10 }, { label: 'Comida', value: 20 }],
      values: [10, 20],
      label: 'Otro reparto',
    };
    rerender(<TutorWhiteboard board={nextBoard} seq={2} />);
    const secondNode = container.querySelector('[role="status"][aria-live="polite"]');
    expect(secondNode).not.toBe(firstNode);
    expect(secondNode).toHaveTextContent('The whiteboard updated.');
  });
});
