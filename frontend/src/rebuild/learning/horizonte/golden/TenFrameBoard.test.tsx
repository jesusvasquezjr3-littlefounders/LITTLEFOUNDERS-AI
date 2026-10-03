import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixtureDocument } from '../previewDocument';
import { GOLDEN_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const show = (fixture: string, grade = vi.fn(() => ({ verdict: 'review' as const })), locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US') => {
  render(<LessonDocumentView raw={horizonteFixtureDocument('golden', fixture, locale)} locale={locale} ageBand="6-9" onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const cell = (frame: number, index: number, state: 'filled' | 'empty') => screen.getByRole('button', { name: `Frame ${frame}, Cell ${index}: ${state}` });

describe('golden board: ten frame (A03) and double ten frame (A04)', () => {
  it('meets the board contract for both fixtures', async () => {
    await assertBoardContract({ pack: 'golden', fixtureId: 'make-ten', copy: GOLDEN_COPY, css: ['golden/TenFrameBoard.css'] });
    await assertBoardContract({ pack: 'golden', fixtureId: 'fill-first', copy: GOLDEN_COPY, css: ['golden/TenFrameBoard.css'], locales: ['en-US'] });
  });

  it('adds counters by tapping cells and submits the integer count', async () => {
    const grade = show('make-ten');
    await screen.findByRole('group', { name: 'Frame 1' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    for (const index of [7, 8, 9, 10]) fireEvent.click(cell(1, index, 'empty'));
    expect(status()).toHaveTextContent('Total: 10. Empty cells: 0');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ counts: [10] }, 'ten-frame-make-ten', expect.anything()));
  });

  it('takes back the last added counter and resets to the authored start', async () => {
    show('make-ten');
    await screen.findByRole('group', { name: 'Frame 1' });
    fireEvent.click(cell(1, 7, 'empty'));
    fireEvent.click(cell(1, 7, 'filled'));
    expect(status()).toHaveTextContent('Total: 6');
    fireEvent.click(cell(1, 7, 'empty'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Total: 6');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('places a counter with the keyboard path: pick a chip, then Move to', async () => {
    const grade = show('make-ten');
    await screen.findByRole('group', { name: 'Frame 1' });
    const moveTo = screen.getByRole('button', { name: 'Move to' });
    expect(moveTo).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add counter' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Add counter: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Frame 1' }));
    expect(status()).toHaveTextContent('Total: 7');
    expect(grade).not.toHaveBeenCalled();
  });

  it('moves counters between two frames and never changes the total', async () => {
    const grade = show('fill-first');
    await screen.findByRole('group', { name: 'Frame 2' });
    expect(status()).toHaveTextContent('Total: 13');
    fireEvent.click(cell(1, 9, 'empty'));
    fireEvent.click(cell(1, 10, 'empty'));
    expect(status()).toHaveTextContent('Total: 13');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ counts: [10, 3] }, 'ten-frame-fill-first', expect.anything()));
  });

  it('a full frame has no empty cell to add to', async () => {
    show('fill-first');
    await screen.findByRole('group', { name: 'Frame 2' });
    fireEvent.click(cell(1, 9, 'empty'));
    fireEvent.click(cell(1, 10, 'empty'));
    expect(screen.queryAllByRole('button', { name: /^Frame 1, Cell \d+: empty$/ })).toHaveLength(0);
    expect(status()).toHaveTextContent('Empty cells: 7');
  });

  it('shows the same state as a table', async () => {
    show('fill-first');
    await screen.findByRole('group', { name: 'Frame 2' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Counters in each frame' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['FrameFilledEmpty', '182', '255', 'Total137']);
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('make-ten', undefined, 'es-MX');
    expect(await screen.findByRole('group', { name: 'Cuadro 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
  });

  it('keeps every drag-and-tap string in three locales', () => {
    for (const [key, entry] of Object.entries(GOLDEN_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
  });
});
