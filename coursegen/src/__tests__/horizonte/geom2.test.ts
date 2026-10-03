import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { GEOM2_CAPABILITIES, geom2 } from '../../v2/horizonte/geom2.js';

type P = { x: number; y: number };
const p = (x: number, y: number): P => ({ x, y });
const pts = (...list: Array<[number, number]>): P[] => list.map(([x, y]) => p(x, y));
const doc = (type: string, visual: string, payload: unknown) => ({ segments: [{ id: 'seg-geom', type, visual: { type: visual }, payload }] });
const gate = (document: ReturnType<typeof doc>, secret?: unknown) => horizontePieceGates(document, secret === undefined ? undefined : { 'seg-geom': secret });
const messages = (document: ReturnType<typeof doc>, secret?: unknown) => gate(document, secret).map((problem) => problem.message);

const GEOBOARD = 'math.geoboard.v2';
const AREA = 'math.area-squares.v2';
const TRANSFORM = 'math.transform.v2';
const TESSELLATION = 'math.tessellation.v2';

const lShape = { columns: 5, rows: 4, outline: pts([0, 0], [4, 0], [4, 2], [2, 2], [2, 3], [0, 3]) };
const lCells = pts([0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [3, 0], [3, 1]);
const triangle = pts([1, 1], [3, 1], [1, 4]);
const reflect = { extent: 5, figure: triangle, move: { kind: 'reflect', across: 'vertical', at: 0 } };
const bump = { floor: pts([0, 0], [1, 0], [2, 0], [1, 1], [4, 0], [5, 0], [6, 0], [5, 1], [2, 1], [3, 1], [4, 1], [3, 2], [6, 1], [7, 1], [8, 1], [7, 2]), tile: pts([0, 0], [1, 0], [2, 0], [1, 1]) };
const domino = { floor: pts([0, 0], [1, 0], [2, 0], [3, 0]), tile: pts([0, 0], [1, 0]) };
const turned = { floor: pts([0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2]), tile: pts([0, 0], [1, 0], [0, 1]) };
const flipped = { floor: pts([1, 0], [2, 0], [0, 1], [1, 1], [3, 0], [4, 0], [2, 1], [3, 1], [5, 0], [6, 0], [6, 1], [7, 1]), tile: pts([1, 0], [2, 0], [0, 1], [1, 1]) };

describe('geom2 pack in the Forge (F2.7 geoboard and area, F2.8 transformations and tessellations)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    for (const type of [GEOBOARD, AREA, TRANSFORM, TESSELLATION]) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(GEOM2_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(GEOM2_CAPABILITIES[type]);
    }
    expect(HORIZONTE_FORGE_PACKS).toContain(geom2);
  });

  it('adds authoring guidance only when the skeleton uses a type', () => {
    expect(horizonteGuidanceFor([GEOBOARD]).join('\n')).toMatch(/ages 8-12 only/);
    expect(horizonteGuidanceFor([TRANSFORM]).join('\n')).toMatch(/symmetry-mirror/);
    expect(horizonteGuidanceFor([TESSELLATION]).join('\n')).toMatch(/slid only, or also turned half a turn or flipped/);
    expect(horizonteGuidanceFor([AREA]).join('\n')).toMatch(/lower-left corner/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  describe('geoboard', () => {
    it('accepts a board whose key a band can meet, and a document with no key', () => {
      expect(gate(doc(GEOBOARD, 'geoboard', { size: 5 }), { area2: 12 })).toEqual([]);
      expect(gate(doc(GEOBOARD, 'geoboard', { size: 5 }), { area2: 8, shape: 'right-triangle' })).toEqual([]);
      expect(gate(doc(GEOBOARD, 'geoboard', { size: 5 }))).toEqual([]);
    });

    it('refuses a bad payload and an unsolvable key at gate 4', () => {
      expect(gate(doc(GEOBOARD, 'geoboard', { size: 9 }))).toHaveLength(1);
      expect(gate(doc(GEOBOARD, 'geoboard', { size: 5, area2: 12 }))).toHaveLength(1);
      expect(gate(doc(GEOBOARD, 'geoboard', { size: 5 }), { area2: 12, shape: 'square' })[0]).toMatchObject({ gate: 4, segmentId: 'seg-geom' });
      expect(messages(doc(GEOBOARD, 'geoboard', { size: 4 }), { area2: 19 })[0]).toMatch(/fit on the board/);
      expect(messages(doc(GEOBOARD, 'geoboard', { size: 5 }), { area2: 12, shape: 'square' })[0]).toMatch(/cannot be solved/);
      expect(messages(doc(GEOBOARD, 'geoboard', { size: 5 }), { area2: 12, shape: 'hexagon' })[0]).toMatch(/triangle, right-triangle/);
      expect(messages(doc(GEOBOARD, 'geoboard', { size: 5 }), { target: 12 })[0]).toMatch(/band area/);
      expect(messages(doc(GEOBOARD, 'geoboard', { size: 5 }), null)[0]).toMatch(/band area/);
    });
  });

  describe('area by squares', () => {
    it('accepts the outline with exactly the squares inside it as the key', () => {
      expect(gate(doc(AREA, 'area-squares', lShape), { required: lCells })).toEqual([]);
      expect(gate(doc(AREA, 'area-squares', lShape))).toEqual([]);
    });

    it('refuses an outline off the grid lines, too large, and a key that is not the squares inside', () => {
      expect(messages(doc(AREA, 'area-squares', { ...lShape, outline: pts([0, 0], [4, 0], [0, 3], [0, 1]) }))[0]).toMatch(/simple closed band/);
      expect(messages(doc(AREA, 'area-squares', { ...lShape, outline: pts([0, 0], [2, 0], [4, 0], [4, 3], [0, 3]) }))[0]).toMatch(/turns at every listed corner/);
      expect(messages(doc(AREA, 'area-squares', { columns: 8, rows: 8, outline: pts([0, 0], [8, 0], [8, 8], [0, 8]) }))[0]).toMatch(/1 to 32 squares/);
      expect(messages(doc(AREA, 'area-squares', { ...lShape, outline: pts([0, 0], [6, 0], [6, 3], [0, 3]) }))[0]).toMatch(/inside the grid/);
      expect(messages(doc(AREA, 'area-squares', lShape), { required: lCells.slice(1) })[0]).toMatch(/exactly the squares inside/);
      expect(messages(doc(AREA, 'area-squares', lShape), { required: [...lCells, p(4, 3)] })[0]).toMatch(/exactly the squares inside/);
      expect(messages(doc(AREA, 'area-squares', lShape), { area: 10 })[0]).toMatch(/exactly the squares inside/);
      expect(gate(doc(AREA, 'area-squares', { ...lShape, key: 1 }))).toHaveLength(1);
    });
  });

  describe('transformations', () => {
    it('accepts a figure, its move and the image as the key, for every move', () => {
      expect(gate(doc(TRANSFORM, 'transform-plane', reflect), { required: pts([-1, 1], [-3, 1], [-1, 4]) })).toEqual([]);
      expect(gate(doc(TRANSFORM, 'transform-plane', { extent: 6, figure: pts([1, 1], [4, 1], [1, 3]), move: { kind: 'rotate', degrees: 90, about: p(0, 0) } }), { required: pts([-1, 1], [-1, 4], [-3, 1]) })).toEqual([]);
      expect(gate(doc(TRANSFORM, 'transform-plane', { extent: 6, figure: pts([-4, -2], [-1, -2], [0, 0], [-3, 0]), move: { kind: 'translate', dx: 5, dy: 3 } }), { required: pts([1, 1], [4, 1], [5, 3], [2, 3]) })).toEqual([]);
      expect(gate(doc(TRANSFORM, 'transform-plane', { extent: 6, figure: pts([2, 1], [3, 1], [2, 3]), move: { kind: 'dilate', num: 2, den: 1, about: p(1, 1) } }), { required: pts([3, 1], [5, 1], [3, 5]) })).toEqual([]);
      expect(gate(doc(TRANSFORM, 'symmetry-mirror', { extent: 5, figure: pts([0, -2], [-3, -1], [-2, 2], [0, 3]), move: { kind: 'reflect', across: 'vertical', at: 0 } }), { required: pts([0, -2], [3, -1], [2, 2], [0, 3]) })).toEqual([]);
      expect(gate(doc(TRANSFORM, 'transform-plane', reflect))).toEqual([]);
    });

    it('refuses an image off the pegs, off the plane or equal to the figure, and a key that is not the image', () => {
      expect(messages(doc(TRANSFORM, 'transform-plane', { extent: 3, figure: pts([1, 1], [3, 1], [1, 3]), move: { kind: 'translate', dx: 3, dy: 0 } }))[0]).toMatch(/inside the plane/);
      expect(messages(doc(TRANSFORM, 'transform-plane', { extent: 5, figure: pts([-1, -1], [1, -1], [1, 1], [-1, 1]), move: { kind: 'rotate', degrees: 90, about: p(0, 0) } }))[0]).toMatch(/differ from the figure/);
      expect(messages(doc(TRANSFORM, 'transform-plane', { extent: 5, figure: pts([1, 1], [2, 1], [1, 2]), move: { kind: 'dilate', num: 1, den: 2, about: p(0, 0) } }))[0]).toMatch(/between pegs/);
      expect(messages(doc(TRANSFORM, 'transform-plane', { extent: 5, figure: pts([0, 0], [2, 2], [2, 0], [0, 2]), move: { kind: 'translate', dx: 1, dy: 0 } }))[0]).toMatch(/simple polygon/);
      expect(messages(doc(TRANSFORM, 'transform-plane', { extent: 5, figure: triangle, move: { kind: 'dilate', num: 2, den: 4, about: p(0, 0) } }))[0]).toMatch(/lowest terms/);
      expect(messages(doc(TRANSFORM, 'transform-plane', { extent: 5, figure: triangle, move: { kind: 'spin' } }))[0]).toMatch(/translation, a reflection/);
      expect(messages(doc(TRANSFORM, 'transform-plane', reflect), { required: triangle })[0]).toMatch(/image corners/);
      expect(messages(doc(TRANSFORM, 'transform-plane', reflect), { required: pts([-1, 1], [-3, 1], [-1, 3]) })[0]).toMatch(/image corners/);
      expect(messages(doc(TRANSFORM, 'tessellation', reflect))[0]).toMatch(/transform-plane or symmetry-mirror/);
    });

    it('limits the mirror visual to a vertical or horizontal line with the figure on one side', () => {
      expect(messages(doc(TRANSFORM, 'symmetry-mirror', { extent: 5, figure: pts([-1, 0], [2, 0], [0, 2]), move: { kind: 'reflect', across: 'vertical', at: 0 } }))[0]).toMatch(/one side/);
      expect(messages(doc(TRANSFORM, 'symmetry-mirror', { extent: 5, figure: triangle, move: { kind: 'reflect', across: 'diagonal', at: 0 } }))[0]).toMatch(/one side/);
      expect(messages(doc(TRANSFORM, 'symmetry-mirror', { extent: 5, figure: triangle, move: { kind: 'translate', dx: 1, dy: 0 } }))[0]).toMatch(/one side/);
      expect(gate(doc(TRANSFORM, 'symmetry-mirror', reflect))).toEqual([]);
    });
  });

  describe('tessellations', () => {
    it('accepts a floor built from the tile, and the copy count as the key', () => {
      expect(gate(doc(TESSELLATION, 'tessellation', bump), { copies: 4 })).toEqual([]);
      expect(gate(doc(TESSELLATION, 'tessellation', domino), { copies: 2 })).toEqual([]);
      expect(gate(doc(TESSELLATION, 'tessellation', domino))).toEqual([]);
    });

    it('refuses a tile or floor that breaks the rule, an unsolvable floor and a wrong count', () => {
      expect(messages(doc(TESSELLATION, 'tessellation', { floor: domino.floor, tile: pts([1, 0], [2, 0]) }))[0]).toMatch(/starts at the origin/);
      expect(messages(doc(TESSELLATION, 'tessellation', { floor: domino.floor, tile: pts([0, 0], [2, 0]) }))[0]).toMatch(/touch edge to edge/);
      expect(messages(doc(TESSELLATION, 'tessellation', { floor: pts([0, 0], [1, 0], [2, 0]), tile: domino.tile }))[0]).toMatch(/whole copies/);
      expect(messages(doc(TESSELLATION, 'tessellation', { floor: pts([11, 0], [12, 0]), tile: domino.tile }))[0]).toMatch(/12 by 12/);
      expect(messages(doc(TESSELLATION, 'tessellation', { floor: pts([0, 0], [2, 0]), tile: domino.tile }))[0]).toMatch(/cannot cover the floor/);
      expect(messages(doc(TESSELLATION, 'tessellation', { floor: domino.floor, tile: bump.tile }))[0]).toMatch(/cannot cover the floor/);
      expect(messages(doc(TESSELLATION, 'tessellation', domino), { copies: 3 })[0]).toMatch(/number of copies/);
      expect(messages(doc(TESSELLATION, 'tessellation', domino), { copies: 2, extra: 1 })[0]).toMatch(/number of copies/);
      expect(gate(doc(TESSELLATION, 'tessellation', { ...domino, answer: [] }))).toHaveLength(1);
    });

    it('accepts a floor that needs a half turn or a flip when the moves are listed', () => {
      expect(gate(doc(TESSELLATION, 'tessellation', { ...turned, moves: ['slide', 'turn'] }), { copies: 4 })).toEqual([]);
      expect(gate(doc(TESSELLATION, 'tessellation', { ...turned, moves: ['slide', 'turn', 'flip'] }), { copies: 4 })).toEqual([]);
      expect(gate(doc(TESSELLATION, 'tessellation', { ...flipped, moves: ['slide', 'flip'] }), { copies: 3 })).toEqual([]);
      expect(gate(doc(TESSELLATION, 'tessellation', { ...domino, moves: ['slide', 'flip'] }), { copies: 2 })).toEqual([]);
    });

    it('refuses a floor the listed moves cannot cover, however it was built', () => {
      expect(messages(doc(TESSELLATION, 'tessellation', turned))[0]).toMatch(/cannot cover the floor by sliding alone/);
      expect(messages(doc(TESSELLATION, 'tessellation', { ...turned, moves: ['slide', 'flip'] }))[0]).toMatch(/cannot cover the floor by the moves listed/);
      expect(messages(doc(TESSELLATION, 'tessellation', { ...flipped, moves: ['slide', 'turn'] }))[0]).toMatch(/cannot cover the floor by the moves listed/);
    });

    it('refuses a moves list that is not slide first and then turn, flip or both once each', () => {
      for (const moves of [[], ['slide'], ['turn', 'slide'], ['flip', 'turn'], ['slide', 'flip', 'turn'], ['slide', 'slide'], ['slide', 'spin'], ['slide', 'turn', 'flip', 'slide'], 'turn', null]) {
        expect(messages(doc(TESSELLATION, 'tessellation', { ...turned, moves }))[0], JSON.stringify(moves)).toMatch(/slide first and then turn, flip or both, each once/);
      }
    });

    it('still names the payload keys it accepts', () => {
      expect(messages(doc(TESSELLATION, 'tessellation', { floor: domino.floor }))[0]).toMatch(/floor and the tile.*optionally the moves/);
      expect(messages(doc(TESSELLATION, 'tessellation', { ...domino, moves: ['slide', 'turn'], extra: 1 }))[0]).toMatch(/floor and the tile.*optionally the moves/);
    });
  });

  it('skips types it does not own and a malformed document', () => {
    expect(horizontePieceGates({ segments: [{ id: 'seg-other', type: 'money.allocation.v2', payload: {} }] })).toEqual([]);
    expect(horizontePieceGates({} as never)).toEqual([]);
  });
});
