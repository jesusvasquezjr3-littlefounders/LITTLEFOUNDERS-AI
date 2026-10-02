import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixture, horizonteFixtureDocument, horizonteFixtureSeeds } from '../previewDocument';
import { SIM2_COPY } from './copy';
import { futuresOf, type Payload } from './model.generated';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const CSS = ['sim2/LifeSimBoard.css'];

const PORTFOLIO = 'life-portfolio-risk';
const RETIREMENT = 'life-retirement-spend';
const INSURANCE = 'life-insurance-cover';
const LIFE = 'life-debt-or-save';

const seedOf = (fixture: string) => horizonteFixture('sim2', fixture)!.seed as string;
const payloadOf = (fixture: string) => horizonteFixture('sim2', fixture)!.segment('en-US').payload as Payload;
const winsOf = (fixture: string, choice: number) => futuresOf(seedOf(fixture), payloadOf(fixture), choice).filter((future) => future.ok).length;

const show = (fixture: string, verdict: 'met' | 'review' = 'review', locale: Locale = 'en-US') => {
  const grade = vi.fn(() => ({ verdict }));
  render(<LessonDocumentView raw={horizonteFixtureDocument('sim2', fixture, locale)} locale={locale} ageBand={horizonteFixture('sim2', fixture)!.ageBand}
    onBack={() => {}} attemptSeeds={horizonteFixtureSeeds('sim2', fixture, locale)} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const setSlider = (name: string, value: number) => fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } });
const rowsOf = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('row').map((row) => row.textContent);
const charts = () => [...document.querySelectorAll('.lf-life-chart')] as SVGElement[];
const axisText = (chart: SVGElement) => [...chart.querySelectorAll('.lf-life-ticks text')].map((node) => node.textContent);

describe('sim2 board (F3.3)', () => {
  it('meets the board contract for every fixture', async () => {
    for (const fixtureId of [PORTFOLIO, LIFE]) await assertBoardContract({ pack: 'sim2', fixtureId, copy: SIM2_COPY, css: CSS });
    for (const fixtureId of [RETIREMENT, INSURANCE]) await assertBoardContract({ pack: 'sim2', fixtureId, copy: SIM2_COPY, css: CSS, locales: ['en-US'] });
  }, 120000);

  describe('seeded fixtures', () => {
    it('are staged with the seed their ladder was simulated under', () => {
      for (const fixture of [PORTFOLIO, RETIREMENT, INSURANCE, LIFE]) {
        expect(horizonteFixtureSeeds('sim2', fixture, 'en-US')).toEqual({ [fixture]: seedOf(fixture) });
        expect(seedOf(fixture)).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('draw nothing without a seed, so a seeded board never guesses one', () => {
      const raw = horizonteFixtureDocument('sim2', PORTFOLIO, 'en-US');
      render(<LessonDocumentView raw={raw} locale="en-US" ageBand="13-17" onBack={() => {}} onGradeAny={() => ({ verdict: 'review' })} />);
      expect(screen.queryByRole('slider')).toBeNull();
      expect(document.querySelector('.lf-life-chart')).toBeNull();
    });
  });

  describe('portfolio', () => {
    it('starts at the authored share and counts the futures that succeed', async () => {
      show(PORTFOLIO);
      await screen.findByRole('img', { name: 'Your money in 100 futures. Target 19,000 dollars, floor 11,000 dollars.' });
      expect(status()).toHaveTextContent(`80% in stocks. ${winsOf(PORTFOLIO, 80)} of 100 futures succeed. Needed: 90 of 100.`);
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
      expect(charts()).toHaveLength(1);
    });

    it('draws 100 futures, green where they succeed and dashed where they fail', async () => {
      show(PORTFOLIO);
      await screen.findByRole('img', { name: /^Your money in 100 futures/ });
      const wins = winsOf(PORTFOLIO, 80);
      expect(document.querySelectorAll('.lf-life-chart .lf-life-path--yes')).toHaveLength(wins);
      expect(document.querySelectorAll('.lf-life-chart .lf-life-path--no')).toHaveLength(100 - wins);
      expect(document.querySelectorAll('.lf-life-chart .lf-life-mark--finish')).toHaveLength(1);
      expect(document.querySelectorAll('.lf-life-chart .lf-life-mark--floor')).toHaveLength(1);
    });

    it('re-counts on the same futures when the slider moves, and submits the choice with the seed', async () => {
      const grade = show(PORTFOLIO);
      await screen.findByRole('img', { name: /^Your money in 100 futures/ });
      const before = axisText(charts()[0]!);
      setSlider('Share in stocks', 2);
      expect(status()).toHaveTextContent(`25% in stocks. ${winsOf(PORTFOLIO, 25)} of 100 futures succeed.`);
      expect(winsOf(PORTFOLIO, 25)).toBe(98);
      expect(document.querySelectorAll('.lf-life-chart .lf-life-path--yes')).toHaveLength(98);
      expect(axisText(charts()[0]!)).toEqual(before);
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ seed: seedOf(PORTFOLIO), choice: 25 }, PORTFOLIO, expect.anything()));
    });

    it('steps with Less and More and resets to the authored share', async () => {
      show(PORTFOLIO);
      await screen.findByRole('img', { name: /^Your money in 100 futures/ });
      fireEvent.click(screen.getByRole('button', { name: 'Share in stocks: Less' }));
      expect(status()).toHaveTextContent('60% in stocks.');
      fireEvent.click(screen.getByRole('button', { name: 'Share in stocks: More' }));
      expect(status()).toHaveTextContent('80% in stocks.');
      fireEvent.click(screen.getByRole('button', { name: 'Share in stocks: Less' }));
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect(status()).toHaveTextContent('80% in stocks.');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    });

    it('lists the choice, the eight outcomes and the 100 futures in tables', async () => {
      show(PORTFOLIO);
      await screen.findByRole('img', { name: /^Your money in 100 futures/ });
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const choice = rowsOf('Your choice');
      expect(choice[0]).toBe('MeasureValue');
      expect(choice).toContain('Choice80% in stocks');
      expect(choice).toContain('Time5 chapters, 20 years');
      expect(choice).toContain('Starting cash$10,000');
      expect(choice).toContain('Added each chapter$1,000');
      expect(choice).toContain('Target$19,000');
      expect(choice).toContain('Floor$11,000');
      expect(choice).toContain(`Futures that succeed${winsOf(PORTFOLIO, 80)}`);
      expect(choice).toContain('Futures needed90');
      expect(choice.some((row) => row?.startsWith('Starting debt'))).toBe(false);
      const outcomes = rowsOf('What one chapter can bring');
      expect(outcomes).toHaveLength(9);
      expect(outcomes[0]).toBe('OutcomeReturn');
      expect(outcomes[1]).toBe('1-30%');
      expect(outcomes[8]).toBe('8+72%');
      const futures = rowsOf('All 100 futures');
      expect(futures).toHaveLength(101);
      expect(futures[0]).toBe('FutureFinal worthLowest balanceSucceeds');
      expect(futures.filter((row) => row?.endsWith('Yes'))).toHaveLength(winsOf(PORTFOLIO, 80));
      fireEvent.click(screen.getByRole('button', { name: 'Hide table' }));
      expect(screen.queryByRole('table')).toBeNull();
    });

    it('locks the choice once it is accepted', async () => {
      show(PORTFOLIO, 'met');
      await screen.findByRole('img', { name: /^Your money in 100 futures/ });
      setSlider('Share in stocks', 2);
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(screen.getByRole('slider', { name: 'Share in stocks' })).toBeDisabled());
    });
  });

  describe('retirement', () => {
    it('names the spending in money and has no target line when the finish is zero', async () => {
      show(RETIREMENT);
      await screen.findByRole('img', { name: 'Your money in 100 futures. Floor 16,000 dollars.' });
      expect(status()).toHaveTextContent(`$30,000 each chapter. ${winsOf(RETIREMENT, 30000)} of 100 futures succeed. Needed: 80 of 100.`);
      expect(document.querySelectorAll('.lf-life-mark--finish')).toHaveLength(0);
      expect(screen.getByRole('slider', { name: 'Spending each chapter' })).toHaveAttribute('aria-valuetext', '$30,000 each chapter');
      setSlider('Spending each chapter', 1);
      expect(status()).toHaveTextContent('$15,000 each chapter.');
      expect(winsOf(RETIREMENT, 15000)).toBeGreaterThanOrEqual(80);
    });

    it('lists the return of each outcome', async () => {
      show(RETIREMENT);
      await screen.findByRole('img', { name: /^Your money in 100 futures/ });
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      expect(rowsOf('What one chapter can bring')[1]).toBe('1-18%');
    });
  });

  describe('insurance', () => {
    it('writes the cover as a share and lists what an outcome costs before the cover', async () => {
      show(INSURANCE);
      await screen.findByRole('img', { name: /^Your money in 100 futures/ });
      expect(status()).toHaveTextContent(`0% covered. ${winsOf(INSURANCE, 0)} of 100 futures succeed. Needed: 90 of 100.`);
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const outcomes = rowsOf('What one chapter can bring');
      expect(outcomes[0]).toBe('OutcomeCost before cover');
      expect(outcomes[1]).toBe('1$0');
      expect(outcomes[8]).toBe('8$9,000');
    });
  });

  describe('debt or savings', () => {
    it('draws the money minus debt and the cash against the floor as two charts', async () => {
      show(LIFE);
      await screen.findByRole('img', { name: 'Your money minus debt in 100 futures. Target 5,700 dollars.' });
      expect(screen.getByRole('img', { name: 'Your cash in 100 futures. Floor 1,400 dollars.' })).toBeTruthy();
      expect(charts()).toHaveLength(2);
      expect(charts()[0]!.querySelectorAll('.lf-life-mark--finish')).toHaveLength(1);
      expect(charts()[0]!.querySelectorAll('.lf-life-mark--floor')).toHaveLength(0);
      expect(charts()[1]!.querySelectorAll('.lf-life-mark--floor')).toHaveLength(1);
      expect(charts()[1]!.querySelectorAll('.lf-life-mark--finish')).toHaveLength(0);
      expect(status()).toHaveTextContent(`100% of pay to debt. ${winsOf(LIFE, 100)} of 100 futures succeed. Needed: 60 of 100.`);
    });

    it('accepts any of the reliable splits it offers and counts them as the model does', async () => {
      const grade = show(LIFE);
      await screen.findByRole('img', { name: /^Your money minus debt/ });
      setSlider('Pay sent to debt', 3);
      expect(status()).toHaveTextContent(`40% of pay to debt. ${winsOf(LIFE, 40)} of 100 futures succeed.`);
      expect(winsOf(LIFE, 40)).toBeGreaterThanOrEqual(60);
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ seed: seedOf(LIFE), choice: 40 }, LIFE, expect.anything()));
    });

    it('lists the debt in the choice table', async () => {
      show(LIFE);
      await screen.findByRole('img', { name: /^Your money minus debt/ });
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const choice = rowsOf('Your choice');
      expect(choice).toContain('Starting debt$5,000');
      expect(choice).toContain('Time5 chapters, 10 years');
      expect(rowsOf('What one chapter can bring')[0]).toBe('OutcomeCost');
    });
  });

  describe('locales', () => {
    it('writes the status and the slider in Spanish and Portuguese', async () => {
      show(PORTFOLIO, 'review', 'es-MX');
      await screen.findByRole('img', { name: /^Tu dinero en 100 futuros/ });
      expect(status()).toHaveTextContent(`80% en acciones. ${winsOf(PORTFOLIO, 80)} de 100 futuros lo logran. Se necesitan 90 de 100.`);
      expect(screen.getByRole('slider', { name: 'Proporción en acciones' })).toBeTruthy();
    });

    it('writes the status of a life in Portuguese', async () => {
      show(LIFE, 'review', 'pt-BR');
      await screen.findByRole('img', { name: /^Seu dinheiro menos a dívida/ });
      expect(status()).toHaveTextContent(`100% do pagamento para a dívida. ${winsOf(LIFE, 100)} de 100 futuros conseguem. Necessários: 60 de 100.`);
    });
  });
});
