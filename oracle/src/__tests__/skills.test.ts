import { describe, expect, it } from 'vitest';
import { selectSkill, skillCatalogue, SKILL_BODY_MAX_CHARS } from '../tutor/skills.js';
import type { Strategy } from '../context/schema.js';

/*
 * THE TUTOR'S PROCEDURAL MEMORY (V4).
 *
 * These tests gate the real catalogue on disk, deliberately: a malformed or
 * missing skill file must fail CI, not a child's turn. The catalogue is code.
 */

const STRATEGIES: Strategy[] = [
  'DIRECT',
  'WORKED',
  'FADED',
  'SOCRATIC',
  'FLUENCY',
  'SPACED',
  'PROBE',
  'REMEDIATE',
  'RESCUE',
  'ELABORATE',
  'TRANSFER',
  'CELEBRATE',
];

describe('the catalogue on disk', () => {
  it('loads, and every skill respects the body budget', () => {
    const all = skillCatalogue();
    expect(all.length).toBeGreaterThanOrEqual(12);
    for (const s of all) {
      expect(s.body.length).toBeLessThanOrEqual(SKILL_BODY_MAX_CHARS);
      expect(s.body.length).toBeGreaterThan(100);
    }
  });

  it('covers EVERY strategy at every tier — no turn may go without a procedure', () => {
    // The fallback to the one-line instruction exists for resilience, not as
    // a licence to leave holes. A strategy with no skill is the pre-V4 tutor.
    for (const strategy of STRATEGIES) {
      for (const tier of [1, 2, 3]) {
        const skill = selectSkill({ strategy, tier, pKnown: null, misconceptionCode: null });
        expect(skill, `${strategy} tier ${tier}`).not.toBeNull();
      }
    }
  });
});

describe('deterministic selection', () => {
  it('a catalogued misconception forces its dedicated remediation', () => {
    const skill = selectSkill({
      strategy: 'REMEDIATE',
      tier: 2,
      pKnown: 0.5,
      misconceptionCode: 'adds-instead-of-counts-up',
    });
    expect(skill?.name).toBe('counterexample-confront');
  });

  it('an uncatalogued misconception falls back to the general remediation', () => {
    const skill = selectSkill({
      strategy: 'REMEDIATE',
      tier: 2,
      pKnown: 0.5,
      misconceptionCode: 'some-code-no-skill-claims',
    });
    expect(skill?.name).toBe('error-as-data');
  });

  it('the mastery band picks the right variant of a shared strategy', () => {
    // SOCRATIC has two skills: the one-question default and the
    // productive-struggle hold, gated to high mastery and tiers 2-3.
    const low = selectSkill({ strategy: 'SOCRATIC', tier: 2, pKnown: 0.6, misconceptionCode: null });
    expect(low?.name).toBe('socratic-one-question');
    // At 0.8 both bands match; the default wins on priority — holding back is
    // a deliberate downgrade the controller signals, not the default posture.
    const high = selectSkill({ strategy: 'SOCRATIC', tier: 2, pKnown: 0.8, misconceptionCode: null });
    expect(high?.name).toBe('socratic-one-question');
  });

  it('a tier-gated skill never reaches the tier it excludes', () => {
    // productive-struggle-hold excludes tier 1: a six-year-old left to
    // struggle reads it as abandonment.
    const all = skillCatalogue();
    const hold = all.find((s) => s.name === 'productive-struggle-hold');
    expect(hold?.tiers).toEqual([2, 3]);
    const t1 = selectSkill({ strategy: 'SOCRATIC', tier: 1, pKnown: 0.8, misconceptionCode: null });
    expect(t1?.name).not.toBe('productive-struggle-hold');
  });

  it('an unknown mastery never hides the only skill a strategy has', () => {
    const skill = selectSkill({ strategy: 'RESCUE', tier: 1, pKnown: null, misconceptionCode: null });
    expect(skill?.name).toBe('frustration-rescue');
  });

  it('a band with no candidates falls back to the strategy rather than to nothing', () => {
    // DIRECT skills top out at 0.4; a DIRECT decision at 0.9 (possible via
    // probe routing) must still get a procedure.
    const skill = selectSkill({ strategy: 'DIRECT', tier: 2, pKnown: 0.9, misconceptionCode: null });
    expect(skill).not.toBeNull();
  });
});
