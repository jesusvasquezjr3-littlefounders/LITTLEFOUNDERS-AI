import manifest from '../assets/manifest.json';

/** One row of the class B asset manifest. Class A rows are the system glyphs (glyphs.tsx). */
export interface ManifestAsset {
  id: string; class: string; type: string; path: string; slot: string; aspect?: string; modes: string;
  character?: string; poseId?: string; sourceModel?: string; background?: string; altKey: string; reviewStatus: string;
  /** A Lottie's reduced-motion still: the path of a registered SVG of the same slot. */
  staticFrame?: string; reviewFamily?: string;
}

/** The slot every Mentor avatar fills: square, transparent, a real-model render. */
export const MENTOR_AVATAR_SLOT = 'mentor.avatar';

export const MENTOR_CHARACTERS = ['rho', 'zara', 'liruf', 'dina'] as const;
export type MentorCharacter = typeof MENTOR_CHARACTERS[number];

/**
 * Each Mentor's own name (the learner's navigation shows the chosen
 * character's name). Proper nouns, identical in EN, es-MX and pt-BR, so they
 * are not translated; a surface never passes its own spelling.
 */
export const MENTOR_NAMES: Readonly<Record<MentorCharacter, string>> = { rho: 'Dr. Rho', zara: 'Zara', liruf: 'Liruf', dina: 'Dina' };

const assets = (manifest as readonly { class: string }[]).filter((row) => row.class === 'B') as unknown as readonly ManifestAsset[];

/** A manifest-registered class B asset that is not retired, or null. Never a free-form URL. */
export function resolveManifestAsset(id: string): ManifestAsset | null {
  const asset = assets.find((entry) => entry.id === id);
  return asset && asset.class === 'B' && asset.reviewStatus !== 'retired' ? asset : null;
}

/**
 * A Mentor avatar may only be a render of the real 3D model in a catalogue
 * pose: the manifest row must be a `render` of one of the
 * four characters, name that character's own model as its source, carry a pose
 * from the pose catalogue and fill the square, transparent avatar slot. A stage still with its scene behind it is not an avatar. Anything
 * else is refused; there is no letter, glyph or look-alike fallback.
 */
export function resolveMentorRender(id: string): (ManifestAsset & { character: MentorCharacter; poseId: string }) | null {
  const asset = resolveManifestAsset(id);
  if (!asset || asset.type !== 'render') return null;
  const character = asset.character as MentorCharacter | undefined;
  if (!character || !MENTOR_CHARACTERS.includes(character)) return null;
  if (asset.sourceModel !== `/scenes/${character}.glb`) return null;
  if (!asset.poseId) return null;
  if (asset.aspect !== '1:1' || asset.slot !== MENTOR_AVATAR_SLOT || asset.background !== 'transparent') return null;
  return { ...asset, character, poseId: asset.poseId };
}

/**
 * The avatar render of one Mentor character for a colour mode, or null when
 * that character has no avatar render (or only a retired one). Callers render
 * an empty slot, never a stand-in.
 */
export function findMentorAvatar(character: MentorCharacter, theme: 'light' | 'dark'): string | null {
  const match = assets.find((entry) => entry.type === 'render' && entry.character === character && entry.slot === MENTOR_AVATAR_SLOT
    && (entry.modes === theme || entry.modes === 'both') && resolveMentorRender(entry.id) !== null);
  return match?.id ?? null;
}

/**
 * The avatar render of one Mentor character in one catalogue pose for a colour
 * mode, or null when no such render is registered. Same refusals as
 * `resolveMentorRender`: square, transparent, the character's own model.
 * Callers fall back to `findMentorAvatar` (the idle render), never a stand-in.
 */
export function findMentorAvatarInPose(character: MentorCharacter, theme: 'light' | 'dark', poseId: string): string | null {
  const match = assets.find((entry) => entry.type === 'render' && entry.character === character && entry.slot === MENTOR_AVATAR_SLOT
    && entry.poseId === poseId && (entry.modes === theme || entry.modes === 'both') && resolveMentorRender(entry.id) !== null);
  return match?.id ?? null;
}
