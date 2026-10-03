import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RebuildRoot } from '../../../design/controls';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixture, horizonteFixtureDocument } from '../previewDocument';
import { PLANE1_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const CSS = ['plane1/plane1.css'];

const show = (fixture: string, verdict: 'met' | 'review' = 'review', locale: Locale = 'en-US') => {
  const grade = vi.fn(() => ({ verdict }));
  const ageBand = horizonteFixture('plane1', fixture)!.ageBand;
  render(<RebuildRoot theme="light" locale={locale} ageBand={ageBand}><LessonDocumentView raw={horizonteFixtureDocument('plane1', fixture, locale)} locale={locale} ageBand={ageBand} onBack={() => {}} onGradeAny={grade} /></RebuildRoot>);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const setSlider = (name: string, value: number) => fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } });
const press = (name: string, key: string, shiftKey = false) => fireEvent.keyDown(screen.getByRole('slider', { name }), { key, shiftKey });
const ready = (name: string) => screen.findByRole('slider', { name });
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check' }));
const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').map((row) => row.textContent);

describe('plane1 boards (F1.9, F1.11, F1.12)', () => {
  it('meets the board contract for one fixture of each board in every locale', async () => {
    for (const fixtureId of ['slope-triangle-run', 'rate-of-change-steps', 'linked-views-line', 'break-even-stand']) await assertBoardContract({ pack: 'plane1', fixtureId, copy: PLANE1_COPY, css: CSS });
  }, 120000);

  it('meets the board contract for the rest', async () => {
    for (const fixtureId of ['cost-structure-average', 'markup-price', 'market-shift-demand', 'elasticity-unit']) await assertBoardContract({ pack: 'plane1', fixtureId, copy: PLANE1_COPY, css: CSS });
    for (const fixtureId of ['slope-triangle-gentle', 'margin-price', 'market-shift-supply', 'elasticity-half']) await assertBoardContract({ pack: 'plane1', fixtureId, copy: PLANE1_COPY, css: CSS, locales: ['en-US'] });
  }, 120000);

  describe('slope triangle (D15)', () => {
    it('writes the run, the rise and the slope as a fraction, and keeps Check off until the rise moves', async () => {
      show('slope-triangle-run');
      await ready('Top of the triangle');
      expect(status()).toHaveTextContent('Run: 3. Rise: 2. Slope: 2/3 = 0.67');
      expect(screen.getByRole('img', { name: '2 over 3' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    });

    it('moves the top corner with the keyboard, locked to its column, and stops at the limits', async () => {
      show('slope-triangle-run');
      await ready('Top of the triangle');
      press('Top of the triangle', 'ArrowUp');
      expect(status()).toHaveTextContent('Rise: 3');
      press('Top of the triangle', 'ArrowRight');
      expect(status()).toHaveTextContent('Rise: 4');
      press('Top of the triangle', 'ArrowLeft');
      expect(status()).toHaveTextContent('Rise: 3');
      press('Top of the triangle', 'End');
      expect(status()).toHaveTextContent('Rise: 7');
      press('Top of the triangle', 'Home');
      expect(status()).toHaveTextContent('Rise: 0');
      expect(screen.getByRole('slider', { name: 'Top of the triangle' })).toHaveAttribute('aria-valuetext', expect.stringContaining('1'));
    });

    it('moves the rise with the slider and submits it', async () => {
      const grade = show('slope-triangle-run');
      await ready('Top of the triangle');
      setSlider('Rise', 6);
      expect(status()).toHaveTextContent('Rise: 6. Slope: 6/3 = 2');
      fireEvent.click(screen.getByRole('button', { name: 'Rise: More' }));
      expect(status()).toHaveTextContent('Rise: 7');
      setSlider('Rise', 6);
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ rise: 6 }, 'slope-triangle-run', expect.anything()));
    });

    it('resets to the start rise', async () => {
      show('slope-triangle-run');
      await ready('Top of the triangle');
      setSlider('Rise', 5);
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect(status()).toHaveTextContent('Rise: 2');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    });

    it('lists the plane as a table with the same handle', async () => {
      show('slope-triangle-run');
      await ready('Top of the triangle');
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const table = screen.getByRole('table', { name: 'Slope triangle' });
      expect(within(table).getByText('Top of the triangle')).toBeTruthy();
    });
  });

  describe('rate of change (D16)', () => {
    it('reads the change per step from the value at the asked step', async () => {
      show('rate-of-change-steps');
      await ready('Graph point at step 6');
      expect(status()).toHaveTextContent('Rate: 3 per step. Value at step 6: 8. Your change per step: 1');
      setSlider('Value at step 6', 20);
      expect(status()).toHaveTextContent('Value at step 6: 20. Your change per step: 3');
    });

    it('lists the steps in a table beside the graph and follows the value', async () => {
      show('rate-of-change-steps');
      await ready('Graph point at step 6');
      const table = screen.getByRole('table', { name: 'Steps and values' });
      expect(rowsOf(table)).toEqual(['StepValue', '02', '15', '68']);
      setSlider('Value at step 6', 20);
      expect(rowsOf(table)).toEqual(['StepValue', '02', '15', '620']);
    });

    it('moves the graph point with the keyboard and submits the value', async () => {
      const grade = show('rate-of-change-steps');
      await ready('Graph point at step 6');
      press('Graph point at step 6', 'ArrowUp');
      expect(status()).toHaveTextContent('Value at step 6: 9');
      press('Graph point at step 6', 'ArrowUp', true);
      press('Graph point at step 6', 'ArrowDown');
      setSlider('Value at step 6', 20);
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ y: 20 }, 'rate-of-change-steps', expect.anything()));
    });
  });

  describe('linked views (D18)', () => {
    it('writes the equation, the slope and the intercept, and speaks the equation', async () => {
      show('linked-views-line');
      await ready('Intercept point');
      expect(status()).toHaveTextContent('Equation: y = x. Slope: 1. Intercept: 0');
      expect(screen.getByRole('img', { name: 'y equals x' })).toBeTruthy();
      setSlider('Slope (m)', 2);
      setSlider('Intercept (b)', 3);
      expect(status()).toHaveTextContent('Equation: y = 2x + 3. Slope: 2. Intercept: 3');
      expect(screen.getByRole('img', { name: 'y equals 2 x plus 3' })).toBeTruthy();
      setSlider('Slope (m)', -2);
      expect(screen.getByRole('img', { name: 'y equals minus 2 x plus 3' })).toBeTruthy();
    });

    it('checks the line against every table row', async () => {
      show('linked-views-line');
      await ready('Intercept point');
      const table = screen.getByRole('table', { name: 'Points on the line' });
      expect(rowsOf(table)).toEqual(['xTable yLine y', '151', '393']);
      setSlider('Slope (m)', 2);
      setSlider('Intercept (b)', 3);
      expect(rowsOf(table)).toEqual(['xTable yLine y', '155', '399']);
    });

    it('moves the intercept and the slope with their handles and switches between them with Page Down', async () => {
      const grade = show('linked-views-line');
      await ready('Intercept point');
      press('Intercept point', 'ArrowUp');
      expect(status()).toHaveTextContent('Slope: 1. Intercept: 1');
      press('Intercept point', 'PageDown');
      await waitFor(() => expect(screen.getByRole('slider', { name: 'Slope point' })).toHaveFocus());
      press('Slope point', 'ArrowUp');
      expect(status()).toHaveTextContent('Slope: 2. Intercept: 1');
      setSlider('Intercept (b)', 3);
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ m: 2, b: 3 }, 'linked-views-line', expect.anything()));
    });

    it('resets both values', async () => {
      show('linked-views-line');
      await ready('Intercept point');
      setSlider('Slope (m)', 4);
      setSlider('Intercept (b)', 7);
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect(status()).toHaveTextContent('Slope: 1. Intercept: 0');
    });
  });

  describe('break-even (N08, N09)', () => {
    it('writes revenue, cost and profit for the units, and the facts of the stand', async () => {
      show('break-even-stand');
      await ready('Units marker');
      expect(status()).toHaveTextContent('Units: 5. Revenue: 25. Cost: 70. Profit: -45');
      expect(screen.getByText('Fixed cost: 60. Price per unit: 5. Cost per unit: 2')).toBeTruthy();
      setSlider('Units sold', 20);
      expect(status()).toHaveTextContent('Units: 20. Revenue: 100. Cost: 100. Profit: 0');
      setSlider('Units sold', 30);
      expect(status()).toHaveTextContent('Revenue: 150. Cost: 120. Profit: 30');
    });

    it('moves the units marker along the row with every arrow, Home and End', async () => {
      show('break-even-stand');
      await ready('Units marker');
      press('Units marker', 'ArrowRight');
      expect(status()).toHaveTextContent('Units: 6');
      press('Units marker', 'ArrowUp');
      expect(status()).toHaveTextContent('Units: 7');
      press('Units marker', 'ArrowDown');
      expect(status()).toHaveTextContent('Units: 6');
      press('Units marker', 'End');
      expect(status()).toHaveTextContent('Units: 40');
      press('Units marker', 'Home');
      expect(status()).toHaveTextContent('Units: 0');
    });

    it('submits the units, then locks the board once it is met', async () => {
      const grade = show('break-even-stand', 'met');
      await ready('Units marker');
      setSlider('Units sold', 20);
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ units: 20 }, 'break-even-stand', expect.anything()));
      await waitFor(() => expect(screen.getByRole('slider', { name: 'Units sold' })).toBeDisabled());
    });

    it('draws revenue and cost in a table', async () => {
      show('break-even-stand');
      await ready('Units marker');
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const table = screen.getByRole('table', { name: 'Revenue and cost' });
      expect(within(table).getByText('Revenue 1')).toBeTruthy();
      expect(within(table).getByText('Cost at these units')).toBeTruthy();
    });
  });

  describe('cost structure (N28)', () => {
    it('writes the total and the average cost, and falls toward the goal as units grow', async () => {
      const grade = show('cost-structure-average');
      await ready('Units marker');
      expect(status()).toHaveTextContent('Units: 10. Total cost: 170. Average cost: 17. Goal: 8');
      setSlider('Units made', 40);
      expect(status()).toHaveTextContent('Units: 40. Total cost: 320. Average cost: 8. Goal: 8');
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ units: 40 }, 'cost-structure-average', expect.anything()));
    });

    it('never goes below one unit', async () => {
      show('cost-structure-average');
      await ready('Units marker');
      press('Units marker', 'Home');
      expect(status()).toHaveTextContent('Units: 1. Total cost: 125. Average cost: 125');
      expect(screen.getByRole('slider', { name: 'Units made' })).toHaveAttribute('min', '1');
    });
  });

  describe('markup and margin (N10)', () => {
    it('writes markup on the cost and margin on the price', async () => {
      const grade = show('markup-price');
      await ready('Price marker');
      expect(status()).toHaveTextContent('Price: 40. Profit: 0. Markup: 0%. Margin: 0%');
      expect(screen.getByText('Cost: 40. Goal: Markup 50%')).toBeTruthy();
      setSlider('Price', 60);
      expect(status()).toHaveTextContent('Price: 60. Profit: 20. Markup: 50%. Margin: 33.3%');
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ price: 60 }, 'markup-price', expect.anything()));
    });

    it('asks for a margin when the basis is the price', async () => {
      show('margin-price');
      await ready('Price marker');
      expect(screen.getByText('Cost: 60. Goal: Margin 25%')).toBeTruthy();
      setSlider('Price', 80);
      expect(status()).toHaveTextContent('Price: 80. Profit: 20. Markup: 33.3%. Margin: 25%');
    });

    it('moves the price marker with the keyboard', async () => {
      show('markup-price');
      await ready('Price marker');
      press('Price marker', 'ArrowRight', true);
      expect(status()).not.toHaveTextContent('Price: 40.');
      press('Price marker', 'Home');
      expect(status()).toHaveTextContent('Price: 0.');
    });
  });

  describe('supply and demand (N09, N13)', () => {
    it('keeps Check off until a direction is chosen, even when the price moved', async () => {
      show('market-shift-demand');
      await ready('Price marker');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      setSlider('Price', 12);
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      fireEvent.click(screen.getByRole('radio', { name: 'Goes up' }));
      expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
    });

    it('writes the shortage, the balance and the surplus as the price moves along the shifted curves', async () => {
      show('market-shift-demand');
      await ready('Price marker');
      expect(status()).toHaveTextContent('Price: 10. Quantity demanded: 32. Quantity supplied: 20. Shortage of 12');
      setSlider('Price', 12);
      expect(status()).toHaveTextContent('Price: 12. Quantity demanded: 24. Quantity supplied: 24. Balanced');
      setSlider('Price', 14);
      expect(status()).toHaveTextContent('Quantity demanded: 16. Quantity supplied: 28. Surplus of 12');
    });

    it('states the shift and the market before it', async () => {
      show('market-shift-demand');
      await ready('Price marker');
      expect(screen.getByText('Demand adds 12 units at every price')).toBeTruthy();
      expect(screen.getByText('Before the shift: price 10, quantity 20')).toBeTruthy();
    });

    it('submits the direction and the price', async () => {
      const grade = show('market-shift-demand');
      await ready('Price marker');
      fireEvent.click(screen.getByRole('radio', { name: 'Goes up' }));
      press('Price marker', 'ArrowUp');
      press('Price marker', 'ArrowUp');
      expect(status()).toHaveTextContent('Price: 12');
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ direction: 'up', price: 12 }, 'market-shift-demand', expect.anything()));
    });

    it('shifts supply and submits a lower price', async () => {
      const grade = show('market-shift-supply');
      await ready('Price marker');
      expect(screen.getByText('Supply adds 25 units at every price')).toBeTruthy();
      expect(status()).toHaveTextContent('Price: 16. Quantity demanded: 42. Quantity supplied: 67. Surplus of 25');
      fireEvent.click(screen.getByRole('radio', { name: 'Goes down' }));
      setSlider('Price', 11);
      expect(status()).toHaveTextContent('Balanced');
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ direction: 'down', price: 11 }, 'market-shift-supply', expect.anything()));
    });

    it('resets the price and the choice', async () => {
      show('market-shift-demand');
      await ready('Price marker');
      fireEvent.click(screen.getByRole('radio', { name: 'Goes up' }));
      setSlider('Price', 12);
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect(status()).toHaveTextContent('Price: 10.');
      expect(screen.getByRole('radio', { name: 'Goes up' })).not.toBeChecked();
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    });

    it('lists the curves and the marker in a table', async () => {
      show('market-shift-demand');
      await ready('Price marker');
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      expect(within(screen.getByRole('table', { name: 'Supply and demand' })).getByText('Price marker')).toBeTruthy();
    });
  });

  describe('elasticity (N13)', () => {
    it('names the kind of elasticity as the price moves along the demand line', async () => {
      const grade = show('elasticity-unit');
      await ready('Price marker');
      expect(status()).toHaveTextContent('Price: 5. Quantity: 50. Elasticity: 0.2. Inelastic');
      expect(screen.getByText('Goal elasticity: 1')).toBeTruthy();
      setSlider('Price', 15);
      expect(status()).toHaveTextContent('Price: 15. Quantity: 30. Elasticity: 1. Unit elastic');
      setSlider('Price', 20);
      expect(status()).toHaveTextContent('Elasticity: 2. Elastic');
      setSlider('Price', 15);
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ price: 15 }, 'elasticity-unit', expect.anything()));
    });

    it('writes a goal below one as a fraction and speaks it', async () => {
      show('elasticity-half');
      await ready('Price marker');
      expect(screen.getByRole('img', { name: '1 over 2' })).toBeTruthy();
      setSlider('Price', 10);
      expect(status()).toHaveTextContent('Price: 10. Quantity: 60. Elasticity: 0.5. Inelastic');
    });

    it('keeps the price on the axis with the keyboard', async () => {
      show('elasticity-unit');
      await ready('Price marker');
      press('Price marker', 'Home');
      expect(status()).toHaveTextContent('Price: 1.');
      press('Price marker', 'End');
      expect(status()).toHaveTextContent('Price: 20.');
    });
  });

  describe('narrow figures and the dark ground', () => {
    const mark = () => document.querySelector('.lf-plano-point') as HTMLElement;

    it('puts a point label on the left once its mark is past the middle of the plane', async () => {
      show('break-even-stand');
      await ready('Units marker');
      expect(mark()).not.toHaveAttribute('data-flip');
      setSlider('Units sold', 30);
      await waitFor(() => expect(mark()).toHaveAttribute('data-flip'));
    });

    it('puts the market label on the side of its mark that points away from the price marker', async () => {
      show('market-shift-supply');
      await ready('Price marker');
      expect(mark()).not.toHaveAttribute('data-flip');
    });

    it('moves the market label to the left when the price marker is on its right', async () => {
      show('market-shift-demand');
      await ready('Price marker');
      expect(mark()).toHaveAttribute('data-flip');
    });

    it('keeps the flip when the plane is shown as a table and back', async () => {
      show('market-shift-demand');
      await ready('Price marker');
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      expect(mark()).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Show graph' }));
      await waitFor(() => expect(mark()).toHaveAttribute('data-flip'));
    });

    it('sets no text of the board in the constant ink, which does not flip on the dark ground', () => {
      const css = readFileSync(resolve(__dirname, 'plane1.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(css).not.toMatch(/var\(--ink\b|#[0-9a-fA-F]{3,8}\b|\brgba?\(|(?<![-\w])(white|black)(?![-\w])/);
    });
  });

  describe('Spanish and Portuguese', () => {
    it('speaks the slope triangle in Spanish', async () => {
      show('slope-triangle-run', 'review', 'es-MX');
      expect(await screen.findByRole('slider', { name: 'Punta del triángulo' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Ver como tabla' })).toBeTruthy();
      expect(status()).toHaveTextContent('Avance: 3. Subida: 2. Pendiente: 2/3 = 0.67');
      expect(screen.getByRole('img', { name: '2 sobre 3' })).toBeTruthy();
    });

    it('speaks the break-even in Portuguese', async () => {
      show('break-even-stand', 'review', 'pt-BR');
      expect(await screen.findByRole('slider', { name: 'Marcador de unidades' })).toBeTruthy();
      expect(status()).toHaveTextContent('Unidades: 5. Receita: 25. Custo: 70. Lucro: -45');
      expect(screen.getByRole('button', { name: 'Ver como tabela' })).toBeTruthy();
    });

    it('speaks the choice of the market in Spanish and Portuguese', async () => {
      show('market-shift-demand', 'review', 'es-MX');
      await screen.findByRole('slider', { name: 'Marcador de precio' });
      expect(screen.getByRole('radio', { name: 'Sube' })).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Baja' })).toBeTruthy();
    });

    it('speaks the equation in Portuguese', async () => {
      show('linked-views-line', 'review', 'pt-BR');
      await screen.findByRole('slider', { name: 'Ponto do intercepto' });
      expect(screen.getByRole('img', { name: 'y é igual a x' })).toBeTruthy();
    });

    it('keeps every string in three locales', () => {
      for (const [key, entry] of Object.entries(PLANE1_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
    });
  });
});
