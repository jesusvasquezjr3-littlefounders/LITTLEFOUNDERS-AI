/*
 * Stored avatar option catalogue, retained for the Core profile wire contract.
 * The editor draws only our manifest-registered parts through CartoonAvatar.
 * Stored colour identifiers are hexadecimal values without '#'; they select
 * proprietary assets rather than defining the rendered palette.
 */

export interface AvatarOptions {
  top?: string[];
  hairColor?: string[];
  skinColor?: string[];
  eyes?: string[];
  eyebrows?: string[];
  mouth?: string[];
  facialHair?: string[];
  facialHairProbability?: number;
  clothing?: string[];
  clothesColor?: string[];
  accessories?: string[];
  accessoriesProbability?: number;
}

export const AVATAR_CATALOG = {
  skinColor: ['ffdbb4', 'edb98a', 'fd9841', 'd08b5b', 'ae5d29', '614335'],
  top: [
    'shortFlat',
    'shortWaved',
    'shortCurly',
    'theCaesar',
    'sides',
    'curly',
    'fro',
    'bob',
    'bun',
    'longButNotTooLong',
    'straight02',
    'bigHair',
    'dreads',
    'winterHat1',
    'hijab',
    'turban',
  ],
  hairColor: ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'c93305', 'e8e1e1'],
  eyes: ['default', 'happy', 'wink', 'hearts', 'surprised', 'squint', 'side', 'closed'],
  eyebrows: ['default', 'defaultNatural', 'raisedExcited', 'raisedExcitedNatural', 'upDown', 'flatNatural'],
  mouth: ['smile', 'default', 'twinkle', 'tongue', 'serious', 'eating'],
  facialHair: ['beardLight', 'beardMedium', 'beardMajestic', 'moustacheFancy', 'moustacheMagnum'],
  clothing: [
    'hoodie',
    'shirtCrewNeck',
    'shirtVNeck',
    'shirtScoopNeck',
    'graphicShirt',
    'collarAndSweater',
    'blazerAndShirt',
    'blazerAndSweater',
    'overall',
  ],
  clothesColor: ['65c9ff', '5199e4', '25557c', 'ff5c5c', 'ff488e', 'ffafb9', 'ffffb1', 'a7ffc4', '929598', '262e33'],
  accessories: ['round', 'prescription01', 'prescription02', 'wayfarers', 'sunglasses', 'kurt'],
} as const;

export type CatalogKey = keyof typeof AVATAR_CATALOG;

/** Sensible starter look (used when a user has never saved an avatar). */
export function defaultAvatarOptions(seed: string): AvatarOptions & { seed: string } {
  return { seed, facialHairProbability: 0, accessoriesProbability: 0 };
}

export function randomAvatarOptions(): AvatarOptions {
  const pick = <T>(arr: readonly T[]): T[] => [arr[Math.floor(Math.random() * arr.length)]!];
  const chance = (p: number) => (Math.random() < p ? 100 : 0);
  return {
    skinColor: pick(AVATAR_CATALOG.skinColor),
    top: pick(AVATAR_CATALOG.top),
    hairColor: pick(AVATAR_CATALOG.hairColor),
    eyes: pick(AVATAR_CATALOG.eyes),
    eyebrows: pick(AVATAR_CATALOG.eyebrows),
    mouth: pick(AVATAR_CATALOG.mouth),
    facialHair: pick(AVATAR_CATALOG.facialHair),
    facialHairProbability: chance(0.25),
    clothing: pick(AVATAR_CATALOG.clothing),
    clothesColor: pick(AVATAR_CATALOG.clothesColor),
    accessories: pick(AVATAR_CATALOG.accessories),
    accessoriesProbability: chance(0.3),
  };
}
