import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { copyText } from '../copyText';
import { horizonteFixtureDocument } from '../previewDocument';
import { DIRECTION_OPTIONS, ERROR_OPTIONS, GROWTH_OPTIONS, SIGN_OPTIONS } from './calculus.generated';
import { COM_COPY } from './copy';
import { areaSoFar, integral, polynomial, slopeRule, trigEquation } from './notation';
import { QUADRANT_OPTIONS, TIMES_OPTIONS } from './trig.generated';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';

const show = (fixture: string, locale: Locale = 'en-US', ageBand: '10-12' | '13-17' = '10-12') => {
  const grade = vi.fn(() => ({ verdict: 'review' as const }));
  render(<LessonDocumentView raw={horizonteFixtureDocument('com', fixture, locale)} locale={locale} ageBand={ageBand} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const zone = (name: string) => screen.getByRole('group', { name });
const chip = (name: string) => screen.getByRole('button', { name });
const put = (piece: string, target: string) => { fireEvent.click(chip(piece)); fireEvent.click(zone(target)); };
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check' }));

const SLOT_CSS = ['com/slotBoard.css'];
const NETWORK_CSS = [...SLOT_CSS, 'com/NetworkBoard.css', 'plano/plano.css'];
const CIRCUITS_CSS = [...SLOT_CSS, 'com/CircuitsBoard.css'];
const EXPLORER_CSS = ['com/explorer.css', 'plano/plano.css'];

describe('com boards: the board contract', () => {
  it('network board: all four visuals in three locales', async () => {
    for (const fixtureId of ['konigsberg', 'bridge-walk', 'cheapest-route', 'team-picks', 'podium', 'pascal-evens']) {
      await assertBoardContract({ pack: 'com', fixtureId, copy: COM_COPY, css: NETWORK_CSS });
    }
    for (const fixtureId of ['cheapest-tie', 'pascal-threes']) {
      await assertBoardContract({ pack: 'com', fixtureId, copy: COM_COPY, css: NETWORK_CSS, locales: ['en-US'] });
    }
  }, 120_000);

  it('trig board: the unit circle and the circle to wave, in three locales', async () => {
    for (const fixtureId of ['unit-circle-cos', 'unit-circle-sin', 'circle-wave']) {
      await assertBoardContract({ pack: 'com', fixtureId, copy: COM_COPY, css: EXPLORER_CSS });
    }
  }, 120_000);

  it('calculus board: the four explorers in three locales', async () => {
    for (const fixtureId of ['secant-slope', 'linked-graphs', 'riemann-sums', 'area-so-far']) {
      await assertBoardContract({ pack: 'com', fixtureId, copy: COM_COPY, css: EXPLORER_CSS });
    }
  }, 120_000);

  it('circuits board: bits and gates in three locales', async () => {
    for (const fixtureId of ['bits-ten', 'bits-byte', 'gates-xor', 'gates-alarm']) {
      await assertBoardContract({ pack: 'com', fixtureId, copy: COM_COPY, css: CIRCUITS_CSS });
    }
  }, 120_000);
});


const ready = async (zoneName: string) => { await screen.findByRole('group', { name: zoneName }); };
const sent = (grade: ReturnType<typeof show>, body: unknown, fixture: string) => waitFor(() => expect(grade).toHaveBeenCalledWith(body, fixture, expect.anything()));
const tableRows = (name: RegExp | string) => within(screen.getByRole('table', { name })).getAllByRole('row').map((row) => row.textContent);

describe('network board (F2.16)', () => {
  it('marks the odd areas of the bridge map and submits the set', async () => {
    const grade = show('konigsberg');
    await ready('Odd areas');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    put('Island', 'Odd areas');
    expect(status()).toHaveTextContent('Marked 1 of 4 areas');
    put('North bank', 'Odd areas');
    put('South bank', 'Odd areas');
    put('East bank', 'Odd areas');
    expect(status()).toHaveTextContent('Marked 4 of 4 areas');
    check();
    await sent(grade, { slots: { odd: ['island', 'north', 'south', 'east'] } }, 'konigsberg');
  });

  it('shows every bridge of the map as a table, with its two ends', async () => {
    show('konigsberg');
    await ready('Odd areas');
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const rows = tableRows(/./);
    expect(rows[0]).toBe('BridgeFromTo');
    expect(rows).toHaveLength(8);
    expect(rows).toContain('Bridge 6North bankEast bank');
  });

  it('keeps the order of a walk and numbers each step', async () => {
    const grade = show('bridge-walk');
    await ready('My walk');
    for (const bridge of [1, 3, 5, 4, 2, 6]) put(`Bridge ${bridge}`, 'My walk');
    expect(status()).toHaveTextContent('6 of 6 bridges crossed');
    check();
    await sent(grade, { slots: { walk: ['bridge-1', 'bridge-3', 'bridge-5', 'bridge-4', 'bridge-2', 'bridge-6'] } }, 'bridge-walk');
  });

  it('adds up the cost of a route as the stops go down', async () => {
    const grade = show('cheapest-route');
    await ready('My route');
    put('Home', 'My route');
    put('Park', 'My route');
    expect(status()).toHaveTextContent('Route: Home, Park');
    put('Shop', 'My route');
    put('Pool', 'My route');
    put('School', 'My route');
    expect(status()).toHaveTextContent('10');
    check();
    await sent(grade, { slots: { route: ['home', 'park', 'shop', 'pool', 'school'] } }, 'cheapest-route');
  });

  it('accepts either of two routes that cost the same', async () => {
    const grade = show('cheapest-tie');
    await ready('My route');
    for (const stop of ['Camp', 'Ridge', 'Cave', 'Peak']) put(stop, 'My route');
    check();
    await sent(grade, { slots: { route: ['camp', 'ridge', 'cave', 'peak'] } }, 'cheapest-tie');
  });

  it('keeps one pair per team in the outcome tree', async () => {
    const grade = show('team-picks');
    await ready('Outcomes I keep');
    for (const pair of ['Ana, Ben', 'Ana, Cai', 'Ana, Dev', 'Ben, Cai', 'Ben, Dev', 'Cai, Dev']) put(pair, 'Outcomes I keep');
    expect(status()).toHaveTextContent('Keeping 6 of 12 outcomes');
    check();
    await sent(grade, { slots: { keep: ['ana.ben', 'ana.cai', 'ana.dev', 'ben.cai', 'ben.dev', 'cai.dev'] } }, 'team-picks');
  });

  it('moves a piece with the keyboard path: pick a chip, then Move to', async () => {
    const grade = show('podium');
    await ready('Outcomes I keep');
    fireEvent.click(chip('Ana then Ben then Cai'));
    fireEvent.click(screen.getByRole('button', { name: 'Ana then Ben then Cai: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Outcomes I keep' }));
    expect(status()).toHaveTextContent('Keeping 1 of 6 outcomes');
    put('Ana then Cai then Ben', 'Outcomes I keep');
    check();
    await sent(grade, { slots: { keep: ['ana.ben.cai', 'ana.cai.ben'] } }, 'podium');
  });

  it('takes a placed piece back to the tray and resets to the empty start', async () => {
    show('podium');
    await ready('Outcomes I keep');
    put('Ben then Ana then Cai', 'Outcomes I keep');
    expect(status()).toHaveTextContent('Keeping 1 of 6 outcomes');
    fireEvent.click(chip('Ben then Ana then Cai'));
    fireEvent.click(screen.getByRole('group', { name: 'Pieces' }));
    expect(status()).toHaveTextContent('Keeping 0 of 6 outcomes');
    put('Ben then Ana then Cai', 'Outcomes I keep');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Keeping 0 of 6 outcomes');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('colors the even numbers of Pascal triangle row by row', async () => {
    const grade = show('pascal-evens');
    await screen.findByRole('group', { name: 'Row 3' });
    const cell = (row: number, place: number, value: number) => screen.getByRole('button', { name: `Row ${row}, place ${place}: ${value}` });
    fireEvent.click(cell(3, 2, 2));
    expect(cell(3, 2, 2)).toHaveAttribute('aria-pressed', 'true');
    expect(status()).toHaveTextContent('Colored 1 of 36 numbers');
    fireEvent.click(cell(3, 2, 2));
    expect(cell(3, 2, 2)).toHaveAttribute('aria-pressed', 'false');
    for (const [row, place, value] of [[3, 2, 2], [5, 2, 4], [5, 3, 6], [5, 4, 4], [6, 3, 10]] as const) fireEvent.click(cell(row, place, value));
    expect(status()).toHaveTextContent('Colored 5 of 36 numbers');
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const rows = tableRows(/./);
    expect(rows[0]).toBe('RowNumbersMarked');
    expect(rows).toContain('51 4 6 4 14, 6, 4');
    expect(grade).not.toHaveBeenCalled();
  });

  it('walks the triangle with arrow keys and keeps one stop in the tab order', async () => {
    show('pascal-evens');
    const first = await screen.findByRole('button', { name: 'Row 1, place 1: 1' });
    expect(first).toHaveAttribute('tabindex', '0');
    const second = screen.getByRole('button', { name: 'Row 2, place 1: 1' });
    expect(second).toHaveAttribute('tabindex', '-1');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
    expect(second).toHaveAttribute('tabindex', '0');
    expect(first).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(second, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Row 2, place 2: 1' }));
  });

  it('speaks and writes the network in Spanish and Portuguese', async () => {
    show('cheapest-route', 'es-MX');
    expect(await screen.findByRole('group', { name: 'Mi ruta' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
    show('konigsberg', 'pt-BR');
    expect(await screen.findByRole('group', { name: 'Áreas ímpares' })).toBeTruthy();
  });
});

describe('circuits board (F2.18)', () => {
  it('switches bits on and shows the running total', async () => {
    const grade = show('bits-ten');
    await ready('Bits, biggest first');
    const bit = (weight: number) => screen.getByRole('button', { name: `Bit worth ${weight}` });
    expect(bit(8)).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(bit(8));
    expect(bit(8)).toHaveAttribute('aria-pressed', 'true');
    expect(status()).toHaveTextContent('Total 8 of 10');
    fireEvent.click(bit(2));
    expect(status()).toHaveTextContent('Total 10 of 10');
    check();
    await sent(grade, { slots: { 'bits-on': ['bit-8', 'bit-2'] } }, 'bits-ten');
  });

  it('switches a bit back off and shows the table of worth and state', async () => {
    show('bits-byte');
    await ready('Bits, biggest first');
    fireEvent.click(screen.getByRole('button', { name: 'Bit worth 128' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bit worth 64' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bit worth 64' }));
    expect(status()).toHaveTextContent('Total 128 of 200');
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const rows = tableRows(/./);
    expect(rows[0]).toBe('WorthBitAdds');
    expect(rows[1]).toBe('1281128');
    expect(rows[2]).toBe('6400');
  });

  it('places gates in positions and counts the rows of the table that match', async () => {
    const grade = show('gates-xor');
    await ready('Position 1');
    put('OR', 'Position 1');
    put('NAND', 'Position 2');
    expect(status()).toHaveTextContent('2 of 3 gates placed');
    put('AND', 'Position 3');
    expect(status()).toHaveTextContent('3 of 3 gates placed. 4 of 4 rows match.');
    check();
    await sent(grade, { slots: { 'pos-1': ['gate-a'], 'pos-2': ['gate-b'], 'pos-3': ['gate-c'] } }, 'gates-xor');
  });

  it('shows a wrong circuit as rows that do not match, and names what each position reads', async () => {
    show('gates-xor');
    await ready('Position 1');
    put('NOR', 'Position 1');
    put('NOR', 'Position 2');
    put('OR', 'Position 3');
    expect(status()).not.toHaveTextContent('4 of 4 rows match');
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(2);
    const wiring = within(tables[1]!).getAllByRole('row').map((row) => row.textContent);
    expect(wiring[0]).toBe('PositionReadsGate');
    expect(wiring[3]).toContain('Reads Position 1 and Position 2.');
  });

  it('moves a gate with the keyboard path', async () => {
    show('gates-alarm');
    await ready('Position 2');
    fireEvent.click(chip('NOT'));
    fireEvent.click(screen.getByRole('button', { name: 'NOT: Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Position 2' }));
    expect(status()).toHaveTextContent('1 of 3 gates placed');
  });

  it('speaks the circuit in Spanish', async () => {
    show('bits-ten', 'es-MX');
    expect(await screen.findByRole('group', { name: 'Bits, del más grande al más chico' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bit que vale 8' })).toBeTruthy();
  });
});

const radio = (name: string) => screen.getByRole('radio', { name });
const handle = (name: string) => screen.getAllByRole('slider', { name }).find((node) => node.classList.contains('lf-plano-handle')) as HTMLElement;
const press = (name: string, times: number) => { for (let i = 0; i < times; i += 1) fireEvent.click(screen.getByRole('button', { name })); };

describe('trig explorers (F2.17)', () => {
  it('asks for a prediction first, then an angle, and sends both', async () => {
    const grade = show('unit-circle-cos', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Quadrant 2' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(document.querySelector('.lf-ex-hint')).toHaveTextContent('First, choose your prediction.');
    fireEvent.click(radio('Quadrant 2'));
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    press('Angle: More', 9);
    expect(status()).toHaveTextContent('Angle 135°: cos -0.71, sin 0.71. Quadrant 2.');
    check();
    await sent(grade, { predict: 'quadrant-2', value: 135 }, 'unit-circle-cos');
  });

  it('steps the point along the circle with the arrow keys and never off it', async () => {
    show('unit-circle-sin', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Quadrant 3' });
    const point = handle('Angle');
    act(() => point.focus());
    fireEvent.keyDown(point, { key: 'ArrowRight' });
    expect(status()).toHaveTextContent('Angle 30°');
    fireEvent.keyDown(point, { key: 'ArrowUp' });
    expect(status()).toHaveTextContent('Angle 60°');
    fireEvent.keyDown(point, { key: 'ArrowLeft' });
    fireEvent.keyDown(point, { key: 'ArrowLeft' });
    fireEvent.keyDown(point, { key: 'ArrowLeft' });
    expect(status()).toHaveTextContent('Angle 330°');
    fireEvent.keyDown(point, { key: 'Home' });
    expect(status()).toHaveTextContent('Angle 0°');
    fireEvent.keyDown(point, { key: 'End' });
    expect(status()).toHaveTextContent('Angle 330°');
  });

  it('sends the prediction alone when no angle was found, and clears on Reset', async () => {
    show('circle-wave', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Twice' });
    fireEvent.click(radio('Twice'));
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
    expect(document.querySelector('.lf-ex-hint')).toBeTruthy();
    press('Angle: More', 5);
    expect(status()).toHaveTextContent('Angle 150°');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status()).toHaveTextContent('Angle 0°');
    expect(radio('Twice')).not.toBeChecked();
  });

  it('sends the wave answer', async () => {
    const grade = show('circle-wave', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Twice' });
    fireEvent.click(radio('Twice'));
    press('Angle: More', 5);
    check();
    await sent(grade, { predict: 'times-2', value: 150 }, 'circle-wave');
  });

  it('shows the circle as a table with the goal still unknown', async () => {
    show('unit-circle-cos', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Quadrant 1' });
    press('Angle: More', 2);
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const rows = tableRows(/./);
    expect(rows[0]).toBe('MomentAnglecossin');
    expect(rows[1]).toBe('Now30°0.870.5');
    expect(rows[2]).toContain('Goal');
  });

  it('writes numbers the way each locale does: a point in es-MX, a comma in pt-BR', async () => {
    show('unit-circle-cos', 'es-MX', '13-17');
    await screen.findByRole('radio', { name: 'Cuadrante 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Ángulo: Más' }));
    expect(status()).toHaveTextContent('Ángulo 15°: cos 0.97, sen 0.26. Cuadrante 1.');
    show('unit-circle-cos', 'pt-BR', '13-17');
    await screen.findByRole('radio', { name: 'Quadrante 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Ângulo: Mais' }));
    expect(document.querySelectorAll('[data-hz-text-equivalent]')[1]).toHaveTextContent('Ângulo 15°: cos 0,97, sen 0,26. Quadrante 1.');
  });
});

describe('calculus explorers (F2.17)', () => {
  it('secant: shrink the gap, type the slope and send it with the prediction', async () => {
    const grade = show('secant-slope', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Negative' });
    fireEvent.click(radio('Negative'));
    press('Gap between the two points: Smaller', 4);
    expect(status()).toHaveTextContent('gap 0.01');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('The slope, as a whole number'), { target: { value: '-3' } });
    check();
    await sent(grade, { predict: 'negative', value: -3 }, 'secant-slope');
  });

  it('secant: the table walks the gap down and the slope settles', async () => {
    show('secant-slope', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Negative' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const rows = tableRows(/./);
    expect(rows[0]).toBe('GapSlope');
    expect(rows[1]).toBe('2-7');
    expect(rows[5]).toBe('0.01-3.02');
  });

  it('secant: a typed number outside the range is not an answer', async () => {
    show('secant-slope', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Negative' });
    fireEvent.click(radio('Negative'));
    fireEvent.change(screen.getByLabelText('The slope, as a whole number'), { target: { value: '99' } });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('The slope, as a whole number'), { target: { value: '2.5' } });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('linked graphs: mark the peak of the curve with the stepper', async () => {
    const grade = show('linked-graphs', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Falls' });
    fireEvent.click(radio('Falls'));
    press('Position on x: Left', 1);
    expect(status()).toHaveTextContent('At x = -1');
    check();
    await sent(grade, { predict: 'falling', value: -1 }, 'linked-graphs');
  });

  it('linked graphs: the table pairs the curve and its slope at whole numbers', async () => {
    show('linked-graphs', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Rises' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const rows = tableRows(/./);
    expect(rows[0]).toBe('xfSlope');
    expect(rows).toHaveLength(10);
  });

  it('riemann: more rectangles bring the estimate close, then Check sends n', async () => {
    const grade = show('riemann-sums', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Too small' });
    fireEvent.click(radio('Too small'));
    press('Number of rectangles: More', 6);
    expect(status()).toHaveTextContent('n = 7');
    check();
    await sent(grade, { predict: 'too-small', value: 7 }, 'riemann-sums');
  });

  it('riemann: the table keeps the exact area beside the estimate', async () => {
    show('riemann-sums', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Too big' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const rows = tableRows(/./);
    expect(rows[0]).toBe('MomentnEstimateError');
    expect(rows[1]).toBe('Now13-9');
    expect(rows[2]).toBe('Exact-120');
  });

  it('accumulation: find the x where the area reaches the target', async () => {
    const grade = show('area-so-far', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Flat' });
    fireEvent.click(radio('Flat'));
    press('Position on x: Right', 6);
    expect(status()).toHaveTextContent('At x = 6: f is 0');
    expect(status()).toHaveTextContent('Area so far 18 of 18');
    check();
    await sent(grade, { predict: 'flat', value: 6 }, 'area-so-far');
  });

  it('accumulation: the table pairs the rate and the area so far', async () => {
    show('area-so-far', 'en-US', '13-17');
    await screen.findByRole('radio', { name: 'Flat' });
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const rows = tableRows(/./);
    expect(rows[0]).toBe('xf(x)Area so far');
    expect(rows[7]).toBe('6018');
  });

  it('locks the controls once the answer is met', async () => {
    const grade = vi.fn(() => ({ verdict: 'met' as const }));
    render(<LessonDocumentView raw={horizonteFixtureDocument('com', 'area-so-far', 'en-US')} locale="en-US" ageBand="13-17" onBack={() => {}} onGradeAny={grade} />);
    await screen.findByRole('radio', { name: 'Flat' });
    fireEvent.click(radio('Flat'));
    press('Position on x: Right', 6);
    check();
    await waitFor(() => expect(radio('Flat')).toBeDisabled());
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
  });

  it('reads the Portuguese slope rule aloud, not as symbols', async () => {
    show('linked-graphs', 'pt-BR', '13-17');
    await screen.findByRole('radio', { name: 'Desce' });
    const math = screen.getByRole('img', { name: /^f linha de x/ });
    expect(math.getAttribute('aria-label')).not.toMatch(/[()=²√]/);
  });
});

describe('spoken math and copy keys', () => {
  const words = (locale: Locale) => copyText(COM_COPY, locale);
  const SYMBOLS = /[√²³θ^/∫=()]/;

  it('writes trigonometric equations for the ear in each locale', () => {
    const en = trigEquation(words('en-US'), 'cos', 'root2', -1);
    expect(en.spoken).toBe('cosine of theta equals minus root two over two');
    expect(en.tex).toBe('\\operatorname{cos}\\,\\theta = -\\frac{\\sqrt{2}}{2}');
    const es = trigEquation(words('es-MX'), 'sin', 'half', 1);
    expect(es.spoken).toBe('seno de theta es igual a un medio');
    expect(es.plain).toBe('sen θ = 1/2');
    const pt = trigEquation(words('pt-BR'), 'sin', 'root3', -1);
    expect(pt.spoken).toBe('seno de teta é igual a menos raiz de três sobre dois');
    expect(trigEquation(words('en-US'), 'sin', 'zero', -1).plain).toBe('sin θ = 0');
  });

  it('writes a polynomial without zero terms or a one in front of x', () => {
    const en = polynomial(words('en-US'), [6, -1, 0, 0]);
    expect(en.plain).toBe('f(x) = -x + 6');
    expect(polynomial(words('en-US'), [1, 0, 1, 0]).plain).toBe('f(x) = x² + 1');
    expect(polynomial(words('en-US'), [0, 1, -2, 0]).plain).toBe('f(x) = -2x² + x');
    expect(polynomial(words('en-US'), [0, 0, 0, 0]).plain).toBe('f(x) = 0');
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      const spoken = polynomial(words(locale), [5, -3, 2, -1]).spoken;
      expect(spoken).not.toMatch(SYMBOLS);
    }
  });

  it('writes the slope rule with its two flat spots in plain sight', () => {
    const rule = slopeRule(words('en-US'), 1, [-1, 2]);
    expect(rule.plain).toBe("f'(x) = (x + 1)(x - 2)");
    expect(slopeRule(words('en-US'), -1, [0, 3]).plain).toBe("f'(x) = -x(x - 3)");
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(slopeRule(words(locale), 1, [-1, 2]).spoken).not.toMatch(SYMBOLS);
    expect(slopeRule(words('es-MX'), 1, [-1, 2]).spoken).toMatch(/^f prima de x/);
  });

  it('writes the area and the integral in words', () => {
    expect(areaSoFar(words('en-US'), 0, 18).spoken).toBe('the area so far, from 0 up to x, equals 18');
    expect(integral(words('pt-BR'), 0, 3).spoken).toBe('a integral de f de x, de x igual a 0 até x igual a 3');
    expect(integral(words('en-US'), 0, 3).tex).toBe('\\int_{0}^{3} f(x)\\,dx');
  });

  it('has a string for every key the boards build at run time, in all three locales', () => {
    const keys = [
      ...QUADRANT_OPTIONS.map((value) => `opt:${value}`), ...TIMES_OPTIONS.map((value) => `opt:${value}`),
      ...SIGN_OPTIONS.map((value) => `opt:${value}`), ...DIRECTION_OPTIONS.map((value) => `opt:${value}`),
      ...ERROR_OPTIONS.map((value) => `opt:${value}`), ...GROWTH_OPTIONS.map((value) => `opt:${value}`),
      ...['upper', 'lower', 'left', 'right'].map((value) => `side:${value}`), ...['rising', 'falling'].map((value) => `slope:${value}`),
      ...['max', 'min'].map((value) => `askLink:${value}`), ...['left', 'right', 'midpoint', 'trapezoid'].map((value) => `method:${value}`),
      ...['rising', 'falling', 'level'].map((value) => `dir:${value}`), ...['positive', 'negative', 'zero'].map((value) => `sign:${value}`),
      ...['growing', 'shrinking', 'flat'].map((value) => `rate:${value}`), ...['zero', 'half', 'root2', 'root3', 'one'].map((value) => `sayLevel:${value}`),
      ...['and', 'or', 'not', 'xor', 'nand', 'nor'].flatMap((kind) => [`gate:${kind}`, `gateNote:${kind}`]),
    ];
    const entries = COM_COPY as unknown as Record<string, Record<string, string>>;
    for (const key of keys) {
      const entry = entries[key];
      expect(entry, key).toBeDefined();
      for (const locale of ['en-US', 'es-MX', 'pt-BR']) expect(entry![locale]?.trim(), `${key} ${locale}`).toBeTruthy();
    }
  });

  it('keeps the same fill slots in every locale of every string', () => {
    const slots = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const [key, entry] of Object.entries(COM_COPY as unknown as Record<string, Record<string, string>>)) {
      expect(slots(entry['es-MX']!), `${key} es-MX`).toBe(slots(entry['en-US']!));
      expect(slots(entry['pt-BR']!), `${key} pt-BR`).toBe(slots(entry['en-US']!));
    }
  });
});
