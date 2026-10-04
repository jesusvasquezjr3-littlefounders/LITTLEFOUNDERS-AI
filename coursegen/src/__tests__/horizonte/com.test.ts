import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { COM_CAPABILITIES, com } from '../../v2/horizonte/com.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';
import '../../v2/solvabilityPacks.js';
import {
  CALCULUS, CIRCUITS, NETWORK, TRIG, alarmPayload, area, bitsByte, bitsTen, bridgeEdges, bridgeNodes, bridgeWalk, bridgeWalkKey, cheapest, cheapestKey, fixtures,
  gatesAlarm, gatesXor, gatesXorKey, keyOf, konigsberg, konigsbergKey, linked, named, pascalEvens, pascalEvensKey, podium, podiumKey, riemann, roadEdges, roadNodes, secant,
  seg, teamPicks, teamPicksKey, tie, tieKey, unitCos, unitSin, wave, walkIds, xorPayload, type Doc, type Seg,
} from './com.fixtures.js';

const one = (segment: Seg, band = '13-17'): Doc => ({ age_band: band, segments: [segment] });
const patch = (segment: Seg, change: Record<string, unknown>): Seg => ({ ...segment, payload: { ...segment.payload, ...change } });
const gates = (segment: Seg, key?: unknown, band?: string) => horizontePieceGates(one(segment, band), key === undefined ? undefined : { [segment.id]: key });
const first = (segment: Seg, key?: unknown, band?: string) => gates(segment, key, band)[0]?.message ?? '';
const solve = (segment: Seg, key?: unknown, nodeBudget?: number) =>
  runSolvabilityGate(one(segment), key === undefined ? undefined : { [segment.id]: key }, nodeBudget === undefined ? {} : { nodeBudget });
const codes = (segment: Seg, key?: unknown, nodeBudget?: number) => solve(segment, key, nodeBudget).map((finding) => finding.code);

const walkTrail = (nodes: unknown, edges: unknown) => seg('graph-trail', NETWORK, 'graph', { task: 'trail', nodes, edges }, walkIds);
const fourOdd = { ...konigsberg, id: 'graph-four-odd', payload: { ...konigsberg.payload, task: 'trail' }, labels: named([...bridgeNodes.map((node) => node.id), ...bridgeEdges.map((edge) => edge.id)]) };
const ring = patch(konigsberg, {
  edges: [{ id: 'bridge-1', from: 'island', to: 'north' }, { id: 'bridge-2', from: 'north', to: 'east' }, { id: 'bridge-3', from: 'east', to: 'south' }, { id: 'bridge-4', from: 'south', to: 'island' }],
});
const noSchool = patch(cheapest, { edges: roadEdges.slice(0, 5) });
const andOnly = patch(gatesXor, { pieces: [{ id: 'gate-a', kind: 'and' }, { id: 'gate-b', kind: 'and' }, { id: 'gate-c', kind: 'and' }, { id: 'gate-d', kind: 'and' }] });
const gatesOf = (change: Record<string, unknown>) => patch(gatesXor, change);

describe('com pack in the Forge (F2.16, F2.17, F2.18)', () => {
  it('declares the capability literal, spreads it into the emitter map and registers one checker per type', () => {
    for (const type of [NETWORK, TRIG, CALCULUS, CIRCUITS] as const) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(COM_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(COM_CAPABILITIES[type]);
      expect(registeredSolvabilityTypes()).toContain(type);
    }
    expect(COM_CAPABILITIES[NETWORK]).toEqual(['visual.network-count.v1', 'operation.drag-chips.v1', 'operation.tap-place.v1']);
    expect(COM_CAPABILITIES[TRIG]).toEqual(['visual.unit-circle.v1', 'operation.drag-point.v1', 'operation.predict-choice.v1', 'visual.math-notation.v1']);
    expect(COM_CAPABILITIES[CALCULUS]).toEqual(['visual.calculus-explorer.v1', 'operation.drag-point.v1', 'operation.parameter-slider.v1', 'operation.predict-choice.v1', 'operation.number-input.v1', 'visual.math-notation.v1']);
    expect(COM_CAPABILITIES[CIRCUITS]).toEqual(['visual.bits-gates.v1', 'operation.drag-chips.v1', 'operation.tap-place.v1']);
    expect(HORIZONTE_FORGE_PACKS).toContain(com);
  });

  it('adds authoring guidance only for the types a skeleton uses', () => {
    expect(horizonteGuidanceFor([NETWORK]).join('\n')).toMatch(/graph, shortest-path, choice-tree or pascal.*each must itself meet the rule/s);
    expect(horizonteGuidanceFor([TRIG]).join('\n')).toMatch(/ages 15-17.*eligibility of 15 or older.*computed from the payload, never authored/s);
    expect(horizonteGuidanceFor([CALCULUS]).join('\n')).toMatch(/c0 \+ c1 x \+ c2 x\^2 \+ c3 x\^3.*secant, derivative-link, riemann or accumulation/s);
    expect(horizonteGuidanceFor([CIRCUITS]).join('\n')).toMatch(/bits.*gates.*the bits switched on/s);
    expect(horizonteGuidanceFor([CIRCUITS]).join('\n')).not.toMatch(/Pascal|secant/);
    expect(horizonteGuidanceFor([NETWORK]).join('\n')).not.toMatch(/c0 \+ c1/);
    expect(horizonteGuidanceFor(['text.note.v2'])).toEqual([]);
  });

  describe('gate 4', () => {
    it('accepts every authored example with its key and without one, in its own age band and for adults', () => {
      expect(fixtures).toHaveLength(19);
      for (const [segment, key, band] of fixtures) {
        expect(gates(segment, key, band)).toEqual([]);
        expect(gates(segment, undefined, band)).toEqual([]);
        expect(gates(segment, key, 'adult')).toEqual([]);
      }
    });

    it('reports a problem as gate 4 against the segment', () => {
      const [problem] = gates(patch(secant, { a: 9 }));
      expect(problem).toMatchObject({ gate: 4, segmentId: 'secant-slope' });
    });

    it('keeps the age scope of each kind', () => {
      expect(first(unitCos, undefined, '10-12')).toMatch(/age band 13-17, adult, not 10-12/);
      expect(first(secant, undefined, '10-12')).toMatch(/age band 13-17, adult, not 10-12/);
      expect(first(unitCos, undefined, '6-9')).toMatch(/not 6-9/);
      expect(first(konigsberg, undefined, '6-9')).toMatch(/age band 10-12, 13-17, adult, not 6-9/);
      expect(first(bitsTen, undefined, '6-9')).toMatch(/age band 10-12, 13-17, adult, not 6-9/);
      expect(gates(konigsberg, undefined, '10-12')).toEqual([]);
      expect(gates(bitsTen, undefined, '13-17')).toEqual([]);
    });

    it('refuses a visual that does not fit the type', () => {
      expect(first({ ...konigsberg, visual: { type: 'tree' } })).toMatch(/graph, shortest-path, choice-tree or pascal/);
      expect(first({ ...unitCos, visual: { type: 'secant' } })).toMatch(/unit-circle or circle-wave/);
      expect(first({ ...secant, visual: { type: 'circle-wave' } })).toMatch(/secant, derivative-link, riemann or accumulation/);
      expect(first({ ...bitsTen, visual: { type: 'bits-gates' } })).toMatch(/must be bits or gates/);
      expect(first({ ...konigsberg, visual: { type: 'pascal' } })).toMatch(/Pascal payload holds a row count and a multiple/);
      expect(first({ ...unitCos, visual: { type: 'circle-wave' } })).toMatch(/wave payload holds the function/);
      expect(first({ ...bitsTen, visual: { type: 'gates' } })).toMatch(/gates payload holds inputs/);
    });

    it('ignores the segments of other types', () => {
      expect(horizontePieceGates({ segments: [{ id: 'seg-x', type: 'text.note.v2', visual: { type: 'graph' }, payload: {} }] })).toEqual([]);
    });

    describe('networks and counting', () => {
      it('refuses a malformed graph', () => {
        expect(first(patch(konigsberg, { nodes: bridgeNodes.slice(0, 2) }))).toMatch(/3 to 7 nodes/);
        expect(first(patch(konigsberg, { nodes: [bridgeNodes[0]!, { id: 'north', x: 52, y: 52 }, bridgeNodes[2]!, bridgeNodes[3]!] }))).toMatch(/at least 18 apart/);
        expect(first(patch(konigsberg, { extra: 1 }))).toMatch(/holds a task, nodes and edges/);
        expect(first(patch(konigsberg, { task: 'tour' }))).toMatch(/task is odd or trail/);
        expect(first(patch(konigsberg, { edges: bridgeEdges.slice(0, 4) }))).toMatch(/reachable from every other/);
        expect(first(ring)).toMatch(/at least two odd nodes/);
        expect(first(patch(konigsberg, { edges: [...bridgeEdges.slice(0, 6), { id: 'bridge-7', from: 'south', to: 'nowhere' }] }))).toMatch(/joins two nodes of the network/);
        expect(first(fourOdd)).toMatch(/zero or two odd nodes/);
        expect(first(patch(konigsberg, { edges: [...bridgeEdges.slice(0, 6), { id: 'bridge-7', from: 'south', to: 'south' }] }))).toMatch(/two different nodes/);
      });

      it('refuses a malformed route map', () => {
        expect(first(patch(cheapest, { edges: roadEdges.map((edge) => ({ ...edge, weight: 0 })) }))).toMatch(/whole weight from 1 to 9/);
        expect(first(patch(cheapest, { edges: [...roadEdges.slice(0, 6), { id: 'road-7', from: 'park', to: 'home', weight: 4 }] }))).toMatch(/one edge at most/);
        expect(first(noSchool)).toMatch(/goal is reachable from the start/);
        expect(first(patch(cheapest, { goal: 'home' }))).toMatch(/two different nodes/);
        expect(first({ ...cheapest, payload: { nodes: roadNodes, edges: roadEdges, goal: 'school' } })).toMatch(/holds nodes, edges, a start and a goal/);
      });

      it('refuses a malformed choice tree or triangle', () => {
        expect(first(patch(teamPicks, { pick: 4 }))).toMatch(/pick count is 2 or 3/);
        expect(first(patch(teamPicks, { items: ['ana', 'ben', 'cai', 'dev', 'eli'] }))).toMatch(/2 to 4 different items/);
        expect(first(patch(teamPicks, { mode: 'ring' }))).toMatch(/mode is order or group/);
        expect(first(patch(teamPicks, { first: 'ana' }))).toMatch(/names no first item/);
        expect(first(patch(teamPicks, { items: ['ana', 'ben', 'cai'], pick: 3 }))).toMatch(/one team only/);
        expect(first(patch(podium, { first: undefined }))).toMatch(/names the item that comes first/);
        expect(first(patch(podium, { first: 'zed' }))).toMatch(/names the item that comes first/);
        expect(first(patch(pascalEvens, { rows: 3 }))).toMatch(/5 to 10 rows and the multiple is 2 to 5/);
        expect(first(patch(pascalEvens, { multiple: 6 }))).toMatch(/5 to 10 rows/);
        expect(first(patch(pascalEvens, { rows: 5, multiple: 5 }))).toMatch(/at least one cell is a multiple/i);
      });

      it('wants a label for every node, bridge or item, and none on a triangle', () => {
        expect(first({ ...konigsberg, labels: named(['island', 'north', 'south']) })).toMatch(/Labels name every node, bridge or item/);
        expect(first({ ...konigsberg, labels: undefined })).toMatch(/Labels name every node, bridge or item/);
        expect(first({ ...bridgeWalk, labels: named(['west', 'island', 'east', 'north']) })).toMatch(/Labels name every node, bridge or item/);
        expect(first({ ...teamPicks, labels: { ...named(['ana', 'ben', 'cai', 'dev']), extra: 'Extra' } })).toMatch(/Labels name every node, bridge or item/);
        expect(first({ ...pascalEvens, labels: named(['a']) })).toMatch(/triangle takes no labels/);
      });

      it('refuses a key that does not meet the rule of its task', () => {
        expect(first(konigsberg, keyOf({ odd: ['island'] }))).toMatch(/Every key solution meets the rule of the task/);
        expect(first(konigsberg, keyOf({ walk: ['bridge-1'] }))).toMatch(/slot this board does not have/);
        expect(first(konigsberg, keyOf({ odd: ['island', 'island'] }))).toMatch(/places each piece once/);
        expect(first(konigsberg, keyOf({ odd: ['not-a-node'] }))).toMatch(/piece this board does not have/);
        expect(first(bridgeWalk, keyOf({ walk: ['bridge-1', 'bridge-5', 'bridge-3', 'bridge-4', 'bridge-2', 'bridge-6'] }))).toMatch(/Every key solution meets the rule/);
        expect(first(bridgeWalk, keyOf({ walk: ['bridge-1', 'bridge-3'] }))).toMatch(/Every key solution meets the rule/);
        expect(first(cheapest, keyOf({ route: ['home', 'shop', 'pool', 'school'] }))).toMatch(/Every key solution meets the rule/);
        expect(first(cheapest, keyOf({ route: ['park', 'shop', 'pool', 'school'] }))).toMatch(/Every key solution meets the rule/);
        expect(first(teamPicks, keyOf({ keep: ['ana.ben', 'ana.cai', 'ana.dev', 'ben.cai', 'ben.dev'] }))).toMatch(/Every key solution meets the rule/);
        expect(first(podium, keyOf({ keep: ['ana.ben.cai', 'ben.ana.cai'] }))).toMatch(/Every key solution meets the rule/);
        expect(first(pascalEvens, keyOf({ 'row-2': ['r2c1'] }))).toMatch(/Every key solution meets the rule/);
        expect(first(pascalEvens, keyOf({ ...pascalEvensKey.solutions[0]!, 'row-1': ['r3c1'] }))).toMatch(/Every key solution meets the rule/);
        expect(first(pascalEvens, keyOf({ 'row-0': ['r0c0', 'r1c0'] }))).toMatch(/within its capacity/);
        expect(first(pascalEvens, { solutions: [] })).toMatch(/one to eight arrangements/);
        expect(first(pascalEvens, { solutions: Array.from({ length: 9 }, () => pascalEvensKey.solutions[0]) })).toMatch(/one to eight arrangements/);
      });

      it('grades by rule, so a key may name one valid arrangement or several', () => {
        expect(gates(tie, keyOf(tieKey.solutions[0]!))).toEqual([]);
        expect(gates(tie, keyOf(tieKey.solutions[1]!, tieKey.solutions[0]!))).toEqual([]);
        expect(gates(cheapest, keyOf(cheapestKey.solutions[0]!, cheapestKey.solutions[0]!))).toEqual([]);
        expect(gates(bridgeWalk, keyOf(bridgeWalkKey.solutions[0]!, { walk: [...bridgeWalkKey.solutions[0]!.walk!].reverse() }))).toEqual([]);
        expect(gates(podium, keyOf({ keep: [...podiumKey.solutions[0]!.keep!].reverse() }))).toEqual([]);
        expect(gates(teamPicks, keyOf({ keep: [...teamPicksKey.solutions[0]!.keep!].reverse() }))).toEqual([]);
      });
    });

    describe('trigonometry', () => {
      it('refuses a malformed circle or wave', () => {
        expect(first(patch(unitCos, { ask: 'tan' }))).toMatch(/function is cosine or sine/);
        expect(first(patch(unitCos, { sign: 0 }))).toMatch(/sign is 1 or -1/);
        expect(first(patch(unitCos, { level: 'zero', sign: -1 }))).toMatch(/Zero carries no sign/);
        expect(first(patch(unitCos, { level: 'two' }))).toMatch(/level is zero, a half, root two, root three or one/);
        expect(first(patch(unitCos, { step: 7 }))).toMatch(/step is 5, 10, 15 or 30 degrees/);
        expect(first(patch(unitCos, { start: 10 }))).toMatch(/start angle is a whole multiple of the step/);
        expect(first(patch(unitCos, { extra: 1 }))).toMatch(/unit circle payload holds/);
        expect(first(patch(unitCos, { level: 'one', sign: 1 }))).toMatch(/names no side/);
        expect(first(patch(unitCos, { side: undefined }))).toMatch(/cosine level names the upper or the lower half/);
        expect(first(patch(unitSin, { side: 'upper' }))).toMatch(/sine level names the right or the left half/);
        expect(first(patch(unitCos, { start: 135 }))).toMatch(/start angle is not the answer/);
        expect(first(patch(wave, { slope: undefined }))).toMatch(/names a rising or a falling wave/);
        expect(first(patch(wave, { level: 'one' }))).toMatch(/no slope to name/);
        expect(first({ ...unitCos, labels: named(['a']) })).toMatch(/takes no labels/);
      });

      it('refuses a key that is not the answer the model computes', () => {
        expect(first(unitCos, { predict: 'quadrant-1', value: 135 })).toMatch(/key must be the answer the model computes/);
        expect(first(unitCos, { predict: 'quadrant-2', value: 120 })).toMatch(/key must be the answer the model computes/);
        expect(first(unitCos, { predict: 'quadrant-9', value: 135 })).toMatch(/prediction is one of quadrant-1/);
        expect(first(unitCos, { predict: 'quadrant-2', value: 135.5 })).toMatch(/key is \{ predict, value \}/);
        expect(first(unitCos, { predict: 'quadrant-2', value: 400 })).toMatch(/whole number from 0 to 359/);
        expect(first(unitCos, { predict: 'quadrant-2', value: 135, extra: 1 })).toMatch(/key is \{ predict, value \}/);
        expect(first(unitCos, keyOf({ odd: ['a'] }))).toMatch(/key is \{ predict, value \}/);
        expect(first(wave, { predict: 'times-1', value: 150 })).toMatch(/key must be the answer the model computes/);
        expect(gates(patch(wave, { level: 'one', sign: 1, slope: undefined, start: 30 }), { predict: 'times-1', value: 90 })).toEqual([]);
      });
    });

    describe('calculus', () => {
      it('refuses a malformed curve of each visual', () => {
        expect(first(patch(secant, { coeffs: [0, 1, -2] }))).toMatch(/secant payload holds four whole coefficients/);
        expect(first(patch(secant, { coeffs: [0, 1, -2, 12] }))).toMatch(/four whole coefficients/);
        expect(first(patch(secant, { a: 4 }))).toMatch(/four whole coefficients and a whole point/);
        expect(first(patch(secant, { coeffs: [0, 0, 0, 9], a: 3 }))).toMatch(/slope at the point stays within 20/);
        expect(first(patch(secant, { coeffs: [1, 2, 0, 0] }))).toMatch(/straight line has no secant/);
        expect(first(patch(linked, { lead: 2 }))).toMatch(/lead is 1 or -1/);
        expect(first(patch(linked, { roots: [0, 1] }))).toMatch(/at least 2 apart/);
        expect(first(patch(linked, { roots: [-4, 2] }))).toMatch(/within 3/);
        expect(first(patch(linked, { base: 9 }))).toMatch(/base is a whole number from -5 to 5/);
        expect(first(patch(linked, { ask: 'mid' }))).toMatch(/max or the min/);
        expect(first(patch(riemann, { coeffs: [-1, 0, 0, 0] }))).toMatch(/stays above the axis/);
        expect(first(patch(riemann, { method: 'simpson' }))).toMatch(/left, right, midpoint or trapezoid/);
        expect(first(patch(riemann, { to: 1 }))).toMatch(/2 to 8 wide/);
        expect(first(patch(riemann, { tolerance: 0.005 }))).toMatch(/0.01 to 20, in hundredths/);
        expect(first(patch(riemann, { tolerance: 0.01 }))).toMatch(/first n within the tolerance is clear/);
        expect(first(patch(riemann, { tolerance: 20 }))).toMatch(/first n within the tolerance is clear/);
        expect(first(patch(area, { target: 17 }))).toMatch(/Exactly one whole number on the interval/);
        expect(first(patch(area, { target: 16 }))).toMatch(/Exactly one whole number on the interval/);
        expect(first(patch(area, { target: 0 }))).toMatch(/never zero/);
        expect(first(patch(area, { to: 2 }))).toMatch(/3 to 8 wide/);
        expect(first({ ...secant, labels: named(['a']) })).toMatch(/takes no labels/);
      });

      it('refuses a key that is not the answer the model computes', () => {
        expect(first(secant, { predict: 'positive', value: -3 })).toMatch(/key must be the answer the model computes/);
        expect(first(secant, { predict: 'negative', value: -2 })).toMatch(/key must be the answer the model computes/);
        expect(first(linked, { predict: 'falling', value: 2 })).toMatch(/key must be the answer the model computes/);
        expect(first(riemann, { predict: 'too-big', value: 7 })).toMatch(/key must be the answer the model computes/);
        expect(first(riemann, { predict: 'too-small', value: 50 })).toMatch(/whole number from 1 to 40/);
        expect(first(area, { predict: 'growing', value: 6 })).toMatch(/key must be the answer the model computes/);
        expect(first(area, { predict: 'flat', value: 9 })).toMatch(/whole number from 0 to 8/);
        expect(first(area, { predict: 'rising', value: 6 })).toMatch(/prediction is one of growing, shrinking, flat/);
      });

      it('computes the key from the curve for every visual', () => {
        expect(gates(patch(secant, { coeffs: [0, 1, -2, 0], a: 0 }), { predict: 'positive', value: 1 })).toEqual([]);
        expect(gates(patch(secant, { coeffs: [0, 1, -2, 0], a: 0 }), { predict: 'positive', value: 2 })).not.toEqual([]);
        expect(gates(patch(linked, { ask: 'min' }), { predict: 'falling', value: 2 })).toEqual([]);
        expect(gates(patch(linked, { lead: -1 }), { predict: 'rising', value: 2 })).toEqual([]);
        expect(gates(patch(riemann, { method: 'right' }), { predict: 'too-big', value: 8 })).toEqual([]);
      });
    });

    describe('bits and gates', () => {
      it('refuses a malformed row of bits or circuit', () => {
        expect(first(patch(bitsTen, { bits: 3 }))).toMatch(/number of bits is 4 to 8/);
        expect(first(patch(bitsTen, { target: 16 }))).toMatch(/whole number the bits can show/);
        expect(first(patch(bitsTen, { target: 0 }))).toMatch(/never zero/);
        expect(first(patch(bitsTen, { extra: 1 }))).toMatch(/bits payload holds a bit count and a target/);
        expect(first({ ...bitsTen, labels: named(['a']) })).toMatch(/row of bits takes no labels/);
        expect(first(gatesOf({ inputs: ['in-a', 'in-b', 'in-c', 'in-d'] }))).toMatch(/1 to 3 inputs/);
        expect(first(gatesOf({ slots: [] }))).toMatch(/1 to 5 gate positions/);
        expect(first(gatesOf({ pieces: xorPayload.pieces.slice(0, 2) }))).toMatch(/as many gates as there are positions/);
        expect(first(gatesOf({ pieces: [...xorPayload.pieces.slice(0, 3), { id: 'pos-1', kind: 'nor' }] }))).toMatch(/ids are all different/);
        expect(first(gatesOf({ slots: [{ id: 'pos-1', from: ['in-a', 'in-a'] }, ...xorPayload.slots.slice(1)] }))).toMatch(/two different sources/);
        expect(first(gatesOf({ slots: [{ id: 'pos-1', from: ['in-a', 'pos-3'] }, ...xorPayload.slots.slice(1)] }))).toMatch(/input or an earlier position/);
        expect(first(gatesOf({ pieces: [{ id: 'gate-a', kind: 'maybe' }, ...xorPayload.pieces.slice(1)] }))).toMatch(/Each gate has an id and a kind/);
        expect(first(gatesOf({ expected: [0, 0, 0, 0] }))).toMatch(/not all the same/);
        expect(first(gatesOf({ expected: [0, 1, 1] }))).toMatch(/one bit for every row of the truth table/);
        expect(first(gatesOf({ slots: [xorPayload.slots[0]!, xorPayload.slots[1]!, { id: 'pos-3', from: ['pos-1', 'in-a'] }] }))).toMatch(/Every position feeds the output/);
        expect(first(andOnly)).toMatch(/Some arrangement of the gates gives the expected outputs/);
      });

      it('wants a label for every input and the output position', () => {
        expect(first({ ...gatesXor, labels: named(['in-a', 'in-b']) })).toMatch(/Labels name every input and the output/);
        expect(first({ ...gatesXor, labels: named(['in-a', 'in-b', 'pos-3', 'pos-1']) })).toMatch(/Labels name every input and the output/);
        expect(first({ ...gatesAlarm, labels: undefined })).toMatch(/Labels name every input and the output/);
      });

      it('refuses a key that does not meet the rule', () => {
        expect(first(bitsTen, keyOf({ 'bits-on': ['bit-8', 'bit-4'] }))).toMatch(/Every key solution meets the rule/);
        expect(first(bitsTen, keyOf({ 'bits-on': ['bit-8', 'bit-3'] }))).toMatch(/piece this board does not have/);
        expect(first(bitsTen, keyOf({ 'bits-on': ['bit-8', 'bit-8'] }))).toMatch(/places each piece once/);
        expect(first(bitsTen, keyOf({ 'bits-on': [] }))).toMatch(/places at least one piece/);
        expect(first(gatesXor, keyOf({ 'pos-1': ['gate-a'], 'pos-2': ['gate-b'], 'pos-3': ['gate-d'] }))).toMatch(/Every key solution meets the rule/);
        expect(first(gatesXor, keyOf({ 'pos-1': ['gate-a'], 'pos-3': ['gate-c'] }))).toMatch(/Every key solution meets the rule/);
        expect(first(gatesXor, keyOf({ 'pos-1': ['gate-a'], 'pos-2': ['gate-a'], 'pos-3': ['gate-c'] }))).toMatch(/places each piece once/);
        expect(first(gatesXor, keyOf({ 'pos-1': ['gate-a', 'gate-b'] }))).toMatch(/within its capacity/);
        expect(first(gatesXor, keyOf({ 'pos-9': ['gate-a'] }))).toMatch(/slot this board does not have/);
      });

      it('grades by rule, so several valid builds may share one key and spare gates are fine', () => {
        expect(gates(bitsByte, keyOf({ 'bits-on': ['bit-8', 'bit-64', 'bit-128'] }))).toEqual([]);
        expect(gates(gatesXor, keyOf(gatesXorKey.solutions[1]!))).toEqual([]);
        expect(gates(gatesAlarm, keyOf({ 'pos-1': ['gate-a'], 'pos-2': ['gate-b'], 'pos-3': ['gate-c'] }))).toEqual([]);
        expect(gates(patch(gatesAlarm, { pieces: [...alarmPayload.pieces, { id: 'gate-e', kind: 'nor' }] }))).toEqual([]);
      });
    });
  });

  describe('solvability checkers', () => {
    it('prove every authored example with its key and without one', () => {
      for (const [segment, key] of fixtures) {
        expect(solve(segment, key)).toEqual([]);
        expect(solve(segment)).toEqual([]);
      }
    });

    it('lets a board take several valid answers without calling it ambiguous', () => {
      expect(codes(tie)).toEqual([]);
      expect(codes(gatesXor)).toEqual([]);
      expect(codes(teamPicks)).toEqual([]);
      expect(codes(tie, keyOf(tieKey.solutions[1]!))).toEqual([]);
      expect(codes(gatesXor, keyOf(gatesXorKey.solutions[0]!, gatesXorKey.solutions[1]!))).toEqual([]);
    });

    it('names a graph no walk can cover, a goal no road reaches and a circuit no gates can build', () => {
      expect(codes(fourOdd)).toEqual(['no-solution']);
      expect(codes(noSchool)).toEqual(['no-solution']);
      expect(codes(andOnly)).toEqual(['no-solution']);
      expect(solve(fourOdd)[0]?.message).toMatch(/solvability\/no-solution: graph graph-four-odd/);
    });

    it('names a key that does not meet the rule of its task', () => {
      expect(codes(konigsberg, keyOf({ odd: ['island'] }))).toEqual(['impossible-state']);
      expect(codes(bridgeWalk, keyOf({ walk: ['bridge-1', 'bridge-5'] }))).toEqual(['impossible-state']);
      expect(codes(cheapest, keyOf({ route: ['home', 'shop', 'pool', 'school'] }))).toEqual(['impossible-state']);
      expect(codes(podium, keyOf({ keep: ['ben.ana.cai'] }))).toEqual(['impossible-state']);
      expect(codes(pascalEvens, keyOf({ 'row-2': ['r2c1'] }))).toEqual(['impossible-state']);
      expect(codes(bitsTen, keyOf({ 'bits-on': ['bit-8', 'bit-4'] }))).toEqual(['impossible-state']);
      expect(codes(gatesXor, keyOf({ 'pos-1': ['gate-a'], 'pos-2': ['gate-b'], 'pos-3': ['gate-d'] }))).toEqual(['impossible-state']);
      expect(solve(konigsberg, keyOf({ odd: ['island'] }))[0]?.message).toMatch(/solvability\/impossible-state: graph konigsberg.*meets the rule of the task/);
    });

    it('names a key that is not shaped like the board', () => {
      expect(codes(konigsberg, keyOf({ walk: ['bridge-1'] }))).toEqual(['impossible-state']);
      expect(codes(konigsberg, { solutions: [] })).toEqual(['impossible-state']);
      expect(codes(bitsTen, keyOf({ 'bits-on': ['bit-3'] }))).toEqual(['impossible-state']);
      expect(codes(bitsTen, { solutions: [{ 'bits-on': ['bit-8'] }, 'nope'] })).toEqual(['impossible-state']);
    });

    it('names a payload that matches no visual or breaks a rule', () => {
      expect(codes(seg('net-none', NETWORK, 'graph', { nothing: true }))).toEqual(['impossible-state']);
      expect(codes(seg('circuit-none', CIRCUITS, 'bits', { nothing: true }))).toEqual(['impossible-state']);
      expect(codes(seg('trig-none', TRIG, 'unit-circle', { nothing: true }))).toEqual(['impossible-state']);
      expect(codes(seg('calc-none', CALCULUS, 'secant', { nothing: true }))).toEqual(['impossible-state']);
      expect(codes(patch(konigsberg, { edges: bridgeEdges.slice(0, 1) }))).toEqual(['impossible-state']);
      expect(codes(patch(bitsTen, { target: 99 }))).toEqual(['impossible-state']);
      expect(codes(patch(unitCos, { step: 7 }))).toEqual(['impossible-state']);
      expect(codes(patch(secant, { coeffs: [1, 2, 0, 0] }))).toEqual(['impossible-state']);
      expect(codes(patch(unitCos, { start: 135 }))).toEqual(['impossible-state']);
      expect(codes(patch(riemann, { tolerance: 20 }))).toEqual(['impossible-state']);
    });

    it('names an explorer with no answer, or with more than one', () => {
      expect(codes(patch(area, { target: 17 }))).toEqual(['no-solution']);
      expect(codes(patch(area, { target: 16 }))).toEqual(['ambiguous-solution']);
      expect(codes(patch(riemann, { tolerance: 0.01 }))).toEqual(['no-solution']);
      expect(solve(patch(area, { target: 16 }))[0]?.message).toMatch(/solvability\/ambiguous-solution: accumulation area-so-far/);
    });

    it('names an explorer key that is not the answer the model computes', () => {
      expect(codes(unitCos, { predict: 'quadrant-1', value: 135 })).toEqual(['impossible-state']);
      expect(codes(secant, { predict: 'positive', value: -3 })).toEqual(['impossible-state']);
      expect(codes(linked, { predict: 'falling', value: 2 })).toEqual(['impossible-state']);
      expect(codes(riemann, { predict: 'too-small', value: 9 })).toEqual(['impossible-state']);
      expect(codes(area, { predict: 'flat', value: 5 })).toEqual(['impossible-state']);
      expect(codes(wave, keyOf({ odd: ['a'] }))).toEqual(['impossible-state']);
      expect(solve(unitCos, { predict: 'quadrant-1', value: 135 })[0]?.message).toMatch(/solvability\/impossible-state: unit-circle unit-circle-cos.*answer the model computes/);
    });

    it('names a reference that does not exist and an id used twice', () => {
      expect(codes(patch(cheapest, { edges: [...roadEdges.slice(0, 6), { id: 'road-7', from: 'pool', to: 'nowhere', weight: 4 }] }))).toEqual(['dangling-reference']);
      expect(codes(patch(cheapest, { goal: 'nowhere' }))).toEqual(['dangling-reference']);
      expect(codes(patch(podium, { first: 'zed' }))).toEqual(['dangling-reference']);
      expect(codes(gatesOf({ slots: [{ id: 'pos-1', from: ['in-a', 'in-z'] }, ...xorPayload.slots.slice(1)] }))).toEqual(['dangling-reference']);
      expect(codes(patch(cheapest, { nodes: [...roadNodes, { id: 'home', x: 50, y: 50 }] }))).toEqual(['duplicate-id']);
      expect(codes(patch(cheapest, { edges: [...roadEdges.slice(0, 6), { id: 'home', from: 'pool', to: 'school', weight: 4 }] }))).toEqual(['duplicate-id']);
      expect(codes(patch(teamPicks, { items: ['ana', 'ben', 'ana', 'dev'] }))).toEqual(['duplicate-id']);
      expect(codes(gatesOf({ pieces: [{ id: 'pos-1', kind: 'or' }, ...xorPayload.pieces.slice(1)] }))).toEqual(['duplicate-id']);
      expect(solve(patch(podium, { first: 'zed' }))[0]?.message).toMatch(/solvability\/dangling-reference/);
    });

    it('never publishes a board it could not prove within the node budget', () => {
      expect(codes(walkTrail(bridgeWalk.payload.nodes, bridgeWalk.payload.edges), undefined, 3)).toEqual(['budget-exceeded']);
      expect(codes(cheapest, undefined, 3)).toEqual(['budget-exceeded']);
      expect(codes(teamPicks, undefined, 3)).toEqual(['budget-exceeded']);
      expect(codes(bitsByte, undefined, 3)).toEqual(['budget-exceeded']);
      expect(codes(gatesAlarm, undefined, 2)).toEqual(['budget-exceeded']);
      expect(codes(unitCos, undefined, 3)).toEqual(['budget-exceeded']);
      expect(codes(riemann, undefined, 3)).toEqual(['budget-exceeded']);
      expect(codes(area, undefined, 3)).toEqual(['budget-exceeded']);
      expect(solve(bridgeWalk, bridgeWalkKey, 3)[0]?.message).toMatch(/solvability\/budget-exceeded: graph bridge-walk/);
    });

    it('proves the boards that need no search even with a tiny budget', () => {
      expect(codes(konigsberg, konigsbergKey, 3)).toEqual([]);
      expect(codes(podium, podiumKey, 3)).toEqual([]);
      expect(codes(pascalEvens, pascalEvensKey, 3)).toEqual([]);
      expect(codes(secant, { predict: 'negative', value: -3 }, 3)).toEqual([]);
      expect(codes(linked, { predict: 'falling', value: -1 }, 3)).toEqual([]);
    });
  });
});
