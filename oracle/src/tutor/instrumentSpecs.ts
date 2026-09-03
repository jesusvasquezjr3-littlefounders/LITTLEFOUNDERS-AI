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
  {
    kind: 'bar_model',
    guidance: [
      'THE BAR MODEL — {kind:"bar_model", whole:{label,value}, parts: 2-3 of {label, value}, label, currency}.',
      'Use it for a word problem about a total and its pieces. Set exactly ONE part\'s `value` to null: that',
      'is the unknown, and the board draws it as a gap the learner can SEE the size of. Do not state what the',
      'gap is worth — that is the answer. When every part is known the parts must add up to the whole exactly.',
      'FORMAT example only: "tenías 60 y gastaste 25 en un antojito" with whole 60 and parts 25 and null.',
    ].join(' '),
  },
  {
    kind: 'part_whole',
    guidance: [
      'THE NUMBER BOND — {kind:"part_whole", whole:{label,value}, left:{label,value}, right:{label,value}, label, currency}.',
      'Use it to show that adding and subtracting are one relationship read two ways, and to CHECK an answer',
      'the learner just gave. All three numbers are stated and the two parts MUST make the whole exactly —',
      'a bond that does not balance is refused and nothing is drawn.',
      'FORMAT example only: 9 on Saturday and 9 on Sunday make 18 altogether.',
    ].join(' '),
  },
  {
    kind: 'flow',
    guidance: [
      'IN, OUT, WHAT IS LEFT — {kind:"flow", income:{label,value}, spent:{label,value}, keptLabel, label, currency}.',
      'Use it whenever money comes in and some of it goes out: selling and paying costs, earning and spending.',
      'You name the third place with `keptLabel` but YOU DO NOT VALUE IT — there is no field for that, because',
      'what is left is exactly the idea being taught. Spending more than came in is refused.',
      'FORMAT example only: 48 came in, 19 went on lemons.',
    ].join(' '),
  },
  {
    kind: 'goal_bar',
    guidance: [
      'THE GOAL AND WHAT IS SAVED — {kind:"goal_bar", goal:{label,value}, saved:{label,value}, label, currency}.',
      'Use it BEFORE doing any arithmetic about a savings goal: the whole bar is the goal, the shaded part is',
      'what is already there, and the gap is the question. You do not state what is missing — the board computes',
      'it. Saved must not exceed the goal.',
      'FORMAT example only: a 90-peso skateboard with 34 already saved.',
    ].join(' '),
  },
  {
    kind: 'worked',
    guidance: [
      'THE CALCULATION, LINE BY LINE — {kind:"worked", start, steps: 1-4 of {op:"add"|"subtract", value}, label, currency}.',
      'Use it when you are showing HOW to work something out rather than what the answer is. The board draws',
      'each line and then a CHECK: the last step undone, landing back where it came from. You state neither the',
      'running results nor the check — both are computed, so the check shown is one that really happened.',
      'FORMAT example only: start at 72, take away 15, add 8.',
    ].join(' '),
  },
];

/**
 * THE BOARD DRAWS IT, SO DO NOT ALSO SAY IT. Appended to every spec, once.
 *
 * FOUND LIVE, 2026-09-02, on the first `tutor:converse` run after the catalog
 * shipped. `worked` fired correctly three times — and the tutor narrated every
 * line the board was already drawing ("primero resto los 10: 48 menos 10 son
 * 38. Luego resto los 9: 38 menos 9 son 29..."), pushing the scenario to 61
 * spoken words on average with three of five turns over the 60-word target. A
 * six-year-old does not hear the sixty-first word.
 *
 * `sequence`'s own guidance in prompt.ts already carried this rule — it earned
 * it from an earlier failure — and the discipline was simply never carried
 * across when the catalog grew. So it lives HERE, appended to every spec on its
 * way to the model, the same shape `SKILL_WORDING_RULE` takes for skill bodies:
 * one rule, applied in one place, covering every instrument written after today.
 */
export const INSTRUMENT_SPEAKING_RULE =
  'For any board you set: the board DRAWS the numbers, so your `say` must not ' +
  'also recite them. Narrate the situation and ask the question — never walk ' +
  'through every intermediate result out loud as well. A number said AND drawn ' +
  'is one idea said twice, and it is what makes a turn too long to listen to.';

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
  // The speaking rule rides with the guidance, once, however many instruments
  // a move named — see `INSTRUMENT_SPEAKING_RULE`.
  return `${specs.map((s) => s.guidance).join('\n')}\n${INSTRUMENT_SPEAKING_RULE}`;
}
