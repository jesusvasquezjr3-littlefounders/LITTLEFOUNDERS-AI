/*
 * THE CARTOON AVATAR, AS DATA (E.12, S08.7; Frontend Bible 07 §1, §3).
 *
 * A profile picture is a closed set of cartoon options, never an image: Core
 * (`backend/src/services/profileShape.ts`) and the database accept nothing
 * else. What is stored stays exactly as it was (OD-9); only the drawing is
 * ours. The rebuilt frontend never imports an avatar pack (the asset gate
 * refuses DiceBear in `src/rebuild/`): the parts are our own SVG, registered
 * in the manifest (`public/rebuild/avatar/*.svg`), and this file decides
 * which part to draw for a stored option set.
 *
 * The option lists mirror the editor's catalogue in `lib/avatarOptions.ts`
 * (hand-mirrored, as every wire shape in this repository is; the parity test
 * in `routes/app/profile/__tests__/avatarKitParity.test.ts` fails on drift).
 * A stored value outside the catalogue (Core accepts any short alphanumeric
 * value, and a legacy row may hold one) draws the default part instead of
 * nothing, and is kept as it is until the person saves a new look.
 */

export const AVATAR_PARTS = {
  skinColor: ['ffdbb4', 'edb98a', 'fd9841', 'd08b5b', 'ae5d29', '614335'],
  top: ['shortFlat', 'shortWaved', 'shortCurly', 'theCaesar', 'sides', 'curly', 'fro', 'bob', 'bun', 'longButNotTooLong', 'straight02', 'bigHair', 'dreads', 'winterHat1', 'hijab', 'turban'],
  hairColor: ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'c93305', 'e8e1e1'],
  eyes: ['default', 'happy', 'wink', 'hearts', 'surprised', 'squint', 'side', 'closed'],
  eyebrows: ['default', 'defaultNatural', 'raisedExcited', 'raisedExcitedNatural', 'upDown', 'flatNatural'],
  mouth: ['smile', 'default', 'twinkle', 'tongue', 'serious', 'eating'],
  facialHair: ['beardLight', 'beardMedium', 'beardMajestic', 'moustacheFancy', 'moustacheMagnum'],
  clothing: ['hoodie', 'shirtCrewNeck', 'shirtVNeck', 'shirtScoopNeck', 'graphicShirt', 'collarAndSweater', 'blazerAndShirt', 'blazerAndSweater', 'overall'],
  clothesColor: ['65c9ff', '5199e4', '25557c', 'ff5c5c', 'ff488e', 'ffafb9', 'ffffb1', 'a7ffc4', '929598', '262e33'],
  accessories: ['round', 'prescription01', 'prescription02', 'wayfarers', 'sunglasses', 'kurt'],
} as const;

export type AvatarPart = keyof typeof AVATAR_PARTS;
export type AvatarValue<P extends AvatarPart> = (typeof AVATAR_PARTS)[P][number];

/** Parts that may be switched off entirely ("None"), with the stored percentage that switches them. */
export const OPTIONAL_PARTS = { facialHair: 'facialHairProbability', accessories: 'accessoriesProbability' } as const;
export type OptionalPart = keyof typeof OPTIONAL_PARTS;

/** The editor's order: how a person builds a face, top to bottom, then clothes. */
export const EDITOR_PARTS: readonly AvatarPart[] = ['skinColor', 'top', 'hairColor', 'eyes', 'eyebrows', 'mouth', 'facialHair', 'clothing', 'clothesColor', 'accessories'];
/** The parts that are a colour, shown as swatches rather than as small portraits. */
export const COLOUR_PARTS: readonly AvatarPart[] = ['skinColor', 'hairColor', 'clothesColor'];

/** A stored option set, as Core serves it (`projectAvatarOptions`): unknown keys never arrive. */
export type StoredAvatar = Record<string, unknown>;

/** Everything the drawing needs, every part resolved to one catalogue value (`null` = switched off). */
export interface AvatarLook {
  skinColor: AvatarValue<'skinColor'>;
  top: AvatarValue<'top'>;
  hairColor: AvatarValue<'hairColor'>;
  eyes: AvatarValue<'eyes'>;
  eyebrows: AvatarValue<'eyebrows'>;
  mouth: AvatarValue<'mouth'>;
  facialHair: AvatarValue<'facialHair'> | null;
  clothing: AvatarValue<'clothing'>;
  clothesColor: AvatarValue<'clothesColor'>;
  accessories: AvatarValue<'accessories'> | null;
}

/** FNV-1a: a stable number from the account's seed, so an unsaved avatar looks the same on every device. Not a draw. */
function hash(text: string, salt: string): number {
  let value = 0x811c9dc5;
  for (const char of `${salt}:${text}`) {
    value ^= char.codePointAt(0)!;
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

function stableChoice<P extends AvatarPart>(part: P, seed: string): AvatarValue<P> {
  const values = AVATAR_PARTS[part];
  return values[hash(seed, part) % values.length] as AvatarValue<P>;
}

function storedChoice<P extends AvatarPart>(stored: StoredAvatar, part: P): AvatarValue<P> | undefined {
  const value = stored[part];
  if (!Array.isArray(value)) return undefined;
  const values = AVATAR_PARTS[part] as readonly string[];
  return value.find((entry): entry is AvatarValue<P> => typeof entry === 'string' && values.includes(entry));
}

/**
 * The look to draw for a stored option set. Anything missing or outside the
 * catalogue falls back to a stable default derived from the seed (the stored
 * `seed`, else the account id), never to a blank or a broken picture. An
 * optional part is drawn only when its stored percentage is 50 or more (the
 * editor stores 0 or 100).
 */
export function resolveLook(stored: StoredAvatar, fallbackSeed: string): AvatarLook {
  const seed = typeof stored.seed === 'string' && stored.seed ? stored.seed : fallbackSeed;
  const pick = <P extends AvatarPart>(part: P) => storedChoice(stored, part) ?? stableChoice(part, seed);
  const optional = <P extends OptionalPart>(part: P) => {
    const percent = stored[OPTIONAL_PARTS[part]];
    return typeof percent === 'number' && percent >= 50 ? pick(part) : null;
  };
  return {
    skinColor: pick('skinColor'), top: pick('top'), hairColor: pick('hairColor'), eyes: pick('eyes'), eyebrows: pick('eyebrows'),
    mouth: pick('mouth'), facialHair: optional('facialHair'), clothing: pick('clothing'), clothesColor: pick('clothesColor'),
    accessories: optional('accessories'),
  };
}

/**
 * The option set to store for a look: one value per part, and 0 or 100 for
 * the optional parts. Exactly the closed shape Core accepts (`AvatarOptions`).
 * The seed is kept when the stored set had one.
 */
export function lookToStored(look: AvatarLook, seed?: string): StoredAvatar {
  const stored: StoredAvatar = {
    skinColor: [look.skinColor], top: [look.top], hairColor: [look.hairColor], eyes: [look.eyes], eyebrows: [look.eyebrows],
    mouth: [look.mouth], clothing: [look.clothing], clothesColor: [look.clothesColor],
    facialHairProbability: look.facialHair ? 100 : 0, accessoriesProbability: look.accessories ? 100 : 0,
  };
  if (look.facialHair) stored.facialHair = [look.facialHair];
  if (look.accessories) stored.accessories = [look.accessories];
  if (seed && /^[A-Za-z0-9_-]{1,64}$/.test(seed)) stored.seed = seed;
  return stored;
}

/** Changes one part of a look; choosing an optional part switches it on. */
export function withPart(look: AvatarLook, part: AvatarPart, value: string | null): AvatarLook {
  const values = AVATAR_PARTS[part] as readonly string[];
  if (value !== null && !values.includes(value)) return look;
  if (value === null && !(part in OPTIONAL_PARTS)) return look;
  return { ...look, [part]: value };
}

/*
 * The registered sprite files (07 §6: one manifest row each). Every part is a
 * `<g id>` drawn on one 200 x 200 grid, coloured through CSS variables so the
 * same file works in both modes (07 §3.1): `--lf-avatar-skin`,
 * `--lf-avatar-hair` and `--lf-avatar-clothes` carry the person's choices,
 * and ink, white and the tokens come from the page.
 */
export const AVATAR_SPRITES = {
  body: '/rebuild/avatar/body.svg',
  hair: '/rebuild/avatar/hair.svg',
  face: '/rebuild/avatar/face.svg',
  extras: '/rebuild/avatar/extras.svg',
} as const;

/** The layers of one look, bottom to top, as sprite references. */
export function avatarLayers(look: AvatarLook): string[] {
  const { body, hair, face, extras } = AVATAR_SPRITES;
  const layers = [
    `${hair}#top-${look.top}-back`,
    `${body}#neck`,
    `${body}#clothing-${look.clothing}`,
    `${body}#head`,
    `${face}#eyes-${look.eyes}`,
    `${face}#eyebrows-${look.eyebrows}`,
  ];
  // A beard sits under the mouth; a moustache sits above it without covering it.
  if (look.facialHair) layers.push(`${extras}#facialHair-${look.facialHair}`);
  layers.push(`${face}#mouth-${look.mouth}`, `${hair}#top-${look.top}-front`);
  if (look.accessories) layers.push(`${extras}#accessories-${look.accessories}`);
  return layers;
}

/* ---------------------------------------------------------------- covers */

/** E.12: the ten cover presets (Core `COVER_PRESETS`, the SQL guard and `lib/coverPresets.ts`; `social:check` compares them). */
export const COVER_IDS = ['aurora', 'sunset', 'ocean', 'forest', 'candy', 'ember', 'midnight', 'mint', 'grape', 'dawn'] as const;
export type CoverId = (typeof COVER_IDS)[number];
export const DEFAULT_COVER: CoverId = 'aurora';
export const COVER_SPRITE = '/rebuild/avatar/covers.svg';

/** The preset a stored cover names, or the default (Core serves `{}` when none is set). */
export function resolveCover(stored: unknown): CoverId {
  const preset = (stored as { preset?: unknown } | null)?.preset;
  return (COVER_IDS as readonly unknown[]).includes(preset) ? preset as CoverId : DEFAULT_COVER;
}
