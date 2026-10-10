/*
 * Mouth shapes for speech, and the dictionary that turns written words in English, Spanish and Portuguese into them.
 * docs/design/AVATAR-SPEECH.md has the research behind the set and the rules.
 *
 * A viseme is how the mouth looks while a sound is made. Many sounds look the same from outside (p, b and m all close
 * the lips), so thirteen shapes plus rest cover the three languages. Each shape is four numbers the rig understands:
 * how far the jaw opens, how wide the mouth is, how much it puckers into an "o", and how firmly the lips press.
 *
 * `visemesFromText` makes a timeline from text. When a generated voice exists its own timing replaces it, because the
 * avatar accepts any `VisemeEvent[]`; see also `audioLipSync.ts` for driving the mouth from the audio itself.
 */
export interface MouthPose {
  open: number;
  wide: number;
  pucker: number;
  press: number;
}

export const VISEMES = {
  rest: { open: 0, wide: 1, pucker: 0, press: 0 },
  /** p b m: the lips close. */
  PP: { open: 0, wide: 0.95, pucker: 0, press: 1 },
  /** f v: the lower lip meets the upper teeth. */
  FF: { open: 0.12, wide: 1.05, pucker: 0, press: 0.35 },
  /** th: the tongue shows between the teeth. */
  TH: { open: 0.22, wide: 1.02, pucker: 0, press: 0 },
  /** t d n l (and the tongue-tip sounds): the teeth are slightly apart. */
  DD: { open: 0.28, wide: 1.05, pucker: 0, press: 0 },
  /** k g and the back-of-the-mouth sounds. */
  KK: { open: 0.34, wide: 0.95, pucker: 0, press: 0 },
  /** s z: the teeth are close and the lips spread. */
  SS: { open: 0.1, wide: 1.18, pucker: 0, press: 0 },
  /** ch sh j: the lips round and push forward. */
  CH: { open: 0.22, wide: 0.72, pucker: 0.5, press: 0 },
  /** r: a light rounding. */
  RR: { open: 0.26, wide: 0.86, pucker: 0.28, press: 0 },
  AA: { open: 1, wide: 1, pucker: 0, press: 0 },
  EE: { open: 0.55, wide: 1.18, pucker: 0, press: 0 },
  II: { open: 0.25, wide: 1.32, pucker: 0, press: 0 },
  OO: { open: 0.7, wide: 0.66, pucker: 0.55, press: 0 },
  UU: { open: 0.3, wide: 0.55, pucker: 0.9, press: 0 },
} as const satisfies Record<string, MouthPose>;

export type VisemeName = keyof typeof VISEMES;

export interface VisemeEvent {
  /** Seconds from the start of the speech. */
  at: number;
  viseme: VisemeName;
}

export type SpeechLanguage = 'en' | 'es' | 'pt';

/** A sound to show: its viseme and how long it lasts relative to a normal one. */
interface Sound { viseme: VisemeName; weight: number }

const vowel = (viseme: VisemeName, weight = 1): Sound => ({ viseme, weight });

const consonant = (viseme: VisemeName, weight = 1): Sound => ({ viseme, weight });

const VOWEL_VISEMES: ReadonlySet<VisemeName> = new Set(['AA', 'EE', 'II', 'OO', 'UU']);

const isVowelLetter = (character: string | undefined) => character !== undefined && 'aáàâãeéêèiíîoóôõuúü'.includes(character);

const isFrontVowel = (character: string | undefined) => character !== undefined && 'eéêiíy'.includes(character);

/** Letters in a word, with accents kept, in lower case. */
function lettersOf(word: string): string[] {
  return [...word.toLowerCase().normalize('NFC')];
}

/* ---------------------------------------------------------------- Spanish */

function spanishSounds(word: string): Sound[] {
  const l = lettersOf(word);
  const out: Sound[] = [];

  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    const next = l[i + 1];

    if (c === 'c' && next === 'h') { out.push(consonant('CH')); i++; continue; }

    if (c === 'l' && next === 'l') { out.push(consonant('II', 1.2)); i++; continue; }

    if (c === 'r' && next === 'r') { out.push(consonant('RR', 1.7)); i++; continue; }

    if (c === 'q' && next === 'u') { out.push(consonant('KK')); i++; continue; }

    if (c === 'g' && next === 'u' && isFrontVowel(l[i + 2])) { out.push(consonant('KK')); i++; continue; }

    switch (c) {
      case 'a': out.push(vowel('AA')); break;
      case 'á': out.push(vowel('AA', 1.3)); break;
      case 'e': out.push(vowel('EE')); break;
      case 'é': out.push(vowel('EE', 1.3)); break;
      case 'i': out.push(vowel('II')); break;
      case 'í': out.push(vowel('II', 1.3)); break;
      case 'o': out.push(vowel('OO')); break;
      case 'ó': out.push(vowel('OO', 1.3)); break;
      case 'u': case 'ü': case 'w': out.push(vowel('UU')); break;
      case 'ú': out.push(vowel('UU', 1.3)); break;
      case 'y': out.push(isVowelLetter(next) ? consonant('II') : vowel('II')); break;
      case 'b': case 'v': case 'p': case 'm': out.push(consonant('PP')); break;
      case 'f': out.push(consonant('FF')); break;
      case 's': case 'z': out.push(consonant('SS')); break;
      case 'c': out.push(consonant(isFrontVowel(next) ? 'SS' : 'KK')); break;
      case 'g': case 'j': case 'k': case 'q': out.push(consonant('KK')); break;
      case 'x': out.push(consonant('KK'), consonant('SS')); break;
      case 'ñ': out.push(consonant('II', 1.2)); break;
      case 'r': out.push(consonant('RR', 0.7)); break;
      case 't': case 'd': case 'n': case 'l': out.push(consonant('DD')); break;
      default: break;
    }
  }

  return out;
}

/* ------------------------------------------------------------- Portuguese */

function portugueseSounds(word: string): Sound[] {
  const l = lettersOf(word);
  const out: Sound[] = [];

  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    const next = l[i + 1];
    const last = i === l.length - 1;
    const front = isFrontVowel(next);

    if (c === 'n' && next === 'h') { out.push(consonant('II', 1.2)); i++; continue; }

    if (c === 'l' && next === 'h') { out.push(consonant('II', 1.2)); i++; continue; }

    if (c === 'c' && next === 'h') { out.push(consonant('CH')); i++; continue; }

    if (c === 's' && next === 's') { out.push(consonant('SS', 1.2)); i++; continue; }

    if (c === 'r' && next === 'r') { out.push(consonant('KK', 1.2)); i++; continue; }

    if (c === 'q' && next === 'u') { out.push(consonant('KK')); i++; continue; }

    if (c === 'g' && next === 'u' && isFrontVowel(l[i + 2])) { out.push(consonant('KK')); i++; continue; }

    // a nasal vowel: the m or n after it, before a consonant or at the end, only nasalizes it; the lips do not close
    if ((c === 'm' || c === 'n') && i > 0 && isVowelLetter(l[i - 1]) && (last || !isVowelLetter(next))) continue;

    switch (c) {
      case 'a': case 'â': out.push(vowel('AA', last ? 0.8 : 1)); break;
      case 'á': out.push(vowel('AA', 1.3)); break;
      case 'ã': out.push(vowel('AA', 1.25)); break;
      case 'e': out.push(last ? vowel('II', 0.7) : vowel('EE')); break;
      case 'é': case 'ê': out.push(vowel('EE', 1.3)); break;
      case 'i': out.push(vowel('II')); break;
      case 'í': out.push(vowel('II', 1.3)); break;
      case 'o': out.push(last ? vowel('UU', 0.8) : vowel('OO')); break;
      case 'ó': case 'ô': out.push(vowel('OO', 1.3)); break;
      case 'õ': out.push(vowel('OO', 1.25)); break;
      case 'u': case 'ü': case 'w': out.push(vowel('UU')); break;
      case 'ú': out.push(vowel('UU', 1.3)); break;
      case 'y': out.push(vowel('II')); break;
      case 'p': case 'b': case 'm': out.push(consonant('PP')); break;
      case 'f': case 'v': out.push(consonant('FF')); break;
      case 'ç': case 's': case 'z': out.push(consonant('SS')); break;
      case 'c': out.push(consonant(front ? 'SS' : 'KK')); break;
      case 'g': out.push(consonant(front ? 'CH' : 'KK')); break;
      case 'j': case 'x': out.push(consonant('CH')); break;
      case 'k': case 'q': out.push(consonant('KK')); break;
      case 'r': out.push(consonant(i === 0 ? 'KK' : 'RR', 0.7)); break;
      case 'l': out.push(last || !isVowelLetter(next) ? consonant('UU') : consonant('DD')); break;
      case 't': case 'd': out.push(consonant(next === 'i' ? 'CH' : 'DD')); break;
      case 'n': out.push(consonant('DD')); break;
      default: break;
    }
  }

  return out;
}

/* ---------------------------------------------------------------- English */

function englishSounds(word: string): Sound[] {
  const l = lettersOf(word);
  const out: Sound[] = [];
  const silentE = l.length > 3 && l[l.length - 1] === 'e' && !isVowelLetter(l[l.length - 2]);

  for (let i = 0; i < l.length; i++) {
    const c = l[i] ?? '';
    const next = l[i + 1];
    const pair = c + (next ?? '');

    if (silentE && i === l.length - 1) continue;

    if (pair + (l[i + 2] ?? '') === 'igh') { out.push(vowel('AA', 0.9), vowel('II', 0.7)); i += 2; continue; }

    if (pair === 'th') { out.push(consonant('TH', 1.1)); i++; continue; }

    if (pair === 'sh' || pair === 'ch') { out.push(consonant('CH')); i++; continue; }

    if (pair === 'ph') { out.push(consonant('FF')); i++; continue; }

    if (pair === 'wh') { out.push(consonant('UU')); i++; continue; }

    if (pair === 'ng' || pair === 'ck') { out.push(consonant('KK')); i++; continue; }

    if (pair === 'kn') { out.push(consonant('DD')); i++; continue; }

    if (pair === 'wr') { out.push(consonant('RR')); i++; continue; }

    if (pair === 'qu') { out.push(consonant('KK'), consonant('UU', 0.8)); i++; continue; }

    if (pair === 'ee' || pair === 'ea' || pair === 'ie') { out.push(vowel('II', 1.3)); i++; continue; }

    if (pair === 'oo') { out.push(vowel('UU', 1.3)); i++; continue; }

    if (pair === 'ou' || pair === 'ow') { out.push(vowel('AA', 0.9), vowel('UU', 0.7)); i++; continue; }

    if (pair === 'ai' || pair === 'ay' || pair === 'ei' || pair === 'ey') { out.push(vowel('EE'), vowel('II', 0.6)); i++; continue; }

    if (pair === 'oi' || pair === 'oy') { out.push(vowel('OO', 0.9), vowel('II', 0.7)); i++; continue; }

    if (pair === 'au' || pair === 'aw' || pair === 'oa') { out.push(vowel('OO', 1.2)); i++; continue; }

    switch (c) {
      case 'a': out.push(vowel('AA', 0.95)); break;
      case 'e': out.push(vowel('EE', 0.9)); break;
      case 'i': out.push(vowel('II')); break;
      case 'o': out.push(vowel('OO')); break;
      case 'u': out.push(vowel('AA', 0.7)); break;
      case 'y': out.push(isVowelLetter(next) ? consonant('II') : vowel('II')); break;
      case 'w': out.push(consonant('UU')); break;
      case 'b': case 'p': case 'm': out.push(consonant('PP')); break;
      case 'f': case 'v': out.push(consonant('FF')); break;
      case 's': case 'z': out.push(consonant('SS')); break;
      case 'c': out.push(consonant(isFrontVowel(next) ? 'SS' : 'KK')); break;
      case 'g': out.push(consonant(next === 'e' || next === 'i' ? 'CH' : 'KK')); break;
      case 'j': out.push(consonant('CH')); break;
      case 'k': case 'q': case 'x': out.push(consonant('KK')); break;
      case 'r': out.push(consonant('RR', 0.8)); break;
      case 't': case 'd': case 'n': case 'l': out.push(consonant('DD')); break;
      default: break;
    }
  }

  return out;
}

const SOUNDS: Record<SpeechLanguage, (word: string) => Sound[]> = { en: englishSounds, es: spanishSounds, pt: portugueseSounds };

/** The language to speak in when none is given: the page's own. */
export function pageSpeechLanguage(): SpeechLanguage {
  const lang = document.documentElement.lang.toLowerCase();

  if (lang.startsWith('es')) return 'es';

  if (lang.startsWith('pt')) return 'pt';

  return 'en';
}

export interface TextSpeechOptions {
  language?: SpeechLanguage;
  /** Speed multiplier; 1 is a calm speaking pace of about 11 sounds a second. */
  rate?: number;
  /** Stretch the whole timeline to this many seconds (the length of a recording of the same text). */
  duration?: number;
}

const VOWEL_SECONDS = 0.115;

const CONSONANT_SECONDS = 0.07;

const WORD_GAP = 0.05;

const COMMA = 0.22;

const STOP = 0.38;

/** A timeline for `text`: each sound gets its viseme at its time. */
export function visemesFromText(text: string, options: TextSpeechOptions = {}): VisemeEvent[] {
  const sounds = SOUNDS[options.language ?? pageSpeechLanguage()];
  const events: VisemeEvent[] = [];
  let at = 0;

  for (const piece of text.split(/(\s+|[,;:.!?¡¿…])/)) {
    if (!piece) continue;

    if (!piece.trim()) { at += WORD_GAP; continue; }

    if (/^[.!?¡¿…]$/.test(piece)) { events.push({ at, viseme: 'rest' }); at += STOP; continue; }

    if (/^[,;:]$/.test(piece)) { events.push({ at, viseme: 'rest' }); at += COMMA; continue; }

    for (const sound of sounds(piece)) {
      const base = VOWEL_VISEMES.has(sound.viseme) ? VOWEL_SECONDS : CONSONANT_SECONDS;

      events.push({ at, viseme: sound.viseme });
      at += Math.max(sound.viseme === 'PP' ? 0.085 : 0.05, base * sound.weight);
    }
  }

  events.push({ at, viseme: 'rest' });

  const scale = (options.duration && at > 0 ? options.duration / at : 1) / (options.duration ? 1 : options.rate ?? 1);

  return scale === 1 ? events : events.map((event) => ({ ...event, at: event.at * scale }));
}

/** The end of a timeline, in seconds. */
export function speechLength(events: VisemeEvent[]): number {
  return events.length ? events[events.length - 1]!.at : 0;
}
