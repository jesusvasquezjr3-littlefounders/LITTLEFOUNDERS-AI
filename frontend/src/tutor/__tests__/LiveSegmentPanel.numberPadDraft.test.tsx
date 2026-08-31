import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LiveSegmentPanel } from '../LiveSegmentPanel';
import type { LiveSegmentPanelProps } from '../LiveSegmentPanel';
import type { LiveSegmentState } from '../useTutorSocket';

/*
 * A LIVE-SESSION REPRODUCTION ATTEMPT FOR A REPORTED "THE NUMBER PAD DOES NOT
 * RESPOND" DEFECT — deliberately using the REAL, unmocked `registry` (unlike
 * this directory's other `LiveSegmentPanel` suites, which stand in a
 * minimal fake renderer because their own question is about the staleness
 * guard, not about a real exercise). This one is about a real `number_input`
 * screen's draft state specifically, so a fake renderer would prove nothing.
 *
 * THE HYPOTHESIS UNDER TEST, verbatim from the report that opened this
 * investigation: a live socket pushes a continuous stream of turn/budget/mic
 * frames while a graded activity is open, and `LiveSegmentPanel`'s own
 * segment-reset effect — `useEffect(() => { setDraft(undefined); ...
 * onCharacterCue?.(null) }, [live.segmentId, onCharacterCue])` — could be
 * refiring on every one of those UNRELATED updates rather than only on a
 * genuinely new segment, wiping a learner's in-progress tap before it is ever
 * seen. Two ways that could happen: (a) `live` gets a brand-new object
 * reference on every socket message even when `segmentId` itself has not
 * changed, or (b) `onCharacterCue` is not the stable function production
 * wiring assumes.
 *
 * WHAT THIS TEST FOUND: neither holds. `ConversationView.tsx` passes
 * `onCharacterCue={onCharacterCue}` straight through from
 * `TutorExperience.tsx`'s `onCharacterCue: setSegmentCue` — a React
 * `useState` setter, which React guarantees is referentially stable for the
 * lifetime of the component — so the effect's second dependency never
 * changes on an unrelated re-render. And even in the WORSE case here, where
 * `live` is deliberately rebuilt as a fresh object on every render (matching
 * what an ancestor re-rendering for any other reason would hand down,
 * exactly as `LiveSegmentPanel.test.tsx`'s own "does not re-announce…" test
 * already established for the announcement span), the effect's first
 * dependency is the PRIMITIVE `live.segmentId` string — `Object.is` compares
 * two equal strings as equal regardless of which object they came out of —
 * so the effect correctly does not refire and the draft survives.
 *
 * This suite exists so that guarantee is asserted rather than assumed: if a
 * future change makes `live` or `onCharacterCue` unstable, or changes the
 * reset effect's dependency array, this is what turns red.
 */

function numberInputSegment(id: string): LiveSegmentState {
  return {
    segmentId: id,
    seq: 1,
    origin: 'live',
    segment: {
      id,
      type: 'number_input',
      prompt_md: 'You have 10 pesos. Each week you add 2 pesos. How many pesos after 3 weeks?',
      difficulty: 1,
      xp: 10,
      payload: {},
    } as unknown as LiveSegmentState['segment'],
    scoresXp: true,
    framing: '',
  };
}

/**
 * Stands in for `ConversationView` re-rendering for a reason that has
 * NOTHING to do with the open activity — a composer keystroke, a mic-level
 * tick, a budget/state frame — the exact class of event a live socket
 * delivers continuously while a learner is answering. `onCharacterCue`
 * mirrors production: `useState`'s own setter, not a fresh closure.
 */
function LiveLikeHost({ segmentId, rebuildLiveEveryRender }: { segmentId: string; rebuildLiveEveryRender: boolean }) {
  const [tick, setTick] = useState(0);
  const [, setCue] = useState<null>(null);
  const stableSegment = numberInputSegment(segmentId);
  const live = rebuildLiveEveryRender ? numberInputSegment(segmentId) : stableSegment;
  return (
    <div>
      <button type="button" onClick={() => setTick((n) => n + 1)}>
        unrelated re-render #{tick}
      </button>
      <LiveSegmentPanel live={live} token="tok" onGraded={vi.fn()} onCharacterCue={setCue as LiveSegmentPanelProps['onCharacterCue']} />
    </div>
  );
}

describe('LiveSegmentPanel — a number_input draft must survive live-session churn', () => {
  it('a digit tap updates the readout with no other state in play', () => {
    render(<LiveSegmentPanel live={numberInputSegment('seg-1')} token="tok" onGraded={vi.fn()} onCharacterCue={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(screen.getByLabelText('Your answer')).toHaveTextContent('8');
  });

  it('digits accumulate across several taps in a row', () => {
    render(<LiveSegmentPanel live={numberInputSegment('seg-1')} token="tok" onGraded={vi.fn()} onCharacterCue={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '6' }));
    expect(screen.getByLabelText('Your answer')).toHaveTextContent('16');
    expect(screen.getByRole('button', { name: 'Check' })).not.toBeDisabled();
  });

  it('a tap survives a same-segment re-render through a STABLE onCharacterCue (the actual production wiring)', () => {
    render(<LiveLikeHost segmentId="seg-1" rebuildLiveEveryRender={false} />);
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(screen.getByLabelText('Your answer')).toHaveTextContent('8');

    // The unrelated re-render a live socket frame would cause.
    fireEvent.click(screen.getByText(/unrelated re-render/));
    expect(screen.getByLabelText('Your answer')).toHaveTextContent('8');
  });

  it('a tap survives even the WORSE case: a brand-new `live` object every render, same segmentId', () => {
    render(<LiveLikeHost segmentId="seg-1" rebuildLiveEveryRender={true} />);
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(screen.getByLabelText('Your answer')).toHaveTextContent('8');

    fireEvent.click(screen.getByText(/unrelated re-render/));
    fireEvent.click(screen.getByText(/unrelated re-render/));
    fireEvent.click(screen.getByText(/unrelated re-render/));
    expect(screen.getByLabelText('Your answer')).toHaveTextContent('8');

    // The activity is still fully answerable after the churn.
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByLabelText('Your answer')).toHaveTextContent('82');
    expect(screen.getByRole('button', { name: 'Check' })).not.toBeDisabled();
  });

  it('a GENUINELY new segment (a different segmentId) still resets the draft, as designed', () => {
    const { rerender } = render(
      <LiveSegmentPanel live={numberInputSegment('seg-1')} token="tok" onGraded={vi.fn()} onCharacterCue={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(screen.getByLabelText('Your answer')).toHaveTextContent('8');

    rerender(<LiveSegmentPanel live={numberInputSegment('seg-2')} token="tok" onGraded={vi.fn()} onCharacterCue={vi.fn()} />);
    expect(screen.getByLabelText('Your answer')).not.toHaveTextContent('8');
  });
});
