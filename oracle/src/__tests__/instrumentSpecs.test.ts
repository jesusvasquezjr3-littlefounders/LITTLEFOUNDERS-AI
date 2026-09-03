import { describe, expect, it } from 'vitest';
import {
  INSTRUMENT_SPEC_MAX_CHARS,
  SPECIFIED_INSTRUMENTS,
  instrumentGuidanceFor,
} from '../tutor/instrumentSpecs.js';
import { skillCatalogue } from '../tutor/skills.js';

/*
 * GUIDANCE IS SELECTED, NOT BROADCAST (/TUTOR_INSTRUMENTS.md §4.4).
 *
 * The system prompt must list every board SHAPE — a model cannot emit valid
 * JSON for a kind it has never seen — and that list is prefix-cached, so one
 * compact line per kind is affordable. The per-instrument GUIDANCE is not: it is
 * forty lines each, it lands in a context where the actual teaching instruction
 * has to compete with it, and a model choosing among forty options chooses worse
 * than one choosing among the two its situation calls for.
 */

describe('instrument guidance travels only when a move asks for it', () => {
  it('returns nothing for a move that names no instrument — which is most of them', () => {
    expect(instrumentGuidanceFor([])).toBe('');
  });

  it('returns only what was named, never the whole catalogue', () => {
    const guidance = instrumentGuidanceFor(['tokens']);
    expect(guidance).toContain('COINS ON THE TABLE');
    expect(guidance.length).toBeGreaterThan(0);
    expect(guidance.length).toBeLessThanOrEqual(INSTRUMENT_SPEC_MAX_CHARS);
  });

  it('ignores a kind it has no spec for rather than emitting a placeholder', () => {
    // A spec that does not exist must produce silence, never a line telling the
    // model about an instrument nobody wrote guidance for.
    expect(instrumentGuidanceFor(['sequence'])).toBe('');
    expect(instrumentGuidanceFor(['tokens', 'sequence'])).toBe(instrumentGuidanceFor(['tokens']));
  });

  it('keeps every spec inside the budget a skill body already respects', () => {
    for (const kind of SPECIFIED_INSTRUMENTS) {
      expect(instrumentGuidanceFor([kind]).length).toBeLessThanOrEqual(INSTRUMENT_SPEC_MAX_CHARS);
    }
  });
});

describe('the move catalogue and the spec registry agree', () => {
  const skills = skillCatalogue();

  it('every instrument a move names has a spec — a typo must fail the deploy, not a turn', () => {
    for (const skill of skills) {
      for (const kind of skill.instruments) {
        expect(SPECIFIED_INSTRUMENTS, `${skill.name} names ${kind}`).toContain(kind);
      }
    }
  });

  it('the moves that stage physical money are the ones that name `tokens`', () => {
    // Not a style assertion: these three are the moves whose own bodies ask for
    // coins that can be picked up, counted twice, or stopped at a target — the
    // reason `tokens` exists at all.
    const naming = skills.filter((s) => s.instruments.includes('tokens')).map((s) => s.name).sort();
    expect(naming).toEqual(['biggest-coin-first', 'stop-at-the-target', 'value-not-appearance']);
  });

  it('most moves name no instrument, so most turns pay nothing for this', () => {
    const withNone = skills.filter((s) => s.instruments.length === 0).length;
    expect(withNone).toBeGreaterThan(skills.length / 2);
  });
});
