import { readFileSync } from 'node:fs';
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

  /*
   * THE GATE THAT DID NOT EXIST, AND THE DRIFT IT WOULD HAVE CAUGHT.
   *
   * `instruments:check` (root) holds a kind's SHAPE to agreement across five
   * copies, and the test above holds a named instrument to having a spec. Both
   * passed green for the entire time the real defect was live, because neither
   * asks the only question that decides whether an instrument ever gets USED:
   * does anything tell the model WHEN to reach for it?
   *
   * Measured 2026-09-04: of the 45 kinds the schema accepts, 39 had no spec
   * here and no move naming them, so the SELECTED-guidance path reached six.
   *
   * A FIRST READING OF THAT NUMBER WAS WRONG AND IS CORRECTED HERE, because
   * the wrong version is the more tempting one. It was reported as "28 of 45
   * have nothing telling the model when to use them", which is false:
   * `prompt.ts` carries a broadcast situation→board map that names 44 of the
   * 45 (the 45th, `marked_line`, was genuinely missing and was added the same
   * day). The audit missed it by grepping for quoted kind names while that map
   * writes them bare. So the real gap was never "no pointer" — it is that a
   * dense one-paragraph map competes with per-move guidance that arrives
   * beside the concrete instruction, and loses.
   *
   * So this asserts the DIRECTION rather than a number: coverage may go up, and
   * may never silently go down. A kind deliberately left unguided is fine — it
   * just has to be listed here, by hand, which is the whole point: adding the
   * 46th kind forces somebody to say which of the two it is.
   */
  it('every specced instrument is actually reachable — a spec no move names is guidance nothing can deliver', () => {
    const named = new Set(skills.flatMap((s) => s.instruments));
    const orphaned = SPECIFIED_INSTRUMENTS.filter((k) => !named.has(k));
    expect(orphaned, 'specs written but wired to no move — they can never travel').toEqual([]);
  });

  it('does not let instrument coverage silently regress', () => {
    /*
     * Kinds with NO guidance today, by deliberate omission rather than
     * oversight — mostly early-years and comparison boards whose moves do not
     * exist yet. Shrinking this list is the work; growing it needs a reason,
     * written here, next to the name.
     */
    const DELIBERATELY_UNGUIDED = [
      'array', 'bead_string', 'before_after', 'cycle', 'equation_bar',
      'inventory', 'ledger', 'partition', 'pictograph',
      'price_tag', 'stack', 'tally', 'timeline', 'venn',
    ] as const;

    const named = new Set(skills.flatMap((s) => s.instruments));
    // A kind is REACHED if a move names it (which is what makes its spec
    // travel). Prose in prompt.ts is the other route and is not measured here —
    // this test governs the selected-guidance path it can actually see.
    for (const kind of DELIBERATELY_UNGUIDED) {
      expect(named.has(kind), `${kind} is now wired to a move — remove it from DELIBERATELY_UNGUIDED`).toBe(false);
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

  /*
   * A MISCONCEPTION CODE IS A DOOR KEY, AND A TYPO SILENTLY THROWS IT AWAY.
   *
   * `selectSkill` fences every misconception-tagged move OUT of the generic
   * path: such a move is reachable ONLY when the controller holds that exact
   * code, which only a graded activity or a Core voice-check can set. So a
   * code misspelled in frontmatter does not fail anything — boot validation
   * checks strategies, tiers, instruments and mastery bands, but never the
   * codes — it just makes that move permanently unreachable, quietly, while
   * every gate stays green.
   *
   * Zero instances today (31 codes, 31 used, no orphans, verified 2026-09-04).
   * This exists so the first one fails a deploy instead of a child's lesson.
   */
  it('every misconception a move claims to repair is a real code in the KC graph', () => {
    const seed = JSON.parse(
      readFileSync(new URL('../../../database/seeds/kc_graph.v1.json', import.meta.url), 'utf8'),
    ) as unknown;
    const canonical = new Set<string>();
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === 'object') {
        const rec = node as Record<string, unknown>;
        if (typeof rec.code === 'string') canonical.add(rec.code);
        Object.values(rec).forEach(walk);
      }
    };
    walk(seed);
    expect(canonical.size, 'the KC graph seed carries no misconception codes at all').toBeGreaterThan(0);

    for (const skill of skills) {
      for (const code of skill.misconceptions) {
        expect(canonical, `${skill.name} repairs "${code}", which no KC declares`).toContain(code);
      }
    }
  });

  it('most moves name no instrument, so most turns pay nothing for this', () => {
    const withNone = skills.filter((s) => s.instruments.length === 0).length;
    expect(withNone).toBeGreaterThan(skills.length / 2);
  });
});
