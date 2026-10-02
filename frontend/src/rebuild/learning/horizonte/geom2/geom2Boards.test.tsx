import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RebuildRoot } from '../../../design/controls';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixture, horizonteFixtureDocument } from '../previewDocument';
import { GEOM2_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
const CSS = ['geom2/geom2.css'];
const FIXTURES = ['geoboard-area-six', 'geoboard-right-triangle', 'area-l-shape', 'area-staircase', 'reflect-triangle', 'translate-parallelogram', 'rotate-quarter', 'mirror-half', 'dilate-center', 'tile-domino', 'tile-l', 'tile-bump'];

const show = (fixture: string, locale: Locale = 'en-US') => {
  const grade = vi.fn(() => ({ verdict: 'review' as const }));
  const ageBand = horizonteFixture('geom2', fixture)!.ageBand;
  render(<RebuildRoot theme="light" locale={locale} ageBand={ageBand}><LessonDocumentView raw={horizonteFixtureDocument('geom2', fixture, locale)} locale={locale} ageBand={ageBand} onBack={() => {}} onGradeAny={grade} /></RebuildRoot>);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const ready = (name: string) => screen.findByRole('slider', { name });
const press = (name: string, key: string, times = 1) => { for (let index = 0; index < times; index += 1) fireEvent.keyDown(screen.getByRole('slider', { name }), { key }); };
const button = (name: string) => screen.getByRole('button', { name });
const check = () => fireEvent.click(button('Check'));

interface Plane { xMin: number; xMax: number; yMin: number; yMax: number; width: number; height: number }
const tapOn = (plane: Plane, x: number, y: number) => {
  const plot = document.querySelector('.lf-plano-plot') as HTMLDivElement;
  plot.getBoundingClientRect = () => ({ left: 0, top: 0, width: plane.width, height: plane.height, right: plane.width, bottom: plane.height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  fireEvent.click(plot, { clientX: ((x - plane.xMin) / (plane.xMax - plane.xMin)) * plane.width, clientY: ((plane.yMax - y) / (plane.yMax - plane.yMin)) * plane.height });
};
const pegPlane: Plane = { xMin: -0.5, xMax: 4.5, yMin: -0.5, yMax: 4.5, width: 400, height: 400 };
const peg = (x: number, y: number) => tapOn(pegPlane, x, y);
const gridPlane = (columns: number, rows: number): Plane => ({ xMin: 0, xMax: columns, yMin: 0, yMax: rows, width: columns * 60, height: rows * 60 });
const square = (columns: number, rows: number) => (x: number, y: number) => tapOn(gridPlane(columns, rows), x + 0.5, y + 0.5);
const pts = (...pairs: Array<[number, number]>) => pairs.map(([x, y]) => ({ x, y }));

describe('geom2 boards (F2.7 geoboard and area, F2.8 transformations and tessellations)', () => {
  it('registers a board for each of the four segment types', () => {
    expect(FIXTURES.map((id) => horizonteFixture('geom2', id)?.id)).toEqual(FIXTURES);
  });

  it('meets the board contract for one fixture of each board in every locale', async () => {
    for (const fixtureId of ['geoboard-area-six', 'area-l-shape', 'reflect-triangle', 'tile-domino']) await assertBoardContract({ pack: 'geom2', fixtureId, copy: GEOM2_COPY, css: CSS });
  }, 120000);

  it('meets the board contract for the rest', async () => {
    for (const fixtureId of ['geoboard-right-triangle', 'area-staircase', 'translate-parallelogram', 'rotate-quarter', 'mirror-half', 'dilate-center', 'tile-l', 'tile-bump']) {
      await assertBoardContract({ pack: 'geom2', fixtureId, copy: GEOM2_COPY, css: CSS, locales: ['en-US'] });
    }
  }, 120000);

  describe('geoboard (E02)', () => {
    it('starts with no band and Check off', async () => {
      show('geoboard-area-six');
      await ready('Peg cursor');
      expect(status()).toHaveTextContent('Geoboard 5 by 5. Band: 0 pegs. Cursor: 0, 0.');
      expect(button('Check')).toBeDisabled();
      expect(button('Reset')).toBeDisabled();
    });

    it('wraps the band around tapped pegs and submits them in order once it is a simple shape', async () => {
      const grade = show('geoboard-area-six');
      await ready('Peg cursor');
      peg(0, 0);
      peg(3, 0);
      expect(status()).toHaveTextContent('Band: 2 pegs');
      expect(status()).toHaveTextContent('The band needs 3 pegs.');
      expect(button('Check')).toBeDisabled();
      peg(3, 2);
      peg(0, 2);
      expect(status()).toHaveTextContent('Band: 4 pegs. Cursor: 0, 2.');
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ points: pts([0, 0], [3, 0], [3, 2], [0, 2]) }, 'geoboard-area-six', expect.anything()));
    });

    it('says when the band crosses itself and keeps Check off', async () => {
      show('geoboard-area-six');
      await ready('Peg cursor');
      for (const [x, y] of [[0, 0], [2, 2], [2, 0], [0, 2]] as const) peg(x, y);
      expect(status()).toHaveTextContent('The band crosses itself.');
      expect(button('Check')).toBeDisabled();
    });

    it('puts a peg on the cursor with the keyboard, takes it off again and undoes the last peg', async () => {
      show('geoboard-area-six');
      await ready('Peg cursor');
      press('Peg cursor', 'ArrowRight', 2);
      expect(status()).toHaveTextContent('Cursor: 2, 0.');
      fireEvent.keyDown(screen.getByRole('slider', { name: 'Peg cursor' }), { key: 'Enter' });
      expect(status()).toHaveTextContent('Band: 1 pegs');
      fireEvent.click(button('Place peg'));
      expect(status()).toHaveTextContent('Band: 0 pegs');
      peg(1, 1);
      peg(4, 4);
      fireEvent.click(button('Undo'));
      expect(status()).toHaveTextContent('Band: 1 pegs');
      fireEvent.click(button('Reset'));
      expect(status()).toHaveTextContent('Band: 0 pegs. Cursor: 0, 0.');
    });

    it('lists the pegs of the band as a table', async () => {
      show('geoboard-area-six');
      await ready('Peg cursor');
      peg(1, 2);
      peg(3, 4);
      fireEvent.click(button('Show as table'));
      const rows = within(screen.getByRole('table', { name: 'Pegs in the band' })).getAllByRole('row').map((row) => row.textContent);
      expect(rows[0]).toBe('Pegxy');
      expect(rows[1]).toBe('Peg 112');
      expect(rows[2]).toBe('Peg 234');
    });
  });

  describe('area by squares (E22)', () => {
    it('shades a tapped square and clears it with a second tap', async () => {
      show('area-l-shape');
      await ready('Square cursor');
      expect(status()).toHaveTextContent('Grid 5 by 4. Shaded squares: 0.');
      const at = square(5, 4);
      at(1, 1);
      expect(status()).toHaveTextContent('Shaded squares: 1. Cursor: 1, 1.');
      at(1, 1);
      expect(status()).toHaveTextContent('Shaded squares: 0.');
      expect(button('Check')).toBeDisabled();
    });

    it('submits every shaded square', async () => {
      const grade = show('area-l-shape');
      await ready('Square cursor');
      const at = square(5, 4);
      const inside: Array<[number, number]> = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2]];
      for (const [x, y] of inside) at(x, y);
      expect(status()).toHaveTextContent('Shaded squares: 10.');
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ points: pts(...inside) }, 'area-l-shape', expect.anything()));
    });

    it('shades the cursor square with the keyboard', async () => {
      show('area-l-shape');
      await ready('Square cursor');
      press('Square cursor', 'ArrowRight');
      press('Square cursor', 'ArrowUp');
      fireEvent.keyDown(screen.getByRole('slider', { name: 'Square cursor' }), { key: ' ' });
      expect(status()).toHaveTextContent('Shaded squares: 1. Cursor: 1, 1.');
      fireEvent.click(button('Shade square'));
      expect(status()).toHaveTextContent('Shaded squares: 0.');
    });

    it('counts the shaded squares by row in a table with a total', async () => {
      show('area-l-shape');
      await ready('Square cursor');
      const at = square(5, 4);
      for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 2]] as const) at(x, y);
      fireEvent.click(button('Show as table'));
      const rows = within(screen.getByRole('table', { name: 'Shaded squares by row' })).getAllByRole('row').map((row) => row.textContent);
      expect(rows).toEqual(['RowShaded', 'Row 40', 'Row 31', 'Row 20', 'Row 13', 'Total4']);
    });
  });

  describe('transformations and symmetry (E06, E07, E09)', () => {
    it('writes the rule and the corners of the image, which starts on the figure', async () => {
      show('reflect-triangle');
      await ready("Image of A");
      expect(status()).toHaveTextContent("Rule: reflect across the line x = 0. Image corners: A' (1, 1); B' (3, 1); C' (1, 4).");
      expect(button('Check')).toBeDisabled();
      expect(button('Reset')).toBeDisabled();
    });

    it('moves each corner with the keyboard and submits the image', async () => {
      const grade = show('reflect-triangle');
      await ready('Image of A');
      press('Image of A', 'ArrowLeft', 2);
      press('Image of B', 'ArrowLeft', 6);
      press('Image of C', 'ArrowLeft', 2);
      expect(status()).toHaveTextContent("A' (-1, 1); B' (-3, 1); C' (-1, 4)");
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ points: pts([-1, 1], [-3, 1], [-1, 4]) }, 'reflect-triangle', expect.anything()));
    });

    it('places the chosen corner where the plane is tapped, to the nearest lattice point', async () => {
      show('reflect-triangle');
      await ready('Image of A');
      tapOn({ xMin: -6, xMax: 6, yMin: -6, yMax: 6, width: 420, height: 420 }, -1.8, 3.2);
      expect(status()).toHaveTextContent("A' (-2, 3); B' (3, 1); C' (1, 4)");
      expect(button('Reset')).toBeEnabled();
      fireEvent.click(button('Reset'));
      expect(status()).toHaveTextContent("A' (1, 1)");
    });

    it('refuses to check an image with two corners on one point', async () => {
      show('reflect-triangle');
      await ready('Image of A');
      press('Image of A', 'ArrowRight', 2);
      expect(status()).toHaveTextContent('Two corners are on the same point.');
      expect(button('Check')).toBeDisabled();
    });

    it('lists the figure and image corners as a table', async () => {
      show('reflect-triangle');
      await ready('Image of A');
      press('Image of A', 'ArrowLeft', 2);
      fireEvent.click(button('Show as table'));
      const rows = within(screen.getByRole('table', { name: 'Figure and image corners' })).getAllByRole('row').map((row) => row.textContent);
      expect(rows[1]).toBe('Corner A(1, 1)(-1, 1)');
      expect(rows[2]).toBe('Corner B(3, 1)(3, 1)');
    });

    it('states the rule of each kind of move in words', async () => {
      const cases: Array<[string, string]> = [
        ['translate-parallelogram', 'Rule: slide 5 across and 3 up.'],
        ['rotate-quarter', 'Rule: turn 90 degrees counterclockwise about (0, 0).'],
        ['mirror-half', 'Rule: reflect across the line x = 0.'],
        ['dilate-center', 'Rule: scale by 2 from (1, 1).'],
      ];
      for (const [fixture, rule] of cases) {
        show(fixture);
        await screen.findByRole('slider', { name: 'Image of A' });
        expect(status(), fixture).toHaveTextContent(rule);
        cleanup();
      }
    });
  });

  describe('tessellations (E10)', () => {
    it('starts with an empty floor', async () => {
      show('tile-domino');
      await ready('Tile cursor');
      expect(status()).toHaveTextContent('Floor 4 by 3. Tiles placed: 0. Squares left: 12. Cursor: 0, 0.');
      expect(button('Check')).toBeDisabled();
    });

    it('slides the tile onto a tapped square, takes a placed tile back on a second tap and refuses one that does not fit', async () => {
      show('tile-domino');
      await ready('Tile cursor');
      const at = square(4, 3);
      at(0, 0);
      expect(status()).toHaveTextContent('Tiles placed: 1. Squares left: 10.');
      at(1, 0);
      expect(status()).toHaveTextContent('Tiles placed: 0. Squares left: 12.');
      at(3, 0);
      expect(status()).toHaveTextContent('The tile does not fit here.');
      expect(status()).toHaveTextContent('Tiles placed: 0.');
      at(2, 2);
      expect(status()).not.toHaveTextContent('The tile does not fit here.');
    });

    it('covers the floor and submits where each copy was slid to', async () => {
      const grade = show('tile-domino');
      await ready('Tile cursor');
      const at = square(4, 3);
      const anchors: Array<[number, number]> = [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]];
      for (const [x, y] of anchors) at(x, y);
      expect(status()).toHaveTextContent('Tiles placed: 6. Squares left: 0.');
      check();
      await waitFor(() => expect(grade).toHaveBeenCalledWith({ points: pts(...anchors) }, 'tile-domino', expect.anything()));
    });

    it('moves the cursor and places or removes tiles with the keyboard and the buttons', async () => {
      show('tile-domino');
      await ready('Tile cursor');
      press('Tile cursor', 'ArrowRight', 2);
      fireEvent.keyDown(screen.getByRole('slider', { name: 'Tile cursor' }), { key: 'Enter' });
      expect(status()).toHaveTextContent('Tiles placed: 1. Squares left: 10. Cursor: 2, 0.');
      fireEvent.click(button('Place tile'));
      expect(status()).toHaveTextContent('The tile does not fit here.');
      fireEvent.click(button('Remove last'));
      expect(status()).toHaveTextContent('Tiles placed: 0.');
      expect(button('Remove last')).toBeDisabled();
    });

    it('lists the placed tiles as a table and resets the floor', async () => {
      show('tile-l');
      await ready('Tile cursor');
      const at = square(5, 6);
      at(0, 0);
      at(1, 1);
      fireEvent.click(button('Show as table'));
      const rows = within(screen.getByRole('table', { name: 'Placed tiles' })).getAllByRole('row').map((row) => row.textContent);
      expect(rows.slice(1)).toEqual(['Tile 100', 'Tile 211']);
      fireEvent.click(button('Reset'));
      expect(status()).toHaveTextContent('Tiles placed: 0.');
    });
  });

  it('writes the board in Spanish and in Portuguese', async () => {
    show('geoboard-area-six', 'es-MX');
    await ready('Cursor de clavija');
    expect(status()).toHaveTextContent('Geoplano de 5 por 5. Liga: 0 clavijas. Cursor: 0, 0.');
    cleanup();
    show('tile-domino', 'pt-BR');
    await ready('Cursor do ladrilho');
    expect(status()).toHaveTextContent('Piso de 4 por 3. Ladrilhos colocados: 0. Quadradinhos livres: 12. Cursor: 0, 0.');
    expect(button('Colocar ladrilho')).toBeEnabled();
  });
});
