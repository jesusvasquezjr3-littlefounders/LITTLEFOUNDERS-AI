import { describe, expect, it } from 'vitest';
import { atmosphereFor, atmosphereStyle, sunHeight } from './atmosphere';
import { resolveBackdrop, SCENE_BACKDROP_IDS } from './backdrops';

describe('the light the HUD is standing in', () => {
  it('reads the same palette the lights read', () => {
    const dusk = resolveBackdrop('dusk', false);
    expect(atmosphereStyle(dusk)).toMatchObject({
      '--lf-sky': dusk.sky,
      '--lf-key': dusk.sun,
      '--lf-ground': dusk.ground,
    });
  });

  it('publishes every value the material needs, for every chosen hour', () => {
    for (const backdrop of SCENE_BACKDROP_IDS) {
      if (backdrop === 'auto') continue;
      const style = atmosphereFor(backdrop);
      for (const key of ['--lf-sky', '--lf-key', '--lf-ground', '--lf-sun-height'] as const) {
        expect(style[key], `${backdrop} ${key}`).toBeTruthy();
      }
      // A colour the stylesheet cannot parse would silently drop the whole
      // `color-mix`, and the plate would fall back to a flat token without
      // anything going red.
      expect(style['--lf-sky']).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style['--lf-key']).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style['--lf-ground']).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('puts the sun low at dawn and dusk and high at noon, which is the whole read', () => {
    const dawn = sunHeight(resolveBackdrop('dawn', false));
    const day = sunHeight(resolveBackdrop('day', false));
    const dusk = sunHeight(resolveBackdrop('dusk', false));

    expect(dawn).toBeLessThan(0.4);
    expect(dusk).toBeLessThan(0.4);
    expect(day).toBeGreaterThan(0.7);
    // The shadow ramps multiply by (1 - height), so a value outside 0..1 would
    // produce a negative blur radius and no shadow at all.
    for (const height of [dawn, day, dusk]) {
      expect(height).toBeGreaterThanOrEqual(0);
      expect(height).toBeLessThanOrEqual(1);
    }
  });

  it('publishes NOTHING for auto, leaving the stylesheet its own light and dark defaults', () => {
    /*
     * Auto is the palette that follows the app theme, and `index.css` already
     * carries both halves of it as the initial values of the four registered
     * properties. Overriding them here would mean this module holding a second
     * copy of the theme switch, and it would mean the stage needing a
     * ThemeProvider in order to render at all.
     */
    expect(atmosphereFor('auto')).toEqual({});
  });

  it('survives a degenerate sun rather than emitting NaN into the stylesheet', () => {
    expect(sunHeight({ ...resolveBackdrop('day', false), sunPosition: [0, 0, 0] })).toBe(1);
  });
});
