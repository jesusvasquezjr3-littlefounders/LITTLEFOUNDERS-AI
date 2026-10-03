import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixtureDocument } from '../previewDocument';
import { FIN2_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';

const show = (fixture: string, locale: Locale = 'en-US', ageBand: '10-12' | '13-17' = '13-17') => {
  const grade = vi.fn(() => ({ verdict: 'review' as const }));
  render(<LessonDocumentView raw={horizonteFixtureDocument('fin2', fixture, locale)} locale={locale} ageBand={ageBand} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const zone = (name: string) => screen.getByRole('group', { name });
const chip = (name: string) => screen.getByRole('button', { name });
const put = (piece: string, target: string) => { fireEvent.click(chip(piece)); fireEvent.click(zone(target)); };
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check' }));

const STATEMENT_CSS = ['fin2/slotBoard.css', 'fin2/StatementBoard.css'];
const MATRIX_CSS = ['fin2/slotBoard.css', 'fin2/MatrixBoard.css'];
const SCHEDULE_CSS = ['fin2/slotBoard.css', 'fin2/ScheduleBoard.css'];

describe('fin2 boards: the board contract', () => {
  it('statement board, in three locales and with the goal met', async () => {
    await assertBoardContract({ pack: 'fin2', fixtureId: 'cash-flow-short', copy: FIN2_COPY, css: STATEMENT_CSS });
    await assertBoardContract({ pack: 'fin2', fixtureId: 'cash-flow-met', copy: FIN2_COPY, css: STATEMENT_CSS, locales: ['en-US'] });
  }, 60_000);

  it('decision grid: SWOT in three locales, the other four visuals in English', async () => {
    await assertBoardContract({ pack: 'fin2', fixtureId: 'grid-swot-stand', copy: FIN2_COPY, css: MATRIX_CSS });
    for (const fixtureId of ['grid-eisenhower-week', 'grid-two-by-two-ideas', 'grid-decision-spot', 'grid-canvas-lemonade']) {
      await assertBoardContract({ pack: 'fin2', fixtureId, copy: FIN2_COPY, css: MATRIX_CSS, locales: ['en-US'] });
    }
  }, 90_000);

  it('schedule board: Gantt in three locales, kanban and timeline in English', async () => {
    await assertBoardContract({ pack: 'fin2', fixtureId: 'plan-gantt-opening', copy: FIN2_COPY, css: SCHEDULE_CSS });
    for (const fixtureId of ['plan-kanban-opening', 'plan-timeline-opening']) {
      await assertBoardContract({ pack: 'fin2', fixtureId, copy: FIN2_COPY, css: SCHEDULE_CSS, locales: ['en-US'] });
    }
  }, 90_000);
});

describe('statement board (F2.13)', () => {
  it('places items by tap, shows live subtotals and submits the slot map', async () => {
    const grade = show('cash-flow-short');
    await screen.findByRole('group', { name: 'Earned income' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    put('Weekend job pay, $420', 'Earned income');
    expect(status()).toHaveTextContent('Earned income: $420 a month');
    put('Tutoring fees, $180', 'Earned income');
    expect(status()).toHaveTextContent('Earned income: $600 a month');
    put('Savings interest, $12', 'Passive income');
    put('Stock dividends, $25', 'Passive income');
    put('Phone plan, $35', 'Expenses');
    put('Snacks and outings, $90', 'Expenses');
    put('Savings account, $650', 'Assets');
    put('Bike loan balance, $300', 'Liabilities');
    expect(status()).toHaveTextContent('Passive income: $37 a month');
    expect(status()).toHaveTextContent('Expenses: $125 a month');
    put('Passive income is not above expenses', 'Goal check');
    expect(status()).toHaveTextContent('Goal check: Passive income is not above expenses');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({
      slots: {
        earned: ['weekend-job', 'tutoring'], passive: ['savings-interest', 'stock-dividend'], expenses: ['phone-plan', 'snacks'],
        assets: ['savings'], liabilities: ['bike-loan'], goal: ['goal-short'],
      },
    }, 'cash-flow-short', expect.anything()));
  });

  it('refuses a goal statement on a money line and money on the goal line', async () => {
    show('cash-flow-short');
    await screen.findByRole('group', { name: 'Earned income' });
    put('Passive income is not above expenses', 'Expenses');
    put('Weekend job pay, $420', 'Goal check');
    expect(status()).toHaveTextContent('0 of 10 pieces placed');
    expect(status()).toHaveTextContent('Goal check: nothing yet');
  });

  it('moves a piece with the keyboard path: pick a chip, then Move to', async () => {
    const grade = show('cash-flow-short');
    await screen.findByRole('group', { name: 'Earned income' });
    fireEvent.click(chip('Savings account, $650'));
    fireEvent.click(screen.getByRole('button', { name: 'Savings account, $650: Move to' }));
    expect(screen.queryByRole('menuitem', { name: 'Goal check' })).toBeNull();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Assets' }));
    expect(status()).toHaveTextContent('Assets: $650');
    expect(grade).not.toHaveBeenCalled();
  });

  it('takes a placed piece back to the tray and resets to the empty start', async () => {
    show('cash-flow-short');
    await screen.findByRole('group', { name: 'Earned income' });
    put('Phone plan, $35', 'Expenses');
    expect(status()).toHaveTextContent('1 of 10 pieces placed');
    fireEvent.click(chip('Phone plan, $35'));
    fireEvent.click(screen.getByRole('group', { name: 'Pieces' }));
    expect(status()).toHaveTextContent('0 of 10 pieces placed');
    put('Phone plan, $35', 'Expenses');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('0 of 10 pieces placed');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('shows the same state as a table', async () => {
    show('cash-flow-short');
    await screen.findByRole('group', { name: 'Earned income' });
    put('Phone plan, $35', 'Expenses');
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Items by line' });
    const rows = within(table).getAllByRole('row').map((row) => row.textContent);
    expect(rows[0]).toBe('ItemLineAmount');
    expect(rows).toContain('Phone planExpenses$35');
    expect(rows).toContain('Snacks and outingsnothing yet$90');
  });

  it('keeps a wide table inside its own keyboard-reachable scroll region', async () => {
    show('cash-flow-short');
    await screen.findByRole('group', { name: 'Earned income' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const region = screen.getByRole('region', { name: 'Items by line' });
    expect(region).toHaveClass('lf-slotboard-tablewrap');
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getByRole('table', { name: 'Items by line' })).toBeInTheDocument();
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('cash-flow-short', 'es-MX');
    expect(await screen.findByRole('group', { name: 'Ingreso por trabajo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
  });

  it('writes money in the learner currency', async () => {
    show('cash-flow-short', 'pt-BR');
    await screen.findByRole('group', { name: 'Renda do trabalho' });
    expect(screen.getByRole('button', { name: /^Salário de fim de semana, R\$\s420$/ })).toBeTruthy();
  });
});

describe('decision grid board (F2.14)', () => {
  it('sorts SWOT notes into boxes and submits the slot map', async () => {
    const grade = show('grid-swot-stand');
    await screen.findByRole('group', { name: 'Strengths' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    put('Fresh family recipe', 'Strengths');
    put('Loyal regular customers', 'Strengths');
    put('Cash payments only', 'Weaknesses');
    put('Only one person selling', 'Weaknesses');
    put('School fair next month', 'Opportunities');
    put('New park opens nearby', 'Opportunities');
    put('Rainy season starts', 'Threats');
    expect(status()).toHaveTextContent('Strengths: Fresh family recipe, Loyal regular customers.');
    put('Rival stand across the street', 'Threats');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({
      slots: {
        strengths: ['fresh-recipe', 'loyal-regulars'], weaknesses: ['cash-only', 'one-seller'],
        opportunities: ['school-fair', 'new-park'], threats: ['rainy-season', 'rival-stand'],
      },
    }, 'grid-swot-stand', expect.anything()));
  });

  it('names the two-by-two quadrants from the axis labels and lists each idea ratings', async () => {
    const grade = show('grid-two-by-two-ideas');
    await screen.findByRole('group', { name: 'High impact, Low effort' });
    expect(screen.getByText('Dot 1: Effort 2, Impact 8')).toBeTruthy();
    put('Paint a new sign', 'High impact, Low effort');
    put('Print discount cards', 'High impact, Low effort');
    put('Build an ordering app', 'High impact, High effort');
    put('Add extra napkins', 'Low impact, Low effort');
    put('Buy a second cart', 'Low impact, High effort');
    put('Rename the stand', 'Low impact, High effort');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({
      slots: {
        'top-left': ['new-sign', 'discount-card'], 'top-right': ['order-app'], 'bottom-left': ['extra-napkins'], 'bottom-right': ['second-cart', 'rename-stand'],
      },
    }, 'grid-two-by-two-ideas', expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const rows = within(screen.getByRole('table', { name: 'Ideas, ratings and quadrant' })).getAllByRole('row').map((row) => row.textContent);
    expect(rows[0]).toBe('PieceEffortImpactPlace');
    expect(rows[1]).toBe('Paint a new sign28High impact, Low effort');
  });

  it('ranks the decision matrix and swaps when a rank is already taken', async () => {
    const grade = show('grid-decision-spot');
    await screen.findByRole('group', { name: 'Rank 1' });
    expect(status()).toHaveTextContent('Weights: Foot traffic 5, Low rent 3, Shade 2.');
    put('Market corner', 'Rank 1');
    put('Bus stop', 'Rank 1');
    expect(status()).toHaveTextContent('Rank 1: Bus stop.');
    expect(within(screen.getByRole('group', { name: 'Pieces' })).getByRole('button', { name: 'Market corner' })).toBeTruthy();
    put('Market corner', 'Rank 1');
    put('Bus stop', 'Rank 2');
    put('Library steps', 'Rank 3');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({
      slots: { 'rank-1': ['market-corner'], 'rank-2': ['bus-stop'], 'rank-3': ['library-steps'] },
    }, 'grid-decision-spot', expect.anything()));
  });

  it('places a canvas note with the Move to menu', async () => {
    show('grid-canvas-lemonade');
    await screen.findByRole('group', { name: 'Value proposition' });
    fireEvent.click(chip('Fresh cold juice, fast'));
    fireEvent.click(screen.getByRole('button', { name: 'Fresh cold juice, fast: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Value proposition' }));
    expect(status()).toHaveTextContent('Value proposition: Fresh cold juice, fast.');
  });

  it('keeps the Eisenhower fixture at the 10-12 age band', async () => {
    show('grid-eisenhower-week', 'en-US', '10-12');
    expect(await screen.findByRole('group', { name: 'Do now' })).toBeTruthy();
    expect(screen.getByText('Urgent and important')).toBeTruthy();
  });
});

describe('schedule board (F2.15)', () => {
  it('flags a Gantt task that starts before its prerequisite ends, then accepts a valid plan', async () => {
    const grade = show('plan-gantt-opening');
    await screen.findByRole('group', { name: 'Period 1' });
    expect(status()).toHaveTextContent('Deadline: Period 5. Workers: 2.');
    put('Design the menu', 'Period 1');
    put('Print the menu', 'Period 1');
    expect(status()).toHaveTextContent('Breaks a rule: Print the menu.');
    put('Print the menu', 'Period 3');
    expect(status()).toHaveTextContent('No task breaks a rule.');
    put('Buy lemons', 'Period 1');
    put('Squeeze the juice', 'Period 2');
    put('Open the stand', 'Period 4');
    put('Paint the sign', 'Period 4');
    expect(status()).toHaveTextContent('6 of 6 pieces placed');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({
      slots: { 'period-1': ['design-menu', 'shop-lemons'], 'period-2': ['squeeze-juice'], 'period-3': ['print-menu'], 'period-4': ['open-stand', 'make-sign'] },
    }, 'plan-gantt-opening', expect.anything()));
  });

  it('flags periods with more tasks than workers', async () => {
    show('plan-gantt-opening');
    await screen.findByRole('group', { name: 'Period 1' });
    put('Design the menu', 'Period 1');
    put('Buy lemons', 'Period 1');
    put('Paint the sign', 'Period 1');
    expect(status()).toHaveTextContent('Breaks a rule: Design the menu, Buy lemons, Paint the sign.');
  });

  it('moves a kanban card into Doing up to the limit and no further', async () => {
    const grade = show('plan-kanban-opening');
    await screen.findByRole('group', { name: 'Doing' });
    expect(within(zone('Done')).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Design the menu', 'Buy cups']);
    expect(screen.queryByRole('group', { name: 'Pieces' })).toBeNull();
    put('Print the menu', 'Doing');
    put('Buy lemons', 'Doing');
    put('Set up the tables', 'Doing');
    expect(status()).toHaveTextContent('Doing: Print the menu, Buy lemons.');
    expect(status()).toHaveTextContent('To do: Set up the tables, Open the stand.');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({
      slots: { doing: ['print-menu', 'buy-lemons'], todo: ['set-tables', 'open-stand'] },
    }, 'plan-kanban-opening', expect.anything()));
  });

  it('offers no way back to a tray on the kanban board', async () => {
    show('plan-kanban-opening');
    await screen.findByRole('group', { name: 'Doing' });
    fireEvent.click(chip('Print the menu'));
    fireEvent.click(screen.getByRole('button', { name: 'Print the menu: Move to' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).not.toContain('Back to the pieces');
    expect(items.map((item) => item.textContent)).toContain('Doing');
  });

  it('puts one task in each timeline step, swaps on a taken step and flags a missed due step', async () => {
    show('plan-timeline-opening', 'en-US', '10-12');
    await screen.findByRole('group', { name: 'Step 1' });
    put('Set the price', 'Step 1');
    put('Buy lemons', 'Step 1');
    expect(status()).toHaveTextContent('Step 1: Buy lemons.');
    put('Paint the sign', 'Step 5');
    expect(status()).toHaveTextContent('Breaks a rule: Paint the sign.');
    expect(screen.getByText('After: Set the price. Due by step 3')).toBeTruthy();
  });

  it('shows the same plan as a table', async () => {
    show('plan-gantt-opening');
    await screen.findByRole('group', { name: 'Period 1' });
    put('Design the menu', 'Period 2');
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const rows = within(screen.getByRole('table', { name: 'Tasks and start periods' })).getAllByRole('row').map((row) => row.textContent);
    expect(rows[0]).toBe('TaskAfterPeriodsPlace');
    expect(rows[1]).toBe('Design the menunothing yet2Period 2');
  });

  it('writes how long a task takes by the locale plural rule', async () => {
    show('plan-gantt-opening', 'pt-BR');
    await screen.findByRole('group', { name: 'Período 1' });
    expect(screen.getAllByText(/Leva 1 período(?!s)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Leva 2 períodos/).length).toBeGreaterThan(0);
  });

  it('speaks the schedule board in Portuguese', async () => {
    show('plan-kanban-opening', 'pt-BR');
    expect(await screen.findByRole('group', { name: 'Em andamento' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Feito' })).toBeTruthy();
  });
});

describe('fin2 copy', () => {
  it('keeps every string in three locales', () => {
    for (const [key, entry] of Object.entries(FIN2_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
  });
});
