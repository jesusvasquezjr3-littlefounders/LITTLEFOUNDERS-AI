import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GEOM2_COVER_BUDGET, coverSearch } from '../../v2/horizonte/geom2.js';
import { horizontePieceGates } from '../../v2/horizonte/index.js';
import '../../v2/solvabilityPacks.js';
import { DEFAULT_NODE_BUDGET, runSolvabilityGate } from '../../v2/solvability.js';

/*
 * The shared fixture holds the verdicts of the Horizonte reachability models, written once and read by relative path by Forge (here), Core
 * (backend/src/__tests__/horizonte/solvabilityParity.test.ts) and the browser scorer (frontend geom2/solvabilityParity.test.ts). Each side
 * compares its own verdict with the file, so a model that drifts from the others fails in the package that drifted.
 */

type Point = { x: number; y: number };
type Pan = { x: number; u: number };
interface Fixture {
  geoboard: Array<{ size: number; areas: Record<string, number[]> }>;
  tessellation: Array<{ name: string; floor: Point[]; tile: Point[]; moves?: string[]; solvable: boolean; steps?: number }>;
  balance: Array<{ name: string; start: { l: Pan; r: Pan }; ops: string[]; x: number; solvable: boolean }>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(path.resolve(here, '../../v2/fixtures/horizonte-solvability-parity.json'), 'utf8')) as Fixture;

const segment = (type: string, visual: string, payload: unknown) => ({ id: 'seg-parity', type, grading: 'server', visual: { type: visual }, payload });
type Segment = ReturnType<typeof segment>;
const checkerSolvable = (target: Segment, key: unknown): boolean =>
  !runSolvabilityGate({ segments: [target] }, { [target.id]: key }).some((finding) => finding.severity === 'block');
const packSolvable = (target: Segment, key: unknown): boolean => horizontePieceGates({ segments: [target] }, { [target.id]: key }).length === 0;

describe('the Horizonte reachability fixture, under the Forge checkers and pack gates', () => {
  it('holds every board size and a verdict for every key of each', () => {
    expect(fixture.geoboard.map((board) => board.size)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(fixture.tessellation.some((entry) => entry.solvable) && fixture.tessellation.some((entry) => !entry.solvable)).toBe(true);
    expect(fixture.balance.some((entry) => entry.solvable) && fixture.balance.some((entry) => !entry.solvable)).toBe(true);
  });

  it('keeps each floor that lists its steps between the pack budget and the checker default, so it stays the boundary case', () => {
    const between = fixture.tessellation.filter((entry) => entry.steps !== undefined);
    expect(between.length).toBeGreaterThan(0);
    for (const entry of between) {
      const moves = entry.moves ?? ['slide'];
      expect(entry.solvable, entry.name).toBe(false);
      expect(coverSearch(entry.floor, entry.tile, moves, GEOM2_COVER_BUDGET), entry.name).toMatchObject({ covered: false, exhausted: true });
      expect(coverSearch(entry.floor, entry.tile, moves, DEFAULT_NODE_BUDGET), entry.name).toMatchObject({ covered: true, steps: entry.steps });
      expect(entry.steps!).toBeGreaterThan(GEOM2_COVER_BUDGET);
      expect(entry.steps!).toBeLessThan(DEFAULT_NODE_BUDGET);
    }
  });

  it('geoboard: a key is solvable exactly when the fixture lists its area, for the checker and the pack gate alike', () => {
    for (const { size, areas } of fixture.geoboard) {
      const target = segment('math.geoboard.v2', 'geoboard', { size });
      for (const [shape, solvable] of Object.entries(areas)) {
        for (let area = 1; area <= 2 * (size - 1) ** 2 + 1; area += 1) {
          const key = shape === 'any' ? { area2: area } : { area2: area, shape };
          const label = `size ${size} ${shape} ${area}`;
          expect(checkerSolvable(target, key), `${label} checker`).toBe(solvable.includes(area));
          expect(packSolvable(target, key), `${label} pack gate`).toBe(solvable.includes(area));
        }
      }
    }
  });

  it('tessellation: a floor is solvable exactly when the fixture says, and one only a search past the pack budget finishes is not', () => {
    for (const entry of fixture.tessellation) {
      const target = segment('math.tessellation.v2', 'tessellation', { floor: entry.floor, tile: entry.tile, ...(entry.moves === undefined ? {} : { moves: entry.moves }) });
      const copies = entry.floor.length % entry.tile.length === 0 ? entry.floor.length / entry.tile.length : 1;
      expect(checkerSolvable(target, { copies }), `${entry.name} checker`).toBe(entry.solvable);
      expect(packSolvable(target, { copies }), `${entry.name} pack gate`).toBe(entry.solvable);
    }
  });

  it('balance: a start is solvable exactly when the fixture says, at the sixteen-move limit too', () => {
    for (const entry of fixture.balance) {
      const target = segment('math.equation-balance.v2', 'equation-balance', { start: entry.start, ops: entry.ops });
      expect(checkerSolvable(target, { x: entry.x }), `${entry.name} checker`).toBe(entry.solvable);
      expect(packSolvable(target, { x: entry.x }), `${entry.name} pack gate`).toBe(entry.solvable);
    }
  });
});
