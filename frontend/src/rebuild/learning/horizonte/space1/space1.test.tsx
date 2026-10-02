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

describe('F4.6 market stall', () => {
  const shelfChip = (name: string) => button(new RegExp(`^${name} \\$`));

  it('fills the basket with tap then tap, and shows the cost bar and the table', async () => {
    show('exact-basket');
    await screen.findByRole('group', { name: 'Your basket' });
    expect(screen.getByText('Spend exactly $2.50.')).toBeTruthy();
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
    expect(screen.getByText('Nothing in the basket yet.')).toBeTruthy();
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
    expect(screen.getByText('You pay $10. You want $2 back.')).toBeTruthy();
    expect(document.querySelector('.lf-stl-mark-label')).toHaveTextContent('You pay');
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
    expect(document.querySelector('.lf-coin-goal')).toHaveTextContent('Goal');
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
