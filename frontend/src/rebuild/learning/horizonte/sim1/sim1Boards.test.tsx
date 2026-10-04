import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixture, horizonteFixtureDocument, horizonteFixtureSeeds } from '../previewDocument';
import { SIM1_COPY } from './copy';
import { bootstrapEdges, coveredCount, resampleSums, sampleHits } from './interval.generated';
import { chanceHits, galtonHits, type Fraction, type Machine } from './model.generated';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const CSS = ['sim1/sim1.css'];

const seedOf = (fixture: string) => horizonteFixture('sim1', fixture)!.seed as string;
type Payload = { machine: Machine; event: number[]; truth: Fraction; data: number[]; level: number };
const payloadOf = (fixture: string) => horizonteFixture('sim1', fixture)!.segment('en-US').payload as Payload;
const percent = (locale: Locale, share: number) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(share * 100)}%`;

const show = (fixture: string, verdict: 'met' | 'review' = 'review', locale: Locale = 'en-US') => {
  const grade = vi.fn(() => ({ verdict }));
  render(<LessonDocumentView raw={horizonteFixtureDocument('sim1', fixture, locale)} locale={locale} ageBand={horizonteFixture('sim1', fixture)!.ageBand}
    onBack={() => {}} attemptSeeds={horizonteFixtureSeeds('sim1', fixture, locale)} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const setSlider = (name: string, value: number) => fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } });
const rowsOf = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('row').map((row) => row.textContent);

describe('sim1 boards (F3.1, F3.2)', () => {
  it('meets the board contract for every fixture', async () => {
    for (const fixtureId of ['chance-coin-heads', 'galton-board', 'galton-walk', 'coverage-three-fifths', 'bootstrap-six-values']) await assertBoardContract({ pack: 'sim1', fixtureId, copy: SIM1_COPY, css: CSS });
    for (const fixtureId of ['chance-die-six', 'chance-spinner-event', 'galton-biased', 'coverage-one-half', 'bootstrap-eight-values']) await assertBoardContract({ pack: 'sim1', fixtureId, copy: SIM1_COPY, css: CSS, locales: ['en-US'] });
  }, 120000);

  describe('seeded fixtures', () => {
    it('are staged with the seed their ladder was simulated under', () => {
      for (const fixture of ['chance-coin-heads', 'galton-walk', 'coverage-one-half', 'bootstrap-six-values']) {
        expect(horizonteFixtureSeeds('sim1', fixture, 'en-US')).toEqual({ [fixture]: seedOf(fixture) });
        expect(seedOf(fixture)).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('draw nothing without a seed, so a seeded board never guesses one', () => {
      const raw = horizonteFixtureDocument('sim1', 'chance-coin-heads', 'en-US');
      render(<LessonDocumentView raw={raw} locale="en-US" ageBand="10-12" onBack={() => {}} onGradeAny={() => ({ verdict: 'review' })} />);
      expect(screen.queryByRole('slider')).toBeNull();
    });
  });

  describe('chance (H20)', () => {
    it('starts with no trials and writes the chance in plain words', async () => {
      show('chance-coin-heads');
      await screen.findByRole('img', { name: 'Share of trials in the event' });
      expect(status()).toHaveTextContent('No trials yet. Chance: 1 in 2 (50%)');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    });

    it('runs the seeded flips as far as the stop and submits the seed with the count', async () => {
      const grade = show('chance-coin-heads');
      await screen.findByRole('img', { name: 'Tally of each outcome' });
      const { machine, event } = payloadOf('chance-coin-heads');
      setSlider('Number of flips', 2);
      const hits = chanceHits(seedOf('chance-coin-heads'), machine, event, 50);
      expect(status()).toHaveTextContent(`Trials: 50. In the event: ${hits}. Share: ${percent('en-US', hits / 50)}. Chance: 1 in 2 (50%)`);
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ seed: seedOf('chance-coin-heads'), trials: 50 }, 'chance-coin-heads', expect.anything()));
    });

    it('keeps a longer run a prefix of a shorter one', async () => {
      show('chance-die-six');
      await screen.findByRole('img', { name: 'Tally of each outcome' });
      const { machine, event } = payloadOf('chance-die-six');
      setSlider('Number of rolls', 1);
      const first = chanceHits(seedOf('chance-die-six'), machine, event, 10);
      expect(status()).toHaveTextContent(`Trials: 10. In the event: ${first}`);
      setSlider('Number of rolls', 3);
      expect(status()).toHaveTextContent('Trials: 500');
      setSlider('Number of rolls', 1);
      expect(status()).toHaveTextContent(`Trials: 10. In the event: ${first}`);
    });

    it('steps the run with Less and More and resets to no run', async () => {
      show('chance-coin-heads');
      await screen.findByRole('img', { name: 'Tally of each outcome' });
      fireEvent.click(screen.getByRole('button', { name: 'Number of flips: More' }));
      expect(status()).toHaveTextContent('Trials: 10');
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect(status()).toHaveTextContent('No trials yet');
    });

    it('lists every outcome, the total and the share at each stop in tables', async () => {
      show('chance-coin-heads');
      await screen.findByRole('img', { name: 'Tally of each outcome' });
      setSlider('Number of flips', 2);
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const rows = rowsOf('Tally of each outcome');
      expect(rows).toHaveLength(4);
      expect(rows[0]).toBe('OutcomeTimesIn the event');
      expect(rows[1]).toMatch(/^Heads\d+Yes$/);
      expect(rows[2]).toMatch(/^Tails\d+No$/);
      expect(rows[3]).toMatch(/^Total50\d+$/);
      expect(rowsOf('Share at each stop')).toHaveLength(3);
    });

    it('names the faces of a die and a spinner by number', async () => {
      show('chance-spinner-event');
      await screen.findByRole('img', { name: 'Tally of each outcome' });
      expect(status()).toHaveTextContent('No trials yet. Chance: 2 in 3 (66.7%)');
      setSlider('Number of spins', 1);
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      expect(rowsOf('Tally of each outcome').map((row) => row!.charAt(0))).toEqual(['O', '1', '2', '3', '4', 'T']);
    });

    it('locks the run once it is accepted', async () => {
      show('chance-coin-heads', 'met');
      await screen.findByRole('img', { name: 'Tally of each outcome' });
      setSlider('Number of flips', 5);
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(screen.getByRole('slider', { name: 'Number of flips' })).toBeDisabled());
    });
  });

  describe('Galton board and walk (H21)', () => {
    it('counts the balls in the target bin from the seeded run', async () => {
      const grade = show('galton-board');
      await screen.findByRole('img', { name: 'Pegs and the last ball' });
      const galton = payloadOf('galton-board');
      expect(status()).toHaveTextContent('No balls yet. Chance of bin 3: 5 in 16 (31.3%)');
      setSlider('Number of balls', 2);
      const hits = galtonHits(seedOf('galton-board'), galton as never, 100);
      expect(status()).toHaveTextContent(`Balls: 100. In bin 3: ${hits}. Share: ${percent('en-US', hits / 100)}. Chance: 5 in 16 (31.3%)`);
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ seed: seedOf('galton-board'), balls: 100 }, 'galton-board', expect.anything()));
    });

    it('draws every peg and one bar per bin', async () => {
      show('galton-board');
      await screen.findByRole('img', { name: 'Pegs and the last ball' });
      setSlider('Number of balls', 1);
      expect(document.querySelectorAll('.lf-sim-peg')).toHaveLength(21);
      expect(document.querySelectorAll('.lf-sim-bar')).toHaveLength(7);
      expect(document.querySelectorAll('.lf-sim-bar--target')).toHaveLength(1);
    });

    it('writes the walk as steps right and keeps the bias in the chance', async () => {
      show('galton-walk');
      await screen.findByRole('img', { name: 'Path of the last walk' });
      expect(status()).toHaveTextContent('No walks yet. Chance of 4 steps right: 35 in 128 (27.3%)');
      setSlider('Number of walks', 1);
      expect(status()).toHaveTextContent('Walks: 20. Ending 4 steps right:');
      expect(screen.getByRole('slider', { name: 'Number of walks' })).toBeTruthy();
    });

    it('uses the biased chance of going right', async () => {
      show('galton-biased');
      await screen.findByRole('img', { name: 'Pegs and the last ball' });
      expect(status()).toHaveTextContent('No balls yet. Chance of bin 3: 1,029 in 2,500 (41.2%)');
    });

    it('lists the balls in each bin and the share at each stop', async () => {
      show('galton-board');
      await screen.findByRole('img', { name: 'Pegs and the last ball' });
      setSlider('Number of balls', 2);
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const rows = rowsOf('Balls in each bin');
      expect(rows).toHaveLength(9);
      expect(rows[0]).toBe('BinBallsTarget');
      expect(rows[4]).toMatch(/^3\d+Yes$/);
      expect(rows[8]).toMatch(/^Total100\d+$/);
      expect(rowsOf('Share at each stop')).toHaveLength(3);
    });
  });

  describe('coverage of intervals (H26)', () => {
    it('starts at the authored choice and counts the intervals that cover', async () => {
      show('coverage-three-fifths');
      await screen.findByRole('img', { name: '100 intervals and the true share' });
      const { truth } = payloadOf('coverage-three-fifths');
      const covering = coveredCount(seedOf('coverage-three-fifths'), truth, { level: 80, size: 20 });
      expect(status()).toHaveTextContent(`Level: 80%. Sample size: 20. Intervals that cover: ${covering} of 100. Goal: 92`);
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    });

    it('draws 100 intervals and marks each as covering or missing', async () => {
      show('coverage-three-fifths');
      await screen.findByRole('img', { name: '100 intervals and the true share' });
      const { truth } = payloadOf('coverage-three-fifths');
      const covering = coveredCount(seedOf('coverage-three-fifths'), truth, { level: 80, size: 20 });
      expect(document.querySelectorAll('.lf-sim-chart .lf-sim-interval--cover, .lf-sim-chart .lf-sim-dot--cover')).toHaveLength(covering);
      expect(document.querySelectorAll('.lf-sim-chart .lf-sim-interval--miss, .lf-sim-chart .lf-sim-dot--miss')).toHaveLength(100 - covering);
      expect(document.querySelectorAll('.lf-sim-truth')).toHaveLength(1);
    });

    it('re-counts when the level or the size moves and submits the choice with the seed', async () => {
      const grade = show('coverage-three-fifths');
      await screen.findByRole('img', { name: '100 intervals and the true share' });
      const { truth } = payloadOf('coverage-three-fifths');
      setSlider('Confidence level', 3);
      setSlider('Sample size', 2);
      const covering = coveredCount(seedOf('coverage-three-fifths'), truth, { level: 99, size: 100 });
      expect(status()).toHaveTextContent(`Level: 99%. Sample size: 100. Intervals that cover: ${covering} of 100`);
      expect(sampleHits(seedOf('coverage-three-fifths'), truth, 100)).toHaveLength(100);
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ seed: seedOf('coverage-three-fifths'), level: 99, size: 100 }, 'coverage-three-fifths', expect.anything()));
    });

    it('goes back to the start choice on Reset', async () => {
      show('coverage-one-half');
      await screen.findByRole('img', { name: '100 intervals and the true share' });
      expect(status()).toHaveTextContent('Level: 90%. Sample size: 30');
      setSlider('Confidence level', 2);
      expect(status()).toHaveTextContent('Level: 99%. Sample size: 30');
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect(status()).toHaveTextContent('Level: 90%. Sample size: 30');
    });

    it('lists the summary and one row for each of the 100 samples', async () => {
      show('coverage-three-fifths');
      await screen.findByRole('img', { name: '100 intervals and the true share' });
      const { truth } = payloadOf('coverage-three-fifths');
      const covering = coveredCount(seedOf('coverage-three-fifths'), truth, { level: 80, size: 20 });
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      expect(rowsOf('Level, size and covers')).toEqual([
        'MeasureValue', 'Level80%', 'Sample size20', 'True share3 in 5 (60%)', `Intervals that cover${covering}`, `Intervals that miss${100 - covering}`, 'Goal92',
      ]);
      expect(rowsOf('Each sample and its interval')).toHaveLength(101);
    });
  });

  describe('bootstrap (H27)', () => {
    it('starts with no resamples and lists the sample', async () => {
      show('bootstrap-six-values');
      await screen.findByRole('img', { name: 'Totals of the resamples' });
      expect(status()).toHaveTextContent('No resamples yet. Middle 90% of the totals');
      expect(document.body).toHaveTextContent('Sample: 2, 3, 3, 5, 6, 8');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    });

    it('reads the two edges off the seeded resamples and submits the run', async () => {
      const grade = show('bootstrap-six-values');
      await screen.findByRole('img', { name: 'Totals of the resamples' });
      const { data, level } = payloadOf('bootstrap-six-values');
      setSlider('Number of resamples', 2);
      const edges = bootstrapEdges(resampleSums(seedOf('bootstrap-six-values'), data, 500).slice(0, 200), level);
      expect(status()).toHaveTextContent(`Resamples: 200. Middle 90% of the totals: ${edges.low} to ${edges.high}`);
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ seed: seedOf('bootstrap-six-values'), resamples: 200 }, 'bootstrap-six-values', expect.anything()));
    });

    it('keeps the edges of the previous stop in view', async () => {
      show('bootstrap-six-values');
      await screen.findByRole('img', { name: 'Totals of the resamples' });
      const { data, level } = payloadOf('bootstrap-six-values');
      setSlider('Number of resamples', 1);
      expect(document.querySelectorAll('.lf-sim-ghost')).toHaveLength(0);
      setSlider('Number of resamples', 3);
      const before = bootstrapEdges(resampleSums(seedOf('bootstrap-six-values'), data, 200), level);
      expect(document.body).toHaveTextContent(`At the previous stop: ${before.low} to ${before.high}`);
      expect(document.querySelectorAll('.lf-sim-ghost')).toHaveLength(2);
      expect(document.querySelectorAll('.lf-sim-edge')).toHaveLength(2);
    });

    it('lists the edges and the resamples at each total in tables', async () => {
      show('bootstrap-eight-values');
      await screen.findByRole('img', { name: 'Totals of the resamples' });
      setSlider('Number of resamples', 2);
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      const edges = rowsOf('Edges of the middle totals');
      expect(edges.slice(0, 2)).toEqual(['MeasureValue', 'Resamples300']);
      expect(edges.some((row) => row!.startsWith('Lower edge'))).toBe(true);
      expect(edges.some((row) => row!.startsWith('Upper edge'))).toBe(true);
      expect(rowsOf('Resamples at each total')[0]).toBe('TotalResamples');
      const cells = [...screen.getByRole('table', { name: 'Resamples at each total' }).querySelectorAll('tbody td')];
      expect(cells.reduce((sum, cell) => sum + Number(cell.textContent!.replace(/,/g, '')), 0)).toBe(300);
    });
  });

  describe('Spanish and Portuguese', () => {
    it('speaks the chance board in Spanish', async () => {
      show('chance-coin-heads', 'review', 'es-MX');
      expect(await screen.findByRole('img', { name: 'Proporción de ensayos en el evento' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
      expect(status()).toHaveTextContent('Aún no hay ensayos. Probabilidad: 1 de cada 2 (50%)');
      expect(screen.getByRole('slider', { name: 'Número de lanzamientos' })).toBeTruthy();
    });

    it('writes percentages the Brazilian way on the Galton board', async () => {
      show('galton-board', 'review', 'pt-BR');
      expect(await screen.findByRole('img', { name: 'Pinos e a última bola' })).toBeTruthy();
      expect(status()).toHaveTextContent('Ainda não há bolas. Chance da caixa 3: 5 em cada 16 (31,3%)');
    });

    it('speaks the coverage and bootstrap boards in Spanish', async () => {
      show('coverage-one-half', 'review', 'es-MX');
      expect(await screen.findByRole('img', { name: '100 intervalos y la proporción real' })).toBeTruthy();
      expect(screen.getByRole('slider', { name: 'Nivel de confianza' })).toBeTruthy();
    });

    it('speaks the bootstrap board in Portuguese', async () => {
      show('bootstrap-six-values', 'review', 'pt-BR');
      expect(await screen.findByRole('img', { name: 'Totais das reamostragens' })).toBeTruthy();
      expect(status()).toHaveTextContent('Ainda não há reamostragens. 90% centrais dos totais');
    });

    it('keeps every string in three locales', () => {
      for (const [key, entry] of Object.entries(SIM1_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
    });
  });
});

describe('sim1 theme tokens', () => {
  it('never paints a board with the constant ink token or a literal colour, so dark mode keeps its contrast', () => {
    const css = readFileSync(resolve(__dirname, 'sim1.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/var\(--ink\)/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(?:white|black)\b/);
  });
});
