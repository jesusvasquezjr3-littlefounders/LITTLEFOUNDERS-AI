/*
 * Mouth shapes for speech. A viseme is how the mouth looks while a sound is made; a few cover the three interface
 * languages (English, Spanish, Portuguese). Each is an opening (0 closed, 1 wide open) and a width multiplier that
 * the rig applies to the avatar's mouth.
 *
 * `visemesFromText` makes a timeline from written text, so the mouth can move when there is no audio yet. When the
 * generated voice exists (not decided, see docs/design/CHARACTER-AVATARS.md) its own timing replaces this: the avatar
 * accepts any `VisemeEvent[]`.
 */
export const VISEMES = {
  rest: { open: 0, wide: 1 },
  aa: { open: 0.95, wide: 1 },
  ee: { open: 0.4, wide: 1.2 },
  oh: { open: 0.75, wide: 0.64 },
  oo: { open: 0.4, wide: 0.52 },
  mm: { open: 0.02, wide: 0.95 },
  ff: { open: 0.16, wide: 1.05 },
  ss: { open: 0.14, wide: 1.12 },
} as const;

export type VisemeName = keyof typeof VISEMES;

export interface VisemeEvent {
  /** Seconds from the start of the speech. */
  at: number;
  viseme: VisemeName;
}

const LETTER_GROUPS: readonly (readonly [string, VisemeName])[] = [
  ['aáàãâ', 'aa'], ['eéêiíy', 'ee'], ['oóôõg', 'oh'], ['uúüwq', 'oo'], ['mbp', 'mm'], ['fv', 'ff'], ['szcçx', 'ss'],
  ['tdnlrjñ', 'ee'], ['k', 'oh'], ['h', 'rest'],
];

const BY_LETTER = new Map<string, VisemeName>(LETTER_GROUPS.flatMap(([letters, viseme]) => [...letters].map((letter): [string, VisemeName] => [letter, viseme])));

const VOWELS = new Set('aáàãâeéêiíyoóôõuúüw');

const PAUSES = new Set(',;:');

const STOPS = new Set('.!?¡¿');

/** A timeline for `text`, at about `rate` letters per second (default 13, a calm speaking pace). */
export function visemesFromText(text: string, rate = 13): VisemeEvent[] {
  const events: VisemeEvent[] = [];
  const step = 1 / rate;
  let at = 0;

  for (const character of text.toLowerCase()) {
    if (STOPS.has(character)) { events.push({ at, viseme: 'rest' }); at += step * 4; continue; }

    if (PAUSES.has(character)) { events.push({ at, viseme: 'rest' }); at += step * 2.2; continue; }

    if (character === ' ') { events.push({ at, viseme: 'rest' }); at += step * 0.7; continue; }

    const viseme = BY_LETTER.get(character);

    if (!viseme) continue;

    events.push({ at, viseme });
    at += VOWELS.has(character) ? step * 1.45 : step * 0.8;
  }

  events.push({ at, viseme: 'rest' });

  return events;
}

/** The end of a timeline, in seconds. */
export function speechLength(events: VisemeEvent[]): number {
  return events.length ? events[events.length - 1]!.at : 0;
}
