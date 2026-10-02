import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixtureDocument } from '../previewDocument';
import { NUM_A_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const show = (fixture: string, grade = vi.fn((): { verdict: 'met' | 'review' } => ({ verdict: 'review' })), locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') => {
  render(<LessonDocumentView raw={horizonteFixtureDocument('num-a', fixture, locale)} locale={locale} ageBand="6-9" onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const bead = (row: number, index: number, state: 'counted' | 'not counted') => screen.getByRole('button', { name: `Row ${row}, bead ${index}: ${state}` });
const oneBead = (place: string, index: number, state: 'counted' | 'not counted') => screen.getByRole('button', { name: `${place}, one bead ${index}: ${state}` });

describe('num-a board: rekenrek (A05)', () => {
  it('meets the board contract for both fixtures', async () => {
    await assertBoardContract({ pack: 'num-a', fixtureId: 'rekenrek-seven', copy: NUM_A_COPY, css: ['num-a/Rekenrek.css'] });
    await assertBoardContract({ pack: 'num-a', fixtureId: 'rekenrek-ten', copy: NUM_A_COPY, css: ['num-a/Rekenrek.css'], locales: ['en-US'] });
  });

  it('slides beads by tapping them and submits the count slid in each row', async () => {
    const grade = show('rekenrek-seven');
    await screen.findByRole('group', { name: 'Rekenrek' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.click(bead(1, 5, 'not counted'));
    fireEvent.click(bead(2, 2, 'not counted'));
    expect(status()).toHaveTextContent('Row 1: 5 (5 + 0). Row 2: 2. Total: 7');
    expect(bead(1, 5, 'counted')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ beads: [5, 2] }, 'rekenrek-seven', expect.anything()));
  });

  it('taps a counted bead to slide it and the beads after it back', async () => {
    show('rekenrek-seven');
    await screen.findByRole('group', { name: 'Rekenrek' });
    fireEvent.click(bead(1, 8, 'not counted'));
    expect(status()).toHaveTextContent('Row 1: 8 (5 + 3)');
    fireEvent.click(bead(1, 3, 'counted'));
    expect(status()).toHaveTextContent('Row 1: 2');
  });

  it('works from the keyboard: Enter or Space presses a bead', async () => {
    show('rekenrek-seven');
    await screen.findByRole('group', { name: 'Rekenrek' });
    fireEvent.keyDown(bead(1, 2, 'not counted'), { key: 'Enter' });
    expect(status()).toHaveTextContent('Row 1: 2');
    fireEvent.keyDown(bead(2, 1, 'not counted'), { key: ' ' });
    expect(status()).toHaveTextContent('Row 2: 1');
  });

  it('places a block of five with the keyboard path: pick a chip, then Move to', async () => {
    const grade = show('rekenrek-seven');
    await screen.findByRole('group', { name: 'Rekenrek' });
    const moveTo = screen.getByRole('button', { name: 'Move to' });
    expect(moveTo).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Slide a block of five' }));
    fireEvent.click(screen.getByRole('button', { name: 'Slide a block of five: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Row 1' }));
    expect(status()).toHaveTextContent('Row 1: 5 (5 + 0). Row 2: 0. Total: 5');
    expect(grade).not.toHaveBeenCalled();
  });

  it('places beads by tapping a chip and then a row, and slides back with the back chips', async () => {
    show('rekenrek-ten');
    await screen.findByRole('group', { name: 'Rekenrek' });
    expect(status()).toHaveTextContent('Row 1: 6 (5 + 1)');
    fireEvent.click(screen.getByRole('button', { name: 'Slide one bead' }));
    fireEvent.click(document.querySelector('[data-drop-target="row-1"]')!);
    expect(status()).toHaveTextContent('Row 2: 1. Total: 7');
    fireEvent.click(screen.getByRole('button', { name: 'Slide one back' }));
    fireEvent.click(document.querySelector('[data-drop-target="row-0"]')!);
    expect(status()).toHaveTextContent('Row 1: 5 (5 + 0). Row 2: 1');
  });

  it('keeps the count inside the ten beads of a row', async () => {
    show('rekenrek-ten');
    await screen.findByRole('group', { name: 'Rekenrek' });
    fireEvent.click(bead(1, 10, 'not counted'));
    expect(status()).toHaveTextContent('Row 1: 10 (10 + 0)');
    fireEvent.click(screen.getByRole('button', { name: 'Slide one bead' }));
    fireEvent.click(document.querySelector('[data-drop-target="row-0"]')!);
    expect(status()).toHaveTextContent('Row 1: 10');
    expect(status()).not.toHaveTextContent('Row 1: 11');
  });

  it('resets to the authored start and locks the beads once the answer is met', async () => {
    const grade = show('rekenrek-ten', vi.fn((): { verdict: 'met' | 'review' } => ({ verdict: 'met' })));
    await screen.findByRole('group', { name: 'Rekenrek' });
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    fireEvent.click(bead(1, 7, 'not counted'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Row 1: 6 (5 + 1)');
    fireEvent.click(bead(1, 10, 'not counted'));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ beads: [10, 0] }, 'rekenrek-ten', expect.anything()));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Row 1, bead 1: counted' })).toHaveAttribute('aria-disabled', 'true'));
  });

  it('shows the same state as a table', async () => {
    show('rekenrek-ten');
    await screen.findByRole('group', { name: 'Rekenrek' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Beads in each row' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['RowBeadsFivesOnes', '1611', '2000', 'Total611']);
    fireEvent.click(screen.getByRole('button', { name: 'Hide table' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('rekenrek-seven', undefined, 'es-MX');
    expect(await screen.findByRole('group', { name: 'Marco de cuentas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fila 1, cuenta 3: sin contar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
    expect(status()).toHaveTextContent('Fila 1: 0. Fila 2: 0. Total: 0');
  });

  it('speaks it in Portuguese too', async () => {
    show('rekenrek-seven', undefined, 'pt-BR');
    expect(await screen.findByRole('button', { name: 'Fileira 2, conta 4: não contada' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabela' })).toBeTruthy();
  });
});

describe('num-a board: abacus (A06)', () => {
  it('meets the board contract for both fixtures', async () => {
    await assertBoardContract({ pack: 'num-a', fixtureId: 'abacus-forty-seven', copy: NUM_A_COPY, css: ['num-a/Rekenrek.css'] });
    await assertBoardContract({ pack: 'num-a', fixtureId: 'abacus-add-twenty', copy: NUM_A_COPY, css: ['num-a/Rekenrek.css'], locales: ['en-US'] });
  });

  it('shows the number by tapping beads and submits one digit per rod', async () => {
    const grade = show('abacus-forty-seven');
    await screen.findByRole('group', { name: 'Abacus' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.click(oneBead('Tens', 4, 'not counted'));
    fireEvent.click(screen.getByRole('button', { name: 'Ones, five bead: not counted' }));
    fireEvent.click(oneBead('Ones', 2, 'not counted'));
    expect(status()).toHaveTextContent('Tens: 4. Ones: 7. Number: 47');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ digits: [4, 7] }, 'abacus-forty-seven', expect.anything()));
  });

  it('taps a counted five bead to take the five away', async () => {
    show('abacus-forty-seven');
    await screen.findByRole('group', { name: 'Abacus' });
    fireEvent.click(screen.getByRole('button', { name: 'Tens, five bead: not counted' }));
    expect(status()).toHaveTextContent('Tens: 5. Ones: 0. Number: 50');
    fireEvent.click(screen.getByRole('button', { name: 'Tens, five bead: counted' }));
    expect(status()).toHaveTextContent('Tens: 0. Ones: 0. Number: 0');
  });

  it('adds twenty from the keyboard path: pick a chip, then Move to a rod', async () => {
    const grade = show('abacus-add-twenty');
    await screen.findByRole('group', { name: 'Abacus' });
    expect(status()).toHaveTextContent('Tens: 3. Ones: 5. Number: 35');
    for (let count = 0; count < 2; count += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Add one' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add one: Move to' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Tens' }));
    }
    expect(status()).toHaveTextContent('Tens: 5. Ones: 5. Number: 55');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ digits: [5, 5] }, 'abacus-add-twenty', expect.anything()));
  });

  it('takes beads off with the take chips and keeps every rod between 0 and 9', async () => {
    show('abacus-add-twenty');
    await screen.findByRole('group', { name: 'Abacus' });
    fireEvent.click(screen.getByRole('button', { name: 'Take five' }));
    fireEvent.click(document.querySelector('[data-drop-target="rod-1"]')!);
    expect(status()).toHaveTextContent('Tens: 3. Ones: 0. Number: 30');
    expect(screen.getByRole('button', { name: 'Take five' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Add five' }));
    fireEvent.click(document.querySelector('[data-drop-target="rod-0"]')!);
    expect(status()).toHaveTextContent('Tens: 8. Ones: 0. Number: 80');
    fireEvent.click(screen.getByRole('button', { name: 'Add five' }));
    fireEvent.click(document.querySelector('[data-drop-target="rod-0"]')!);
    expect(status()).toHaveTextContent('Tens: 8');
  });

  it('shows the same state as a table and resets to the start', async () => {
    show('abacus-add-twenty');
    await screen.findByRole('group', { name: 'Abacus' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Beads on each rod' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['PlaceFive beadOne beadsDigit', 'Tens033', 'Ones105', 'Number35']);
    fireEvent.click(oneBead('Tens', 4, 'not counted'));
    expect(status()).toHaveTextContent('Number: 45');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Number: 35');
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('abacus-forty-seven', undefined, 'es-MX');
    expect(await screen.findByRole('group', { name: 'Ábaco' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decenas, cuenta de cinco: sin contar' })).toBeTruthy();
    expect(status()).toHaveTextContent('Decenas: 0. Unidades: 0. Número: 0');
  });

  it('keeps every bead string in three locales', () => {
    for (const [key, entry] of Object.entries(NUM_A_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
  });
});
