import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
