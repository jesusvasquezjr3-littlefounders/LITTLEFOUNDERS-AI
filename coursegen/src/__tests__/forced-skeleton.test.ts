import { describe, expect, it } from 'vitest';
import { buildForcedSkeleton } from '../pipeline/plan.js';
import { ALL_TYPES } from '../contract/registry.js';

describe('buildForcedSkeleton (COURSE_ENGINE.md §4 addendum — QA override)', () => {
  it('maps each forced type to one segment, in order', () => {
    const skeleton = buildForcedSkeleton(['quiz_mcq', 'true_false'], 'Practica reconocer monedas');
    expect(skeleton.segments.map((s) => s.type)).toEqual(['quiz_mcq', 'true_false']);
  });

  it('does not enforce MIN_SEGMENTS — a single-type skeleton is valid', () => {
    const skeleton = buildForcedSkeleton(['coin_count'], 'Practica contar monedas');
    expect(skeleton.segments).toHaveLength(1);
  });

  it('every brief mentions the type id and stays non-empty', () => {
    const skeleton = buildForcedSkeleton(['picture_choice'], 'Elige la imagen correcta');
    expect(skeleton.segments[0]!.brief).toContain('picture_choice');
    expect(skeleton.segments[0]!.brief.length).toBeGreaterThan(0);
  });

  it('is deterministic: same input always produces the same output', () => {
    const a = buildForcedSkeleton(['story_scene', 'quiz_mcq'], 'Objetivo');
    const b = buildForcedSkeleton(['story_scene', 'quiz_mcq'], 'Objetivo');
    expect(a).toEqual(b);
  });

  it('accepts every canonical type id from the composed contract', () => {
    const skeleton = buildForcedSkeleton([...ALL_TYPES], 'Cobertura total');
    expect(skeleton.segments).toHaveLength(ALL_TYPES.length);
  });
});
