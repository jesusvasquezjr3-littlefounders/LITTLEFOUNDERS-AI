import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixtureDocument } from '../previewDocument';
import { BALANCE_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const show = (fixture: string, grade = vi.fn(() => ({ verdict: 'review' as const })), locale: Locale = 'en-US') => {
  render(<LessonDocumentView raw={horizonteFixtureDocument('balance', fixture, locale)} locale={locale} ageBand={fixture === 'pythagoras' ? '13-17' : '10-12'}
    onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const stage = () => document.querySelector('.lf-proof-stage') as HTMLElement;
const predict = async (name: string) => { fireEvent.click(await screen.findByRole('button', { name })); };
/** The tap path: press a piece chip, then press the figure. */
const tap = (name: string | RegExp) => {
  fireEvent.click(screen.getByRole('button', { name }));
  fireEvent.click(stage());
};
/** Moves every piece that is still at its start into place, one tap at a time. */
const moveAll = (atStart: RegExp) => {
  for (let guard = 0; guard < 20; guard += 1) {
    const next = screen.queryAllByRole('button', { name: atStart }).find((button) => !(button as HTMLButtonElement).disabled);
    if (!next) return;
    fireEvent.click(next);
    fireEvent.click(stage());
  }
};
const FIXTURES = ['parallelogram', 'triangle', 'trapezoid', 'circle-area', 'circumference', 'pythagoras', 'odd-sum'] as const;

describe('visual proof board (F1.15)', () => {
  it('meets the board contract for all seven visuals', async () => {
    await assertBoardContract({ pack: 'balance', fixtureId: 'parallelogram', copy: BALANCE_COPY, css: ['balance/ProofBoard.css'] });
    for (const fixtureId of FIXTURES.slice(1)) await assertBoardContract({ pack: 'balance', fixtureId, copy: BALANCE_COPY, css: ['balance/ProofBoard.css'], locales: ['en-US'] });
  });

  it('asks for a prediction first: pieces and the answer stay locked until a formula is chosen', async () => {
    show('triangle');
    await screen.findByRole('button', { name: 'Half of base × height' });
    expect(screen.getByRole('button', { name: 'Copy of the shape: at start' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Type the area' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(document.querySelector('.lf-proof-hint')).toHaveTextContent('Predict to unlock.');
    fireEvent.click(screen.getByRole('button', { name: 'Half of base × height' }));
    expect(screen.getByRole('button', { name: 'Copy of the shape: at start' })).toBeEnabled();
    expect(document.querySelector('.lf-proof-hint')).toHaveTextContent('Move every piece, then type the answer.');
    expect(screen.getByRole('textbox', { name: 'Type the area' })).toBeDisabled();
  });

  it('moves the piece by tapping, then types the area and submits the choice plus the value', async () => {
    const grade = show('parallelogram');
    await predict('Base × height');
    expect(status()).toHaveTextContent('Base: 6, Height: 4, Shift: 2. Pieces moved: 0 / 1.');
    tap('Left triangle: at start');
    expect(status()).toHaveTextContent('Pieces moved: 1 / 1. Now a rectangle, 6 by 4.');
    expect(screen.getByRole('button', { name: 'Left triangle: in place' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Type the area' }), { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ choice: 'base-height', value: '24' }, 'proof-parallelogram', expect.anything()));
  });

  it('places and takes back a piece with the keyboard path: pick a chip, then Move to', async () => {
    const grade = show('parallelogram');
    await predict('Base × height');
    expect(screen.getByRole('button', { name: 'Move to' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Left triangle: at start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Left triangle: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Where it fits' }));
    expect(status()).toHaveTextContent('Pieces moved: 1 / 1');
    fireEvent.click(screen.getByRole('button', { name: 'Left triangle: in place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Left triangle: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Back to start' }));
    expect(status()).toHaveTextContent('Pieces moved: 0 / 1');
    expect(grade).not.toHaveBeenCalled();
  });

  it('resets the prediction, the pieces and the number', async () => {
    show('parallelogram');
    await predict('Base × height');
    tap('Left triangle: at start');
    fireEvent.change(screen.getByRole('textbox', { name: 'Type the area' }), { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Pieces moved: 0 / 1');
    expect(screen.getByRole('button', { name: 'Left triangle: at start' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Type the area' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('reads a decimal answer in the learner locale and submits it as canonical text', async () => {
    const grade = show('circle-area', undefined, 'pt-BR');
    await predict('π × raio × raio');
    expect(screen.getByRole('button', { name: '16 fatias' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '16 fatias' }));
    expect(status()).toHaveTextContent('Fatias: 16');
    tap('As fatias: no início');
    expect(status()).toHaveTextContent('Quase um retângulo: meia circunferência de largura e um raio de altura.');
    expect(status()).not.toHaveTextContent('3.14159');
    fireEvent.change(screen.getByRole('textbox', { name: 'Digite a área' }), { target: { value: '78,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conferir' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ choice: 'pi-r-squared', value: '78.5' }, 'proof-circle-area', expect.anything()));
  });

  it('only accepts a whole number for the long side', async () => {
    const grade = show('pythagoras');
    await predict('Leg² + leg² = long side²');
    moveAll(/: at start$/);
    expect(status()).toHaveTextContent('Pieces moved: 3 / 3. Same pieces, now two squares: 6 by 6 and 8 by 8.');
    const field = screen.getByRole('textbox', { name: 'Type the long side' });
    fireEvent.change(field, { target: { value: '10.5' } });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.change(field, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ choice: 'legs-squares-sum', value: '10' }, 'proof-pythagoras', expect.anything()));
  });

  it.each([
    ['triangle', 'Half of base × height', 'Type the area', '20', /Two triangles make a parallelogram, base 8, height 5\./],
    ['trapezoid', 'Half the sum of bases × height', 'Type the area', '42', /Two trapezoids make a parallelogram, base 14, height 6\./],
    ['circumference', 'π × diameter', 'Type the distance around', '21.98', /a bit more than 3 diameters/],
    ['odd-sum', 'Count × count', 'Type the sum', '25', /The pieces fill a square, 5 by 5\./],
  ])('%s: predict, move every piece, type the value', async (fixture, formula, label, value, result) => {
    const grade = show(fixture);
    await predict(formula);
    moveAll(/: at start$/);
    expect(status()).toHaveTextContent(result);
    expect(screen.queryAllByRole('button', { name: /: at start$/ })).toHaveLength(0);
    fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(expect.objectContaining({ value }), `proof-${fixture}`, expect.anything()));
  });

  it('shows the same measures as a table', async () => {
    show('trapezoid');
    await screen.findByRole('button', { name: 'Sum of bases × height' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Measures in this figure' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual([
      'MeasureValue', 'Top side4', 'Bottom side10', 'Height6', 'Shift of top side2',
    ]);
  });

  it('draws a figure that is hidden from assistive tech but described in words', async () => {
    show('odd-sum');
    await screen.findByRole('button', { name: 'Count + count' });
    const figure = document.querySelector('.lf-proof-svg') as SVGElement;
    expect(figure.getAttribute('aria-label')).toBe('Square and odd pieces');
    expect(status()).toHaveTextContent('Odd numbers added: 5');
  });

  it('speaks the same piece in Portuguese', async () => {
    show('triangle', undefined, 'pt-BR');
    expect(await screen.findByRole('button', { name: 'Metade de base × altura' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabela' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cópia da figura: no início' })).toBeTruthy();
  });

  it('keeps every board string in three locales', () => {
    for (const [key, entry] of Object.entries(BALANCE_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
  });
});
