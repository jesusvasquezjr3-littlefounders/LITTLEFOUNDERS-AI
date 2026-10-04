import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixtureDocument } from '../previewDocument';
import { SOLIDS_COPY } from './copy';
import { describeSolid } from './model.generated';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'none', maxTextureSize: 0, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const BANDS: Record<string, '6-9' | '10-12'> = {
  'which-has-no-vertices': '6-9', 'nine-edges': '10-12', 'name-the-faces': '6-9', 'finish-the-net': '10-12', staircase: '10-12', 'two-by-two': '6-9',
  'area-of-the-cube': '6-9', 'name-the-box': '10-12', 'name-the-prism': '10-12', 'name-the-pyramid': '6-9',
  'finish-the-box-net': '10-12', 'finish-the-prism-net': '10-12', 'finish-the-pyramid-net': '10-12',
  'area-of-the-box': '10-12', 'area-of-the-prism': '10-12', 'area-of-the-pyramid': '10-12',
};
const show = (fixture: string, grade = vi.fn(() => ({ verdict: 'review' as const })), locale: Locale = 'en-US') => {
  render(<LessonDocumentView raw={horizonteFixtureDocument('solids', fixture, locale)} locale={locale} ageBand={BANDS[fixture]!} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const css = ['solids/solids.css'];
const readout = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const rowTexts = (table: HTMLElement) => within(table).getAllByRole('row').map((row) => row.textContent);

describe('solids board contract', () => {
  it('meets the board contract for every fixture in three locales', async () => {
    await assertBoardContract({ pack: 'solids', fixtureId: 'which-has-no-vertices', copy: SOLIDS_COPY, css });
    await assertBoardContract({ pack: 'solids', fixtureId: 'nine-edges', copy: SOLIDS_COPY, css, locales: ['en-US'] });
    await assertBoardContract({ pack: 'solids', fixtureId: 'name-the-faces', copy: SOLIDS_COPY, css });
    await assertBoardContract({ pack: 'solids', fixtureId: 'finish-the-net', copy: SOLIDS_COPY, css });
    await assertBoardContract({ pack: 'solids', fixtureId: 'staircase', copy: SOLIDS_COPY, css });
    await assertBoardContract({ pack: 'solids', fixtureId: 'two-by-two', copy: SOLIDS_COPY, css });
  }, 60_000);

  it.each([
    'area-of-the-cube', 'name-the-box', 'name-the-prism', 'name-the-pyramid', 'finish-the-box-net', 'finish-the-prism-net', 'finish-the-pyramid-net',
    'area-of-the-box', 'area-of-the-prism', 'area-of-the-pyramid',
  ])('meets the board contract for %s in three locales', async (fixtureId) => {
    await assertBoardContract({ pack: 'solids', fixtureId, copy: SOLIDS_COPY, css });
  }, 60_000);

  it('keeps every string in three locales', () => {
    for (const [key, entry] of Object.entries(SOLIDS_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
  });
});

describe('F4.1 solid viewer', () => {
  it('snaps between fixed views with the arrow keys, one step at a time', async () => {
    show('which-has-no-vertices');
    const stage = await screen.findByRole('group', { name: 'Cube' });
    expect(readout()).toHaveTextContent('Cube. Corner view. Turn 1 of 4');
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(readout()).toHaveTextContent('Corner view. Turn 2 of 4');
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    expect(readout()).toHaveTextContent('Corner view. Turn 4 of 4');
    fireEvent.keyDown(stage, { key: 'ArrowUp' });
    expect(readout()).toHaveTextContent('Top view');
    fireEvent.keyDown(stage, { key: 'ArrowUp' });
    expect(readout()).toHaveTextContent('Top view');
    expect(button('Look higher')).toBeDisabled();
    fireEvent.keyDown(stage, { key: 'ArrowDown' });
    fireEvent.keyDown(stage, { key: 'ArrowDown' });
    expect(readout()).toHaveTextContent('Level view');
    expect(button('Look lower')).toBeDisabled();
    fireEvent.keyDown(stage, { key: 'ArrowRight', ctrlKey: true });
    expect(readout()).toHaveTextContent('Level view. Turn 4 of 4');
  });

  it('turns with the four buttons as well', async () => {
    show('which-has-no-vertices');
    await screen.findByRole('group', { name: 'Cube' });
    fireEvent.click(button('Turn right'));
    fireEvent.click(button('Look higher'));
    expect(readout()).toHaveTextContent('Top view. Turn 2 of 4');
  });

  it('draws the solid as an SVG when WebGL is not available, with its description for a screen reader', async () => {
    show('which-has-no-vertices');
    await screen.findByRole('group', { name: 'Cube' });
    expect(document.querySelector('.lf-solid-viewer')).toHaveAttribute('data-render', 'svg');
    expect(document.querySelectorAll('.lf-solid-svg polygon').length).toBeGreaterThan(0);
    const stage = screen.getByRole('group', { name: 'Cube' });
    const described = (stage.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    expect(described).toContain('Faces: 6. Edges: 12. Vertices: 8.');
  });

  it('labels faces, edges or vertices on request', async () => {
    show('which-has-no-vertices');
    await screen.findByRole('group', { name: 'Cube' });
    expect(document.querySelectorAll('.lf-solid-label')).toHaveLength(0);
    fireEvent.click(button('Vertices'));
    expect(document.querySelectorAll('.lf-solid-label').length).toBeGreaterThan(0);
    fireEvent.click(button('No labels'));
    expect(document.querySelectorAll('.lf-solid-label')).toHaveLength(0);
  });

  it('shows the faces, edges and vertices of the viewed solid as a table', async () => {
    show('which-has-no-vertices');
    await screen.findByRole('group', { name: 'Cube' });
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: /Facts about the solid/ }))).toEqual(['FactCount', 'Faces6', 'Flat faces6', 'Curved faces0', 'Edges12', 'Straight edges12', 'Curved edges0', 'Vertices8']);
    fireEvent.click(button('Cylinder'));
    const cylinder = describeSolid('cylinder');
    expect(rowTexts(screen.getByRole('table', { name: /Facts about the solid/ }))).toContain(`Vertices${cylinder.vertices}`);
    expect(rowTexts(screen.getByRole('table', { name: /Facts about the solid/ }))).toContain(`Curved faces${cylinder.curvedFaces}`);
  });

  it('chooses a solid and counts, then submits both and never says met itself', async () => {
    const grade = show('which-has-no-vertices');
    await screen.findByRole('group', { name: 'Cube' });
    expect(button('Check')).toBeDisabled();
    fireEvent.click(button('Cylinder'));
    fireEvent.click(button('Choose this solid'));
    expect(screen.getByText('Chosen: Cylinder')).toBeTruthy();
    expect(button('Check')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Number of faces'), { target: { value: '3' } });
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ solid: 'cylinder', count: '3' }, 'solid-viewer-no-vertices', expect.anything()));
    expect(screen.queryByText('You found the solid and counted it.')).toBeNull();
  });

  it('keeps looking free: turning or viewing another solid does not choose it', async () => {
    show('which-has-no-vertices');
    await screen.findByRole('group', { name: 'Cube' });
    fireEvent.click(button('Cylinder'));
    fireEvent.click(button('Turn left'));
    expect(screen.getByText('Chosen: none')).toBeTruthy();
  });

  it('resets the view, the labels and the answer', async () => {
    show('which-has-no-vertices');
    await screen.findByRole('group', { name: 'Cube' });
    expect(button('Reset')).toBeDisabled();
    fireEvent.click(button('Cylinder'));
    fireEvent.click(button('Choose this solid'));
    fireEvent.click(button('Turn right'));
    fireEvent.click(button('Reset'));
    expect(screen.getByText('Chosen: none')).toBeTruthy();
    expect(readout()).toHaveTextContent('Cube. Corner view. Turn 1 of 4');
    expect(button('Reset')).toBeDisabled();
  });

  it('asks for vertices on the ten to twelve piece and offers all four solids', async () => {
    const grade = show('nine-edges');
    await screen.findByRole('group', { name: 'Cube' });
    for (const name of ['Cube', 'Triangular prism', 'Square pyramid', 'Cylinder']) expect(button(name)).toBeTruthy();
    fireEvent.click(button('Triangular prism'));
    fireEvent.click(button('Choose this solid'));
    fireEvent.change(screen.getByLabelText('Number of vertices'), { target: { value: '6' } });
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ solid: 'prism', count: '6' }, 'solid-viewer-nine-edges', expect.anything()));
  });

  it('speaks in Spanish and Portuguese', async () => {
    show('which-has-no-vertices', undefined, 'es-MX');
    expect(await screen.findByRole('group', { name: 'Cubo' })).toBeTruthy();
    expect(button('Girar a la izquierda')).toBeTruthy();
    expect(button('Mostrar como tabla')).toBeTruthy();
  });
});

describe('F4.2 cube net: naming the faces', () => {
  const grid = () => screen.findByRole('group', { name: 'Net grid' });
  const square = (n: number, state: string) => button(`Square ${n}: ${state}`);

  it('starts with the given names locked and the rest empty', async () => {
    show('name-the-faces');
    await grid();
    expect(square(3, 'Front, given')).toHaveAttribute('aria-disabled', 'true');
    expect(square(4, 'Right, given')).toHaveAttribute('aria-disabled', 'true');
    expect(square(1, 'no name')).toBeTruthy();
    expect(readout()).toHaveTextContent('Named: 2 of 6');
    expect(button('Check')).toBeDisabled();
    expect(screen.queryByRole('img', { name: /equals/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/\b24\b/);
  });

  it('names squares by tapping a name, then a square, and submits every name', async () => {
    const grade = show('name-the-faces');
    await grid();
    for (const [name, n] of [['Top', 1], ['Left', 2], ['Back', 5], ['Bottom', 6]] as const) {
      fireEvent.click(button(name));
      fireEvent.click(square(n, 'no name'));
      expect(square(n, name)).toBeTruthy();
    }
    expect(readout()).toHaveTextContent('Named: 6 of 6');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { cell0: ['top'], cell1: ['left'], cell2: ['front'], cell3: ['right'], cell4: ['back'], cell5: ['bottom'] } }, 'cube-net-name-faces', expect.anything()));
  });

  it('places a name with the keyboard path and takes it back with a tap', async () => {
    show('name-the-faces');
    await grid();
    expect(button('Move to')).toBeDisabled();
    fireEvent.click(button('Top'));
    fireEvent.click(button('Top: Move to'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Square 1' }));
    expect(square(1, 'Top')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Top' })).toBeNull();
    fireEvent.click(square(1, 'Top'));
    expect(square(1, 'no name')).toBeTruthy();
    expect(button('Top')).toBeTruthy();
    fireEvent.click(square(3, 'Front, given'));
    expect(square(3, 'Front, given')).toBeTruthy();
  });

  it('keeps given squares out of the Move to menu', async () => {
    show('name-the-faces');
    await grid();
    fireEvent.click(button('Top'));
    fireEvent.click(button('Top: Move to'));
    await screen.findByRole('menuitem', { name: 'Square 1' });
    expect(screen.queryByRole('menuitem', { name: 'Square 3' })).toBeNull();
    expect(screen.getAllByRole('menuitem')).toHaveLength(4);
  });

  it('resets to the given names and shows the squares as a table', async () => {
    show('name-the-faces');
    await grid();
    fireEvent.click(button('Top'));
    fireEvent.click(square(1, 'no name'));
    fireEvent.click(button('Reset'));
    expect(square(1, 'no name')).toBeTruthy();
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'Net squares and names' }))).toEqual([
      'SquareColumnRowName', '121no name', '212no name', '322Front (given)', '432Right (given)', '542no name', '623no name',
    ]);
  });
});

describe('F4.2 cube net: finishing the net', () => {
  const grid = () => screen.findByRole('group', { name: 'Net grid' });
  const empty = (col: number, row: number) => button(`Column ${col}, row ${row}: empty`);

  it('starts with three given squares and counts the squares', async () => {
    show('finish-the-net');
    await grid();
    expect(button('Column 1, row 2: given square')).toHaveAttribute('aria-disabled', 'true');
    expect(readout()).toHaveTextContent('Squares: 3 of 6. Keep adding squares.');
    expect(button('Check')).toBeDisabled();
    expect(screen.getByRole('img', { name: 'The cube so far, seen from the front right' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'The cube so far, seen from the back left' })).toBeTruthy();
  });

  it('says when squares are apart or would land on the same face', async () => {
    show('finish-the-net');
    await grid();
    fireEvent.click(empty(4, 1));
    expect(readout()).toHaveTextContent('The squares are not joined edge to edge.');
    fireEvent.click(button('Column 4, row 1: square'));
    fireEvent.click(empty(1, 1));
    fireEvent.click(empty(2, 1));
    expect(readout()).toHaveTextContent('Two squares would land on the same face.');
  });

  it('builds a net that folds, shows it folded, and submits the six squares', async () => {
    const grade = show('finish-the-net');
    await grid();
    for (const [col, row] of [[4, 2], [2, 1], [2, 3]] as const) fireEvent.click(empty(col, row));
    expect(readout()).toHaveTextContent('Squares: 6 of 6. The net folds into a cube.');
    expect(document.querySelectorAll('.lf-net-face[data-covered="true"]').length).toBeGreaterThan(0);
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledTimes(1));
    const call = grade.mock.calls[0] as unknown as [{ slots: Record<string, string[]> }, string];
    expect(Object.keys(call[0].slots).sort()).toEqual(['g0x1', 'g1x0', 'g1x1', 'g1x2', 'g2x1', 'g3x1']);
    expect(Object.values(call[0].slots).every((held) => held.length === 1 && held[0] === 'square')).toBe(true);
    expect(call[1]).toBe('cube-net-finish');
  });

  it('stops at six squares and lets a square be taken away again', async () => {
    show('finish-the-net');
    await grid();
    for (const [col, row] of [[4, 2], [2, 1], [2, 3]] as const) fireEvent.click(empty(col, row));
    expect(empty(1, 1)).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(empty(1, 1));
    expect(readout()).toHaveTextContent('Squares: 6 of 6');
    fireEvent.click(button('Column 4, row 2: square'));
    expect(readout()).toHaveTextContent('Squares: 5 of 6');
  });

  it('places a square with the keyboard path', async () => {
    show('finish-the-net');
    await grid();
    fireEvent.click(button('Add a square'));
    fireEvent.click(button('Add a square: Move to'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Column 4, row 2' }));
    expect(readout()).toHaveTextContent('Squares: 4 of 6');
    expect(button('Column 4, row 2: square')).toBeTruthy();
  });

  it('lists the squares as a table and resets to the given ones', async () => {
    show('finish-the-net');
    await grid();
    fireEvent.click(empty(4, 2));
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'Net grid' }))).toEqual(['SquareColumnRow', '1 (given)12', '2 (given)22', '3 (given)32', '442']);
    fireEvent.click(button('Reset'));
    expect(readout()).toHaveTextContent('Squares: 3 of 6');
  });

  it('speaks in Portuguese', async () => {
    show('finish-the-net', undefined, 'pt-BR');
    expect(await screen.findByRole('group', { name: 'Grade da planificação' })).toBeTruthy();
    expect(button('Mostrar como tabela')).toBeTruthy();
  });
});

describe('F4.3 cube stack', () => {
  const stackGrid = () => screen.findByRole('group', { name: 'Your stack' });
  const cell = (col: number, row: number, height: number) => button(`Column ${col}, row ${row}: height ${height}`);

  it('starts from the authored stack and compares each view with the goal', async () => {
    show('staircase');
    await stackGrid();
    expect(cell(1, 3, 1)).toBeTruthy();
    expect(readout()).toHaveTextContent('Cubes: 1');
    expect(screen.getByRole('img', { name: 'From the front, Goal: 3, 2, 1' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'From the front, Yours: 1, 0, 0' })).toBeTruthy();
    expect(screen.getByText('From the front: not the same yet')).toBeTruthy();
    expect(screen.getByText('From the right side: not the same yet')).toBeTruthy();
  });

  it('cycles a cell from empty to three cubes and back to empty', async () => {
    show('staircase');
    await stackGrid();
    fireEvent.click(cell(1, 1, 0));
    expect(cell(1, 1, 1)).toBeTruthy();
    fireEvent.click(cell(1, 1, 1));
    fireEvent.click(cell(1, 1, 2));
    expect(cell(1, 1, 3)).toBeTruthy();
    fireEvent.click(cell(1, 1, 3));
    expect(cell(1, 1, 0)).toBeTruthy();
    expect(readout()).toHaveTextContent('Cubes: 1');
  });

  it('builds the staircase, matches both views and submits the heights', async () => {
    const grade = show('staircase');
    await stackGrid();
    fireEvent.click(cell(1, 3, 1));
    fireEvent.click(cell(1, 3, 2));
    fireEvent.click(cell(2, 2, 0));
    fireEvent.click(cell(2, 2, 1));
    fireEvent.click(cell(3, 1, 0));
    expect(readout()).toHaveTextContent('Cubes: 6');
    expect(screen.getByText('From the front: same as the goal')).toBeTruthy();
    expect(screen.getByText('From the right side: same as the goal')).toBeTruthy();
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { c0r2: ['cube', 'cube', 'cube'], c1r1: ['cube', 'cube'], c2r0: ['cube'] } }, 'cube-stack-staircase', expect.anything()));
    expect(screen.queryByText('Your stack matches with the fewest cubes.')).toBeNull();
  });

  it('adds a cube with the keyboard path and stops at three', async () => {
    show('staircase');
    await stackGrid();
    for (let step = 0; step < 4; step += 1) {
      fireEvent.click(button('Add a cube'));
      fireEvent.click(button('Add a cube: Move to'));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Column 2, row 2' }));
    }
    expect(cell(2, 2, 3)).toBeTruthy();
    expect(readout()).toHaveTextContent('Cubes: 4');
  });

  it('needs a change before it can be checked and resets to the start', async () => {
    show('staircase');
    await stackGrid();
    expect(button('Check')).toBeDisabled();
    expect(button('Reset')).toBeDisabled();
    fireEvent.click(cell(1, 1, 0));
    expect(button('Check')).toBeEnabled();
    fireEvent.click(button('Reset'));
    expect(cell(1, 1, 0)).toBeTruthy();
    expect(readout()).toHaveTextContent('Cubes: 1');
  });

  it('shows heights and views as tables', async () => {
    show('staircase');
    await stackGrid();
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'Cubes in each cell' }))).toEqual(['123', 'Row 1000', 'Row 2000', 'Row 3100']);
    expect(rowTexts(screen.getByRole('table', { name: 'Your views and the goal' }))).toEqual([
      'ViewYoursGoalSame', 'From the front1, 0, 03, 2, 1No', 'From the right side1, 0, 03, 2, 1No',
    ]);
  });

  it('draws the plan view of the small stack and compares it too', async () => {
    show('two-by-two');
    await stackGrid();
    expect(screen.getByRole('img', { name: 'From above, Goal: filled, empty; empty, filled' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'From above, Yours: filled, empty; empty, empty' })).toBeTruthy();
    expect(screen.getByText('From above: not the same yet')).toBeTruthy();
    fireEvent.click(cell(1, 1, 1));
    fireEvent.click(cell(2, 2, 0));
    expect(screen.getByText('From above: same as the goal')).toBeTruthy();
    expect(screen.getByText('From the front: not the same yet')).toBeTruthy();
  });

  it('speaks in Spanish', async () => {
    show('two-by-two', undefined, 'es-MX');
    expect(await screen.findByRole('group', { name: 'Tu pila' })).toBeTruthy();
    expect(button('Mostrar como tabla')).toBeTruthy();
  });
});
