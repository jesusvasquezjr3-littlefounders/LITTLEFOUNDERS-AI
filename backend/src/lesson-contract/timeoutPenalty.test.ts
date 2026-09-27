// OD-28 (owner review item L-01, audit item MN-02): running out of time in a timed
// drill no longer costs points. Core's graders are the authority for a v1 lesson's
// score, so the property is pinned here as well as in the frontend mirror.
import { describe, expect, it } from 'vitest';
import type { SegmentBase } from './core/types.js';
import { GRADERS } from './registry.js';

function seg(type: string, payload: Record<string, unknown>, answer: Record<string, unknown>): SegmentBase {
  return { id: `t-${type}`, type, prompt_md: 'x', difficulty: 1, xp: 10, payload, answer } as SegmentBase;
}

describe('timed drills keep the answer own score when time runs out (OD-28)', () => {
  it('speed_tap', () => {
    const segment = seg(
      'speed_tap',
      { seconds: 20, items: ['a', 'b', 'c', 'd'].map((id) => ({ id, text_md: id })) },
      { target_ids: ['a', 'b'] },
    );
    const inTime = GRADERS.speed_tap!(segment, { selected_ids: ['a', 'b'], overtime: false });
    const late = GRADERS.speed_tap!(segment, { selected_ids: ['a', 'b'], overtime: true });
    expect(inTime.score).toBe(100);
    expect(late.score).toBe(100);
  });

  it('flash_match', () => {
    const left = ['l1', 'l2'].map((id) => ({ id, text_md: id }));
    const right = ['r1', 'r2'].map((id) => ({ id, text_md: id }));
    const segment = seg(
      'flash_match',
      { seconds: 30, left, right },
      { pairs: [['l1', 'r1'], ['l2', 'r2']] },
    );
    const pairs = [['l1', 'r1'], ['l2', 'r2']];
    expect(GRADERS.flash_match!(segment, { pairs, overtime: false }).score).toBe(100);
    expect(GRADERS.flash_match!(segment, { pairs, overtime: true }).score).toBe(100);
  });
});
