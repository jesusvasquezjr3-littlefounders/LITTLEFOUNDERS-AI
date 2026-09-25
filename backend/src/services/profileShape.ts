import { z } from 'zod';

/*
 * E.12 standing guardrail: a profile's picture is a cartoon, never an image.
 *
 * The avatar is a closed DiceBear Avataaars option set rendered on the
 * viewer's device, and the cover is one of ten token-gradient presets. No
 * image, URL or free text is ever stored or served in either field.
 *
 * This file is the Core half of a three-part guard (policy:
 * docs/rebuild/policies/SOCIAL-GOVERNANCE.md §4):
 *   1. writes: the two routes accept only these shapes (below);
 *   2. the database refuses any other shape from every writer, including a
 *      direct browser write through the own-row policies
 *      (avatar_options_valid / profile_cover_valid, migration
 *      social_standing_guardrails);
 *   3. reads: a legacy row written before that guard is never served as
 *      stored. Every surface that returns an avatar or a cover passes it
 *      through `projectAvatarOptions` / `projectCover`, so an off-schema row
 *      becomes the default cartoon, not a link or a picture.
 *
 * `guardrails:check` compares the key lists and the patterns with the SQL
 * function literally. Adding a key here without the database (or the
 * reverse) fails that gate; adding an image-like key needs the full
 * child-safety re-review the policy describes, not a code change.
 */

/** Array-valued DiceBear options, in the order the SQL function lists them. */
export const AVATAR_ARRAY_KEYS = ['top', 'hairColor', 'skinColor', 'eyes', 'eyebrows', 'mouth', 'facialHair', 'clothing', 'clothesColor', 'accessories'] as const;
/** Integer percentages 0-100. */
export const AVATAR_NUMBER_KEYS = ['facialHairProbability', 'accessoriesProbability'] as const;
export const AVATAR_SEED_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const AVATAR_VALUE_PATTERN = /^[A-Za-z0-9]{1,40}$/;
export const AVATAR_MAX_VALUES = 3;

export const COVER_PRESETS = ['aurora', 'sunset', 'ocean', 'forest', 'candy', 'ember', 'midnight', 'mint', 'grape', 'dawn'] as const;
export type CoverPreset = (typeof COVER_PRESETS)[number];

const OptionValue = z.array(z.string().regex(AVATAR_VALUE_PATTERN)).max(AVATAR_MAX_VALUES);
const Percent = z.number().int().min(0).max(100);

const avatarShape: Record<string, z.ZodTypeAny> = { seed: z.string().regex(AVATAR_SEED_PATTERN).optional() };
for (const key of AVATAR_ARRAY_KEYS) avatarShape[key] = OptionValue.optional();
for (const key of AVATAR_NUMBER_KEYS) avatarShape[key] = Percent.optional();

/** The only avatar a writer may store and a reader may receive. */
export const AvatarOptions = z.object(avatarShape).strict();
export type AvatarOptions = Record<string, unknown>;

export const CoverBody = z.object({ preset: z.enum(COVER_PRESETS) }).strict();

/** A stored avatar as it may be served: valid, or the default cartoon ({}). */
export function projectAvatarOptions(stored: unknown): AvatarOptions {
  const parsed = AvatarOptions.safeParse(stored);
  return parsed.success ? (parsed.data as AvatarOptions) : {};
}

/** A stored cover as it may be served: one preset, or none ({}). */
export function projectCover(stored: unknown): { preset?: CoverPreset } {
  const parsed = CoverBody.safeParse(stored);
  return parsed.success ? { preset: parsed.data.preset } : {};
}
