import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { solveRoute, type BalanceOp, type StartScale } from '../../services/horizonte/balance/model.js';
import { horizonteSampleVerdict } from '../../services/horizonte/index.js';

/*
 * The reachability verdicts Forge's solvability checkers and pack gates are held to, read by relative path from the one fixture
 * coursegen/src/v2/fixtures/horizonte-solvability-parity.json. No import crosses the service boundary, and a checkout without the file
 * skips the suite. Core's own notion of solvable is the sample the publish-time key check builds: a key is solvable exactly when the
 * scorer meets that sample, and a balance start exactly when solveRoute finds a route.
 */

type Point = { x: number; y: number };
interface Fixture {
  geoboard: Array<{ size: number; areas: Record<string, number[]> }>;
  tessellation: Array<{ name: string; floor: Point[]; tile: Point[]; moves?: string[]; solvable: boolean }>;
  balance: Array<{ name: string; start: StartScale; ops: BalanceOp[]; solvable: boolean }>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, '../../../../coursegen/src/v2/fixtures/horizonte-solvability-parity.json');
const present = existsSync(file);
const fixture = (): Fixture => JSON.parse(readFileSync(file, 'utf8')) as Fixture;

describe.skipIf(!present)('the Horizonte reachability fixture, under Core\'s models', () => {
  it('geoboard: a key is met by the sample exactly when the fixture lists its area', () => {
    for (const { size, areas } of fixture().geoboard) {
      const target = { type: 'math.geoboard.v2', payload: { size } };
      for (const [shape, solvable] of Object.entries(areas)) {
        for (let area = 1; area <= 2 * (size - 1) ** 2 + 1; area += 1) {
          const key = shape === 'any' ? { area2: area } : { area2: area, shape };
          expect(horizonteSampleVerdict(target, key) === 'met', `size ${size} ${shape} ${area}`).toBe(solvable.includes(area));
        }
      }
    }
  });

  it('tessellation: the sample covers the floor exactly when the fixture says, and a search past the pack budget is no cover', () => {
    for (const entry of fixture().tessellation) {
      const target = { type: 'math.tessellation.v2', payload: { floor: entry.floor, tile: entry.tile, ...(entry.moves === undefined ? {} : { moves: entry.moves }) } };
      const copies = entry.floor.length % entry.tile.length === 0 ? entry.floor.length / entry.tile.length : 1;
      expect(horizonteSampleVerdict(target, { copies }) === 'met', entry.name).toBe(entry.solvable);
    }
  });

  it('balance: a route of at most sixteen offered moves exists exactly when the fixture says', () => {
    for (const entry of fixture().balance) expect(solveRoute(entry.start, entry.ops) !== null, entry.name).toBe(entry.solvable);
  });
});
