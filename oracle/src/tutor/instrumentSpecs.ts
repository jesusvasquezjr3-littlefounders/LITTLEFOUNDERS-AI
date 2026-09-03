/*
 * PER-INSTRUMENT GUIDANCE THAT RIDES WITH THE MOVE, NOT WITH THE PROMPT.
 *
 * THE PROBLEM THIS SOLVES. The system prompt must list every board SHAPE — the
 * model cannot emit valid JSON for a kind it has never been shown — and that
 * list is prefix-cached, so one compact line per kind is affordable. What is NOT
 * affordable is the rest: when to reach for each kind, what its fields mean, and
 * a worked example. `sequence` alone spends forty lines on that in prompt.ts,
 * and it earned every one of them from a real failure. Forty instruments × forty
 * lines is a prompt in which the actual teaching instruction is a rounding error.
 *
 * It is also worse than expensive. A model choosing among forty options chooses
 * worse than a model choosing among the two its situation calls for — the same
 * reason `skills.ts` exists at all rather than one sentence naming a strategy.
 *
 * SO GUIDANCE IS SELECTED, NOT BROADCAST. A move (`oracle/skills/moves/*.md`)
 * may name the instruments its own procedure needs, in frontmatter, and only
 * those specs travel — appended to the turn's user content beside the move body
 * they belong to, exactly where `SKILL_WORDING_RULE` already rides, so the
 * prefix cache is untouched.
 *
 * The moves are the right home for this because they are already the place the
 * staging is described: `biggest-coin-first.md` says "keep the coins on the
 * table where they can be picked up", and `tokens` is how a screen does that.
 * Naming the instrument there puts the tool beside the instruction to use it,
 * which is the arrangement this product has repeatedly found the model actually
 * follows (/ORACLE.md §20.5: "the model follows what it is CHECKED on", and its
 * sibling — the model follows what arrives with the concrete instruction).
 *
 * A move that names no instrument is normal and gets none: the system prompt's
 * shape list plus its own `sequence` guidance remain, unchanged, for every turn.
 */

/** One instrument's guidance — kept to a few lines, for the same reason skill bodies are. */
export interface InstrumentSpec {
  /** The `kind` this describes, matching `WhiteboardSchema`'s discriminant. */
  kind: string;
  /** When to reach for it, what its fields mean, one worked example. */
  guidance: string;
}

/**
 * Every character of this is spoken to the model whenever a move names the
 * instrument, so the budget is the same shape as a skill body's: a spec that
 * cannot say its own job in this space is describing two instruments.
 */
export const INSTRUMENT_SPEC_MAX_CHARS = 900;

const SPECS: InstrumentSpec[] = [
  {
    kind: 'tokens',
    guidance: [
      'COINS ON THE TABLE — {kind:"tokens", groups: 1-6 of {denomination, count}, label, currency}.',
      'Use it when the point is COUNTING money rather than watching an amount change: what a',
      'handful adds up to, whether it is enough, why four small coins can be worth less than one',
      'big one. Each group is one pile of identical coins or notes. YOU DO NOT STATE THE TOTAL —',
      'there is no field for it, because working it out is the learner\'s job. Use only',
      'denominations that really exist in that currency. Example of the FORMAT, never of the',
      'numbers: "en la mesa hay dos billetes de 50 y tres monedas de 5 — ¿cuánto hay?" with',
      'groups:[{denomination:50,count:2},{denomination:5,count:3}].',
    ].join(' '),
  },
];

const BY_KIND = new Map(SPECS.map((s) => [s.kind, s]));

for (const spec of SPECS) {
  if (spec.guidance.length > INSTRUMENT_SPEC_MAX_CHARS) {
    throw new Error(
      `instrument spec "${spec.kind}" is ${spec.guidance.length} chars, over the ${INSTRUMENT_SPEC_MAX_CHARS} budget`,
    );
  }
}

/** Every `kind` this module can speak for — used to validate move frontmatter at boot. */
export const SPECIFIED_INSTRUMENTS: readonly string[] = SPECS.map((s) => s.kind);

/**
 * The guidance for the instruments a move named, in the order it named them,
 * skipping any this module has no spec for.
 *
 * Returns an empty string when a move names none — which is most of them, and
 * is why this costs nothing on a turn that does not need it.
 */
export function instrumentGuidanceFor(kinds: readonly string[]): string {
  const specs = kinds.map((k) => BY_KIND.get(k)).filter((s): s is InstrumentSpec => s !== undefined);
  if (specs.length === 0) return '';
  return specs.map((s) => s.guidance).join('\n');
}
