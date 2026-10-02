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
  render(<LessonDocumentView raw={horizonteFixtureDocument('balance', fixture, locale)} locale={locale} ageBand="10-12" onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const stage = () => document.querySelector('.lf-balance-stage') as HTMLElement;
/** The tap path: press the move chip, then press the scale. */
const tap = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
  fireEvent.click(stage());
};
const ready = (name = 'Take 1 x from both pans') => screen.findByRole('button', { name });
const ROUTE = ['Take 1 x from both pans', 'Take 1 unit from both pans', 'Take 1 unit from both pans', 'Divide both pans by 2'];

describe('equation balance board (F1.8)', () => {
  it('meets the board contract for each fixture', async () => {
    await assertBoardContract({ pack: 'balance', fixtureId: 'two-sides', copy: BALANCE_COPY, css: ['balance/BalanceBoard.css'] });
    await assertBoardContract({ pack: 'balance', fixtureId: 'x-on-right', copy: BALANCE_COPY, css: ['balance/BalanceBoard.css'], locales: ['en-US'] });
    await assertBoardContract({ pack: 'balance', fixtureId: 'divide-last', copy: BALANCE_COPY, css: ['balance/BalanceBoard.css'], locales: ['en-US'] });
  });

  it('starts level, speaks the equation, and greys out a move that does not fit', async () => {
    const grade = show('two-sides');
    await ready();
    expect(status()).toHaveTextContent('Left pan: 3 x plus 2. Right pan: x plus 8. The scale is level. Moves: 0');
    expect(await screen.findByRole('img', { name: '3 x plus 2 equals x plus 8' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Divide both pans by 2' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'What is x?' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(grade).not.toHaveBeenCalled();
  });

  it('walks the route with the tap path and submits the ordered operations plus x', async () => {
    const grade = show('two-sides');
    await ready();
    for (const move of ROUTE) tap(move);
    expect(status()).toHaveTextContent('Left pan: x. Right pan: 3. The scale is level. Moves: 4');
    const field = screen.getByRole('textbox', { name: 'What is x?' });
    expect(field).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.change(field, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { steps: ['sub-x', 'sub-unit', 'sub-unit', 'div-2'], answer: '3' }, 'balance-two-sides', expect.anything(),
    ));
  });

  it('places a move with the keyboard path: pick a chip, then Move to', async () => {
    const grade = show('two-sides');
    await ready();
    expect(screen.getByRole('button', { name: 'Move to' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Take 1 x from both pans' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take 1 x from both pans: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'On the scale' }));
    expect(status()).toHaveTextContent('Left pan: 2 x plus 2. Right pan: 8. The scale is level. Moves: 1');
    expect(grade).not.toHaveBeenCalled();
  });

  it('tips the scale when only one pan changes, blocks Check, and levels it again with Undo', async () => {
    show('two-sides');
    await ready();
    for (const move of ROUTE) tap(move);
    fireEvent.change(screen.getByRole('textbox', { name: 'What is x?' }), { target: { value: '3' } });
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
    tap('Take 1 unit from the right pan only');
    expect(status()).toHaveTextContent('The left pan is lower.');
    expect(document.querySelector('[data-balance-equation]')).toHaveTextContent('The scale tipped. Undo to level it.');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Take 1 x from both pans' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(status()).toHaveTextContent('The scale is level. Moves: 4');
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
  });

  it('takes the last move back with Undo and resets to the authored start', async () => {
    show('two-sides');
    await ready();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    tap('Take 1 x from both pans');
    tap('Take 1 unit from both pans');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(status()).toHaveTextContent('Moves: 1');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Left pan: 3 x plus 2. Right pan: x plus 8. The scale is level. Moves: 0');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('solves with x on the right pan', async () => {
    const grade = show('x-on-right');
    await ready();
    tap('Take 1 x from both pans');
    tap('Take 1 unit from both pans');
    expect(status()).toHaveTextContent('Left pan: 4. Right pan: x.');
    fireEvent.change(screen.getByRole('textbox', { name: 'What is x?' }), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ steps: ['sub-x', 'sub-unit'], answer: '4' }, 'balance-x-on-right', expect.anything()));
  });

  it('shows the same state as a table', async () => {
    show('two-sides');
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'What is on each pan' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['Panx blocksUnits', 'Left pan32', 'Right pan18']);
    fireEvent.click(screen.getByRole('button', { name: 'Hide table' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('two-sides', undefined, 'es-MX');
    expect(await screen.findByRole('button', { name: 'Quita 1 x de ambos platos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
    expect(await screen.findByRole('img', { name: '3 x más 2 es igual a x más 8' })).toBeTruthy();
  });

  it('speaks the same piece in Portuguese', async () => {
    show('divide-last', undefined, 'pt-BR');
    expect(await screen.findByRole('button', { name: 'Divida os dois pratos por 3' })).toBeTruthy();
    expect(status()).toHaveTextContent('Prato esquerdo: 6 x mais 3. Prato direito: 2 x mais 15. A balança está nivelada.');
  });

  it('keeps every board string in three locales', () => {
    for (const [key, entry] of Object.entries(BALANCE_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
  });
});
