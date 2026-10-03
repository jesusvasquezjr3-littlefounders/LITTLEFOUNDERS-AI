import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURE_EMITTED_HORIZONTE } from '../../v2/cli.js';
import { horizontePieceGates } from '../../v2/horizonte/index.js';
import { area2, isShape } from '../../v2/horizonte/geom2.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';

const GEOBOARD = 'math.geoboard.v2';
const AREA = 'math.area-squares.v2';
const TRANSFORM = 'math.transform.v2';
const TESSELLATION = 'math.tessellation.v2';
const PROOF = 'math.visual-proof.v2';
const TYPES = [GEOBOARD, AREA, TRANSFORM, TESSELLATION, PROOF];

type P = { x: number; y: number };
const p = (x: number, y: number): P => ({ x, y });
const pts = (...list: Array<[number, number]>): P[] => list.map(([x, y]) => p(x, y));

const VISUAL: Record<string, string> = { [GEOBOARD]: 'geoboard', [AREA]: 'area-squares', [TRANSFORM]: 'transform-plane', [TESSELLATION]: 'tessellation' };
const segment = (type: string, payload: unknown, visual = VISUAL[type] ?? 'parallelogram-area') => ({ id: 'seg-geom', type, grading: 'server', visual: { type: visual }, payload });
type Segment = ReturnType<typeof segment>;
const findings = (target: Segment, key?: unknown, nodeBudget?: number) =>
  runSolvabilityGate({ segments: [target] }, key === undefined ? undefined : { [target.id]: key }, nodeBudget === undefined ? {} : { nodeBudget });
const codes = (target: Segment, key?: unknown, nodeBudget?: number) => findings(target, key, nodeBudget).map((finding) => finding.code).sort();
const kinds = (target: Segment, key?: unknown, nodeBudget?: number) => [...new Set(codes(target, key, nodeBudget))];
const messages = (target: Segment, key?: unknown) => findings(target, key).map((finding) => finding.message);
const pack = (target: Segment, key?: unknown) => horizontePieceGates({ segments: [target] }, key === undefined ? undefined : { [target.id]: key });

const geoboard = (size: unknown) => segment(GEOBOARD, { size });
const lShape = { columns: 5, rows: 4, outline: pts([0, 0], [4, 0], [4, 2], [2, 2], [2, 3], [0, 3]) };
const lCells = pts([0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [3, 0], [3, 1]);
const triangle = pts([1, 1], [3, 1], [1, 4]);
const reflectPayload = { extent: 5, figure: triangle, move: { kind: 'reflect', across: 'vertical', at: 0 } };
const reflectImage = pts([-1, 1], [-3, 1], [-1, 4]);
const bump = { floor: pts([0, 0], [1, 0], [2, 0], [1, 1], [4, 0], [5, 0], [6, 0], [5, 1], [2, 1], [3, 1], [4, 1], [3, 2], [6, 1], [7, 1], [8, 1], [7, 2]), tile: pts([0, 0], [1, 0], [2, 0], [1, 1]) };
const domino = { floor: pts([0, 0], [1, 0], [2, 0], [3, 0]), tile: pts([0, 0], [1, 0]) };
const turned = { floor: pts([0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2]), tile: pts([0, 0], [1, 0], [0, 1]) };
const flipped = { floor: pts([1, 0], [2, 0], [0, 1], [1, 1], [3, 0], [4, 0], [2, 1], [3, 1], [5, 0], [6, 0], [6, 1], [7, 1]), tile: pts([1, 0], [2, 0], [0, 1], [1, 1]) };
const tess = (payload: unknown) => segment(TESSELLATION, payload);
const transform = (payload: unknown, visual = 'transform-plane') => segment(TRANSFORM, payload, visual);
const area = (payload: unknown) => segment(AREA, payload);
const proof = (visual: string, payload: Record<string, unknown>) => segment(PROOF, payload, visual);

const parallelogram = { base: 6, height: 4, slant: 2, choices: ['base-plus-height', 'base-height', 'half-base-height'] };
const circle = { radius: 5, sectors: [8, 16, 32], choices: ['pi-diameter', 'pi-r-squared', 'radius-squared'] };
const pythagoras = { a: 6, b: 8, choices: ['legs-squares-sum', 'legs-sum', 'legs-product'] };

/** One valid document for each of the five types, with its key and the visual its pack gate needs. */
const FIXTURES: Array<{ name: string; target: Segment; key: unknown }> = [
  { name: 'geoboard area only', target: geoboard(5), key: { area2: 12 } },
  { name: 'geoboard right triangle', target: geoboard(5), key: { area2: 8, shape: 'right-triangle' } },
  { name: 'geoboard parallelogram on a small board', target: geoboard(3), key: { area2: 4, shape: 'parallelogram' } },
  { name: 'geoboard biggest band', target: geoboard(8), key: { area2: 98 } },
  { name: 'area L shape', target: area(lShape), key: { required: lCells } },
  { name: 'area L shape, squares in another order', target: area(lShape), key: { required: [...lCells].reverse() } },
  { name: 'transform reflect', target: transform(reflectPayload), key: { required: reflectImage } },
  { name: 'transform reflect, corners in another order', target: transform(reflectPayload), key: { required: [...reflectImage].reverse() } },
  { name: 'transform rotate', target: transform({ extent: 6, figure: pts([1, 1], [4, 1], [1, 3]), move: { kind: 'rotate', degrees: 90, about: p(0, 0) } }), key: { required: pts([-1, 1], [-1, 4], [-3, 1]) } },
  { name: 'transform translate', target: transform({ extent: 6, figure: pts([-4, -2], [-1, -2], [0, 0], [-3, 0]), move: { kind: 'translate', dx: 5, dy: 3 } }), key: { required: pts([1, 1], [4, 1], [5, 3], [2, 3]) } },
  { name: 'transform dilate', target: transform({ extent: 6, figure: pts([2, 1], [3, 1], [2, 3]), move: { kind: 'dilate', num: 2, den: 1, about: p(1, 1) } }), key: { required: pts([3, 1], [5, 1], [3, 5]) } },
  { name: 'symmetry mirror', target: transform({ extent: 5, figure: pts([0, -2], [-3, -1], [-2, 2], [0, 3]), move: { kind: 'reflect', across: 'vertical', at: 0 } }, 'symmetry-mirror'), key: { required: pts([0, -2], [3, -1], [2, 2], [0, 3]) } },
  { name: 'tessellation domino', target: tess(domino), key: { copies: 2 } },
  { name: 'tessellation bump', target: tess(bump), key: { copies: 4 } },
  { name: 'tessellation needing a turn', target: tess({ ...turned, moves: ['slide', 'turn'] }), key: { copies: 4 } },
  { name: 'tessellation needing a flip', target: tess({ ...flipped, moves: ['slide', 'flip'] }), key: { copies: 3 } },
  { name: 'tessellation turn and flip listed, only turn needed', target: tess({ ...turned, moves: ['slide', 'turn', 'flip'] }), key: { copies: 4 } },
  { name: 'proof parallelogram', target: proof('parallelogram-area', parallelogram), key: { choice: 'base-height', value: '24' } },
  { name: 'proof triangle', target: proof('triangle-area', { base: 7, height: 5, apex: 3, choices: ['half-base-height', 'base-height', 'base-plus-height'] }), key: { choice: 'half-base-height', value: '17.5' } },
  { name: 'proof trapezoid', target: proof('trapezoid-area', { top: 4, bottom: 10, height: 6, offset: 2, choices: ['half-sum-bases-height', 'sum-bases-height', 'half-base-height'] }), key: { choice: 'half-sum-bases-height', value: '42' } },
  { name: 'proof circle', target: proof('circle-area', circle), key: { choice: 'pi-r-squared', value: '78.5' } },
  { name: 'proof circumference', target: proof('circumference-unroll', { diameter: 7, choices: ['pi-r-squared', 'pi-diameter', 'pi-radius'] }), key: { choice: 'pi-diameter', value: '21.98' } },
  { name: 'proof pythagoras', target: proof('pythagoras-proof', pythagoras), key: { choice: 'legs-squares-sum', value: '10' } },
  { name: 'proof odd sum', target: proof('odd-sum-proof', { n: 5, choices: ['n-times-n', 'n-plus-n', 'n-times-two'] }), key: { choice: 'n-times-n', value: '25' } },
];

describe('geom2 and balance F0.4 checkers', () => {
  it('registers a checker for each of the five types', () => {
    for (const type of TYPES) expect(registeredSolvabilityTypes(), type).toContain(type);
  });

  describe('fixtures', () => {
    it('pass without a key (release time) and with the key (emit time), and the pack gate agrees', () => {
      for (const { name, target, key } of FIXTURES) {
        expect(findings(target), `${name} without key`).toEqual([]);
        expect(findings(target, key), `${name} with key`).toEqual([]);
        expect(pack(target, key), `${name} pack gate`).toEqual([]);
      }
    });

    it('pass for every committed Horizonte row of the five types', () => {
      type Row = { document: { segments: Array<{ type: string }> }; answer_keys: Record<string, unknown> };
      const rows = JSON.parse(readFileSync(FIXTURE_EMITTED_HORIZONTE, 'utf8')) as Row[];
      const seen = new Set<string>();
      for (const row of rows) {
        const own = row.document.segments.filter((entry) => TYPES.includes(entry.type));
        for (const entry of own) seen.add(entry.type);
        const document = { segments: own } as unknown as Parameters<typeof runSolvabilityGate>[0];
        expect(runSolvabilityGate(document)).toEqual([]);
        expect(runSolvabilityGate(document, row.answer_keys)).toEqual([]);
      }
      expect([...seen].sort()).toEqual([...TYPES].sort());
    });

    it('read the payload alone, so the visual and the prompt never change the verdict', () => {
      const withoutVisual = { ...geoboard(5), visual: undefined };
      expect(findings(withoutVisual as unknown as Segment, { area2: 12 })).toEqual([]);
      expect(findings({ ...tess(domino), visual: { type: 'anything' } }, { copies: 2 })).toEqual([]);
    });
  });

  describe('geoboard', () => {
    it('refuses a payload that is not exactly { size } and a size the board does not draw', () => {
      expect(codes(segment(GEOBOARD, { size: 5, area2: 12 }))).toEqual(['impossible-state']);
      expect(codes(segment(GEOBOARD, {}))).toEqual(['impossible-state']);
      expect(codes(geoboard(9))).toEqual(['out-of-bounds']);
      expect(codes(geoboard(2))).toEqual(['out-of-bounds']);
      expect(codes(geoboard(0))).toEqual(['out-of-bounds']);
      for (const size of [4.5, '5', null, NaN, Infinity, undefined]) expect(codes(geoboard(size)), String(size)).toEqual(['impossible-state']);
    });

    it('refuses a key no band can meet, with the areas the figure does reach in the message', () => {
      expect(kinds(geoboard(5), { area2: 12, shape: 'square' })).toEqual(['no-solution']);
      expect(messages(geoboard(5), { area2: 12, shape: 'square' })[0]).toMatch(/no square of 12 half squares fits a 5-peg board/);
      expect(kinds(geoboard(3), { area2: 7, shape: 'rectangle' })).toEqual(['no-solution']);
      expect(kinds(geoboard(4), { area2: 17, shape: 'right-triangle' })).toEqual(['no-solution']);
      expect(kinds(geoboard(4), { area2: 19, shape: 'right-triangle' })).toEqual(['out-of-bounds']);
    });

    it('refuses a key larger than the board and a malformed key', () => {
      expect(kinds(geoboard(5), { area2: 33 })).toEqual(['out-of-bounds']);
      expect(kinds(geoboard(3), { area2: 9, shape: 'square' })).toEqual(['out-of-bounds']);
      for (const key of [{ area2: 0 }, { area2: 12.5 }, { area2: '12' }, { area2: 12, shape: 'hexagon' }, { area2: 12, shape: 7 }, { target: 12 }, { area2: 12, extra: 1 }, null, 5, []]) {
        expect(kinds(geoboard(5), key), JSON.stringify(key)).toEqual(['impossible-state']);
      }
    });

    it('flags, as a review, a wide figure name that grades the same bands as the narrow one', () => {
      // On a 3-peg board the only rectangle of 8 half squares is the 2 by 2 square.
      const found = findings(geoboard(3), { area2: 8, shape: 'rectangle' });
      expect(found.map((finding) => [finding.code, finding.severity])).toEqual([['ambiguous-solution', 'review']]);
      expect(findings(geoboard(3), { area2: 8, shape: 'square' })).toEqual([]);
      expect(findings(geoboard(5), { area2: 12, shape: 'rectangle' })).toEqual([]);
    });

    it('reaches every area from 1 to the full board on every size, without a key and with each key', () => {
      for (let size = 3; size <= 8; size += 1) {
        const top = 2 * (size - 1) ** 2;
        expect(codes(geoboard(size)), `size ${size}`).toEqual([]);
        for (let a = 1; a <= top; a += 1) expect(codes(geoboard(size), { area2: a }), `size ${size} area ${a}`).toEqual([]);
        expect(kinds(geoboard(size), { area2: top + 1 })).toEqual(['out-of-bounds']);
      }
    });

    it('agrees with a brute force over every peg of the board, for each named figure and area', () => {
      const families = ['triangle', 'right-triangle', 'rectangle', 'square', 'parallelogram'] as const;
      type Family = (typeof families)[number];
      const narrower: Partial<Record<Family, Family>> = { triangle: 'right-triangle', rectangle: 'square', parallelogram: 'rectangle' };
      for (let size = 3; size <= 6; size += 1) {
        const pegs: P[] = [];
        for (let x = 0; x < size; x += 1) for (let y = 0; y < size; y += 1) pegs.push(p(x, y));
        const bands: P[][] = [];
        for (let a = 0; a < pegs.length; a += 1) {
          for (let b = a + 1; b < pegs.length; b += 1) {
            for (let c = b + 1; c < pegs.length; c += 1) {
              const [pa, pb, pc] = [pegs[a]!, pegs[b]!, pegs[c]!];
              if ((pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x) !== 0) bands.push([pa, pb, pc]);
              for (let d = c + 1; d < pegs.length; d += 1) {
                const pd = pegs[d]!;
                const orders = [[pa, pb, pc, pd], [pa, pc, pb, pd], [pa, pb, pd, pc]] as P[][];
                for (const [q0, q1, q2, q3] of orders as [P, P, P, P][]) {
                  if (q0.x + q2.x === q1.x + q3.x && q0.y + q2.y === q1.y + q3.y && area2([q0, q1, q2, q3]) > 0) bands.push([q0, q1, q2, q3]);
                }
              }
            }
          }
        }
        const reach = Object.fromEntries(families.map((family) => [family, new Set<number>()])) as Record<Family, Set<number>>;
        for (const band of bands) for (const family of families) if (isShape(band, family)) reach[family].add(area2(band));
        const maxArea = 2 * (size - 1) ** 2;
        for (const family of families) {
          for (let a = 1; a <= maxArea; a += 1) {
            const stricter = narrower[family];
            const wide = stricter !== undefined && [...bands].some((band) => isShape(band, family) && !isShape(band, stricter) && area2(band) === a);
            const expected = !reach[family].has(a) ? ['no-solution'] : stricter !== undefined && !wide ? ['ambiguous-solution'] : [];
            expect(codes(geoboard(size), { area2: a, shape: family }), `size ${size} ${family} ${a}`).toEqual(expected);
          }
        }
      }
    });

    it('never calls a key unsolvable that the pack gate accepts', () => {
      for (let size = 3; size <= 6; size += 1) {
        for (let a = 1; a <= 2 * (size - 1) ** 2; a += 1) {
          for (const shape of [undefined, 'triangle', 'right-triangle', 'rectangle', 'square', 'parallelogram']) {
            const key = shape === undefined ? { area2: a } : { area2: a, shape };
            if (pack(geoboard(size), key).length === 0) expect(kinds(geoboard(size), key), `size ${size} ${JSON.stringify(key)}`).not.toContain('no-solution');
          }
        }
      }
    });
  });

  describe('area squares', () => {
    it('refuses an outline that is not a simple rectilinear polygon on the grid', () => {
      expect(kinds(area({ ...lShape, outline: pts([0, 0], [4, 0], [0, 3], [0, 1]) }))).toEqual(['impossible-state']);
      expect(kinds(area({ ...lShape, outline: pts([0, 0], [2, 0], [4, 0], [4, 3], [0, 3]) }))).toEqual(['impossible-state']);
      expect(kinds(area({ columns: 4, rows: 4, outline: pts([0, 0], [2, 0], [2, 3], [3, 3], [3, 1], [1, 1], [1, 2], [0, 2]) }))).toEqual(['impossible-state']);
      expect(kinds(area({ ...lShape, outline: pts([0, 0], [4, 0], [4, 0], [4, 3], [0, 3]) }))).toEqual(['impossible-state']);
      expect(messages(area({ ...lShape, outline: pts([0, 0], [4, 0], [0, 3], [0, 1]) }))[0]).toMatch(/does not run along a grid line/);
    });

    it('refuses an outline off the grid, a grid of the wrong size and a payload with extra keys', () => {
      expect(kinds(area({ ...lShape, outline: pts([0, 0], [6, 0], [6, 3], [0, 3]) }))).toEqual(['out-of-bounds']);
      expect(kinds(area({ ...lShape, outline: pts([0, -1], [4, -1], [4, 3], [0, 3]) }))).toEqual(['out-of-bounds']);
      expect(kinds(area({ ...lShape, columns: 9 }))).toEqual(['out-of-bounds']);
      expect(kinds(area({ ...lShape, rows: 1 }))).toEqual(['out-of-bounds']);
      expect(kinds(area({ ...lShape, squares: lCells }))).toEqual(['impossible-state']);
      expect(kinds(area({ ...lShape, outline: pts([0, 0], [4, 0]) }))).toEqual(['impossible-state']);
      expect(kinds(area({ ...lShape, outline: [...lShape.outline.slice(0, 5), { x: 0.5, y: 3 }] }))).toEqual(['impossible-state']);
    });

    it('refuses an outline with more squares than the tool takes', () => {
      expect(kinds(area({ columns: 8, rows: 8, outline: pts([0, 0], [8, 0], [8, 8], [0, 8]) }))).toEqual(['too-large']);
      expect(kinds(area({ columns: 7, rows: 5, outline: pts([0, 0], [7, 0], [7, 5], [0, 5]) }))).toEqual(['too-large']);
      expect(findings(area({ columns: 8, rows: 4, outline: pts([0, 0], [8, 0], [8, 4], [0, 4]) }))).toEqual([]);
    });

    it('checks the key against exactly the squares inside the outline', () => {
      expect(kinds(area(lShape), { required: lCells.slice(1) })).toEqual(['rubric-gap']);
      expect(kinds(area(lShape), { required: [...lCells, p(4, 3)] })).toEqual(['rubric-accepts-invalid']);
      expect(kinds(area(lShape), { required: [...lCells.slice(1), p(4, 3)] })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(kinds(area(lShape), { required: [...lCells, p(9, 9)] })).toEqual(['out-of-bounds', 'rubric-accepts-invalid']);
      expect(kinds(area(lShape), { required: [] })).toEqual(['vacuous-rubric']);
      expect(kinds(area(lShape), { required: [...lCells, lCells[0]!] })).toEqual(['duplicate-id']);
      for (const key of [{ area: 10 }, { required: lCells, extra: 1 }, { required: 'all' }, { required: [{ x: 1 }] }, { required: [[0, 0]] }, null, 3]) {
        expect(kinds(area(lShape), key), JSON.stringify(key)).toEqual(['impossible-state']);
      }
    });

    it('counts the squares of a concave outline by the same set the pack uses', () => {
      const comb = { columns: 6, rows: 3, outline: pts([0, 0], [6, 0], [6, 3], [5, 3], [5, 1], [3, 1], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3]) };
      const cells = pts([0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [0, 1], [0, 2], [2, 1], [2, 2], [5, 1], [5, 2]);
      expect(findings(area(comb), { required: cells })).toEqual([]);
      expect(pack(area(comb), { required: cells })).toEqual([]);
      expect(kinds(area(comb), { required: cells.slice(0, 11) })).toEqual(['rubric-gap']);
    });
  });

  describe('transformations', () => {
    it('refuses a move whose image a learner cannot place', () => {
      expect(kinds(transform({ extent: 5, figure: pts([1, 1], [2, 1], [1, 2]), move: { kind: 'dilate', num: 1, den: 2, about: p(0, 0) } }))).toEqual(['no-solution']);
      expect(kinds(transform({ extent: 3, figure: pts([1, 1], [3, 1], [1, 3]), move: { kind: 'translate', dx: 3, dy: 0 } }))).toEqual(['out-of-bounds']);
      expect(kinds(transform({ extent: 4, figure: pts([1, 1], [2, 1], [1, 2]), move: { kind: 'dilate', num: 4, den: 1, about: p(0, 0) } }))).toEqual(['out-of-bounds']);
    });

    it('refuses a move that leaves the figure where it is', () => {
      expect(kinds(transform({ extent: 5, figure: pts([-1, -1], [1, -1], [1, 1], [-1, 1]), move: { kind: 'rotate', degrees: 90, about: p(0, 0) } }))).toEqual(['impossible-state']);
      expect(kinds(transform({ extent: 5, figure: pts([-1, -1], [1, -1], [1, 1], [-1, 1]), move: { kind: 'rotate', degrees: 180, about: p(0, 0) } }))).toEqual(['impossible-state']);
      expect(kinds(transform({ extent: 5, figure: pts([-1, 0], [1, 0], [0, 2]), move: { kind: 'reflect', across: 'vertical', at: 0 } }))).toEqual(['impossible-state']);
      expect(messages(transform({ extent: 5, figure: pts([-1, -1], [1, -1], [1, 1], [-1, 1]), move: { kind: 'rotate', degrees: 90, about: p(0, 0) } }))[0]).toMatch(/already is the answer/);
    });

    it('refuses a figure that is not a polygon inside the plane, and a payload with extra keys', () => {
      expect(kinds(transform({ extent: 5, figure: pts([0, 0], [2, 2], [2, 0], [0, 2]), move: { kind: 'translate', dx: 1, dy: 0 } }))).toEqual(['impossible-state']);
      expect(kinds(transform({ extent: 5, figure: pts([0, 0], [1, 1], [2, 2]), move: { kind: 'translate', dx: 1, dy: 0 } }))).toEqual(['impossible-state']);
      expect(kinds(transform({ extent: 5, figure: pts([1, 1], [1, 1], [3, 1]), move: { kind: 'translate', dx: 1, dy: 0 } }))).toEqual(['impossible-state']);
      expect(kinds(transform({ extent: 5, figure: pts([1, 1], [6, 1], [1, 3]), move: { kind: 'translate', dx: -1, dy: 0 } }))).toEqual(['out-of-bounds']);
      expect(kinds(transform({ extent: 11, figure: triangle, move: { kind: 'translate', dx: 1, dy: 0 } }))).toEqual(['out-of-bounds']);
      expect(kinds(transform({ ...reflectPayload, image: reflectImage }))).toEqual(['impossible-state']);
      expect(kinds(transform({ ...reflectPayload, figure: pts([1, 1], [3, 1]) }))).toEqual(['impossible-state']);
    });

    it('refuses a move the pack does not describe', () => {
      for (const move of [{ kind: 'spin' }, null, 5, { kind: 'dilate', num: 2, den: 4, about: p(0, 0) }, { kind: 'rotate', degrees: 45, about: p(0, 0) }, { kind: 'translate', dx: 0, dy: 0 }, { kind: 'reflect', across: 'diagonal' }]) {
        expect(kinds(transform({ ...reflectPayload, move })), JSON.stringify(move)).toEqual(['impossible-state']);
      }
    });

    it('checks the key against the one image the move gives, as an unordered set', () => {
      expect(kinds(transform(reflectPayload), { required: triangle })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(kinds(transform(reflectPayload), { required: pts([-1, 1], [-3, 1], [-1, 3]) })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(kinds(transform(reflectPayload), { required: reflectImage.slice(1) })).toEqual(['impossible-state']);
      expect(kinds(transform(reflectPayload), { required: [...reflectImage, p(-2, 2)] })).toEqual(['rubric-accepts-invalid']);
      expect(kinds(transform(reflectPayload), { required: pts([-1, 1], [-3, 1], [-9, 4]) })).toEqual(['out-of-bounds', 'rubric-accepts-invalid', 'rubric-gap']);
      expect(kinds(transform(reflectPayload), { required: [reflectImage[0]!, reflectImage[0]!, reflectImage[1]!, reflectImage[2]!] })).toEqual(['duplicate-id']);
      expect(kinds(transform(reflectPayload), { required: [] })).toEqual(['vacuous-rubric']);
      expect(kinds(transform(reflectPayload), { image: reflectImage })).toEqual(['impossible-state']);
      expect(kinds(transform(reflectPayload), { required: reflectImage, extra: true })).toEqual(['impossible-state']);
    });
  });

  describe('tessellations', () => {
    it('refuses a floor that cannot be whole copies of the tile', () => {
      expect(kinds(tess({ floor: pts([0, 0], [1, 0], [2, 0]), tile: domino.tile }))).toEqual(['no-solution']);
      expect(messages(tess({ floor: pts([0, 0], [1, 0], [2, 0]), tile: domino.tile }))[0]).toMatch(/cannot be whole copies/);
      expect(kinds(tess({ floor: pts([0, 0], [1, 0], [0, 1], [1, 1]), tile: pts([0, 0], [1, 0], [0, 1]) }))).toEqual(['no-solution']);
    });

    it('proves no cover exists by search, by the moves listed', () => {
      expect(kinds(tess({ floor: pts([0, 0], [2, 0]), tile: domino.tile }))).toEqual(['no-solution']);
      expect(kinds(tess({ floor: domino.floor, tile: bump.tile }))).toEqual(['no-solution']);
      expect(messages(tess(turned))[0]).toMatch(/by sliding alone/);
      expect(kinds(tess(turned))).toEqual(['no-solution']);
      expect(messages(tess({ ...turned, moves: ['slide', 'flip'] }))[0]).toMatch(/by the moves listed \(slide, flip\)/);
      expect(kinds(tess({ ...flipped, moves: ['slide', 'turn'] }))).toEqual(['no-solution']);
    });

    it('refuses a floor off the grid, with a cell twice, empty, too big or not a list', () => {
      expect(kinds(tess({ floor: pts([11, 0], [12, 0]), tile: domino.tile }))).toEqual(['out-of-bounds']);
      expect(kinds(tess({ floor: pts([0, -1], [1, -1]), tile: domino.tile }))).toEqual(['out-of-bounds']);
      expect(kinds(tess({ floor: pts([0, 0], [1, 0], [1, 0], [2, 0]), tile: domino.tile }))).toEqual(['overlap']);
      expect(kinds(tess({ floor: [], tile: domino.tile }))).toEqual(['impossible-state']);
      expect(kinds(tess({ floor: 'floor', tile: domino.tile }))).toEqual(['impossible-state']);
      expect(kinds(tess({ floor: [p(0, 0), { x: 1 }], tile: domino.tile }))).toEqual(['impossible-state']);
      const big = Array.from({ length: 50 }, (_, index) => p(index % 10, Math.floor(index / 10)));
      expect(kinds(tess({ floor: big, tile: domino.tile }))).toEqual(['too-large']);
    });

    it('refuses a tile or a move list the pack does not take, and extra keys', () => {
      expect(kinds(tess({ floor: domino.floor, tile: pts([1, 0], [2, 0]) }))).toEqual(['impossible-state']);
      expect(kinds(tess({ floor: domino.floor, tile: pts([0, 0], [2, 0]) }))).toEqual(['impossible-state']);
      expect(kinds(tess({ floor: domino.floor, tile: pts([0, 0]) }))).toEqual(['impossible-state']);
      expect(kinds(tess({ floor: domino.floor }))).toEqual(['impossible-state']);
      expect(kinds(tess({ ...domino, answer: [] }))).toEqual(['impossible-state']);
      for (const moves of [[], ['slide'], ['turn', 'slide'], ['slide', 'flip', 'turn'], ['slide', 'slide'], ['slide', 'spin'], 'turn', null]) {
        expect(kinds(tess({ ...turned, moves })), JSON.stringify(moves)).toEqual(['impossible-state']);
      }
    });

    it('checks the copy count the key states against the one every exact cover takes', () => {
      expect(kinds(tess(domino), { copies: 3 })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(kinds(tess(domino), { copies: 1 })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      for (const key of [{ copies: 0 }, { copies: 2.5 }, { copies: '2' }, { copies: 2, extra: 1 }, { count: 2 }, null, 2]) {
        expect(kinds(tess(domino), key), JSON.stringify(key)).toEqual(['impossible-state']);
      }
    });

    it('finds the same copy count whichever listed move a cover uses', () => {
      for (const [payload, copies] of [[{ ...turned, moves: ['slide', 'turn'] }, 4], [{ ...turned, moves: ['slide', 'turn', 'flip'] }, 4], [{ ...domino, moves: ['slide', 'flip'] }, 2]] as const) {
        expect(findings(tess(payload), { copies })).toEqual([]);
        expect(kinds(tess(payload), { copies: copies + 1 })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      }
    });
  });

  describe('visual proofs', () => {
    it('refuses a pool without the right formula, a foreign formula, a repeat and a count outside 3 to 5', () => {
      expect(kinds(proof('parallelogram-area', { ...parallelogram, choices: ['base-plus-height', 'half-base-height', 'half-base-height'] }))).toEqual(['duplicate-id', 'no-solution']);
      expect(kinds(proof('parallelogram-area', { ...parallelogram, choices: ['base-plus-height', 'half-base-height', 'pi-radius'] }))).toEqual(['impossible-state', 'no-solution']);
      expect(kinds(proof('parallelogram-area', { ...parallelogram, choices: ['base-height', 'base-height', 'half-base-height'] }))).toEqual(['duplicate-id']);
      expect(kinds(proof('parallelogram-area', { ...parallelogram, choices: ['base-height', 'half-base-height'] }))).toEqual(['impossible-state']);
      expect(kinds(proof('circle-area', { ...circle, choices: ['pi-r-squared', 'pi-diameter', 'pi-radius', 'radius-squared', 'x', 'y'] }))).toEqual(['impossible-state']);
      expect(kinds(proof('parallelogram-area', { ...parallelogram, choices: ['base-height', 7, 'half-base-height'] }))).toEqual(['impossible-state']);
      expect(messages(proof('parallelogram-area', { ...parallelogram, choices: ['base-plus-height', 'half-base-height', 'pi-radius'] }))[0]).toMatch(/the right formula for a parallelogram-area \(base-height\) is not among the choices|not a formula of a parallelogram-area/);
    });

    it('refuses a figure whose payload fields are none of the seven', () => {
      expect(kinds(proof('rhombus-area', { ...parallelogram, diagonal: 3 }))).toEqual(['impossible-state']);
      expect(kinds(proof('circumference-unroll', { diameter: 7, radius: 3, choices: ['pi-diameter', 'pi-radius', 'radius-squared'] }))).toEqual(['impossible-state']);
      expect(kinds(proof('parallelogram-area', { base: 6, height: 4, choices: parallelogram.choices }))).toEqual(['impossible-state']);
      expect(kinds(proof('parallelogram-area', {}))).toEqual(['impossible-state']);
    });

    it('refuses a measure outside what the figure draws', () => {
      expect(kinds(proof('parallelogram-area', { ...parallelogram, base: 99 }))).toEqual(['out-of-bounds']);
      expect(kinds(proof('parallelogram-area', { ...parallelogram, slant: 6 }))).toEqual(['out-of-bounds']);
      expect(kinds(proof('pythagoras-proof', { ...pythagoras, b: 7 }))).toEqual(['out-of-bounds']);
      expect(kinds(proof('circle-area', { ...circle, sectors: [8, 7] }))).toEqual(['out-of-bounds']);
      expect(kinds(proof('odd-sum-proof', { n: 9, choices: ['n-times-n', 'n-plus-n', 'n-times-two'] }))).toEqual(['out-of-bounds']);
      expect(kinds(proof('trapezoid-area', { top: 10, bottom: 4, height: 6, offset: 2, choices: ['half-sum-bases-height', 'sum-bases-height', 'half-base-height'] }))).toEqual(['out-of-bounds']);
      for (const base of [NaN, Infinity, '6', null]) expect(kinds(proof('parallelogram-area', { ...parallelogram, base })), String(base)).toEqual(['impossible-state']);
    });

    it('refuses a distractor that gives the same number as the right formula, which the pack gate accepts', () => {
      const coincident: Array<[string, Record<string, unknown>]> = [
        ['parallelogram-area', { base: 2, height: 2, slant: 1, choices: ['base-height', 'base-plus-height', 'half-base-height'] }],
        ['triangle-area', { base: 4, height: 4, apex: 1, choices: ['half-base-height', 'base-plus-height', 'base-height'] }],
        ['circle-area', { radius: 2, sectors: [8, 16], choices: ['pi-r-squared', 'pi-diameter', 'radius-squared'] }],
        ['circle-area', { radius: 1, sectors: [8, 16], choices: ['pi-r-squared', 'pi-radius', 'radius-squared'] }],
        ['circumference-unroll', { diameter: 4, choices: ['pi-diameter', 'pi-r-squared', 'pi-radius'] }],
      ];
      for (const [visual, payload] of coincident) {
        expect(kinds(proof(visual, payload)), visual).toEqual(['ambiguous-solution']);
        expect(pack(proof(visual, payload)), `${visual} pack`).toEqual([]);
      }
      expect(kinds(proof('circle-area', { radius: 2, sectors: [8, 16], choices: ['pi-r-squared', 'radius-squared', 'pi-radius'] }))).toEqual([]);
    });

    it('checks the key against the formula and the value the figure gives', () => {
      expect(kinds(proof('parallelogram-area', parallelogram), { choice: 'base-height', value: '12' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(kinds(proof('parallelogram-area', parallelogram), { choice: 'half-base-height', value: '24' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(kinds(proof('circle-area', circle), { choice: 'pi-r-squared', value: '78.54' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(kinds(proof('pythagoras-proof', pythagoras), { choice: 'legs-squares-sum', value: '14' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      for (const key of [{ choice: 'base-height' }, { value: '24' }, { choice: 'base-height', value: 24 }, { choice: 'base-height', value: '24', extra: 1 }, { choice: 'base-height', value: 'twenty' }, { choice: 'base-height', value: '24.123' }, { choice: 'base-height', value: '-24' }, null, 24]) {
        expect(kinds(proof('parallelogram-area', parallelogram), key), JSON.stringify(key)).toEqual(['impossible-state']);
      }
    });

    it('reads the value as a number, like the grader, so 24.0 and 24.00 are the same key as 24', () => {
      expect(findings(proof('parallelogram-area', parallelogram), { choice: 'base-height', value: '24.0' })).toEqual([]);
      expect(findings(proof('circle-area', circle), { choice: 'pi-r-squared', value: '78.50' })).toEqual([]);
    });
  });

  describe('hostile payloads', () => {
    const NEVER_VALID: unknown[] = [
      null, undefined, NaN, Infinity, -Infinity, 1e308, -1e308, 'x', '', true, [], {}, [null], [[]], [{}],
      Array.from({ length: 5000 }, () => 0), Array.from({ length: 5000 }, () => p(0, 0)), JSON.parse(`${'['.repeat(300)}${']'.repeat(300)}`) as unknown,
    ];
    const BASES: Array<[string, Segment]> = [
      ['geoboard', geoboard(5)], ['area', area(lShape)], ['transform', transform(reflectPayload)], ['tessellation', tess({ ...turned, moves: ['slide', 'turn'] })],
      ['proof parallelogram', proof('parallelogram-area', parallelogram)], ['proof circle', proof('circle-area', circle)], ['proof pythagoras', proof('pythagoras-proof', pythagoras)],
    ];
    const KEYS: Record<string, unknown> = {
      geoboard: { area2: 12 }, area: { required: lCells }, transform: { required: reflectImage }, tessellation: { copies: 4 },
      'proof parallelogram': { choice: 'base-height', value: '24' }, 'proof circle': { choice: 'pi-r-squared', value: '78.5' }, 'proof pythagoras': { choice: 'legs-squares-sum', value: '10' },
    };

    it('blocks, quickly and without a checker-error, every field replaced by a value that is never valid', () => {
      const started = performance.now();
      for (const [name, base] of BASES) {
        for (const field of Object.keys(base.payload as Record<string, unknown>)) {
          for (const bad of NEVER_VALID) {
            const mutated = { ...base, payload: { ...(base.payload as Record<string, unknown>), [field]: bad } };
            for (const key of [undefined, KEYS[name]]) {
              const found = findings(mutated, key);
              expect(found.some((finding) => finding.code === 'checker-error'), `${name}.${field}=${String(bad).slice(0, 20)}`).toBe(false);
              expect(found.some((finding) => finding.severity === 'block'), `${name}.${field}=${String(bad).slice(0, 20)}`).toBe(true);
            }
          }
        }
      }
      expect(performance.now() - started).toBeLessThan(5000);
    });

    it('blocks a payload that is missing, not an object or full of unknown keys', () => {
      for (const [name, base] of BASES) {
        for (const payload of [null, undefined, 5, 'x', [], {}, { __proto__: null, constructor: 1 }, { toString: 1 }]) {
          const found = findings({ ...base, payload } as Segment);
          expect(found.some((finding) => finding.code === 'checker-error'), name).toBe(false);
          expect(found.some((finding) => finding.severity === 'block'), name).toBe(true);
        }
      }
    });

    it('never throws on a hostile key', () => {
      const hostile = [null, 5, 'x', [], [1, 2], {}, { required: null }, { required: [null] }, { required: Array.from({ length: 5000 }, () => p(0, 0)) }, { copies: NaN }, { copies: 1e308 }, { choice: {}, value: [] }, { area2: NaN }, { area2: 1e308, shape: [] }];
      for (const [name, base] of BASES) {
        for (const key of hostile) {
          const found = findings(base, key);
          expect(found.some((finding) => finding.code === 'checker-error'), `${name} ${JSON.stringify(key)?.slice(0, 30)}`).toBe(false);
        }
      }
    });
  });

  describe('budget', () => {
    it('reports a budget issue, fast, when the geoboard reach would need more than the node budget', () => {
      const started = performance.now();
      const found = findings(geoboard(8), undefined, 1000);
      expect(found.map((finding) => finding.code)).toEqual(['budget-exceeded']);
      expect(found[0]!.severity).toBe('block');
      expect(codes(geoboard(5), { area2: 12 }, 100)).toEqual(['budget-exceeded']);
      expect(performance.now() - started).toBeLessThan(500);
      expect(codes(geoboard(3), { area2: 5 }, 2000)).toEqual([]);
    });

    it('reports a budget issue, not no-solution, when the cover search runs out of steps', () => {
      const started = performance.now();
      expect(codes(tess({ ...turned, moves: ['slide', 'turn'] }), undefined, 2)).toEqual(['budget-exceeded']);
      expect(codes(tess(bump), { copies: 4 }, 3)).toEqual(['budget-exceeded']);
      expect(performance.now() - started).toBeLessThan(500);
      expect(codes(tess({ ...turned, moves: ['slide', 'turn'] }), { copies: 4 })).toEqual([]);
    });

    it('proves no cover inside a small budget as no-solution, never as budget-exceeded', () => {
      expect(codes(tess({ floor: pts([0, 0], [2, 0]), tile: domino.tile }), undefined, 50)).toEqual(['no-solution']);
    });

    it('stays inside the budget on a floor that takes a real search, and the boundary is exact', () => {
      // A 5 by 5 floor with its far corner missing: 24 cells, whole copies of the 3-cell L, but no cover exists, and the search needs 105 steps to know.
      const floor = Array.from({ length: 25 }, (_, index) => p(index % 5, Math.floor(index / 5))).filter((cell) => !(cell.x === 4 && cell.y === 4));
      const hard = tess({ floor, tile: pts([0, 0], [1, 0], [0, 1]), moves: ['slide', 'turn', 'flip'] });
      const started = performance.now();
      expect(codes(hard)).toEqual(['no-solution']);
      expect(codes(hard, undefined, 105)).toEqual(['no-solution']);
      expect(codes(hard, undefined, 104)).toEqual(['budget-exceeded']);
      expect(codes(hard, undefined, 40)).toEqual(['budget-exceeded']);
      expect(performance.now() - started).toBeLessThan(1000);
    });

    it('treats a budget below 1 as the default, so a zero never skips a proof', () => {
      expect(codes(geoboard(8), undefined, 0)).toEqual([]);
      expect(codes(tess(domino), { copies: 2 }, -5)).toEqual([]);
    });
  });
});
