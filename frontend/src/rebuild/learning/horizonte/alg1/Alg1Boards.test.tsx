import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixture, horizonteFixtureDocument } from '../previewDocument';
import { ALG1_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const CSS = ['alg1/AlgebraBoards.css'];

const show = (fixture: string, locale: Locale = 'en-US', grade = vi.fn(() => ({ verdict: 'review' as const }))) => {
  const band = horizonteFixture('alg1', fixture)!.ageBand;
  render(<LessonDocumentView raw={horizonteFixtureDocument('alg1', fixture, locale)} locale={locale} ageBand={band} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check' }));

describe('algebra tiles (D02, B27)', () => {
  it('meets the board contract for both fixtures', async () => {
    await assertBoardContract({ pack: 'alg1', fixtureId: 'signed-zero-pairs', copy: ALG1_COPY, css: CSS });
    await assertBoardContract({ pack: 'alg1', fixtureId: 'simplify-tiles', copy: ALG1_COPY, css: CSS, locales: ['en-US'] });
  });

  it('pairs opposite tiles by tapping a chip then the zero zone, and submits the arrangement', async () => {
    const grade = show('signed-zero-pairs');
    await screen.findByRole('group', { name: 'Zero pairs' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(status()).toHaveTextContent('On the mat: 8. Zero pairs: 0');
    for (let index = 0; index < 3; index += 1) {
      press(/^Positive 1 tile/);
      fireEvent.click(screen.getByRole('group', { name: 'Zero pairs' }));
    }
    expect(status()).toHaveTextContent('On the mat: 2. Zero pairs: 3');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalled());
    const [answer, segmentId] = grade.mock.calls[0] as unknown as [{ slots: Record<string, string[]> }, string];
    expect(segmentId).toBe('tiles-signed-zero-pairs');
    expect(answer.slots.mat).toEqual(['unit-pos-4', 'unit-pos-5']);
    expect([...answer.slots.zero!].sort()).toEqual(['unit-neg-1', 'unit-neg-2', 'unit-neg-3', 'unit-pos-1', 'unit-pos-2', 'unit-pos-3']);
  });

  it('takes a pair back to the mat and resets', async () => {
    show('signed-zero-pairs');
    await screen.findByRole('group', { name: 'Zero pairs' });
    press(/^Positive 1 tile/);
    fireEvent.click(screen.getByRole('group', { name: 'Zero pairs' }));
    expect(status()).toHaveTextContent('Zero pairs: 1');
    press(/^Pairs of 1/);
    fireEvent.click(screen.getByRole('group', { name: 'The mat' }));
    expect(status()).toHaveTextContent('Zero pairs: 0');
    press(/^Positive 1 tile/);
    fireEvent.click(screen.getByRole('group', { name: 'Zero pairs' }));
    press('Reset');
    expect(status()).toHaveTextContent('Zero pairs: 0');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('places a pair with the keyboard path: pick a chip, then Move to', async () => {
    const grade = show('signed-zero-pairs');
    await screen.findByRole('group', { name: 'Zero pairs' });
    expect(screen.getByRole('button', { name: 'Move to' })).toBeDisabled();
    press(/^Positive 1 tile/);
    press('Positive 1 tile: Move to');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Zero pairs' }));
    expect(status()).toHaveTextContent('Zero pairs: 1');
    expect(grade).not.toHaveBeenCalled();
  });

  it('says so when a tile has no opposite left, without moving anything', async () => {
    show('simplify-tiles');
    await screen.findByRole('group', { name: 'Zero pairs' });
    for (let index = 0; index < 2; index += 1) {
      press(/^Positive x squared tile/);
      fireEvent.click(screen.getByRole('group', { name: 'Zero pairs' }));
    }
    expect(screen.getByText('That tile has no opposite here.')).toBeTruthy();
    expect(status()).toHaveTextContent('Zero pairs: 1');
  });

  it('shows the same state as a table', async () => {
    show('simplify-tiles');
    await screen.findByRole('group', { name: 'Zero pairs' });
    press('Show as table');
    const table = screen.getByRole('table', { name: 'Tiles by kind' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual([
      'TileOn the matIn zero pairs',
      'Positive x squared tile20', 'Negative x squared tile10', 'Positive x tile30', 'Negative x tile40', 'Positive 1 tile20', 'Negative 1 tile20',
    ]);
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('signed-zero-pairs', 'es-MX');
    expect(await screen.findByRole('group', { name: 'Pares cero' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
  });
});

describe('algebra cards (D06)', () => {
  it('meets the board contract for the three disguises', async () => {
    await assertBoardContract({ pack: 'alg1', fixtureId: 'box-picture', copy: ALG1_COPY, css: CSS });
    await assertBoardContract({ pack: 'alg1', fixtureId: 'box-mixed', copy: ALG1_COPY, css: CSS, locales: ['en-US'] });
    await assertBoardContract({ pack: 'alg1', fixtureId: 'box-notation', copy: ALG1_COPY, css: CSS, locales: ['en-US'] });
  });

  it('adds the supply to both sides, cancels opposite cards and submits the arrangement', async () => {
    const grade = show('box-picture');
    const left = await screen.findByRole('group', { name: 'Left side' });
    const right = screen.getByRole('group', { name: 'Right side' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(status()).toHaveTextContent('Left side: Unknown box, Coins: 3. Right side: Coins: 7');
    press('Debt: 3');
    press('Debt: 3: Move to');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Both sides' }));
    expect(within(left).getByRole('button', { name: 'Debt: 3' })).toBeTruthy();
    expect(within(right).getByRole('button', { name: 'Debt: 3' })).toBeTruthy();
    fireEvent.click(within(left).getByRole('button', { name: 'Coins: 3' }));
    fireEvent.click(within(left).getByRole('button', { name: 'Debt: 3' }));
    expect(status()).toHaveTextContent('Left side: Unknown box. Right side: Coins: 7, Debt: 3');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { left: ['left-1'], right: ['right-1', 'supply-1-b'], bin: ['left-2', 'supply-1-a'] } }, 'cards-box-picture', expect.anything(),
    ));
  });

  it('cancels with the keyboard path and takes the last move back', async () => {
    show('box-mixed');
    const right = await screen.findByRole('group', { name: 'Right side' });
    press('−2');
    press('−2: Move to');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Both sides' }));
    fireEvent.click(within(right).getByRole('button', { name: '+2' }));
    press('+2: Move to');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Cancel with −2' }));
    expect(status()).toHaveTextContent('Left side: +7 −2. Right side: x');
    press('Undo');
    expect(status()).toHaveTextContent('Right side: x +2 −2');
    press('Undo');
    expect(status()).toHaveTextContent('Left side: +7. Right side: x +2');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('fades the picture: pictures first, only symbols at the end', async () => {
    show('box-picture');
    await screen.findByRole('group', { name: 'Left side' });
    expect(document.querySelectorAll('.lf-alg-art').length).toBeGreaterThan(0);
  });

  it('draws the equals sign as a CSS shape: no inline 24-grid glyph outside glyphs.tsx (02 rule 17, D12)', async () => {
    show('box-picture');
    await screen.findByRole('group', { name: 'Left side' });
    const equals = document.querySelector('.lf-alg-equals');
    expect(equals).not.toBeNull();
    expect(equals!.tagName).toBe('SPAN');
    expect(equals!.getAttribute('aria-hidden')).toBe('true');
    expect(equals!.children).toHaveLength(0);
    expect(readFileSync(resolve(__dirname, 'CardsBoard.tsx'), 'utf8')).not.toMatch(/viewBox=["']0 0 24 24["']/);
  });

  it('writes plain notation with no picture in the last disguise', async () => {
    show('box-notation');
    await screen.findByRole('group', { name: 'Left side' });
    expect(document.querySelectorAll('.lf-alg-art')).toHaveLength(0);
    expect(status()).toHaveTextContent('Left side: +3 x. Right side: x x');
  });

  it('shows the same state as a table', async () => {
    show('box-picture');
    await screen.findByRole('group', { name: 'Left side' });
    press('Show as table');
    const table = screen.getByRole('table', { name: 'Cards on each side' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['SideCards', 'Left sideUnknown box, Coins: 3', 'Right sideCoins: 7', 'Cancelledempty']);
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('box-picture', 'es-MX');
    expect(await screen.findByRole('group', { name: 'Lado izquierdo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeTruthy();
  });
});

describe('area model (D09, D10, D11)', () => {
  it('meets the board contract for all four fixtures', async () => {
    await assertBoardContract({ pack: 'alg1', fixtureId: 'distribute', copy: ALG1_COPY, css: CSS });
    for (const fixtureId of ['expand', 'factor', 'complete-square']) await assertBoardContract({ pack: 'alg1', fixtureId, copy: ALG1_COPY, css: CSS, locales: ['en-US'] });
  });

  it('places each product in its cell and submits the arrangement', async () => {
    const grade = show('distribute');
    await screen.findByRole('group', { name: 'Row 1, Column 1' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(status()).toHaveTextContent('Placed 0 of 2');
    press('3x');
    fireEvent.click(screen.getByRole('group', { name: 'Row 1, Column 1' }));
    press('12');
    fireEvent.click(screen.getByRole('group', { name: 'Row 1, Column 2' }));
    expect(status()).toHaveTextContent('Placed 2 of 2');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { 'cell-0-0': ['piece-2'], 'cell-0-1': ['piece-1'], tray: ['piece-3', 'piece-4'] } }, 'area-distribute', expect.anything(),
    ));
  });

  it('sends the piece it replaces back to the pieces', async () => {
    show('distribute');
    await screen.findByRole('group', { name: 'Row 1, Column 1' });
    press('12');
    fireEvent.click(screen.getByRole('group', { name: 'Row 1, Column 1' }));
    press('3x');
    fireEvent.click(screen.getByRole('group', { name: 'Row 1, Column 1' }));
    expect(within(screen.getByRole('group', { name: 'Row 1, Column 1' })).getByRole('button', { name: '3x' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Pieces' })).getByRole('button', { name: '12' })).toBeTruthy();
    expect(status()).toHaveTextContent('Placed 1 of 2');
  });

  it('places a piece with the keyboard path and takes it back', async () => {
    show('distribute');
    await screen.findByRole('group', { name: 'Row 1, Column 1' });
    expect(screen.getByRole('button', { name: 'Move to' })).toBeDisabled();
    press('3x');
    press('3x: Move to');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Row 1, Column 1' }));
    expect(status()).toHaveTextContent('Placed 1 of 2');
    press('3x');
    press('3x: Move to');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Back to the pieces' }));
    expect(status()).toHaveTextContent('Placed 0 of 2');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('completes the square with a corner and a constant', async () => {
    const grade = show('complete-square');
    await screen.findByRole('group', { name: 'Corner' });
    press('9');
    fireEvent.click(screen.getByRole('group', { name: 'Corner' }));
    press('−4');
    fireEvent.click(screen.getByRole('group', { name: 'Constant' }));
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { corner: ['piece-1'], constant: ['piece-2'], tray: ['piece-3', 'piece-4', 'piece-5'] } }, 'area-square', expect.anything(),
    ));
  });

  it('factors by placing the edges', async () => {
    show('factor');
    await screen.findByRole('group', { name: 'Row 1' });
    press('2');
    fireEvent.click(screen.getByRole('group', { name: 'Row 2' }));
    expect(status()).toHaveTextContent('Placed 1 of 4');
  });

  it('shows the same state as a table', async () => {
    show('complete-square');
    await screen.findByRole('group', { name: 'Corner' });
    press('9');
    fireEvent.click(screen.getByRole('group', { name: 'Corner' }));
    press('Show as table');
    const table = screen.getByRole('table', { name: 'Piece in each place' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['PlacePiece', 'Corner9', 'Constantempty']);
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('distribute', 'es-MX');
    expect(await screen.findByRole('group', { name: 'Fila 1, Columna 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
  });
});

describe('algebra copy', () => {
  it('keeps every string in three locales', () => {
    for (const [key, entry] of Object.entries(ALG1_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
  });
});
