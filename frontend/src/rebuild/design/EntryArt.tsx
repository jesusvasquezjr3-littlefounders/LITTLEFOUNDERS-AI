import { resolveManifestAsset } from './assets';

/** Decorative, original entry-flow illustration. It never communicates an action or consent state. */
export function EntryArt() {
  const asset = resolveManifestAsset('identity.garden');
  if (!asset) return null;
  return <img className="lf-entry-art" src="/rebuild/identity/ideas-garden.webp" alt="" aria-hidden="true"
    width={960} height={877} decoding="async" data-asset-id={asset.id} />;
}
