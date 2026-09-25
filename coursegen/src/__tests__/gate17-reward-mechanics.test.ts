// Gate 17 — the reward-mechanic structural gate (Appendix C Part 3, Stage 2,
// gate 7; Product 10 B.22; S05.3e). Red-team samples built to fail it, per
// Appendix C's Definition of Done ("demonstrably blocks a deliberately
// non-compliant test lesson"), and the compliant fixture that must pass.

import { describe, expect, it } from 'vitest';
import { runAllGates } from '../pipeline/gates.js';
import { runRewardMechanicGate } from '../pipeline/rewardMechanicGate.js';
import { buildDocument, buildFacts, buildTaxonomy } from './fixtures.js';

const ctx = () => ({ taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() });
const raw = () => JSON.parse(JSON.stringify(buildDocument())) as Record<string, unknown> & { segments: Array<Record<string, unknown>>; scoring: Record<string, unknown> };

describe('gate 17: rewards are fixed and tied to an understood action', () => {
  it('passes the compliant fixture with nothing to review', () => {
    expect(runRewardMechanicGate(raw())).toEqual({ blocking: [], review: [] });
    const report = runAllGates(buildDocument(), ctx());
    expect(report.ok).toBe(true);
    expect(report.review).toBeUndefined();
  });

  it('blocks an XP range, a list of outcomes and a formula string on a segment', () => {
    for (const xp of [[5, 10, 20], { min: 5, max: 20 }, '5-20', 'rand(5,20)']) {
      const doc = raw();
      doc.segments[1]!.xp = xp;
      const report = runRewardMechanicGate(doc);
      expect(report.blocking.length, JSON.stringify(xp)).toBeGreaterThan(0);
      expect(report.blocking[0]!.path).toMatch(/^segments\[1\]\.xp/);
      const gated = runAllGates(doc, ctx());
      expect(gated.ok).toBe(false);
      expect(gated.problems.some((p) => p.gate === 17)).toBe(true);
    }
  });

  it('blocks chance-named fields in scoring, on a segment, or in a payload reward', () => {
    const cases: Array<(doc: ReturnType<typeof raw>) => void> = [
      (doc) => { doc.scoring.bonus_chance = 0.25; },
      (doc) => { doc.scoring.mystery_reward = true; },
      (doc) => { doc.segments[0]!.random_bonus_xp = 10; },
      (doc) => { doc.segments[0]!.reward = { coins: 5, drop_rate: 0.1 }; },
      (doc) => { (doc.segments[0]!.payload as Record<string, unknown>).prize = [5, 50, 500]; },
      (doc) => { doc.reward_table = { common: 5, legendary: 500, odds: [0.9, 0.1] }; },
    ];
    for (const mutate of cases) {
      const doc = raw();
      mutate(doc);
      const report = runRewardMechanicGate(doc);
      expect(report.blocking.length, mutate.toString()).toBeGreaterThan(0);
      expect(report.blocking.every((f) => /B\.22/.test(f.message))).toBe(true);
    }
  });

  it('flags mystery-reward language for the Stage 3 reviewer, in three languages, without blocking', () => {
    for (const text of ['Open your mystery box to see your prize!', 'Gira la ruleta de premios.', 'Abra a caixa misteriosa!']) {
      const doc = raw();
      doc.segments[0]!.prompt_md = text;
      const report = runRewardMechanicGate(doc);
      expect(report.blocking).toEqual([]);
      expect(report.review).toEqual([expect.objectContaining({ path: 'segments[0].prompt_md' })]);
    }
    const doc = raw();
    doc.segments[0]!.prompt_md = 'A loot box drops a rare item 1 time in 100. What do 20 openings cost on average?';
    const gated = runAllGates(doc, ctx());
    expect(gated.review?.[0]?.gate).toBe(17);
  });

  it('names the randomized reward even when the contract gate also refuses the document', () => {
    const doc = raw();
    doc.segments[1]!.xp = [1, 100];
    delete (doc as Record<string, unknown>).meta;
    const gated = runAllGates(doc, ctx());
    expect(gated.ok).toBe(false);
    expect(gated.problems[0]!.gate).toBe(17);
  });
});
