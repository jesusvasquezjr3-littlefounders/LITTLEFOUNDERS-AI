import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixtureDocument } from '../previewDocument';
import { FIN1_COPY } from './copy';
import { money, percent, spokenMoney, spokenPercent, tenths, thin, yearsText } from './format';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const CSS = ['fin1/Fin1Boards.css'];
const show = (fixture: string, grade = vi.fn(() => ({ verdict: 'review' as const })), locale: Locale = 'en-US', ageBand: '10-12' | '13-17' = '13-17') => {
  render(<LessonDocumentView raw={horizonteFixtureDocument('fin1', fixture, locale)} locale={locale} ageBand={ageBand} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const press = (name: string, times = 1) => { for (let index = 0; index < times; index += 1) fireEvent.click(screen.getByRole('button', { name })); };
const type = (label: string, text: string) => fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value: text } });

describe('fin1 boards: contract', () => {
  it('meets the board contract for compound interest in all three locales', async () => {
    await assertBoardContract({ pack: 'fin1', fixtureId: 'compound-thirty', copy: FIN1_COPY, css: CSS });
  }, 60_000);

  it('meets the board contract for time value in all three locales', async () => {
    await assertBoardContract({ pack: 'fin1', fixtureId: 'receive-three', copy: FIN1_COPY, css: CSS });
    for (const fixtureId of ['pay-four', 'annuity-end', 'annuity-start']) await assertBoardContract({ pack: 'fin1', fixtureId, copy: FIN1_COPY, css: CSS, locales: ['en-US'] });
  }, 120_000);

  it('meets the board contract for rate and return in all three locales', async () => {
    await assertBoardContract({ pack: 'fin1', fixtureId: 'effective-monthly', copy: FIN1_COPY, css: CSS });
    for (const fixtureId of ['card-months', 'card-interest', 'npv-project', 'irr-project']) await assertBoardContract({ pack: 'fin1', fixtureId, copy: FIN1_COPY, css: CSS, locales: ['en-US'] });
  }, 180_000);

  it('keeps every string in three locales', () => {
    for (const [key, entry] of Object.entries(FIN1_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
  });
});

describe('fin1 boards: format helpers', () => {
  it('writes money, percent and speech from whole cents and basis points', () => {
    expect(money(761_226, 'en-US')).toBe('$7,612.26');
    expect(money(761_226, 'pt-BR')).toBe('$7.612,26');
    expect(money(100_000, 'en-US', true)).toBe('$1,000');
    expect(money(-5_000, 'en-US')).toBe('-$50.00');
    expect(percent(2682, 'en-US')).toBe('26.82%');
    expect(percent(700, 'en-US')).toBe('7%');
    expect(tenths(103, 'en-US')).toBe('10.3');
    expect(spokenMoney(761_226, 'en-US')).toBe('7,612 dollars and 26 cents');
    expect(spokenMoney(100, 'en-US')).toBe('1 dollar');
    expect(spokenMoney(-5, 'es-MX')).toBe('menos 5 centavos');
    expect(spokenPercent(2682, 'en-US')).toBe('26.82 percent');
  });

  it('thins a series and keeps both ends', () => {
    const series = Array.from({ length: 361 }, (_, index) => index);
    const out = thin(series, 60);
    expect(out).toHaveLength(60);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(360);
    expect(thin([1, 2, 3], 60)).toEqual([1, 2, 3]);
  });

  it('chooses the year word by the locale plural rule: pt-BR counts 0 as singular', () => {
    const words = (locale: Locale) => ({ yearOne: FIN1_COPY.yearOne[locale], yearMany: FIN1_COPY.yearMany[locale] });
    expect(yearsText(words('pt-BR'), 0, 'pt-BR')).toBe('0 ano');
    expect(yearsText(words('en-US'), 0, 'en-US')).toBe('0 years');
    expect(yearsText(words('es-MX'), 0, 'es-MX')).toBe('0 años');
    expect(yearsText(words('pt-BR'), 1, 'pt-BR')).toBe('1 ano');
    expect(yearsText(words('pt-BR'), 2, 'pt-BR')).toBe('2 anos');
    expect(yearsText(words('en-US'), 1, 'en-US')).toBe('1 year');
  });
});

describe('fin1 board: compound interest (F1.10)', () => {
  it('asks for a prediction before the sliders move, then reveals the real figure', async () => {
    show('compound-thirty', undefined, 'en-US', '10-12');
    const reveal = await screen.findByRole('button', { name: 'Reveal' });
    expect(reveal).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Yearly rate: More' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '$7,600' }));
    expect(reveal).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Yearly rate: More' })).toBeEnabled();
    fireEvent.click(reveal);
    expect(status()).toHaveTextContent('After 30 years at 7%: compound $7,612.26, simple $3,100.00.');
    expect(screen.getByText('Right. Your pick was the closest.')).toBeTruthy();
    expect(screen.getByText('At 7%, money doubles in about 10.3 years.')).toBeTruthy();
  });

  it('answers the public challenge with the sliders and submits the whole answer', async () => {
    const grade = show('compound-thirty', undefined, 'en-US', '10-12');
    await screen.findByRole('button', { name: 'Reveal' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '$7,600' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.getByText('Not reached yet.')).toBeTruthy();
    press('Yearly rate: Less');
    press('Years: Less', 18);
    expect(status()).toHaveTextContent('After 12 years at 6%: compound $2,012.20, simple $1,720.00.');
    expect(screen.getByText('You reached it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Interest earns interest too' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ predict: 'opt-c', rate: 6, years: 12, explain: 'interest-on-interest' }, 'compound-thirty', expect.anything()));
  });

  it('shows the same growth as a table and resets to the start', async () => {
    show('compound-thirty', undefined, 'en-US', '10-12');
    await screen.findByRole('button', { name: 'Reveal' });
    fireEvent.click(screen.getByRole('button', { name: '$5,000' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Value after each year' });
    const rows = within(table).getAllByRole('row').map((row) => row.textContent);
    expect(rows[0]).toBe('YearCompoundSimple');
    expect(rows.at(-1)).toBe('30$7,612.26$3,100.00');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('After 1 year at 1%: compound $1,010.00, simple $1,010.00.');
    expect(screen.getByRole('button', { name: 'Reveal' })).toBeDisabled();
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('compound-thirty', undefined, 'es-MX', '10-12');
    expect(await screen.findByRole('button', { name: 'Revelar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
  });
});

describe('fin1 board: time value (F2.11)', () => {
  it('orders payments with the keyboard path and submits the arrangement with the typed worth', async () => {
    const grade = show('receive-three');
    await screen.findByRole('group', { name: 'Year 1' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Prize 1: $1,000' }));
    fireEvent.click(screen.getByRole('button', { name: 'Prize 1: $1,000: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Year 3' }));
    expect(within(screen.getByRole('group', { name: 'Year 1' })).getByRole('button', { name: 'Prize 3: $3,000' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Year 3' })).getByRole('button', { name: 'Prize 1: $1,000' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    type('Worth today, in dollars', '5449.80');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { 'year-1': ['pay-3'], 'year-2': ['pay-2'], 'year-3': ['pay-1'] }, value: expect.stringMatching(/^5449\.8/) }, 'receive-three', expect.anything(),
    ));
  });

  it('shows the worth from the other side than the one asked for, and a total', async () => {
    show('receive-three');
    await screen.findByRole('group', { name: 'Year 1' });
    expect(screen.getByText('Worth at year 3')).toBeTruthy();
    expect(status()).toHaveTextContent('Total worth at year 3: $6,243.60');
  });

  it('places equal payments from the tray onto years and takes one back', async () => {
    const grade = show('annuity-end');
    await screen.findByRole('group', { name: 'Tray' });
    const tray = () => within(screen.getByRole('group', { name: 'Tray' }));
    for (const year of ['Year 1', 'Year 2', 'Year 3']) {
      fireEvent.click(tray().getByRole('button', { name: 'Payment: $1,000' }));
      fireEvent.click(screen.getByRole('button', { name: 'Payment: $1,000: Move to' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: year }));
    }
    expect(status()).toHaveTextContent('Placed: 3 of 3');
    expect(tray().queryByRole('button')).toBeNull();
    type('Worth today, in dollars', '2673.01');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { 'year-1': ['payment'], 'year-2': ['payment'], 'year-3': ['payment'] }, value: expect.stringMatching(/^2673\.01/) }, 'annuity-end', expect.anything(),
    ));
  });

  it('keeps the check closed until every payment is placed, and moves one back to the tray', async () => {
    show('annuity-start');
    await screen.findByRole('group', { name: 'Tray' });
    fireEvent.click(within(screen.getByRole('group', { name: 'Tray' })).getByRole('button', { name: 'Payment: $1,000' }));
    fireEvent.click(screen.getByRole('button', { name: 'Payment: $1,000: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Today, year 0' }));
    expect(status()).toHaveTextContent('Placed: 1 of 3');
    type('Worth at year 3, in dollars', '3374.62');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.click(within(screen.getByRole('group', { name: 'Today, year 0' })).getByRole('button', { name: 'Payment: $1,000' }));
    fireEvent.click(screen.getByRole('button', { name: 'Payment: $1,000: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Tray' }));
    expect(status()).toHaveTextContent('Placed: 0 of 3');
  });

  it('shows the placed payments as a table with a total', async () => {
    show('pay-four');
    await screen.findByRole('group', { name: 'Year 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Payments on the timeline' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(6);
    expect(rows[0]!.textContent).toBe('YearPaymentAmountWorth today');
    expect(rows.at(-1)!.textContent).toMatch(/^Total/);
  });
});

describe('fin1 board: rate and return (F2.12)', () => {
  it('scrubs the compounding periods of a year and submits the typed effective rate', async () => {
    const grade = show('effective-monthly');
    await screen.findByRole('button', { name: 'Compounding period: More' });
    expect(status()).toHaveTextContent('Period 0 of 12. Balance: $100.00. Gained so far: $0.00');
    press('Compounding period: More');
    expect(status()).toHaveTextContent('Period 1 of 12. Balance: $102.00. Gained so far: $2.00');
    press('Compounding period: More', 11);
    expect(status()).toHaveTextContent('Period 12 of 12. Balance: $126.82. Gained so far: $26.82');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    type('Rate, in percent', '26.82');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '26.82', final: true }, 'effective-monthly', expect.anything()));
  });

  it('walks a card down month by month and takes the months as a whole number', async () => {
    const grade = show('card-months');
    await screen.findByRole('button', { name: 'Month: More' });
    expect(status()).toHaveTextContent('Month 0. Owed now: $2,000.00 Interest so far: $0.00. Paid so far: $0.00');
    press('Month: More');
    expect(status()).toHaveTextContent('Month 1.');
    type('Months, as a whole number', '131');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '131', final: true }, 'card-months', expect.anything()));
  });

  it('takes the interest of the minimum payments in dollars and shows a table every year', async () => {
    const grade = show('card-interest');
    await screen.findByRole('button', { name: 'Month: More' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Balance every 12 months' });
    expect(within(table).getAllByRole('row')[1]!.textContent).toBe('0$5,000.00$0.00');
    type('Interest, in dollars', '8886.94');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '8886.94', final: true }, 'card-interest', expect.anything()));
  });

  it('shows each payment shrinking as the discount rate moves, and never the net value', async () => {
    const grade = show('npv-project');
    await screen.findByRole('button', { name: 'Discount rate: More' });
    expect(status()).toHaveTextContent('year 1, $4,000.00 is worth $3,636.36; year 2, $5,000.00 is worth $4,132.23; year 3, $6,000.00 is worth $4,507.89');
    press('Discount rate: More');
    expect(status()).toHaveTextContent('year 1, $4,000.00 is worth $3,619.91');
    expect(document.body.textContent).not.toContain('2,276.48');
    type('Net value today, in dollars', '2276.48');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '2276.48', final: true }, 'npv-project', expect.anything()));
  });

  it('dials a trial rate, reads the sign of the net value and submits the break-even rate', async () => {
    const grade = show('irr-project');
    await screen.findByRole('button', { name: 'Trial rate: More' });
    expect(status()).toHaveTextContent('Net value at 0%: $5,000.00. The value is above zero.');
    press('Trial rate: More', 5);
    expect(status()).toHaveTextContent('Net value at 0.5%:');
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Net value at some rates' });
    expect(within(table).getAllByRole('row')).toHaveLength(12);
    type('Break-even rate, in percent', '21.65');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '21.65', final: true }, 'irr-project', expect.anything()));
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('npv-project', undefined, 'es-MX');
    expect(await screen.findByRole('button', { name: 'Tasa de descuento: Más' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
  });
});
