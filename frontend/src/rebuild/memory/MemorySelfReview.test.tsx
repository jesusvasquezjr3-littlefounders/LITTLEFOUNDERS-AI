import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemorySelfReview, type MemoryProposal, type SettledVerdict } from './MemorySelfReview';
import en from '@/i18n/en-US/rebuild-profile.json';

const copy = en.memorySelfReview;

const NOTE: MemoryProposal = {
  id: 'n1',
  store: 'learner',
  proposed: 'Loves solving money puzzles.',
  expectedBefore: 'Older note.',
  sessionId: 's1',
  createdAt: '2026-09-24T10:00:00Z',
};
const NOTE2: MemoryProposal = { ...NOTE, id: 'n2', proposed: 'Asks about saving.', expectedBefore: null };

type Props = Parameters<typeof MemorySelfReview>[0];
function renderView(overrides: Partial<Props> = {}) {
  return render(<MemorySelfReview copy={copy} locale="en-US" dark={false} phase="ready"
    notes={[NOTE]} current={{ learner: 'Older note.', pedagogy: null }} deciding={null} settled={{}} failedId={null}
    notice={null} noticeKind={null} onDecide={vi.fn()} onRetry={vi.fn()} {...overrides} />);
}

describe('MemorySelfReview', () => {
  it('announces the panel and declares the heading copy role', () => {
    const view = renderView();
    const section = view.container.querySelector('.lf-memory-self-review')!;
    expect(section).toHaveAttribute('aria-label', copy.title);
    expect(section).toHaveAttribute('lang', 'en-US');
    expect(section).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('data-copy-role', 'heading');
  });

  it('shows the loading status and no decisions while the queue loads', () => {
    renderView({ phase: 'loading' });
    expect(screen.getByRole('status')).toHaveTextContent(copy.loading);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reports a failed read with a retry action, never an empty queue', () => {
    const onRetry = vi.fn();
    renderView({ phase: 'failed', notes: [], onRetry });
    expect(screen.getByRole('alert')).toHaveTextContent(copy.loadFailed);
    expect(screen.queryByText(copy.empty)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: copy.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the current note, the proposal, and what it would replace', () => {
    const view = renderView();
    expect(screen.getAllByText(copy.currentLabel)).toHaveLength(2);
    expect(view.container.querySelector('.lf-memory-current [data-copy-role="data"]')).toHaveTextContent('Older note.');
    expect(screen.getByText(NOTE.proposed)).toHaveAttribute('data-copy-role', 'data');
    // 02 rule 19: the proposal date is text too (found undeclared by the S03.5 authenticated-route audit).
    expect(view.container.querySelector('.lf-memory-note time')).toHaveAttribute('data-copy-role', 'data');
    expect(screen.getByText(copy.replacesLabel)).toBeInTheDocument();
    expect(screen.getAllByText('Older note.')).toHaveLength(2);
    // The learner note exists; only the pedagogy note (none yet) says so.
    expect(view.container.querySelector('[data-memory-store="learner"]')).not.toHaveTextContent(copy.currentEmpty);
    expect(view.container.querySelector('[data-memory-store="pedagogy"]')).toHaveTextContent(copy.currentEmpty);
  });

  it('shows the empty copy when nothing is waiting but keeps the current note', () => {
    renderView({ notes: [], current: { learner: 'Enjoys trading card games.', pedagogy: null } });
    expect(screen.getByText(copy.empty)).toBeInTheDocument();
    expect(screen.getByText('Enjoys trading card games.')).toBeInTheDocument();
  });

  it('offers Approve and Delete and sends the matching verdict', () => {
    const onDecide = vi.fn();
    renderView({ onDecide });
    const approve = screen.getByRole('button', { name: copy.approve });
    const remove = screen.getByRole('button', { name: copy.delete });
    expect(approve).toHaveAttribute('data-copy-role', 'action');
    expect(remove).toHaveAttribute('data-copy-role', 'action');
    fireEvent.click(approve);
    expect(onDecide).toHaveBeenLastCalledWith('n1', 'approved');
    fireEvent.click(remove);
    expect(onDecide).toHaveBeenLastCalledWith('n1', 'rejected');
  });

  it('disables both actions and announces the decision while it is in flight', () => {
    renderView({ deciding: 'n1' });
    expect(screen.getByRole('button', { name: copy.approve })).toBeDisabled();
    expect(screen.getByRole('button', { name: copy.delete })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(copy.deciding);
  });

  it.each<[SettledVerdict, string]>([['kept', 'Note kept.'], ['deleted', 'Note deleted.']])(
    'renders a settled %s decision as an informational status, not a button',
    (verdict, text) => {
      renderView({ settled: { n1: verdict } });
      expect(screen.getByRole('status')).toHaveTextContent(text);
      expect(screen.queryByRole('button', { name: copy.approve })).toBeNull();
      expect(screen.queryByRole('button', { name: copy.delete })).toBeNull();
    },
  );

  it('marks a note out of date when the current note has moved past it', () => {
    renderView({ current: { learner: 'A newer note, already approved.', pedagogy: null } });
    expect(screen.getByText(copy.outOfDate)).toBeInTheDocument();
  });

  it('reports a refused decision next to the note that failed', () => {
    renderView({ failedId: 'n1' });
    expect(screen.getByRole('alert')).toHaveTextContent(copy.decisionFailed);
    expect(screen.getByRole('button', { name: copy.approve })).toBeEnabled();
  });

  it('renders a conflict notice as an alert, distinct from a success', () => {
    renderView({ notice: copy.changed, noticeKind: 'alert' });
    expect(screen.getByRole('alert')).toHaveTextContent(copy.changed);
    expect(screen.queryByText(copy.kept)).toBeNull();
  });

  it('moves focus to the next action when a decided button leaves the DOM', () => {
    const view = renderView({ notes: [NOTE, NOTE2], onDecide: vi.fn() });
    const approveButtons = screen.getAllByRole('button', { name: copy.approve });
    fireEvent.click(approveButtons[0]!);
    view.rerender(<MemorySelfReview copy={copy} locale="en-US" dark={false} phase="ready"
      notes={[NOTE, NOTE2]} current={{ learner: 'Older note.', pedagogy: null }} deciding="n1" settled={{}} failedId={null}
      notice={null} noticeKind={null} onDecide={vi.fn()} onRetry={vi.fn()} />);
    view.rerender(<MemorySelfReview copy={copy} locale="en-US" dark={false} phase="ready"
      notes={[NOTE, NOTE2]} current={{ learner: 'Older note.', pedagogy: null }} deciding={null} settled={{ n1: 'kept' }} failedId={null}
      notice={null} noticeKind={null} onDecide={vi.fn()} onRetry={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: copy.approve })[0]);
  });

  it('shows BOTH notes, each with its own queue and actions (C.4, OD-18)', () => {
    const onDecide = vi.fn();
    const pedagogy: MemoryProposal = { ...NOTE, id: 'p1', store: 'pedagogy', proposed: 'A picture first helps.', expectedBefore: 'Short steps help.' };
    const view = renderView({ notes: [NOTE, pedagogy], current: { learner: 'Older note.', pedagogy: 'Short steps help.' }, onDecide });
    expect(screen.getByRole('heading', { level: 3, name: copy.learnerStore })).toHaveAttribute('data-copy-role', 'heading');
    expect(screen.getByRole('heading', { level: 3, name: copy.pedagogyStore })).toBeInTheDocument();
    const group = view.container.querySelector('[data-memory-store="pedagogy"]') as HTMLElement;
    expect(group).toHaveTextContent('Short steps help.');
    expect(group).toHaveTextContent('A picture first helps.');
    // Written against the note in force: not marked out of date.
    expect(group.querySelector('.lf-memory-chip')).toBeNull();
    fireEvent.click(group.querySelector('button:last-of-type') as HTMLButtonElement);
    expect(onDecide).toHaveBeenLastCalledWith('p1', 'rejected');
  });
});
