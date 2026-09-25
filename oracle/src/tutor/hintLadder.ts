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

/** An explicit "just tell me" request, in the three product languages. */
export function isTellRequest(text: string): boolean {
  const t = text.toLowerCase();
  return /(?:just tell me|dime(?:lo)? (?:ya|de una vez)|solo dime|dime la respuesta|me dices la respuesta|só me (?:diz|fala)|apenas me (?:diga|diz)|me diga logo|dime directo)/.test(t)
    || /(?:la respuesta|the answer)[^.!?]*[?,]?$/.test(t) && /(?:dime|tell|diga|diz|fala)/.test(t);
}

/** A hint request that is not an explicit tell request. */
export function isHintRequest(text: string): boolean {
  if (isTellRequest(text)) return false;
  const t = text.toLowerCase();
  return /(?:pista|hint|ayuda|help me|no (?:entiendo|sé|se)|i don'?t (?:understand|get it)|no entendo|me ayudas|can you help|no sé (?:cómo|como)|no se (?:cómo|como)|estoy (?:atascado|atascada)|estou (?:preso|presa)|stuck)/.test(t);
}

export class HintLadder {
  private levels = new Map<string, number>();
  private told = new Set<string>();

  /** The level the NEXT hint for this sub-step must use (default: reask). */
  levelFor(stepKey: string): HintLevel {
    return HINT_LEVELS[this.levels.get(stepKey) ?? 0]!;
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
    const next = Math.min(current + 1, HINT_LEVELS.length - 1);
    this.levels.set(stepKey, next);
    if (next === HINT_LEVELS.length - 1) this.told.add(stepKey);
    return HINT_LEVELS[next]!;
  }

  /** Honors an explicit "just tell me": bottom-out, once, immediately. */
  registerTellRequest(stepKey: string): 'tell' {
    this.levels.set(stepKey, HINT_LEVELS.length - 1);
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
