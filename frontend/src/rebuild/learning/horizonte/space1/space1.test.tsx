import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixtureDocument } from '../previewDocument';
import { SPACE1_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'none', maxTextureSize: 0, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
type Band = '6-9' | '10-12' | '13-17';
const BANDS: Record<string, Band> = {
  'turn-the-l': '6-9', 'pick-the-turned': '10-12', 'turn-the-corner': '13-17',
  'cube-hexagon': '10-12', 'tetrahedron-square': '13-17', 'cube-edges': '10-12', 'dodecahedron-faces': '13-17', 'pyramid-third': '10-12',
  'cone-third': '13-17', 'cylinder-circle': '10-12', 'cylinder-rectangle': '13-17', 'cylinder-ellipse': '13-17',
  'truncated-icosahedron-faces': '13-17', 'cuboctahedron-edges': '13-17',
  'slide-cube-hexagon': '10-12', 'slide-tetrahedron-square': '13-17', 'slide-cylinder-ellipse': '13-17',
  'exact-basket': '6-9', 'make-the-change': '10-12', 'most-for-three': '10-12',
  'coins-as-tall-as-a-phone': '6-9', 'coins-worth-fifteen': '10-12', 'a-million-in-bills': '13-17',
};
const show = (fixture: string, grade = vi.fn(() => ({ verdict: 'review' as const })), locale: Locale = 'en-US') => {
  render(<LessonDocumentView raw={horizonteFixtureDocument('space1', fixture, locale)} locale={locale} ageBand={BANDS[fixture]!} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const css = ['space1/space1.css'];
const readout = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const rowTexts = (table: HTMLElement) => within(table).getAllByRole('row').map((row) => row.textContent);
const slider = (name: string) => screen.getByRole('slider', { name });
const moveTo = async (label: string, option: string) => {
  fireEvent.click(button(label));
  fireEvent.click(await screen.findByRole('menuitem', { name: option }));
};

describe('space1 board contract', () => {
  it('meets the board contract for the rotation board', async () => {
    await assertBoardContract({ pack: 'space1', fixtureId: 'turn-the-l', copy: SPACE1_COPY, css });
    await assertBoardContract({ pack: 'space1', fixtureId: 'pick-the-turned', copy: SPACE1_COPY, css, locales: ['en-US'] });
    await assertBoardContract({ pack: 'space1', fixtureId: 'turn-the-corner', copy: SPACE1_COPY, css, locales: ['en-US'] });
  }, 60_000);

  it('meets the board contract for the section board in all three modes', async () => {
    await assertBoardContract({ pack: 'space1', fixtureId: 'cube-hexagon', copy: SPACE1_COPY, css });
    await assertBoardContract({ pack: 'space1', fixtureId: 'tetrahedron-square', copy: SPACE1_COPY, css, locales: ['en-US'] });
    await assertBoardContract({ pack: 'space1', fixtureId: 'cube-edges', copy: SPACE1_COPY, css });
    await assertBoardContract({ pack: 'space1', fixtureId: 'dodecahedron-faces', copy: SPACE1_COPY, css, locales: ['en-US'] });
    await assertBoardContract({ pack: 'space1', fixtureId: 'pyramid-third', copy: SPACE1_COPY, css });
  }, 60_000);

  it('meets the board contract for the cone, the cylinder and the Archimedean solids', async () => {
    await assertBoardContract({ pack: 'space1', fixtureId: 'cone-third', copy: SPACE1_COPY, css });
    await assertBoardContract({ pack: 'space1', fixtureId: 'cylinder-circle', copy: SPACE1_COPY, css, locales: ['en-US'] });
    await assertBoardContract({ pack: 'space1', fixtureId: 'cylinder-rectangle', copy: SPACE1_COPY, css, locales: ['en-US'] });
    await assertBoardContract({ pack: 'space1', fixtureId: 'cylinder-ellipse', copy: SPACE1_COPY, css, locales: ['en-US'] });
    await assertBoardContract({ pack: 'space1', fixtureId: 'truncated-icosahedron-faces', copy: SPACE1_COPY, css });
    await assertBoardContract({ pack: 'space1', fixtureId: 'cuboctahedron-edges', copy: SPACE1_COPY, css, locales: ['en-US'] });
  }, 60_000);

  it('meets the board contract for the sliding plane', async () => {
    await assertBoardContract({ pack: 'space1', fixtureId: 'slide-cube-hexagon', copy: SPACE1_COPY, css });
    await assertBoardContract({ pack: 'space1', fixtureId: 'slide-tetrahedron-square', copy: SPACE1_COPY, css, locales: ['en-US'] });
    await assertBoardContract({ pack: 'space1', fixtureId: 'slide-cylinder-ellipse', copy: SPACE1_COPY, css, locales: ['en-US'] });
  }, 60_000);

  it('meets the board contract for the stall board', async () => {
    await assertBoardContract({ pack: 'space1', fixtureId: 'exact-basket', copy: SPACE1_COPY, css });
    await assertBoardContract({ pack: 'space1', fixtureId: 'make-the-change', copy: SPACE1_COPY, css, locales: ['en-US'] });
    await assertBoardContract({ pack: 'space1', fixtureId: 'most-for-three', copy: SPACE1_COPY, css, locales: ['en-US'] });
  }, 60_000);

  it('meets the board contract for the coin board', async () => {
    await assertBoardContract({ pack: 'space1', fixtureId: 'coins-as-tall-as-a-phone', copy: SPACE1_COPY, css });
    await assertBoardContract({ pack: 'space1', fixtureId: 'coins-worth-fifteen', copy: SPACE1_COPY, css, locales: ['en-US'] });
    await assertBoardContract({ pack: 'space1', fixtureId: 'a-million-in-bills', copy: SPACE1_COPY, css, locales: ['en-US'] });
  }, 60_000);

  it('keeps every string in three locales', () => {
    for (const [key, entry] of Object.entries(SPACE1_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
  });
});

describe('F4.4 mental rotation', () => {
  it('turns the figure on the dial with the arrow keys, stopping at the ends', async () => {
    show('turn-the-l');
    const dial = await screen.findByRole('slider', { name: 'Clockwise turn' });
    expect(dial).toHaveAttribute('aria-valuenow', '0');
    fireEvent.keyDown(dial, { key: 'ArrowRight' });
    expect(dial).toHaveAttribute('aria-valuenow', '90');
    expect(readout()).toHaveTextContent('Turn: 90 degrees. Shape picked: none.');
    fireEvent.keyDown(dial, { key: 'End' });
    expect(dial).toHaveAttribute('aria-valuenow', '270');
    fireEvent.keyDown(dial, { key: 'ArrowRight' });
    expect(dial).toHaveAttribute('aria-valuenow', '270');
    fireEvent.keyDown(dial, { key: 'Home' });
    expect(dial).toHaveAttribute('aria-valuenow', '0');
    fireEvent.keyDown(dial, { key: 'ArrowLeft' });
    expect(dial).toHaveAttribute('aria-valuenow', '0');
  });

  it('sets the turn from the Move to menu as well', async () => {
    show('turn-the-l');
    await screen.findByRole('slider', { name: 'Clockwise turn' });
    await moveTo('Clockwise turn: Move to', '180 degrees');
    expect(slider('Clockwise turn')).toHaveAttribute('aria-valuenow', '180');
  });

  it('needs a shape and a turn, submits both, and never says met itself', async () => {
    const grade = show('turn-the-l');
    await screen.findByRole('slider', { name: 'Clockwise turn' });
    expect(button('Check')).toBeDisabled();
    fireEvent.click(button('Shape A, 4 cubes'));
    expect(button('Check')).toBeDisabled();
    fireEvent.keyDown(slider('Clockwise turn'), { key: 'ArrowRight' });
    expect(button('Check')).toBeEnabled();
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ pick: 'a', angle: 90 }, 'rotation-turn-the-l', expect.anything()));
    expect(screen.queryByText('You turned the figure to the matching shape.')).toBeNull();
  });

  it('lists the figure, the turned figure and every shape in a table', async () => {
    show('pick-the-turned');
    await screen.findByRole('slider', { name: 'Clockwise turn' });
    fireEvent.click(button('Show as table'));
    const rows = rowTexts(screen.getByRole('table', { name: 'Where the cubes are' }));
    expect(rows).toHaveLength(1 + 2 + 3);
    expect(rows[1]).toContain('Your figure5');
    expect(rows[3]).toContain('Shape A5');
    fireEvent.keyDown(slider('Clockwise turn'), { key: 'ArrowRight' });
    expect(rowTexts(screen.getByRole('table', { name: 'Where the cubes are' }))[2]).toContain('Figure after the turn5');
  });

  it('clears the pick and the turn on reset', async () => {
    show('turn-the-l');
    await screen.findByRole('slider', { name: 'Clockwise turn' });
    expect(button('Reset')).toBeDisabled();
    fireEvent.click(button('Shape A, 4 cubes'));
    fireEvent.keyDown(slider('Clockwise turn'), { key: 'ArrowRight' });
    fireEvent.click(button('Reset'));
    expect(slider('Clockwise turn')).toHaveAttribute('aria-valuenow', '0');
    expect(readout()).toHaveTextContent('Shape picked: none');
  });

  it('speaks in Spanish and Portuguese', async () => {
    show('turn-the-l', undefined, 'es-MX');
    expect(await screen.findByRole('slider', { name: 'Giro horario' })).toBeTruthy();
    expect(button('Mostrar como tabla')).toBeTruthy();
  });
});

describe('F4.5 sections, Euler and volume', () => {
  it('turns the cube in twelve fixed views and reads the cut back', async () => {
    show('cube-hexagon');
    const stage = await screen.findByRole('group', { name: 'Cube' });
    expect(document.querySelectorAll('.lf-poly-cut-edge').length).toBeGreaterThanOrEqual(3);
    expect(readout()).toHaveTextContent('The plane crosses 6 edges.');
    expect(screen.getByText('Corner view. Turn 1 of 4', { exact: false })).toBeTruthy();
    fireEvent.keyDown(stage, { key: 'ArrowUp' });
    expect(screen.getByText(/Top view/)).toBeTruthy();
    expect(button('Look higher')).toBeDisabled();
    fireEvent.click(button('Turn right'));
    expect(screen.getByText(/Top view. Turn 2 of 4/)).toBeTruthy();
  });

  it('chooses the shape of the cut and submits it', async () => {
    const grade = show('cube-hexagon');
    await screen.findByRole('group', { name: 'Cube' });
    expect(button('Check')).toBeDisabled();
    fireEvent.click(button('Hexagon'));
    expect(readout()).toHaveTextContent('Chosen: Hexagon');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ pick: 'hexagon' }, 'section-cube-hexagon', expect.anything()));
    expect(screen.queryByText('You named the shape of the cut.')).toBeNull();
  });

  it('shows the facts of the plane as a table', async () => {
    show('cube-hexagon');
    await screen.findByRole('group', { name: 'Cube' });
    fireEvent.click(button('Show as table'));
    const rows = rowTexts(screen.getByRole('table', { name: 'What the plane crosses' }));
    expect(rows).toEqual(['FactCount', 'Edges it crosses6', 'Corners it touches0', 'Corners on one side4', 'Corners on the other side4']);
  });

  it('hides the asked count everywhere it could be read, and submits the typed number', async () => {
    const grade = show('cube-edges');
    await screen.findByRole('group', { name: 'Cube' });
    expect(readout()).toHaveTextContent('Cube. Vertices: 8. Edges: ?. Faces: 6.');
    expect(document.body.textContent).not.toMatch(/Edges:\s*12/);
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'Counts of the solid' }))).toEqual(['FactCount', 'Vertices8', 'Edges?', 'Faces6', 'V - E + F2']);
    expect(button('Check')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Number of edges'), { target: { value: '12' } });
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '12' }, 'euler-cube-edges', expect.anything()));
    expect(screen.queryByText('You found the missing count.')).toBeNull();
  });

  it('writes the rule with a spoken form', async () => {
    show('dodecahedron-faces');
    await screen.findByRole('group', { name: 'Dodecahedron' });
    expect(screen.getByRole('img', { name: 'V minus E plus F equals 2' })).toBeTruthy();
    expect(screen.getByLabelText('Number of faces')).toBeTruthy();
  });

  it('draws the pyramid inside its prism and asks for the volume', async () => {
    const grade = show('pyramid-third');
    await screen.findByRole('group', { name: 'Pyramid inside a prism' });
    expect(readout()).toHaveTextContent('Base side 6, height 5. Prism: 180 cubic units.');
    expect(document.querySelectorAll('.lf-poly-edge[data-tone="frame"]').length).toBe(12);
    fireEvent.change(screen.getByLabelText('Volume of the pyramid, in cubic units'), { target: { value: '60' } });
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '60' }, 'volume-pyramid-third', expect.anything()));
  });

  it('resets the view, the pick and the typed number', async () => {
    show('cube-hexagon');
    await screen.findByRole('group', { name: 'Cube' });
    expect(button('Reset')).toBeDisabled();
    fireEvent.click(button('Hexagon'));
    fireEvent.click(button('Turn left'));
    fireEvent.click(button('Reset'));
    expect(readout()).toHaveTextContent('Chosen: none');
    expect(button('Reset')).toBeDisabled();
  });
});

describe('F4.5 completion: the cone, the cylinder and the Archimedean solids', () => {
  it('draws the cone inside its cylinder and asks for the volume in pi', async () => {
    const grade = show('cone-third');
    await screen.findByRole('group', { name: 'Cone inside a cylinder' });
    expect(readout()).toHaveTextContent('Radius 3, height 4. Cylinder: 36 pi cubic units.');
    expect(readout().textContent).not.toContain('12');
    expect(document.querySelectorAll('.lf-poly-edge[data-tone="frame"]').length).toBeGreaterThan(0);
    expect(document.querySelector('.lf-poly-face')).toHaveAttribute('data-curved', 'true');
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'The two solids' }))).toEqual(['FactValue', 'Radius3', 'Height4', 'Volume of the cylinder, in pi36']);
    expect(button('Check')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Volume of the cone, as a number of pi cubic units'), { target: { value: '12' } });
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '12' }, 'volume-cone-third', expect.anything()));
    expect(screen.queryByText('You found the volume of the cone.')).toBeNull();
  });

  it('describes a cylinder cut by its direction, not by its shape', async () => {
    const grade = show('cylinder-circle');
    await screen.findByRole('group', { name: 'Cylinder' });
    expect(readout()).toHaveTextContent('The plane lies across the cylinder, level with its flat ends. Chosen: none');
    expect(readout().textContent).not.toMatch(/circle/i);
    expect(document.querySelector('.lf-poly-face')).toHaveAttribute('data-curved', 'true');
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'What the plane crosses' }))).toEqual([
      'FactValue', 'Radius, height1, 3', 'Plane direction (x, y, z)0, 1, 0', 'Plane position1',
    ]);
    fireEvent.click(button('Circle'));
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ pick: 'circle' }, 'section-cylinder-circle', expect.anything()));
  });

  it('reads a cut along the axis of the cylinder', async () => {
    show('cylinder-rectangle');
    await screen.findByRole('group', { name: 'Cylinder' });
    expect(readout()).toHaveTextContent('The plane runs along the cylinder’s axis.');
    expect(readout().textContent).not.toMatch(/rectangle/i);
  });

  it('reads a slanted cut of the cylinder', async () => {
    show('cylinder-ellipse');
    await screen.findByRole('group', { name: 'Cylinder' });
    expect(readout()).toHaveTextContent('The plane is slanted across the cylinder.');
    expect(readout().textContent).not.toMatch(/ellipse/i);
  });

  it('hides the faces of a truncated icosahedron everywhere and accepts the count up to 90', async () => {
    const grade = show('truncated-icosahedron-faces');
    await screen.findByRole('group', { name: 'Truncated icosahedron' });
    expect(readout()).toHaveTextContent('Truncated icosahedron. Vertices: 60. Edges: 90. Faces: ?.');
    expect(document.body.textContent).not.toMatch(/Faces:\s*32/);
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'Counts of the solid' }))).toEqual(['FactCount', 'Vertices60', 'Edges90', 'Faces?', 'V - E + F2']);
    fireEvent.change(screen.getByLabelText('Number of faces'), { target: { value: '91' } });
    expect(button('Check')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Number of faces'), { target: { value: '32' } });
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '32' }, 'euler-truncated-icosahedron-faces', expect.anything()));
  });

  it('keeps the Platonic solids at 30', async () => {
    show('cube-edges');
    await screen.findByRole('group', { name: 'Cube' });
    fireEvent.change(screen.getByLabelText('Number of edges'), { target: { value: '31' } });
    expect(button('Check')).toBeDisabled();
  });

  it('counts the edges of the cuboctahedron', async () => {
    const grade = show('cuboctahedron-edges');
    await screen.findByRole('group', { name: 'Cuboctahedron' });
    expect(readout()).toHaveTextContent('Cuboctahedron. Vertices: 12. Edges: ?. Faces: 14.');
    fireEvent.change(screen.getByLabelText('Number of edges'), { target: { value: '24' } });
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '24' }, 'euler-cuboctahedron-edges', expect.anything()));
  });
});

describe('F4.5 completion: the plane the learner slides', () => {
  const position = () => slider('Position of the plane');
  const press = (key: string) => fireEvent.keyDown(position(), { key });

  it('moves the plane with the arrow keys, by pages, to the ends, and never past them', async () => {
    show('slide-cube-hexagon');
    await screen.findByRole('slider', { name: 'Position of the plane' });
    expect(position()).toHaveAttribute('aria-valuenow', '10');
    const min = Number(position().getAttribute('aria-valuemin'));
    const max = Number(position().getAttribute('aria-valuemax'));
    expect(min).toBeLessThan(0);
    expect(max).toBeGreaterThan(11);
    press('ArrowLeft');
    expect(position()).toHaveAttribute('aria-valuenow', '9');
    press('ArrowRight');
    press('ArrowRight');
    expect(position()).toHaveAttribute('aria-valuenow', '11');
    press('PageDown');
    expect(position()).toHaveAttribute('aria-valuenow', '7');
    press('PageUp');
    expect(position()).toHaveAttribute('aria-valuenow', '11');
    press('End');
    expect(position()).toHaveAttribute('aria-valuenow', String(max));
    press('ArrowRight');
    press('PageUp');
    expect(position()).toHaveAttribute('aria-valuenow', String(max));
    press('Home');
    expect(position()).toHaveAttribute('aria-valuenow', String(min));
    press('ArrowLeft');
    expect(position()).toHaveAttribute('aria-valuenow', String(min));
  });

  it('reads the cut back at every position and never names the shape', async () => {
    show('slide-cube-hexagon');
    await screen.findByRole('slider', { name: 'Position of the plane' });
    expect(screen.getByText('Slide the plane to make this cut: Hexagon.')).toBeTruthy();
    expect(readout()).toHaveTextContent('Plane at position 10. The cut has 3 sides.');
    await moveTo('Position of the plane: Move to', 'Position 0');
    expect(position()).toHaveAttribute('aria-valuenow', '0');
    expect(readout()).toHaveTextContent('Plane at position 0. The cut has 6 sides.');
    expect(readout().textContent).not.toMatch(/hexagon/i);
    press('End');
    expect(readout()).toHaveTextContent('The plane does not cut through the solid.');
    expect(document.querySelector('.lf-poly-sheet')).toBeTruthy();
  });

  it('moves the plane with the back and forward buttons', async () => {
    show('slide-cube-hexagon');
    await screen.findByRole('slider', { name: 'Position of the plane' });
    fireEvent.click(button('Plane back'));
    expect(position()).toHaveAttribute('aria-valuenow', '9');
    fireEvent.click(button('Plane forward'));
    fireEvent.click(button('Plane forward'));
    expect(position()).toHaveAttribute('aria-valuenow', '11');
  });

  it('lists every position and the cut it makes in a table', async () => {
    show('slide-cube-hexagon');
    await screen.findByRole('slider', { name: 'Position of the plane' });
    fireEvent.click(button('Show as table'));
    const table = screen.getByRole('table', { name: 'Where the plane can sit' });
    const rows = rowTexts(table);
    const span = Number(position().getAttribute('aria-valuemax')) - Number(position().getAttribute('aria-valuemin')) + 1;
    expect(rows).toHaveLength(1 + span);
    expect(rows[0]).toBe('PositionThe cut');
    expect(rows).toContain('Position 0The cut has 6 sides.');
    expect(table.textContent).not.toMatch(/hexagon/i);
    expect(within(table).getByRole('row', { name: /Position 10/ })).toHaveAttribute('aria-current', 'true');
  });

  it('needs the plane moved off its start, submits the position, and never says met itself', async () => {
    const grade = show('slide-cube-hexagon');
    await screen.findByRole('slider', { name: 'Position of the plane' });
    expect(button('Check')).toBeDisabled();
    press('ArrowLeft');
    expect(button('Check')).toBeEnabled();
    press('ArrowRight');
    expect(button('Check')).toBeDisabled();
    await moveTo('Position of the plane: Move to', 'Position 0');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ offset: 0 }, 'slide-cube-hexagon', expect.anything()));
    expect(screen.queryByText('You slid the plane to the right cut.')).toBeNull();
  });

  it('puts the plane back at its start on reset', async () => {
    show('slide-cube-hexagon');
    await screen.findByRole('slider', { name: 'Position of the plane' });
    expect(button('Reset')).toBeDisabled();
    press('PageDown');
    expect(button('Reset')).toBeEnabled();
    fireEvent.click(button('Reset'));
    expect(position()).toHaveAttribute('aria-valuenow', '10');
    expect(button('Reset')).toBeDisabled();
  });

  it('says how the four sides of a cut relate, so a square and a rectangle read differently', async () => {
    const grade = show('slide-tetrahedron-square');
    await screen.findByRole('slider', { name: 'Position of the plane' });
    expect(position()).toHaveAttribute('aria-valuenow', '3');
    expect(readout()).toHaveTextContent('Plane at position 3. The cut has 4 sides. Pairs of parallel sides: 2. All sides equal: no. All angles right: yes.');
    await moveTo('Position of the plane: Move to', 'Position 0');
    expect(readout()).toHaveTextContent('Plane at position 0. The cut has 4 sides. Pairs of parallel sides: 2. All sides equal: yes. All angles right: yes.');
    expect(readout().textContent).not.toMatch(/square/i);
    // A readout of counts and yes/no facts is data; it is not a sentence of instruction, so it is not measured as body.
    expect(readout().querySelector('[data-copy-role="body"]')).toBeNull();
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ offset: 0 }, 'slide-tetrahedron-square', expect.anything()));
  });

  it('slides a plane through the cylinder and describes the cut by its direction', async () => {
    const grade = show('slide-cylinder-ellipse');
    await screen.findByRole('slider', { name: 'Position of the plane' });
    expect(readout()).toHaveTextContent('Plane at position 14. The cut runs into a flat end.');
    await moveTo('Position of the plane: Move to', 'Position 0');
    expect(readout()).toHaveTextContent('Plane at position 0. The plane is slanted across the cylinder.');
    expect(readout().textContent).not.toMatch(/ellipse/i);
    // The words that describe the cut are a fixed sentence, measured as body inside the data readout.
    expect([...readout().querySelectorAll('[data-copy-role="body"]')].map((node) => node.textContent)).toEqual(['The plane is slanted across the cylinder.']);
    expect(document.querySelector('.lf-poly-face')).toHaveAttribute('data-curved', 'true');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ offset: 0 }, 'slide-cylinder-ellipse', expect.anything()));
  });

  it('speaks in Spanish and Portuguese', async () => {
    show('slide-cube-hexagon', undefined, 'es-MX');
    expect(await screen.findByRole('slider', { name: 'Posición del plano' })).toBeTruthy();
    expect(button('Mostrar como tabla')).toBeTruthy();
    expect(readout()).toHaveTextContent('Plano en la posición 10. El corte tiene 3 lados.');
  });
});

describe('F4.6 market stall', () => {
  const shelfChip = (name: string) => button(new RegExp(`^${name} \\$`));

  it('fills the basket with tap then tap, and shows the cost bar and the table', async () => {
    show('exact-basket');
    await screen.findByRole('group', { name: 'Your basket' });
    expect(screen.getByText('Goal: $2.50')).toBeTruthy();
    expect(readout()).toHaveTextContent('Items: 0. Cost: $0.00');
    fireEvent.click(shelfChip('Apple'));
    fireEvent.click(screen.getByRole('group', { name: 'Your basket' }));
    expect(readout()).toHaveTextContent('Items: 1. Cost: $0.50');
    expect(screen.getByRole('img', { name: /Basket cost bar. Items: 1/ })).toBeTruthy();
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'Items and prices' }))).toContain('Total1$0.50');
  });

  it('places with the Move to menu and takes one back with Remove', async () => {
    show('exact-basket');
    await screen.findByRole('group', { name: 'Your basket' });
    expect(button('Move to')).toBeDisabled();
    fireEvent.click(shelfChip('Bread'));
    await moveTo('Bread: Move to', 'Your basket');
    expect(readout()).toHaveTextContent('Items: 1. Cost: $1.20');
    fireEvent.click(button('Remove one: Bread'));
    expect(readout()).toHaveTextContent('Items: 0. Cost: $0.00');
    expect(screen.queryByRole('button', { name: 'Remove one: Bread' })).toBeNull();
  });

  it('stops at the stock of an item', async () => {
    show('exact-basket');
    await screen.findByRole('group', { name: 'Your basket' });
    for (let take = 0; take < 4; take++) {
      fireEvent.click(shelfChip('Bread'));
      fireEvent.click(screen.getByRole('group', { name: 'Your basket' }));
    }
    expect(readout()).toHaveTextContent('Items: 3. Cost: $3.60');
    expect(screen.getByText('0 left')).toBeTruthy();
  });

  it('submits the basket as slots and never says met itself', async () => {
    const grade = show('exact-basket');
    await screen.findByRole('group', { name: 'Your basket' });
    expect(button('Check')).toBeDisabled();
    for (const name of ['Apple', 'Bread', 'Juice']) {
      fireEvent.click(shelfChip(name));
      fireEvent.click(screen.getByRole('group', { name: 'Your basket' }));
    }
    expect(readout()).toHaveTextContent('Items: 3. Cost: $2.50');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ slots: { apple: ['item'], bread: ['item'], juice: ['item'] } }, 'stall-exact-basket', expect.anything()));
    expect(screen.queryByText('Your basket meets the goal.')).toBeNull();
  });

  it('marks only what is paid on a change goal and reads the change', async () => {
    show('make-the-change');
    await screen.findByRole('group', { name: 'Your basket' });
    expect(screen.getByText('You pay: $10. Change wanted: $2')).toBeTruthy();
    expect(document.querySelector('.lf-stl-drawing .lf-hz-label')).toHaveTextContent('You pay');
    fireEvent.click(shelfChip('Pen'));
    fireEvent.click(screen.getByRole('group', { name: 'Your basket' }));
    expect(readout()).toHaveTextContent('Items: 1. Cost: $1.50. Change: $8.50');
    expect(readout().textContent).not.toContain('$8.00');
  });

  it('warns in words when the basket goes over the budget', async () => {
    show('most-for-three');
    await screen.findByRole('group', { name: 'Your basket' });
    for (let take = 0; take < 2; take++) {
      fireEvent.click(shelfChip('Toy'));
      fireEvent.click(screen.getByRole('group', { name: 'Your basket' }));
    }
    expect(readout()).toHaveTextContent('Items: 2. Cost: $5.00. Over by $2.00');
    expect(document.querySelector('.lf-stl-fill')).toHaveAttribute('data-over', 'true');
  });

  it('names the next step only while an item is picked up, and writes no word in the bar', async () => {
    show('exact-basket');
    await screen.findByRole('group', { name: 'Your basket' });
    expect(screen.queryByText('Now tap the basket.')).toBeNull();
    fireEvent.click(shelfChip('Apple'));
    expect(screen.getByText('Now tap the basket.')).toBeTruthy();
    fireEvent.click(screen.getByRole('group', { name: 'Your basket' }));
    expect(screen.queryByText('Now tap the basket.')).toBeNull();
    expect(document.querySelector('.lf-stl-bar text')).toBeNull();
    expect(document.querySelector('.lf-stl-drawing .lf-hz-label')).toHaveTextContent('Goal');
  });

  it('clears the basket on reset', async () => {
    show('exact-basket');
    await screen.findByRole('group', { name: 'Your basket' });
    expect(button('Reset')).toBeDisabled();
    fireEvent.click(shelfChip('Apple'));
    fireEvent.click(screen.getByRole('group', { name: 'Your basket' }));
    fireEvent.click(button('Reset'));
    expect(readout()).toHaveTextContent('Items: 0. Cost: $0.00');
  });

  it('speaks in Spanish and Portuguese', async () => {
    show('exact-basket', undefined, 'pt-BR');
    expect(await screen.findByRole('group', { name: 'Sua cesta' })).toBeTruthy();
    expect(button('Mostrar como tabela')).toBeTruthy();
  });
});

describe('F4.6 coin stack', () => {
  it('moves the handle one stop at a time and reads the stack back', async () => {
    show('coins-as-tall-as-a-phone');
    const handle = await screen.findByRole('slider', { name: 'Number of coins' });
    expect(handle).toHaveAttribute('aria-valuenow', '0');
    for (let press = 0; press < 4; press++) fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle).toHaveAttribute('aria-valuenow', '4');
    expect(readout()).toHaveTextContent('4 coins: worth $4, 8 mm tall.');
    fireEvent.keyDown(handle, { key: 'End' });
    expect(handle).toHaveAttribute('aria-valuenow', '10');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle).toHaveAttribute('aria-valuenow', '10');
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(handle).toHaveAttribute('aria-valuenow', '0');
    expect(document.querySelectorAll('.lf-coin-piece')).toHaveLength(0);
  });

  it('draws each coin of a short stack and one block for a tall one', async () => {
    show('coins-as-tall-as-a-phone');
    const handle = await screen.findByRole('slider', { name: 'Number of coins' });
    for (let press = 0; press < 3; press++) fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(document.querySelectorAll('.lf-coin-piece')).toHaveLength(3);
    expect(document.querySelector('.lf-coin-goal line')).not.toBeNull();
    expect(document.querySelector('.lf-coin-drawing')).toHaveTextContent('Goal');
    expect(document.querySelector('.lf-coin-drawing')).toHaveTextContent('Phone 8 mm');
  });

  it('sets the count from the Move to menu', async () => {
    show('coins-worth-fifteen');
    await screen.findByRole('slider', { name: 'Number of coins' });
    await moveTo('Number of coins: Move to', '15');
    expect(slider('Number of coins')).toHaveAttribute('aria-valuenow', '15');
    expect(readout()).toHaveTextContent('15 coins: worth $15, 30 mm tall.');
  });

  it('submits the count and never says met itself', async () => {
    const grade = show('coins-as-tall-as-a-phone');
    const handle = await screen.findByRole('slider', { name: 'Number of coins' });
    expect(button('Check')).toBeDisabled();
    for (let press = 0; press < 4; press++) fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '4' }, 'coins-as-tall-as-a-phone', expect.anything()));
    expect(screen.queryByText('You built the right stack.')).toBeNull();
  });

  it('writes the reference heights as words over the drawing, not in the SVG', async () => {
    show('coins-worth-fifteen');
    await screen.findByRole('slider', { name: 'Number of coins' });
    expect(document.querySelector('.lf-coin-scene text')).toBeNull();
    const words = [...document.querySelectorAll('.lf-coin-drawing .lf-hz-label')].map((label) => label.textContent);
    expect(words).toEqual(['Phone 8 mm', 'Book 30 mm']);
  });

  it('lists the stacks you can build and the heights to compare', async () => {
    show('coins-as-tall-as-a-phone');
    await screen.findByRole('slider', { name: 'Number of coins' });
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'Stacks you can build' }))).toHaveLength(1 + 11);
    const heights = rowTexts(screen.getByRole('table', { name: 'Heights to compare' }));
    expect(heights[0]).toBe('ObjectHeight');
    expect(heights.length).toBeGreaterThan(3);
  });

  it('shows a million in bills as a height in meters, drawn as one block', async () => {
    show('a-million-in-bills');
    const handle = await screen.findByRole('slider', { name: 'Number of bills' });
    fireEvent.keyDown(handle, { key: 'End' });
    expect(handle).toHaveAttribute('aria-valuenow', '12000');
    expect(readout()).toHaveTextContent('12,000 bills: worth $1,200,000, 1.2 m tall.');
    expect(document.querySelectorAll('.lf-coin-piece')).toHaveLength(1);
  });

  it('speaks in Spanish and Portuguese', async () => {
    show('coins-as-tall-as-a-phone', undefined, 'es-MX');
    expect(await screen.findByRole('slider', { name: 'Cantidad de monedas' })).toBeTruthy();
  });
});

describe('space1 on a narrow screen and on the dark ground', () => {
  const stylesheet = () => readFileSync(resolve(__dirname, 'space1.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('sets no text or mark in the constant ink, a literal colour or a keyword colour, none of which flip on the dark ground', () => {
    expect(stylesheet()).not.toMatch(/var\(--ink\b|#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|(?<![-\w])(white|black)(?![-\w])/);
  });

  it('sizes nothing in the board stylesheet to a fixed width of 300 px or more', () => {
    expect(stylesheet()).not.toMatch(/(?:inline-size|min-inline-size|width|min-width)\s*:\s*\d{3,}px/);
  });

  it('lets a board shrink inside the slot and scroll a wide table inside its own region', () => {
    const css = stylesheet();
    expect(css).toMatch(/\.lf-sp-scroll\s*\{[^}]*min-inline-size:\s*0[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/\.lf-stl[^{]*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it.each([
    ['exact-basket', 'Items and prices', 'Show as table'],
    ['coins-as-tall-as-a-phone', 'Stacks you can build', 'Show as table'],
    ['cube-hexagon', null, 'Show as table'],
  ])('keeps the table of %s inside a focusable scrolling region', async (fixture, caption, toggle) => {
    show(fixture);
    await waitFor(() => button(toggle));
    fireEvent.click(button(toggle));
    const table = caption === null ? screen.getAllByRole('table')[0]! : screen.getByRole('table', { name: caption });
    const region = table.closest('.lf-sp-scroll') as HTMLElement | null;
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('role', 'region');
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region!.getAttribute('aria-label')).toBeTruthy();
  });
});
