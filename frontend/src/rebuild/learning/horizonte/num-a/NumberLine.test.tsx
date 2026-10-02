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

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const show = (fixture: string, grade = vi.fn(() => ({ verdict: 'review' as const })), locale: Locale = 'en-US', ageBand: '6-9' | '10-12' = '6-9') => {
  render(<LessonDocumentView raw={horizonteFixtureDocument('num-a', fixture, locale)} locale={locale} ageBand={ageBand} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const jump = (name: string) => screen.getByRole('button', { name });
const press = (name: string, times: number) => { for (let count = 0; count < times; count += 1) fireEvent.click(screen.getByRole('button', { name })); };

describe('num-a board: empty number line (A12)', () => {
  it('meets the board contract for both fixtures', async () => {
    await assertBoardContract({ pack: 'num-a', fixtureId: 'jump-up', copy: NUM_A_COPY, css: ['num-a/NumberLine.css'] });
    await assertBoardContract({ pack: 'num-a', fixtureId: 'jump-back', copy: NUM_A_COPY, css: ['num-a/NumberLine.css'], locales: ['en-US'] });
  });

  it('jumps forward in the sizes the author allows and submits the signed jumps', async () => {
    const grade = show('jump-up');
    await screen.findByRole('button', { name: 'Jump forward 20' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(status()).toHaveTextContent('Start: 47. Now at: 47. Jumps left: 6');
    fireEvent.click(jump('Jump forward 20'));
    fireEvent.click(jump('Jump forward 5'));
    fireEvent.click(jump('Jump forward 1'));
    expect(status()).toHaveTextContent('Start: 47. +20, +5, +1. Now at: 73. Jumps left: 3');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ jumps: [20, 5, 1] }, 'jump-up', expect.anything()));
  });

  it('jumps back with its own buttons', async () => {
    const grade = show('jump-back');
    await screen.findByRole('button', { name: 'Jump back 20' });
    fireEvent.click(jump('Jump back 20'));
    press('Jump back 2', 2);
    expect(status()).toHaveTextContent('Start: 62. −20, −2, −2. Now at: 38. Jumps left: 1');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ jumps: [-20, -2, -2] }, 'jump-back', expect.anything()));
  });

  it('stops at the jump limit and never leaves the line', async () => {
    show('jump-back');
    await screen.findByRole('button', { name: 'Jump back 20' });
    press('Jump back 20', 3);
    expect(status()).toHaveTextContent('Now at: 2. Jumps left: 1');
    expect(jump('Jump back 10')).toBeDisabled();
    expect(jump('Jump back 2')).toBeEnabled();
    fireEvent.click(jump('Jump back 2'));
    expect(status()).toHaveTextContent('Now at: 0. Jumps left: 0');
    for (const name of ['Jump forward 1', 'Jump forward 20', 'Jump back 1', 'Jump back 20']) expect(jump(name)).toBeDisabled();
  });

  it('takes back the last jump with Undo and clears them with Reset', async () => {
    show('jump-up');
    await screen.findByRole('button', { name: 'Jump forward 20' });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    fireEvent.click(jump('Jump forward 10'));
    fireEvent.click(jump('Jump forward 20'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(status()).toHaveTextContent('Start: 47. +10. Now at: 57. Jumps left: 5');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Start: 47. Now at: 47. Jumps left: 6');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('shows the same jumps as a table', async () => {
    show('jump-up');
    await screen.findByRole('button', { name: 'Jump forward 20' });
    fireEvent.click(jump('Jump forward 20'));
    fireEvent.click(jump('Jump forward 5'));
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Jumps on the line' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['StepJumpLands on', 'Start47', '1+2067', '2+572']);
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('jump-up', undefined, 'es-MX');
    expect(await screen.findByRole('button', { name: 'Salta hacia adelante 20' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
    expect(status()).toHaveTextContent('Inicio: 47. Ahora en: 47. Saltos restantes: 6');
  });

  it('speaks it in Portuguese too', async () => {
    show('jump-back', undefined, 'pt-BR');
    expect(await screen.findByRole('button', { name: 'Pule para trás 20' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeTruthy();
  });
});

describe('num-a board: zoomable number line (A13)', () => {
  it('meets the board contract for both fixtures', async () => {
    await assertBoardContract({ pack: 'num-a', fixtureId: 'zoom-tenths', copy: NUM_A_COPY, css: ['num-a/NumberLine.css'] });
    await assertBoardContract({ pack: 'num-a', fixtureId: 'zoom-hundredths', copy: NUM_A_COPY, css: ['num-a/NumberLine.css'], locales: ['en-US'] });
  });

  it('moves the marker one tick at a time, zooms in, and submits the whole units on the finest grid', async () => {
    const grade = show('zoom-tenths', undefined, 'en-US', '10-12');
    await screen.findByRole('button', { name: 'Zoom in' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Marker: One tick left' })).toBeDisabled();
    press('Marker: One tick right', 3);
    expect(status()).toHaveTextContent('Zoom 0. Marker at: 3. From: 0, To: 10, Tick: 1');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(status()).toHaveTextContent('Zoom 1. Marker at: 3.0. From: 2.0, To: 4.0, Tick: 0.1');
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    press('Marker: One tick right', 4);
    expect(status()).toHaveTextContent('Marker at: 3.4');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ units: 34 }, 'zoom-tenths', expect.anything()));
  });

  it('zooms in twice for hundredths and keeps the marker in the window when zooming out', async () => {
    const grade = show('zoom-hundredths', undefined, 'en-US', '10-12');
    await screen.findByRole('button', { name: 'Zoom in' });
    press('Marker: One tick right', 3);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    press('Marker: One tick right', 4);
    expect(status()).toHaveTextContent('Zoom 1. Marker at: 3.4. From: 2.0, To: 4.0, Tick: 0.1');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(status()).toHaveTextContent('Zoom 2. Marker at: 3.40. From: 3.30, To: 3.50, Tick: 0.01');
    press('Marker: One tick right', 7);
    expect(status()).toHaveTextContent('Marker at: 3.47');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ units: 347 }, 'zoom-hundredths', expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(status()).toHaveTextContent('Zoom 1. Marker at: 3.5');
  });

  it('resets to whole numbers with the marker at the start', async () => {
    show('zoom-tenths', undefined, 'en-US', '10-12');
    await screen.findByRole('button', { name: 'Zoom in' });
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Marker: One tick right' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Zoom 0. Marker at: 0. From: 0, To: 10, Tick: 1');
  });

  it('shows every zoom level as a table', async () => {
    show('zoom-hundredths', undefined, 'en-US', '10-12');
    await screen.findByRole('button', { name: 'Zoom in' });
    press('Marker: One tick right', 3);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    press('Marker: One tick right', 4);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    press('Marker: One tick right', 7);
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Zoom levels' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['ZoomFromToTick', '0051', '12.04.00.1', '23.303.500.01', 'Marker at3.47']);
  });

  it('writes decimals the local way and names the steps in each language', async () => {
    show('zoom-tenths', undefined, 'pt-BR', '10-12');
    fireEvent.click(await screen.findByRole('button', { name: 'Marcador: Uma marca para a direita' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aproximar' }));
    expect(status()).toHaveTextContent('Zoom 1. Marcador em: 1,0. De: 0,0, Até: 2,0, Marca: 0,1');
  });
});
