import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixture, horizonteFixtureDocument } from '../previewDocument';
import { PROB_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const CSS = ['prob/prob.css'];

const show = (fixture: string, verdict: 'met' | 'review' = 'review', locale: Locale = 'en-US') => {
  const grade = vi.fn(() => ({ verdict }));
  render(<LessonDocumentView raw={horizonteFixtureDocument('prob', fixture, locale)} locale={locale} ageBand={horizonteFixture('prob', fixture)!.ageBand} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const setSlider = (name: string, value: number) => fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } });
const tapOnto = (chip: string, slot: string) => {
  fireEvent.click(screen.getByRole('button', { name: chip }));
  fireEvent.click(document.querySelector(`[data-drop-target="${slot}"]`)!);
};
const rowTexts = (table: HTMLElement) => within(table).getAllByRole('row').map((row) => row.textContent);

describe('probability boards (F2.9, F2.10)', () => {
  it('meets the board contract for every fixture', async () => {
    for (const fixtureId of ['tree-screening', 'bayes-screening', 'regression-climb']) await assertBoardContract({ pack: 'prob', fixtureId, copy: PROB_COPY, css: CSS });
    for (const fixtureId of ['tree-filter', 'tree-survey', 'bayes-filter', 'bayes-checkup', 'bayes-city', 'regression-gentle', 'regression-fall']) {
      await assertBoardContract({ pack: 'prob', fixtureId, copy: PROB_COPY, css: CSS, locales: ['en-US'] });
    }
  }, 90000);

  describe('probability tree (H14)', () => {
    it('starts with every branch empty and nothing to check', async () => {
      show('tree-screening');
      await screen.findByRole('img', { name: 'Probability tree' });
      expect(status()).toHaveTextContent('Placed: 0 of 6');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move to' })).toBeDisabled();
      expect([...document.querySelectorAll('.lf-prob-tray button')].map((chip) => chip.textContent)).toEqual(
        ['1 person', '9 people', '10 people', '99 people', '100 people', '891 people', '900 people', '990 people']);
    });

    it('writes the three shares as facts above the tree', async () => {
      show('tree-screening');
      await screen.findByRole('img', { name: 'Probability tree' });
      expect([...document.querySelectorAll('.lf-prob-facts li')].map((fact) => fact.textContent)).toEqual(
        ['1 in 100 have it.', 'Of those, 9 in 10 test positive.', 'Of the rest, 1 in 10 test positive.']);
    });

    it('writes every share and branch name as HTML words, never as SVG text', async () => {
      show('tree-screening');
      const tree = (await screen.findByRole('img', { name: 'Probability tree' })) as unknown as Element;
      expect(tree.querySelector('svg')).toBeNull();
      expect([...tree.querySelectorAll('.lf-prob-tag')].map((tag) => tag.textContent)).toEqual(
        ['1 in 100', '9 in 10', 'the rest', 'the rest', '1 in 10', 'the rest']);
      expect([...tree.querySelectorAll('.lf-prob-slot .lf-prob-node-label')].map((label) => label.textContent)).toEqual(
        ['Have it', 'Positive', 'Negative', 'Do not have it', 'Positive', 'Negative']);
      expect(tree.querySelector('.lf-prob-root')).toHaveTextContent('1,000 people');
    });

    it('places a count by tapping its chip and then a branch', async () => {
      show('tree-screening');
      await screen.findByRole('img', { name: 'Probability tree' });
      tapOnto('10 people', 'has');
      expect(status()).toHaveTextContent('Placed: 1 of 6');
      expect(screen.getByRole('button', { name: '10 people on Have it' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
    });

    it('places a count with the Move to menu, and takes it back to the tray', async () => {
      show('tree-screening');
      await screen.findByRole('img', { name: 'Probability tree' });
      fireEvent.click(screen.getByRole('button', { name: '9 people' }));
      fireEvent.click(screen.getByRole('button', { name: '9 people: Move to' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Have it, positive' }));
      expect(status()).toHaveTextContent('Placed: 1 of 6');
      fireEvent.click(screen.getByRole('button', { name: '9 people on Have it, positive' }));
      fireEvent.click(screen.getByRole('button', { name: '9 people: Move to' }));
      expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual(
        ['Have it', 'Do not have it', 'Have it, negative', 'Do not have it, positive', 'Do not have it, negative', 'Back to the tray']);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Back to the tray' }));
      expect(status()).toHaveTextContent('Placed: 0 of 6');
    });

    it('keeps one count per branch and moves a count without leaving a copy behind', async () => {
      show('tree-screening');
      await screen.findByRole('img', { name: 'Probability tree' });
      tapOnto('10 people', 'has');
      tapOnto('9 people', 'has');
      expect(status()).toHaveTextContent('Placed: 1 of 6');
      expect(screen.getByRole('button', { name: '10 people' })).toBeTruthy();
      tapOnto('9 people on Have it', 'has-pos');
      expect(status()).toHaveTextContent('Placed: 1 of 6');
      expect(screen.getByRole('button', { name: '9 people on Have it, positive' })).toBeTruthy();
    });

    it('submits the arrangement of the whole tree', async () => {
      const grade = show('tree-screening');
      await screen.findByRole('img', { name: 'Probability tree' });
      tapOnto('10 people', 'has');
      tapOnto('990 people', 'lacks');
      tapOnto('9 people', 'has-pos');
      tapOnto('1 person', 'has-neg');
      tapOnto('99 people', 'lacks-pos');
      tapOnto('891 people', 'lacks-neg');
      expect(status()).toHaveTextContent('Placed: 6 of 6');
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith(
        { slots: { has: ['n-10'], lacks: ['n-990'], 'has-pos': ['n-9'], 'has-neg': ['n-1'], 'lacks-pos': ['n-99'], 'lacks-neg': ['n-891'] } }, 'tree-screening', expect.anything()));
    });

    it('locks the tree once it is accepted', async () => {
      show('tree-screening', 'met');
      await screen.findByRole('img', { name: 'Probability tree' });
      tapOnto('10 people', 'has');
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(screen.getByRole('button', { name: '9 people' })).toBeDisabled());
    });

    it('lists every branch with its share and count in a table', async () => {
      show('tree-screening');
      await screen.findByRole('img', { name: 'Probability tree' });
      tapOnto('10 people', 'has');
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      expect(rowTexts(screen.getByRole('table', { name: 'Branches and counts' }))).toEqual([
        'BranchShareCount', 'Have it1 in 10010', 'Do not have itthe restnone', 'Have it, positive9 in 10none',
        'Have it, negativethe restnone', 'Do not have it, positive1 in 10none', 'Do not have it, negativethe restnone']);
    });
  });

  describe('natural frequencies (H29)', () => {
    const echo = () => document.querySelector('.lf-number-echo') as HTMLElement;
    const type = (text: string) => fireEvent.change(screen.getByRole('textbox', { name: /Chance they have it|Probabilidad|Chance de ter/ }), { target: { value: text } });

    it('writes the four head counts and says which people are outlined', async () => {
      show('bayes-screening');
      await screen.findByRole('img', { name: 'Natural frequencies' });
      expect([...document.querySelectorAll('.lf-prob-legend li')].map((item) => item.textContent)).toEqual(
        ['Have it, positive: 9 people', 'Have it, negative: 1 person', 'Do not have it, positive: 99 people', 'Do not have it, negative: 891 people']);
      expect(document.querySelector('.lf-prob-total')).toHaveTextContent('1,000 people in all');
      expect(document.querySelector('.lf-prob-outline')).toHaveTextContent('Outlined: people who test positive');
      expect(document.querySelectorAll('.lf-prob-group--asked')).toHaveLength(2);
    });

    it('draws one cell per person, and only for the people of the population', async () => {
      show('bayes-screening');
      await screen.findByRole('img', { name: 'Natural frequencies' });
      const groups = [...document.querySelectorAll('.lf-prob-group')];
      expect(groups).toHaveLength(4);
      expect(groups.every((group) => group.querySelectorAll('.lf-prob-block').length >= 1)).toBe(true);
    });

    it('echoes a percent, a decimal and a fraction before Check', async () => {
      show('bayes-screening');
      await screen.findByRole('img', { name: 'Natural frequencies' });
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      type('25%');
      expect(echo()).toHaveTextContent('Reads as 0.25');
      type('1/12');
      expect(echo()).toHaveTextContent('Reads as 1/12');
      type('0,5');
      expect(echo()).toHaveTextContent('Reads as 0.5');
      expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
    });

    it('says what is wrong with text that is not a chance, and keeps Check off', async () => {
      show('bayes-screening');
      await screen.findByRole('img', { name: 'Natural frequencies' });
      type('twelve');
      expect(screen.getByText('Write a number from 0 to 1, or a percent.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      type('150%');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    });

    it('submits the chance as a locale-free number and resets the field', async () => {
      const grade = show('bayes-screening');
      await screen.findByRole('img', { name: 'Natural frequencies' });
      type('1/12');
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '1/12' }, 'bayes-screening', expect.anything()));
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect(screen.getByRole('textbox', { name: 'Chance they have it' })).toHaveValue('');
    });

    it('asks about the people who test negative in the negative fixture', async () => {
      show('bayes-checkup');
      await screen.findByRole('img', { name: 'Natural frequencies' });
      expect(document.querySelector('.lf-prob-outline')).toHaveTextContent('Outlined: people who test negative');
    });

    it('lists the head counts in a table without a total to divide by', async () => {
      show('bayes-screening');
      await screen.findByRole('img', { name: 'Natural frequencies' });
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      expect(rowTexts(screen.getByRole('table', { name: 'People by result' }))).toEqual(['GroupPositiveNegative', 'Have it91', 'Do not have it99891']);
    });
  });

  describe('regression with squares (H11)', () => {
    it('writes the start line, the sum of its squares and the equation', async () => {
      show('regression-climb');
      await screen.findByRole('img', { name: 'Scatter plot with a line' });
      expect(status()).toHaveTextContent('Slope: 0. Intercept: 5. Sum of the squares: 74');
      expect(screen.getByRole('img', { name: 'y equals 5' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    });

    it('draws a square for each point off the line, and none for a point on it', async () => {
      show('regression-climb');
      await screen.findByRole('img', { name: 'Scatter plot with a line' });
      expect(document.querySelectorAll('.lf-prob-square')).toHaveLength(5);
      expect(document.querySelectorAll('.lf-prob-point')).toHaveLength(6);
      setSlider('Slope', 10);
      setSlider('Intercept', 10);
      expect(document.querySelectorAll('.lf-prob-square')).toHaveLength(4);
    });

    it('sizes each square by its distance to the line and turns it inward at the edge', async () => {
      show('regression-climb');
      await screen.findByRole('img', { name: 'Scatter plot with a line' });
      const squares = [...document.querySelectorAll('.lf-prob-square')];
      expect(squares[0]).toHaveAttribute('width', '192');
      expect(squares[0]).toHaveAttribute('x', '104');
      expect(squares[3]).toHaveAttribute('width', '240');
      expect(squares[3]).toHaveAttribute('x', '200');
      expect(squares[4]).toHaveAttribute('x', '296');
    });

    it('moves the line with the sliders and submits the pair of numbers', async () => {
      const grade = show('regression-climb');
      await screen.findByRole('img', { name: 'Scatter plot with a line' });
      setSlider('Slope', 10);
      setSlider('Intercept', 10);
      expect(status()).toHaveTextContent('Slope: 1. Intercept: 1. Sum of the squares: 4');
      expect(screen.getByRole('img', { name: 'y equals x plus 1' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ family: 'line', params: { m: '1', b: '1' } }, 'regression-climb', expect.anything()));
    });

    it('moves the line a tenth at a time with the step buttons', async () => {
      show('regression-gentle');
      await screen.findByRole('img', { name: 'Scatter plot with a line' });
      expect(status()).toHaveTextContent('Slope: 2. Intercept: 0');
      fireEvent.click(screen.getByRole('button', { name: 'Slope: Less' }));
      expect(status()).toHaveTextContent('Slope: 1.9');
      fireEvent.click(screen.getByRole('button', { name: 'Intercept: More' }));
      expect(status()).toHaveTextContent('Intercept: 0.1');
    });

    it('speaks a negative slope and a negative intercept', async () => {
      show('regression-fall');
      await screen.findByRole('img', { name: 'Scatter plot with a line' });
      setSlider('Slope', -7);
      setSlider('Intercept', 15);
      expect(screen.getByRole('img', { name: 'y equals minus 0.7 x plus 1.5' })).toBeTruthy();
      setSlider('Intercept', -20);
      expect(screen.getByRole('img', { name: 'y equals minus 0.7 x minus 2' })).toBeTruthy();
      setSlider('Slope', 0);
      expect(screen.getByRole('img', { name: 'y equals minus 2' })).toBeTruthy();
    });

    it('resets to the start line and locks the sliders once accepted', async () => {
      show('regression-climb', 'met');
      await screen.findByRole('img', { name: 'Scatter plot with a line' });
      setSlider('Slope', 10);
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect(status()).toHaveTextContent('Slope: 0');
      setSlider('Slope', 10);
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
      await waitFor(() => expect(screen.getByRole('slider', { name: 'Slope' })).toBeDisabled());
    });

    it('lists every point with its residual and square in a table', async () => {
      show('regression-climb');
      await screen.findByRole('img', { name: 'Scatter plot with a line' });
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      expect(rowTexts(screen.getByRole('table', { name: 'Points, line and squares' }))).toEqual([
        'xyOn the lineResidualSquare', '115-416', '235-24', '35500', '67524', '8105525', '10105525', 'Total74']);
    });
  });

  describe('Spanish and Portuguese', () => {
    it('speaks the tree in Spanish with the plural of the unit', async () => {
      show('tree-screening', 'review', 'es-MX');
      expect(await screen.findByRole('img', { name: 'Árbol de probabilidad' })).toBeTruthy();
      expect(status()).toHaveTextContent('Colocadas: 0 de 6');
      expect(screen.getByRole('button', { name: '1 persona' })).toBeTruthy();
      expect(screen.getByRole('button', { name: '9 personas' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
    });

    it('reads the chance with the decimal comma in Portuguese', async () => {
      show('bayes-screening', 'review', 'pt-BR');
      expect(await screen.findByRole('img', { name: 'Frequências naturais' })).toBeTruthy();
      fireEvent.change(screen.getByRole('textbox', { name: 'Chance de ter' }), { target: { value: '25%' } });
      expect(document.querySelector('.lf-number-echo')).toHaveTextContent('Lê-se 0,25');
    });

    it('writes the line the Brazilian way and speaks the equation in words', async () => {
      show('regression-climb', 'review', 'pt-BR');
      expect(await screen.findByRole('img', { name: 'Gráfico de pontos com uma reta' })).toBeTruthy();
      setSlider('Inclinação', -7);
      setSlider('Intercepto', 15);
      expect(status()).toHaveTextContent('Inclinação: -0,7. Intercepto: 1,5');
      expect(screen.getByRole('img', { name: 'y é igual a menos 0,7 x mais 1,5' })).toBeTruthy();
    });

    it('keeps every string in three locales', () => {
      for (const [key, entry] of Object.entries(PROB_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
    });
  });
});
