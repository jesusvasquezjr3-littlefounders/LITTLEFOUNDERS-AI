import type { CSSProperties } from 'react';
import { resolveBackdrop, type BackdropLighting, type SceneBackdropId } from './backdrops';

/*
 * THE BRIDGE FROM THE SCENE'S LIGHT TO THE HUD'S MATERIAL.
 *
 * `SceneLighting` reads a backdrop palette and points three-dimensional lights
 * with it. This reads the SAME palette and points CSS at it, so a plate over
 * the island is lit by the hour the island is standing in: its fill leans
 * toward the sky, its specular lip is the key light's colour, and its shadow is
 * made of the ground's bounce and lengthens as the sun drops.
 *
 * WHY IT IS FOUR VALUES AND NOT A STYLESHEET. Everything derived from them —
 * the fill mix, the shade, the shadow ramps, the sky glow — is arithmetic that
 * CSS does for free at use time (`index.css` → LUMEN). What CSS cannot do is
 * know where the sun is, and what TypeScript should not do is duplicate the
 * theme's own tokens in order to mix against them. So this file publishes
 * PHYSICS (three colours and an elevation) and the stylesheet does the mixing
 * against `--lf-surface` and `--lf-base`. Neither side holds a copy of the
 * other's numbers.
 *
 * WHY IT IS NOT PER FRAME. Writing a custom property invalidates style on every
 * element that inherits it, which on this route is the entire HUD. Once per
 * backdrop change is a handful of writes a session; once per frame would cost
 * more than drawing the island. Everything that genuinely has to move at 60 Hz
 * — the projection of an anchored chip — is a direct `transform` write on one
 * node and stays that way.
 *
 * Pure, and free of `three` and of React's runtime, so the mapping can be
 * asserted without a GPU.
 */

/**
 * A style object carrying custom properties.
 *
 * React's `CSSProperties` is a weak type — every property optional — so an
 * object of only `--lf-*` keys is not assignable to it. The intersection is,
 * and it keeps the keys typed rather than reaching for `Record<string, string>`
 * and a cast.
 */
export type AtmosphereStyle = CSSProperties & { [key in `--lf-${string}`]?: string };

/**
 * How high the key light is, 0 (on the horizon) to 1 (overhead).
 *
 * The sun's position is a direction, not a place, so elevation is the
 * normalized Y of that direction. It is the single number the shadow ramps in
 * `index.css` read: length, diffusion, darkness and the strength of the
 * specular lip all follow from it, which is what makes dawn and dusk feel
 * different from noon without a second palette.
 */
export function sunHeight(lighting: BackdropLighting): number {
  const [x, y, z] = lighting.sunPosition;
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length <= 0) return 1;
  return Math.min(1, Math.max(0, y / length));
}

/** The four values the stage root publishes for the HUD's material. */
export function atmosphereStyle(lighting: BackdropLighting): AtmosphereStyle {
  return {
    '--lf-sky': lighting.sky,
    '--lf-key': lighting.sun,
    '--lf-ground': lighting.ground,
    // Rounded because it lands in a CSS ramp, not in a shader: three decimals
    // is finer than any shadow this drives can express, and a shorter string
    // keeps the style attribute stable across re-renders.
    '--lf-sun-height': sunHeight(lighting).toFixed(3),
  };
}

/**
 * The style the stage root publishes for a chosen backdrop.
 *
 * `auto` PUBLISHES NOTHING, on purpose. Auto is the palette that follows the
 * app theme, and the stylesheet already carries both halves of it as the
 * initial values of the four registered properties — `AUTO_LIGHT` on `:root`,
 * `AUTO_DARK` on `.dark`. Overriding them from here would mean this module
 * holding a second copy of the theme's own switch, and it would mean the stage
 * needing a ThemeProvider in order to render at all.
 *
 * The other four are honoured identically in both themes, exactly as
 * `resolveBackdrop` does for the lights: a learner who picked Dusk and then
 * switched the app to light mode asked for two different things.
 */
export function atmosphereFor(backdrop: SceneBackdropId): AtmosphereStyle {
  if (backdrop === 'auto') return {};
  // `isDark` is irrelevant for the four chosen hours — `resolveBackdrop` only
  // consults it for `auto`, which returned above.
  return atmosphereStyle(resolveBackdrop(backdrop, false));
}
