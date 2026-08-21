import type { CharacterId } from '@/components/characters/control/types';
import manifest from './sceneManifest.generated.json';
import {
  CHARACTER_MEASUREMENTS,
  SCENE_MEASUREMENTS,
  type CharacterMeasurement,
  type SceneMeasurement,
} from './measurements';

/*
 * The Tutor's 3D asset manifest — WHERE the models are served from.
 *
 * WHAT they are (heights, footprints, island diameters) lives in
 * `measurements.ts`, which imports nothing and can therefore be read by a
 * headless script. This module adds URLs on top, and reading a URL requires
 * `import.meta.env`, which only exists under Vite. Keeping the two apart is why
 * `scripts/verify-placement.ts` can run the real placement solver against the
 * real islands with no bundler and no browser.
 */

export {
  characterFootprintM,
  characterScale,
  sceneScale,
  type CharacterMeasurement,
  type SceneMeasurement,
} from './measurements';

/*
 * Assets are served from `/scenes` in development (frontend/public/scenes, a
 * gitignored build output of `npm run assets:3d`) and from Depot's public
 * `tutor-scenes` bucket in deployed environments. Depot serves world-readable,
 * PII-free generated media directly to the browser by design (/AGENTS.md §1.5),
 * which is exactly what these are.
 */
const ASSET_BASE = import.meta.env.VITE_SCENE_ASSET_BASE ?? '/scenes';

/** Where scene media is served from. */
export const SCENE_ASSET_BASE = ASSET_BASE;

/**
 * Whether the assets are being served by Depot rather than by Vite's dev server.
 */
const PUBLISHED = Boolean(import.meta.env.VITE_SCENE_ASSET_BASE);

/**
 * DEPOT IS CONTENT-ADDRESSED, and that changes how every URL here is built.
 *
 * Its download route is `/files/:bucket/:hash.:ext`, and the README is explicit
 * that the extension mapping is "independent of the uploader's original
 * filename". So a deployed build cannot ask Depot for `rho.glb`; it has to ask
 * for the sha256 the bytes hashed to. Setting `VITE_SCENE_ASSET_BASE` alone
 * would 404 every asset — which is exactly what "the only blocker is
 * credentials" got wrong.
 *
 * `scripts/publish-scenes.mjs` uploads each file and records the name Depot
 * serves it under. The manifest holds only the hashed filenames, never the
 * host: the host is per-environment and belongs in the env var.
 */
const MANIFEST: Readonly<Record<string, string>> = manifest.files;

/**
 * Resolves a scene asset's logical path — `rho.glb`, `mouth/rho.png` — to the
 * URL it is actually served from.
 *
 * Throws when a deployed build asks for something that was never published.
 * `TutorPage` wraps the scene in an error boundary, so this surfaces as the
 * "could not load" panel plus a named asset in the console, rather than as a
 * character silently missing from the island.
 */
export function sceneAssetUrl(logicalPath: string): string {
  if (!PUBLISHED) return `${ASSET_BASE}/${logicalPath}`;
  const published = MANIFEST[logicalPath];
  if (!published) {
    throw new Error(
      `scene asset "${logicalPath}" is not in sceneManifest.generated.json. ` +
        'Run `npm run publish:scenes` against Depot and commit the manifest.',
    );
  }
  return `${ASSET_BASE}/${published}`;
}

function assetUrl(file: string): string {
  return sceneAssetUrl(file);
}

export interface CharacterAsset extends CharacterMeasurement {
  url: string;
}

export const CHARACTER_ASSETS: Readonly<Record<CharacterId, CharacterAsset>> = Object.freeze(
  Object.fromEntries(
    Object.entries(CHARACTER_MEASUREMENTS).map(([id, measurement]) => [
      id,
      { ...measurement, url: assetUrl(`${id}.glb`) },
    ]),
  ) as Record<CharacterId, CharacterAsset>,
);

export interface SceneAsset extends SceneMeasurement {
  url: string;
}

export const SCENE_ASSETS = Object.freeze(
  Object.fromEntries(
    Object.entries(SCENE_MEASUREMENTS).map(([id, measurement]) => [
      id,
      { ...measurement, url: assetUrl(`${id}.glb`) },
    ]),
    // `as` rather than an annotation: it keeps the keys literal, so
    // SCENE_ASSETS[id] is a SceneAsset and not `SceneAsset | undefined` at
    // every call site.
  ) as Record<keyof typeof SCENE_MEASUREMENTS, SceneAsset>,
);
