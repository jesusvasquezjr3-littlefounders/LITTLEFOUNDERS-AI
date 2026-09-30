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

  it('GAP-FIX-R3: names the L1 rule-card selection codes in the structure-vs-answer split', () => {
    const v2Signals = { transfer: [], firstUnaided: [], detection: [],
      errorSplit: { structure: 1, answer: 7, byDiagnostic: [
        { family: 'answer', diagnostic: 'confirmation_bias', errors: 4 }, { family: 'answer', diagnostic: 'p_only_missing_not_q', errors: 2 },
        { family: 'answer', diagnostic: 'value', errors: 1 }, { family: 'structure', diagnostic: 'structure', errors: 1 }] } };
    for (const [locale, name, first] of [['en-US', 'Rule-card choices', 'Looked for agreeing cards: 4'], ['es-MX', 'Elecciones con tarjetas de regla', 'Buscó tarjetas que coinciden: 4'],
      ['pt-BR', 'Escolhas nas cartas de regra', 'Procurou cartas que concordam: 4']] as const) {
      const { unmount } = render(<LearningQualityPanel state={{ status: 'ready', report: { ...learningQualityFixture(), v2Signals } }} locale={locale} dark={false}
        onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />);
      expect(screen.getByText(name)).toBeTruthy();
      expect(screen.getByText(first)).toBeTruthy();
      expect(document.body.textContent).not.toContain('confirmation_bias');
      unmount();
    }
  });

  it('GAP-FIX-R4: names the Euler occupancy and conclusion codes and the rule-switch code', () => {
    const v2Signals = { transfer: [], firstUnaided: [], detection: [],
      errorSplit: { structure: 2, answer: 3, byDiagnostic: [
        { family: 'structure', diagnostic: 'rule_switch', errors: 2 }, { family: 'answer', diagnostic: 'occupancy', errors: 2 }, { family: 'answer', diagnostic: 'conclusion', errors: 1 }] } };
    for (const [locale, name, first] of [['en-US', 'Diagram and sorting choices', 'Kept the old rule: 2'], ['es-MX', 'Elecciones en diagramas y clasificación', 'Siguió con la regla anterior: 2'],
      ['pt-BR', 'Escolhas em diagramas e separação', 'Manteve a regra antiga: 2']] as const) {
      const { unmount } = render(<LearningQualityPanel state={{ status: 'ready', report: { ...learningQualityFixture(), v2Signals } }} locale={locale} dark={false}
        onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />);
      expect(screen.getByText(name)).toBeTruthy();
      expect(screen.getByText(first)).toBeTruthy();
      expect(document.body.textContent).not.toMatch(/rule_switch|\boccupancy\b/);
      unmount();
    }
  });

  it('offers only decisions that move a lesson toward its band and enforces the note and guard rails before sending', async () => {
    const onResolve = vi.fn(async (): Promise<DecisionOutcome> => 'resolved');
    const onRetry = vi.fn();
    render(<LearningQualityPanel state={{ status: 'ready', report: learningQualityFixture() }} locale="en-US" dark={false}
      onRetry={onRetry} onSync={async () => true} onResolve={onResolve} />);
    const review = screen.getByRole('form');
    expect(within(review).getByRole('radio', { name: 'Make harder' })).toBeTruthy();
    expect(within(review).queryByRole('radio', { name: 'Make easier' })).toBeNull();
    fireEvent.click(within(review).getByRole('radio', { name: 'Adjust band' }));
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
    fireEvent.click(within(review).getByRole('radio', { name: 'Dejar igual' }));
    fireEvent.change(within(review).getByLabelText('Nota de la decisión'), { target: { value: 'Seguimos observando.' } });
    fireEvent.click(within(review).getByRole('button', { name: 'Registrar decisión' }));
    expect(await within(review).findByRole('alert')).toHaveTextContent('Alguien ya decidió esta revisión.');
    unmount();
    render(<LearningQualityPanel state={{ status: 'ready', report: { ...learningQualityFixture(), lessons: 'x' } }} locale="en-US" dark={false}
      onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load learning quality.');
  });

  it('gap-fix round 7: lists the open gate-effectiveness reviews with owner and age, and closes one through the writer', async () => {
    const onResolveGateReview = vi.fn(async () => 'resolved' as const);
    render(<LearningQualityPanel state={{ status: 'ready', report: learningQualityFixture() }} locale="en-US" dark={false}
      onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} onResolveGateReview={onResolveGateReview} />);
    expect(screen.getByText('forge.gate.12.tone: open 106 days')).toBeTruthy();
    expect(screen.getByText('Overdue: over 90 days')).toBeTruthy();
    expect(screen.getByText('Owner: Content engineering')).toBeTruthy();
    const [first] = screen.getAllByRole('button', { name: 'Close review' });
    const form = first!.closest('form')!;
    fireEvent.click(within(form).getByRole('radio', { name: 'Lexicon extended' }));
    fireEvent.change(within(form).getByLabelText(/Why the gate missed it/), { target: { value: 'The idiom was not in the tone lexicon.' } });
    fireEvent.click(first!);
    await waitFor(() => expect(onResolveGateReview).toHaveBeenCalledWith('cccccccc-0000-4000-8000-000000000001',
      { outcome: 'lexicon_extended', note: 'The idiom was not in the tone lexicon.' }));
    await waitFor(() => expect(screen.queryByText('forge.gate.12.tone: open 106 days')).toBeNull());
  });

  it('keeps the staff copy inside the adult Copy Budget in every locale', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      const { unmount, container } = render(<LearningQualityPanel state={{ status: 'ready', report: learningQualityFixture() }} locale={locale} dark={false}
        onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} onResolveGateReview={async () => 'resolved'} />);
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

  it('GAP-FIX-R7 (Appendix C 1.1, B.9): shows decision-journal coverage next to the resurfacing rate as a release-1 baseline', () => {
    const { unmount } = render(<LearningQualityPanel state={{ status: 'ready', report: learningQualityFixture() }} locale="en-US" dark={false}
      onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />);
    expect(screen.getByRole('heading', { name: 'Story choice journal' })).toBeTruthy();
    expect(screen.getByText('The journal kept 42 of 48 story choices (88%).')).toBeTruthy();
    expect(screen.getByText('14 of 40 kept choices came back in a later lesson.')).toBeTruthy();
    expect(screen.getByText('3 choices from learners without journal consent are not counted.')).toBeTruthy();
    expect(screen.getByText('Release 1 baseline. No target yet.')).toBeTruthy();
    unmount();
    const empty = { ...learningQualityFixture(), decisionJournal: { decisionsMade: 0, decisionsJournaled: 0, withoutConsent: 0, coverage: null,
      recorded: 0, resurfaced: 0, resurfacingRate: null, baseline: 'release-1' } };
    const second = render(<LearningQualityPanel state={{ status: 'ready', report: empty }} locale="en-US" dark={false}
      onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />);
    expect(screen.getByText('No story choices in this window.')).toBeTruthy();
    expect(screen.queryByText(/without journal consent/)).toBeNull();
    second.unmount();
    render(<LearningQualityPanel state={{ status: 'ready', report: { ...learningQualityFixture(), decisionJournal: null } }} locale="en-US" dark={false}
      onRetry={() => {}} onSync={async () => true} onResolve={async () => 'resolved'} />);
    expect(screen.getByText('Available once the journal coverage migration is applied.')).toBeTruthy();
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
