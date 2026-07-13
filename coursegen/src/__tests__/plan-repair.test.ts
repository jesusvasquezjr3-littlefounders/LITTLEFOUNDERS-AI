import { describe, expect, it } from 'vitest';
import { planRepair, type PlanSkeleton } from '../pipeline/plan.js';
import { resolveAllowedTypes } from '../pipeline/prompts/palette.js';
import { buildTaxonomy } from './fixtures.js';

const { allowed } = resolveAllowedTypes(buildTaxonomy(), 'tier1');

function skeleton(types: string[]): PlanSkeleton {
  return { segments: types.map((type, i) => ({ type, brief: `segment ${i}` })) };
}

describe('planRepair', () => {
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
