import { describe, expect, it } from 'vitest';
import { SPACE1_FIXTURES } from '../../../../backend/src/services/horizonte/space1/fixtures.js';
import * as coreCoins from '../../../../backend/src/services/horizonte/space1/coins.js';
import * as corePolyhedra from '../../../../backend/src/services/horizonte/space1/polyhedra.js';
import * as coreStall from '../../../../backend/src/services/horizonte/space1/stall.js';
import * as coreVoxels from '../../../../backend/src/services/horizonte/space1/voxels.js';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { space1, SPACE1_CAPABILITIES } from '../../v2/horizonte/space1.js';
import {
  PLATONIC_COUNTS, PLATONIC_IDS, SECTION_SOLIDS, coinAnswer, coinPositions, congruentByTurning, matchingAngles, mirrorFigure, platonicMesh,
  polyCounts, eulerSum, readCoinPayload, readRotationPayload, readSolidSectionPayload, readStallPayload, rotationAnswer, sameShape, sectionShape,
  solidSectionAnswer, stallAnswer, stallProblem, turnFigure, basketMeets, mostItems, reachableTotals, ROTATION_AXES,
  type Cell, type Plane, type SectionSolid,
} from '../../v2/horizonte/space1Geometry.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';

const ROTATION = 'geometry.mental-rotation.v2';
const SECTION = 'geometry.solid-section.v2';
const STALL = 'money.market-stall.v2';
const COIN = 'money.coin-stack.v2';
const TYPES = [ROTATION, SECTION, STALL, COIN];

const rotation = (payload: Record<string, unknown>, id = 'seg-rotation', visual = 'mental-rotation') => ({ id, type: ROTATION, visual: { type: visual }, payload });
const section = (payload: Record<string, unknown>, id = 'seg-section', visual = 'solid-section') => ({ id, type: SECTION, visual: { type: visual }, payload });
const stall = (payload: Record<string, unknown>, id = 'seg-stall', visual = 'market-stall') => ({ id, type: STALL, visual: { type: visual }, payload });
const coin = (payload: Record<string, unknown>, id = 'seg-coin', visual = 'coin-stack') => ({ id, type: COIN, visual: { type: visual }, payload });
const item = (count: number) => Array.from({ length: count }, () => 'item');

const gates = (...segments: unknown[]) => horizontePieceGates({ segments } as never);
const findings = (segment: { id: string }, key?: unknown) => runSolvabilityGate({ segments: [segment] }, key === undefined ? undefined : { [segment.id]: key });
const codes = (segment: { id: string }, key?: unknown) => findings(segment, key).map((entry) => entry.code).sort();

const FIGURE: Cell[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 0, 1]];
const turned = (axis: 'up' | 'side' | 'depth', quarters: number) => turnFigure(FIGURE, axis, quarters);
const STALL_ITEMS = [{ id: 'apple', price: 50, stock: 5 }, { id: 'bread', price: 120, stock: 3 }, { id: 'juice', price: 80, stock: 4 }];

describe('space1 pack in the Forge (F4.4 rotation, F4.5 sections, F4.6 stall and coins)', () => {
  it('declares the capability literals and the emitter map spreads them', () => {
    expect(SPACE1_CAPABILITIES[ROTATION]).toEqual(['visual.mental-rotation.v1', 'operation.turn-figure.v1', 'operation.pick-match.v1']);
    expect(SPACE1_CAPABILITIES[SECTION]).toEqual(['visual.solid-section.v1', 'operation.turn-solid.v1', 'operation.choose-and-type.v1']);
    expect(SPACE1_CAPABILITIES[STALL]).toEqual(['visual.market-stall.v1', 'operation.buy-items.v1', 'operation.tap-place.v1']);
    expect(SPACE1_CAPABILITIES[COIN]).toEqual(['visual.coin-stack.v1', 'operation.set-count.v1', 'operation.read-scale.v1']);
    for (const type of TYPES) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type as keyof typeof HORIZONTE_FORGE_CAPABILITIES]).toEqual(SPACE1_CAPABILITIES[type as keyof typeof SPACE1_CAPABILITIES]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(SPACE1_CAPABILITIES[type as keyof typeof SPACE1_CAPABILITIES]);
    }
    expect(HORIZONTE_FORGE_PACKS).toContain(space1);
  });

  it('adds authoring guidance only for the types a skeleton uses', () => {
    expect(horizonteGuidanceFor([ROTATION]).join('\n')).toMatch(/exactly one target is the figure turned/);
    expect(horizonteGuidanceFor([SECTION]).join('\n')).toMatch(/Archimedean/);
    expect(horizonteGuidanceFor([STALL]).join('\n')).toMatch(/Many baskets can be right/);
    expect(horizonteGuidanceFor([COIN]).join('\n')).toMatch(/whole number of pieces/);
    expect(horizonteGuidanceFor([COIN]).join('\n')).not.toMatch(/Many baskets/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('registers one solvability checker per type', () => {
    expect(registeredSolvabilityTypes()).toEqual(expect.arrayContaining(TYPES));
  });

  describe('the Forge geometry copy', () => {
    it('turns a figure by quarters and tells a mirror image from a turn', () => {
      expect(turned('up', 4)).toEqual(FIGURE);
      expect(matchingAngles(FIGURE, turned('up', 1), 'up')).toEqual([90]);
      expect(matchingAngles(FIGURE, turned('up', 3), 'up')).toEqual([270]);
      expect(sameShape(FIGURE, turned('up', 2))).toBe(false);
      const mirror = mirrorFigure(FIGURE);
      expect(matchingAngles(FIGURE, mirror, 'up')).toEqual([]);
      expect(congruentByTurning(FIGURE, mirror)).toBe(true);
    });

    it('gives each Platonic solid the counts of its mesh, and Euler holds', () => {
      for (const id of PLATONIC_IDS) {
        expect(polyCounts(platonicMesh(id))).toEqual(PLATONIC_COUNTS[id]);
        expect(eulerSum(PLATONIC_COUNTS[id])).toBe(2);
      }
    });

    it('names the cuts the lessons rely on', () => {
      expect(sectionShape('cube', { normal: [1, 1, 1], offset: 0 })).toBe('hexagon');
      expect(sectionShape('cube', { normal: [1, 0, 0], offset: 0 })).toBe('square');
      expect(sectionShape('tetrahedron', { normal: [1, 0, 0], offset: 0 })).toBe('square');
      expect(sectionShape('cube', { normal: [1, 0, 0], offset: 16 })).toBeNull();
    });

    it('answers the coin goals on whole pieces only', () => {
      expect(coinAnswer(readCoinPayload({ piece: 'coin', value: 100, goal: { kind: 'height', mm: 8 }, step: 1, max: 10 })!)).toBe(4);
      expect(coinAnswer(readCoinPayload({ piece: 'bill', value: 10_000, goal: { kind: 'amount', total: 100_000_000 }, step: 400, max: 12_000 })!)).toBe(10_000);
      expect(coinAnswer(readCoinPayload({ piece: 'coin', value: 100, goal: { kind: 'amount', total: 1550 }, step: 1, max: 30 })!)).toBeNull();
      expect(coinPositions({ step: 400, max: 12_000 })).toHaveLength(31);
    });

    it('prices baskets and finds the biggest bag a budget buys', () => {
      const payload = readStallPayload({ items: STALL_ITEMS, goal: { kind: 'most', budget: 300 } })!;
      expect(mostItems(payload.items, 300)).toBe(5);
      expect(basketMeets(payload, { apple: 5 })).toBe(true);
      expect(basketMeets(payload, { bread: 2 })).toBe(false);
      expect(reachableTotals(payload.items, 250).has(250)).toBe(true);
      expect(reachableTotals(payload.items, 251).has(251)).toBe(false);
    });
  });

  describe('parity with the Core model', () => {
    it('reads and answers every Core fixture the way Core does', () => {
      for (const fixture of SPACE1_FIXTURES) {
        const segment = fixture.segment('en-US') as { type: string; payload: unknown };
        if (segment.type === ROTATION) {
          const payload = readRotationPayload(segment.payload)!;
          const answer = rotationAnswer(payload)!;
          expect(fixture.rubric).toEqual({ pick: answer.pick, angles: answer.angles });
        } else if (segment.type === SECTION) {
          const answer = solidSectionAnswer(readSolidSectionPayload(segment.payload)!)!;
          expect(fixture.rubric).toEqual(answer);
        } else if (segment.type === STALL) {
          const payload = readStallPayload(segment.payload)!;
          expect(stallProblem(payload)).toBeNull();
          expect(basketMeets(payload, stallAnswer(payload)!)).toBe(true);
        } else {
          expect(fixture.rubric).toEqual({ target: String(coinAnswer(readCoinPayload(segment.payload)!)) });
        }
      }
    });

    it('cuts every solid by every plane to the same shape as Core', () => {
      const solids: readonly SectionSolid[] = SECTION_SOLIDS;
      let checked = 0;
      for (const solid of solids) {
        for (let nx = -3; nx <= 3; nx += 1) for (let ny = -3; ny <= 3; ny += 1) for (let nz = -3; nz <= 3; nz += 1) {
          if (nx === 0 && ny === 0 && nz === 0) continue;
          for (let offset = -16; offset <= 16; offset += 4) {
            const plane: Plane = { normal: [nx, ny, nz], offset };
            expect(sectionShape(solid, plane)).toBe(corePolyhedra.sectionShape(solid, plane));
            checked += 1;
          }
        }
      }
      expect(checked).toBe(3 * 342 * 9);
    });

    it('turns and compares figures like Core on every fixture figure and axis', () => {
      for (const fixture of SPACE1_FIXTURES) {
        const segment = fixture.segment('en-US') as { type: string; payload: unknown };
        if (segment.type !== ROTATION) continue;
        const payload = readRotationPayload(segment.payload)!;
        for (const axis of ROTATION_AXES) {
          for (const target of payload.targets) {
            expect(matchingAngles(payload.figure, target, axis)).toEqual(coreVoxels.matchingAngles(payload.figure as never, target as never, axis));
          }
          for (let quarters = 0; quarters < 4; quarters += 1) {
            expect(turnFigure(payload.figure, axis, quarters)).toEqual(coreVoxels.turnFigure(payload.figure as never, axis, quarters));
          }
        }
        expect(congruentByTurning(payload.figure, mirrorFigure(payload.figure))).toBe(coreVoxels.congruentByTurning(payload.figure as never, coreVoxels.mirrorFigure(payload.figure as never)));
      }
    });

    it('answers stalls and coins like Core across the fixtures and their neighbours', () => {
      for (const goal of [{ kind: 'exact', total: 250 }, { kind: 'exact', total: 251 }, { kind: 'change', paid: 600, change: 200 }, { kind: 'most', budget: 300 }, { kind: 'most', budget: 5 }, { kind: 'most', budget: 2000 }]) {
        const value = { items: STALL_ITEMS, goal };
        expect(stallProblem(readStallPayload(value)!)).toBe(coreStall.stallProblem(coreStall.readStallPayload(value)!));
        expect(stallAnswer(readStallPayload(value)!)).toEqual(coreStall.stallAnswer(coreStall.readStallPayload(value)!));
      }
      for (const piece of ['coin', 'bill']) {
        for (const goal of [{ kind: 'amount', total: 1500 }, { kind: 'amount', total: 1550 }, { kind: 'height', mm: 8 }, { kind: 'height', mm: 7 }, { kind: 'height', mm: 1200 }]) {
          const value = { piece, value: 100, goal, step: 2, max: 40 };
          expect(coinAnswer(readCoinPayload(value)!)).toBe(coreCoins.coinAnswer(coreCoins.readCoinPayload(value)!));
          expect(coinPositions(readCoinPayload(value)!)).toEqual(coreCoins.coinPositions(coreCoins.readCoinPayload(value)!));
        }
      }
    });
  });

  describe('piece gates', () => {
    it('accept every Core fixture and a document with no key', () => {
      for (const fixture of SPACE1_FIXTURES) {
        const segment = fixture.segment('en-US') as { id: string };
        expect(gates(segment)).toEqual([]);
        expect(findings(segment)).toEqual([]);
        expect(findings(segment, fixture.rubric)).toEqual([]);
      }
    });

    it('refuse a wrong visual and a long prompt on any of the four boards', () => {
      expect(gates(rotation({ axis: 'up', figure: FIGURE, targets: [turned('up', 1)] }, 'seg-rotation', 'cube-net'))[0]).toMatchObject({ gate: 4, segmentId: 'seg-rotation', message: expect.stringMatching(/mental-rotation/) });
      expect(gates(section({ mode: 'euler', solid: 'cube', hide: 'edges' }, 'seg-section', 'mental-rotation'))[0]?.message).toMatch(/solid-section/);
      expect(gates(stall({ items: STALL_ITEMS, goal: { kind: 'exact', total: 250 } }, 'seg-stall', 'coin-stack'))[0]?.message).toMatch(/market-stall/);
      expect(gates(coin({ piece: 'coin', value: 100, goal: { kind: 'height', mm: 8 }, step: 1, max: 10 }, 'seg-coin', 'market-stall'))[0]?.message).toMatch(/coin-stack/);
      const long = Array.from({ length: 30 }, () => 'word').join(' ');
      expect(gates({ ...coin({ piece: 'coin', value: 100, goal: { kind: 'height', mm: 8 }, step: 1, max: 10 }), prompt: long })[0]?.message).toMatch(/at most 24 words/);
    });

    it('refuse a rotation with no turn, two turns, a changed shape equal to the figure or a malformed payload', () => {
      expect(gates(rotation({ axis: 'up', figure: FIGURE, targets: [mirrorFigure(FIGURE)] }))[0]?.message).toMatch(/turned about the axis/);
      expect(gates(rotation({ axis: 'up', figure: FIGURE, targets: [turned('up', 1), turned('up', 3)] }))[0]?.message).toMatch(/Exactly one target/);
      expect(gates(rotation({ axis: 'up', figure: FIGURE, targets: [FIGURE] }))[0]?.message).toMatch(/must differ from the figure/);
      expect(gates(rotation({ axis: 'up', figure: FIGURE, targets: [turned('up', 1), turned('side', 1)] }))[0]?.message).toMatch(/must not be a turn of the figure/);
      expect(gates(rotation({ axis: 'up', figure: [[0, 0, 0], [2, 2, 2], [1, 0, 0]], targets: [turned('up', 1)] }))[0]?.message).toMatch(/one piece/);
      expect(gates(rotation({ axis: 'left', figure: FIGURE, targets: [] }))[0]?.message).toMatch(/mental rotation payload/);
    });

    it('refuse a section that misses the solid, hides the cut, offers two answers or has a volume that is not whole', () => {
      expect(gates(section({ mode: 'section', solid: 'cube', plane: { normal: [1, 0, 0], offset: 16 }, options: ['triangle', 'square'] }))[0]?.message).toMatch(/must cut through/);
      expect(gates(section({ mode: 'section', solid: 'cube', plane: { normal: [1, 1, 1], offset: 0 }, options: ['triangle', 'rectangle'] }))[0]?.message).toMatch(/options must include/);
      expect(gates(section({ mode: 'section', solid: 'cube', plane: { normal: [1, 0, 0], offset: 0 }, options: ['square', 'rectangle'] }))[0]?.message).toMatch(/two answers/);
      expect(gates(section({ mode: 'volume', side: 5, height: 4 }))[0]?.message).toMatch(/divide by 3/);
      expect(gates(section({ mode: 'volume', side: 5, height: 6 }))).toEqual([]);
      expect(gates(section({ mode: 'cone', side: 5 }))[0]?.message).toMatch(/solid section payload/);
    });

    it('refuse a stall nobody can fill and a coin goal off the whole pieces', () => {
      expect(gates(stall({ items: STALL_ITEMS, goal: { kind: 'exact', total: 251 } }))[0]?.message).toMatch(/No basket/);
      expect(gates(stall({ items: STALL_ITEMS, goal: { kind: 'exact', total: 5000 } }))[0]?.message).toMatch(/does not hold enough/);
      expect(gates(stall({ items: STALL_ITEMS, goal: { kind: 'most', budget: 5 } }))[0]?.message).toMatch(/cheapest/);
      expect(gates(stall({ items: STALL_ITEMS, goal: { kind: 'most', budget: 1000 } }))[0]?.message).toMatch(/whole stall/);
      expect(gates(stall({ items: [STALL_ITEMS[0]], goal: { kind: 'exact', total: 50 } }))[0]?.message).toMatch(/market stall payload/);
      expect(gates(coin({ piece: 'coin', value: 100, goal: { kind: 'amount', total: 1550 }, step: 1, max: 30 }))[0]?.message).toMatch(/whole number of pieces/);
      expect(gates(coin({ piece: 'coin', value: 100, goal: { kind: 'amount', total: 1500 }, step: 4, max: 40 }))[0]?.message).toMatch(/multiple of the step/);
      expect(gates(coin({ piece: 'coin', value: 100, goal: { kind: 'amount', total: 9000 }, step: 1, max: 40 }))[0]?.message).toMatch(/between one step and the maximum/);
      expect(gates(coin({ piece: 'sock' }))[0]?.message).toMatch(/coin stack payload/);
    });
  });

  describe('solvability checkers', () => {
    it('prove a rotation has one turning target and judge the key', () => {
      const ok = rotation({ axis: 'up', figure: FIGURE, targets: [turned('up', 1)] });
      expect(findings(ok, { pick: 'a', angles: [90] })).toEqual([]);
      expect(findings(ok)).toEqual([]);
      expect(codes(ok, { pick: 'a', angles: [180] })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(ok, { pick: 'c', angles: [90] })).toEqual(['rubric-accepts-invalid']);
      expect(codes(ok, { pick: 'a' })).toEqual(['impossible-state']);
      expect(codes(rotation({ axis: 'up', figure: FIGURE, targets: [mirrorFigure(FIGURE)] }))).toEqual(['no-solution']);
      expect(codes(rotation({ axis: 'up', figure: FIGURE, targets: [turned('up', 1), turned('up', 3)] }))).toEqual(['ambiguous-solution']);
      expect(codes(rotation({ axis: 'up', figure: FIGURE, targets: [turned('up', 1), turned('side', 1)] }))).toEqual(['ambiguous-solution']);
      expect(codes(rotation({ axis: 'up', figure: FIGURE, targets: [FIGURE] }))).toEqual(['impossible-state']);
    });

    it('prove a section has one named cut, a typed count or a whole volume, and judge the key', () => {
      const hexagon = section({ mode: 'section', solid: 'cube', plane: { normal: [1, 1, 1], offset: 0 }, options: ['triangle', 'rectangle', 'hexagon'] });
      expect(findings(hexagon, { pick: 'hexagon' })).toEqual([]);
      expect(codes(hexagon, { pick: 'rectangle' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(hexagon, { target: '6' })).toEqual(['impossible-state']);
      expect(codes(section({ mode: 'section', solid: 'cube', plane: { normal: [1, 0, 0], offset: 0 }, options: ['square', 'rectangle'] }))).toEqual(['ambiguous-solution']);
      expect(codes(section({ mode: 'section', solid: 'cube', plane: { normal: [1, 0, 0], offset: 16 }, options: ['square', 'triangle'] }))).toEqual(['no-solution']);
      const euler = section({ mode: 'euler', solid: 'cube', hide: 'edges' });
      expect(findings(euler, { target: '12' })).toEqual([]);
      expect(codes(euler, { target: '8' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      const volume = section({ mode: 'volume', side: 6, height: 5 });
      expect(findings(volume, { target: '60' })).toEqual([]);
      expect(codes(volume, { target: '180' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(section({ mode: 'volume', side: 5, height: 4 }))).toEqual(['no-solution']);
    });

    it('prove a stall can be filled and judge each key basket against the rule', () => {
      const exact = stall({ items: STALL_ITEMS, goal: { kind: 'exact', total: 250 } });
      expect(findings(exact, { solutions: [{ apple: item(5) }, { bread: item(1), apple: item(1), juice: item(1) }] })).toEqual([]);
      expect(findings(exact)).toEqual([]);
      expect(codes(exact, { solutions: [{ apple: item(4) }] })).toEqual(['rubric-accepts-invalid']);
      expect(codes(exact, { solutions: [{ apple: item(6) }] })).toEqual(['rubric-accepts-invalid']);
      expect(codes(exact, { solutions: [] })).toEqual(['impossible-state']);
      expect(codes(exact, { solutions: [{ apple: 'item' }] })).toEqual(['impossible-state']);
      expect(codes(stall({ items: STALL_ITEMS, goal: { kind: 'exact', total: 251 } }))).toEqual(['no-solution']);
      const most = stall({ items: STALL_ITEMS, goal: { kind: 'most', budget: 300 } });
      expect(findings(most, { solutions: [{ apple: item(5) }] })).toEqual([]);
      expect(codes(most, { solutions: [{ bread: item(2) }] })).toEqual(['rubric-accepts-invalid']);
      expect(codes(stall({ items: STALL_ITEMS, goal: { kind: 'most', budget: 1000 } }))).toEqual(['impossible-state']);
      expect(findings(stall({ items: STALL_ITEMS, goal: { kind: 'change', paid: 600, change: 350 } }), { solutions: [{ apple: item(5) }, { bread: item(1), apple: item(1), juice: item(1) }] })).toEqual([]);
    });

    it('prove a coin goal falls on a resting count and judge the key', () => {
      const phone = coin({ piece: 'coin', value: 100, goal: { kind: 'height', mm: 8 }, step: 1, max: 10 });
      expect(findings(phone, { target: '4' })).toEqual([]);
      expect(findings(phone)).toEqual([]);
      expect(codes(phone, { target: '8' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(phone, { target: 4 })).toEqual(['impossible-state']);
      expect(codes(coin({ piece: 'coin', value: 100, goal: { kind: 'height', mm: 7 }, step: 1, max: 10 }))).toEqual(['no-solution']);
      expect(codes(coin({ piece: 'coin', value: 100, goal: { kind: 'amount', total: 1500 }, step: 4, max: 40 }))).toEqual(['impossible-state']);
      expect(codes(coin({ piece: 'coin', value: 100, goal: { kind: 'amount', total: 9000 }, step: 1, max: 40 }))).toEqual(['out-of-bounds']);
    });

    it('refuse a malformed payload or key without throwing', () => {
      expect(codes({ id: 'seg-bad', type: ROTATION, payload: { axis: 'up' } } as never)).toEqual(['impossible-state']);
      expect(codes({ id: 'seg-bad', type: SECTION, payload: { mode: 'cone' } } as never)).toEqual(['impossible-state']);
      expect(codes({ id: 'seg-bad', type: STALL, payload: { items: [] } } as never)).toEqual(['impossible-state']);
      expect(codes({ id: 'seg-bad', type: COIN, payload: { piece: 'coin' } } as never)).toEqual(['impossible-state']);
      expect(codes(coin({ piece: 'coin', value: 100, goal: { kind: 'height', mm: 8 }, step: 1, max: 10 }), 'nope')).toEqual(['impossible-state']);
    });
  });
});
