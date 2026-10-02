import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AgeBand } from '../../../design/copyBudget';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixtureDocument } from '../previewDocument';
import { NUM_B_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const CSS = ['num-b/numB.css', 'num-b/ArrayAreaBoard.css', 'num-b/RatioLineBoard.css', 'num-b/FractionWallBoard.css'];
const BANDS: Record<string, AgeBand> = { 'array-rows-columns': '6-9', 'wall-equivalent': '6-9' };
const FIXTURES = ['array-rows-columns', 'area-box', 'area-division', 'double-line-scale', 'tape-share', 'wall-equivalent', 'bars-add', 'bars-subtract', 'product-grid', 'measure-fit'];

const show = (fixture: string, locale: 'en-US' | 'es-MX' | 'pt-BR' = 'en-US', grade = vi.fn(() => ({ verdict: 'review' as const }))) => {
  render(<LessonDocumentView raw={horizonteFixtureDocument('num-b', fixture, locale)} locale={locale} ageBand={BANDS[fixture] ?? '10-12'} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const type = (label: string, value: string) => fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value } });
const check = () => click('Check');

describe('num-b boards: contract', () => {
  it('meets the board contract for every fixture in three locales', async () => {
    for (const fixtureId of FIXTURES) await assertBoardContract({ pack: 'num-b', fixtureId, copy: NUM_B_COPY, css: CSS });
  }, 240000);

  it('keeps every string in three locales', () => {
    for (const [key, entry] of Object.entries(NUM_B_COPY)) for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(entry[locale].length, `${key} ${locale}`).toBeGreaterThan(0);
  });
});

describe('array board (F1.4)', () => {
  it('counts rows by tapping, then submits the typed total', async () => {
    const grade = show('array-rows-columns');
    await screen.findByRole('group', { name: 'Rows of dots' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    click('Row 1, 4 dots');
    click('Row 2, 4 dots');
    expect(status()).toHaveTextContent('3 rows of 4 dots. Counted rows: 2. Dots so far: 8.');
    type('How many dots in all?', '12');
    expect(screen.getByText('Reads as 12')).toBeTruthy();
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '12' }, 'array-rows-columns', expect.anything()));
  });

  it('resets the count and the typed answer', async () => {
    show('array-rows-columns');
    await screen.findByRole('group', { name: 'Rows of dots' });
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    click('Row 1, 4 dots');
    type('How many dots in all?', '9');
    click('Reset');
    expect(status()).toHaveTextContent('Counted rows: 0');
    expect(screen.getByRole('textbox', { name: 'How many dots in all?' })).toHaveValue('');
  });

  it('shows the counted rows as a table and never the answer', async () => {
    show('array-rows-columns');
    await screen.findByRole('group', { name: 'Rows of dots' });
    click('Row 3, 4 dots');
    click('Show as table');
    const table = screen.getByRole('table', { name: 'Dots in each row' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['RowDotsCounted', 'Row 14No', 'Row 24No', 'Row 34Yes', 'Total41']);
    click('Hide table');
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('multiplication box (F1.4)', () => {
  it('cuts the side by tapping a tick and submits the cut with both partial products', async () => {
    const grade = show('area-box');
    await screen.findByRole('img', { name: 'Multiplication box' });
    expect(status()).toHaveTextContent('Side 14 not cut yet. Height 7.');
    expect(screen.getByText('Cut the side first.')).toBeTruthy();
    click('Cut at 10');
    expect(status()).toHaveTextContent('Side 14 cut into 10 and 4. Height 7.');
    type('Left box: 10 × 7', '70');
    type('Right box: 4 × 7', '28');
    type('Total of both boxes', '98');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ split: 10, partials: ['70', '28'], value: '98' }, 'area-box', expect.anything()));
  });

  it('cuts the side with the keyboard path: carry the chip, then Move to', async () => {
    const grade = show('area-box');
    await screen.findByRole('img', { name: 'Multiplication box' });
    expect(screen.getByRole('button', { name: 'Move to' })).toBeDisabled();
    click('Cut the side');
    click('Cut the side: Move to');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Cut at 7' }));
    expect(status()).toHaveTextContent('Side 14 cut into 7 and 7. Height 7.');
    expect(grade).not.toHaveBeenCalled();
  });

  it('drops the partial products when the cut moves', async () => {
    show('area-box');
    await screen.findByRole('img', { name: 'Multiplication box' });
    click('Cut at 10');
    type('Left box: 10 × 7', '70');
    click('Cut at 7');
    expect(screen.getByRole('textbox', { name: 'Left box: 7 × 7' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('lists the parts of the box in a table', async () => {
    show('area-box');
    await screen.findByRole('img', { name: 'Multiplication box' });
    click('Cut at 10');
    type('Left box: 10 × 7', '70');
    click('Show as table');
    const table = screen.getByRole('table', { name: 'Parts of the box' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['PartWidthHeightYour area', 'Left box10770', 'Right box47?', 'Whole box147?']);
  });
});

describe('missing-area division (F1.4)', () => {
  it('takes the area away in parts and submits the parts with the side', async () => {
    const grade = show('area-division');
    await screen.findByRole('img', { name: 'Rectangle with a missing side' });
    expect(status()).toHaveTextContent('Area 156. Known side 12. Area left: ?.');
    type('First part of the side', '10');
    expect(status()).toHaveTextContent('Area left: 36.');
    type('Second part of the side', '3');
    type('The whole side', '13');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ partials: ['10', '3'], value: '13' }, 'area-division', expect.anything()));
  });

  it('keeps the area left unknown when the first part is too large', async () => {
    show('area-division');
    await screen.findByRole('img', { name: 'Rectangle with a missing side' });
    type('First part of the side', '20');
    expect(status()).toHaveTextContent('Area left: ?.');
  });
});

describe('double number line (F1.5)', () => {
  it('counts the steps on the given line and submits the other quantity', async () => {
    const grade = show('double-line-scale');
    await screen.findByRole('group', { name: 'Double number line' });
    expect(status()).toHaveTextContent('3 pencils match 6 coins. Given: 12 pencils. Marker not placed yet.');
    click('Step 2: pencils 6, coins ?');
    expect(status()).toHaveTextContent('Marker at step 2: 6 pencils.');
    type('Number of coins', '24');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '24' }, 'double-line-scale', expect.anything()));
  });

  it('moves the marker with the keyboard path', async () => {
    const grade = show('double-line-scale');
    await screen.findByRole('group', { name: 'Double number line' });
    click('Move the marker');
    click('Move the marker: Move to');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'To step 3' }));
    expect(status()).toHaveTextContent('Marker at step 3: 9 pencils.');
    expect(grade).not.toHaveBeenCalled();
  });

  it('shows the pairs of both lines as a table with the unknown marked', async () => {
    show('double-line-scale');
    await screen.findByRole('group', { name: 'Double number line' });
    click('Show as table');
    const table = screen.getByRole('table', { name: 'Pairs on the two lines' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['Steppencilscoins', '000', '136', '26?', '39?', '412?']);
  });
});

describe('ratio tape (F1.5)', () => {
  it('checks one box without submitting it, then submits the asked part', async () => {
    const grade = show('tape-share');
    await screen.findByRole('img', { name: 'Ratio tape' });
    expect(status()).toHaveTextContent('30 stickers in 5 equal boxes. Part A has 3 boxes. Part B has 2 boxes.');
    type('Value of one box', '5');
    expect(screen.getByText(/5 × 5 = 25\. Does not match the whole\./)).toBeTruthy();
    type('Value of one box', '6');
    expect(screen.getByText(/5 × 6 = 30\. Matches the whole\./)).toBeTruthy();
    type('Value of part B', '12');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ value: '12' }, 'tape-share', expect.anything()));
  });

  it('lists the parts as a table that holds the whole but not the answer', async () => {
    show('tape-share');
    await screen.findByRole('img', { name: 'Ratio tape' });
    click('Show as table');
    const table = screen.getByRole('table', { name: 'Parts of the tape' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['PartBoxesValue', 'Part A3?', 'Part B2?', 'Whole530']);
  });
});

describe('fraction wall (F1.6 equivalent fractions)', () => {
  it('shades parts by tapping and submits the fraction of the wall', async () => {
    const grade = show('wall-equivalent');
    await screen.findByRole('group', { name: 'Wall of 6 parts' });
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    click('Part 3 of 6');
    expect(status()).toHaveTextContent('Given one half. Wall of 6 parts. Shaded: 3 of 6.');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ n: 3, d: 6 }, 'wall-equivalent', expect.anything()));
  });

  it('taps the last shaded part again to take one back', async () => {
    show('wall-equivalent');
    await screen.findByRole('group', { name: 'Wall of 6 parts' });
    click('Part 4 of 6');
    click('Part 4 of 6');
    expect(status()).toHaveTextContent('Shaded: 3 of 6.');
  });

  it('shades with the keyboard path and clears the shading', async () => {
    const grade = show('wall-equivalent');
    await screen.findByRole('group', { name: 'Wall of 6 parts' });
    click('Shade to here');
    click('Shade to here: Move to');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Shade to part 2' }));
    expect(status()).toHaveTextContent('Shaded: 2 of 6.');
    click('Shade to here');
    click('Shade to here: Move to');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Clear the shading' }));
    expect(status()).toHaveTextContent('Shaded: 0 of 6.');
    expect(grade).not.toHaveBeenCalled();
  });

  it('shows the given and shaded rows as a table', async () => {
    show('wall-equivalent');
    await screen.findByRole('group', { name: 'Wall of 6 parts' });
    click('Part 3 of 6');
    click('Show as table');
    const table = screen.getByRole('table', { name: 'Rows of the wall' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['ItemPartsShaded', 'Given21', 'Yours63']);
  });
});

describe('fraction bars (F1.6 add and subtract)', () => {
  it('recuts both bars into common parts and submits the sum', async () => {
    const grade = show('bars-add');
    await screen.findByRole('button', { name: 'Show common parts' });
    expect(status()).toHaveTextContent('Add one half and one third.');
    click('Show common parts');
    expect(status()).toHaveTextContent('Cut in 6 parts: 3 and 2.');
    expect(screen.getByRole('button', { name: 'Hide common parts' })).toBeTruthy();
    type('Top number', '5');
    type('Bottom number', '6');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ n: 5, d: 6 }, 'bars-add', expect.anything()));
  });

  it('needs both numbers before Check', async () => {
    show('bars-subtract');
    await screen.findByRole('button', { name: 'Show common parts' });
    expect(status()).toHaveTextContent('Take one third from three quarters.');
    type('Top number', '5');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    type('Bottom number', '12');
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
  });

  it('adds the common rows to the table once the parts are shown', async () => {
    show('bars-subtract');
    await screen.findByRole('button', { name: 'Show common parts' });
    click('Show common parts');
    click('Show as table');
    const table = screen.getByRole('table', { name: 'Bars side by side' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['BarPartsShaded', 'First43', 'Second31', 'First, common parts129', 'Second, common parts124']);
  });
});

describe('fraction product grid (F1.6 multiply)', () => {
  it('shades columns and rows and submits the typed product', async () => {
    const grade = show('product-grid');
    await screen.findByRole('group', { name: 'Fraction product grid' });
    expect(status()).toHaveTextContent('Shade two thirds of the columns and three quarters of the rows.');
    for (const name of ['Column 1', 'Column 2', 'Row 1', 'Row 2', 'Row 3']) click(name);
    expect(status()).toHaveTextContent('Grid: 3 columns, 4 rows. Shaded columns: 2 of 3. Shaded rows: 3 of 4.');
    expect(document.querySelectorAll('[data-shade="both"]')).toHaveLength(6);
    type('Top number', '1');
    type('Bottom number', '2');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ n: 1, d: 2 }, 'product-grid', expect.anything()));
  });

  it('never gives the overlap in words and resets the shading', async () => {
    show('product-grid');
    await screen.findByRole('group', { name: 'Fraction product grid' });
    click('Column 1');
    click('Row 1');
    expect(status().textContent).not.toMatch(/both|overlap|twice/i);
    click('Reset');
    expect(document.querySelectorAll('[data-shade="both"]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Column 1' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('fraction measure (F1.6 divide)', () => {
  it('lays tiles along the length and submits the typed quotient', async () => {
    const grade = show('measure-fit');
    await screen.findByRole('img', { name: 'Measuring bar' });
    expect(status()).toHaveTextContent('Measure five sixths with tiles of one third. Tiles laid: 0.');
    expect(screen.getByRole('button', { name: 'Remove a tile' })).toBeDisabled();
    for (let index = 0; index < 5; index += 1) if (!(screen.getByRole('button', { name: 'Add a tile' }) as HTMLButtonElement).disabled) click('Add a tile');
    expect(status()).toHaveTextContent('Tiles laid: 3.');
    expect(screen.getByRole('button', { name: 'Add a tile' })).toBeDisabled();
    click('Remove a tile');
    expect(status()).toHaveTextContent('Tiles laid: 2.');
    type('Top number', '5');
    type('Bottom number', '2');
    check();
    await waitFor(() => expect(grade).toHaveBeenCalledWith({ n: 5, d: 2 }, 'measure-fit', expect.anything()));
  });

  it('shows the lengths and the tiles as a table', async () => {
    show('measure-fit');
    await screen.findByRole('img', { name: 'Measuring bar' });
    click('Add a tile');
    click('Show as table');
    const table = screen.getByRole('table', { name: 'Measuring with tiles' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['ItemValue', 'Length to measurefive sixths', 'Tile lengthone third', 'Tiles laid1']);
  });
});

describe('locales', () => {
  it('speaks the boards in Spanish and Portuguese', async () => {
    show('area-box', 'es-MX');
    expect(await screen.findByRole('img', { name: 'Caja de multiplicar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar como tabla' })).toBeTruthy();
  });

  it('speaks the fraction boards in Portuguese', async () => {
    show('bars-add', 'pt-BR');
    expect(await screen.findByRole('button', { name: 'Mostrar partes comuns' })).toBeTruthy();
    expect(status()).toHaveTextContent('Some um meio e um terço.');
  });
});
