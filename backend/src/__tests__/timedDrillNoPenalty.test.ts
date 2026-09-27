import { describe, expect, it } from 'vitest';
import { GRADERS } from '../lesson-contract/registry.js';
import type { SegmentBase } from '../lesson-contract/core/types.js';

/*
 * OD-28 (owner review L-01, dark-pattern audit MN-02): the two timed drill
 * types, speed_tap (choice family) and flash_match (storyplay family), keep
 * their timers, but running out of time never reduces the score Core records.
 * The frontend grader is the verbatim original (contract:check), so this pins
 * the authoritative side a client cannot influence.
 */

function segment(type: string, payload: Record<string, unknown>, answer: Record<string, unknown>): SegmentBase {
  return { id: `seg-${type}`, type, prompt_md: 'x', difficulty: 1, xp: 10, payload, answer } as SegmentBase;
}

describe('timed drills never penalize running out of time (OD-28)', () => {
  it('speed_tap scores the same with and without overtime', () => {
    const grade = GRADERS.speed_tap!;
    const seg = segment('speed_tap', { items: ['a', 'b', 'c', 'd'].map((id) => ({ id })) }, { target_ids: ['a', 'b'] });
    for (const selected of [['a', 'b'], ['a'], ['a', 'c'], []]) {
      const on = grade(seg, { selected_ids: selected, overtime: true }).score;
      const off = grade(seg, { selected_ids: selected, overtime: false }).score;
      expect(on).toBe(off);
    }
    expect(grade(seg, { selected_ids: ['a', 'b'], overtime: true }).score).toBe(100);
  });

  it('flash_match scores the same with and without overtime', () => {
    const grade = GRADERS.flash_match!;
    const pairs = [
      ['l1', 'r1'],
      ['l2', 'r2'],
    ];
    const seg = segment('flash_match', { left: [], right: [] }, { pairs });
    expect(grade(seg, { pairs, overtime: true }).score).toBe(100);
    const partial = [['l1', 'r1']];
    expect(grade(seg, { pairs: partial, overtime: true }).score).toBe(grade(seg, { pairs: partial, overtime: false }).score);
    expect(grade(seg, { pairs: partial, overtime: true }).score).toBe(50);
  });
});
