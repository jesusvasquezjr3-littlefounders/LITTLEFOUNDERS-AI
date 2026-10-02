import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixture, horizonteFixtureDocument } from '../previewDocument';
import { STATS1_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const CSS = ['stats1/stats1.css'];

const show = (fixture: string, grade = vi.fn(() => ({ verdict: 'review' as const })), locale: Locale = 'en-US') => {
  render(<LessonDocumentView raw={horizonteFixtureDocument('stats1', fixture, locale)} locale={locale} ageBand={horizonteFixture('stats1', fixture)!.ageBand} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const setSlider = (name: string, value: number) => fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } });
const moveDot = async (from: number, to: number) => {
  fireEvent.click(screen.getByRole('button', { name: `Take a dot from ${from}` }));
  fireEvent.click(screen.getByRole('button', { name: `Take a dot from ${from}: Move to` }));
  fireEvent.click(await screen.findByRole('menuitem', { name: `Value ${to}` }));
};

describe('stats1 boards (F1.13, F1.14)', () => {
  it('meets the board contract for every fixture', async () => {
    for (const fixtureId of ['dot-plot-median', 'balance-level', 'normal-95', 'binomial-fair', 'clt-shrink']) await assertBoardContract({ pack: 'stats1', fixtureId, copy: STATS1_COPY, css: CSS });
    for (const fixtureId of ['dot-plot-mode', 'dot-plot-mean', 'normal-68']) await assertBoardContract({ pack: 'stats1', fixtureId, copy: STATS1_COPY, css: CSS, locales: ['en-US'] });
  }, 60000);

  describe('dot plot (C06, H03, H07)', () => {
    it('starts with the measure of the authored dots and no move used', async () => {
      show('dot-plot-median');
      await screen.findByRole('img', { name: 'Dot plot' });
      expect(status()).toHaveTextContent('Median: 4. Moves used: 0 of 2');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move to' })).toBeDisabled();
    });

    it('moves two dots with the keyboard path and submits the list of dots', async () => {
      const grade = show('dot-plot-median');
      await screen.findByRole('img', { name: 'Dot plot' });
      await moveDot(2, 7);
      expect(status()).toHaveTextContent('Moves used: 1 of 2');
      await moveDot(3, 6);
      expect(status()).toHaveTextContent('Median: 6. Moves used: 2 of 2');
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ dots: [4, 4, 5, 6, 7, 7, 9] }, 'dot-plot-median', expect.anything()));
    });

    it('places a dot by tapping its chip and then a column', async () => {
      show('dot-plot-median');
      await screen.findByRole('img', { name: 'Dot plot' });
      fireEvent.click(screen.getByRole('button', { name: 'Take a dot from 4' }));
      fireEvent.click(document.querySelector('[data-drop-target="col-9"]')!);
      expect(status()).toHaveTextContent('Median: 5. Moves used: 1 of 2');
    });

    it('refuses a third moved dot and offers only the places that give a move back', async () => {
      show('dot-plot-median');
      await screen.findByRole('img', { name: 'Dot plot' });
      await moveDot(2, 7);
      await moveDot(3, 6);
      fireEvent.click(screen.getByRole('button', { name: 'Take a dot from 9' }));
      fireEvent.click(document.querySelector('[data-drop-target="col-1"]')!);
      expect(status()).toHaveTextContent('Median: 6. Moves used: 2 of 2');
      fireEvent.click(screen.getByRole('button', { name: 'Take a dot from 9' }));
      fireEvent.click(screen.getByRole('button', { name: 'Take a dot from 9: Move to' }));
      expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual(['Value 2', 'Value 3']);
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    });

    it('takes a moved dot back and frees the move', async () => {
      show('dot-plot-median');
      await screen.findByRole('img', { name: 'Dot plot' });
      await moveDot(2, 7);
      await moveDot(3, 6);
      await moveDot(7, 2);
      expect(status()).toHaveTextContent('Moves used: 1 of 2');
    });

    it('says there is no mode when two values tie, and resets to the authored plot', async () => {
      show('dot-plot-mode');
      await screen.findByRole('img', { name: 'Dot plot' });
      expect(status()).toHaveTextContent('Mode: 3');
      await moveDot(3, 6);
      expect(status()).toHaveTextContent('Mode: none');
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect(status()).toHaveTextContent('Mode: 3. Moves used: 0 of 2');
    });

    it('shows the mean of the moved dots and the same plot as a table', async () => {
      show('dot-plot-mean');
      await screen.findByRole('img', { name: 'Dot plot' });
      expect(status()).toHaveTextContent('Mean: 4');
      await moveDot(1, 10);
      await moveDot(4, 7);
      expect(status()).toHaveTextContent('Mean: 6');
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const table = screen.getByRole('table', { name: 'Dots at each value' });
      expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['ValueDots', '31', '41', '51', '72', '101']);
    });
  });

  describe('balance point (H06)', () => {
    it('writes both pulls, tips toward the heavier side and submits the pivot', async () => {
      const grade = show('balance-level');
      await screen.findByRole('img', { name: 'Beam with dots' });
      expect(status()).toHaveTextContent('Pull on the left: 4. Pull on the right: 16. Tips right');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Pivot position: More' }));
      expect(status()).toHaveTextContent('Pull on the left: 7. Pull on the right: 13. Tips right');
      setSlider('Pivot position', 8);
      expect(status()).toHaveTextContent('Tips left');
      setSlider('Pivot position', 5);
      expect(status()).toHaveTextContent('Pull on the left: 10. Pull on the right: 10. Level');
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ pivot: 5 }, 'balance-level', expect.anything()));
    });

    it('locks the pivot once the beam is accepted', async () => {
      show('balance-level', vi.fn(() => ({ verdict: 'met' as const })));
      await screen.findByRole('img', { name: 'Beam with dots' });
      setSlider('Pivot position', 5);
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(screen.getByRole('slider', { name: 'Pivot position' })).toBeDisabled());
    });

    it('lists the distance of every dot from the pivot', async () => {
      show('balance-level');
      await screen.findByRole('img', { name: 'Beam with dots' });
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const table = screen.getByRole('table', { name: 'Distance from the pivot' });
      expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['Dot atDistance', '1-2', '2-1', '2-1', '52', '85', '129', 'Net12']);
    });
  });

  describe('normal curve (H22)', () => {
    it('writes the edges and the share inside the band as the sliders move', async () => {
      const grade = show('normal-95');
      await screen.findByRole('img', { name: 'Normal curve' });
      expect(status()).toHaveTextContent('Lower edge: 10. Upper edge: 50');
      setSlider('Mean', 50);
      setSlider('Standard deviation', 5);
      expect(status()).toHaveTextContent('Lower edge: 40. Upper edge: 60. Inside the band: 95.4%');
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ mean: 50, sd: 5 }, 'normal-95', expect.anything()));
    });

    it('uses one standard deviation for the 68% band and resets to the start curve', async () => {
      show('normal-68');
      await screen.findByRole('img', { name: 'Normal curve' });
      setSlider('Mean', 100);
      setSlider('Standard deviation', 10);
      expect(status()).toHaveTextContent('Lower edge: 90. Upper edge: 110. Inside the band: 68.3%');
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect(status()).toHaveTextContent('Lower edge: 75. Upper edge: 85');
    });

    it('draws the same numbers in a table', async () => {
      show('normal-95');
      await screen.findByRole('img', { name: 'Normal curve' });
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const table = screen.getByRole('table', { name: 'Curve and band' });
      expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['MeasureValue', 'Mean30', 'Standard deviation10', 'Lower edge10', 'Upper edge50', 'Inside the band15.7%']);
    });
  });

  describe('binomial bars (H23)', () => {
    it('writes the mean and variance for the count and the chance', async () => {
      const grade = show('binomial-fair');
      await screen.findByRole('img', { name: 'Binomial bars' });
      expect(status()).toHaveTextContent('Mean: 3. Variance: 2.1');
      setSlider('Number of trials', 20);
      setSlider('Chance of success', 50);
      expect(status()).toHaveTextContent('Mean: 10. Variance: 5');
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ n: 20, pct: 50 }, 'binomial-fair', expect.anything()));
    });

    it('keeps the chance on the 5 percent grid', async () => {
      show('binomial-fair');
      await screen.findByRole('img', { name: 'Binomial bars' });
      const chance = screen.getByRole('slider', { name: 'Chance of success' });
      expect(chance).toHaveAttribute('step', '5');
      expect(chance).toHaveAttribute('min', '5');
      expect(chance).toHaveAttribute('max', '95');
      fireEvent.click(screen.getByRole('button', { name: 'Chance of success: More' }));
      expect(status()).toHaveTextContent('Mean: 3.5');
    });

    it('lists the chance of every count in a table', async () => {
      show('binomial-fair');
      await screen.findByRole('img', { name: 'Binomial bars' });
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const rows = within(screen.getByRole('table', { name: 'Chance of each count' })).getAllByRole('row');
      expect(rows).toHaveLength(12);
      expect(rows[1]).toHaveTextContent('02.8%');
    });
  });

  describe('mean of draws (H25)', () => {
    it('shrinks the spread of the mean by the square root of the sample size', async () => {
      const grade = show('clt-shrink');
      await screen.findByRole('img', { name: 'Mean of the draws' });
      expect(status()).toHaveTextContent('Spread of one draw: 2.24. Spread of the mean: 2.24. Times smaller: 1. Goal: 3 times smaller');
      setSlider('Sample size', 9);
      expect(status()).toHaveTextContent('Spread of the mean: 0.75. Times smaller: 3');
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ n: 9 }, 'clt-shrink', expect.anything()));
    });

    it('draws the exact distribution, so two renders agree', async () => {
      show('clt-shrink');
      await screen.findByRole('img', { name: 'Mean of the draws' });
      setSlider('Sample size', 4);
      const bars = () => [...document.querySelectorAll('.lf-stats-panel:nth-of-type(2) .lf-stats-bar')].map((bar) => bar.getAttribute('height'));
      const first = bars();
      expect(first).toHaveLength(21);
      setSlider('Sample size', 5);
      setSlider('Sample size', 4);
      expect(bars()).toEqual(first);
    });

    it('compares one draw with the mean of the draws in a table', async () => {
      show('clt-shrink');
      await screen.findByRole('img', { name: 'Mean of the draws' });
      setSlider('Sample size', 9);
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const table = screen.getByRole('table', { name: 'One draw and the mean' });
      expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['MeasureOne drawMean of the draws', 'Mean3.53.5', 'Spread2.240.75', 'Times smaller13']);
    });
  });

  describe('Spanish and Portuguese', () => {
    it('speaks the dot plot in Spanish', async () => {
      show('dot-plot-median', undefined, 'es-MX');
      expect(await screen.findByRole('img', { name: 'Diagrama de puntos' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
      expect(status()).toHaveTextContent('Mediana: 4. Movimientos usados: 0 de 2');
      expect(screen.getByRole('button', { name: 'Toma un punto del 2' })).toBeTruthy();
    });

    it('writes decimals the Brazilian way', async () => {
      show('binomial-fair', undefined, 'pt-BR');
      expect(await screen.findByRole('img', { name: 'Barras binomiais' })).toBeTruthy();
      expect(status()).toHaveTextContent('Média: 3. Variância: 2,1');
      expect(screen.getByRole('button', { name: 'Mostrar como tabela' })).toBeTruthy();
    });

    it('keeps every string in three locales', () => {
      for (const [key, entry] of Object.entries(STATS1_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
    });
  });
});
