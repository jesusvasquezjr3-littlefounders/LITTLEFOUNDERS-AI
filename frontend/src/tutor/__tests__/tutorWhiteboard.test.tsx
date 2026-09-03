import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TutorWhiteboard } from '../TutorWhiteboard';
import { playSfx } from '@/lesson-engine/player/sfx';

vi.mock('@/lesson-engine/player/sfx', () => ({ playSfx: vi.fn() }));

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
  // Irrelevant to what this component draws (it renders `values`, computed
  // server-side, never redoing the arithmetic) but part of the honest wire
  // shape (`TutorWhiteboardWire`) all the same.
  steps: [
    { op: 'add' as const, value: 2 },
    { op: 'add' as const, value: 2 },
  ],
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
  vi.mocked(playSfx).mockClear();
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
 * ONE CUE PER BAR (Sprint 3, /TUTOR_INSTRUMENTS.md) — reusing the Lesson
 * Player's own `sfx.ts` rather than a new model-facing field (see
 * TutorWhiteboard.tsx's own comment on the reveal effect for why). Mocked
 * rather than exercised through the real `Audio` element: `test-setup.ts`
 * stubs `HTMLMediaElement.prototype.play` so a real call no longer throws,
 * but this suite cares about WHEN the cue fires relative to the reveal, which
 * a spy proves directly instead of inferring from a JSDOM audio element that
 * cannot actually be heard.
 */
describe('the reveal sound', () => {
  it('plays one cue per bar as it grows in, but not for the bar shown on mount', async () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={BOARD} seq={1} />);
    // Bar 0 (of 3) is visible immediately on mount — no cue for it.
    expect(playSfx).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(playSfx).toHaveBeenCalledTimes(1);
    expect(playSfx).toHaveBeenLastCalledWith('drop');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(playSfx).toHaveBeenCalledTimes(2);

    // All 3 values shown now — no further growth, no further cue.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(playSfx).toHaveBeenCalledTimes(2);
  });

  it('stays silent under reduced motion — the whole board is shown on mount, nothing grows in', async () => {
    stubMatchMedia(true);
    render(<TutorWhiteboard board={BOARD} seq={1} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(playSfx).not.toHaveBeenCalled();
  });
});

/*
 * `step` (Class II, S9, /TUTOR_INSTRUMENTS.md §3.3) — "advances the reveal
 * at their own pace instead of watching it." A sibling of the `role="img"`
 * node, never a descendant of it (`WhiteboardShell`'s own comment): an
 * interactive control nested inside `role="img"` would be presented to
 * assistive tech as the image's own replaced content and never reached.
 */
describe('advancing the reveal by hand', () => {
  it('offers "Show next" while a beat is still pending, under normal motion', () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={BOARD} seq={1} />);
    expect(screen.getByRole('button', { name: 'Show next' })).toBeInTheDocument();
  });

  it('offers nothing under reduced motion — the whole board is already shown', () => {
    stubMatchMedia(true);
    render(<TutorWhiteboard board={BOARD} seq={1} />);
    expect(screen.queryByRole('button', { name: 'Show next' })).not.toBeInTheDocument();
  });

  it('reveals the next bar immediately on tap, without waiting for the timer', async () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={BOARD} seq={1} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Cada día te dan 2 más. Start: MX$10');

    fireEvent.click(screen.getByRole('button', { name: 'Show next' }));
    // No `advanceTimersByTimeAsync` — a tap must not need the 550ms wait.
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('MX$12');
    expect(playSfx).toHaveBeenCalledWith('drop');
  });

  it('withdraws itself once every bar is shown — nothing left to advance to', async () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show next' }));
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('MX$14');
    expect(screen.queryByRole('button', { name: 'Show next' })).not.toBeInTheDocument();
  });

  it('a tap cancels the timer that was already pending, rather than leaving it to also fire', async () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={BOARD} seq={1} />);
    // The auto-timer scheduled at mount has been running for a while — close
    // to firing on its own — when the tap arrives.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show next' }));
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('MX$12');
    expect(playSfx).toHaveBeenCalledTimes(1);

    // If the PRE-TAP timer had survived, it would fire within the next 50ms
    // (600ms elapsed against its own 550ms schedule) and advance a SECOND
    // time on top of the tap. It must not: only the effect's own fresh
    // reschedule, a full 550ms after the tap, may produce the next advance.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('MX$12');
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('MX$14');
    expect(playSfx).toHaveBeenCalledTimes(1);
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
 * COMPARE, MARKED_LINE AND CATEGORIES (V4, /ORACLE.md §20.5). Same care as
 * the `sequence` tests above: the numbers drawn are EXACTLY the
 * server-computed fields (`difference`/`greater`, each mark's `position`,
 * `categories`' own `values`) — this component never redoes that arithmetic
 * — and all three render fully immediately rather than through `sequence`'s
 * grow-in reveal (see `CompareBoard`'s, `MarkedLineBoard`'s and
 * `CategoriesBoard`'s own doc comments for why: there is no story unfolding
 * over steps for an animation to pace against — each is a snapshot of named
 * things at one moment, `categories` being `compare` generalized from a
 * fixed two sides to 2-6).
 */
const COMPARE_BOARD = {
  kind: 'compare' as const,
  left: { label: 'Tienda A', value: 45 },
  right: { label: 'Tienda B', value: 28 },
  difference: 17,
  greater: 'left' as const,
  label: '¿Cuál playera es más barata?',
  currency: 'MXN' as const,
};

describe('compare — two quantities side by side (V4 backlog)', () => {
  it('shows the top label and both sides\' own labels', () => {
    render(<TutorWhiteboard board={COMPARE_BOARD} seq={1} />);
    expect(screen.getByText('¿Cuál playera es más barata?')).toBeInTheDocument();
    expect(screen.getByText('Tienda A')).toBeInTheDocument();
    expect(screen.getByText('Tienda B')).toBeInTheDocument();
  });

  it("the accessible name carries both sides' values and the SERVER-COMPUTED difference — never asserted anywhere in a schema field the model can set", () => {
    render(<TutorWhiteboard board={COMPARE_BOARD} seq={1} />);
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).toContain('Tienda A: MX$45');
    expect(label).toContain('Tienda B: MX$28');
    expect(label).toContain('Difference: MX$17');
  });

  it('omits a difference caption for a genuine tie — a difference of zero is not "different by zero"', () => {
    const tie = { ...COMPARE_BOARD, left: { ...COMPARE_BOARD.left, value: 30 }, right: { ...COMPARE_BOARD.right, value: 30 }, difference: 0, greater: 'tie' as const };
    render(<TutorWhiteboard board={tie} seq={1} />);
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).not.toContain('Difference');
  });

  it('draws BOTH bars proportional to their own value, tallest first regardless of side', () => {
    const { container } = render(<TutorWhiteboard board={COMPARE_BOARD} seq={1} />);
    const bars = container.querySelectorAll('.rounded-t-md');
    expect(bars).toHaveLength(2);
    // left=45 (the max of the two) is drawn at 100%, right=28 proportionally lower.
    expect(bars[0]).toHaveStyle({ height: '100%' });
    expect(bars[1]).toHaveStyle({ height: `${Math.round((28 / 45) * 100)}%` });
  });

  it('renders immediately with no grow-in reveal — a snapshot, not a process', () => {
    // Normal motion (not reduced) still shows both values at once: unlike
    // `sequence`, `compare` has no `GROW_STEP_MS` reveal to skip.
    render(<TutorWhiteboard board={COMPARE_BOARD} seq={1} />);
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).toContain('MX$45');
    expect(label).toContain('MX$28');
  });
});

const MARKED_LINE_BOARD = {
  kind: 'marked_line' as const,
  min: 0,
  max: 40,
  marks: [
    { value: 22, label: 'Lo que tienes', position: 0.55 },
    { value: 35, label: 'Los audífonos', position: 0.875 },
  ],
  label: '¿Cuánto te falta para los audífonos?',
  currency: 'MXN' as const,
};

describe('marked_line — one or more values placed on a line (V4 backlog)', () => {
  it('shows the top label and every mark\'s own label', () => {
    render(<TutorWhiteboard board={MARKED_LINE_BOARD} seq={1} />);
    expect(screen.getByText('¿Cuánto te falta para los audífonos?')).toBeInTheDocument();
    expect(screen.getByText('Lo que tienes')).toBeInTheDocument();
    expect(screen.getByText('Los audífonos')).toBeInTheDocument();
  });

  it('the accessible name carries the range and every mark\'s value, from the SERVER-COMPUTED shape — never re-deriving position from value/min/max itself', () => {
    render(<TutorWhiteboard board={MARKED_LINE_BOARD} seq={1} />);
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).toContain('MX$0');
    expect(label).toContain('MX$40');
    expect(label).toContain('Lo que tienes: MX$22');
    expect(label).toContain('Los audífonos: MX$35');
  });

  it("positions each mark's dot at the SERVER-computed `position`, not a client-recomputed fraction", () => {
    // A deliberately WRONG position (0.5 for a mark whose true value/min/max
    // would compute to something else) proves this component trusts the
    // given `position` rather than re-deriving it — the same "never redo
    // the arithmetic" contract `values` already has for `sequence`.
    const wired = {
      ...MARKED_LINE_BOARD,
      marks: [{ value: 22, label: 'Lo que tienes', position: 0.5 }],
    };
    const { container } = render(<TutorWhiteboard board={wired} seq={1} />);
    const dot = container.querySelector('[style*="left"]') as HTMLElement | null;
    expect(dot?.style.left).toBe('50%');
  });

  it('clamps a position outside [0, 1] to the visible track, rather than drawing off-screen', () => {
    const outOfRange = { ...MARKED_LINE_BOARD, marks: [{ value: 999, label: 'x', position: 1.4 }] };
    const { container } = render(<TutorWhiteboard board={outOfRange} seq={1} />);
    const dot = container.querySelector('[style*="left"]') as HTMLElement | null;
    expect(dot?.style.left).toBe('100%');
  });

  it('renders immediately with no grow-in reveal — a snapshot, not a process', () => {
    render(<TutorWhiteboard board={MARKED_LINE_BOARD} seq={1} />);
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).toContain('MX$22');
    expect(label).toContain('MX$35');
  });
});

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

describe('categories — several named things at one moment (V4)', () => {
  it('shows the board label and one bar per category, never more than the server sent', () => {
    const { container } = render(<TutorWhiteboard board={CATEGORIES_BOARD} seq={1} />);
    expect(screen.getByText('Cómo repartiste tus 100 pesos')).toBeInTheDocument();
    const bars = container.querySelectorAll('.rounded-t-md');
    expect(bars).toHaveLength(3);
  });

  it("captions each bar with the category's OWN label, never a translated time-axis word", () => {
    render(<TutorWhiteboard board={CATEGORIES_BOARD} seq={1} />);
    const label = screen.getByRole('img').getAttribute('aria-label');
    // The sequence-only caption source ("Start", "Week 1"...) must not leak
    // in here — a categories board has no time axis at all.
    expect(label).toContain('Necesito: MX$40');
    expect(label).toContain('Quiero: MX$35');
    expect(label).toContain('Ahorré: MX$25');
    expect(label).not.toContain('Start');
    expect(label).not.toMatch(/Week \d/);
  });

  it('draws every bar proportional to its own value, the largest at 100% regardless of position', () => {
    const { container } = render(<TutorWhiteboard board={CATEGORIES_BOARD} seq={1} />);
    const bars = container.querySelectorAll('.rounded-t-md');
    expect(bars).toHaveLength(3);
    // 40 is the max of the three, so its bar is drawn full height.
    expect(bars[0]).toHaveStyle({ height: '100%' });
    expect(bars[1]).toHaveStyle({ height: `${Math.round((35 / 40) * 100)}%` });
    expect(bars[2]).toHaveStyle({ height: `${Math.round((25 / 40) * 100)}%` });
  });

  it('renders immediately with no grow-in reveal — a snapshot, not a process', () => {
    // Normal motion (not reduced) still shows every value at once: unlike
    // `sequence`, `categories` has no `GROW_STEP_MS` reveal to skip.
    render(<TutorWhiteboard board={CATEGORIES_BOARD} seq={1} />);
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).toContain('MX$40');
    expect(label).toContain('MX$35');
    expect(label).toContain('MX$25');
  });
});

describe('the live announcement fires for compare, marked_line and categories too — the mechanism is kind-agnostic', () => {
  it('announces once on mount for a compare board', () => {
    render(<TutorWhiteboard board={COMPARE_BOARD} seq={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('The whiteboard updated.');
  });

  it('announces once on mount for a marked_line board', () => {
    render(<TutorWhiteboard board={MARKED_LINE_BOARD} seq={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('The whiteboard updated.');
  });

  it('announces once on mount for a categories board', () => {
    render(<TutorWhiteboard board={CATEGORIES_BOARD} seq={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('The whiteboard updated.');
  });
});

/*
 * `tokens` — the first NON-CHART instrument (/TUTOR_INSTRUMENTS.md, Sprint 6).
 * Same two guarantees as every kind above: the component draws what the server
 * computed and never redoes the arithmetic, and the accessible name carries
 * what the decorative visual does not.
 */

const TOKENS = {
  kind: 'tokens' as const,
  groups: [
    { denomination: 10, count: 3 },
    { denomination: 1, count: 4 },
  ],
  subtotals: [30, 4],
  total: 34,
  label: 'Cuenta lo que hay en la mesa',
  currency: 'MXN' as const,
};

describe('a tokens board', () => {
  it('draws one object per coin, not one bar per pile', () => {
    // The whole reason this instrument exists: `biggest-coin-first.md` asks for
    // coins "on the table where they can be picked up". Three 10s must be three
    // things, not a bar of height 30.
    render(<TutorWhiteboard board={TOKENS} seq={1} />);
    expect(screen.getAllByText('MX$10')).toHaveLength(3);
    expect(screen.getAllByText('MX$1')).toHaveLength(4);
  });

  it('shows the server-computed total and never recomputes it', () => {
    // A deliberately WRONG total on otherwise valid groups must still be drawn
    // as given: proof the client trusts the server rather than doing the
    // learner's arithmetic itself. 3x10 + 4x1 is 34, and this board says 99.
    render(<TutorWhiteboard board={{ ...TOKENS, total: 99 }} seq={1} />);
    expect(screen.getByText(/In total: MX\$99/)).toBeInTheDocument();
    expect(screen.queryByText(/In total: MX\$34/)).not.toBeInTheDocument();
  });

  it('puts the piles and the total in the accessible name', () => {
    render(<TutorWhiteboard board={TOKENS} seq={1} />);
    const board = screen.getByRole('img');
    const name = board.getAttribute('aria-label') ?? '';
    expect(name).toContain('Cuenta lo que hay en la mesa');
    expect(name).toContain('MX$30');
    expect(name).toContain('In total: MX$34');
  });

  it('renders the whole table immediately — the counting is the learner\'s work', () => {
    // No reveal: pacing the count for them would take away the thing being
    // practised. Every coin is present on the first frame.
    render(<TutorWhiteboard board={TOKENS} seq={1} />);
    expect(screen.getAllByText('MX$10')).toHaveLength(3);
  });

  it('draws every token the same size, whatever it is worth', () => {
    // PEDAGOGICAL, not cosmetic. Three of the misconceptions this instrument
    // closes are about believing what LOOKS bigger is worth more. Sizing a
    // token by its denomination would make appearance and value agree on every
    // board and teach the misconception instead of breaking it.
    const { container } = render(<TutorWhiteboard board={TOKENS} seq={1} />);
    const tokens = Array.from(container.querySelectorAll('span')).filter((el) =>
      el.className.includes('rounded-full') && el.className.includes('border-2'),
    );
    expect(tokens).toHaveLength(7);
    const sizes = new Set(tokens.map((el) => el.className.match(/h-\d+/)?.[0]));
    expect(sizes.size).toBe(1);
  });
});

/*
 * `grab` — Class II, S9 (/TUTOR_INSTRUMENTS.md §3.3). The ONE interactive
 * board in the catalog: `role="group"`, not `role="img"` — a picture
 * presents its subtree as replaced content and would swallow every button
 * inside it from assistive tech, which is exactly why every OTHER kind here
 * is read-only. Ungraded by construction: placement is local component
 * state, never submitted, reset on a new `seq` like every other board.
 */
describe('grab — the learner sorts it themselves, hands-on', () => {
  const GRAB_BOARD = {
    kind: 'grab' as const,
    binLabels: ['Necesito', 'Quiero'],
    items: ['Pan', 'Juguete', 'Agua'],
    label: 'Separa lo que necesitas de lo que quieres',
  };

  it('is a group, not a picture — every item and bin is its own reachable control', () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={GRAB_BOARD} seq={1} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: GRAB_BOARD.label })).toBeInTheDocument();
    for (const item of GRAB_BOARD.items) {
      expect(screen.getByRole('button', { name: item })).toBeInTheDocument();
    }
    for (const bin of GRAB_BOARD.binLabels) {
      expect(screen.getByRole('button', { name: bin })).toBeInTheDocument();
    }
  });

  it('selects an item on tap, and tapping it again deselects it', () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={GRAB_BOARD} seq={1} />);
    const pan = screen.getByRole('button', { name: 'Pan' });
    expect(pan).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pan);
    expect(pan).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(pan);
    expect(pan).toHaveAttribute('aria-pressed', 'false');
  });

  it('places the selected item in the tapped bin, and it leaves the unassigned row', () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={GRAB_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Necesito' }));
    // Placed: now inside the "Necesito" group, reachable by its own take-back label.
    expect(screen.getByRole('button', { name: 'Take Pan back out' })).toBeInTheDocument();
    // No longer offered as a plain unassigned chip.
    expect(screen.queryByRole('button', { name: 'Pan' })).not.toBeInTheDocument();
  });

  it('does nothing when a bin is tapped with nothing selected', () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={GRAB_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Necesito' }));
    expect(screen.getByRole('button', { name: 'Pan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take Pan back out' })).not.toBeInTheDocument();
  });

  it('takes a placed item back out on tap, returning it to the unassigned row', () => {
    stubMatchMedia(false);
    render(<TutorWhiteboard board={GRAB_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Necesito' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take Pan back out' }));
    expect(screen.getByRole('button', { name: 'Pan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take Pan back out' })).not.toBeInTheDocument();
  });

  it('resets every placement when a NEW turn carries a different seq', () => {
    stubMatchMedia(false);
    const { rerender } = render(<TutorWhiteboard board={GRAB_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Necesito' }));
    expect(screen.getByRole('button', { name: 'Take Pan back out' })).toBeInTheDocument();

    rerender(<TutorWhiteboard board={GRAB_BOARD} seq={2} />);
    expect(screen.getByRole('button', { name: 'Pan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take Pan back out' })).not.toBeInTheDocument();
  });
});

/*
 * `fill` — Class II, S9 (/TUTOR_INSTRUMENTS.md §3.3). The second interactive
 * board: ORDERED counting, not free toggling — only the next empty cell (to
 * fill) and the most recently filled one (to undo) are ever tappable, so
 * "how many" is always unambiguous from the shape alone.
 */
describe('fill — the learner counts it out themselves, tap by tap', () => {
  const FILL_BOARD = { kind: 'fill' as const, container: 'ten_frame' as const, capacity: 5, label: 'Cuenta hasta cinco' };

  it('is a group, not a picture, with every cell its own reachable control', () => {
    render(<TutorWhiteboard board={FILL_BOARD} seq={1} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: FILL_BOARD.label })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByText('0 of 5')).toBeInTheDocument();
  });

  it('fills the next cell on tap, and only the next cell is enabled', () => {
    render(<TutorWhiteboard board={FILL_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill number 1' }));
    expect(screen.getByText('1 of 5')).toBeInTheDocument();
    // Cell 2 (the new next-to-fill) is enabled; cell 3 onward are not.
    expect(screen.getByRole('button', { name: 'Fill number 2' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fill number 3' })).toBeDisabled();
  });

  it('fills in order — tapping ahead of the next cell does nothing (it is disabled)', () => {
    render(<TutorWhiteboard board={FILL_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill number 3' }));
    expect(screen.getByText('0 of 5')).toBeInTheDocument();
  });

  it('undoes the most recently filled cell on tap', () => {
    render(<TutorWhiteboard board={FILL_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill number 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill number 2' }));
    expect(screen.getByText('2 of 5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Take back number 2' }));
    expect(screen.getByText('1 of 5')).toBeInTheDocument();
  });

  it('stops at capacity — the last cell cannot be filled twice', () => {
    render(<TutorWhiteboard board={{ ...FILL_BOARD, capacity: 1 }} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill number 1' }));
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fill number 1' })).not.toBeInTheDocument();
  });

  it('resets to empty when a NEW turn carries a different seq', () => {
    const { rerender } = render(<TutorWhiteboard board={FILL_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fill number 1' }));
    expect(screen.getByText('1 of 5')).toBeInTheDocument();

    rerender(<TutorWhiteboard board={FILL_BOARD} seq={2} />);
    expect(screen.getByText('0 of 5')).toBeInTheDocument();
  });
});

/*
 * `whatif` — Class II, S10 (/TUTOR_INSTRUMENTS.md §3.3). NOT ungraded, unlike
 * `grab`/`fill`: `values` is server-computed, one array per branch. The chart
 * itself stays `role="img"` (a picture of already-computed data); only WHICH
 * branch is showing is the learner's own choice, via a separate tab row.
 */
describe('whatif — the learner switches between server-computed branches', () => {
  const WHATIF_BOARD = {
    kind: 'whatif' as const,
    start: 10,
    unit: 'week' as const,
    branches: [
      { label: 'Save $1', steps: [{ op: 'add', value: 1 }, { op: 'add', value: 1 }, { op: 'add', value: 1 }] },
      { label: 'Save $3', steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      { label: 'Save $6', steps: [{ op: 'add', value: 6 }, { op: 'add', value: 6 }, { op: 'add', value: 6 }] },
    ],
    values: [
      [10, 11, 12, 13],
      [10, 13, 16, 19],
      [10, 16, 22, 28],
    ],
    label: 'Three ways to save',
    currency: 'USD' as const,
  };

  it('stays a picture, not a group — the chart is role="img"; the branch tabs are separate, reachable buttons', () => {
    render(<TutorWhiteboard board={WHATIF_BOARD} seq={1} />);
    expect(screen.getByRole('img', { name: /Three ways to save/ })).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    for (const branch of WHATIF_BOARD.branches) {
      expect(screen.getByRole('button', { name: branch.label })).toBeInTheDocument();
    }
  });

  it('shows the FIRST branch by default, with its values in the accessible name', () => {
    render(<TutorWhiteboard board={WHATIF_BOARD} seq={1} />);
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).toContain('Save $1');
    expect(label).toContain('Start: $10');
    expect(label).toContain('Week 3: $13');
    expect(label).not.toContain('Week 3: $19');
  });

  it('marks only the active branch aria-pressed', () => {
    render(<TutorWhiteboard board={WHATIF_BOARD} seq={1} />);
    expect(screen.getByRole('button', { name: 'Save $1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Save $3' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Save $6' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switching tabs redraws the chart to the tapped branch, without touching the others', () => {
    render(<TutorWhiteboard board={WHATIF_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save $6' }));
    expect(screen.getByRole('button', { name: 'Save $6' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Save $1' })).toHaveAttribute('aria-pressed', 'false');
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).toContain('Save $6');
    expect(label).toContain('Week 3: $28');
  });

  it('scales every branch against the SAME (global) maximum — switching tabs must never rescale the chart', () => {
    const { container, rerender } = render(<TutorWhiteboard board={WHATIF_BOARD} seq={1} />);
    // Branch 0's tallest bar (13) is well under the GLOBAL max (28) — 46%, not 100%.
    let bars = container.querySelectorAll('.rounded-t-md');
    expect(bars[bars.length - 1]).toHaveStyle({ height: '46%' });

    rerender(<TutorWhiteboard board={WHATIF_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save $6' }));
    // Branch 2's tallest bar (28) IS the global max — 100%, on the SAME denominator.
    bars = container.querySelectorAll('.rounded-t-md');
    expect(bars[bars.length - 1]).toHaveStyle({ height: '100%' });
  });

  it('resets to the first branch when a NEW turn carries a different seq', () => {
    const { rerender } = render(<TutorWhiteboard board={WHATIF_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save $6' }));
    expect(screen.getByRole('button', { name: 'Save $6' })).toHaveAttribute('aria-pressed', 'true');

    rerender(<TutorWhiteboard board={WHATIF_BOARD} seq={2} />);
    expect(screen.getByRole('button', { name: 'Save $1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Save $6' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('defends against a stale selection outliving a narrower board at the SAME seq', () => {
    const { rerender } = render(<TutorWhiteboard board={WHATIF_BOARD} seq={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save $6' }));

    const narrower = { ...WHATIF_BOARD, branches: WHATIF_BOARD.branches.slice(0, 2), values: WHATIF_BOARD.values.slice(0, 2) };
    rerender(<TutorWhiteboard board={narrower} seq={1} />);
    // Clamped to the new last branch rather than indexing past it.
    expect(screen.getByRole('button', { name: 'Save $3' })).toHaveAttribute('aria-pressed', 'true');
  });
});
