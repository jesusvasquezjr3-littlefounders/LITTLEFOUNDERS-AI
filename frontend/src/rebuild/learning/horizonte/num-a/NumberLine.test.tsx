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
const show = (fixture: string, grade = vi.fn((): { verdict: 'met' | 'review' } => ({ verdict: 'review' })), locale: Locale = 'en-US', ageBand: '6-9' | '10-12' = '6-9') => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    const table = screen.getByRole('table', { name: 'Jumps on the line' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['StepJumpLands on', 'Start47', '1+2067', '2+572']);
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('jump-up', undefined, 'es-MX');
    expect(await screen.findByRole('button', { name: 'Salta hacia adelante 20' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tabla' })).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
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

describe('num-a board: order the numbers on a line (F1.3)', () => {
  const mark = (index: number, word: 'Mark' | 'Marca' = 'Mark') => screen.getByLabelText(`${word} ${index}`);
  const chip = (name: string) => screen.getByRole('button', { name });
  const put = (name: string, index: number) => { fireEvent.click(chip(name)); fireEvent.click(mark(index)); };

  it('meets the board contract for the whole numbers and the close decimals', async () => {
    const css = ['num-a/NumShared.css', 'num-a/Order.css'];
    await assertBoardContract({ pack: 'num-a', fixtureId: 'order-tens', copy: NUM_A_COPY, css });
    await assertBoardContract({ pack: 'num-a', fixtureId: 'order-hundredths', copy: NUM_A_COPY, css, locales: ['en-US', 'pt-BR'] });
  });

  it('starts empty, places each number by tapping it and then a mark, and submits every position', async () => {
    const grade = show('order-tens');
    await screen.findByRole('button', { name: '70' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move to' })).toBeDisabled();
    expect(status()).toHaveTextContent('From 0 to 100. Each step is 10. Placed: none. Left to place: 70; 30; 90; 50.');
    put('70', 7);
    put('30', 3);
    put('90', 9);
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(status()).toHaveTextContent('Placed: 70 on mark 7; 30 on mark 3; 90 on mark 9. Left to place: 50.');
    put('50', 5);
    expect(status()).toHaveTextContent('Left to place: none.');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ slots: { 'm-7': ['n-70'], 'm-3': ['n-30'], 'm-9': ['n-90'], 'm-5': ['n-50'] } }, 'order-tens', expect.anything()));
  });

  it('labels only the ends and the middle, so the rest is read from the step', async () => {
    show('order-tens');
    await screen.findByRole('button', { name: '70' });
    const line = document.querySelector('.lf-order-line')!;
    expect([...line.querySelectorAll('.lf-order-number')].map((label) => label.textContent)).toEqual(['0', '50', '100']);
    expect(line.querySelectorAll('.lf-order-mark')).toHaveLength(11);
  });

  it('puts a number on an occupied mark by swapping, or sends the one there back to the tray', async () => {
    show('order-tens');
    await screen.findByRole('button', { name: '70' });
    put('30', 3);
    put('70', 3);
    expect(status()).toHaveTextContent('Placed: 70 on mark 3. Left to place: 30; 90; 50.');
    put('30', 5);
    put('70', 5);
    expect(status()).toHaveTextContent('Placed: 70 on mark 5; 30 on mark 3. Left to place: 90; 50.');
  });

  it('puts the number in hand where a placed number sits when that number is pressed', async () => {
    show('order-tens');
    await screen.findByRole('button', { name: '70' });
    put('70', 3);
    fireEvent.click(chip('30'));
    fireEvent.click(chip('70'));
    expect(status()).toHaveTextContent('Placed: 30 on mark 3. Left to place: 70; 90; 50.');
  });

  it('puts the number in hand down when it is pressed again', async () => {
    show('order-tens');
    await screen.findByRole('button', { name: '70' });
    fireEvent.click(chip('70'));
    expect(screen.getByRole('button', { name: '70: Move to' })).toBeEnabled();
    fireEvent.click(chip('70'));
    expect(screen.getByRole('button', { name: 'Move to' })).toBeDisabled();
    expect(status()).toHaveTextContent('Placed: none');
  });

  it('works from the keyboard path: pick a number, then Move to a mark or back to the tray', async () => {
    const grade = show('order-teens');
    await screen.findByRole('button', { name: '14' });
    expect(status()).toHaveTextContent('From 0 to 20. Each step is 1. Placed: none. Left to place: 14; 7; 19.');
    for (const [name, target] of [['14', 'Mark 14'], ['7', 'Mark 7'], ['19', 'Mark 19']] as const) {
      fireEvent.click(chip(name));
      fireEvent.click(screen.getByRole('button', { name: `${name}: Move to` }));
      fireEvent.click(await screen.findByRole('menuitem', { name: target }));
    }
    expect(status()).toHaveTextContent('Placed: 14 on mark 14; 7 on mark 7; 19 on mark 19');
    fireEvent.click(chip('7'));
    fireEvent.click(screen.getByRole('button', { name: '7: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Tray' }));
    expect(status()).toHaveTextContent('Left to place: 7.');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.click(chip('7'));
    fireEvent.click(screen.getByRole('button', { name: '7: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Mark 7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ slots: { 'm-14': ['n-14'], 'm-7': ['n-7'], 'm-19': ['n-19'] } }, 'order-teens', expect.anything()));
  });

  it('sends a placed number back to the tray when the tray is tapped, and resets everything', async () => {
    show('order-tens');
    await screen.findByRole('button', { name: '70' });
    put('70', 7);
    put('30', 3);
    fireEvent.click(chip('70'));
    fireEvent.click(document.querySelector('.lf-order-tray')!);
    expect(status()).toHaveTextContent('Placed: 30 on mark 3. Left to place: 70; 90; 50.');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Placed: none. Left to place: 70; 30; 90; 50.');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('shows the same placement as a table', async () => {
    show('order-tens');
    await screen.findByRole('button', { name: '70' });
    put('70', 7);
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    const table = screen.getByRole('table', { name: 'Numbers on the line' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['NumberMark', '707', '30Not placed', '90Not placed', '50Not placed']);
  });

  it('places tenths on a line from 0 to 1', async () => {
    const grade = show('order-tenths', undefined, 'en-US', '10-12');
    await screen.findByRole('button', { name: '0.7' });
    expect(status()).toHaveTextContent('From 0.0 to 1.0. Each step is 0.1. Placed: none. Left to place: 0.7; 0.2; 0.5.');
    put('0.7', 7);
    put('0.2', 2);
    put('0.5', 5);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ slots: { 'm-7': ['n-7'], 'm-2': ['n-2'], 'm-5': ['n-5'] } }, 'order-tenths', expect.anything()));
  });

  it('writes close decimals with their trailing zero on a window that does not start at zero', async () => {
    show('order-hundredths', undefined, 'en-US', '10-12');
    await screen.findByRole('button', { name: '0.45' });
    expect(status()).toHaveTextContent('From 0.30 to 0.50. Each step is 0.01. Placed: none. Left to place: 0.45; 0.32; 0.40; 0.37.');
    const line = document.querySelector('.lf-order-line')!;
    expect([...line.querySelectorAll('.lf-order-number')].map((label) => label.textContent)).toEqual(['0.30', '0.40', '0.50']);
  });

  it('speaks the same piece in Spanish', async () => {
    show('order-tens', undefined, 'es-MX');
    await screen.findByRole('button', { name: '70' });
    expect(status()).toHaveTextContent('Desde 0 hasta 100. Cada paso es 10. Colocados: ninguno. Por colocar: 70; 30; 90; 50.');
    fireEvent.click(chip('70'));
    fireEvent.click(mark(7, 'Marca'));
    expect(status()).toHaveTextContent('Colocados: 70 en la marca 7.');
    expect(screen.getByRole('heading', { name: 'Números' })).toBeTruthy();
  });

  it('writes decimals with a comma in Portuguese', async () => {
    show('order-tenths', undefined, 'pt-BR', '10-12');
    await screen.findByRole('button', { name: '0,7' });
    expect(status()).toHaveTextContent('De 0,0 até 1,0. Cada passo é 0,1. Colocados: nenhum. Para colocar: 0,7; 0,2; 0,5.');
    fireEvent.click(chip('0,7'));
    fireEvent.click(mark(7, 'Marca'));
    expect(status()).toHaveTextContent('Colocados: 0,7 na marca 7.');
  });
});
