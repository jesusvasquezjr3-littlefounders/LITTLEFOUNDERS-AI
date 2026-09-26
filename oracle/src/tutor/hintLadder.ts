import { z } from 'zod';

/*
 * C.13: the hint ladder as a first-class, independently-tracked
 * dialogue-manager object.
 *
 * The ladder owns hint ESCALATION per learner per sub-step, in the order
 * Appendix D §3.3 specifies: re-ask/pump → indirect hint → targeted hint
 * naming the misconception → fill-in-the-blank prompt → assertion/tell.
 *
 * Two hard rules, enforced by this object rather than by per-turn LLM
 * judgment:
 *   - NEVER REPEAT A LEVEL: every registered hint request advances exactly
 *     one level for that sub-step, and the bottom ("tell") level cannot be
 *     re-requested — once told, further requests stay answered honestly but
 *     the ladder records that the escape hatch has already been used.
 *   - "JUST TELL ME" IS ALWAYS HONORED: an explicit tell request jumps that
 *     sub-step straight to the bottom level, once, no matter where the
 *     ladder stood.
 *
 * Serialization is plain JSON (array-of-tuples, like the controller
 * snapshot) so a parked session adopted by another replica restores the
 * ladder IDENTICALLY — a learner must never lose their place in the ladder
 * to a reconnect.
 */

export const HINT_LEVELS = ['reask', 'indirect', 'misconception', 'fill_blank', 'tell'] as const;
export type HintLevel = (typeof HINT_LEVELS)[number];

/** The model-facing instruction per ladder level. */
export const HINT_LEVEL_WORDING: Record<HintLevel, string> = {
  reask: 'ask them to re-read the problem and say it back in their own words',
  indirect: 'give an indirect hint that points at the idea without naming it',
  misconception: 'name the specific wrong idea they seem to hold, and ask about it',
  fill_blank: 'offer a fill-in-the-blank version of the step they are stuck on',
  tell: 'state the answer once, plainly, and move on',
};

export const HintLadderSnapshotSchema = z
  .object({
    levels: z.array(z.tuple([z.string(), z.number().int().min(0).max(HINT_LEVELS.length - 1)])),
    told: z.array(z.string()),
  })
  .strict();

export type HintLadderSnapshot = z.infer<typeof HintLadderSnapshotSchema>;

/*
 * The request detectors read FOLDED text (lower case, accents removed,
 * apostrophes straightened): speech-to-text regularly drops accents ("dimelo",
 * "me da uma dica"), and a detector that only knew the accented form would
 * treat a spoken request differently from the same request typed. Both are
 * registered in the C.20 bias audit (`safety/biasAudit/registry.ts`), which
 * found on its first run (2026-09-25) that Portuguese had no hint or tell
 * phrase at all ("me dá uma dica", "me diga a resposta"), that "I need help"
 * was not a hint request, and that Rioplatense "decime" and Mexican "échame
 * la mano" were not read. Whole-word matching never treats a letter as a
 * boundary (`\b` is ASCII-only in JavaScript).
 */
const requestPhrase = (alternation: string): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}'])(?:${alternation})(?![\\p{L}\\p{N}'])`, 'u');

const TELL_PHRASES = requestPhrase(
  [
    // en (incl. child spelling "tel")
    "just tel+ me",
    // es-MX, Rioplatense "decime", and the pronoun forms
    'dime(?:lo)? (?:ya|de una vez|directo)',
    'ya dimelo',
    'dimelo ya',
    'solo dime',
    '(?:dime|decime|dimelo) la respuesta',
    'me dices la respuesta',
    // pt-BR (incl. "dis" child spelling of "diz")
    'so me (?:diz|dis|fala|diga)',
    'apenas me (?:diga|diz|dis|fala)',
    'me (?:diga|diz|dis|fala) logo',
    'fala logo',
    'me (?:diga|diz|dis|fala) a resposta',
  ].join('|'),
);
const ANSWER_WORDS = requestPhrase('la respuesta|the answer|the anser|a resposta');
const TELL_VERBS = requestPhrase('dime|decime|dimelo|tell|tel|diga|diz|dis|fala');

const HINT_PHRASES = requestPhrase(
  [
    'pista|hint|dica|dika',
    'help me|can you help|i ?(?:need|ned|nee?d) (?:some |a little |a lil )?help|need (?:some )?help',
    'ayuda|ayudame|me ayudas|echame la mano|echame una mano',
    'me ajuda|me ajude|ajuda ai|preciso de ajuda',
    "no (?:entiendo|se|entendo)|i don'?t (?:understand|get it)",
    'no se (?:como)',
    'estoy (?:atascad[oa])|estou (?:pres[oa]|travad[oa])|stuck',
  ].join('|'),
);

/** Lower case, accents removed, apostrophes straightened, whitespace collapsed. */
function foldRequest(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** An explicit "just tell me" request, in the three product languages. */
export function isTellRequest(text: string): boolean {
  const t = foldRequest(text);
  if (TELL_PHRASES.test(t)) return true;
  // "…the answer" ending the request, with a telling verb anywhere in it.
  return /(?:la respuesta|the answer|the anser|a resposta)[^.!?]*[?,]?$/u.test(t) && ANSWER_WORDS.test(t) && TELL_VERBS.test(t);
}

/** A hint request that is not an explicit tell request. */
export function isHintRequest(text: string): boolean {
  if (isTellRequest(text)) return false;
  return HINT_PHRASES.test(foldRequest(text));
}

/**
 * C.17: a ladder's rungs, in order. Every ladder starts with the re-ask and
 * ends with the tell, keeps Appendix D §3.3's order, and repeats no rung —
 * a shorter ladder for younger children drops rungs, it never reorders them.
 */
export function isValidLadder(rungs: readonly HintLevel[]): boolean {
  if (rungs.length < 2 || rungs[0] !== 'reask' || rungs[rungs.length - 1] !== 'tell') return false;
  const order = rungs.map((r) => HINT_LEVELS.indexOf(r));
  return order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1]!));
}

export class HintLadder {
  private levels = new Map<string, number>();
  private told = new Set<string>();
  /** C.17: this session's rungs (the full ladder unless the dialogue policy shortened it). */
  private readonly rungs: readonly HintLevel[];

  constructor(rungs: readonly HintLevel[] = HINT_LEVELS) {
    this.rungs = isValidLadder(rungs) ? [...rungs] : HINT_LEVELS;
  }

  /** C.17: how many rungs this ladder has (5, or 4 for the younger-child register). */
  get rungCount(): number {
    return this.rungs.length;
  }

  /** The level the NEXT hint for this sub-step must use (default: reask). */
  levelFor(stepKey: string): HintLevel {
    return this.rungs[Math.min(this.levels.get(stepKey) ?? 0, this.rungs.length - 1)]!;
  }

  /** Whether this sub-step has already reached bottom-out. */
  reachedTell(stepKey: string): boolean {
    return this.told.has(stepKey);
  }

  /**
   * Registers one hint request and returns the level to deliver NOW. Each
   * request advances exactly one level (never repeats), clamping at "tell".
   */
  registerHintRequest(stepKey: string): HintLevel {
    const current = this.levels.get(stepKey) ?? 0;
    if (this.told.has(stepKey)) return 'tell';
    const last = this.rungs.length - 1;
    const next = Math.min(current + 1, last);
    this.levels.set(stepKey, next);
    if (next === last) this.told.add(stepKey);
    return this.rungs[next]!;
  }

  /** Honors an explicit "just tell me": bottom-out, once, immediately. */
  registerTellRequest(stepKey: string): 'tell' {
    this.levels.set(stepKey, this.rungs.length - 1);
    this.told.add(stepKey);
    return 'tell';
  }

  /**
   * C.10: whether this sub-step has had ANY ladder help since it last reset —
   * a success after help is scaffolded, not independent evidence of mastery.
   */
  assisted(stepKey: string): boolean {
    return this.levels.has(stepKey) || this.told.has(stepKey);
  }

  /** Resets one sub-step (a new sub-step or a new attempt begins). */
  resetStep(stepKey: string): void {
    this.levels.delete(stepKey);
    this.told.delete(stepKey);
  }

  snapshot(): HintLadderSnapshot {
    return {
      levels: [...this.levels.entries()].sort(([a], [b]) => a.localeCompare(b)),
      told: [...this.told].sort(),
    };
  }

  restore(snapshot: HintLadderSnapshot): void {
    this.levels = new Map(snapshot.levels);
    this.told = new Set(snapshot.told);
  }
}
