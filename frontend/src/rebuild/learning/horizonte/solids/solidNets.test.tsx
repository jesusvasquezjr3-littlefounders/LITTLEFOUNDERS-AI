import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { horizonteFixtureDocument } from '../previewDocument';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'none', maxTextureSize: 0, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const BANDS: Record<string, '6-9' | '10-12'> = {
  'name-the-faces': '6-9', 'area-of-the-cube': '6-9', 'name-the-box': '10-12', 'name-the-prism': '10-12', 'name-the-pyramid': '6-9',
  'finish-the-box-net': '10-12', 'finish-the-prism-net': '10-12', 'finish-the-pyramid-net': '10-12',
  'area-of-the-box': '10-12', 'area-of-the-prism': '10-12', 'area-of-the-pyramid': '10-12',
};
const show = (fixture: string, grade = vi.fn(() => ({ verdict: 'review' as const })), locale: Locale = 'en-US') => {
  render(<LessonDocumentView raw={horizonteFixtureDocument('solids', fixture, locale)} locale={locale} ageBand={BANDS[fixture]!} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const readout = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const rowTexts = (table: HTMLElement) => within(table).getAllByRole('row').map((row) => row.textContent);

/** The area of one table row, read back from the lengths the learner sees, so the table is proven to carry everything the answer needs. */
function rowArea(lengths: string): number {
  const number = '(\\d+(?:\\.\\d+)?)';
  const rect = new RegExp(`^${number} by ${number}$`).exec(lengths);
  if (rect) return Number(rect[1]) * Number(rect[2]);
  const legs = new RegExp(`^legs ${number} and ${number}$`).exec(lengths);
  if (legs) return (Number(legs[1]) * Number(legs[2])) / 2;
  const base = new RegExp(`^base ${number}, height ${number}$`).exec(lengths);
  if (base) return (Number(base[1]) * Number(base[2])) / 2;
  throw new Error(`unreadable lengths: ${lengths}`);
}

describe('F4.2 solid nets: naming the faces', () => {
  const net = () => screen.findByRole('group', { name: /^Net: / });
  /** A panel is a button only while it can be pressed (named, or a name is carried); otherwise it is a labelled picture. */
  const panel = (n: number) => screen.getByLabelText(new RegExp(`^Panel ${n}: `));
  /** A given panel is a labelled picture, not a control: nothing to press, so it is not a button. */
  const given = (n: number) => screen.getByRole('img', { name: new RegExp(`^Panel ${n}: `) });
  const tap = (name: string, n: number) => { fireEvent.click(button(name)); fireEvent.click(panel(n)); };

  it('starts with the given names locked and the rest empty', async () => {
    show('name-the-box');
    await net();
    expect(given(2)).toHaveAttribute('aria-label', 'Panel 2: Front, 4 by 2, given');
    expect(screen.queryByRole('button', { name: /^Panel 2: / })).toBeNull();
    expect(given(5)).toHaveAttribute('aria-label', 'Panel 5: Left, 3 by 2, given');
    expect(panel(1)).toHaveAttribute('aria-label', 'Panel 1: no name, 4 by 3');
    expect(readout()).toHaveTextContent('Named: 2 of 6');
    expect(button('Check')).toBeDisabled();
    for (const name of ['Bottom', 'Top', 'Back', 'Right']) expect(button(name)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Front' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Left' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/equals|Surface area/);
  });

  it('names the panels by tapping a name then a panel and submits every name', async () => {
    const grade = show('name-the-box');
    await net();
    tap('Top', 1);
    expect(panel(1)).toHaveAttribute('aria-label', 'Panel 1: Top, 4 by 3');
    tap('Back', 3);
    tap('Right', 4);
    expect(readout()).toHaveTextContent('Named: 5 of 6');
    expect(button('Check')).toBeDisabled();
    tap('Bottom', 6);
    expect(readout()).toHaveTextContent('Named: 6 of 6');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { panel0: ['top'], panel1: ['front'], panel2: ['back'], panel3: ['right'], panel4: ['left'], panel5: ['bottom'] } }, 'solid-net-name-box', expect.anything()));
    expect(screen.queryByText('You named every face of the solid.')).toBeNull();
  });

  it('places a name with the Move to menu, which lists only the open panels, and takes it back with a tap', async () => {
    show('name-the-box');
    await net();
    expect(button('Move to')).toBeDisabled();
    fireEvent.click(button('Top'));
    fireEvent.click(button('Top: Move to'));
    expect(await screen.findAllByRole('menuitem')).toHaveLength(4);
    expect(screen.queryByRole('menuitem', { name: 'Panel 2' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Panel 5' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Panel 6' }));
    expect(panel(6)).toHaveAttribute('aria-label', 'Panel 6: Top, 4 by 3');
    expect(screen.queryByRole('button', { name: 'Top' })).toBeNull();
    fireEvent.click(panel(6));
    expect(panel(6)).toHaveAttribute('aria-label', 'Panel 6: no name, 4 by 3');
    expect(button('Top')).toBeTruthy();
    fireEvent.click(given(2));
    expect(given(2)).toHaveAttribute('aria-label', 'Panel 2: Front, 4 by 2, given');
  });

  it('takes a name by the keyboard: Enter on a panel does what a tap does', async () => {
    show('name-the-box');
    await net();
    fireEvent.click(button('Top'));
    fireEvent.keyDown(panel(1), { key: 'Enter' });
    expect(panel(1)).toHaveAttribute('aria-label', 'Panel 1: Top, 4 by 3');
    fireEvent.keyDown(panel(1), { key: ' ' });
    expect(panel(1)).toHaveAttribute('aria-label', 'Panel 1: no name, 4 by 3');
  });

  it('lists the panels with their shapes and lengths as a table, then resets', async () => {
    show('name-the-box');
    await net();
    tap('Top', 1);
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'Panels and names' }))).toEqual([
      'PanelShapeLengthsName', '1Rectangle4 by 3Top', '2Rectangle4 by 2Front (given)', '3Rectangle4 by 2no name',
      '4Rectangle3 by 2no name', '5Rectangle3 by 2Left (given)', '6Rectangle4 by 3no name',
    ]);
    fireEvent.click(button('Reset'));
    expect(readout()).toHaveTextContent('Named: 2 of 6');
    expect(button('Reset')).toBeDisabled();
  });

  it('names the prism: legs and bases tell the faces apart', async () => {
    const grade = show('name-the-prism');
    await net();
    expect(readout()).toHaveTextContent('Named: 1 of 5');
    expect(given(3)).toHaveAttribute('aria-label', 'Panel 3: Slope, 5 by 5, given');
    expect(panel(4)).toHaveAttribute('aria-label', 'Panel 4: no name, legs 3 and 4');
    tap('Back', 1);
    tap('Bottom', 2);
    tap('Left', 4);
    tap('Right', 5);
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { panel0: ['back'], panel1: ['bottom'], panel2: ['slope'], panel3: ['left'], panel4: ['right'] } }, 'solid-net-name-prism', expect.anything()));
  });

  it('names the pyramid in Spanish with the same panels', async () => {
    const grade = show('name-the-pyramid', undefined, 'es-MX');
    await screen.findByRole('group', { name: /^Plantilla: / });
    expect(readout()).toHaveTextContent('Nombradas: 2 de 5');
    const spanish = (n: number) => button(new RegExp(`^Pieza ${n}: `));
    for (const [name, n] of [['Derecha', 3], ['Atrás', 4], ['Izquierda', 5]] as const) {
      fireEvent.click(button(name));
      fireEvent.click(spanish(n));
    }
    fireEvent.click(button(/^(Revisar|Comprobar|Verificar)/));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { panel0: ['bottom'], panel1: ['front'], panel2: ['right'], panel3: ['back'], panel4: ['left'] } }, 'solid-net-name-pyramid', expect.anything()));
  });
});

describe('F4.2 solid nets: finishing the net', () => {
  const net = () => screen.findByRole('group', { name: /^Net: / });
  const join = (face: string, edge: string) => {
    fireEvent.click(button(new RegExp(`^${face}: `)));
    fireEvent.click(button(`${face}, Edge with ${edge}`));
  };

  it('starts with the given faces joined and reports the net next to the sheet', async () => {
    show('finish-the-box-net');
    await net();
    expect(readout()).toHaveTextContent('Faces joined: 4 of 6. Your net: 8 by 5. Sheet: 9 by 11. The net fits the sheet.');
    expect(screen.getByRole('img', { name: 'Front, 4 by 2, given' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Front, 4 by 2, given' })).toBeNull();
    expect(button('Check')).toBeDisabled();
    expect(button('Top: 4 by 3')).toBeTruthy();
    expect(button('Back: 4 by 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edge with/ })).toBeNull();
  });

  it('shows the edges a picked face can hang from, hangs it there and submits every hinge', async () => {
    const grade = show('finish-the-box-net');
    await net();
    fireEvent.click(button('Back: 4 by 2'));
    expect(screen.getAllByRole('button', { name: /^Back, Edge with / }).map((entry) => entry.getAttribute('aria-label')).sort()).toEqual([
      'Back, Edge with Bottom', 'Back, Edge with Left', 'Back, Edge with Right',
    ]);
    fireEvent.click(button('Back, Edge with Bottom'));
    expect(readout()).toHaveTextContent('Faces joined: 5 of 6');
    expect(button('Check')).toBeDisabled();
    join('Top', 'Front');
    expect(readout()).toHaveTextContent('Faces joined: 6 of 6. Your net: 8 by 10. Sheet: 9 by 11. The net fits the sheet.');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { 'bottom-back': ['back'], 'bottom-right': ['right'], 'bottom-front': ['front'], 'bottom-left': ['left'], 'top-front': ['top'] } },
      'solid-net-finish-box', expect.anything()));
    expect(screen.queryByText('You built a net that folds up.')).toBeNull();
  });

  it('joins a face with the Move to menu and takes it back with a tap', async () => {
    show('finish-the-box-net');
    await net();
    fireEvent.click(button('Top: 4 by 3'));
    fireEvent.click(button('Top: Move to'));
    expect((await screen.findAllByRole('menuitem')).map((entry) => entry.textContent).sort()).toEqual(['Edge with Front', 'Edge with Left', 'Edge with Right']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edge with Front' }));
    expect(readout()).toHaveTextContent('Faces joined: 5 of 6');
    expect(screen.queryByRole('button', { name: 'Top: 4 by 3' })).toBeNull();
    fireEvent.click(button('Top, 4 by 3, Take back'));
    expect(readout()).toHaveTextContent('Faces joined: 4 of 6');
    expect(button('Top: 4 by 3')).toBeTruthy();
  });

  it('takes back a face together with everything hanging from it', async () => {
    show('finish-the-box-net');
    await net();
    join('Top', 'Front');
    join('Back', 'Top');
    expect(readout()).toHaveTextContent('Faces joined: 6 of 6');
    fireEvent.click(button('Top, 4 by 3, Take back'));
    expect(readout()).toHaveTextContent('Faces joined: 4 of 6');
    expect(button('Back: 4 by 2')).toBeTruthy();
    expect(button('Top: 4 by 3')).toBeTruthy();
  });

  it('says when the net is too big for the sheet and still lets it be checked', async () => {
    const grade = show('finish-the-box-net');
    await net();
    join('Top', 'Left');
    join('Back', 'Bottom');
    expect(readout()).toHaveTextContent('The net is too big for the sheet.');
    expect(readout()).not.toHaveTextContent('The net fits the sheet.');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledTimes(1));
  });

  it('lists the faces as a table and resets to the given ones', async () => {
    show('finish-the-box-net');
    await net();
    join('Top', 'Front');
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'Faces of the net' }))).toEqual([
      'FacePanelJoined toLengths', 'Bottom (given)1first face4 by 3', 'Top5Front4 by 3', 'Front (given)2Bottom4 by 2', 'Back-not joined4 by 2',
      'Left (given)3Bottom3 by 2', 'Right (given)4Bottom3 by 2',
    ]);
    fireEvent.click(button('Reset'));
    expect(readout()).toHaveTextContent('Faces joined: 4 of 6');
    expect(button('Reset')).toBeDisabled();
  });

  it('finishes the prism net with its three remaining faces', async () => {
    const grade = show('finish-the-prism-net');
    await net();
    expect(readout()).toHaveTextContent('Faces joined: 2 of 5. Your net: 7 by 5. Sheet: 13 by 14. The net fits the sheet.');
    join('Slope', 'Bottom');
    join('Left', 'Bottom');
    join('Right', 'Bottom');
    expect(readout()).toHaveTextContent('Faces joined: 5 of 5');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { 'bottom-right': ['right'], 'bottom-slope': ['slope'], 'bottom-left': ['left'], 'bottom-back': ['back'] } }, 'solid-net-finish-prism', expect.anything()));
  });

  it('finishes the pyramid net and joins a triangle to another triangle', async () => {
    const grade = show('finish-the-pyramid-net');
    await net();
    join('Right', 'Bottom');
    join('Back', 'Right');
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith(
      { slots: { 'bottom-right': ['right'], 'bottom-front': ['front'], 'bottom-left': ['left'], 'back-right': ['back'] } }, 'solid-net-finish-pyramid', expect.anything()));
  });

  it('speaks in Portuguese', async () => {
    show('finish-the-box-net', undefined, 'pt-BR');
    await screen.findByRole('group', { name: /^Planificação: / });
    expect(readout()).toHaveTextContent('Faces unidas: 4 de 6');
    expect(button('Mostrar como tabela')).toBeTruthy();
  });
});

describe('F4.2 surface area from the net', () => {
  const answer = (name = 'Total area of all the faces') => screen.getByLabelText(name);
  const total = () => {
    const [, ...rows] = within(screen.getByRole('table', { name: 'Panels and lengths' })).getAllByRole('row');
    return rows.reduce((sum, row) => sum + rowArea(within(row).getAllByRole('cell')[1]!.textContent ?? ''), 0);
  };

  it.each([
    ['area-of-the-box', 'solid-net-area-box', '52', /^Net: Box$/],
    ['area-of-the-prism', 'solid-net-area-prism', '72', /^Net: Triangular prism$/],
    ['area-of-the-pyramid', 'solid-net-area-pyramid', '96', /^Net: Square pyramid$/],
  ])('%s asks for the total, never shows it, and submits the typed number', async (fixture, segment, key, label) => {
    const grade = show(fixture);
    await screen.findByRole('img', { name: label });
    expect(button('Check')).toBeDisabled();
    expect(document.body.textContent).not.toMatch(new RegExp(`\\b${key}\\b`));
    fireEvent.click(button('Show as table'));
    expect(within(screen.getByRole('table', { name: 'Panels and lengths' })).getAllByRole('row')[0]!.textContent).toBe('PanelShapeLengths');
    expect(total()).toBe(Number(key));
    expect(document.querySelector('.lf-hz-table')!.textContent).not.toMatch(/area/i);
    fireEvent.change(answer(), { target: { value: key } });
    expect(button('Check')).toBeEnabled();
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: key }, segment, expect.anything()));
    expect(screen.queryByText('You added the area of every face.')).toBeNull();
  });

  it('asks the cube net for its surface area too, from the edge printed on the squares', async () => {
    const grade = show('area-of-the-cube');
    await screen.findByRole('img', { name: 'Net grid' });
    expect(document.body.textContent).not.toMatch(/\b54\b|equals/);
    fireEvent.click(button('Show as table'));
    expect(rowTexts(screen.getByRole('table', { name: 'Panels and lengths' }))).toEqual([
      'PanelShapeLengths', '1Square3 by 3', '2Square3 by 3', '3Square3 by 3', '4Square3 by 3', '5Square3 by 3', '6Square3 by 3',
    ]);
    expect(total()).toBe(54);
    fireEvent.change(answer(), { target: { value: '54' } });
    fireEvent.click(button('Check'));
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '54' }, 'cube-net-area', expect.anything()));
  });

  it('keeps Check off until a number is typed and clears it with Reset', async () => {
    show('area-of-the-box');
    await screen.findByRole('img', { name: 'Net: Box' });
    expect(button('Reset')).toBeDisabled();
    fireEvent.change(answer(), { target: { value: '12' } });
    expect(button('Reset')).toBeEnabled();
    fireEvent.click(button('Reset'));
    expect(answer()).toHaveValue('');
    expect(button('Check')).toBeDisabled();
  });

  it('speaks in Spanish', async () => {
    show('area-of-the-pyramid', undefined, 'es-MX');
    await screen.findByRole('img', { name: 'Plantilla: Pirámide cuadrada' });
    expect(screen.getByLabelText('Área total de todas las caras')).toBeTruthy();
    expect(button('Mostrar como tabla')).toBeTruthy();
  });
});

describe('F4.2 fold preview', () => {
  const slider = () => screen.getByRole('slider', { name: 'How far the net is folded' });
  const status = () => document.querySelector('.lf-fold .lf-solid-status') as HTMLElement;

  it('jumps to the folded solid when motion is not available, and back flat', async () => {
    show('area-of-the-box');
    await screen.findByRole('img', { name: 'Net: Box' });
    expect(status()).toHaveTextContent('Flat');
    fireEvent.click(button('Fold'));
    expect(status()).toHaveTextContent('Folded up');
    expect(button('Unfold')).toBeTruthy();
    fireEvent.click(button('Unfold'));
    expect(status()).toHaveTextContent('Flat');
  });

  it('scrubs one step at a time with the slider, which is the keyboard path', async () => {
    show('finish-the-box-net');
    await screen.findByRole('group', { name: /^Net: / });
    expect(slider()).toHaveAttribute('max', '10');
    expect(slider()).toHaveAttribute('aria-valuetext', 'Flat');
    fireEvent.change(slider(), { target: { value: '4' } });
    expect(status()).toHaveTextContent('Folded 4 of 10');
    fireEvent.change(slider(), { target: { value: '10' } });
    expect(status()).toHaveTextContent('Folded up');
    expect(document.querySelectorAll('.lf-fold-tag')).toHaveLength(4);
  });

  it('numbers the panels the way the net does and folds the cube net too', async () => {
    show('name-the-faces');
    await screen.findByRole('group', { name: 'Net grid' });
    fireEvent.click(button('Fold'));
    expect([...document.querySelectorAll('.lf-fold-tag')].map((tag) => tag.textContent).sort()).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('never reveals the area while it folds', async () => {
    show('area-of-the-pyramid');
    await screen.findByRole('img', { name: 'Net: Square pyramid' });
    fireEvent.click(button('Fold'));
    expect(document.body.textContent).not.toMatch(/\b96\b/);
  });
});
