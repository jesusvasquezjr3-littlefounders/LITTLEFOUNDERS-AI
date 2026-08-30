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

/** No skill spent yet — the common case for most of these tests. */
const NONE = new Set<string>();

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
        const skill = selectSkill({ strategy, tier, pKnown: null, misconceptionCode: null, usedSkillNames: NONE });
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
      usedSkillNames: NONE,
    });
    expect(skill?.name).toBe('counterexample-confront');
  });

  /*
   * Found by adversarial review, round 22 (2026-08-30, HIGH): the controller
   * sets `misconceptionCode` on every misconception-tagged failure and only
   * clears it on leaving REMEDIATE, so a SECOND consecutive failure that
   * happens to carry a misconception code produces `strategy: 'RESCUE'`
   * (frustration first) together with a still-set `misconceptionCode` — a
   * real, reachable combination (`controller.test.ts` covers the sequencing;
   * this file only needs to prove the SELECTOR'S half of the bug). Before the
   * fix, the dedicated-misconception path ignored `query.strategy` entirely
   * and handed back `counterexample-confront` anyway — a skill declared
   * `strategies: [REMEDIATE]` whose own procedure says "Never use this on a
   * careless slip" and asks a child to defend and test their reasoning,
   * delivered instead of the emotional de-escalation RESCUE exists for.
   */
  it('does NOT hand a REMEDIATE-only dedicated remediation to a RESCUE turn', () => {
    const skill = selectSkill({
      strategy: 'RESCUE',
      tier: 2,
      pKnown: 0.5,
      misconceptionCode: 'adds-instead-of-counts-up',
      usedSkillNames: NONE,
    });
    // Falls through to the ordinary RESCUE skill instead — the misconception
    // diagnosis does not override the strategy the controller decided on.
    expect(skill?.name).toBe('frustration-rescue');
    expect(skill?.strategies).toContain('RESCUE');
  });

  it('an uncatalogued misconception falls back to the general remediation', () => {
    const skill = selectSkill({
      strategy: 'REMEDIATE',
      tier: 2,
      pKnown: 0.5,
      misconceptionCode: 'some-code-no-skill-claims',
      usedSkillNames: NONE,
    });
    expect(skill?.name).toBe('error-as-data');
  });

  it('the mastery band picks the right variant of a shared strategy', () => {
    // SOCRATIC has two skills: the one-question default and the
    // productive-struggle hold, gated to high mastery and tiers 2-3.
    const low = selectSkill({
      strategy: 'SOCRATIC',
      tier: 2,
      pKnown: 0.6,
      misconceptionCode: null,
      usedSkillNames: NONE,
    });
    expect(low?.name).toBe('socratic-one-question');
    // At 0.8 both bands match; the default wins on priority — holding back is
    // a deliberate downgrade the controller signals, not the default posture.
    const high = selectSkill({
      strategy: 'SOCRATIC',
      tier: 2,
      pKnown: 0.8,
      misconceptionCode: null,
      usedSkillNames: NONE,
    });
    expect(high?.name).toBe('socratic-one-question');
  });

  it('a tier-gated skill never reaches the tier it excludes', () => {
    // productive-struggle-hold excludes tier 1: a six-year-old left to
    // struggle reads it as abandonment.
    const all = skillCatalogue();
    const hold = all.find((s) => s.name === 'productive-struggle-hold');
    expect(hold?.tiers).toEqual([2, 3]);
    const t1 = selectSkill({
      strategy: 'SOCRATIC',
      tier: 1,
      pKnown: 0.8,
      misconceptionCode: null,
      usedSkillNames: NONE,
    });
    expect(t1?.name).not.toBe('productive-struggle-hold');
  });

  it('an unknown mastery never hides the only skill a strategy has', () => {
    const skill = selectSkill({
      strategy: 'RESCUE',
      tier: 1,
      pKnown: null,
      misconceptionCode: null,
      usedSkillNames: NONE,
    });
    expect(skill?.name).toBe('frustration-rescue');
  });

  it('a band with no candidates falls back to the strategy rather than to nothing', () => {
    // DIRECT skills top out at 0.4; a DIRECT decision at 0.9 (possible via
    // probe routing) must still get a procedure.
    const skill = selectSkill({
      strategy: 'DIRECT',
      tier: 2,
      pKnown: 0.9,
      misconceptionCode: null,
      usedSkillNames: NONE,
    });
    expect(skill).not.toBeNull();
  });
});

describe('a skill whose own procedure says "once, ever"', () => {
  it('is reachable the first time a session hits its misconception', () => {
    const skill = selectSkill({
      strategy: 'REMEDIATE',
      tier: 2,
      pKnown: 0.5,
      misconceptionCode: 'adds-instead-of-counts-up',
      usedSkillNames: NONE,
    });
    expect(skill?.name).toBe('counterexample-confront');
  });

  it('is fenced out the second time, in favour of the general remediation', () => {
    // Found live: `tutor:converse` served the SAME learner the SAME
    // confrontation four times in one session because selection was a pure
    // function of strategy/tier/misconception, with no memory of what it had
    // already returned. `error-as-data` is what a real learner should see on
    // repeat, per counterexample-confront's own step 5 ("degrade to
    // showing").
    const skill = selectSkill({
      strategy: 'REMEDIATE',
      tier: 2,
      pKnown: 0.5,
      misconceptionCode: 'adds-instead-of-counts-up',
      usedSkillNames: new Set(['counterexample-confront']),
    });
    expect(skill?.name).toBe('error-as-data');
  });

  it('does not fence out a DIFFERENT skill with the same misconception fallback path', () => {
    // Spending counterexample-confront must not blind selection to skills
    // that were never flagged onceOnly.
    const skill = selectSkill({
      strategy: 'REMEDIATE',
      tier: 2,
      pKnown: 0.5,
      misconceptionCode: 'some-code-no-skill-claims',
      usedSkillNames: new Set(['counterexample-confront']),
    });
    expect(skill?.name).toBe('error-as-data');
  });
});
