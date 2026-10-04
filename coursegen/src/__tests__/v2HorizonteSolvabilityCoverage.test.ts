// A guard over the solvability gate for Horizonte: a new board kind cannot ship without a checker, a stale exemption
// is caught, and the checkers are shown to refuse an unsolvable board in every pack, not only to pass the good fixture.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadMarketInventory } from '../contentGates/regional.js';
import { FIXTURE_EMITTED_HORIZONTE, FIXTURE_PLANS_HORIZONTE } from '../v2/cli.js';
import type { EmittedV2Document } from '../v2/emit.js';
import { analyzeV2Plan, runV2DocumentGates, SOLVABILITY_GATE } from '../v2/gates.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizontePieceGates } from '../v2/horizonte/index.js';
import { loadV2Plans } from '../v2/plan.js';
import '../v2/solvabilityPacks.js';
import { runSolvabilityGate, solvabilityCoverage, type SolvabilityFinding } from '../v2/solvability.js';

const AR_TABLE = 'space.ar-table.v2';
/** Types that are not scored on Core, so there is nothing to prove solvable. Anything added here must be shown ungraded below. */
const UNGRADED_EXEMPTIONS: readonly string[] = [AR_TABLE];
/** The only operations an unscored board may declare: looking at the object and the optional AR view. */
const UNSCORED_OPERATIONS: readonly string[] = ['operation.view-object.v1', 'operation.optional-ar.v1'];

const rows = JSON.parse(readFileSync(FIXTURE_EMITTED_HORIZONTE, 'utf8')) as EmittedV2Document[];
const plans = loadV2Plans(FIXTURE_PLANS_HORIZONTE).map((entry) => entry.plan!);
const planById = new Map(plans.map((plan) => [plan.lesson_id, plan]));
const markets = loadMarketInventory();
const horizonteTypes = Object.keys(HORIZONTE_FORGE_CAPABILITIES);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const label = (row: EmittedV2Document) => `${row.lesson_id} (${row.locale})`;
const blocking = (findings: readonly SolvabilityFinding[]) => findings.filter((finding) => finding.severity === 'block');

type Bag = Record<string, unknown>;
const bag = (value: unknown): Bag => value as Bag;
const list = (value: unknown): unknown[] => value as unknown[];

interface Mutation {
  type: string;
  why: string;
  /** Turns the segment's public payload into one no learner can solve. */
  apply: (payload: Bag) => void;
}

/** One deliberately unsolvable board per pack; the key of the table is the pack id. */
const UNSOLVABLE: Readonly<Record<string, Mutation>> = {
  golden: { type: 'math.ten-frame.v2', why: 'the frame starts with more counters than it has cells', apply: (payload) => { payload.start = [11]; } },
  'num-a': { type: 'math.rekenrek.v2', why: 'a rekenrek row starts with more beads than the row holds', apply: (payload) => { payload.start = [11, 0]; } },
  'num-b': { type: 'math.array-area.v2', why: 'an array with no rows has no area to find', apply: (payload) => { payload.rows = 0; } },
  balance: { type: 'math.equation-balance.v2', why: 'both sides carry the same x, so no x balances them', apply: (payload) => { bag(bag(payload.start).r).x = 3; } },
  stats1: { type: 'stats.dot-plot.v2', why: 'a single dot cannot be moved to a different median', apply: (payload) => { payload.dots = [2]; } },
  plane1: { type: 'alg.slope-triangle.v2', why: 'the line leaves the grid', apply: (payload) => { bag(payload.grid).xMax = 2; } },
  fin1: { type: 'money.compound-interest.v2', why: 'the challenge asks for more than any allowed run can earn', apply: (payload) => { bag(payload.challenge).minimumCents = 99_999_999; } },
  fin2: { type: 'money.cash-flow.v2', why: 'two items cannot fill every column the board asks for', apply: (payload) => { payload.items = list(payload.items).slice(0, 2); } },
  alg1: { type: 'math.algebra-tiles.v2', why: 'no tiles are left to build the target', apply: (payload) => { bag(payload.counts)['unit-pos'] = 0; } },
  alg2: { type: 'math.function-graph.v2', why: 'no slider step puts a line through both marks', apply: (payload) => { payload.marks = [{ x: 0, y: -3 }, { x: 2, y: 2 }]; } },
  geom2: { type: 'math.geoboard.v2', why: 'the target area does not fit on the board', apply: (payload) => { payload.size = 2; } },
  prob: { type: 'prob.tree.v2', why: 'a chip every branch needs is missing', apply: (payload) => { payload.chips = list(payload.chips).filter((chip) => chip !== 891); } },
  com: { type: 'math.network-count.v2', why: 'a network with no edges has no odd node to find', apply: (payload) => { payload.edges = []; } },
  sim1: { type: 'math.chance-sim.v2', why: 'the minimum number of trials is beyond the last stop', apply: (payload) => { payload.minTrials = 100_000; } },
  sim2: { type: 'money.life-sim.v2', why: 'the floor is out of reach of every choice', apply: (payload) => { payload.floor = 999_999; } },
  solids: { type: 'geometry.solid-viewer.v2', why: 'no listed solid has the requested number of vertices', apply: (payload) => { payload.solids = ['cube', 'pyramid']; } },
  space1: { type: 'geometry.mental-rotation.v2', why: 'the target is not a turn of the figure', apply: (payload) => { payload.targets = [[[0, 0, 0]]]; } },
  space2: { type: 'math.surface.v2', why: 'a flat surface has no highest cell', apply: (payload) => { bag(payload.surface).principalCents = 0; } },
};

describe('solvability coverage of the Horizonte segment types', () => {
  it('merges every pack into one capability map without a pack overwriting another', () => {
    const fromPacks = HORIZONTE_FORGE_PACKS.flatMap((pack) => Object.keys(pack.capabilities));
    expect(fromPacks.length).toBeGreaterThan(60);
    expect(new Set(fromPacks).size, 'a segment type is declared by two packs').toBe(fromPacks.length);
    expect([...horizonteTypes].sort()).toEqual([...fromPacks].sort());
  });

  it('registers a solvability checker for every Horizonte type except the unscored AR table', () => {
    const { checked, unchecked } = solvabilityCoverage(horizonteTypes);
    expect(unchecked.filter((type) => !UNGRADED_EXEMPTIONS.includes(type)), 'these types ship with no solvability checker').toEqual([]);
    expect(checked.length + unchecked.length).toBe(horizonteTypes.length);
    for (const exempt of UNGRADED_EXEMPTIONS) {
      expect(horizonteTypes, `${exempt} is exempt but is not a Horizonte type`).toContain(exempt);
      expect(unchecked, `${exempt} is exempt but has a checker, so drop the exemption`).toContain(exempt);
    }
    expect([...unchecked].sort()).toEqual([...UNGRADED_EXEMPTIONS].sort());
  });

  it('keeps the exemption honest: every exempt type declares no scored operation, is gated as unscored and carries no key', () => {
    for (const exempt of UNGRADED_EXEMPTIONS) {
      const entry = (HORIZONTE_FORGE_CAPABILITIES as Record<string, readonly string[]>)[exempt]!;
      const operations = entry.filter((capability) => capability.startsWith('operation.'));
      expect(operations.length, exempt).toBeGreaterThan(0);
      for (const operation of operations) expect(UNSCORED_OPERATIONS, `${exempt} declares ${operation}, which scores the learner`).toContain(operation);
      expect(entry, exempt).toContain('operation.optional-ar.v1');

      const own = rows.filter((row) => row.document.segments.some((segment) => segment.type === exempt));
      expect(own.length, `${exempt} is not in the emitted fixture`).toBeGreaterThan(0);
      for (const row of own) {
        for (const segment of row.document.segments.filter((candidate) => candidate.type === exempt)) {
          expect(segment.grading, `${label(row)} ${segment.id}`).toBe('none');
          expect(Object.hasOwn(row.answer_keys, segment.id), `${label(row)} ${segment.id} carries a key`).toBe(false);
        }
        const scored = clone(row);
        for (const segment of scored.document.segments.filter((candidate) => candidate.type === exempt)) segment.grading = 'server';
        const before = horizontePieceGates(row.document, row.answer_keys).filter((problem) => problem.message.includes('not scored'));
        const after = horizontePieceGates(scored.document, scored.answer_keys).filter((problem) => problem.message.includes('not scored'));
        expect(before, label(row)).toEqual([]);
        expect(after.length, `${label(row)}: the pack gate must refuse a scored ${exempt}`).toBeGreaterThan(0);
      }
    }
  });

  it('exempts exactly the types the fixture leaves ungraded, so a graded type never slips past without a checker', () => {
    const ungradedInFixture = new Set<string>();
    for (const row of rows) {
      for (const segment of row.document.segments) {
        if (segment.grading === 'none') ungradedInFixture.add(segment.type);
        else if (!UNGRADED_EXEMPTIONS.includes(segment.type)) expect(solvabilityCoverage([segment.type]).unchecked, `${label(row)} ${segment.id} is graded but unchecked`).toEqual([]);
      }
    }
    expect([...ungradedInFixture].filter((type) => Object.hasOwn(HORIZONTE_FORGE_CAPABILITIES, type)).sort()).toEqual([...UNGRADED_EXEMPTIONS].sort());
  });
});

describe('the emitted Horizonte fixture under the solvability gate', () => {
  it('exercises every checked Horizonte type at least once, so a checker is never silently skipped', () => {
    const inFixture = new Set(rows.flatMap((row) => row.document.segments.map((segment) => segment.type)));
    const { checked } = solvabilityCoverage(horizonteTypes);
    expect(checked.filter((type) => !inFixture.has(type)), 'checked types the fixture never uses').toEqual([]);
  });

  it('raises no blocking finding without answer keys (release time) and with them (emit time)', () => {
    for (const row of rows) {
      expect(blocking(runSolvabilityGate(row.document)), `${label(row)} without keys`).toEqual([]);
      expect(blocking(runSolvabilityGate(row.document, row.answer_keys)), `${label(row)} with keys`).toEqual([]);
    }
  });

  it('holds a key for every checked graded segment, so the with-keys run judges it', () => {
    for (const row of rows) {
      for (const segment of row.document.segments) {
        if (segment.grading !== 'server') continue;
        expect(Object.hasOwn(row.answer_keys, segment.id), `${label(row)} ${segment.id}`).toBe(true);
      }
    }
  });
});

describe('a deliberately unsolvable board is refused in every pack', () => {
  it('names one mutation per pack and each belongs to a type its pack declares', () => {
    expect(Object.keys(UNSOLVABLE).sort()).toEqual(HORIZONTE_FORGE_PACKS.map((pack) => pack.id as string).sort());
    for (const pack of HORIZONTE_FORGE_PACKS) {
      expect(Object.keys(pack.capabilities), `${pack.id}: ${UNSOLVABLE[pack.id]!.type}`).toContain(UNSOLVABLE[pack.id]!.type);
    }
  });

  for (const pack of HORIZONTE_FORGE_PACKS) {
    const mutation = UNSOLVABLE[pack.id]!;
    it(`${pack.id}: refuses a ${mutation.type} where ${mutation.why}`, () => {
      const source = rows.find((row) => row.locale === 'en-US' && row.document.segments.some((segment) => segment.type === mutation.type));
      expect(source, `no en-US fixture row holds a ${mutation.type}`).toBeDefined();
      const policy = analyzeV2Plan(planById.get(source!.lesson_id)!, markets);
      const row = clone(source!);
      const target = row.document.segments.find((segment) => segment.type === mutation.type)!;
      const mine = (findings: readonly SolvabilityFinding[]) => blocking(findings).filter((finding) => finding.segmentId === target.id);

      expect(mine(runSolvabilityGate(row.document, row.answer_keys)), 'the unmutated board must pass').toEqual([]);
      expect(runV2DocumentGates(row.document, policy.regional, markets, row.answer_keys).problems.filter((problem) => problem.segmentId === target.id), 'the unmutated board must pass every document gate').toEqual([]);

      mutation.apply(target.payload);

      const withKeys = mine(runSolvabilityGate(row.document, row.answer_keys));
      expect(withKeys.length, 'refused with keys').toBeGreaterThan(0);
      expect(withKeys.every((finding) => finding.type === mutation.type && finding.message.startsWith('solvability/'))).toBe(true);
      expect(mine(runSolvabilityGate(row.document)).length, 'refused without keys').toBeGreaterThan(0);
      expect(blocking(runSolvabilityGate(row.document, row.answer_keys)).filter((finding) => finding.segmentId !== target.id), 'no other segment is touched').toEqual([]);

      const gated = runV2DocumentGates(row.document, policy.regional, markets, row.answer_keys).problems;
      expect(gated.filter((problem) => problem.gate === SOLVABILITY_GATE && problem.segmentId === target.id && problem.message.startsWith('solvability/')).length, 'the document gates carry the refusal').toBeGreaterThan(0);
    });
  }
});
