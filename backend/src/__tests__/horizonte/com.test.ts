import { describe, expect, it } from 'vitest';
import { assertScorerContract } from '../../services/horizonte/harness/scorerContract.js';
import { COM_CAPABILITIES } from '../../services/horizonte/com/capabilities.js';
import { com } from '../../services/horizonte/com/index.js';
import { COM_FIXTURES } from '../../services/horizonte/com/fixtures.js';
import {
  accumulationHits, accumulationProblem, areaOf, derivativeLinkProblem, riemannError, riemannProblem, riemannTruth, secantProblem, secantSlope, slopeAt,
  type AccumulationPayload, type RiemannPayload,
} from '../../services/horizonte/com/calculus.js';
import { bitsProblem, circuitExamples, circuitMet, circuitOutputs, circuitSolutions, evalCircuit, gatesAccepts, gatesProblem, type GatesPayload } from '../../services/horizonte/com/circuits.js';
import { explorerKeyProblem, explorerTruth } from '../../services/horizonte/com/explorer.js';
import {
  dijkstraSteps, eulerTrails, graphProblem, isTrail, networkExamples, networkMet, oddNodes, pascalAccepts, pascalByRow, pascalMultiples, pascalProblem, pascalValues, pathProblem, shortestPaths, teamIds, treeLeaves, treeMet, treeProblem,
  type GraphPayload, type PathPayload, type TreePayload,
} from '../../services/horizonte/com/network.js';
import { circleWaveAngles, circleWaveProblem, quadrantOf, unitCircleAngles, unitCircleProblem, type CircleWavePayload, type UnitCirclePayload } from '../../services/horizonte/com/trig.js';
import { horizonteGrade, horizonteSampleVerdict, horizonteScopeProblem } from '../../services/horizonte/index.js';
import { gradeV2Visual, v2PublicLessonSchema, validateV2LessonForGrading } from '../../services/v2LessonDocument.js';

type Locale = 'en-US' | 'es-MX' | 'pt-BR';
type Grade = (segment: unknown, response: unknown, rubric: unknown) => { verdict: string; diagnostic: string };
const fixture = (id: string) => COM_FIXTURES.find((item) => item.id === id)!;
const segmentOf = (id: string, locale: Locale = 'en-US') => fixture(id).segment(locale);
const payloadOf = <T,>(id: string) => segmentOf(id).payload as T;
const grader = (id: string) => com.scorers[segmentOf(id).type as string]!.grade as unknown as Grade;
const arrange = (id: string, slots: Record<string, string[]>, withRubric = true) => grader(id)(segmentOf(id), { slots }, withRubric ? fixture(id).rubric : undefined);
const explore = (id: string, response: unknown, withRubric = true) => grader(id)(segmentOf(id), response, withRubric ? fixture(id).rubric : undefined);
const keyOf = (id: string) => (fixture(id).rubric as { solutions: Array<Record<string, string[]>> }).solutions[0]!;

describe('com pack: F2.16 to F2.18', () => {
  it('meets the scorer contract', () => {
    expect(() => assertScorerContract(com, COM_FIXTURES)).not.toThrow();
  });

  it('declares the four kinds with parity-ready capability literals and a fixture family for every visual', () => {
    expect(Object.keys(COM_CAPABILITIES).sort()).toEqual(['calculus.explorer.v2', 'computing.bits-gates.v2', 'math.network-count.v2', 'trig.unit-circle.v2']);
    const visuals = new Set(COM_FIXTURES.map((item) => (item.segment('en-US').visual as { type: string }).type));
    expect([...visuals].sort()).toEqual(['accumulation', 'bits', 'choice-tree', 'circle-wave', 'derivative-link', 'gates', 'graph', 'pascal', 'riemann', 'secant', 'shortest-path', 'unit-circle']);
    expect(COM_FIXTURES).toHaveLength(19);
  });

  describe('F2.16 networks and counting', () => {
    it('keeps the graph model total and strict', () => {
      const graph = payloadOf<GraphPayload>('konigsberg');
      expect(graphProblem(graph)).toBeNull();
      expect(oddNodes(graph).sort()).toEqual(['east', 'island', 'north', 'south']);
      for (const bad of [undefined, null, 0, 'x', [], {}, { ...graph, task: 'nonsense' }, { ...graph, extra: 1 }, { ...graph, nodes: graph.nodes.slice(0, 2) }, { ...graph, edges: [{ id: 'bridge-1', from: 'island', to: 'island' }, ...graph.edges.slice(1)] },
        { ...graph, edges: [{ id: 'bridge-1', from: 'island', to: 'nowhere' }, ...graph.edges.slice(1)] }, { ...graph, edges: [{ id: 'bridge-1', from: 'island', to: 'north', weight: 2 }, ...graph.edges.slice(1)] },
        { ...graph, nodes: [graph.nodes[0], { id: 'north', x: 52, y: 52 }, ...graph.nodes.slice(2)] }]) {
        expect(graphProblem(bad), JSON.stringify(bad)).not.toBeNull();
      }
      expect(graphProblem({ ...graph, edges: graph.edges.filter((edge) => edge.to !== 'east') })).not.toBeNull();
      expect(graphProblem({ task: 'trail', nodes: graph.nodes, edges: graph.edges })).not.toBeNull();
    });

    it('walks every bridge once, from either odd node, and refuses a repeat or a jump', () => {
      const walk = payloadOf<GraphPayload>('bridge-walk');
      expect(graphProblem(walk)).toBeNull();
      expect(oddNodes(walk).sort()).toEqual(['north', 'west']);
      expect(isTrail(walk.edges, keyOf('bridge-walk').walk!, true)).toBe(true);
      expect(isTrail(walk.edges, ['bridge-1', 'bridge-3', 'bridge-5', 'bridge-4', 'bridge-2'], true)).toBe(false);
      expect(isTrail(walk.edges, ['bridge-1', 'bridge-5'], false)).toBe(false);
      expect(isTrail(walk.edges, ['bridge-1', 'bridge-1'], false)).toBe(false);
      expect(isTrail(walk.edges, [], false)).toBe(false);
      const trails = eulerTrails(walk);
      expect(trails.length).toBeGreaterThan(1);
      expect(trails.every((trail) => isTrail(walk.edges, trail, true))).toBe(true);
      expect(networkExamples('graph', walk).length).toBe(trails.length);
    });

    it('finds the cheapest route and every tie, and steps Dijkstra one settled stop at a time', () => {
      const route = payloadOf<PathPayload>('cheapest-route');
      expect(pathProblem(route)).toBeNull();
      expect(shortestPaths(route)).toEqual({ distance: 10, paths: [['home', 'park', 'shop', 'pool', 'school']] });
      const steps = dijkstraSteps(route);
      expect(steps[0]).toMatchObject({ settled: 'home', done: ['home'] });
      expect(steps.at(-1)!.settled).toBe('school');
      expect(steps.at(-1)!.distance.school).toBe(10);
      expect(steps.at(-1)!.via.school).toBe('pool');
      expect(steps.map((step) => step.done.length)).toEqual(steps.map((_, index) => index + 1));
      const tie = payloadOf<PathPayload>('cheapest-tie');
      expect(shortestPaths(tie).paths).toEqual([['camp', 'creek', 'cave', 'peak'], ['camp', 'ridge', 'cave', 'peak']]);
      expect(pathProblem({ ...route, goal: route.start })).not.toBeNull();
      expect(pathProblem({ ...route, edges: [{ id: 'road-1', from: 'home', to: 'park', weight: 0 }, ...route.edges.slice(1)] })).not.toBeNull();
      expect(pathProblem({ ...route, edges: [...route.edges, { id: 'road-8', from: 'park', to: 'home', weight: 3 }] })).not.toBeNull();
      expect(pathProblem({ ...route, edges: route.edges.filter((edge) => edge.to !== 'school') })).not.toBeNull();
    });

    it('counts the outcomes of a choice tree, by group and by order', () => {
      const team = payloadOf<TreePayload>('team-picks');
      expect(treeProblem(team)).toBeNull();
      expect(treeLeaves(team)).toHaveLength(12);
      expect(teamIds(team)).toHaveLength(6);
      expect(treeMet(team, keyOf('team-picks').keep!)).toBe(true);
      expect(treeMet(team, ['ben.ana', 'ana.cai', 'ana.dev', 'ben.cai', 'ben.dev', 'cai.dev'])).toBe(true);
      expect(treeMet(team, ['ana.ben', 'ben.ana', 'ana.cai', 'ana.dev', 'ben.cai', 'ben.dev'])).toBe(false);
      expect(treeMet(team, ['ana.ben'])).toBe(false);
      const podium = payloadOf<TreePayload>('podium');
      expect(treeProblem(podium)).toBeNull();
      expect(treeLeaves(podium)).toHaveLength(6);
      expect(treeMet(podium, ['ana.cai.ben', 'ana.ben.cai'])).toBe(true);
      expect(treeMet(podium, ['ana.ben.cai'])).toBe(false);
      expect(treeProblem({ ...podium, first: undefined })).not.toBeNull();
      expect(treeProblem({ ...team, first: 'ana' })).not.toBeNull();
      expect(treeProblem({ items: ['ana', 'ben', 'ana'], pick: 2, mode: 'group' })).not.toBeNull();
      expect(treeProblem({ items: ['ana', 'ben'], pick: 3, mode: 'group' })).not.toBeNull();
    });

    it('builds Pascal rows and finds the multiples', () => {
      expect(pascalValues(6)).toEqual([[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1], [1, 5, 10, 10, 5, 1]]);
      expect(pascalByRow(pascalMultiples({ rows: 8, multiple: 2 }))).toEqual(keyOf('pascal-evens'));
      expect(pascalByRow(pascalMultiples({ rows: 9, multiple: 3 }))).toEqual(keyOf('pascal-threes'));
      expect(Object.keys(keyOf('pascal-evens'))).toEqual(['row-2', 'row-4', 'row-5', 'row-6']);
      expect(pascalAccepts('r4c2', 'row-4')).toBe(true);
      expect(pascalAccepts('r4c2', 'row-5')).toBe(false);
      expect(pascalAccepts('nope', 'row-4')).toBe(false);
      expect(pascalProblem({ rows: 3, multiple: 2 })).not.toBeNull();
      expect(pascalProblem({ rows: 6, multiple: 7 })).not.toBeNull();
      expect(pascalProblem({ rows: 6, multiple: 2, extra: 1 })).not.toBeNull();
    });

    it('grades by the rule of the task and reports what is missing', () => {
      expect(arrange('konigsberg', keyOf('konigsberg')).verdict).toBe('met');
      expect(arrange('konigsberg', { odd: ['north', 'south', 'east', 'island'] }).verdict).toBe('met');
      expect(arrange('konigsberg', { odd: ['north', 'south'] }).verdict).toBe('review');
      expect(arrange('konigsberg', {}).verdict).toBe('valid');
      expect(arrange('konigsberg', keyOf('konigsberg'), false).verdict).toBe('valid');
      expect(arrange('konigsberg', { odd: ['no-such-id'] }).verdict).toBe('invalid');
      expect(arrange('konigsberg', { odd: ['north', 'north'] }).verdict).toBe('invalid');
      expect(arrange('konigsberg', { walk: ['north'] }).verdict).toBe('invalid');
      const walk = ['bridge-6', 'bridge-5', 'bridge-3', 'bridge-1', 'bridge-4'];
      expect(arrange('bridge-walk', { walk: keyOf('bridge-walk').walk! }).verdict).toBe('met');
      expect(arrange('bridge-walk', { walk: eulerTrails(payloadOf<GraphPayload>('bridge-walk'))[3]! }).verdict).toBe('met');
      expect(arrange('bridge-walk', { walk }).verdict).toBe('review');
      expect(arrange('cheapest-route', keyOf('cheapest-route')).verdict).toBe('met');
      expect(arrange('cheapest-route', { route: ['home', 'shop', 'pool', 'school'] }).verdict).toBe('review');
      expect(arrange('cheapest-route', { route: ['school', 'pool', 'shop', 'park', 'home'] }).verdict).toBe('review');
      expect(arrange('cheapest-tie', { route: ['camp', 'ridge', 'cave', 'peak'] }).verdict).toBe('met');
      expect(arrange('cheapest-tie', { route: ['camp', 'creek', 'cave', 'peak'] }).verdict).toBe('met');
      expect(arrange('cheapest-tie', { route: ['camp', 'ridge', 'cave'] }).verdict).toBe('review');
      expect(arrange('team-picks', keyOf('team-picks')).verdict).toBe('met');
      expect(arrange('team-picks', { keep: ['ana.ben'] }).verdict).toBe('review');
      expect(arrange('podium', { keep: ['ana.cai.ben', 'ana.ben.cai'] }).verdict).toBe('met');
      expect(arrange('podium', { keep: ['ana.ben.cai', 'ben.ana.cai'] }).verdict).toBe('review');
      expect(arrange('pascal-evens', keyOf('pascal-evens')).verdict).toBe('met');
      expect(arrange('pascal-evens', { 'row-2': ['r2c1'], 'row-4': ['r4c1'] }).verdict).toBe('review');
      expect(arrange('pascal-evens', { ...keyOf('pascal-evens'), 'row-3': ['r3c1'] }).verdict).toBe('review');
      expect(arrange('pascal-evens', { 'row-9': ['r9c9'] }).verdict).toBe('invalid');
      expect(arrange('pascal-evens', { 'row-4': ['r2c1'] }).verdict).toBe('invalid');
      expect(arrange('pascal-evens', { 'row-0': ['r0c0', 'r0c0'] }).verdict).toBe('invalid');
      expect(arrange('pascal-evens', { 'row-1': ['r1c0', 'r1c1', 'r1c1'] }).verdict).toBe('invalid');
    });

    it('refuses a malformed or a wrong key as invalid, never met', () => {
      const segment = segmentOf('cheapest-route');
      const run = (rubric: unknown) => grader('cheapest-route')(segment, { slots: keyOf('cheapest-route') }, rubric).verdict;
      expect(run({ solutions: [{ route: ['home', 'shop', 'pool', 'school'] }] })).toBe('invalid');
      expect(run({ solutions: [] })).toBe('invalid');
      expect(run({ solutions: [keyOf('cheapest-route')], extra: 1 })).toBe('invalid');
      expect(run({ solutions: [{ route: ['no-such-id'] }] })).toBe('invalid');
      expect(run(null)).toBe('invalid');
      expect(grader('cheapest-route')({ ...segment, visual: { type: 'pascal' } }, { slots: keyOf('cheapest-route') }, { solutions: [keyOf('cheapest-route')] }).verdict).toBe('invalid');
      expect(networkMet('graph', payloadOf('konigsberg'), { walk: ['north'] })).toBe(false);
    });
  });

  describe('F2.17 unit circle, secant and Riemann sums', () => {
    it('finds the one angle of a level on the circle, by quadrant', () => {
      const circle = payloadOf<UnitCirclePayload>('unit-circle-cos');
      expect(unitCircleProblem(circle)).toBeNull();
      expect(unitCircleAngles(circle)).toEqual([135]);
      expect(unitCircleAngles({ ask: 'sin', level: 'root3', sign: -1, side: 'left', step: 30, start: 0 })).toEqual([240]);
      expect(unitCircleAngles({ ask: 'cos', level: 'one', sign: -1, step: 30, start: 0 })).toEqual([180]);
      expect(unitCircleAngles({ ask: 'sin', level: 'zero', sign: 1, side: 'right', step: 30, start: 90 })).toEqual([0]);
      expect([0, 45, 90, 135, 180, 225, 270, 315, 359].map(quadrantOf)).toEqual(['axis', 'quadrant-1', 'axis', 'quadrant-2', 'axis', 'quadrant-3', 'axis', 'quadrant-4', 'quadrant-4']);
      expect(unitCircleProblem({ ...circle, side: undefined })).not.toBeNull();
      expect(unitCircleProblem({ ...circle, level: 'one' })).not.toBeNull();
      expect(unitCircleProblem({ ...circle, start: 135 })).not.toBeNull();
      expect(unitCircleProblem({ ...circle, start: 7 })).not.toBeNull();
      expect(unitCircleProblem({ ...circle, step: 20 })).not.toBeNull();
      expect(unitCircleProblem({ ...circle, level: 'zero', sign: -1 })).not.toBeNull();
      expect(unitCircleProblem({ ask: 'cos', level: 'half', sign: 1, side: 'upper', step: 30, start: 0, extra: 1 })).not.toBeNull();
      expect(unitCircleProblem({ ask: 'cos', level: 'half', sign: 1, side: 'upper', step: 7, start: 0 })).not.toBeNull();
      expect(unitCircleProblem(null)).not.toBeNull();
    });

    it('unrolls the circle into a wave with one angle per slope', () => {
      const wave = payloadOf<CircleWavePayload>('circle-wave');
      expect(circleWaveProblem(wave)).toBeNull();
      expect(circleWaveAngles(wave)).toEqual([150]);
      expect(circleWaveAngles({ ...wave, slope: 'rising' })).toEqual([30]);
      expect(circleWaveAngles({ fn: 'cos', level: 'one', sign: 1, step: 30, start: 90 })).toEqual([0]);
      expect(circleWaveProblem({ ...wave, slope: undefined })).not.toBeNull();
      expect(circleWaveProblem({ fn: 'cos', level: 'one', sign: 1, slope: 'rising', step: 30, start: 90 })).not.toBeNull();
      expect(circleWaveProblem({ ...wave, start: 150 })).not.toBeNull();
      expect(circleWaveProblem({ ...wave, fn: 'tan' })).not.toBeNull();
    });

    it('measures a secant closing in on the tangent', () => {
      const payload = payloadOf<{ coeffs: [number, number, number, number]; a: number }>('secant-slope');
      expect(secantProblem(payload)).toBeNull();
      expect(slopeAt(payload.coeffs, payload.a)).toBe(-3);
      expect(secantSlope(payload.coeffs, payload.a, 1)).toBe(-5);
      expect(Math.abs(secantSlope(payload.coeffs, payload.a, 0.001) + 3)).toBeLessThan(0.01);
      expect(secantProblem({ coeffs: [0, 1, 0, 0], a: 1 })).not.toBeNull();
      expect(secantProblem({ coeffs: [0, 0, 0, 9], a: 3 })).not.toBeNull();
      expect(secantProblem({ coeffs: [0, 1, -2, 0], a: 4 })).not.toBeNull();
      expect(secantProblem({ coeffs: [0, 1.5, -2, 0], a: 1 })).not.toBeNull();
    });

    it('links f and f-prime with the roots of the slope', () => {
      const link = payloadOf<{ lead: 1 | -1; roots: [number, number]; base: number; ask: 'max' | 'min' }>('linked-graphs');
      expect(derivativeLinkProblem(link)).toBeNull();
      expect(derivativeLinkProblem({ ...link, roots: [0, 1] })).not.toBeNull();
      expect(derivativeLinkProblem({ ...link, roots: [2, -1] })).not.toBeNull();
      expect(derivativeLinkProblem({ ...link, lead: 2 })).not.toBeNull();
      expect(derivativeLinkProblem({ ...link, ask: 'zero' })).not.toBeNull();
      expect(explorerTruth('derivative-link', link)).toEqual({ predict: 'falling', value: -1 });
      expect(explorerTruth('derivative-link', { ...link, ask: 'min' })).toEqual({ predict: 'falling', value: 2 });
      expect(explorerTruth('derivative-link', { ...link, lead: -1 })).toEqual({ predict: 'rising', value: 2 });
    });

    it('finds the fewest rectangles within the tolerance and refuses an unclear one', () => {
      const sums = payloadOf<RiemannPayload>('riemann-sums');
      expect(riemannProblem(sums)).toBeNull();
      expect(areaOf(sums.coeffs, sums.from, sums.to)).toBe(12);
      expect(riemannError(sums, 1)).toBeLessThan(0);
      expect(riemannTruth(sums)).toEqual({ n: 7, sign: 'too-small' });
      expect(riemannTruth({ ...sums, method: 'right' })).toMatchObject({ sign: 'too-big' });
      expect(Math.abs(riemannError(sums, 7))).toBeLessThanOrEqual(2);
      expect(Math.abs(riemannError(sums, 6))).toBeGreaterThan(2);
      expect(riemannProblem({ ...sums, coeffs: [-1, 0, 0, 0] })).not.toBeNull();
      expect(riemannProblem({ ...sums, tolerance: 50 })).not.toBeNull();
      expect(riemannProblem({ ...sums, tolerance: 0.123 })).not.toBeNull();
      expect(riemannProblem({ ...sums, to: 1 })).not.toBeNull();
      expect(riemannProblem({ ...sums, method: 'simpson' })).not.toBeNull();
      expect(riemannProblem({ ...sums, tolerance: 12 })).not.toBeNull();
      expect(riemannProblem({ coeffs: [3, 0, 0, 0], from: 0, to: 3, method: 'left', tolerance: 1 })).not.toBeNull();
    });

    it('accumulates area exactly and needs one whole answer', () => {
      const area = payloadOf<AccumulationPayload>('area-so-far');
      expect(accumulationProblem(area)).toBeNull();
      expect(accumulationHits(area)).toEqual([6]);
      expect(explorerTruth('accumulation', area)).toEqual({ predict: 'flat', value: 6 });
      expect(accumulationProblem({ ...area, target: 16 })).not.toBeNull();
      expect(accumulationProblem({ ...area, target: 0 })).not.toBeNull();
      expect(accumulationProblem({ ...area, to: 2 })).not.toBeNull();
      expect(accumulationProblem({ ...area, coeffs: [6, -1, 0, 0.5] })).not.toBeNull();
      expect(explorerTruth('accumulation', { coeffs: [0, 1, 0, 0], from: 0, to: 6, target: 8 })).toEqual({ predict: 'growing', value: 4 });
    });

    it('holds the model answer as the only key', () => {
      for (const id of ['unit-circle-cos', 'unit-circle-sin', 'circle-wave', 'secant-slope', 'linked-graphs', 'riemann-sums', 'area-so-far']) {
        const segment = segmentOf(id);
        const key = fixture(id).rubric as { predict: string; value: number };
        expect(explorerTruth((segment.visual as { type: string }).type, segment.payload), id).toEqual(key);
        expect(explorerKeyProblem((segment.visual as { type: string }).type, segment.payload, key), id).toBeNull();
        expect(explorerKeyProblem((segment.visual as { type: string }).type, segment.payload, { ...key, value: key.value + 1 }), id).not.toBeNull();
      }
      expect(explorerTruth('nonsense', {})).toBeNull();
      expect(explorerTruth('unit-circle', { ask: 'cos' })).toBeNull();
    });

    it('grades the prediction and the number apart', () => {
      for (const id of ['unit-circle-cos', 'unit-circle-sin', 'circle-wave', 'secant-slope', 'linked-graphs', 'riemann-sums', 'area-so-far']) {
        const key = fixture(id).rubric as { predict: string; value: number };
        expect(explore(id, key).verdict, id).toBe('met');
        expect(explore(id, { predict: key.predict }).verdict, id).toBe('valid');
        expect(explore(id, key, false).verdict, id).toBe('valid');
        expect(explore(id, { predict: 'no-such-choice', value: key.value }).verdict, id).toBe('invalid');
        expect(explore(id, { value: key.value }).verdict, id).toBe('invalid');
        expect(explore(id, { ...key, extra: 1 }).verdict, id).toBe('invalid');
        expect(explore(id, { predict: key.predict, value: 1.5 }).verdict, id).toBe('invalid');
        expect(explore(id, { predict: key.predict, value: 99999 }).verdict, id).toBe('invalid');
        expect(explore(id, null).verdict, id).toBe('invalid');
        expect(explore(id, key.predict).verdict, id).toBe('invalid');
        const other = { 'unit-circle-cos': 'axis', 'unit-circle-sin': 'quadrant-1', 'circle-wave': 'times-1', 'secant-slope': 'positive', 'linked-graphs': 'rising', 'riemann-sums': 'too-big', 'area-so-far': 'growing' }[id]!;
        expect(explore(id, { predict: other, value: key.value })).toEqual({ verdict: 'review', diagnostic: 'miss' });
      }
      expect(explore('secant-slope', { predict: 'negative', value: -4 })).toEqual({ verdict: 'review', diagnostic: 'value' });
      expect(explore('riemann-sums', { predict: 'too-big', value: 9 })).toEqual({ verdict: 'review', diagnostic: 'value' });
      const segment = segmentOf('secant-slope');
      const run = (rubric: unknown) => grader('secant-slope')(segment, { predict: 'negative', value: -3 }, rubric).verdict;
      expect(run({ predict: 'positive', value: -3 })).toBe('invalid');
      expect(run({ predict: 'negative', value: 3 })).toBe('invalid');
      expect(run({ predict: 'negative' })).toBe('invalid');
      expect(run({ predict: 'negative', value: -3, extra: 1 })).toBe('invalid');
      expect(grader('secant-slope')({ ...segment, payload: { coeffs: [0, 1, 0, 0], a: 1 } }, { predict: 'negative', value: -3 }, undefined).verdict).toBe('invalid');
    });
  });

  describe('F2.18 bits and gates', () => {
    it('keeps the bits model strict and grades the sum', () => {
      expect(bitsProblem(payloadOf('bits-ten'))).toBeNull();
      expect(bitsProblem({ bits: 4, target: 16 })).not.toBeNull();
      expect(bitsProblem({ bits: 4, target: 0 })).not.toBeNull();
      expect(bitsProblem({ bits: 3, target: 5 })).not.toBeNull();
      expect(bitsProblem({ bits: 9, target: 5 })).not.toBeNull();
      expect(bitsProblem({ bits: 4, target: 5, extra: 1 })).not.toBeNull();
      expect(arrange('bits-ten', keyOf('bits-ten')).verdict).toBe('met');
      expect(arrange('bits-ten', { 'bits-on': ['bit-2', 'bit-8'] }).verdict).toBe('met');
      expect(arrange('bits-ten', { 'bits-on': ['bit-8', 'bit-4'] }).verdict).toBe('review');
      expect(arrange('bits-ten', { 'bits-on': ['bit-8', 'bit-2', 'bit-1'] }).verdict).toBe('review');
      expect(arrange('bits-ten', { 'bits-on': ['bit-128'] }).verdict).toBe('invalid');
      expect(arrange('bits-ten', {}).verdict).toBe('valid');
      expect(arrange('bits-byte', keyOf('bits-byte')).verdict).toBe('met');
      expect(arrange('bits-byte', { 'bits-on': ['bit-128', 'bit-64', 'bit-4'] }).verdict).toBe('review');
      expect(circuitExamples('bits', { bits: 4, target: 10 })).toEqual([{ 'bits-on': ['bit-8', 'bit-2'] }]);
    });

    it('keeps the gates model strict, one output wired from every position', () => {
      const xor = payloadOf<GatesPayload>('gates-xor');
      expect(gatesProblem(xor)).toBeNull();
      for (const bad of [undefined, null, 0, 'x', [], {}, { ...xor, expected: [0, 1, 1] }, { ...xor, expected: [1, 1, 1, 1] }, { ...xor, extra: 1 }, { ...xor, inputs: ['in-a', 'in-a'] },
        { ...xor, slots: [{ id: 'pos-1', from: ['pos-2', 'in-b'] }, ...xor.slots.slice(1)] }, { ...xor, slots: [{ id: 'pos-1', from: ['in-a', 'in-a'] }, ...xor.slots.slice(1)] },
        { ...xor, slots: [xor.slots[0], xor.slots[1], { id: 'pos-3', from: ['pos-1', 'in-a'] }] }, { ...xor, pieces: xor.pieces.slice(0, 2) }, { ...xor, pieces: [{ id: 'gate-a', kind: 'nope' }, ...xor.pieces.slice(1)] },
        { ...xor, expected: [0, 0, 0, 1] }, { ...xor, pieces: [{ id: 'in-a', kind: 'or' }, ...xor.pieces.slice(1)] }]) {
        expect(gatesProblem(bad), JSON.stringify(bad)).not.toBeNull();
      }
    });

    it('reads a circuit on every row of the truth table', () => {
      const alarm = payloadOf<GatesPayload>('gates-alarm');
      const met = keyOf('gates-alarm');
      expect(circuitOutputs(alarm, met)).toEqual(alarm.expected);
      expect(circuitMet(alarm, met)).toBe(true);
      expect(circuitOutputs(alarm, {})).toEqual(new Array(8).fill(null));
      expect(circuitOutputs(alarm, { 'pos-1': ['gate-d'], 'pos-2': ['gate-b'], 'pos-3': ['gate-c'] })).toEqual([0, 0, 1, 0, 1, 0, 0, 0]);
      expect(circuitOutputs(alarm, { 'pos-1': ['gate-b'], 'pos-2': ['gate-a'], 'pos-3': ['gate-c'] })).toEqual(new Array(8).fill(null));
      expect(evalCircuit(alarm, { 'pos-1': 'gate-a', 'pos-2': 'gate-b', 'pos-3': 'gate-c' }, 4)).toBe(1);
      expect(evalCircuit(alarm, { 'pos-1': 'gate-a', 'pos-2': 'gate-b', 'pos-3': 'gate-c' }, 5)).toBe(0);
      expect(circuitMet(alarm, { ...met, 'pos-3': [] })).toBe(false);
      expect(circuitMet(alarm, { ...met, 'pos-9': ['gate-a'] })).toBe(false);
      expect(circuitSolutions(alarm)).toEqual([met]);
      expect(circuitSolutions(payloadOf<GatesPayload>('gates-xor'))).toHaveLength(2);
    });

    it('takes a gate in a position of its own arity only', () => {
      const alarm = payloadOf<GatesPayload>('gates-alarm');
      const accepts = gatesAccepts(alarm);
      expect(accepts('gate-b', 'pos-2')).toBe(true);
      expect(accepts('gate-a', 'pos-1')).toBe(true);
      expect(accepts('gate-b', 'pos-1')).toBe(false);
      expect(accepts('gate-a', 'pos-2')).toBe(false);
      expect(accepts('no-such', 'pos-1')).toBe(false);
      expect(arrange('gates-alarm', { 'pos-1': ['gate-b'] }).verdict).toBe('invalid');
      expect(arrange('gates-alarm', { 'pos-2': ['gate-a'] }).verdict).toBe('invalid');
    });

    it('grades by the truth table, not only by the key', () => {
      expect(arrange('gates-alarm', keyOf('gates-alarm')).verdict).toBe('met');
      expect(arrange('gates-alarm', {}).verdict).toBe('valid');
      expect(arrange('gates-alarm', keyOf('gates-alarm'), false).verdict).toBe('valid');
      expect(arrange('gates-alarm', { 'pos-1': ['gate-d'], 'pos-2': ['gate-b'], 'pos-3': ['gate-c'] }).verdict).toBe('review');
      expect(arrange('gates-alarm', { 'pos-1': ['gate-a'] }).verdict).toBe('review');
      expect(arrange('gates-alarm', { 'pos-1': ['gate-a', 'gate-d'] }).verdict).toBe('invalid');
      expect(arrange('gates-xor', keyOf('gates-xor')).verdict).toBe('met');
      expect(arrange('gates-xor', { 'pos-1': ['gate-b'], 'pos-2': ['gate-a'], 'pos-3': ['gate-c'] }).verdict).toBe('met');
      expect(arrange('gates-xor', { 'pos-1': ['gate-a'], 'pos-2': ['gate-d'], 'pos-3': ['gate-c'] }).verdict).toBe('review');
      expect(arrange('gates-xor', { 'pos-1': ['gate-a'], 'pos-2': ['gate-a'] }).verdict).toBe('invalid');
    });
  });

  it('is open to the declared ages and the adult pathway', () => {
    const scope = (type: string, band: string, minimum_age: number, maximum_age: number) => horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } });
    for (const type of ['math.network-count.v2', 'computing.bits-gates.v2']) {
      expect(scope(type, '10-12', 10, 12), type).toBeNull();
      expect(scope(type, '13-17', 13, 17), type).toBeNull();
      expect(scope(type, 'adult', 18, 99), type).toBeNull();
      expect(scope(type, '6-9', 6, 9), type).not.toBeNull();
      expect(scope(type, '10-12', 9, 12), type).not.toBeNull();
    }
    for (const type of ['trig.unit-circle.v2', 'calculus.explorer.v2']) {
      expect(scope(type, '13-17', 15, 17), type).toBeNull();
      expect(scope(type, 'adult', 18, 99), type).toBeNull();
      expect(scope(type, '13-17', 13, 17), type).not.toBeNull();
      expect(scope(type, '10-12', 10, 12), type).not.toBeNull();
    }
  });

  describe('plugs into Core', () => {
    const lesson = (id: string, locale: Locale) => {
      const item = fixture(id);
      const type = item.segment('en-US').type as keyof typeof COM_CAPABILITIES;
      return {
        schema_version: 2, course_id: 'financial-education', pathway_id: `horizonte-${item.ageBand}`, chapter_id: 'horizonte-com', lesson_id: `hz-com-${id}`,
        version_id: 'rev-1', locale, age_band: item.ageBand, eligibility: item.eligibility, knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a',
        title: item.title[locale], required_capabilities: [...COM_CAPABILITIES[type]], segments: [item.segment(locale)],
      };
    };

    it('parses every fixture in every locale, keys it, grades it and never leaks', () => {
      for (const item of COM_FIXTURES) {
        for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(v2PublicLessonSchema.safeParse(lesson(item.id, locale)).success, `${item.id} ${locale}`).toBe(true);
        const document = lesson(item.id, 'en-US');
        const keys = { [item.id]: item.rubric };
        expect(validateV2LessonForGrading(document, keys, { lessonId: document.lesson_id, locale: 'en-US' }), item.id).not.toBeNull();
        const parsed = v2PublicLessonSchema.parse(document);
        expect(gradeV2Visual(parsed, keys, item.id, item.ladder.met), item.id).toMatchObject({ score: 100, correct: true });
        expect(gradeV2Visual(parsed, keys, item.id, item.ladder.valid), item.id).toBeNull();
        expect(gradeV2Visual(parsed, keys, item.id, item.ladder.invalid), item.id).toBeNull();
        expect(horizonteGrade(item.segment('en-US') as { type: string }, item.ladder.met, item.rubric)).toMatchObject({ score: 100, correct: true });
        expect(horizonteSampleVerdict(item.segment('en-US') as { type: string }, item.rubric)).toBe('met');
        const text = JSON.stringify(v2PublicLessonSchema.parse(document));
        expect(text).not.toContain('solutions');
        expect(text).not.toContain('"predict"');
      }
    });

    it('scores a wrong answer as a review the learner sees', () => {
      const parsed = v2PublicLessonSchema.parse(lesson('secant-slope', 'en-US'));
      const keys = { 'secant-slope': fixture('secant-slope').rubric };
      expect(gradeV2Visual(parsed, keys, 'secant-slope', { predict: 'negative', value: -4 })).toMatchObject({ score: 0, correct: false, diagnostic: 'value' });
      const route = v2PublicLessonSchema.parse(lesson('cheapest-route', 'en-US'));
      expect(gradeV2Visual(route, { 'cheapest-route': fixture('cheapest-route').rubric }, 'cheapest-route', { slots: { route: ['home', 'shop', 'pool', 'school'] } })).toMatchObject({ score: 0, correct: false });
    });

    it('refuses an answer in the payload, an unsolvable payload, a wrong visual and a missing label', () => {
      const patch = (id: string, changes: Record<string, unknown>) => { const base = lesson(id, 'en-US'); return { ...base, segments: [{ ...base.segments[0], ...changes }] }; };
      const payload = (id: string) => segmentOf(id).payload as Record<string, unknown>;
      const ok = (document: unknown) => v2PublicLessonSchema.safeParse(document).success;
      expect(ok(patch('konigsberg', { payload: { ...payload('konigsberg'), solutions: [] } }))).toBe(false);
      expect(ok(patch('konigsberg', { visual: { type: 'pascal' } }))).toBe(false);
      expect(ok(patch('konigsberg', { labels: { island: 'Island' } }))).toBe(false);
      expect(ok(patch('konigsberg', { labels: undefined }))).toBe(false);
      expect(ok(patch('pascal-evens', { labels: { 'r0c0': 'Top' } }))).toBe(false);
      expect(ok(patch('secant-slope', { payload: { ...payload('secant-slope'), predict: 'negative' } }))).toBe(false);
      expect(ok(patch('secant-slope', { payload: { coeffs: [0, 1, 0, 0], a: 1 } }))).toBe(false);
      expect(ok(patch('secant-slope', { labels: { a: 'x' } }))).toBe(false);
      expect(ok(patch('riemann-sums', { payload: { ...payload('riemann-sums'), tolerance: 12 } }))).toBe(false);
      expect(ok(patch('gates-alarm', { payload: { ...payload('gates-alarm'), expected: [0, 0, 0, 0, 0, 0, 0, 1] } }))).toBe(false);
      expect(ok(patch('gates-alarm', { labels: { 'in-door': 'Door' } }))).toBe(false);
      expect(ok(patch('bits-ten', { payload: { bits: 4, target: 99 } }))).toBe(false);
      expect(ok(patch('cheapest-route', { payload: { ...payload('cheapest-route'), start: 'school' } }))).toBe(false);
    });
  });
});
