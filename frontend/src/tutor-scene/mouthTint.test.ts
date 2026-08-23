import { describe, expect, it } from 'vitest';
import { mouthCardTint, resolveBackdrop, SCENE_BACKDROP_IDS } from './backdrops';

/*
 * The mouth card is the ONE unlit surface in the scene (`MouthCard.tsx` records
 * why: every lit material renders that particular map solid black and the cause
 * is not found). An unlit material does not darken when the sun goes down, so
 * at Dusk the card was a cream rectangle across an orange-lit face — tape over
 * the mouth of a character the camera closes in on BECAUSE she articulates.
 *
 * `mouthCardTint` is the hand-applied light. These are the properties that make
 * it safe to land on a finished product, rather than a plausible-looking
 * constant somebody would have to re-check by eye every time a palette moves.
 */

const rgb = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

describe('the light on an unlit mouth', () => {
  it('leaves the DEFAULT palette exactly white, so nothing anyone is looking at today moves', () => {
    // `auto` in light mode is the default nobody has changed, and it is the
    // reference the ratio is taken against — so it must come back as the
    // identity multiplier, not merely close to one.
    expect(mouthCardTint(resolveBackdrop('auto', false))).toBe('#ffffff');
  });

  it('leaves full daylight white too — the atlas already IS the daylight albedo', () => {
    expect(mouthCardTint(resolveBackdrop('day', false))).toBe('#ffffff');
  });

  it('darkens every channel once the sun is down', () => {
    const day = rgb(mouthCardTint(resolveBackdrop('day', false)));
    for (const backdrop of ['dawn', 'dusk', 'night'] as const) {
      const here = rgb(mouthCardTint(resolveBackdrop(backdrop, false)));
      for (let i = 0; i < 3; i++) {
        expect(here[i], `${backdrop} channel ${i}`).toBeLessThan(day[i] as number);
      }
    }
  });

  it('is darkest at night, which is the hour that made this visible', () => {
    const night = rgb(mouthCardTint(resolveBackdrop('night', false)));
    const dusk = rgb(mouthCardTint(resolveBackdrop('dusk', false)));
    const sum = (c: [number, number, number]) => c[0] + c[1] + c[2];
    expect(sum(night)).toBeLessThan(sum(dusk));
  });

  it('carries the HUE of the hour, not just its brightness', () => {
    // A tint that only dimmed would leave a grey sticker instead of a white
    // one. Dusk's light is warm, night's is cold, and the multiplier has to say
    // so or the mouth reads as a hole in the face rather than as lit skin.
    const [dr, , db] = rgb(mouthCardTint(resolveBackdrop('dusk', false)));
    expect(dr).toBeGreaterThan(db);
    const [nr, , nb] = rgb(mouthCardTint(resolveBackdrop('night', false)));
    expect(nb).toBeGreaterThan(nr);
  });

  it('never brightens past white, for any hour in either theme', () => {
    for (const backdrop of SCENE_BACKDROP_IDS) {
      for (const isDark of [false, true]) {
        const hex = mouthCardTint(resolveBackdrop(backdrop, isDark));
        expect(hex, `${backdrop} dark=${isDark}`).toMatch(/^#[0-9a-f]{6}$/);
        for (const channel of rgb(hex)) expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });

  it('follows the theme only where the learner did not choose an hour', () => {
    // `auto` is the one value that consults the theme (`resolveBackdrop`'s own
    // rule); a chosen hour is honoured identically in light and dark, and the
    // tint must not quietly reintroduce the override the picker exists to make.
    expect(mouthCardTint(resolveBackdrop('auto', true))).not.toBe(
      mouthCardTint(resolveBackdrop('auto', false)),
    );
    for (const backdrop of ['dawn', 'day', 'dusk', 'night'] as const) {
      expect(mouthCardTint(resolveBackdrop(backdrop, true))).toBe(
        mouthCardTint(resolveBackdrop(backdrop, false)),
      );
    }
  });
});
