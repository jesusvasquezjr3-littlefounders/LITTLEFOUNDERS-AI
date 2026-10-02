import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { space2, SPACE2_CAPABILITIES } from '../../v2/horizonte/space2.js';
import {
  compoundCents, distanceKm, feeCents, globeKey, nextYearCents, PLACE_IDS, profitCents, readArPayload, readGlobePayload, readSurfacePayload,
  routeDistances, routeFees, surfaceGrid, surfaceKey,
} from '../../v2/horizonte/space2Geometry.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';

const SURFACE = 'math.surface.v2';
const GLOBE = 'geography.globe-route.v2';
const AR = 'space.ar-table.v2';
const TYPES = [SURFACE, GLOBE, AR];

const surface = (payload: Record<string, unknown>, id = 'seg-surface') => ({ id, type: SURFACE, grading: 'server', visual: { type: 'surface' }, payload });
const globe = (payload: Record<string, unknown>, id = 'seg-globe') => ({ id, type: GLOBE, grading: 'server', visual: { type: 'globe-route' }, payload });
const table = (payload: Record<string, unknown>, id = 'seg-ar') => ({ id, type: AR, grading: 'none', visual: { type: 'ar-table' }, payload });

const timeBeatsRate = () => surface({
  surface: { kind: 'compound', principalCents: 100000, ratesBps: [200, 400, 600, 800], terms: [5, 10, 15, 20] },
  ask: { kind: 'highest' },
  options: [{ id: 'a', x: 1, y: 3 }, { id: 'b', x: 3, y: 0 }, { id: 'c', x: 2, y: 2 }, { id: 'd', x: 0, y: 3 }],
});
const priceAndUnits = () => surface({
  surface: { kind: 'profit', unitCostCents: 150, fixedCents: 20000, prices: [200, 300, 400, 500], units: [50, 100, 150, 200] },
  ask: { kind: 'reach', targetCents: 10000 },
  options: [{ id: 'a', x: 0, y: 3 }, { id: 'b', x: 1, y: 2 }, { id: 'c', x: 2, y: 1 }, { id: 'd', x: 3, y: 1 }],
});
const cheapest = (ask: 'shortest' | 'longest' | 'cheapest' = 'cheapest') => globe({
  routes: [
    { id: 'a', from: 'los-angeles', to: 'mexico-city', feeBps: 400, flatCents: 800 },
    { id: 'b', from: 'los-angeles', to: 'manila', feeBps: 150, flatCents: 300 },
    { id: 'c', from: 'los-angeles', to: 'lagos', feeBps: 350, flatCents: 400 },
    { id: 'd', from: 'los-angeles', to: 'new-york', feeBps: 250, flatCents: 700 },
  ],
  ask,
  sendCents: 20000,
});
const nearest = () => globe({
  routes: [
    { id: 'a', from: 'mexico-city', to: 'madrid', feeBps: 300, flatCents: 500 },
    { id: 'b', from: 'mexico-city', to: 'houston', feeBps: 400, flatCents: 300 },
    { id: 'c', from: 'mexico-city', to: 'tokyo', feeBps: 250, flatCents: 600 },
    { id: 'd', from: 'mexico-city', to: 'new-york', feeBps: 350, flatCents: 400 },
  ],
  ask: 'shortest',
  sendCents: 20000,
});

const flatSurface = () => surface({
  surface: { kind: 'compound', principalCents: 100, ratesBps: [0, 1, 2], terms: [0, 1, 2] },
  ask: { kind: 'highest' },
  options: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 2, y: 2 }],
});

const gates = (segments: unknown[], ageBand = '13-17') => horizontePieceGates({ age_band: ageBand, segments } as never);
const findings = (segment: { id: string }, key?: unknown) => runSolvabilityGate({ segments: [segment] }, key === undefined ? undefined : { [segment.id]: key });
const codes = (segment: { id: string }, key?: unknown) => findings(segment, key).map((item) => item.code).sort();

describe('space2 pack in the Forge (F4.7 surface, F4.8 globe, F4.9 AR table)', () => {
  it('declares the capability literals and the emitter map spreads them', () => {
    expect(SPACE2_CAPABILITIES[SURFACE]).toEqual(['visual.surface.v1', 'operation.read-surface.v1', 'operation.slice-surface.v1']);
    expect(SPACE2_CAPABILITIES[GLOBE]).toEqual(['visual.globe-route.v1', 'operation.rotate-globe.v1', 'operation.compare-routes.v1']);
    expect(SPACE2_CAPABILITIES[AR]).toEqual(['visual.ar-table.v1', 'operation.view-object.v1', 'operation.optional-ar.v1']);
    for (const type of TYPES) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(SPACE2_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(SPACE2_CAPABILITIES[type]);
    }
    expect(HORIZONTE_FORGE_PACKS).toContain(space2);
  });

  it('adds authoring guidance only for the types a skeleton uses', () => {
    expect(horizonteGuidanceFor([SURFACE]).join('\n')).toMatch(/third real variable/);
    expect(horizonteGuidanceFor([GLOBE]).join('\n')).toMatch(/great-circle distance/);
    expect(horizonteGuidanceFor([AR]).join('\n')).toMatch(/never mentions the camera/);
    expect(horizonteGuidanceFor([AR]).join('\n')).toMatch(/grading is none/);
    expect(horizonteGuidanceFor([SURFACE]).join('\n')).not.toMatch(/great-circle/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('registers a solvability checker for the two graded types and none for the unscored one', () => {
    expect(registeredSolvabilityTypes()).toEqual(expect.arrayContaining([SURFACE, GLOBE]));
    expect(registeredSolvabilityTypes()).not.toContain(AR);
  });

  describe('the Forge model copy', () => {
    it('rounds a year of interest half up and computes compound and profit in whole cents', () => {
      expect(nextYearCents(100000, 200)).toBe(102000);
      expect(nextYearCents(1, 5000)).toBe(2);
      expect(nextYearCents(3, 1000)).toBe(3);
      expect(compoundCents(100000, 200, 5)).toBe(110408);
      expect(compoundCents(100000, 600, 0)).toBe(100000);
      expect(profitCents(150, 20000, 500, 150)).toBe(32500);
      expect(profitCents(150, 20000, 200, 50)).toBe(-17500);
    });

    it('keeps the grid and the keys of the two fixtures', () => {
      const compound = readSurfacePayload(timeBeatsRate().payload)!;
      expect(surfaceGrid(compound.surface)).toHaveLength(4);
      expect(surfaceKey(compound)).toBe('c');
      expect(surfaceKey(readSurfacePayload(priceAndUnits().payload)!)).toBe('d');
    });

    it('measures great circles in whole kilometres and fees in whole cents', () => {
      expect(PLACE_IDS).toHaveLength(16);
      expect(distanceKm('mexico-city', 'houston')).toBe(1215);
      expect(distanceKm('houston', 'mexico-city')).toBe(1215);
      expect(distanceKm('tokyo', 'houston')).toBe(10730);
      expect(distanceKm('madrid', 'madrid')).toBe(0);
      expect(feeCents(20000, 400, 800)).toBe(1600);
      expect(feeCents(20000, 150, 300)).toBe(600);
      const payload = readGlobePayload(cheapest().payload)!;
      expect(routeFees(payload)).toEqual([1600, 600, 1100, 1200]);
      expect(globeKey(payload)).toBe('b');
      const shortest = readGlobePayload(nearest().payload)!;
      expect(routeDistances(shortest)).toHaveLength(4);
      expect(globeKey(shortest)).toBe('b');
    });

    it('reads an AR payload only when it names a listed object', () => {
      expect(readArPayload({ object: 'litre-box' })).toEqual({ object: 'litre-box' });
      expect(readArPayload({ object: 'litre-box', camera: true })).toBeNull();
      expect(readArPayload({ object: 'sofa' })).toBeNull();
      expect(readArPayload(null)).toBeNull();
    });
  });

  describe('piece gates', () => {
    it('accept the well formed boards and a document with no key', () => {
      expect(gates([timeBeatsRate(), priceAndUnits(), cheapest(), nearest(), table({ object: 'litre-box' })])).toEqual([]);
      expect(gates([nearest()], '10-12')).toEqual([]);
      expect(gates([cheapest('shortest')])).toEqual([]);
    });

    it('refuse a malformed surface, a flat one and a question with no single answer', () => {
      expect(gates([surface({ surface: { kind: 'compound' } })])[0]).toMatchObject({ gate: 4, segmentId: 'seg-surface', message: expect.stringMatching(/malformed/) });
      const tie = surface({
        surface: { kind: 'profit', unitCostCents: 100, fixedCents: 0, prices: [200, 300, 400], units: [10, 20, 30] },
        ask: { kind: 'highest' },
        options: [{ id: 'a', x: 2, y: 1 }, { id: 'b', x: 1, y: 2 }],
      });
      expect(gates([tie])[0]?.message).toMatch(/Exactly one option must be the highest/);
      const none = surface({ ...(priceAndUnits().payload as Record<string, unknown>), ask: { kind: 'reach', targetCents: 99999999 } });
      expect(gates([none])[0]?.message).toMatch(/Exactly one option must reach the target/);
      const several = surface({ ...(priceAndUnits().payload as Record<string, unknown>), ask: { kind: 'reach', targetCents: 0 } });
      expect(gates([several])[0]?.message).toMatch(/Exactly one option must reach the target/);
    });

    it('refuse a surface that is flat everywhere (a one-dollar principal never grows at 0 to 2 basis points)', () => {
      expect(gates([flatSurface()])[0]).toMatchObject({ gate: 4, segmentId: 'seg-surface', message: 'The surface must not be flat' });
    });

    it('refuse a route to itself, a repeated corridor, a tie and a distance inside the margin', () => {
      const withRoutes = (routes: unknown[], ask = 'cheapest') => globe({ routes, ask, sendCents: 20000 });
      const route = (id: string, from: string, to: string, feeBps = 300, flatCents = 100) => ({ id, from, to, feeBps, flatCents });
      expect(gates([withRoutes([route('a', 'tokyo', 'tokyo'), route('b', 'tokyo', 'lagos', 100)])])[0]?.message).toMatch(/two different places/);
      expect(gates([withRoutes([route('a', 'tokyo', 'lagos'), route('b', 'lagos', 'tokyo', 100)])])[0]?.message).toMatch(/corridor is listed once/);
      expect(gates([withRoutes([route('a', 'tokyo', 'lagos'), route('b', 'tokyo', 'manila')])])[0]?.message).toMatch(/lowest fee/);
      expect(gates([withRoutes([route('a', 'tokyo', 'houston'), route('b', 'tokyo', 'madrid')], 'longest')])[0]?.message).toMatch(/at least 2 percent/);
      expect(gates([globe({ routes: [], ask: 'cheapest', sendCents: 20000 })])[0]?.message).toMatch(/malformed/);
      expect(gates([globe({ ...(cheapest().payload as Record<string, unknown>), sendCents: 5 })])[0]?.message).toMatch(/malformed/);
      expect(gates([withRoutes([route('a', 'tokyo', 'atlantis'), route('b', 'tokyo', 'lagos')])])[0]?.message).toMatch(/malformed/);
    });

    it('refuse an AR payload that is not a listed object', () => {
      expect(gates([table({ object: 'sofa' })])[0]).toMatchObject({ gate: 4, segmentId: 'seg-ar', message: expect.stringMatching(/exactly \{ object \}/) });
      expect(gates([table({ object: 'litre-box', camera: true })])).toHaveLength(1);
    });

    it('refuse a wrong visual, a wrong grading, an age band out of scope and a long prompt', () => {
      expect(gates([{ ...timeBeatsRate(), visual: { type: 'globe-route' } }])[0]?.message).toMatch(/visual type surface/);
      expect(gates([{ ...cheapest(), visual: { type: 'surface' } }])[0]?.message).toMatch(/visual type globe-route/);
      expect(gates([{ ...table({ object: 'litre-box' }), visual: { type: 'surface' } }])[0]?.message).toMatch(/visual type ar-table/);
      expect(gates([{ ...table({ object: 'litre-box' }), grading: 'server' }])[0]?.message).toMatch(/not scored/);
      expect(gates([{ ...timeBeatsRate(), grading: 'none' }])[0]?.message).toMatch(/graded on Core/);
      expect(gates([{ ...table({ object: 'litre-box' }), grading: undefined }])[0]?.message).toMatch(/not scored/);
      expect(gates([timeBeatsRate()], '10-12')[0]?.message).toMatch(/age band 13-17, adult/);
      expect(gates([table({ object: 'litre-box' })], '10-12')[0]?.message).toMatch(/age band 13-17, adult/);
      expect(gates([timeBeatsRate()], 'adult')).toEqual([]);
      expect(gates([{ ...cheapest(), prompt: Array.from({ length: 30 }, () => 'word').join(' ') }])[0]?.message).toMatch(/at most 24 words/);
    });

    it('ignore every other segment type', () => {
      expect(gates([{ id: 'x', type: 'money.allocation.v2', visual: { type: 'whatever' }, payload: {} }])).toEqual([]);
    });
  });

  describe('solvability checkers', () => {
    it('prove the surface has one answer and judge the key', () => {
      expect(findings(timeBeatsRate(), { choice: 'c' })).toEqual([]);
      expect(findings(priceAndUnits(), { choice: 'd' })).toEqual([]);
      expect(findings(timeBeatsRate())).toEqual([]);
      expect(codes(timeBeatsRate(), { choice: 'a' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(priceAndUnits(), { choice: 'z' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    });

    it('name a flat surface as an impossible state', () => {
      expect(codes(flatSurface())).toEqual(['impossible-state']);
    });

    it('name a tie as ambiguous and an unreachable target as no solution', () => {
      const tie = surface({
        surface: { kind: 'profit', unitCostCents: 100, fixedCents: 0, prices: [200, 300, 400], units: [10, 20, 30] },
        ask: { kind: 'highest' },
        options: [{ id: 'a', x: 2, y: 1 }, { id: 'b', x: 1, y: 2 }],
      });
      expect(codes(tie)).toEqual(['ambiguous-solution']);
      const none = surface({ ...(priceAndUnits().payload as Record<string, unknown>), ask: { kind: 'reach', targetCents: 99999999 } });
      expect(codes(none)).toEqual(['no-solution']);
      const several = surface({ ...(priceAndUnits().payload as Record<string, unknown>), ask: { kind: 'reach', targetCents: 0 } });
      expect(codes(several)).toEqual(['ambiguous-solution']);
    });

    it('prove the globe has one answer and judge the key', () => {
      expect(findings(cheapest(), { choice: 'b' })).toEqual([]);
      expect(findings(nearest(), { choice: 'b' })).toEqual([]);
      expect(findings(cheapest())).toEqual([]);
      expect(codes(cheapest(), { choice: 'a' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(nearest(), { choice: 'd' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    });

    it('name a fee tie, a distance inside the margin, a repeated corridor and a route to itself', () => {
      const route = (id: string, from: string, to: string, feeBps = 300, flatCents = 100) => ({ id, from, to, feeBps, flatCents });
      const withRoutes = (routes: unknown[], ask = 'cheapest') => globe({ routes, ask, sendCents: 20000 });
      expect(codes(withRoutes([route('a', 'tokyo', 'lagos'), route('b', 'tokyo', 'manila')]))).toEqual(['ambiguous-solution']);
      expect(codes(withRoutes([route('a', 'tokyo', 'houston'), route('b', 'tokyo', 'madrid')], 'longest'))).toEqual(['ambiguous-solution']);
      expect(codes(withRoutes([route('a', 'tokyo', 'lagos'), route('b', 'lagos', 'tokyo', 100)]))).toEqual(['duplicate-id']);
      expect(codes(withRoutes([route('a', 'tokyo', 'tokyo'), route('b', 'tokyo', 'lagos', 100)]))).toEqual(['impossible-state']);
    });

    it('refuse a malformed payload or key without throwing', () => {
      expect(codes({ id: 'seg-bad', type: SURFACE, payload: { surface: {} } } as never)).toEqual(['impossible-state']);
      expect(codes({ id: 'seg-bad', type: GLOBE, payload: { routes: 'nope' } } as never)).toEqual(['impossible-state']);
      expect(codes(timeBeatsRate(), 'nope')).toEqual(['impossible-state']);
      expect(codes(timeBeatsRate(), { choice: 'c', extra: true })).toEqual(['impossible-state']);
      expect(codes(timeBeatsRate(), { choice: 3 })).toEqual(['impossible-state']);
      expect(codes(cheapest(), { pick: 'b' })).toEqual(['impossible-state']);
    });

    it('never asks for a key on the unscored AR step', () => {
      expect(findings(table({ object: 'litre-box' }))).toEqual([]);
    });
  });
});
