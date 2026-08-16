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
 *   dina  — QUADRUPED baby dinosaur, and the one true outlier: exported in
 *           Unreal's unit scale (0.028 tall, 0.042 long — deeper than tall,
 *           which is what gave the quadruped away). Set to 0.70 m at the
 *           shoulder, making her ~1.05 m long: large-dog sized beside a 1.7 m
 *           human, which is what a baby dino companion should read as.
 */
export const CHARACTER_ASSETS: Readonly<Record<CharacterId, CharacterAsset>> = Object.freeze({
  dina: { id: 'dina', url: assetUrl('dina.glb'), sourceHeightM: 0.028, targetHeightM: 0.7 },
  liruf: { id: 'liruf', url: assetUrl('liruf.glb'), sourceHeightM: 1.647, targetHeightM: 1.647 },
  rho: { id: 'rho', url: assetUrl('rho.glb'), sourceHeightM: 1.7, targetHeightM: 1.7 },
  zara: { id: 'zara', url: assetUrl('zara.glb'), sourceHeightM: 1.61, targetHeightM: 1.61 },
});

/** Uniform scale that brings a character to its target height. */
export function characterScale(asset: CharacterAsset): number {
  return asset.targetHeightM / asset.sourceHeightM;
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
