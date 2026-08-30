import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SeedSchema, assertAcyclic, assertTierOrder } from '../scripts/seed-kc-graph.js';

/*
 * Found by adversarial review, round 52 (2026-08-30, HIGH): the real seed
 * file (database/seeds/kc_graph.v1.json) had one edge —
 * money.savings-plan-math (tier 2) as a prerequisite for biz.saving-goal
 * (tier 1) — that survived the seed script's own `assertAcyclic` (it is not
 * a cycle) and every other gate, because nothing checked tier ordering at
 * all. `sessionPlan.ts` filters KCs to `tier_min <= tier` BEFORE walking the
 * graph, so a tier-1 learner never sees the prerequisite (the edge silently
 * does nothing) while a tier-2/3 learner gets a simpler concept gated behind
 * a harder, later one. This file has no prior coverage at all — the seed
 * script is an operator tool (needs credentials), never previously imported
 * from a test.
 */

describe('the real seed file has no tier inversion and no cycle', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const seedPath = path.resolve(here, '../../../database/seeds/kc_graph.v1.json');
  const seed = SeedSchema.parse(JSON.parse(readFileSync(seedPath, 'utf8')));
  const keys = new Set(seed.kcs.map((k) => k.key));

  it('is acyclic', () => {
    expect(() => assertAcyclic(keys, seed.edges)).not.toThrow();
  });

  it('has no prerequisite that requires a HIGHER tier than the KC it unlocks', () => {
    expect(() => assertTierOrder(seed.kcs, seed.edges)).not.toThrow();
  });

  it('every edge references a real KC in both directions', () => {
    for (const [from, to] of seed.edges) {
      expect(keys.has(from)).toBe(true);
      expect(keys.has(to)).toBe(true);
    }
  });
});

describe('assertTierOrder', () => {
  it('refuses a prerequisite that requires a higher tier than its dependent', () => {
    const kcs = [
      { key: 'a', tier_min: 2 },
      { key: 'b', tier_min: 1 },
    ];
    expect(() => assertTierOrder(kcs, [['a', 'b']])).toThrow(/tier inversion/);
  });

  it('allows a prerequisite at the SAME tier as its dependent', () => {
    const kcs = [
      { key: 'a', tier_min: 1 },
      { key: 'b', tier_min: 1 },
    ];
    expect(() => assertTierOrder(kcs, [['a', 'b']])).not.toThrow();
  });

  it('allows a prerequisite at a LOWER tier than its dependent', () => {
    const kcs = [
      { key: 'a', tier_min: 1 },
      { key: 'b', tier_min: 2 },
    ];
    expect(() => assertTierOrder(kcs, [['a', 'b']])).not.toThrow();
  });
});
