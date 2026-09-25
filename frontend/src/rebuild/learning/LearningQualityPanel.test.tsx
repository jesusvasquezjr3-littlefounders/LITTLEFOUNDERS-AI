import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type CopyRole } from '../design/copyBudget';
import { LearningQualityPanel, type DecisionOutcome } from './LearningQualityPanel';
import { learningQualityFixture } from './learningQualityFixtures';

describe('S05.3d staff learning-quality panel', () => {
  it('shows each lesson against its band, the reasoning signal and the replay notice rate', () => {
    render(<LearningQualityPanel state={{ status: 'ready', report: learningQualityFixture() }} locale="en-US" dark={false}
      onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />);
    expect(screen.getByText('Practice should land at 70-85% first-try success per lesson.')).toBeTruthy();
    expect(screen.getAllByText('Too easy').length).toBeGreaterThan(0);
    expect(screen.getByText('Tracks correctness only')).toBeTruthy();
    expect(screen.getByText('9 of 10 lower replays showed the saved best.')).toBeTruthy();
    expect(screen.getByText('Below the 100% target.')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}/);
  });

  it('offers only decisions that move a lesson toward its band and enforces the note and guard rails before sending', async () => {
    const onResolve = vi.fn(async (): Promise<DecisionOutcome> => 'resolved');
    const onRetry = vi.fn();
    render(<LearningQualityPanel state={{ status: 'ready', report: learningQualityFixture() }} locale="en-US" dark={false}
      onRetry={onRetry} onSync={async () => true} onResolve={onResolve} />);
    const review = screen.getByRole('form');
    expect(within(review).getByRole('button', { name: 'Make harder' })).toBeTruthy();
    expect(within(review).queryByRole('button', { name: 'Make easier' })).toBeNull();
    fireEvent.click(within(review).getByRole('button', { name: 'Adjust band' }));
    fireEvent.change(within(review).getByLabelText('Lower %'), { target: { value: '90' } });
    fireEvent.change(within(review).getByLabelText('Upper %'), { target: { value: '99' } });
    const record = within(review).getByRole('button', { name: 'Record decision' });
    expect(record).toBeDisabled();
    fireEvent.change(within(review).getByLabelText('Decision note'), { target: { value: 'Teen pathway trends higher.' } });
    fireEvent.click(record);
    expect(await within(review).findByRole('alert')).toHaveTextContent('Keep the band between 50 and 95%, at least 5 points wide.');
    expect(onResolve).not.toHaveBeenCalled();
    fireEvent.change(within(review).getByLabelText('Lower %'), { target: { value: '75' } });
    fireEvent.change(within(review).getByLabelText('Upper %'), { target: { value: '90' } });
    fireEvent.click(record);
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith('bbbbbbbb-0000-4000-8000-000000000001',
      { decision: 'adjust_band', note: 'Teen pathway trends higher.', lowerPct: 75, upperPct: 90 }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('says so when someone else decided first, and fails closed on a malformed report', async () => {
    const { unmount } = render(<LearningQualityPanel state={{ status: 'ready', report: learningQualityFixture() }} locale="es-MX" dark
      onRetry={() => {}} onSync={async () => true} onResolve={async () => 'conflict'} />);
    const review = screen.getByRole('form');
    fireEvent.click(within(review).getByRole('button', { name: 'Dejar igual' }));
    fireEvent.change(within(review).getByLabelText('Nota de la decisión'), { target: { value: 'Seguimos observando.' } });
    fireEvent.click(within(review).getByRole('button', { name: 'Registrar decisión' }));
    expect(await within(review).findByRole('alert')).toHaveTextContent('Alguien ya decidió esta revisión.');
    unmount();
    render(<LearningQualityPanel state={{ status: 'ready', report: { ...learningQualityFixture(), lessons: 'x' } }} locale="en-US" dark={false}
      onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load learning quality.');
  });

  it('keeps the staff copy inside the adult Copy Budget in every locale', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      const { unmount, container } = render(<LearningQualityPanel state={{ status: 'ready', report: learningQualityFixture() }} locale={locale} dark={false}
        onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />);
      for (const element of container.querySelectorAll<HTMLElement>('[data-copy-role]')) {
        if (element.parentElement?.closest('[data-copy-role]')) continue;
        const role = element.dataset.copyRole as CopyRole;
        const text = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE || (node as HTMLElement).tagName === 'STRONG')
          .map((node) => node.textContent).join('');
        expect(checkCopy(text, role, { locale, ageBand: 'adult', surface: 'app' }), text).toEqual([]);
      }
      unmount();
    }
  });

  it('S05.3e: shows rest-day utilization and the three autonomy levers, and says when the migration is pending', () => {
    const { unmount } = render(<LearningQualityPanel state={{ status: 'ready', report: learningQualityFixture() }} locale="en-US" dark={false}
      onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />);
    expect(screen.getByRole('heading', { name: 'Motivation signals' })).toBeTruthy();
    expect(screen.getByText('Rest days kept 31 of 40 streaks that met a missed day.')).toBeTruthy();
    expect(screen.getByText('Path choice')).toBeTruthy();
    expect(screen.getByText('34 of 120 chose it themselves.')).toBeTruthy();
    expect(screen.queryByText(/avatar/i)).toBeNull();
    unmount();
    render(<LearningQualityPanel state={{ status: 'ready', report: { ...learningQualityFixture(), motivation: null } }} locale="en-US" dark={false}
      onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />);
    expect(screen.getByText('Available once the motivation migration is applied.')).toBeTruthy();
  });
});
