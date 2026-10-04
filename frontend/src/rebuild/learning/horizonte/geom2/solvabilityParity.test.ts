import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { solveRoute, type BalanceOp, type StartScale } from '../balance/model.generated';
import { GEOM2_SCORERS } from './scorer.generated';

/*
 * The reachability verdicts Forge's solvability checkers and pack gates are held to, read by path from the one fixture
 * coursegen/src/v2/fixtures/horizonte-solvability-parity.json. No import crosses the package boundary, and a checkout without the file
 * skips the suite. The browser's notion of solvable is the same one Core's publish-time key check uses: a key is solvable exactly when
 * the scorer meets the sample it builds, and a balance start exactly when solveRoute finds a route.
 */

type Point = { x: number; y: number };
interface Fixture {
  geoboard: Array<{ size: number; areas: Record<string, number[]> }>;
  tessellation: Array<{ name: string; floor: Point[]; tile: Point[]; moves?: string[]; solvable: boolean }>;
  balance: Array<{ name: string; start: StartScale; ops: BalanceOp[]; solvable: boolean }>;
}

const file = resolve(process.cwd(), '..', 'coursegen/src/v2/fixtures/horizonte-solvability-parity.json');
const present = existsSync(file);
const fixture = (): Fixture => JSON.parse(readFileSync(file, 'utf8')) as Fixture;

const met = (type: string, payload: unknown, rubric: unknown): boolean => {
  const scorer = GEOM2_SCORERS[type]!;
  const segment = { type, payload };
  return scorer.grade(segment as never, scorer.sample(segment as never, rubric as never), rubric as never).verdict === 'met';
};

describe.skipIf(!present)("the Horizonte reachability fixture, under the browser's models", () => {
  it('geoboard: a key is met by the sample exactly when the fixture lists its area', () => {
    for (const { size, areas } of fixture().geoboard) {
      for (const [shape, solvable] of Object.entries(areas)) {
        for (let area = 1; area <= 2 * (size - 1) ** 2 + 1; area += 1) {
          const key = shape === 'any' ? { area2: area } : { area2: area, shape };
          expect(met('math.geoboard.v2', { size }, key), `size ${size} ${shape} ${area}`).toBe(solvable.includes(area));
        }
      }
    }
  });

  it('tessellation: the sample covers the floor exactly when the fixture says, and a search past the pack budget is no cover', () => {
    for (const entry of fixture().tessellation) {
      const payload = { floor: entry.floor, tile: entry.tile, ...(entry.moves === undefined ? {} : { moves: entry.moves }) };
      const copies = entry.floor.length % entry.tile.length === 0 ? entry.floor.length / entry.tile.length : 1;
      expect(met('math.tessellation.v2', payload, { copies }), entry.name).toBe(entry.solvable);
    }
  });

  it('balance: a route of at most sixteen offered moves exists exactly when the fixture says', () => {
    for (const entry of fixture().balance) expect(solveRoute(entry.start, entry.ops) !== null, entry.name).toBe(entry.solvable);
  });
});
