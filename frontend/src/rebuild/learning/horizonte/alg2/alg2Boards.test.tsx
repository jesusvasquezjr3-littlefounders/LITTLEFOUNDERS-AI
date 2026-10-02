import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RebuildRoot } from '../../../design/controls';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixture, horizonteFixtureDocument } from '../previewDocument';
import { ALG2_COPY } from './copy';
import { ALG2_SCORERS } from './scorer.generated';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const CSS = ['alg2/alg2.css'];

const show = (fixture: string, verdict: 'met' | 'review' = 'review', locale: Locale = 'en-US') => {
  const grade = vi.fn(() => ({ verdict }));
  const ageBand = horizonteFixture('alg2', fixture)!.ageBand;
  render(<RebuildRoot theme="light" locale={locale} ageBand={ageBand}><LessonDocumentView raw={horizonteFixtureDocument('alg2', fixture, locale)} locale={locale} ageBand={ageBand} onBack={() => {}} onGradeAny={grade} /></RebuildRoot>);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const slider = (name: string) => screen.getByRole('slider', { name });
const setSlider = (name: string, step: number) => fireEvent.change(slider(name), { target: { value: String(step) } });
const press = (name: string, key: string) => fireEvent.keyDown(slider(name), { key });
const ready = (name: string) => screen.findByRole('slider', { name });
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check' }));
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const line = (name: string, text: string) => fireEvent.change(screen.getByRole('textbox', { name }), { target: { value: text } });
const readyLine = (name: string) => screen.findByRole('textbox', { name });

describe('alg2 boards (F2.4, F2.5, F2.6)', () => {
  it('meets the board contract for one fixture of each board in every locale', async () => {
    for (const fixtureId of ['graph-line-two-dots', 'system-cross-two-lines', 'expression-expand-product']) await assertBoardContract({ pack: 'alg2', fixtureId, copy: ALG2_COPY, css: CSS });
  }, 180000);

  it('meets the board contract for the rest', async () => {
    for (const fixtureId of ['graph-parabola-vertex', 'graph-parabola-standard', 'graph-growth-curve', 'system-half-grid', 'system-triangle', 'expression-factor-trinomial', 'expression-solve-isolate', 'expression-solve-separate']) {
      await assertBoardContract({ pack: 'alg2', fixtureId, copy: ALG2_COPY, css: CSS, locales: ['en-US'] });
    }
  }, 180000);

  describe('function graph (D14)', () => {
    it('writes the curve from the sliders and counts the dots it passes through', async () => {
      show('graph-line-two-dots');
      await ready('Slope (m)');
      expect(status()).toHaveTextContent('y = x. Dots on the curve: 0 of 2');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    });

    it('moves a slider by whole steps with the buttons and the value, never by a float', async () => {
      show('graph-line-two-dots');
      await ready('Slope (m)');
      setSlider('Slope (m)', 7);
      expect(status()).toHaveTextContent('y = 2x');
      click('Slope (m): More');
      expect(status()).toHaveTextContent('y = 3x');
      click('Slope (m): Less');
      click('Slope (m): Less');
      expect(status()).toHaveTextContent('y = x');
      setSlider('Start height (b)', 3);
      expect(status()).toHaveTextContent('y = x - 3');
    });

    it('submits the family and the exact parameters once the curve is through the dots', async () => {
      const grade = show('graph-line-two-dots');
      await ready('Slope (m)');
      setSlider('Slope (m)', 7);
      setSlider('Start height (b)', 3);
      expect(status()).toHaveTextContent('y = 2x - 3. Dots on the curve: 2 of 2');
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ family: 'line', params: { m: '2', b: '-3' } }, 'graph-line-two-dots', expect.anything()));
    });

    it('resets the sliders to the start', async () => {
      show('graph-line-two-dots');
      await ready('Slope (m)');
      setSlider('Slope (m)', 9);
      click('Reset');
      expect(status()).toHaveTextContent('y = x.');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    });

    it('sends a vertex form as the standard parameters Core scores', async () => {
      const grade = show('graph-parabola-vertex');
      await ready('Opening (a)');
      expect(status()).toHaveTextContent('y = x²');
      setSlider('Opening (a)', 1);
      setSlider('Vertex x (h)', 4);
      setSlider('Vertex y (k)', 3);
      expect(status()).toHaveTextContent('y = 2(x - 1)² - 3');
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ family: 'quadratic', params: { a: '2', b: '-4', c: '-1' } }, 'graph-parabola-vertex', expect.anything()));
    });

    it('draws the exponential and gives the plane a table', async () => {
      show('graph-growth-curve');
      await ready('Start value (a)');
      expect(status()).toHaveTextContent('y = 2 · 1.5^x');
      fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
      expect(screen.getByRole('table')).toBeTruthy();
    });

    it('names the sliders in Spanish and Portuguese', async () => {
      show('graph-line-two-dots', 'review', 'es-MX');
      expect(await screen.findByRole('slider', { name: 'Pendiente (m)' })).toBeTruthy();
      expect(screen.getByRole('slider', { name: 'Altura inicial (b)' })).toBeTruthy();
    });
  });

  describe('line system (D19)', () => {
    it('lists each marker with how many lines it is on', async () => {
      show('system-cross-two-lines');
      await ready('Marker 1');
      expect(status()).toHaveTextContent('Marker 1: x 0; y 0. On 0 of 2 lines.');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    });

    it('moves the marker with the arrow keys and the steppers, one grid step at a time', async () => {
      show('system-cross-two-lines');
      await ready('Marker 1');
      press('Marker 1', 'ArrowRight');
      expect(status()).toHaveTextContent('x 1; y 0');
      click('Across (x): More');
      expect(status()).toHaveTextContent('x 2; y 0');
      click('Up (y): More'); click('Up (y): More'); click('Up (y): More');
      expect(status()).toHaveTextContent('x 2; y 3. On 1 of 2 lines.');
      click('Across (x): More');
      expect(status()).toHaveTextContent('x 3; y 3. On 0 of 2 lines.');
      click('Up (y): Less');
      expect(status()).toHaveTextContent('x 3; y 2. On 2 of 2 lines.');
    });

    it('submits the marker positions and unlocks Check only after a move', async () => {
      const grade = show('system-cross-two-lines');
      await ready('Marker 1');
      click('Across (x): More'); click('Across (x): More'); click('Across (x): More');
      click('Up (y): More'); click('Up (y): More');
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ points: [{ x: 3, y: 2 }] }, 'system-cross-two-lines', expect.anything()));
    });

    it('steps a half grid in halves', async () => {
      show('system-half-grid');
      await ready('Marker 1');
      click('Across (x): More');
      expect(status()).toHaveTextContent('x 0.5; y 0');
    });

    it('picks which marker moves, and refuses two markers on one spot', async () => {
      show('system-triangle');
      await ready('Marker 1');
      expect(document.querySelectorAll('[data-hz-text-equivalent] li')).toHaveLength(3);
      fireEvent.click(screen.getByRole('radio', { name: 'Marker 2' }));
      await ready('Marker 2');
      click('Across (x): More');
      expect(screen.getByText('That spot has a marker already.')).toBeTruthy();
      expect(status()).toHaveTextContent('Marker 2: x 0; y 0');
    });

    it('resets the markers to the start', async () => {
      show('system-cross-two-lines');
      await ready('Marker 1');
      click('Across (x): More');
      click('Reset');
      expect(status()).toHaveTextContent('Marker 1: x 0; y 0');
    });
  });

  describe('equation editor (D27)', () => {
    it('shows the start, the goal and the notation with its spoken reading', async () => {
      show('expression-expand-product');
      await readyLine('Line 1');
      expect(screen.getByText('Goal: no brackets, like terms joined.')).toBeTruthy();
      const start = document.querySelector('[data-line-state="start"]') as HTMLElement;
      expect(within(start).getByRole('img').getAttribute('aria-label')).toBe('open bracket x plus 2 close bracket times open bracket x plus 3 close bracket');
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    });

    it('says whether each line has the same value as the line above', async () => {
      show('expression-expand-product');
      await readyLine('Line 1');
      line('Line 1', 'x^2+5x+6');
      expect(screen.getByText('Same value as the line above.')).toBeTruthy();
      line('Line 1', 'x^2+5x+7');
      expect(screen.getByText('Not the same as the line above.')).toBeTruthy();
    });

    it('explains an unreadable line and keeps Check off', async () => {
      show('expression-expand-product');
      await readyLine('Line 1');
      line('Line 1', '(x+2');
      expect(screen.getByText('The brackets do not match.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      line('Line 1', 'x^9');
      expect(screen.getByText('Use a whole power from 0 to 6, like x^2.')).toBeTruthy();
      line('Line 1', 'x=5');
      expect(screen.getByText('Write an expression here, with no equals sign.')).toBeTruthy();
      line('Line 1', 'x+y');
      expect(screen.getByText('Use numbers, the letter x and signs like + and ^.')).toBeTruthy();
      line('Line 1', '0,5x');
      expect(screen.getByText('Write decimals with a point, like 0.5.')).toBeTruthy();
      line('Line 1', '0.5x+1');
      expect(screen.queryByText('Write decimals with a point, like 0.5.')).toBeNull();
    });

    it('asks for an equation on a solve task', async () => {
      show('expression-solve-isolate');
      await readyLine('Line 1');
      expect(screen.getByText('Goal: x alone on one side.')).toBeTruthy();
      line('Line 1', '3x');
      expect(screen.getByText('Write an equation here, with an equals sign.')).toBeTruthy();
      line('Line 1', '3x=15');
      expect(screen.getByText('Same value as the line above.')).toBeTruthy();
      line('Line 1', '3x=14');
      expect(screen.getByText('Not the same as the line above.')).toBeTruthy();
    });

    it('adds lines with the button and with Enter, removes them, and keeps at most eight', async () => {
      show('expression-expand-product');
      await readyLine('Line 1');
      click('Add line');
      expect(screen.getByRole('textbox', { name: 'Line 2' })).toBeTruthy();
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Line 2' }), { key: 'Enter' });
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Line 3' })).toHaveFocus());
      click('Remove line 3');
      expect(screen.queryByRole('textbox', { name: 'Line 3' })).toBeNull();
      for (let more = 0; more < 8; more += 1) if (!screen.getByRole('button', { name: 'Add line' }).hasAttribute('disabled')) click('Add line');
      expect(screen.getAllByRole('textbox')).toHaveLength(8);
      expect(screen.getByRole('button', { name: 'Add line' })).toBeDisabled();
    });

    it('submits the lines as written, without the blank ones', async () => {
      const grade = show('expression-expand-product');
      await readyLine('Line 1');
      line('Line 1', 'x(x+3)+2(x+3)');
      click('Add line');
      click('Add line');
      line('Line 3', ' x^2+5x+6 ');
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ steps: ['x(x+3)+2(x+3)', 'x^2+5x+6'] }, 'expression-expand-product', expect.anything()));
    });

    it('resets to one empty line', async () => {
      show('expression-expand-product');
      await readyLine('Line 1');
      line('Line 1', 'x^2');
      click('Add line');
      click('Reset');
      expect(screen.getAllByRole('textbox')).toHaveLength(1);
      expect((screen.getByRole('textbox', { name: 'Line 1' }) as HTMLInputElement).value).toBe('');
    });

    it('reads in Spanish and Portuguese', async () => {
      show('expression-expand-product', 'review', 'es-MX');
      await readyLine('Línea 1');
      line('Línea 1', 'x^2+5x+6');
      expect(screen.getByText('Mismo valor que la línea de arriba.')).toBeTruthy();
    });

    it('reads in Portuguese', async () => {
      show('expression-solve-separate', 'review', 'pt-BR');
      await readyLine('Linha 1');
      expect(screen.getByText('Meta: os termos com x de um lado, números do outro.')).toBeTruthy();
    });
  });

  describe('what the browser sends is what Core scores', () => {
    it('every answer the boards submit grades to met on the real scorer', () => {
      const cases: Array<[string, unknown]> = [
        ['math.function-graph.v2', { family: 'line', params: { m: '2', b: '-3' } }],
        ['math.line-system.v2', { points: [{ x: 3, y: 2 }] }],
        ['math.expression-editor.v2', { steps: ['x(x+3)+2(x+3)', 'x^2+5x+6'] }],
      ];
      const fixtures: Record<string, string> = { 'math.function-graph.v2': 'graph-line-two-dots', 'math.line-system.v2': 'system-cross-two-lines', 'math.expression-editor.v2': 'expression-expand-product' };
      const rubrics: Record<string, unknown> = {
        'math.function-graph.v2': { family: 'line', target: { m: '2', b: '-3' } },
        'math.line-system.v2': { required: [{ x: 3, y: 2 }] },
        'math.expression-editor.v2': { reference: 'x^2+5x+6' },
      };
      for (const [type, answer] of cases) {
        const segment = horizonteFixture('alg2', fixtures[type]!)!.segment('en-US');
        expect(ALG2_SCORERS[type]!.grade(segment as never, answer, rubrics[type] as never)).toEqual({ verdict: 'met', diagnostic: 'none' });
      }
    });
  });
});
