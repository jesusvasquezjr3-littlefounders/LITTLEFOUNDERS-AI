import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { LiveSegmentPanel } from '../LiveSegmentPanel';
import { gradeSegment } from '../tutorApi';
import type { ApiResult } from '@/lib/api';
import type { GradeResponse } from '../tutorApi';
import type { LiveSegmentState } from '../useTutorSocket';

/*
 * Found by an adversarial review, 2026-08-30 (CRITICAL): the server can
 * legitimately replace an unanswered segment while a grade request for the
 * PREVIOUS one is still in flight — the tutor moved on before Core answered.
 * `submit`'s closure over `live.segmentId` could not detect this: a stale
 * response painted its verdict over the NEW segment and, via
 * `isSegmentLocked` reading the leaked `verdict?.correct`, soft-locked its
 * inputs until the segment changed again.
 *
 * A minimal, test-only registry entry is used rather than a real renderer —
 * this test is about `LiveSegmentPanel`'s own staleness guard, not about any
 * of the 57 shared exercise components.
 */

vi.mock('../tutorApi', () => ({ gradeSegment: vi.fn() }));

vi.mock('@/lesson-engine/registry', () => ({
  REGISTRY: {
    test_input: {
      kind: 'input',
      canSubmit: (draft: unknown) => draft !== undefined,
      buildAnswer: (draft: unknown) => draft,
      component: ({ onChange }: { onChange: (draft: unknown) => void }): ReactNode => (
        <button type="button" onClick={() => onChange('picked')}>
          pick an answer
        </button>
      ),
    },
    // A real tray type, so `mayDemonstrate` (which checks `TRAY_TYPES`)
    // actually allows a demo to run against it. Just renders the current
    // picked coins as text, so a test can watch the demo progress.
    coin_count: {
      kind: 'input',
      canSubmit: () => false,
      component: ({ value }: { value: unknown }): ReactNode => (
        <div>picked: {JSON.stringify((value as { picked?: number[] })?.picked ?? [])}</div>
      ),
    },
  },
}));

function segmentState(id: string): LiveSegmentState {
  return {
    segmentId: id,
    seq: 1,
    origin: 'live',
    segment: { type: 'test_input', prompt_md: `Question for ${id}`, payload: {} },
    scoresXp: true,
    framing: '',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const CORRECT_RESPONSE: ApiResult<GradeResponse> = {
  data: {
    verdict: { correct: true, score: 100, tier: 'perfect', allowRetry: false },
    xpAwarded: 10,
    scoresXp: true,
    dailyXpCap: 100,
    pedagogy: null,
  },
  error: null,
};

describe('LiveSegmentPanel — a stale grade response must never paint a different segment', () => {
  it('drops a grade response that arrives after the server already replaced the segment', async () => {
    const onGraded = vi.fn();
    const gradeMock = vi.mocked(gradeSegment);
    const pending = deferred<ApiResult<GradeResponse>>();
    gradeMock.mockReturnValueOnce(pending.promise);

    const { rerender } = render(
      <LiveSegmentPanel live={segmentState('segment-a')} token="tok" onGraded={onGraded} />,
    );

    fireEvent.click(screen.getByText('pick an answer'));
    fireEvent.click(screen.getByText('Check'));
    expect(gradeMock).toHaveBeenCalledWith('tok', 'segment-a', 'picked', 1);

    // The server serves a brand-new, unanswered segment B before segment A's
    // grade request resolves — exactly what an orchestrator advancing past a
    // slow grade round trip does.
    rerender(<LiveSegmentPanel live={segmentState('segment-b')} token="tok" onGraded={onGraded} />);
    expect(screen.getByText('Question for segment-b')).toBeInTheDocument();

    await act(async () => {
      pending.resolve(CORRECT_RESPONSE);
      await pending.promise;
    });

    // Segment A's verdict must never reach the screen once B is showing —
    // neither the correctness banner nor a soft-locked "pick an answer"
    // control (`isSegmentLocked` reads `verdict?.correct`, which a leaked
    // verdict would set to `true`).
    expect(screen.queryByText("Exactly right!")).toBeNull();
    expect(onGraded).not.toHaveBeenCalled();
    expect(screen.getByText('pick an answer').closest('button')).not.toBeDisabled();
  });

  it('still applies the response when the segment has not changed', async () => {
    const onGraded = vi.fn();
    const gradeMock = vi.mocked(gradeSegment);
    gradeMock.mockResolvedValueOnce(CORRECT_RESPONSE);

    render(<LiveSegmentPanel live={segmentState('segment-a')} token="tok" onGraded={onGraded} />);

    fireEvent.click(screen.getByText('pick an answer'));
    await act(async () => {
      fireEvent.click(screen.getByText('Check'));
    });

    expect(onGraded).toHaveBeenCalledWith('segment-a', 100, true, undefined);
  });
});

function traySegmentState(id: string): LiveSegmentState {
  return {
    segmentId: id,
    seq: 1,
    origin: 'live',
    segment: { type: 'coin_count', prompt_md: 'Junta monedas', payload: { denominations: [5, 10] } },
    scoresXp: true,
    framing: '',
  };
}

describe('LiveSegmentPanel — a tray demo must not freeze when an unrelated ancestor re-renders', () => {
  /*
   * Found by adversarial review, 2026-08-30 (HIGH): `ConversationView.tsx`
   * builds the `demo` prop as a fresh object literal every render. The demo
   * effect used to depend on that whole object, so ANY unrelated re-render —
   * a composer keystroke, a mic-level update — aborted the running demo
   * mid-loop and then refused to restart it, because `lastDemoSeq` was
   * already set to this `seq` from the FIRST run. The tutor's hands moved
   * exactly one coin and froze forever while the tutor kept narrating.
   */
  it('keeps playing a demo across a same-seq, different-object `demo` prop update', async () => {
    vi.useFakeTimers();
    try {
      const steps = [
        { kind: 'add' as const, denomination: 5 },
        { kind: 'add' as const, denomination: 10 },
      ];
      // Mount WITHOUT a demo first, matching how this actually happens live:
      // the segment is served, then some turns LATER a demo arrives for that
      // same, already-mounted segment. Introducing the demo on the very
      // first render would also fire the unrelated `[live.segmentId]` reset
      // effect on the same commit, which is not the real sequencing.
      const { rerender } = render(
        <LiveSegmentPanel live={traySegmentState('segment-a')} token="tok" onGraded={vi.fn()} demo={null} />,
      );

      rerender(
        <LiveSegmentPanel
          live={traySegmentState('segment-a')}
          token="tok"
          onGraded={vi.fn()}
          demo={{ seq: 7, steps }}
        />,
      );

      // Step 1 applies synchronously at effect start, before the first wait.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText('picked: [5]')).toBeInTheDocument();

      // An unrelated ancestor re-render — same seq, same steps, but a BRAND
      // NEW object reference, exactly what `ConversationView.tsx` produces
      // on every render regardless of whether the demo actually changed.
      rerender(
        <LiveSegmentPanel
          live={traySegmentState('segment-a')}
          token="tok"
          onGraded={vi.fn()}
          demo={{ seq: 7, steps: [...steps] }}
        />,
      );

      // Let the demo's own step delay elapse and reach step 2.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(screen.getByText('picked: [5,10]')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

/*
 * Found by adversarial review, round 87 (2026-08-31, MEDIUM): the ONLY
 * screen-reader announcement that a graded/practice activity had arrived
 * lived in `LessonPlate`'s `peekStatus` span, gated on `resting =
 * !desktop && detent === 'peek'` — unconditionally `false` on the docked
 * desktop panel, the default state for essentially every ordinary desktop
 * conversation (`ConversationView.tsx`'s own round-61 finding on that exact
 * variable). `window.matchMedia` is stubbed here to report the desktop
 * breakpoint that `useDesktopPlate` queries, specifically so this suite
 * cannot pass by accident on an assumption that only holds on a phone —
 * `LiveSegmentPanel` itself never reads that query at all, which is the
 * whole point of the fix: its own live region reaches a learner regardless
 * of which form `LessonPlate` happens to be in.
 */
describe('LiveSegmentPanel — the arrival announcement reaches a screen reader on any breakpoint', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(min-width: 1024px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('announces once, in words, the moment a new segment mounts', () => {
    render(<LiveSegmentPanel live={segmentState('segment-a')} token="tok" onGraded={vi.fn()} />);

    // `getByRole` is accessibility-aware: it would refuse to resolve to a
    // single node if this span were hidden the way `LessonPlate`'s own
    // resting-only span is, which is exactly the property this fix adds.
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('An activity is ready.');
  });

  it('does not re-announce a re-render of the SAME segment, only a genuinely new one', () => {
    const { rerender, container } = render(
      <LiveSegmentPanel live={segmentState('segment-a')} token="tok" onGraded={vi.fn()} />,
    );
    const firstNode = container.querySelector('[role="status"][aria-live="polite"]');
    expect(firstNode).not.toBeNull();

    // A re-render carrying the identical `segmentId` — a fresh object
    // reference, exactly what an ancestor re-rendering for an unrelated
    // reason (a composer keystroke, a mic-level update) produces — must
    // leave this exact DOM node in place. `key={live.segmentId}` is what
    // gives this guarantee; without it a naive implementation could
    // recreate the node (and re-announce) on every unrelated re-render.
    rerender(<LiveSegmentPanel live={segmentState('segment-a')} token="tok" onGraded={vi.fn()} />);
    expect(container.querySelector('[role="status"][aria-live="polite"]')).toBe(firstNode);

    // A GENUINELY new segment, by contrast, must remount the node — this is
    // the mechanism the announcement actually relies on to reach assistive
    // tech for the next activity, proven rather than assumed.
    rerender(<LiveSegmentPanel live={segmentState('segment-b')} token="tok" onGraded={vi.fn()} />);
    const secondNode = container.querySelector('[role="status"][aria-live="polite"]');
    expect(secondNode).not.toBeNull();
    expect(secondNode).not.toBe(firstNode);
    expect(secondNode).toHaveTextContent('An activity is ready.');
  });
});

/*
 * Found live, 2026-09-01: testing a real "give change" activity, in the
 * browser, at the HALF sheet detent on a 375px phone. `framing` (up to 240
 * moderated chars) plus `segment.prompt_md` rendered at 208px against a
 * `header` that was `shrink-0` — refuses to shrink no matter how little room
 * is left — so the answers region below it (`flex-auto`, `min-h-0`, no floor
 * of its own) was squeezed to exactly zero height. `overflow: hidden` on an
 * `h: 0` box: all four options existed in the DOM, each individually
 * measurable via `getBoundingClientRect`, and `elementFromPoint` at every one
 * of their own centers landed on the disabled Check button sitting where the
 * list should have been. No error anywhere; a learner just saw a question
 * with no way to answer it. jsdom has no layout engine, so this cannot assert
 * the actual collapse in pixels the way the live repro did — what it CAN
 * pin, so nobody re-introduces the bug by quietly dropping a class, is the
 * mechanism itself: the header must be able to shrink and scroll internally,
 * and the answers region must carry an explicit floor that does not depend on
 * how much the header needs.
 */
describe('LiveSegmentPanel — a long framing+prompt must not be able to collapse the answers region', () => {
  it('lets the header shrink and scroll instead of refusing to yield space to the answers below it', () => {
    const live: LiveSegmentState = {
      segmentId: 'segment-long',
      seq: 1,
      origin: 'live',
      segment: { type: 'test_input', prompt_md: 'Question for segment-long', payload: {} },
      scoresXp: true,
      framing:
        'Explorer is learning to give change with coins. '.repeat(4) +
        'Let’s practise with a pretend store where they pay with a 10-peso coin and figure out the change.',
    };
    const { container } = render(<LiveSegmentPanel live={live} token="tok" onGraded={vi.fn()} />);

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    // NOT shrink-0 — a header that refuses to shrink is what pushed the
    // answers region below it to zero. min-h-0 is what lets a flex item
    // shrink below its own content size at all; overflow-y-auto is what
    // keeps the framing+prompt text reachable once it does.
    expect(header?.className).not.toMatch(/(^|\s)shrink-0(\s|$)/);
    expect(header?.className).toMatch(/(^|\s)min-h-0(\s|$)/);
    expect(header?.className).toMatch(/(^|\s)shrink(\s|$)/);
    expect(header?.className).toMatch(/overflow-y-auto/);

    // The answers region's own floor — enough for one full option row plus a
    // peek of the next — so it can never again be squeezed all the way to
    // the zero height that made every option unreachable.
    //
    // Selected STRUCTURALLY — the frame that is not the header's — because
    // there are now two `lf-scroll-edge` frames on this panel and a
    // first-match selector would silently start asserting the wrong one.
    const frames = [...container.querySelectorAll('.lf-scroll-edge')];
    const answersWrapper = frames.find((frame) => frame.querySelector('header') === null);
    expect(answersWrapper).toBeDefined();
    expect(answersWrapper?.className).toMatch(/min-h-\[110px\]/);

    /*
     * AND ITS FLEX BASIS IS THAT SAME FLOOR, NOT ITS CONTENT HEIGHT.
     *
     * Found live, 2026-09-02, es-MX at 390x844 (TUTOR_QA_2026-09-02 D2):
     * `flex-auto` gave this scroller a basis of every option laid end to end
     * (171px), so flexbox split the plate's deficit in proportion to that and
     * took 15px off the header — which is the last line of the QUESTION. A
     * scroller's basis belongs at the smallest size it still works at; it can
     * then GROW into whatever is spare, and the header only shrinks once this
     * box has already reached the floor above. `grow` is what keeps it filling
     * the plate when there is room, which `flex-auto` used to provide.
     */
    expect(answersWrapper?.className).toMatch(/basis-\[110px\]/);
    expect(answersWrapper?.className).toMatch(/(^|\s)grow(\s|$)/);
    expect(answersWrapper?.className).not.toMatch(/(^|\s)flex-auto(\s|$)/);
  });

  /*
   * AND THE HEADER SAYS SO WHEN IT DOES HAVE TO SCROLL.
   *
   * The round-137 fix above made this box scrollable and gave the "there is
   * more below" cue to the ANSWERS only. Measured live, 2026-09-02, es-MX at
   * 390x844 with the sheet at HALF: header `clientHeight` 82 against
   * `scrollHeight` 107, so "ahorrado en 4 semanas?" was simply not on screen
   * — with no ellipsis, no fade and no scrollbar. It does not read as cut
   * off, it reads as a complete sentence, and a child can answer a question
   * they never finished reading. `useScrollEdges` marks the scroller's
   * PARENT, so the frame is what has to carry `lf-scroll-edge`.
   */
  it('frames the question in a scroll-edge, so a question that is cut off says so', () => {
    const live: LiveSegmentState = {
      segmentId: 'segment-cued',
      seq: 1,
      origin: 'live',
      segment: { type: 'test_input', prompt_md: 'Question for segment-cued', payload: {} },
      scoresXp: true,
      framing: 'Try this one with me.',
    };
    const { container } = render(<LiveSegmentPanel live={live} token="tok" onGraded={vi.fn()} />);

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header?.parentElement?.className).toMatch(/lf-scroll-edge/);
    // The frame carries the shrink behaviour of the child it wraps, or the
    // round-137 chain (section shrinks frame, frame shrinks header, header
    // scrolls) is broken by the wrapper that was added to cue it.
    expect(header?.parentElement?.className).toMatch(/(^|\s)min-h-0(\s|$)/);
    expect(header?.parentElement?.className).toMatch(/(^|\s)shrink(\s|$)/);
  });
});
