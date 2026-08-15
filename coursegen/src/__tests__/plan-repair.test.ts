import { describe, expect, it } from 'vitest';
import { describeMixRuleViolations, MAX_SEGMENTS, planRepair, planSkeletonSchema, type PlanSkeleton } from '../pipeline/plan.js';
import { resolveAllowedTypes } from '../pipeline/prompts/palette.js';
import { buildTaxonomy } from './fixtures.js';

const { allowed } = resolveAllowedTypes(buildTaxonomy(), 'tier1');

function skeleton(types: string[]): PlanSkeleton {
  return { segments: types.map((type, i) => ({ type, brief: `segment ${i}` })) };
}

describe('planRepair', () => {
  it('caps a model-authored lesson to the compact ten-segment learning rhythm', () => {
    expect(MAX_SEGMENTS).toBe(10);
    expect(planSkeletonSchema.safeParse(skeleton(Array.from({ length: 11 }, () => 'quiz_mcq'))).success).toBe(false);
  });
  it('is deterministic: same input always produces the same output', () => {
    const input = skeleton(['quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq']);
    const a = planRepair(input, allowed, false);
    const b = planRepair(input, allowed, false);
    expect(a).toEqual(b);
  });

  it('moves or inserts a story-family segment to the front', () => {
    const input = skeleton(['quiz_mcq', 'story_scene', 'true_false', 'match_pairs', 'sort_buckets', 'needs_wants', 'coin_count', 'type_answer']);
    const { skeleton: repaired } = planRepair(input, allowed, false);
    expect(repaired.segments[0]!.type).toBe('story_scene');
  });

  it('inserts a synthetic story opener when no story segment exists at all', () => {
    const input = skeleton(['quiz_mcq', 'true_false', 'match_pairs', 'sort_buckets', 'needs_wants', 'coin_count', 'type_answer', 'number_input']);
    const { skeleton: repaired, fixes } = planRepair(input, allowed, false);
    expect(['story_scene', 'story_dialogue', 'key_ideas', 'concept_reveal', 'checkpoint']).toContain(repaired.segments[0]!.type);
    expect(fixes.some((f) => f.includes('inserted missing story opener'))).toBe(true);
  });

  it('replaces disallowed types with an allowed fallback', () => {
    const input = skeleton(['story_scene', 'debug_hunt', 'true_false', 'match_pairs', 'sort_buckets', 'needs_wants', 'coin_count', 'type_answer']);
    const { skeleton: repaired } = planRepair(input, allowed, false);
    // debug_hunt is a maker type not allowed in tier1 — must be replaced.
    expect(repaired.segments.map((s) => s.type)).not.toContain('debug_hunt');
    for (const seg of repaired.segments) expect(allowed).toContain(seg.type);
  });

  it('demotes semantically incompatible type_answer and underspecified speed_tap briefs before authoring', () => {
    const input: PlanSkeleton = {
      segments: [
        { type: 'story_scene', brief: 'Introduce the idea.' },
        { type: 'type_answer', brief: 'Write a sentence about something you want.' },
        { type: 'speed_tap', brief: 'Tap the examples before time runs out.' },
        { type: 'quiz_mcq', brief: 'Choose the best example.' },
        { type: 'needs_wants', brief: 'Sort the examples.' },
        { type: 'true_false', brief: 'Decide whether it is true.' },
        { type: 'match_pairs', brief: 'Match the ideas.' },
        { type: 'coin_count', brief: 'Count the coins.' },
      ],
    };
    const { skeleton: repaired, fixes } = planRepair(input, allowed, false);
    expect(repaired.segments[1]!.type).toBe('quiz_mcq');
    expect(repaired.segments[2]!.type).toBe('quiz_mcq');
    expect(fixes.some((fix) => fix.includes('open-ended type_answer'))).toBe(true);
    expect(fixes.some((fix) => fix.includes('underspecified speed_tap'))).toBe(true);
  });

  it('never re-introduces a semantically unfit type_answer/speed_tap while diversifying duplicates', () => {
    // type_answer sits early in the unused pool, and every duplicate's brief is
    // non-numeric: Rule 3 used to hand one of those briefs to type_answer AFTER
    // the semantic-repair pass had already run, reintroducing the exact
    // violation with nothing behind it to re-check.
    const allowedWithTypeAnswer = ['story_scene', 'quiz_mcq', 'true_false', 'type_answer', 'match_pairs', 'sort_buckets', 'needs_wants'];
    const input: PlanSkeleton = {
      segments: [
        { type: 'story_scene', brief: 'Introduce the idea.' },
        { type: 'quiz_mcq', brief: 'Choose the best example.' },
        { type: 'quiz_mcq', brief: 'Pick the idea that fits.' },
        { type: 'quiz_mcq', brief: 'Decide which option helps.' },
        { type: 'quiz_mcq', brief: 'Select the wiser plan.' },
        { type: 'quiz_mcq', brief: 'Choose what Zara should do.' },
        { type: 'quiz_mcq', brief: 'Pick the fair option.' },
        { type: 'quiz_mcq', brief: 'Choose the honest answer.' },
      ],
    };
    const { skeleton: repaired, fixes } = planRepair(input, allowedWithTypeAnswer, false);
    expect(repaired.segments.map((s) => s.type)).not.toContain('type_answer');
    expect(new Set(repaired.segments.map((s) => s.type)).size).toBeGreaterThanOrEqual(5);
    expect(fixes.some((fix) => fix.includes('diversified duplicate'))).toBe(true);
  });

  it('ensures at least MIN_DISTINCT_TYPES distinct types', () => {
    const input = skeleton(['story_scene', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq']);
    const { skeleton: repaired } = planRepair(input, allowed, false);
    const distinct = new Set(repaired.segments.map((s) => s.type));
    expect(distinct.size).toBeGreaterThanOrEqual(5);
  });

  it('injects a money-family segment when required and absent', () => {
    const input = skeleton(['story_scene', 'quiz_mcq', 'true_false', 'match_pairs', 'sort_buckets', 'needs_wants', 'type_answer', 'number_input']);
    const moneyBefore = input.segments.some((s) => s.type === 'coin_count' || s.type === 'needs_wants' || s.type === 'price_compare' || s.type === 'make_change');
    expect(moneyBefore).toBe(true); // sanity: needs_wants IS money-family already in this fixture
    const inputNoMoney = skeleton(['story_scene', 'quiz_mcq', 'true_false', 'match_pairs', 'sort_buckets', 'type_answer', 'number_input', 'estimate_slider']);
    const { skeleton: repaired } = planRepair(inputNoMoney, allowed, true);
    const moneyTypes = ['coin_count', 'make_change', 'piggy_split', 'needs_wants', 'price_compare', 'budget_fit', 'savings_goal', 'fair_trade', 'interest_peek'];
    expect(repaired.segments.some((s) => moneyTypes.includes(s.type))).toBe(true);
  });

  it('caps storyplay flow segments at MAX_STORYPLAY_FLOWS', () => {
    const tier2Allowed = resolveAllowedTypes(buildTaxonomy(), 'tier2').allowed;
    const input = skeleton([
      'story_scene',
      'would_you_rather',
      'flash_match',
      'lightning_round',
      'quiz_mcq',
      'true_false',
      'match_pairs',
      'coin_count',
    ]);
    const { skeleton: repaired } = planRepair(input, tier2Allowed, false);
    const storyplayFlowCount = repaired.segments.filter((s) => s.type === 'flash_match' || s.type === 'lightning_round').length;
    expect(storyplayFlowCount).toBeLessThanOrEqual(1);
  });
});

/*
 * "Preguntas que salen de la nada" (owner report 2026-08-15).
 *
 * A plan is a TYPE and a BRIEF. planRepair can only change the type, so every
 * repair leaves behind a brief describing a mechanic the segment no longer is.
 * The brief is what carries the micro-situation the lesson has been building,
 * so a silent retype is exactly how a child meets an exercise with no
 * relationship to the story it just read — and both the money rule and the
 * diversify rule pick their victim from the END of the lesson.
 */
describe('planRepair — a retyped segment is flagged, never silently divorced from its brief', () => {
  it('records the type the brief was written for when the money rule retypes a segment', () => {
    const input = skeleton(['story_scene', 'quiz_mcq', 'true_false', 'match_pairs', 'sort_buckets', 'odd_one_out', 'timeline_order', 'quiz_mcq']);
    const { skeleton: repaired } = planRepair(input, allowed, true);

    const retyped = repaired.segments.filter((s) => s.retypedFrom);
    expect(retyped.length).toBeGreaterThan(0);
    for (const seg of retyped) {
      expect(seg.retypedFrom).not.toBe(seg.type);
      // The brief is deliberately untouched — the flag exists precisely because
      // this text no longer matches the mechanic.
      expect(seg.brief).toMatch(/^segment \d+$/);
    }
  });

  it('flags a disallowed-type replacement', () => {
    const input = skeleton(['story_scene', 'debug_hunt', 'true_false', 'match_pairs', 'sort_buckets', 'needs_wants', 'coin_count', 'number_input']);
    const { skeleton: repaired } = planRepair(input, allowed, false);
    const wasDebugHunt = repaired.segments.find((s) => s.retypedFrom === 'debug_hunt');
    expect(wasDebugHunt).toBeDefined();
    expect(wasDebugHunt!.type).not.toBe('debug_hunt');
  });

  it('leaves untouched segments unflagged, so the writer only sees real mismatches', () => {
    const input = skeleton(['story_scene', 'quiz_mcq', 'true_false', 'match_pairs', 'sort_buckets', 'needs_wants', 'coin_count', 'number_input']);
    const { skeleton: repaired, fixes } = planRepair(input, allowed, false);
    expect(fixes).toEqual([]);
    expect(repaired.segments.every((s) => s.retypedFrom === undefined)).toBe(true);
  });
});

describe('describeMixRuleViolations — the planner gets told, in its own vocabulary', () => {
  it('is silent on a compliant plan', () => {
    const ok = skeleton(['story_scene', 'quiz_mcq', 'true_false', 'match_pairs', 'sort_buckets', 'needs_wants', 'coin_count', 'number_input']);
    expect(describeMixRuleViolations(ok, allowed, false)).toEqual([]);
  });

  it('names a non-story opener, a missing money segment and too few distinct types', () => {
    const bad = skeleton(['quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq']);
    const issues = describeMixRuleViolations(bad, allowed, true).join(' | ');
    expect(issues).toContain('segment 1 must be a `story` family type');
    expect(issues).toContain('money');
    expect(issues).toContain('distinct types');
  });

  it('names a type that is not in the palette', () => {
    const bad = skeleton(['story_scene', 'debug_hunt', 'true_false', 'match_pairs', 'sort_buckets', 'needs_wants', 'coin_count', 'number_input']);
    expect(describeMixRuleViolations(bad, allowed, false).join(' | ')).toContain('"debug_hunt"');
  });

  /*
   * The feedback must be actionable by the PLANNER, whose output is
   * {type, brief} pairs — every message therefore points at a segment number
   * and says what to change, not merely that something is wrong.
   */
  it('every message identifies which segment or which rule to act on', () => {
    const bad = skeleton(['quiz_mcq', 'debug_hunt', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq', 'quiz_mcq']);
    for (const issue of describeMixRuleViolations(bad, allowed, true)) {
      expect(issue).toMatch(/segment \d+|at least|no `money` family|storyplay flow/);
    }
  });
});
