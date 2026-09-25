// Gates 18 and 19 (S05.3f): shame, family-finance and manipulation language
// (Appendix C Part 3 Stage 2 gate 4; B.26, B.27, B.25) and the age register
// (B.23). Red-team samples built to fail each rule, per Appendix C's
// Definition of Done ("demonstrably blocks a deliberately non-compliant test
// lesson"), and the compliant fixture that must pass.

import { describe, expect, it } from 'vitest';
import { NON_VISIBLE_KEYS, runAllGates } from '../pipeline/gates.js';
import { registersForTier, runAgeRegisterGate, runWellbeingLanguageGate } from '../pipeline/wellbeingGates.js';
import { buildDocument, buildFacts, buildTaxonomy } from './fixtures.js';

type Raw = Record<string, unknown> & { segments: Array<Record<string, unknown> & { payload: Record<string, unknown> }>; scoring: Record<string, unknown> };
const raw = (): Raw => JSON.parse(JSON.stringify(buildDocument())) as Raw;
const teenTaxonomy = () => buildTaxonomy({
  age_tiers: { tier4: { ages: '12-18', forbidden_vocabulary: { 'es-MX': [], 'en-US': [], 'pt-BR': [] } } },
  family_allowlist_by_tier: { tier4: ['story', 'choice', 'input', 'arrange', 'money', 'analyze', 'storyplay', 'maker'] },
} as never);
const ctx = (tier = 'tier1', taxonomy = buildTaxonomy()) => ({ taxonomy, tier, facts: buildFacts() });
const wrongOption = (doc: Raw) => (doc.segments[1]!.payload.options as Array<Record<string, unknown>>)[1]!;

describe('gate 18: no shame, no moralized family money, no manipulation', () => {
  it('passes the compliant fixture with nothing to review', () => {
    expect(runWellbeingLanguageGate(raw(), NON_VISIBLE_KEYS)).toEqual({ blocking: [], review: [] });
    expect(runAllGates(buildDocument(), ctx()).ok).toBe(true);
  });

  it('blocks self-global and trait language in an error state, in three languages', () => {
    for (const text of ['Wrong again. You are not good at math.', 'No eres bueno para el dinero.', 'Você não é bom com números.', "You're so smart!"]) {
      const doc = raw();
      wrongOption(doc).rationale_md = text;
      const report = runWellbeingLanguageGate(doc, NON_VISIBLE_KEYS);
      expect(report.blocking.length, text).toBeGreaterThan(0);
      expect(report.blocking[0]!.path).toBe('segments[1].payload.options[1].rationale_md');
      expect(report.blocking[0]!.segmentId).toBe('s2');
      const gated = runAllGates(doc, ctx());
      expect(gated.ok).toBe(false);
      expect(gated.problems.some((p) => p.gate === 18)).toBe(true);
    }
  });

  it('blocks moralizing a family\'s real money anywhere, story included (B.27)', () => {
    for (const text of ['Poor families are lazy with money.', 'Tus papás malgastan todo.', 'Pessoas pobres são preguiçosas.']) {
      const doc = raw();
      doc.segments[0]!.payload.body_md = text;
      expect(runWellbeingLanguageGate(doc, NON_VISIBLE_KEYS).blocking.map((f) => f.message).join(' '), text).toMatch(/B\.27/);
    }
    // Teaching about money circumstances is not moralizing.
    const doc = raw();
    doc.segments[0]!.payload.body_md = 'Some families save in coins and some in a bank. Both can plan.';
    expect(runWellbeingLanguageGate(doc, NON_VISIBLE_KEYS).blocking).toEqual([]);
  });

  it('blocks a lives field and lives copy (OD-1), and a purchase lure (OD-5)', () => {
    const lives = raw();
    lives.scoring.hearts = 3;
    expect(runWellbeingLanguageGate(lives, NON_VISIBLE_KEYS).blocking).toEqual([expect.objectContaining({ path: 'scoring.hearts' })]);
    expect(runAllGates(lives, ctx()).problems.some((p) => p.gate === 18)).toBe(true);
    const copy = raw();
    copy.segments[0]!.prompt_md = 'Te quedan 2 vidas.';
    expect(runWellbeingLanguageGate(copy, NON_VISIBLE_KEYS).blocking[0]!.message).toMatch(/loss-mechanic/);
    const lure = raw();
    lure.segments[0]!.prompt_md = 'Upgrade to premium to unlock this.';
    expect(runWellbeingLanguageGate(lure, NON_VISIBLE_KEYS).blocking[0]!.message).toMatch(/purchase-lure/);
  });

  it('flags time pressure, parasocial pressure and timed drills for the reviewer, without blocking', () => {
    const doc = raw();
    doc.segments[0]!.prompt_md = 'Hurry, the sale ends today!';
    doc.segments[0]!.payload.body_md = 'Dina is sad when you leave.';
    doc.segments[1]!.payload.seconds = 20;
    const report = runWellbeingLanguageGate(doc, NON_VISIBLE_KEYS);
    expect(report.blocking).toEqual([]);
    expect(report.review.map((f) => f.path)).toEqual(expect.arrayContaining(['segments[0].prompt_md', 'segments[0].payload.body_md', 'segments[1].payload.seconds']));
    expect(runAllGates(doc, ctx()).review?.some((p) => p.gate === 18)).toBe(true);
  });

  it('names the shame even when the contract gate also refuses the document', () => {
    const doc = raw();
    wrongOption(doc).rationale_md = 'Fallaste otra vez.';
    delete (doc as Record<string, unknown>).meta;
    const gated = runAllGates(doc, ctx());
    expect(gated.ok).toBe(false);
    expect(gated.problems[0]!.gate).toBe(18);
  });
});

describe('gate 19: the age register', () => {
  it('maps a tier to the registers it spans; unknown ages are every register', () => {
    expect(registersForTier('6-7')).toEqual(['young']);
    expect(registersForTier('8-10')).toEqual(['young', 'transition']);
    expect(registersForTier('12-18')).toEqual(['transition', 'teen', 'adult']);
    expect(registersForTier(undefined)).toEqual(['young', 'transition', 'teen', 'adult']);
  });

  it('blocks childish framing in a lesson a teen will read, and allows it for young children', () => {
    for (const text of ['Great work, kiddo.', '¡Muy bien, campeoncito!', 'Criancinhas, vamos lá.']) {
      const doc = raw();
      doc.segments[0]!.prompt_md = text;
      const teen = runAgeRegisterGate(doc, NON_VISIBLE_KEYS, '12-18');
      expect(teen.blocking.length, text).toBeGreaterThan(0);
      expect(teen.blocking[0]!.message).toMatch(/B\.23/);
      expect(runAgeRegisterGate(doc, NON_VISIBLE_KEYS, '6-7').blocking).toEqual([]);
    }
    const doc = raw();
    doc.segments[0]!.prompt_md = 'Great work, kiddo.';
    const gated = runAllGates(doc, ctx('tier4', teenTaxonomy()));
    expect(gated.problems.some((p) => p.gate === 19)).toBe(true);
  });

  it('blocks praise with nothing named from age 10, and keeps it for 6 to 9', () => {
    const doc = raw();
    wrongOption(doc).rationale_md = 'Great job!';
    expect(runAgeRegisterGate(doc, NON_VISIBLE_KEYS, '8-10').blocking).toEqual([expect.objectContaining({ path: 'segments[1].payload.options[1].rationale_md' })]);
    expect(runAgeRegisterGate(doc, NON_VISIBLE_KEYS, '6-7').blocking).toEqual([]);
    wrongOption(doc).rationale_md = 'Great job: you added the 2 first.';
    expect(runAgeRegisterGate(doc, NON_VISIBLE_KEYS, '12-18').blocking).toEqual([]);
  });

  it('flags exclamations beyond the strictest register for review', () => {
    const doc = raw();
    doc.segments[0]!.prompt_md = 'Welcome to the island!';
    expect(runAgeRegisterGate(doc, NON_VISIBLE_KEYS, '12-18').review).toEqual([expect.objectContaining({ path: 'segments[0].prompt_md' })]);
    expect(runAgeRegisterGate(doc, NON_VISIBLE_KEYS, '6-7').review).toEqual([]);
  });
});
