/*
 * What time of day the island is standing in.
 *
 * THIS CLOSES A SHIPPED BUG, and the shape of the bug is worth stating plainly
 * because it is the kind that passes every test. `backdrop` is offered in the
 * personalization panel, validated by Zod, persisted, and returned by two
 * endpoints. A learner can pick "Night", see it saved, come back tomorrow and
 * see it still selected. It reaches no renderer. Neither `TutorSceneProps` nor
 * `TutorStageProps` had ever had such a field, so the value travelled the entire
 * length of the system and stopped one prop short of the lights.
 *
 * The palettes below are PHYSICAL LIGHT, not surface colour, which is why they
 * are literal values rather than DESIGN.md tokens. A token like `--lf-surface`
 * answers "what colour is this panel"; nothing in the design system answers
 * "what colour is the sun at dusk", and borrowing a UI token for it would tie
 * the sky to a palette that exists to keep text legible. `SceneLighting` has
 * always carried literal light values for the same reason.
 *
 * Pure — no `three`, no React — so the palette can be asserted without a GPU.
 */

/** The closed set the personalization axis offers. */
export type SceneBackdropId = 'auto' | 'dawn' | 'day' | 'dusk' | 'night';

export const SCENE_BACKDROP_IDS = [
  'auto',
  'dawn',
  'day',
  'dusk',
  'night',
] as const satisfies readonly SceneBackdropId[];

export function isSceneBackdropId(value: string): value is SceneBackdropId {
  return (SCENE_BACKDROP_IDS as readonly string[]).includes(value);
}

export interface BackdropLighting {
  /** Hemisphere light's sky colour. */
  sky: string;
  /** Hemisphere light's ground bounce colour. */
  ground: string;
  hemisphereIntensity: number;
  /** The single shadow-casting light. */
  sun: string;
  sunIntensity: number;
  /** Where the sun sits. Moving it moves the shadows, which is most of the read. */
  sunPosition: readonly [number, number, number];
}

/*
 * `auto` is the theme-driven lighting the stage already shipped, byte for byte.
 *
 * It stays the DEFAULT so that adding this feature changes nothing for anyone
 * who has not chosen a backdrop — a lighting change is the most visible possible
 * regression, and "the island looks different today" is not a change anyone
 * asked for when they only wanted the picker to work.
 */
const AUTO_LIGHT: BackdropLighting = {
  sky: '#eaf2ff',
  ground: '#d8c7a8',
  hemisphereIntensity: 1.6,
  sun: '#fff6e5',
  sunIntensity: 1.8,
  sunPosition: [4, 8, 5],
};

/*
 * THE DARK STAGE, RETUNED TO THE DESIGN STUDY (2026-09-06, owner direction).
 *
 * This was `sky: '#2a3550'` — a desaturated blue-grey that lit the island like
 * an overcast evening. The study's stage is a VIOLET-INDIGO one
 * (`#232062` at the core of its vignette, falling to near-black), which is what
 * makes it read as a lit cinematic stage rather than as a dark app. The sky
 * colour is the hemisphere term, so it is also what the HUD's whole Lumen
 * material mixes its fill against (`atmosphere.ts` publishes it as `--lf-sky`)
 * — moving it moves the chrome and the island together, which is the point.
 *
 * The key light keeps a real direction and a cool-violet cast rather than
 * going ambient-only: an unlit character at night is a silhouette of a bug
 * (see the note on the four chosen hours below), and the study's own character
 * is clearly keyed from above-left.
 */
const AUTO_DARK: BackdropLighting = {
  sky: '#232062',
  ground: '#080b18',
  hemisphereIntensity: 1.15,
  sun: '#a5a0ff',
  sunIntensity: 1.05,
  /*
   * A LOW KEY, and this is the fix the vignette exposed.
   *
   * This was `[4, 8, 5]` — a sun 0.78 of the way to the zenith, i.e. NOON,
   * on the preset whose whole job is "it is dark". `sunHeight` is the single
   * number every night-ward ramp in the stylesheet reads (`index.css` →
   * LUMEN, and the stage vignette): the white rim that only appears as the
   * sun drops, the lengthening shadows, the corner falloff. At 0.78 none of
   * them engaged, so dark mode rendered as an overcast afternoon and every
   * ramp written "for night" was dead code in the one condition it existed
   * for. The intensity is unchanged — the character stays lit, and is now
   * RAKED from the side the way the study's is, rather than flooded.
   */
  sunPosition: [4, 3.4, 5],
};

/*
 * The four chosen times of day.
 *
 * Each differs from its neighbours in THREE ways at once — hue, intensity and
 * sun ANGLE — because a backdrop that only changed colour temperature reads as a
 * filter over the same picture rather than as a different hour. The low, raking
 * sun is what makes dawn and dusk legible at a glance on a 375 px screen, where
 * a subtle warm tint is not.
 *
 * Night keeps a real key light rather than going to ambient-only. A flat ambient
 * term makes stylized characters read as cardboard cutouts, and an unlit
 * character at night is not atmospheric, it is a silhouette of a bug.
 */
const BACKDROPS: Readonly<Record<Exclude<SceneBackdropId, 'auto'>, BackdropLighting>> = Object.freeze({
  dawn: {
    sky: '#ffd9c2',
    ground: '#6b5a7a',
    hemisphereIntensity: 1.25,
    sun: '#ffb27a',
    sunIntensity: 1.5,
    sunPosition: [-7, 2.6, 6],
  },
  day: {
    sky: '#eaf2ff',
    ground: '#d8c7a8',
    hemisphereIntensity: 1.65,
    sun: '#fff6e5',
    sunIntensity: 1.85,
    sunPosition: [4, 9, 5],
  },
  dusk: {
    sky: '#ffc09f',
    ground: '#3a3350',
    hemisphereIntensity: 1.1,
    sun: '#ff8f6b',
    sunIntensity: 1.35,
    sunPosition: [7, 2.2, -5],
  },
  // Retuned with `AUTO_DARK` above, and deeper than it: this is the hour a
  // learner CHOSE, so it goes further into the study's violet than the theme's
  // own default dark does.
  night: {
    sky: '#2b2470',
    ground: '#06080f',
    hemisphereIntensity: 0.9,
    sun: '#b0a8ff',
    sunIntensity: 0.8,
    // Lower still than `AUTO_DARK`, for the same reason: 0.74 was noon
    // wearing a blue filter.
    sunPosition: [-5, 2.6, -4],
  },
});

/**
 * The lighting a backdrop resolves to.
 *
 * `auto` is the only value that consults the theme. The other four are a
 * DELIBERATE CHOICE by the learner and are honoured identically in light and
 * dark mode: someone who picked Night and then switched the app to light mode
 * asked for two different things, and silently overriding the one they chose
 * inside the scene would make the picker feel broken in exactly the way it
 * already was.
 */
export function resolveBackdrop(backdrop: SceneBackdropId, isDark: boolean): BackdropLighting {
  if (backdrop === 'auto') return isDark ? AUTO_DARK : AUTO_LIGHT;
  return BACKDROPS[backdrop];
}

/** Parses `#rrggbb` into 0..1 channels. Returns null for anything else. */
function channels(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) return null;
  const value = Number.parseInt(match[1], 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function toHex(r: number, g: number, b: number): string {
  const byte = (channel: number) =>
    Math.round(Math.min(1, Math.max(0, channel)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/**
 * Warms a palette by `amount` (0..1), for the close performance.
 *
 * The session's ending lerps one notch warmer over the pull-back regardless of
 * which backdrop the learner chose, so the warmth has to be a TRANSFORM of
 * whatever palette is live rather than a sixth palette. A fixed "sunset" ending
 * would silently discard a choice the learner made, at the one moment of the
 * session they are most likely to remember.
 */
export function warmBy(lighting: BackdropLighting, amount: number): BackdropLighting {
  const t = Math.min(1, Math.max(0, amount));
  if (t === 0) return lighting;

  const warm = (hex: string, toward: [number, number, number]): string => {
    const rgb = channels(hex);
    // An unparseable colour means someone hand-edited a palette into a form this
    // does not understand. Returning it untouched keeps the scene lit; guessing
    // a replacement would repaint the sky over a typo.
    if (!rgb) return hex;
    return toHex(
      rgb[0] + (toward[0] - rgb[0]) * t,
      rgb[1] + (toward[1] - rgb[1]) * t,
      rgb[2] + (toward[2] - rgb[2]) * t,
    );
  };

  return {
    ...lighting,
    sky: warm(lighting.sky, [1, 0.86, 0.72]),
    ground: warm(lighting.ground, [0.55, 0.42, 0.34]),
    sun: warm(lighting.sun, [1, 0.78, 0.55]),
    sunIntensity: lighting.sunIntensity * (1 + t * 0.12),
  };
}

/**
 * WHAT COLOUR THE LIGHT IS, for a surface that cannot be lit.
 *
 * The mouth card is the one thing in the scene on an UNLIT material, and
 * `MouthCard.tsx` records why: every lit material renders that particular map
 * solid black and the cause is still not found. Its own comment named the
 * consequence — "what it will not do is darken with the face as the scene's
 * lighting changes" — and the consequence turned out to be worse than the
 * sentence sounds. Photographed at Dusk on a 1280 stage, Zara's mouth is a
 * bright cream rectangle across an orange-lit face: it reads as tape over her
 * mouth, on the character the camera closes in on BECAUSE she articulates.
 *
 * An unlit material still multiplies its map by `color`, so the light can be
 * applied by hand even though the shader will not do it. This is that
 * multiplier: an approximation of the irradiance on a forward-facing patch of
 * skin, half of it sky and half of it sun, expressed RELATIVE TO THE DEFAULT
 * PALETTE.
 *
 * Relative, and clamped to white, is what makes this safe to land on a
 * finished product: `auto` in light mode — the default nobody has changed —
 * comes out exactly `#ffffff`, so the card renders the same bytes it does
 * today. Only a learner who has chosen a darker hour sees any difference, and
 * what they see is their choice reaching one more surface.
 *
 * It is deliberately NOT physically accurate. The card carries the character's
 * own albedo, sampled from their texture, so the job is to keep it the same
 * distance from the skin around it as the light moves — not to compute a
 * radiance. `warmBy` is not applied: the closing warmth lands while the camera
 * is pulling back to the establishing shot, where the mouth is a few pixels.
 */
function irradiance(lighting: BackdropLighting): [number, number, number] {
  const sky = channels(lighting.sky) ?? [1, 1, 1];
  const sun = channels(lighting.sun) ?? [1, 1, 1];
  return [0, 1, 2].map(
    (i) =>
      (sky[i] as number) * lighting.hemisphereIntensity * 0.5 +
      (sun[i] as number) * lighting.sunIntensity * 0.5,
  ) as [number, number, number];
}

const REFERENCE_IRRADIANCE = irradiance(AUTO_LIGHT);

/**
 * The sRGB transfer function, and it is load-bearing rather than pedantry.
 *
 * `material.color` is read as an sRGB value and converted to LINEAR before the
 * shader multiplies it by the map, so writing a linear ratio straight into it
 * applies that ratio TWICE over — measured on the stage: the first version of
 * this tint fixed Dusk and turned Night's mouth into a black rectangle, which
 * is the white bar again wearing the other colour. Encoding the ratio is what
 * makes the multiplier the one that was computed.
 *
 * The exact piecewise curve, not `x ** (1 / 2.2)`: the two disagree by several
 * points at the dark end, which is precisely the end this exists to get right.
 */
function linearToSrgb(value: number): number {
  const v = Math.min(1, Math.max(0, value));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

export function mouthCardTint(lighting: BackdropLighting): string {
  const here = irradiance(lighting);
  const ratio = (i: number) => {
    const reference = REFERENCE_IRRADIANCE[i] as number;
    // A reference channel of zero would mean the default palette emits nothing
    // in that channel, which it does not — but dividing by it would tint the
    // mouth by an accident of arithmetic rather than by the light.
    if (reference <= 0) return 1;
    return linearToSrgb((here[i] as number) / reference);
  };
  return toHex(ratio(0), ratio(1), ratio(2));
}
