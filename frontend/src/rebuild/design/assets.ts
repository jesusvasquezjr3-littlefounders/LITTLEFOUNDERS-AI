import manifest from '../assets/manifest.json';

/** One row of the class B asset manifest. Class A rows are the system glyphs (glyphs.tsx). */
export interface ManifestAsset {
  id: string; class: string; type: string; path: string; slot: string; aspect?: string; modes: string;
  altKey: string; reviewStatus: string;
}

const assets = (manifest as readonly { class: string }[]).filter((row) => row.class === 'B') as unknown as readonly ManifestAsset[];

/** A manifest-registered class B asset that is not retired, or null. Never a free-form URL. */
export function resolveManifestAsset(id: string): ManifestAsset | null {
  const asset = assets.find((entry) => entry.id === id);
  return asset && asset.class === 'B' && asset.reviewStatus !== 'retired' ? asset : null;
}
