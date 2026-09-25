// B.11 — mentors model flawed, human decisions (Forge gate 15).
//
// "Require a minimum proportion of story content per course — proposed
// starting point: at least one such episode per course, flagged for
// content-team validation — to show a mentor making and recovering from a real
// financial misjudgment, narrated with the same no-shame framing mandated for
// learner mistakes." Appendix C: the metric is Mentor-Misjudgment Content
// Coverage (100% of courses at or above the minimum), and the Stage 3 reviewer
// judges whether the fallibility is real.
//
// What a machine can check, and does:
//   catalog  — episodes are declared on the lesson blueprint
//              (`mentor_misjudgment`: character, misjudgment, recovery). A
//              course below the minimum blocks release; every declared episode
//              is a Stage 3 review item (content-team validation), never
//              accepted silently.
//   document — the generated episode really stages it: the named mentor is in
//              the cast and speaks in at least two moments (the misjudgment and
//              the recovery), and no line carries self-global shame language
//              ("I'm so stupid", "soy un desastre", "sou burro"). The judgement
//              that the misjudgment is real and the recovery is honest stays
//              with the Stage 3 reviewer.

import { foldText, hasTerm } from './text.js';
import type { ContentLocale } from './budgets.js';

/** The SPEC's proposed starting point, recalibrated through the Threshold Recalibration Log. */
export const MIN_MISJUDGMENT_EPISODES_PER_COURSE = 1;
/** One moment for the misjudgment, one for the recovery. */
export const MIN_EPISODE_VOICED_MOMENTS = 2;

export type MentorId = 'dina' | 'liruf' | 'rho' | 'zara';

export interface MisjudgmentPolicy {
  character: MentorId;
  misjudgment: string;
  recovery: string;
}

/**
 * Self-global shame language (Appendix B §1.8/§2.8: feedback is scoped to the
 * action, never to the person). A mentor's mistake is narrated the same way a
 * learner's is: "I forgot to count the bag", never "I'm so stupid". Folded
 * (no accents, lower case), matched at word boundaries. Only self- or
 * person-directed labels: "a costly mistake" describes the decision and is fine.
 */
export const SHAME_LEXICON: Readonly<Record<ContentLocale, readonly string[]>> = {
  'en-US': [
    "i'm so stupid", 'i am so stupid', "i'm stupid", 'i am stupid', "i'm so dumb", "i'm dumb", 'i am dumb', "i'm an idiot", 'i am an idiot',
    "i'm a failure", 'i am a failure', "i'm useless", 'i am useless', "i'm hopeless", "i'm bad at money", "i'm terrible at", "i'm so bad at",
    'i always mess up', 'i ruin everything', 'how stupid of me', 'what an idiot', 'stupid mistake', 'dumb mistake', 'shame on you', 'shame on me',
    'you should be ashamed', "you're so stupid", "you're dumb", "you're hopeless", "you're a failure",
  ],
  'es-MX': [
    'soy un tonto', 'soy una tonta', 'soy tonto', 'soy tonta', 'que tonto soy', 'que tonta soy', 'soy un desastre', 'soy una desastre',
    'soy un fracaso', 'soy un fracasado', 'soy una fracasada', 'no sirvo para', 'soy malo para', 'soy mala para', 'soy pesimo', 'soy pesima',
    'siempre la riego', 'error tonto', 'error estupido', 'soy un inutil', 'soy una inutil', 'soy inutil', 'soy un idiota', 'soy una idiota',
    'deberia darte verguenza', 'que verguenza me doy', 'eres un tonto', 'eres una tonta', 'eres un desastre', 'eres un fracaso',
  ],
  'pt-BR': [
    'sou burro', 'sou burra', 'que burro eu sou', 'que burra eu sou', 'sou um fracasso', 'sou uma fracassada', 'sou um fracassado',
    'sou um desastre', 'sou pessimo', 'sou pessima', 'nao sirvo para', 'sou ruim com dinheiro', 'erro burro', 'erro idiota', 'sou inutil',
    'sou um inutil', 'sou uma inutil', 'sou um idiota', 'sou uma idiota', 'deveria ter vergonha', 'voce e burro', 'voce e burra', 'voce e um fracasso',
  ],
};

export function scanShame(text: string, locale: ContentLocale): string[] {
  const folded = foldText(text).replace(/[’]/g, "'");
  return SHAME_LEXICON[locale].filter((phrase) => hasTerm(folded, phrase));
}

type Json = unknown;

/**
 * How many moments a mentor voices in a v1 document: every segment it narrates
 * (`narrator.character`) and every line or scene attributed to it
 * (`character` next to text in story, dialogue and storyplay payloads).
 */
export function voicedMoments(document: { segments?: Array<{ narrator?: { character?: string } } & Record<string, Json>> }, character: string): number {
  let count = 0;
  const walk = (node: Json): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      const record = node as Record<string, Json>;
      if (record.character === character && Object.keys(record).some((key) => /_md$|^text$|^line/.test(key))) count += 1;
      for (const [key, value] of Object.entries(record)) {
        if (key === 'answer') continue;
        walk(value);
      }
    }
  };
  for (const segment of document.segments ?? []) {
    if (segment.narrator?.character === character) count += 1;
    walk((segment as Record<string, Json>).payload);
  }
  return count;
}
