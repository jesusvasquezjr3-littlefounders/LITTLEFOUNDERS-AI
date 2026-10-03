import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixtureDocument } from '../previewDocument';
import { AR_PILOT_MIN_AGE, arPilotGate, arVolumeMl, isArPilotEnabled } from './ar.generated';
import { ArPilotContext, arSessionInit, defaultArPilot, type ArPilotEnvironment, type ArStartInput, type ArXrSystem } from './ar/arPilot';
import { SPACE2_COPY } from './copy';
import { distanceKm, feeCents, routeCenter } from './globe.generated';
import { money, spaceText, unitsText, yearsText } from './spaceText';
import { surfaceSlice } from './surface.generated';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'none', maxTextureSize: 0, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));
// The real coastlines are covered by landLoader.test.ts; here a box of land keeps the globe synchronous and offline.
vi.mock('./landLoader', () => ({
  loadLand: () => Promise.resolve({ type: 'Polygon', coordinates: [[[-100, 10], [-100, 40], [-60, 40], [-60, 10], [-100, 10]]] }),
}));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const BANDS: Record<string, '10-12' | '13-17'> = {
  'time-beats-rate': '13-17', 'price-and-units': '13-17', 'nearest-route': '10-12', 'cheapest-corridor': '13-17', 'object-on-the-table': '13-17',
  'slope-two-ways': '13-17', 'gradient-at-a-point': '13-17', 'downhill-walk': '13-17', 'build-a-surface': '13-17',
};
const show = (fixture: string, grade = vi.fn(() => ({ verdict: 'review' as const })), locale: Locale = 'en-US', env?: ArPilotEnvironment) => {
  const view = <LessonDocumentView raw={horizonteFixtureDocument('space2', fixture, locale)} locale={locale} ageBand={BANDS[fixture]!} onBack={() => {}} onGradeAny={grade} />;
  render(env ? <ArPilotContext.Provider value={env}>{view}</ArPilotContext.Provider> : view);
  return grade;
};
const css = ['space2/space2.css'];
const readout = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const rowTexts = (table: HTMLElement) => within(table).getAllByRole('row').map((row) => row.textContent);
const here = (file: string): string => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

describe('space2 board contract', () => {
  it('meets the board contract for the two surfaces', async () => {
    await assertBoardContract({ pack: 'space2', fixtureId: 'time-beats-rate', copy: SPACE2_COPY, css });
    await assertBoardContract({ pack: 'space2', fixtureId: 'price-and-units', copy: SPACE2_COPY, css });
  }, 90_000);

  it('meets the board contract for the two globes', async () => {
    await assertBoardContract({ pack: 'space2', fixtureId: 'nearest-route', copy: SPACE2_COPY, css });
    await assertBoardContract({ pack: 'space2', fixtureId: 'cheapest-corridor', copy: SPACE2_COPY, css });
  }, 90_000);

  it('meets the board contract for the AR table pilot', async () => {
    await assertBoardContract({ pack: 'space2', fixtureId: 'object-on-the-table', copy: SPACE2_COPY, css });
  }, 60_000);

  it('keeps every string in three locales', () => {
    for (const [key, entry] of Object.entries(SPACE2_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
  });
});

describe('space2 plural units', () => {
  it('chooses years and units by the locale plural rule: pt-BR counts 0 as singular', () => {
    expect(yearsText(spaceText('pt-BR'), 0, 'pt-BR')).toBe('0 ano');
    expect(yearsText(spaceText('en-US'), 0, 'en-US')).toBe('0 years');
    expect(yearsText(spaceText('es-MX'), 0, 'es-MX')).toBe('0 años');
    expect(unitsText(spaceText('pt-BR'), 0, 'pt-BR')).toBe('0 unidade');
    expect(unitsText(spaceText('en-US'), 0, 'en-US')).toBe('0 units');
    expect(unitsText(spaceText('es-MX'), 0, 'es-MX')).toBe('0 unidades');
    expect(yearsText(spaceText('pt-BR'), 1, 'pt-BR')).toBe('1 ano');
    expect(unitsText(spaceText('en-US'), 1, 'en-US')).toBe('1 unit');
  });
});

describe('F4.7 surface', () => {
  it('turns the surface with the arrow keys and the four buttons', async () => {
    show('time-beats-rate');
    const stage = await screen.findByRole('group', { name: 'Surface of values' });
    expect(readout()).toHaveTextContent('Surface of values. Corner view. Turn 1 of 4');
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(readout()).toHaveTextContent('Corner view. Turn 2 of 4');
    fireEvent.keyDown(stage, { key: 'ArrowUp' });
    expect(readout()).toHaveTextContent('Top view');
    expect(button('Look higher')).toBeDisabled();
    fireEvent.keyDown(stage, { key: 'ArrowRight', ctrlKey: true });
    expect(readout()).toHaveTextContent('Top view. Turn 2 of 4');
    fireEvent.click(button('Turn left'));
    expect(readout()).toHaveTextContent('Top view. Turn 1 of 4');
  });

  it('draws the mesh, the held slice and a pin for every option', async () => {
    show('time-beats-rate');
    await screen.findByRole('group', { name: 'Surface of values' });
    expect(document.querySelectorAll('.lf-s2-cell')).toHaveLength(9);
    expect(document.querySelectorAll('.lf-s2-held')).toHaveLength(1);
    expect([...document.querySelectorAll('.lf-s2-pin text')].map((pin) => pin.textContent)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('slices the surface under a slider, with plus and minus as the other way', async () => {
    show('time-beats-rate');
    await screen.findByRole('group', { name: 'Surface of values' });
    const first = surfaceSlice({ kind: 'compound', principalCents: 100000, ratesBps: [200, 400, 600, 800], terms: [5, 10, 15, 20] }, 'x', 0)!;
    const note = () => document.querySelector('.lf-s2-note') as HTMLElement;
    expect(note()).toHaveTextContent(`Rate: 2%. Amount from ${money(Math.min(...first.values), 'en-US')} to ${money(Math.max(...first.values), 'en-US')}.`);
    const slider = screen.getByRole('slider', { name: 'Rate' });
    fireEvent.change(slider, { target: { value: '2' } });
    expect(note()).toHaveTextContent('Rate: 6%.');
    fireEvent.click(button('Rate: More'));
    expect(note()).toHaveTextContent('Rate: 8%.');
    expect(button('Rate: More')).toBeDisabled();
    fireEvent.click(button('Rate: Less'));
    expect(note()).toHaveTextContent('Rate: 6%.');
  });

  it('holds the other value still when asked', async () => {
    show('time-beats-rate');
    await screen.findByRole('group', { name: 'Surface of values' });
    fireEvent.click(button('Hold the term'));
    expect(screen.getByRole('slider', { name: 'Term' })).toHaveAttribute('aria-valuetext', '5 years');
    expect(document.querySelector('.lf-s2-note')).toHaveTextContent('Term: 5 years.');
  });

  it('reads a profit surface by price and quantity', async () => {
    show('price-and-units');
    await screen.findByRole('group', { name: 'Surface of values' });
    expect(document.querySelector('.lf-s2-note')).toHaveTextContent('Price: $2. Profit from');
    fireEvent.click(button('Hold the units'));
    expect(screen.getByRole('slider', { name: 'Units' })).toHaveAttribute('aria-valuetext', '50 units');
  });

  it('shows the whole surface as a table with the lettered options marked', async () => {
    show('time-beats-rate');
    await screen.findByRole('group', { name: 'Surface of values' });
    fireEvent.click(button('Show as table'));
    const table = screen.getByRole('table', { name: 'Amount at every rate and term' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getAllByRole('columnheader')).toHaveLength(5);
    for (const letter of ['A', 'B', 'C', 'D']) expect(within(table).getByText(new RegExp(`\\(${letter}\\)`))).toBeTruthy();
    expect(rowTexts(table)[1]).toContain('5 years');
    fireEvent.click(button('Hide table'));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('chooses an option and submits only the choice, never saying met itself', async () => {
    const grade = show('time-beats-rate');
    await screen.findByRole('group', { name: 'Surface of values' });
    expect(button('Check')).toBeDisabled();
    expect(screen.getByText('Chosen: none')).toBeTruthy();
    fireEvent.click(button(/^C: 6%, 15 years/));
    expect(screen.getByText('Chosen: C')).toBeTruthy();
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ choice: 'c' }, 'surface-time-beats-rate', expect.anything()));
    expect(screen.queryByText('You read the surface and found it.')).toBeNull();
  });

  it('keeps looking free and resets everything', async () => {
    show('time-beats-rate');
    await screen.findByRole('group', { name: 'Surface of values' });
    expect(button('Reset')).toBeDisabled();
    fireEvent.click(button('Turn right'));
    fireEvent.change(screen.getByRole('slider', { name: 'Rate' }), { target: { value: '3' } });
    expect(screen.getByText('Chosen: none')).toBeTruthy();
    fireEvent.click(button(/^A:/));
    fireEvent.click(button('Reset'));
    expect(screen.getByText('Chosen: none')).toBeTruthy();
    expect(readout()).toHaveTextContent('Corner view. Turn 1 of 4');
    expect(document.querySelector('.lf-s2-note')).toHaveTextContent('Rate: 2%.');
    expect(button('Reset')).toBeDisabled();
  });

  it('speaks in Spanish and Portuguese', async () => {
    show('time-beats-rate', undefined, 'es-MX');
    expect(await screen.findByRole('group', { name: 'Superficie de valores' })).toBeTruthy();
    expect(button('Mostrar como tabla')).toBeTruthy();
    expect(button('Fijar el plazo')).toBeTruthy();
  });
});

describe('F4.7 formula surface', () => {
  const stage = () => screen.findByRole('group', { name: 'Surface from a formula' });
  const box = (name: string) => screen.getByRole('textbox', { name });
  const type = (name: string, value: string) => fireEvent.change(box(name), { target: { value } });

  it('meets the board contract for the four formula tasks', async () => {
    for (const fixtureId of ['slope-two-ways', 'gradient-at-a-point', 'downhill-walk', 'build-a-surface']) {
      await assertBoardContract({ pack: 'space2', fixtureId, copy: SPACE2_COPY, css });
    }
  }, 180_000);

  it('draws the mesh, the held line along the asked axis and the dot, and reads the formula aloud', async () => {
    show('slope-two-ways');
    await stage();
    expect(document.querySelectorAll('.lf-s2-cell')).toHaveLength(36);
    expect(document.querySelectorAll('.lf-s2-held')).toHaveLength(1);
    expect(document.querySelectorAll('.lf-s2-dot-at')).toHaveLength(1);
    expect(screen.getByRole('img', { name: /^z equals x to the power of 2 plus 2 times x times y$/ })).toBeTruthy();
    expect(document.querySelector('.lf-s2-note')).toHaveTextContent('The dot is at x = 1, y = 2.');
    expect(screen.getByRole('textbox', { name: 'Slope along x' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Slope along y' })).toBeNull();
  });

  it('turns the surface with the arrow keys like the other surfaces', async () => {
    show('slope-two-ways');
    const group = await stage();
    expect(readout()).toHaveTextContent('Surface from a formula. Corner view. Turn 1 of 4');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(readout()).toHaveTextContent('Corner view. Turn 2 of 4');
  });

  it('keeps Check off until the number reads, then submits the canonical text and never says met itself', async () => {
    const grade = show('slope-two-ways');
    await stage();
    expect(button('Check')).toBeDisabled();
    type('Slope along x', 'six');
    expect(button('Check')).toBeDisabled();
    type('Slope along x', '12/2');
    expect(screen.getByText('Reads as 6')).toBeTruthy();
    expect(button('Check')).toBeEnabled();
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ answer: ['6'] }, 'formula-slope-two-ways', expect.anything()));
    expect(screen.queryByText('You worked it out from the formula.')).toBeNull();
  });

  it('accepts a decimal comma and a decimal point in every locale', async () => {
    const grade = show('slope-two-ways');
    await stage();
    type('Slope along x', '0,5');
    expect(screen.getByText('Reads as 0.5')).toBeTruthy();
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ answer: ['0.5'] }, 'formula-slope-two-ways', expect.anything()));
    type('Slope along x', '0.5');
    expect(screen.getByText('Reads as 0.5')).toBeTruthy();
    type('Slope along x', '-1,25');
    expect(screen.getByText('Reads as -1.25')).toBeTruthy();
    cleanup();
    show('slope-two-ways', undefined, 'pt-BR');
    await screen.findByRole('group', { name: 'Superfície de uma fórmula' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Inclinação ao longo de x' }), { target: { value: '0,5' } });
    expect(screen.getByText('Lido como 0,5')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Inclinação ao longo de x' }), { target: { value: '0.5' } });
    expect(screen.getByText('Lido como 0,5')).toBeTruthy();
  });

  it('asks for both slopes of a gradient and submits them in order', async () => {
    const grade = show('gradient-at-a-point');
    await stage();
    expect(document.querySelectorAll('.lf-s2-held')).toHaveLength(2);
    type('Slope along x', '3');
    expect(button('Check')).toBeDisabled();
    type('Slope along y', '1,0');
    expect(button('Check')).toBeEnabled();
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ answer: ['3', '1'] }, 'formula-gradient-at-a-point', expect.anything()));
  });

  it('never prints the slope: the table has heights only, with the dot marked', async () => {
    show('slope-two-ways');
    await stage();
    fireEvent.click(button('Show as table'));
    const table = screen.getByRole('table', { name: 'Height at every point' });
    expect(within(table).getAllByRole('row')).toHaveLength(8);
    expect(within(table).getAllByText(/\(dot\)/)).toHaveLength(1);
    expect(within(table).getByText('5 (dot)')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'The walk, step by step' })).toBeNull();
    fireEvent.click(button('Hide table'));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('steps a walk downhill with buttons and arrow keys and shows only the steps taken', async () => {
    const grade = show('downhill-walk');
    await stage();
    const status = () => document.querySelector('.lf-s2-walk .lf-s2-status') as HTMLElement;
    const walk = screen.getByRole('group', { name: 'Walk downhill' });
    expect(status()).toHaveTextContent('Step 0 of 8. Height 13.');
    expect(button('Step back')).toBeDisabled();
    fireEvent.click(button('Step downhill'));
    expect(status()).toHaveTextContent('Step 1 of 8. Height 8.32.');
    fireEvent.keyDown(walk, { key: 'ArrowRight' });
    fireEvent.keyDown(walk, { key: 'ArrowDown' });
    fireEvent.keyDown(walk, { key: 'ArrowRight' });
    expect(status()).toHaveTextContent('Step 4 of 8. Height ≈ 2.181. At or below the line.');
    expect(document.querySelectorAll('.lf-s2-walk-dot')).toHaveLength(5);
    fireEvent.keyDown(walk, { key: 'ArrowLeft' });
    expect(status()).toHaveTextContent('Step 3 of 8.');
    expect(status()).not.toHaveTextContent('At or below');
    fireEvent.keyDown(walk, { key: 'Home' });
    expect(status()).toHaveTextContent('Step 0 of 8.');
    for (let step = 0; step < 12; step += 1) fireEvent.keyDown(walk, { key: 'ArrowRight' });
    expect(status()).toHaveTextContent('Step 8 of 8.');
    expect(button('Step downhill')).toBeDisabled();
    type('Number of steps', '4');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ answer: ['4'] }, 'formula-downhill-walk', expect.anything()));
  });

  it('lists the walk as a table that grows only as the learner steps', async () => {
    show('downhill-walk');
    await stage();
    fireEvent.click(button('Show as table'));
    const steps = () => screen.getByRole('table', { name: 'The walk, step by step' });
    expect(within(steps()).getAllByRole('row')).toHaveLength(2);
    expect(rowTexts(steps())[1]).toContain('13');
    fireEvent.click(button('Step downhill'));
    fireEvent.click(button('Step downhill'));
    expect(within(steps()).getAllByRole('row')).toHaveLength(4);
    expect(within(screen.getByRole('table', { name: 'Height at every point' })).getAllByText(/\(dot\)/)).toHaveLength(1);
  });

  it('builds a surface through numbered dots, checks the dots live and submits the trimmed formula', async () => {
    const grade = show('build-a-surface');
    await stage();
    expect(document.querySelectorAll('.lf-s2-pin')).toHaveLength(3);
    expect(document.querySelectorAll('.lf-s2-cell')).toHaveLength(0);
    expect(screen.getByText('Dot 2: x = 1, y = 0, height 3')).toBeTruthy();
    expect(button('Check')).toBeDisabled();
    type('Your formula for z', 'x');
    expect(document.querySelectorAll('.lf-s2-cell')).toHaveLength(16);
    expect(screen.getByText('Your surface passes through 1 of 3 dots.')).toBeTruthy();
    expect(screen.getByRole('img', { name: /^z equals x$/ })).toBeTruthy();
    type('Your formula for z', ' 1+2x-y ');
    expect(screen.getByText('Your surface passes through 3 of 3 dots.')).toBeTruthy();
    expect(document.querySelectorAll('.lf-s2-pin[data-chosen="true"]')).toHaveLength(3);
    fireEvent.click(button('Show as table'));
    const dots = screen.getByRole('table', { name: 'The dots' });
    expect(within(dots).getAllByRole('row')).toHaveLength(4);
    expect(rowTexts(dots)[2]).toContain('3');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ answer: ['1+2x-y'] }, 'formula-build-a-surface', expect.anything()));
    expect(screen.queryByText('You worked it out from the formula.')).toBeNull();
  });

  it('accepts a decimal comma inside a typed formula', async () => {
    show('build-a-surface');
    await stage();
    type('Your formula for z', '1+2x-y+0,5-0.5');
    expect(screen.getByText('Your surface passes through 3 of 3 dots.')).toBeTruthy();
    expect(button('Check')).toBeEnabled();
  });

  it('refuses hostile or malformed formulas in plain words without running any of them', async () => {
    show('build-a-surface');
    await stage();
    const refused = (value: string, message: string) => {
      type('Your formula for z', value);
      expect(screen.getByText(message), value).toBeTruthy();
      expect(button('Check'), value).toBeDisabled();
      expect(document.querySelectorAll('.lf-s2-cell'), value).toHaveLength(0);
    };
    refused('alert(1)', 'Use x, y, numbers and + - * / ^ ( ) only.');
    refused('constructor', 'Use x, y, numbers and + - * / ^ ( ) only.');
    refused('__proto__', 'Use x, y, numbers and + - * / ^ ( ) only.');
    refused('x^7', 'A power is a whole number from 0 to 6.');
    refused('x^2.5', 'A power is a whole number from 0 to 6.');
    refused('x^99999999999', 'Check the numbers. Decimals use a point or a comma.');
    refused('(x+y', 'Check the brackets and the signs.');
    refused('x'.repeat(200), 'That formula is too long.');
    refused('1'.repeat(40), 'Check the numbers. Decimals use a point or a comma.');
    refused('('.repeat(20) + 'x' + ')'.repeat(20), 'That formula is too long.');
    refused('('.repeat(30) + 'x' + ')'.repeat(30), 'That formula is too long.');
  });

  it('resets the stepping, the text and the view', async () => {
    show('downhill-walk');
    await stage();
    expect(button('Reset')).toBeDisabled();
    fireEvent.click(button('Step downhill'));
    type('Number of steps', '3');
    fireEvent.click(button('Reset'));
    expect(document.querySelector('.lf-s2-walk .lf-s2-status')).toHaveTextContent('Step 0 of 8.');
    expect(box('Number of steps')).toHaveValue('');
    expect(button('Reset')).toBeDisabled();
  });

  it('never evaluates text as code', () => {
    const source = here('./FormulaBoard.tsx') + here('./field.generated.ts');
    for (const word of ['eval(', 'new Function', 'Function(', 'dangerouslySetInnerHTML', 'innerHTML', 'document.write']) expect(source, word).not.toContain(word);
  });

  it('speaks in Spanish and Portuguese', async () => {
    show('downhill-walk', undefined, 'es-MX');
    expect(await screen.findByRole('group', { name: 'Superficie de una fórmula' })).toBeTruthy();
    expect(button('Bajar un paso')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Número de pasos' })).toBeTruthy();
    cleanup();
    show('build-a-surface', undefined, 'pt-BR');
    expect(await screen.findByRole('group', { name: 'Superfície de uma fórmula' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Sua fórmula para z' }), { target: { value: 'x' } });
    expect(screen.getByText('Sua superfície passa por 1 de 3 pontos.')).toBeTruthy();
  });
});

describe('F4.8 globe with routes', () => {
  it('starts facing the first route origin and turns with the arrow keys, clamping at 80 degrees', async () => {
    show('nearest-route');
    const stage = await screen.findByRole('group', { name: 'Globe with routes' });
    expect(readout()).toHaveTextContent('Facing 19° N, 99° W');
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(readout()).toHaveTextContent('Facing 19° N, 69° W');
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    expect(readout()).toHaveTextContent('Facing 19° N, 129° W');
    for (let step = 0; step < 4; step += 1) fireEvent.keyDown(stage, { key: 'ArrowUp' });
    expect(readout()).toHaveTextContent('Facing 80° N');
    expect(button('Tilt north')).toBeDisabled();
    fireEvent.keyDown(stage, { key: 'ArrowDown', ctrlKey: true });
    expect(readout()).toHaveTextContent('Facing 80° N');
    fireEvent.click(button('Tilt south'));
    expect(readout()).toHaveTextContent('Facing 60° N');
  });

  it('turns with the four buttons as well', async () => {
    show('nearest-route');
    await screen.findByRole('group', { name: 'Globe with routes' });
    fireEvent.click(button('Turn east'));
    fireEvent.click(button('Tilt south'));
    expect(readout()).toHaveTextContent('Facing 1° S, 69° W');
    fireEvent.click(button('Turn west'));
    expect(readout()).toHaveTextContent('Facing 1° S, 99° W');
  });

  it('draws the land, a graticule and one great-circle arc per visible route', async () => {
    show('nearest-route');
    await screen.findByRole('group', { name: 'Globe with routes' });
    await waitFor(() => expect(document.querySelector('.lf-s2-land')).not.toBeNull());
    expect(document.querySelectorAll('.lf-s2-sea')).toHaveLength(1);
    expect(document.querySelectorAll('.lf-s2-grat')).toHaveLength(1);
    expect(document.querySelectorAll('.lf-s2-arc')).toHaveLength(4);
    expect([...document.querySelectorAll('.lf-s2-route-tag text')].map((tag) => tag.textContent)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('labels only the places on the near side of the globe', async () => {
    show('nearest-route');
    await screen.findByRole('group', { name: 'Globe with routes' });
    const labels = () => [...document.querySelectorAll('.lf-s2-stage .lf-hz-label')].map((label) => label.textContent);
    expect(labels()).toContain('Mexico City');
    expect(labels()).toContain('Houston');
    expect(labels()).not.toContain('Tokyo');
    for (let step = 0; step < 8; step += 1) fireEvent.click(button('Turn east'));
    expect(readout()).toHaveTextContent('141° E');
    expect(labels()).toContain('Tokyo');
    expect(labels()).not.toContain('Houston');
  });

  it('writes the place names as HTML over the globe, never as SVG text', async () => {
    show('nearest-route');
    await screen.findByRole('group', { name: 'Globe with routes' });
    expect(document.querySelectorAll('.lf-s2-svg text')).toHaveLength(4);
    expect([...document.querySelectorAll('.lf-s2-svg text')].every((tag) => /^[A-D]$/.test(tag.textContent ?? ''))).toBe(true);
    expect(document.querySelector('.lf-s2-stage .lf-hz-drawing')).not.toBeNull();
    expect(document.querySelector('.lf-s2-grat')).toHaveAttribute('data-board-decoration');
  });

  it('turns the globe to a route when its chip is picked', async () => {
    show('nearest-route');
    await screen.findByRole('group', { name: 'Globe with routes' });
    fireEvent.click(button(/^B: Mexico City to Houston/));
    const middle = routeCenter('mexico-city', 'houston');
    expect(readout()).toHaveTextContent(`Facing ${Math.abs(middle.lat)}° ${middle.lat >= 0 ? 'N' : 'S'}, ${Math.abs(middle.lon)}° ${middle.lon >= 0 ? 'E' : 'W'}`);
    expect(document.querySelector('.lf-s2-arc[data-chosen="true"]')).not.toBeNull();
    expect(screen.getByText('Chosen: B')).toBeTruthy();
    fireEvent.click(button(/^B: Mexico City to Houston/));
    expect(screen.getByText('Chosen: none')).toBeTruthy();
  });

  it('states the amount and each fee, and puts the numbers in a table', async () => {
    show('nearest-route');
    await screen.findByRole('group', { name: 'Globe with routes' });
    expect(screen.getByText('Amount to send: $200. Fee: rate + flat.')).toBeTruthy();
    expect(button(/^B: Mexico City to Houston 4% \+ \$3$/)).toBeTruthy();
    fireEvent.click(button('Show as table'));
    const table = screen.getByRole('table', { name: 'Routes in numbers' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    const km = distanceKm('mexico-city', 'houston').toLocaleString('en-US');
    expect(rowTexts(table)[2]).toBe(`BMexico CityHouston${km} km${money(feeCents(20000, 400, 300), 'en-US')}`);
  });

  it('chooses a route and submits only the choice, never saying met itself', async () => {
    const grade = show('cheapest-corridor');
    await screen.findByRole('group', { name: 'Globe with routes' });
    expect(readout()).toHaveTextContent('Facing 34° N, 118° W');
    expect(button('Check')).toBeDisabled();
    fireEvent.click(button(/^B: Los Angeles to Manila/));
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ choice: 'b' }, 'globe-cheapest-corridor', expect.anything()));
    expect(screen.queryByText('You compared the routes and found it.')).toBeNull();
  });

  it('resets the view and the choice', async () => {
    show('nearest-route');
    await screen.findByRole('group', { name: 'Globe with routes' });
    expect(button('Reset')).toBeDisabled();
    fireEvent.click(button(/^A:/));
    fireEvent.click(button('Turn west'));
    fireEvent.click(button('Reset'));
    expect(screen.getByText('Chosen: none')).toBeTruthy();
    expect(readout()).toHaveTextContent('Facing 19° N, 99° W');
    expect(button('Reset')).toBeDisabled();
  });

  it('speaks in Spanish and Portuguese', async () => {
    show('nearest-route', undefined, 'es-MX');
    expect(await screen.findByRole('group', { name: 'Globo con rutas' })).toBeTruthy();
    expect(readout()).toHaveTextContent('Mirando a 19° N, 99° O');
    cleanup();
    show('nearest-route', undefined, 'pt-BR');
    expect(await screen.findByRole('group', { name: 'Globo com rotas' })).toBeTruthy();
    expect(readout()).toHaveTextContent('Voltado para 19° N, 99° O');
  });
});

const arEnv = (over: Partial<ArPilotEnvironment> = {}, supported = true) => {
  const requestSession = vi.fn(async () => { throw new Error('the board must never open a session itself'); });
  const isSessionSupported = vi.fn(async () => supported);
  const xr: ArXrSystem = { isSessionSupported, requestSession };
  const ends: Array<() => void> = [];
  const end = vi.fn();
  const start = vi.fn(async ({ onEnd }: ArStartInput) => { ends.push(onEnd); return { end }; });
  const env: ArPilotEnvironment = { flag: true, consent: { learner: true, guardian: true }, age: 15, xr: () => xr, start, ...over };
  return { env, requestSession, isSessionSupported, start, ends, end };
};
const seeOnTable = () => screen.queryByRole('button', { name: 'See on table' });

describe('F4.9 AR table pilot gate', () => {
  it('is closed by default, whatever else is true', () => {
    expect(isArPilotEnabled()).toBe(false);
    expect(isArPilotEnabled({})).toBe(false);
    expect(isArPilotEnabled({ age: 30, consent: { learner: true, guardian: true } })).toBe(false);
    expect(arPilotGate({ flag: false, age: 16, consent: { learner: true, guardian: true } })).toBe('off');
    expect(defaultArPilot.flag).toBe(false);
    expect(defaultArPilot.consent).toBeNull();
  });

  it('needs the flag, an age of 13 or more and recorded consent, and a guardian for a minor', () => {
    const both = { learner: true, guardian: true };
    expect(AR_PILOT_MIN_AGE).toBe(13);
    expect(arPilotGate({ flag: true })).toBe('age');
    expect(arPilotGate({ flag: true, age: 12, consent: both })).toBe('age');
    expect(arPilotGate({ flag: true, age: null, consent: both })).toBe('age');
    expect(arPilotGate({ flag: true, age: 13 })).toBe('consent');
    expect(arPilotGate({ flag: true, age: 13, consent: { learner: false, guardian: true } })).toBe('consent');
    expect(arPilotGate({ flag: true, age: 15, consent: { learner: true, guardian: false } })).toBe('guardian');
    expect(isArPilotEnabled({ flag: true, age: 15, consent: both })).toBe(true);
    expect(arPilotGate({ flag: true, age: 17, consent: { learner: true, guardian: false } })).toBe('guardian');
    expect(isArPilotEnabled({ flag: true, age: 18, consent: { learner: true, guardian: false } })).toBe(true);
  });

  it('asks only for the AR view with hit-testing and never for pixel access', () => {
    const init = arSessionInit();
    expect(init.requiredFeatures).toEqual(['hit-test']);
    expect(init.optionalFeatures).toEqual(['local-floor']);
    expect(JSON.stringify(init)).not.toContain('camera-access');
  });

  it('keeps every AR module free of anything that could read, keep or send a frame', () => {
    const forbidden = ['getUserMedia', 'fetch(', 'sendBeacon', 'toDataURL', 'toBlob', 'localStorage', 'sessionStorage', 'indexedDB', 'MediaRecorder', 'XMLHttpRequest', 'WebSocket', 'captureStream', 'readPixels', 'camera-access', 'getImageData', 'ImageCapture'];
    for (const file of ['./ArTableBoard.tsx', './ar/arPilot.ts', './ar/arSession.ts', './ar/arAge.ts', './ar/ArLearnerAge.tsx', './ar.generated.ts']) {
      const source = here(file);
      for (const word of forbidden) expect(source, `${file} must not use ${word}`).not.toContain(word);
    }
    expect(here('./ar/arSession.ts')).not.toMatch(/from '(?!three'|\.\.?\/)/);
  });

  it('keeps the 3D renderer import inside the reserved ar folder and nowhere else in the pack', () => {
    for (const file of ['./ArTableBoard.tsx', './SurfaceBoard.tsx', './FormulaBoard.tsx', './field.generated.ts', './GlobeBoard.tsx', './TurnStage.tsx', './boards.tsx', './ar.generated.ts', './ar/arPilot.ts', './ar/arAge.ts', './ar/ArLearnerAge.tsx']) {
      expect(here(file), `${file} must not import three`).not.toMatch(/from 'three'|import\('three'\)/);
    }
    expect(here('./ar/arSession.ts')).toMatch(/from 'three'/);
  });
});

describe('F4.9 AR table pilot board', () => {
  it('shows the turnable drawing and the size table with no AR button when the pilot is closed (the default)', async () => {
    show('object-on-the-table');
    const stage = await screen.findByRole('group', { name: 'One litre box' });
    expect(screen.getByText('Ungraded')).toBeTruthy();
    expect(seeOnTable()).toBeNull();
    expect(screen.queryByText('Use your camera?')).toBeNull();
    expect(document.querySelectorAll('.lf-s2-wire-edge')).toHaveLength(12);
    expect(rowTexts(screen.getByRole('table', { name: 'Size of the object' }))).toEqual(['MeasureValue', 'Width10 cm', 'Height10 cm', 'Depth10 cm', `Volume${arVolumeMl('litre-box').toLocaleString('en-US')} mL`]);
    expect(readout()).toHaveTextContent('One litre box. Corner view. Turn 1 of 4');
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(readout()).toHaveTextContent('Corner view. Turn 2 of 4');
    expect(button('Reset')).not.toBeDisabled();
  });

  it('has no grading at all: nothing is submitted and there is no Check', async () => {
    const grade = show('object-on-the-table');
    await screen.findByRole('group', { name: 'One litre box' });
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    fireEvent.click(button('Turn right'));
    expect(grade).not.toHaveBeenCalled();
  });

  it('stays closed when the flag is on but consent is missing or a minor has no guardian consent', async () => {
    for (const consent of [null, { learner: true, guardian: false }, { learner: false, guardian: true }]) {
      const { env, isSessionSupported, start } = arEnv({ consent });
      show('object-on-the-table', undefined, 'en-US', env);
      await screen.findByRole('group', { name: 'One litre box' });
      expect(seeOnTable()).toBeNull();
      expect(isSessionSupported).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it('stays closed when the flag is off even with consent', async () => {
    const { env, isSessionSupported } = arEnv({ flag: false });
    show('object-on-the-table', undefined, 'en-US', env);
    await screen.findByRole('group', { name: 'One litre box' });
    expect(seeOnTable()).toBeNull();
    expect(isSessionSupported).not.toHaveBeenCalled();
  });

  it('uses the real learner age the app supplies, and never falls back to the lesson age when there is none', async () => {
    const adultOnly = { learner: true, guardian: false };
    const young = arEnv({ age: 12 });
    show('object-on-the-table', undefined, 'en-US', young.env);
    await screen.findByRole('group', { name: 'One litre box' });
    expect(seeOnTable()).toBeNull();
    expect(young.isSessionSupported).not.toHaveBeenCalled();
    cleanup();

    const unknown = arEnv({ age: null });
    show('object-on-the-table', undefined, 'en-US', unknown.env);
    await screen.findByRole('group', { name: 'One litre box' });
    expect(seeOnTable()).toBeNull();
    expect(unknown.isSessionSupported).not.toHaveBeenCalled();
    cleanup();

    const minor = arEnv({ consent: adultOnly, age: 15 });
    show('object-on-the-table', undefined, 'en-US', minor.env);
    await screen.findByRole('group', { name: 'One litre box' });
    expect(seeOnTable()).toBeNull();
    expect(minor.isSessionSupported).not.toHaveBeenCalled();
    cleanup();

    const adult = arEnv({ consent: adultOnly, age: 30 });
    show('object-on-the-table', undefined, 'en-US', adult.env);
    expect(await screen.findByRole('button', { name: 'See on table' })).toBeTruthy();
    expect(adult.start).not.toHaveBeenCalled();
  });

  it('falls back to the drawing with a plain message where there is no WebXR', async () => {
    const { env, start } = arEnv({ xr: () => null });
    show('object-on-the-table', undefined, 'en-US', env);
    expect(await screen.findByText('AR is not available here. Turn the object instead.')).toBeTruthy();
    expect(seeOnTable()).toBeNull();
    expect(start).not.toHaveBeenCalled();
    expect(screen.getByRole('table', { name: 'Size of the object' })).toBeTruthy();
  });

  it('falls back the same way when the browser says AR is unsupported', async () => {
    const { env, isSessionSupported } = arEnv({}, false);
    show('object-on-the-table', undefined, 'en-US', env);
    expect(await screen.findByText('AR is not available here. Turn the object instead.')).toBeTruthy();
    expect(isSessionSupported).toHaveBeenCalledWith('immersive-ar');
    expect(seeOnTable()).toBeNull();
  });

  it('asks for consent in the app first and opens nothing before the learner allows it', async () => {
    const { env, requestSession, start } = arEnv();
    show('object-on-the-table', undefined, 'en-US', env);
    fireEvent.click(await screen.findByRole('button', { name: 'See on table' }));
    expect(screen.getByText('Use your camera?')).toBeTruthy();
    expect(screen.getByText('The camera only shows your table. Nothing is saved or sent.')).toBeTruthy();
    expect(start).not.toHaveBeenCalled();
    expect(requestSession).not.toHaveBeenCalled();
  });

  it('keeps the camera closed when the learner says not now, and offers the way back in', async () => {
    const { env, requestSession, start } = arEnv();
    show('object-on-the-table', undefined, 'en-US', env);
    fireEvent.click(await screen.findByRole('button', { name: 'See on table' }));
    fireEvent.click(button('Not now'));
    expect(screen.getByText('No camera. Turn the object instead.')).toBeTruthy();
    expect(start).not.toHaveBeenCalled();
    expect(requestSession).not.toHaveBeenCalled();
    expect(screen.queryByText('Use your camera?')).toBeNull();
    fireEvent.click(button('See on table'));
    expect(screen.getByText('Use your camera?')).toBeTruthy();
  });

  it('starts the session only after Allow camera, then returns to the drawing when it ends', async () => {
    const { env, start, ends } = arEnv();
    show('object-on-the-table', undefined, 'en-US', env);
    fireEvent.click(await screen.findByRole('button', { name: 'See on table' }));
    fireEvent.click(button('Allow camera'));
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ object: 'litre-box' }));
    expect(await screen.findByText('AR is on. Leave it from your browser.')).toBeTruthy();
    act(() => ends[0]!());
    expect(screen.getByText('AR has ended. Turn the object instead.')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Size of the object' })).toBeTruthy();
  });

  it('falls back with a message when the session cannot start', async () => {
    const { env } = arEnv({ start: vi.fn(async () => { throw new Error('denied'); }) });
    show('object-on-the-table', undefined, 'en-US', env);
    fireEvent.click(await screen.findByRole('button', { name: 'See on table' }));
    fireEvent.click(button('Allow camera'));
    expect(await screen.findByText('AR could not start. Turn the object instead.')).toBeTruthy();
    expect(button('See on table')).toBeTruthy();
  });

  it('ends a running session when the board goes away', async () => {
    const { env, end } = arEnv();
    show('object-on-the-table', undefined, 'en-US', env);
    fireEvent.click(await screen.findByRole('button', { name: 'See on table' }));
    fireEvent.click(button('Allow camera'));
    await screen.findByText('AR is on. Leave it from your browser.');
    expect(end).not.toHaveBeenCalled();
    cleanup();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('speaks in Spanish and Portuguese', async () => {
    show('object-on-the-table', undefined, 'es-MX');
    expect(await screen.findByRole('group', { name: 'Caja de un litro' })).toBeTruthy();
    expect(screen.getByText('Sin calificación')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Tamaño del objeto' })).toBeTruthy();
  });
});
