import { describe, expect, it } from 'vitest';
import { duplicatePreviewScreens, PREVIEW_REGISTRIES, PREVIEW_SCREENS } from './index';
import { framed } from './types';

describe('preview registries (one per wave-2 lane)', () => {
  it('registers every screen id in exactly one lane', () => {
    expect(duplicatePreviewScreens()).toEqual([]);
    const total = Object.values(PREVIEW_REGISTRIES).reduce((sum, registry) => sum + Object.keys(registry).length, 0);
    expect(Object.keys(PREVIEW_SCREENS)).toHaveLength(total);
  });

  it('reports a screen id two lanes both register', () => {
    const screen = framed(() => null);
    expect(duplicatePreviewScreens({ learn: { lesson: screen }, mentor: { lesson: screen } })).toEqual(['lesson (learn and mentor)']);
  });

  it('keeps one registry per lane', () => {
    expect(Object.keys(PREVIEW_REGISTRIES)).toEqual(['core', 'site', 'learn', 'mentor', 'family', 'profile', 'staff']);
  });
});
