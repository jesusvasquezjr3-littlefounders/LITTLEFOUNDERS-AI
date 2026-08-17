import { describe, expect, it } from 'vitest';
import { CHARACTER_ASSETS, SCENE_ASSETS, characterFootprintM, characterScale } from './assets';
import manifest from './sceneManifest.generated.json';

/*
 * Depot is CONTENT-ADDRESSED — `/files/:bucket/:hash.:ext`, "independent of the
 * uploader's original filename" — so a deployed build cannot ask it for
 * `rho.glb`. Setting VITE_SCENE_ASSET_BASE alone would 404 every asset, which
 * is what "the deploy is blocked only on credentials" got wrong.
 *
 * These pin the shape both halves depend on. The resolver itself reads
 * `import.meta.env` at module load, so its two branches are covered by the
 * manifest contract below rather than by re-importing with a mutated env.
 */
describe('the published scene manifest', () => {
  it('names the bucket Depot actually serves the scenes from', () => {
    expect(manifest.bucket).toBe('tutor-scenes');
  });

  it('maps logical paths to HASHED names, never back to the original filename', () => {
    // A manifest that mapped `rho.glb` to `rho.glb` would look published and
    // 404 in production — the failure this file exists to make impossible.
    for (const [logical, served] of Object.entries(manifest.files as Record<string, string>)) {
      expect(served).not.toBe(logical);
      expect(served).toMatch(/^[0-9a-f]{8,}\.(glb|png)$/);
    }
  });

  it('is empty until someone publishes, rather than half-filled', () => {
    // Dev serves by filename and ignores this. A PARTIAL manifest is the
    // dangerous state: some assets resolve, others throw mid-scene.
    const entries = Object.keys(manifest.files as Record<string, string>);
    if (entries.length === 0) return;
    for (const id of Object.keys(CHARACTER_ASSETS)) {
      expect(entries).toContain(`${id}.glb`);
    }
    for (const id of Object.keys(SCENE_ASSETS)) {
      expect(entries).toContain(`${id}.glb`);
    }
    expect(entries).toContain('clips-biped.glb');
  });
});

describe('character measurements', () => {
  it('scales every character to the height it was decided at', () => {
    for (const asset of Object.values(CHARACTER_ASSETS)) {
      expect(asset.sourceHeightM * characterScale(asset)).toBeCloseTo(asset.targetHeightM, 5);
    }
  });

  it('makes Dina the largest of the cast', () => {
    // Owner correction 2026-08-16. She was 0.70 m — "large-dog sized" — which
    // was a guess nobody made deliberately.
    const dina = CHARACTER_ASSETS.dina.targetHeightM;
    for (const [id, asset] of Object.entries(CHARACTER_ASSETS)) {
      if (id === 'dina') continue;
      expect(dina).toBeGreaterThan(asset.targetHeightM);
    }
  });

  it('measures footprint per character rather than deriving it from height', () => {
    /*
     * Liruf's tail makes him longer than he is tall while Rho is about half as
     * wide as he is tall. Placement uses this: at a flat 1.3 m separation Dina
     * stood straight through Liruf, however flat the ground under each scored.
     */
    expect(characterFootprintM(CHARACTER_ASSETS.liruf)).toBeGreaterThan(
      CHARACTER_ASSETS.liruf.targetHeightM,
    );
    expect(characterFootprintM(CHARACTER_ASSETS.rho)).toBeLessThan(
      CHARACTER_ASSETS.rho.targetHeightM,
    );
    expect(characterFootprintM(CHARACTER_ASSETS.dina)).toBeGreaterThan(2.5);
  });
});
