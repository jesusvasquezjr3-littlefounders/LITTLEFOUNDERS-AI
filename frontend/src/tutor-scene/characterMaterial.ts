/*
 * Making the cast take the light.
 *
 * WHAT WAS ON THE SCREEN, and it is the reason this file exists rather than a
 * taste about shading. Driven on `/dev/tutor-lab` at 375x812 during the
 * personalization audition, Liruf rendered as a pale mint GHOST while Dina
 * beside him rendered solid — the same complaint the owner's reviewer filed as
 * "Liruf renders SEMI-TRANSPARENT". He is not transparent: with the camera
 * frozen and every other mesh hidden, 87.6% of his silhouette is pixel-for-pixel
 * identical to a solo render, and 2.2% is honestly occluded. He is UNLIT.
 *
 * Every character .glb ships the same two export defaults, read straight out of
 * the files with `@gltf-transform`:
 *
 *     metallicFactor: 1   with NO metallicRoughness texture
 *     emissiveFactor: [1, 1, 1]   with the BASE COLOUR texture in the emissive slot
 *
 * Together those two mean: no diffuse term at all (a metal has none), plus the
 * albedo added back at full strength as EMISSION. What reaches the screen is
 * therefore the flat texture, self-illuminated, with a rough metallic sheen on
 * top — a decal of a character, with no form, no shading and no relationship to
 * the light. A saturated character like Dina survives that and reads as solid;
 * a pale, low-contrast one like Liruf washes out against orange sand and reads
 * as a ghost. Same bug, two symptoms, and only one of them got reported.
 *
 * It also quietly cancelled the feature the four times of day exist for. The
 * island genuinely relights at dawn, day, dusk and night; the cast did not
 * change at all, because an emissive surface does not care what the sun is
 * doing. Dusk lit the island and left four day-lit characters standing on it.
 *
 * WHY THIS IS FIXED AT LOAD AND NOT IN THE EXPORT. `public/scenes` is a build
 * output and deployed builds fetch content-addressed bytes from Depot
 * (`assets.ts`), so a corrected export only reaches a browser after a
 * re-optimise AND a re-publish AND a manifest commit. A normalisation here is
 * true for every asset the moment it loads, including the ones already
 * published, and it keeps working when the next character arrives from the same
 * authoring pipeline with the same defaults. `scripts/optimize-glb.mjs` should
 * still learn this, and that is a separate, slower fix.
 *
 * WHY IT IS CONDITIONAL AND NOT A BLANKET OVERRIDE. Both rules below fire only
 * on the fingerprint of an export DEFAULT, never on authored intent:
 *
 *   - metalness is only cleared when there is NO metalness map. A material that
 *     ships a metallicRoughness texture has been authored per-texel and is left
 *     exactly as it is — which is why the two islands, which do ship one, are
 *     untouched by this and still read as sand and stone.
 *   - emission is only dimmed when it is full white AND the emissive map IS the
 *     base-colour map (or there is no map at all). That pairing has one
 *     meaning: "render this unlit". A character with a real, separate emissive
 *     texture — a glowing visor, a lantern — keeps it, and so does anyone who
 *     chose a value that is not full white.
 *
 * Dimmed, not switched off: see `CLAY_EMISSIVE_FLOOR` for the screenshot that
 * put the floor back.
 *
 * Pure, and free of `three` and of React: it takes anything with the fields it
 * touches, so the rules can be asserted without a GPU.
 */

/** The subset of a three.js material this normalisation reads or writes. */
export interface ShadedMaterial {
  /** Any texture; compared by identity only. */
  map?: unknown;
  emissiveMap?: unknown;
  metalnessMap?: unknown;
  roughnessMap?: unknown;
  metalness?: number;
  roughness?: number;
  /** three's `Color`. Only `getHex` and `setRGB` are used. */
  emissive?: { getHex: () => number; setRGB: (r: number, g: number, b: number) => void };
  /** `MeshPhysicalMaterial` only; absent on `MeshStandardMaterial`. */
  specularIntensity?: number;
  needsUpdate?: boolean;
}

/**
 * How rough the clay is.
 *
 * Not 1. A perfectly rough surface has no specular response at all, which is
 * how a claymation character stops reading as a physical object and starts
 * reading as a paper cut-out — the failure this file is fixing, arrived at from
 * the other direction. 0.85 keeps a broad, soft highlight that follows the key
 * light, which is what makes the four times of day visible ON the cast and not
 * only on the ground they stand on.
 */
export const CLAY_ROUGHNESS = 0.85;

/**
 * How strong that highlight is allowed to be.
 *
 * The exports carry `KHR_materials_specular` at full strength with a specular
 * COLOUR factor of 2 — brighter than white — which on a dielectric reads as a
 * wet varnish. A quarter is a sheen; anything more and warm clay looks like
 * polished plastic, which is precisely the "cold, corporate" register this
 * product may not have.
 */
export const CLAY_SPECULAR = 0.25;

/**
 * How much of its own colour a character keeps when no light reaches it.
 *
 * NOT ZERO, and this is the one number here that was corrected by a screenshot
 * rather than derived. Clearing the emission outright is arithmetically the
 * right undo of the exporter's "unlit" checkbox, and at Night it turned Dr. Rho
 * into a black silhouette on a blue island — measured on `/dev/tutor-lab` at
 * 375x812 with the Night light chosen. `backdrops.ts` already states the rule
 * this breaks, in its own words: "a character at night is not atmospheric, it
 * is a silhouette of a bug." The four palettes were tuned while the cast was
 * self-illuminated and therefore could not go dark; removing that floor removed
 * the thing that had been quietly holding the rule up.
 *
 * So the floor stays and only its SIZE changes: 12% of the albedo instead of
 * 100%. Twelve is enough that a face is still a face under the lowest key light
 * in the set, and little enough that every other hour is modelled by the sun —
 * which is the whole point of removing the other 88%. It rides the base-colour
 * map, so it is the character's own colour dimmed and never a grey wash over
 * them.
 *
 * It is a property of the CAST and not of the lights on purpose. Raising the
 * ambient in the Night palette instead would light the island as well, and the
 * island at night is the one thing about that hour that already looks right.
 */
export const CLAY_EMISSIVE_FLOOR = 0.12;

/** True when nothing about this material was authored per-texel. */
function isExportDefaultMetal(material: ShadedMaterial): boolean {
  return (
    material.metalnessMap == null &&
    material.roughnessMap == null &&
    (material.metalness ?? 0) > 0.5
  );
}

/**
 * True when the material was exported to render UNLIT: the albedo is in the
 * emissive slot at full white, so the shading result is the texture itself.
 */
function isSelfIlluminated(material: ShadedMaterial): boolean {
  const emissive = material.emissive;
  if (!emissive) return false;
  // Full white. A dimmer emissive is somebody's decision; 0xffffff with the
  // albedo behind it is a checkbox in an exporter.
  if (emissive.getHex() !== 0xffffff) return false;
  return material.emissiveMap == null || material.emissiveMap === material.map;
}

/**
 * Turns an unlit export back into clay that the scene's light can reach.
 *
 * Returns what it changed, so the caller can skip the `needsUpdate` write —
 * and so a test can assert that a correctly authored material is left alone
 * rather than merely assert that it looks the same afterwards.
 */
export function relightAsClay(material: ShadedMaterial): {
  dimmedEmission: boolean;
  clearedMetalness: boolean;
} {
  let dimmedEmission = false;
  let clearedMetalness = false;

  if (isSelfIlluminated(material)) {
    /*
     * Dimmed to a floor, not switched off. The map STAYS bound: the floor has
     * to be the character's own colour at 12%, so a green dinosaur in the dark
     * is a dark green dinosaur rather than a grey one.
     */
    material.emissive!.setRGB(CLAY_EMISSIVE_FLOOR, CLAY_EMISSIVE_FLOOR, CLAY_EMISSIVE_FLOOR);
    dimmedEmission = true;
  }

  if (isExportDefaultMetal(material)) {
    material.metalness = 0;
    material.roughness = CLAY_ROUGHNESS;
    if (material.specularIntensity !== undefined) material.specularIntensity = CLAY_SPECULAR;
    clearedMetalness = true;
  }

  if (dimmedEmission || clearedMetalness) material.needsUpdate = true;
  return { dimmedEmission, clearedMetalness };
}
