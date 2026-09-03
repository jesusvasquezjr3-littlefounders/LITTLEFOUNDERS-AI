import { describe, expect, it } from 'vitest';
import {
  INSTRUMENT_SPEAKING_RULE,
  INSTRUMENT_SPEC_MAX_CHARS,
  SPECIFIED_INSTRUMENTS,
  instrumentGuidanceFor,
} from '../tutor/instrumentSpecs.js';

/** One kind's guidance with the shared rule stripped — what the per-instrument budget governs. */
const specOnly = (kind: string) => instrumentGuidanceFor([kind]).replace(INSTRUMENT_SPEAKING_RULE, '').trim();
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
    expect(guidance).not.toContain('THE BAR MODEL');
    expect(specOnly('tokens').length).toBeLessThanOrEqual(INSTRUMENT_SPEC_MAX_CHARS);
  });

  it('appends the speaking rule ONCE, however many instruments a move named', () => {
    // Found live 2026-09-02: `worked` fired correctly and the tutor recited
    // every line the board was already drawing, at 61 words a turn. The rule is
    // shared rather than repeated per spec so it cannot be forgotten by the
    // next instrument — and it must not be paid for twice on a move that names
    // two.
    const one = instrumentGuidanceFor(['tokens']);
    const two = instrumentGuidanceFor(['tokens', 'worked']);
    expect(one).toContain(INSTRUMENT_SPEAKING_RULE);
    expect(two.split(INSTRUMENT_SPEAKING_RULE)).toHaveLength(2);
  });

  it('says nothing at all — rule included — when a move names no instrument', () => {
    expect(instrumentGuidanceFor([])).toBe('');
    expect(instrumentGuidanceFor([])).not.toContain(INSTRUMENT_SPEAKING_RULE);
  });

  it('ignores a kind it has no spec for rather than emitting a placeholder', () => {
    // A spec that does not exist must produce silence, never a line telling the
    // model about an instrument nobody wrote guidance for.
    expect(instrumentGuidanceFor(['sequence'])).toBe('');
    expect(instrumentGuidanceFor(['tokens', 'sequence'])).toBe(instrumentGuidanceFor(['tokens']));
  });

  it('keeps every spec inside the per-instrument budget', () => {
    // The budget governs ONE instrument's guidance. The shared speaking rule is
    // a fixed cost that does not scale with how many a move names, which is the
    // whole reason it is shared rather than repeated inside each spec.
    for (const kind of SPECIFIED_INSTRUMENTS) {
      expect(specOnly(kind).length, kind).toBeLessThanOrEqual(INSTRUMENT_SPEC_MAX_CHARS);
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

  it('every move whose body stages physical money can reach `tokens`', () => {
    // These three moves' own bodies ask for coins that can be picked up,
    // counted twice, or stopped at a target — the reason `tokens` exists.
    //
    // A SUPERSET is deliberately allowed, and the first version of this test
    // pinned the exact list, which was wrong the moment live evidence arrived:
    // two `tutor:converse` runs on 2026-09-02 showed WORKED is the strategy the
    // controller reaches for most, so `worked-example-think-aloud` was widened
    // to reach `tokens` too — a worked example ABOUT COINS could not otherwise
    // put coins on the table. Locking the exact set pinned an implementation
    // detail; what matters is that no coin-staging move is left without it.
    const naming = new Set(skills.filter((s) => s.instruments.includes('tokens')).map((s) => s.name));
    for (const move of ['biggest-coin-first', 'stop-at-the-target', 'value-not-appearance']) {
      expect(naming, `${move} must be able to draw coins`).toContain(move);
    }
  });

  it('most moves name no instrument, so most turns pay nothing for this', () => {
    const withNone = skills.filter((s) => s.instruments.length === 0).length;
    expect(withNone).toBeGreaterThan(skills.length / 2);
  });
});
