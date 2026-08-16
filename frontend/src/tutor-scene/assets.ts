import type { CharacterId } from '@/components/characters/control/types';

/*
 * The Tutor's 3D asset manifest.
 *
 * `sourceHeightM` is MEASURED, not guessed — `npm run assets:inspect` reports
 * the bind-pose bounds of each source export and those numbers are recorded
 * here. They matter because the four characters did not come from one pipeline:
 * three measure 1.6–1.7 m, while Dina's export is in Unreal's unit scale and
 * measures 0.028. Normalising at runtime (a scale on the wrapping group) rather
 * than rewriting vertex data keeps the .glb byte-identical to what the artist
 * approved, and a skinned mesh scaled by an ancestor group deforms correctly
 * because the joints are scaled with it.
 */

/*
 * Assets are served from `/scenes` in development (frontend/public/scenes, a
 * gitignored build output of `npm run assets:3d`) and from Depot's public
 * `tutor-scenes` bucket in deployed environments. Depot serves world-readable,
 * PII-free generated media directly to the browser by design (/AGENTS.md §1.5),
 * which is exactly what these are.
 */
const ASSET_BASE = import.meta.env.VITE_SCENE_ASSET_BASE ?? '/scenes';

/** Where scene media is served from. Mouth atlases sit under `<base>/mouth/`. */
export const SCENE_ASSET_BASE = ASSET_BASE;

function assetUrl(file: string): string {
  return `${ASSET_BASE}/${file}`;
}

export interface CharacterAsset {
  id: CharacterId;
  url: string;
  /** Bind-pose height of the source export, in glTF units. Measured, not assumed. */
  sourceHeightM: number;
  /**
   * Widest HORIZONTAL extent of the bind pose, in the same source units.
   * Measured per character, because it is not a function of height: Liruf's
   * tail makes him 1.03x as long as he is tall while Rho is 0.48x, and Dina is
   * 1.48x. Placement needs this — two characters whose footprints overlap
   * intersect, however good the standing spot underneath each of them is.
   */
  sourceFootprintM: number;
  /** Height this character should occupy in the scene, in metres. */
  targetHeightM: number;
}

/*
 * Heights, decided from what the models ACTUALLY are (rendered and inspected,
 * not inferred from filenames):
 *
 *   rho   — adult human, moustache and glasses. Export already measures 1.70 m,
 *           so it is authoritative and scale stays 1.0.
 *   zara  — young woman. Export measures 1.61 m. Also authoritative.
 *   liruf — bipedal cartoon dinosaur, same export pipeline and unit scale as
 *           the two humans, so its 1.647 m is a deliberate design choice: a
 *           dino buddy who stands eye-to-eye with the cast. Kept.
 *   dina  — QUADRUPED, and the one true outlier: exported in Unreal's unit
 *           scale (0.0283 tall, 0.0417 long — deeper than tall, which is what
 *           gave the quadruped away). She is the BIGGEST character, not the
 *           smallest: 1.90 m tall makes her ~2.80 m long, so she reads as a
 *           large dinosaur beside a 1.70 m human rather than as a pet.
 *
 *           She was 0.70 m — "large-dog sized" — which was a guess about what a
 *           baby dino companion should be, not a decision anyone made. Owner
 *           correction 2026-08-16: Dina is a big character, clearly larger than
 *           Liruf. The ceiling is the island: `diorama-a` is 6.5 m across, and
 *           at 2.80 m long she already occupies 43% of it with a second
 *           character standing beside her.
 */
export const CHARACTER_ASSETS: Readonly<Record<CharacterId, CharacterAsset>> = Object.freeze({
  dina: { id: 'dina', url: assetUrl('dina.glb'), sourceHeightM: 0.028, sourceFootprintM: 0.04167, targetHeightM: 1.9 },
  liruf: { id: 'liruf', url: assetUrl('liruf.glb'), sourceHeightM: 1.647, sourceFootprintM: 1.7, targetHeightM: 1.647 },
  rho: { id: 'rho', url: assetUrl('rho.glb'), sourceHeightM: 1.7, sourceFootprintM: 0.82109, targetHeightM: 1.7 },
  zara: { id: 'zara', url: assetUrl('zara.glb'), sourceHeightM: 1.61, sourceFootprintM: 0.82841, targetHeightM: 1.61 },
});

/** Uniform scale that brings a character to its target height. */
export function characterScale(asset: CharacterAsset): number {
  return asset.targetHeightM / asset.sourceHeightM;
}

/** How much ground this character covers once scaled, in metres. */
export function characterFootprintM(asset: CharacterAsset): number {
  return asset.sourceFootprintM * characterScale(asset);
}

export interface SceneAsset {
  id: string;
  url: string;
  /** Widest horizontal extent of the source export, in glTF units. Measured. */
  sourceWidthM: number;
  /** Diameter this island should occupy in the scene, in metres. */
  targetWidthM: number;
}

/*
 * Both dioramas are round floating islands about 1.9 units across as exported —
 * which would put a 1.7 m character nearly edge to edge and towering over the
 * scenery. They are scaled up to read as PLACES a person stands in: the stone
 * circle as an intimate plaza, the oasis larger because its palms need the
 * headroom to look like palms.
 */
export const SCENE_ASSETS = Object.freeze({
  'diorama-a': { id: 'diorama-a', url: assetUrl('diorama-a.glb'), sourceWidthM: 1.879, targetWidthM: 6.5 },
  'diorama-b': { id: 'diorama-b', url: assetUrl('diorama-b.glb'), sourceWidthM: 1.896, targetWidthM: 9.5 },
  // `satisfies` rather than an annotation: it validates each entry while
  // keeping the keys literal, so SCENE_ASSETS[id] is a SceneAsset and not
  // `SceneAsset | undefined` at every call site.
}) satisfies Record<string, SceneAsset>;

/** Uniform scale that brings an island to its target diameter. */
export function sceneScale(asset: SceneAsset): number {
  return asset.targetWidthM / asset.sourceWidthM;
}
