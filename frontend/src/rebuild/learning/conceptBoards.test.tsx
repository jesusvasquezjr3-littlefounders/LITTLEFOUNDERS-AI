import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type CopyRole } from '../design/copyBudget';
import { conceptCopy, type ConceptCopy } from './conceptCopy';
import { reallocate } from './conceptBoards';
import { LessonDocumentView } from './LessonDocumentView';
import { loadLessonClientDocument, REQUIRED_SEGMENT_CAPABILITIES } from './lessonDocument';
import { taxSankey } from './TaxBracketBoard';
import { chartProblem } from './charts/chartModel.generated';
import { amortizationSchedule } from './v2ConceptBoards.generated';

/*
 * GAP-FIX-R1 learning (Appendix A Part 3; B.7 part 2): the concept boards play
 * in the general player, draw from the canonical model, send only integers
 * and ids to Core, keep predictions hidden until met, and keep their labels in
 * the Copy Budget in three locales.
 */

vi.mock('../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const SEGMENTS = {
  loan: { id: 'loan-01', type: 'money.amortization.v2', grading: 'server', prompt: 'How much is still owed after month 6?', visual: { type: 'amortization' },
    payload: { currency: 'coins', principal_minor: 1200, rate_bps: 1200, months: 12 } },
  market: { id: 'market-01', type: 'econ.supply-demand.v2', grading: 'server', prompt: 'Move a curve, then say what the price does.', visual: { type: 'supply-demand' },
    payload: { demand: { intercept: 100, slope: 2 }, supply: { intercept: 10, slope: 1 }, shift_step: 10, max_shift: 2, labels: { price: 'Price', quantity: 'Cups', demand: 'Want to buy', supply: 'Want to sell' } } },
  tokens: { id: 'tokens-01', type: 'money.opportunity-cost.v2', grading: 'none', prompt: 'Pick what matters most.', visual: { type: 'token-chooser' },
    payload: { tokens: 3, options: [{ id: 'opt-movie', label: 'Movie', cost: 2 }, { id: 'opt-snack', label: 'Snack', cost: 1 }, { id: 'opt-game', label: 'Game', cost: 2 }] } },
  prices: { id: 'prices-01', type: 'money.inflation.v2', grading: 'server', prompt: 'Guess the price later.', visual: { type: 'inflation' },
    payload: { currency: 'coins', price_minor: 100, min_rate_bps: 100, max_rate_bps: 1000, rate_step_bps: 100, min_years: 5, max_years: 30, year_step: 5, prediction_step_minor: 10, prediction_max_minor: 2000 } },
  double: { id: 'double-01', type: 'money.rule-of-72.v2', grading: 'server', prompt: 'Guess the years to double.', visual: { type: 'doubling' },
    payload: { currency: 'coins', principal_minor: 100, min_rate_bps: 200, max_rate_bps: 1200, rate_step_bps: 100 } },
  debts: { id: 'debts-01', type: 'money.debt-payoff.v2', grading: 'server', prompt: 'Which plan pays the least interest?', visual: { type: 'debt-race' },
    payload: { currency: 'coins', budget_minor: 150, debts: [{ id: 'debt-card', label: 'Card', balance_minor: 1000, rate_bps: 2400, minimum_minor: 30 }, { id: 'debt-loan', label: 'Loan', balance_minor: 300, rate_bps: 600, minimum_minor: 20 }] } },
  mix: { id: 'mix-01', type: 'money.diversification.v2', grading: 'server', prompt: 'Spread your money.', visual: { type: 'portfolio' },
    payload: { assets: [{ id: 'asset-stocks', label: 'Stocks', return_bps: 800, risk_bps: 2000 }, { id: 'asset-bonds', label: 'Bonds', return_bps: 300, risk_bps: 600 }], step: 10 } },
  stand: { id: 'stand-01', type: 'money.lemonade-stand.v2', grading: 'server', prompt: 'Earn at least 250 coins.', visual: { type: 'lemonade-stand' },
    payload: { currency: 'coins', cost_per_cup_minor: 2, fixed_cost_minor: 10, max_price_minor: 20, price_step_minor: 2, demand_at_zero: 60, cups_lost_per_step: 5, max_cups: 60 } },
} as const;

function lesson(segment: (typeof SEGMENTS)[keyof typeof SEGMENTS], ageBand: '13-17' | '10-12' = '13-17') {
  const doc = structuredClone(segment) as unknown as { type: keyof typeof REQUIRED_SEGMENT_CAPABILITIES };
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-13-17', chapter_id: 'money-models', lesson_id: 'concept-lesson',
    version_id: 'rev-1', locale: 'en-US', age_band: ageBand, eligibility: ageBand === '13-17' ? { minimum_age: 13, maximum_age: 17 } : { minimum_age: 10, maximum_age: 12 },
    knowledge_component_ids: ['kc-money-models'], adventure_scene_id: 'diorama-a', title: 'Money models',
    required_capabilities: [...REQUIRED_SEGMENT_CAPABILITIES[doc.type]], segments: [doc],
  };
}
const noop = () => {};
function play(segment: (typeof SEGMENTS)[keyof typeof SEGMENTS]) {
  const onGradeAny = vi.fn(async () => ({ verdict: 'met' as const }));
  const onView = vi.fn(async () => true);
  render(<LessonDocumentView raw={lesson(segment)} locale="en-US" ageBand="13-17" onBack={noop} onView={onView} onGradeAny={onGradeAny} onComplete={vi.fn(async () => true)} />);
  return { onGradeAny, onView };
}
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check' }));

describe('GAP-FIX-R4: the concept boards keep the board contract (Bible 05 §3, §5, §6; B.7)', () => {
  it.each(['loan', 'market', 'prices', 'double', 'debts', 'mix'] as const)('%s: its chart has Show as table, draws no word in SVG, and is a shared Pizarrón picture', (key) => {
    // A graded inflation board hides its line until Core has met the prediction; the explored board shows it.
    play(key === 'prices' ? { ...SEGMENTS.prices, grading: 'none' } as unknown as typeof SEGMENTS.prices : SEGMENTS[key]);
    if (key === 'debts') fireEvent.click(screen.getByRole('radio', { name: 'Smallest first' }));
    const toggle = screen.getByRole('button', { name: 'Show as table' });
    const charts = document.querySelectorAll('[data-pizarron]');
    expect(charts.length).toBeGreaterThan(0);
    for (const chart of charts) {
      expect(chart.querySelector('svg text'), key).toBeNull();
      // An interactive picture is a group; a static one an image with its description.
      expect(['img', 'group']).toContain(chart.getAttribute('role'));
      if (chart.getAttribute('role') === 'img') expect(chart.querySelector('[role="slider"], button, input')).toBeNull();
    }
    fireEvent.click(toggle);
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Show as chart' })).toBeTruthy();
  });

  it.each(['loan', 'market', 'tokens', 'prices', 'double', 'debts', 'mix', 'stand'] as const)('%s: Reset restores the first state and is off until something changed', (key) => {
    play(SEGMENTS[key]);
    const reset = () => screen.getByRole('button', { name: 'Reset' });
    expect(reset()).toBeDisabled();
    if (key === 'loan') fireEvent.click(screen.getByRole('button', { name: 'Month: More' }));
    if (key === 'market') fireEvent.click(screen.getByRole('button', { name: 'Move Want to buy: More' }));
    if (key === 'tokens') fireEvent.click(screen.getByRole('button', { name: 'Movie · 2 tokens' }));
    if (key === 'prices') fireEvent.click(screen.getByRole('button', { name: 'Price rise per year: More' }));
    if (key === 'double') fireEvent.click(screen.getByRole('button', { name: 'Growth per year: More' }));
    if (key === 'debts') fireEvent.click(screen.getByRole('radio', { name: 'Smallest first' }));
    if (key === 'mix') fireEvent.click(screen.getByRole('button', { name: 'Bonds share: More' }));
    if (key === 'stand') fireEvent.click(screen.getByRole('button', { name: 'Cups made: More' }));
    expect(reset()).toBeEnabled();
    fireEvent.click(reset());
    expect(reset()).toBeDisabled();
  });
});

describe('concept boards', () => {
  it('parses every board in a teen lesson and refuses the teen-only boards for 10-12', () => {
    for (const segment of Object.values(SEGMENTS)) expect(loadLessonClientDocument(lesson(segment)).status, segment.type).toBe('ready');
    expect(loadLessonClientDocument(lesson(SEGMENTS.double, '10-12')).status).toBe('invalid');
    expect(loadLessonClientDocument(lesson(SEGMENTS.tokens, '10-12')).status).toBe('ready');
  });

  it('amortization: scrub payment by payment, the balance stays hidden, and the typed amount is sent', async () => {
    const { onGradeAny } = play(SEGMENTS.loan);
    const slider = screen.getByRole('slider', { name: 'Month' });
    fireEvent.change(slider, { target: { value: '6' } });
    expect(screen.getByText('Owed after')).toBeTruthy();
    expect(screen.getAllByText('?').length).toBeGreaterThan(0);
    const balance = amortizationSchedule(1200, 1200, 12)[5]!.balance;
    fireEvent.change(screen.getByRole('textbox', { name: 'What is still owed?' }), { target: { value: String(balance) } });
    check();
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ month: 6, balance: String(balance) }, 'loan-01', expect.anything()));
  });

  it('supply and demand: a curve shifts by keyboard and the chosen price move is sent', async () => {
    const { onGradeAny } = play(SEGMENTS.market);
    expect(screen.getByText('Price now: 40')).toBeTruthy();
    // GAP-FIX-R4 (Bible 05 §6): the curve handles sit in the aria-hidden drawing; the stepper is the keyboard path.
    expect(screen.queryByRole('slider', { name: 'Move Want to buy' })).toBeNull();
    const picture = document.querySelector('[data-pizarron="supply-demand"]')!;
    expect(picture.getAttribute('role')).toBe('group');
    expect(picture.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(picture.querySelector('svg text')).toBeNull();
    expect(picture.textContent).toContain('Want to buy');
    fireEvent.click(screen.getByRole('button', { name: 'Move Want to buy: More' }));
    expect(screen.getByText(/Price now: 43/)).toBeTruthy();
    // Show as table, and back.
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table', { name: 'Market chart' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show as chart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Goes up' }));
    check();
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ demand_shift: 1, supply_shift: 0, price: 'up' }, 'market-01', expect.anything()));
  });

  it('opportunity cost: Continue waits until the tokens are spent, then shows what was given up', () => {
    play(SEGMENTS.tokens);
    const next = screen.getByRole('button', { name: 'Continue' });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Movie · 2 tokens' }));
    fireEvent.click(screen.getByRole('button', { name: 'Snack · 1 tokens' }));
    expect(screen.getByRole('heading', { name: 'What you gave up' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
  });

  it('inflation: one-year and two-year controls use the matching unit in teaching copy', () => {
    const raw = { ...lesson(SEGMENTS.prices), segments: [{ ...SEGMENTS.prices,
      payload: { ...SEGMENTS.prices.payload, min_years: 1, max_years: 2, year_step: 1 } }] };
    render(<LessonDocumentView raw={raw} locale="en-US" ageBand="13-17" onBack={noop} onGradeAny={async () => ({ verdict: 'met' })} />);
    expect(screen.getByText('year, it costs')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Years: More' }));
    expect(screen.getByText('years, it costs')).toBeTruthy();
  });

  it('inflation: the sentence drives the rate, the answer stays hidden, and the prediction is sent', async () => {
    const { onGradeAny } = play(SEGMENTS.prices);
    expect(screen.getAllByText('?').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /More/ })[0]!);
    fireEvent.click(screen.getByRole('switch', { name: 'Later' }));
    check();
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ rateBps: 200, years: 5, predictionMinor: 100 }, 'prices-01', expect.anything()));
    await waitFor(() => expect(screen.queryAllByText('?')).toHaveLength(0));
  });

  it('rule of 72: the estimate follows the rate and the doubling flag appears once met', async () => {
    const { onGradeAny } = play(SEGMENTS.double);
    expect(screen.getByText('72 ÷ rate ≈ 36 years')).toBeTruthy();
    fireEvent.change(screen.getByRole('slider', { name: 'Growth per year' }), { target: { value: '600' } });
    expect(screen.getByText('72 ÷ rate ≈ 12 years')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Years to double: More' }));
    check();
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ rateBps: 600, years: 11 }, 'double-01', expect.anything()));
    await waitFor(() => expect(screen.getByText('Doubles in year 12')).toBeTruthy());
  });

  it('debt payoff: both plans side by side, the last plan ghosted, the chosen plan sent', async () => {
    const { onGradeAny } = play(SEGMENTS.debts);
    fireEvent.click(screen.getByRole('radio', { name: 'Smallest first' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Highest rate first' }));
    expect(screen.getByText('Last plan')).toBeTruthy();
    expect(screen.getAllByText('Total interest')).toHaveLength(2);
    check();
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ strategy: 'avalanche' }, 'debts-01', expect.anything()));
  });

  it('diversification: reallocating keeps the whole at 100% and moves the risk point', async () => {
    expect(reallocate({ a: 100, b: 0 }, ['a', 'b'], 'b', 1, 10)).toEqual({ a: 90, b: 10 });
    expect(reallocate({ a: 0, b: 100 }, ['a', 'b'], 'a', -1, 10)).toEqual({ a: 0, b: 100 });
    const { onGradeAny } = play(SEGMENTS.mix);
    expect(screen.getByText('Total 100%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /More.*Bonds share|Bonds share.*More/ }));
    expect(screen.getByText('Total 100%')).toBeTruthy();
    check();
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ weights: { 'asset-stocks': 90, 'asset-bonds': 10 } }, 'mix-01', expect.anything()));
  });

  it('lemonade stand: a day updates the ledger and the waterfall, cues appear, and the settings are sent', async () => {
    const { onGradeAny } = play(SEGMENTS.stand);
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    for (let i = 0; i < 6; i += 1) fireEvent.click(screen.getByRole('button', { name: /More.*Price|Price.*More/ }));
    for (let i = 0; i < 40; i += 1) fireEvent.click(screen.getByRole('button', { name: /More.*Cups made|Cups made.*More/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Open the stand' }));
    expect(screen.getByRole('table', { name: 'Stand ledger' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'From sales to profit' })).toBeTruthy();
    expect(screen.getByText('Some cups were left over.')).toBeTruthy();
    check();
    await waitFor(() => expect(onGradeAny).toHaveBeenCalledWith({ price: 12, cups: 40 }, 'stand-01', expect.anything()));
  });

  it('marginal tax gains a conserving Sankey on the tax board', () => {
    const data = taxSankey([{ taxableMinor: 100_000, taxMinor: 0, rateBasisPoints: 0 }, { taxableMinor: 50_000, taxMinor: 5_000, rateBasisPoints: 1_000 }],
      { income: 'Income', tax: 'Tax', takeHome: 'Take-home' }, (bps) => `${bps / 100}%`)!;
    expect(chartProblem('sankey', data)).toBeNull();
    expect(data.nodes!.map((n) => n.label)).toEqual(['Income', '0%', '10%', 'Tax', 'Take-home']);
  });

  it('keeps the board labels inside the Copy Budget in three locales', () => {
    const roles: Partial<Record<keyof ConceptCopy, CopyRole>> = {
      less: 'action', more: 'action', openStand: 'action', up: 'option', down: 'option', same: 'option', snowball: 'option', avalanche: 'option',
      near: 'option', far: 'option', yourBalance: 'prompt', priceMoves: 'prompt', gaveUp: 'heading', cueLeftover: 'body', cueWaiting: 'body', cueLoss: 'body',
    };
    const failures: string[] = [];
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      for (const [key, value] of Object.entries(conceptCopy[locale])) {
        const texts = Array.isArray(value) ? value : [value];
        for (const text of texts) {
          const role = roles[key as keyof ConceptCopy] ?? 'body';
          const problems = text ? checkCopy(text.replace(/\{\w+\}/g, '12'), role, { locale, ageBand: '10-12', surface: 'app' }) : [];
          if (problems.length) failures.push(`${locale} ${key}: ${problems.join(',')}`);
          expect(text, key).not.toMatch(/\bTutor\b|\bbot\b|assistant|asistente|assistente|(?<!\p{L})(lives?|vidas?)(?!\p{L})|—/iu);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
