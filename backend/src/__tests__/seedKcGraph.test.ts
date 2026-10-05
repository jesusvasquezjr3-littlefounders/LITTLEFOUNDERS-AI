import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ActivationSchema, KC_STRANDS, SeedSchema, assertAcyclic, assertDraftsDoNotGateActive, assertTierOrder } from '../scripts/seed-kc-graph.js';

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
  const activationPath = path.resolve(here, '../../../database/seeds/kc_activation.od22.json');
  const hierarchyPath = path.resolve(here, '../../../coursegen/curriculum-v2/financial-education/hierarchy/hierarchy.rows.json');
  const seed = SeedSchema.parse(JSON.parse(readFileSync(seedPath, 'utf8')));
  const activation = ActivationSchema.parse(JSON.parse(readFileSync(activationPath, 'utf8')));
  const hierarchy = JSON.parse(readFileSync(hierarchyPath, 'utf8')) as {
    tables: { topics: Array<{ id: string; slug: string }>; topic_knowledge_components: Array<{ topic_id: string; kc_key: string; role: string }> };
  };
  const keys = new Set(seed.kcs.map((k) => k.key));

  it('is acyclic', () => {
    expect(() => assertAcyclic(keys, seed.edges)).not.toThrow();
  });

  it('has no prerequisite that requires a HIGHER tier than the KC it unlocks', () => {
    expect(() => assertTierOrder(seed.kcs, seed.edges)).not.toThrow();
  });

  it('never lets a draft (S05.3a) KC gate an active one, so activation cannot re-gate learners', () => {
    expect(() => assertDraftsDoNotGateActive(seed.kcs, seed.edges)).not.toThrow();
  });

  it('uses only the four declared strands, and the original 28 KCs keep their 0052 strands', () => {
    for (const kc of seed.kcs) expect(KC_STRANDS).toContain(kc.strand);
    for (const kc of seed.kcs.slice(0, 28)) expect(['money_math', 'entrepreneurship']).toContain(kc.strand);
  });

  it('approves only the 25 Financial Education KCs with a real teaching bridge', () => {
    expect(seed.kcs).toHaveLength(100);
    expect(seed.kcs.filter((kc) => kc.status === 'active')).toHaveLength(53);
    expect(seed.kcs.filter((kc) => kc.status === 'draft')).toHaveLength(47);
    expect(activation.required_courses).toEqual(['financial-education']);
    expect(activation.activations).toHaveLength(25);
    expect(new Set(activation.activations.map((item) => item.key)).size).toBe(25);
    const approved = new Set(activation.activations.map((item) => item.key));
    for (const item of activation.activations) {
      expect(item.skill_key.startsWith('financial-education/'), item.key).toBe(true);
      expect(seed.kcs.find((kc) => kc.key === item.key)?.status, item.key).toBe('active');
    }
    for (const kc of seed.kcs.slice(28)) expect(kc.status === 'active', kc.key).toBe(approved.has(kc.key));
  });

  it('maps every approved KC to a real Financial Education topic that teaches it', () => {
    const topicBySlug = new Map(hierarchy.tables.topics.map((topic) => [topic.slug, topic.id]));
    const teachingLinks = new Set(hierarchy.tables.topic_knowledge_components
      .filter((link) => link.role === 'teaches')
      .map((link) => `${link.topic_id}:${link.kc_key}`));
    for (const item of activation.activations) {
      const [, topicSlug] = item.skill_key.split('/');
      const topicId = topicBySlug.get(topicSlug!);
      expect(topicId, item.skill_key).toBeDefined();
      expect(teachingLinks.has(`${topicId}:${item.key}`), `${item.key} -> ${item.skill_key}`).toBe(true);
    }
  });

  it('maps every legacy active bridge to a canonical Financial Education V2 topic', () => {
    const topicBySlug = new Map(hierarchy.tables.topics.map((topic) => [topic.slug, topic.id]));
    const teachingLinks = new Set(hierarchy.tables.topic_knowledge_components
      .filter((link) => link.role === 'teaches')
      .map((link) => `${link.topic_id}:${link.kc_key}`));
    const legacyBridges = seed.kcs.slice(0, 28).filter((kc) => kc.skill_key !== null);
    expect(legacyBridges).toHaveLength(19);
    for (const kc of legacyBridges) {
      expect(kc.skill_key?.startsWith('financial-education/fe-'), kc.key).toBe(true);
      const [, topicSlug] = kc.skill_key!.split('/');
      const topicId = topicBySlug.get(topicSlug!);
      expect(topicId, `${kc.key} -> ${kc.skill_key}`).toBeDefined();
      expect(teachingLinks.has(`${topicId}:${kc.key}`), `${kc.key} -> ${kc.skill_key}`).toBe(true);
    }
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

describe('assertDraftsDoNotGateActive', () => {
  it('refuses a draft prerequisite of an active KC', () => {
    const kcs = [
      { key: 'new', status: 'draft' as const },
      { key: 'old', status: 'active' as const },
    ];
    expect(() => assertDraftsDoNotGateActive(kcs, [['new', 'old']])).toThrow(/would gate active KC/);
  });

  it('allows active→draft and draft→draft edges', () => {
    const kcs = [
      { key: 'a', status: 'active' as const },
      { key: 'b', status: 'draft' as const },
      { key: 'c', status: 'draft' as const },
    ];
    expect(() => assertDraftsDoNotGateActive(kcs, [['a', 'b'], ['b', 'c']])).not.toThrow();
  });

  it('defaults a KC without a status to active, as every 0052 row was', () => {
    const parsed = SeedSchema.parse({ version: 1, kcs: [{ key: 'abc', strand: 'money_math', tier_min: 1, p_l0: 0.2, p_t: 0.1, p_g: 0.2, p_s: 0.1, title: { 'en-US': 'x', 'es-MX': 'x', 'pt-BR': 'x' }, objective: { 'en-US': 'x', 'es-MX': 'x', 'pt-BR': 'x' } }], edges: [], misconceptions: [] });
    expect(parsed.kcs[0]!.status).toBe('active');
  });
});
