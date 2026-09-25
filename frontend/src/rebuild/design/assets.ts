import manifest from '../assets/manifest.json';

/** One row of the class B asset manifest (Frontend Bible 07 §6). */
export interface ManifestAsset {
  id: string; class: string; type: string; path: string; slot: string; aspect?: string; modes: string;
  character?: string; poseId?: string; sourceModel?: string; altKey: string; reviewStatus: string;
}

export const MENTOR_CHARACTERS = ['rho', 'zara', 'liruf', 'dina'] as const;
export type MentorCharacter = typeof MENTOR_CHARACTERS[number];

const assets = manifest as readonly ManifestAsset[];

/** A manifest-registered class B asset that is not retired, or null. Never a free-form URL. */
export function resolveManifestAsset(id: string): ManifestAsset | null {
  const asset = assets.find((entry) => entry.id === id);
  return asset && asset.class === 'B' && asset.reviewStatus !== 'retired' ? asset : null;
}

/**
 * A Mentor avatar may only be a render of the real 3D model in a catalogue
 * pose (02 rule 21, 07 §4): the manifest row must be a `render` of one of the
 * four characters, name that character's own model as its source, carry a pose
 * from the pose catalogue and fill a square slot. Anything else is refused;
 * there is no letter, glyph or look-alike fallback.
 */
export function resolveMentorRender(id: string): (ManifestAsset & { character: MentorCharacter; poseId: string }) | null {
  const asset = resolveManifestAsset(id);
  if (!asset || asset.type !== 'render') return null;
  const character = asset.character as MentorCharacter | undefined;
  if (!character || !MENTOR_CHARACTERS.includes(character)) return null;
  if (asset.sourceModel !== `/scenes/${character}.glb`) return null;
  // Catalogue membership of the pose is enforced on the manifest itself by
  // scripts/check-rebuild-assets.mjs (spec:check and every release build).
  if (!asset.poseId) return null;
  if (asset.aspect !== '1:1') return null;
  return { ...asset, character, poseId: asset.poseId };
}
