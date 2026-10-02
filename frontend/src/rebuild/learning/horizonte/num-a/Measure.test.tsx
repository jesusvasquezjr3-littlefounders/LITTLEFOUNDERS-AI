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
const show = (fixture: string, grade = vi.fn((): { verdict: 'met' | 'review' } => ({ verdict: 'review' })), locale: Locale = 'en-US') => {
  render(<LessonDocumentView raw={horizonteFixtureDocument('num-a', fixture, locale)} locale={locale} ageBand="6-9" onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const press = (name: string, times: number) => { for (let count = 0; count < times; count += 1) fireEvent.click(screen.getByRole('button', { name })); };
const measured = (element: Element, width: number, height: number) => {
  element.getBoundingClientRect = () => ({ left: 0, top: 0, right: width, bottom: height, x: 0, y: 0, width, height, toJSON: () => ({}) });
};

describe('num-a board: clock (A14)', () => {
  it('meets the board contract for both fixtures', async () => {
    await assertBoardContract({ pack: 'num-a', fixtureId: 'clock-half-past', copy: NUM_A_COPY, css: ['num-a/Measure.css'] });
    await assertBoardContract({ pack: 'num-a', fixtureId: 'clock-later', copy: NUM_A_COPY, css: ['num-a/Measure.css'], locales: ['en-US'] });
  });

  it('sets the hour and the minutes and submits the minutes after 12:00', async () => {
    const grade = show('clock-half-past');
    await screen.findByRole('img', { name: 'Clock showing 12:00' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hour: More' })).toBeDisabled();
    press('Hour: Less', 9);
    press('Minutes: More', 2);
    expect(status()).toHaveTextContent('Time: 3:30');
    expect(screen.getByRole('img', { name: 'Clock showing 3:30' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ minutes: 210 }, 'clock-half-past', expect.anything()));
  });

  it('moves the minutes only in the steps the author allows', async () => {
    const grade = show('clock-later');
    await screen.findByRole('img', { name: 'Clock showing 3:15' });
    press('Minutes: More', 5);
    expect(status()).toHaveTextContent('Time: 3:40');
    press('Minutes: More', 20);
    expect(status()).toHaveTextContent('Time: 3:55');
    expect(screen.getByRole('button', { name: 'Minutes: More' })).toBeDisabled();
    press('Minutes: Less', 3);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ minutes: 220 }, 'clock-later', expect.anything()));
  });

  it('points the minute hand where the face is tapped', async () => {
    show('clock-half-past');
    await screen.findByRole('img', { name: 'Clock showing 12:00' });
    const face = document.querySelector('.lf-clock-tap')!;
    measured(face, 240, 240);
    fireEvent.click(face, { clientX: 240, clientY: 120 });
    expect(status()).toHaveTextContent('Time: 12:15');
    fireEvent.click(face, { clientX: 120, clientY: 240 });
    expect(status()).toHaveTextContent('Time: 12:30');
  });

  it('shows the same time as a table and resets to the start', async () => {
    show('clock-later');
    await screen.findByRole('img', { name: 'Clock showing 3:15' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'The time on the clock' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['HourMinutesTime', '3153:15']);
    fireEvent.click(screen.getByRole('button', { name: 'Minutes: More' }));
    expect(within(table).getAllByRole('row')[1]!.textContent).toBe('3203:20');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Time: 3:15');
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('clock-half-past', undefined, 'es-MX');
    expect(await screen.findByRole('img', { name: 'Reloj que marca las 12:00' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Minutos: Más' })).toBeTruthy();
    expect(status()).toHaveTextContent('Hora: 12:00');
  });

  it('speaks it in Portuguese too', async () => {
    show('clock-half-past', undefined, 'pt-BR');
    expect(await screen.findByRole('img', { name: 'Relógio marcando 12:00' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hora: Mais' })).toBeDisabled();
  });
});

describe('num-a board: ruler (A15)', () => {
  it('meets the board contract for both fixtures', async () => {
    await assertBoardContract({ pack: 'num-a', fixtureId: 'ruler-six', copy: NUM_A_COPY, css: ['num-a/Measure.css'] });
    await assertBoardContract({ pack: 'num-a', fixtureId: 'ruler-inches', copy: NUM_A_COPY, css: ['num-a/Measure.css'], locales: ['en-US'] });
  });

  it('stretches the bar to a whole mark and submits where it ends', async () => {
    const grade = show('ruler-six');
    await screen.findByRole('img', { name: 'Ruler: From 2 to 3 centimeters' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    press('End of the bar: More', 5);
    expect(status()).toHaveTextContent('From 2 to 8. Length: 6 centimeters');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ end: 8 }, 'ruler-six', expect.anything()));
  });

  it('rounds a tap on the ruler to the nearest mark and keeps the bar on the ruler', async () => {
    show('ruler-six');
    await screen.findByRole('img', { name: /^Ruler:/ });
    const strip = document.querySelector('.lf-ruler-strip')!;
    measured(strip, 500, 100);
    fireEvent.click(strip, { clientX: 400, clientY: 50 });
    expect(status()).toHaveTextContent('From 2 to 8. Length: 6');
    fireEvent.click(strip, { clientX: 0, clientY: 50 });
    expect(status()).toHaveTextContent('From 2 to 2. Length: 0');
    fireEvent.click(strip, { clientX: 500, clientY: 50 });
    expect(status()).toHaveTextContent('From 2 to 10. Length: 8');
    expect(screen.getByRole('button', { name: 'End of the bar: More' })).toBeDisabled();
  });

  it('measures in inches when the author says so', async () => {
    const grade = show('ruler-inches');
    await screen.findByRole('img', { name: 'Ruler: From 3 to 3 inches' });
    press('End of the bar: More', 4);
    expect(status()).toHaveTextContent('From 3 to 7. Length: 4 inches');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ end: 7 }, 'ruler-inches', expect.anything()));
  });

  it('shows the same bar as a table and resets to the start', async () => {
    show('ruler-six');
    await screen.findByRole('img', { name: /^Ruler:/ });
    press('End of the bar: More', 2);
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'The bar on the ruler' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['FromToLength', '253 centimeters']);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('From 2 to 3. Length: 1 centimeters');
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('ruler-six', undefined, 'es-MX');
    expect(await screen.findByRole('img', { name: 'Regla: De 2 a 3 centímetros' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Final de la barra: Más' })).toBeTruthy();
    expect(status()).toHaveTextContent('De 2 a 3. Largo: 1 centímetros');
  });

  it('speaks it in Portuguese too', async () => {
    show('ruler-inches', undefined, 'pt-BR');
    expect(await screen.findByRole('img', { name: 'Régua: De 3 a 3 polegadas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fim da barra: Menos' })).toBeDisabled();
  });
});

describe('num-a board: pan balance (A16)', () => {
  const region = (name: string) => screen.getByRole('heading', { name, level: 3 }).closest('.lf-pan-region')!;

  it('meets the board contract for both fixtures', async () => {
    await assertBoardContract({ pack: 'num-a', fixtureId: 'balance-it', copy: NUM_A_COPY, css: ['num-a/Measure.css'] });
    await assertBoardContract({ pack: 'num-a', fixtureId: 'balance-heavier', copy: NUM_A_COPY, css: ['num-a/Measure.css'], locales: ['en-US'] });
  });

  it('moves weights onto a pan by tapping the weight and then the pan, and submits where each one sits', async () => {
    const grade = show('balance-it');
    await screen.findByRole('button', { name: 'Weight 3' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(status()).toHaveTextContent('Left pan: 5. Right pan: 0. Left pan is heavier by 5');
    fireEvent.click(screen.getByRole('button', { name: 'Weight 3' }));
    fireEvent.click(region('Right pan'));
    expect(status()).toHaveTextContent('Right pan: 3. Left pan is heavier by 2');
    fireEvent.click(screen.getAllByRole('button', { name: 'Weight 2' })[1]!);
    fireEvent.click(region('Right pan'));
    expect(status()).toHaveTextContent('Left pan: 5. Right pan: 5. Both pans are equal');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ pans: [0, 0, 2, 2] }, 'balance-it', expect.anything()));
  });

  it('works from the keyboard path: pick a weight, then Move to a pan', async () => {
    const grade = show('balance-heavier');
    await screen.findByRole('button', { name: 'Weight 3' });
    expect(screen.getByRole('button', { name: 'Move to' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Weight 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weight 3: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Left pan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weight 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weight 1: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Right pan' }));
    expect(status()).toHaveTextContent('Left pan: 7. Right pan: 5. Left pan is heavier by 2');
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ pans: [2, 0, 1] }, 'balance-heavier', expect.anything()));
  });

  it('moves a weight back to the tray and tilts the other way', async () => {
    show('balance-heavier');
    await screen.findByRole('button', { name: 'Weight 3' });
    fireEvent.click(screen.getByRole('button', { name: 'Weight 2' }));
    fireEvent.click(region('Right pan'));
    expect(status()).toHaveTextContent('Right pan is heavier by 2');
    fireEvent.click(screen.getByRole('button', { name: 'Weight 2' }));
    fireEvent.click(region('Tray'));
    expect(status()).toHaveTextContent('Both pans are equal');
  });

  it('resets every weight to the tray', async () => {
    show('balance-it');
    await screen.findByRole('button', { name: 'Weight 3' });
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Weight 3' }));
    fireEvent.click(region('Left pan'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Left pan: 5. Right pan: 0');
    expect(within(region('Tray') as HTMLElement).getAllByRole('button')).toHaveLength(4);
  });

  it('shows the same pans as a table', async () => {
    show('balance-it');
    await screen.findByRole('button', { name: 'Weight 3' });
    fireEvent.click(screen.getByRole('button', { name: 'Weight 3' }));
    fireEvent.click(region('Right pan'));
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Weights on each pan' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['PanWeightsTotal', 'Left pan55', 'Tray1, 2, 2', 'Right pan33']);
  });

  it('speaks the same piece in Spanish and Portuguese', async () => {
    show('balance-it', undefined, 'es-MX');
    expect(await screen.findByRole('button', { name: 'Pesa 3' })).toBeTruthy();
    expect(status()).toHaveTextContent('Platillo izquierdo: 5. Platillo derecho: 0. El platillo izquierdo pesa 5 más');
  });

  it('speaks it in Portuguese too', async () => {
    show('balance-it', undefined, 'pt-BR');
    expect(await screen.findByRole('button', { name: 'Peso 3' })).toBeTruthy();
    expect(status()).toHaveTextContent('Prato esquerdo: 5. Prato direito: 0. O prato esquerdo pesa 5 a mais');
  });
});
