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

  /*
   * WAVE 1 ENDS ABOVE. Everything below was written 2026-09-04, when an audit
   * asked the question this registry had never been measured against: of the 45
   * kinds the schema accepts, how many does the model ever get told WHEN to
   * reach for? The answer was 17, and only 6 of those through this file — the
   * other 39 existed as one shape line inside a list of 45, which is exactly
   * the shape of /ORACLE.md §20.5's own lesson ("the model follows what it is
   * CHECKED on") read from the other side: a kind nothing ever points at is a
   * kind that never fires, and the live-fire record already said so in writing
   * (`fill` 0/4, `whatif` 0/4, `move` 0/5).
   *
   * These eleven were chosen the way §4.4 says guidance should be — by finding
   * the MOVE that already teaches the thing, and giving it the board that draws
   * it. Every one is wired to a move whose body was read first: two of the
   * mappings that looked obvious from the move's NAME were wrong once the body
   * was read (`compare-one-part-each` is about fractions, not weighing;
   * `decide-before-money-moves` is about a budget running out, not chance) and
   * were corrected before being written down here.
   */
  {
    kind: 'deal',
    guidance: [
      'DEALING A TOTAL INTO PLACES — {kind:"deal", total: 1-60, bins: 2-6 of string, label}. No currency field.',
      'Use it when something has to be SHARED OUT and the real question is whether it comes out even: sweets',
      'between friends, pesos into envelopes. `bins` are the labelled empty places; `total` is what there is to',
      'deal. YOU DO NOT SAY HOW MANY EACH PLACE GETS, and you never say what is left over — both are dealt and',
      'counted on the board, which is the whole point: a remainder nobody predicted is the thing to be seen, not',
      'announced. FORMAT example only: thirteen into three labelled places.',
    ].join(' '),
  },
  {
    kind: 'regroup',
    guidance: [
      'BREAKING ONE COIN INTO SMALLER ONES — {kind:"regroup", fromDenomination, fromCount: 1-6, intoDenomination, label, currency}.',
      'Use it at the exact moment a subtraction cannot be done as written — "de 3 no puedo quitar 7" — BEFORE any',
      'borrowing notation. The board trades those coins for their worth in the smaller one, so the swap is a',
      'physical fact they watch rather than a rule about crossing out digits. You do not state how many small',
      'coins come back: performing that count is the board\'s job. Both denominations must really exist in that',
      'currency. FORMAT example only: one ten traded into ones.',
    ].join(' '),
  },
  {
    kind: 'change',
    guidance: [
      'THE PRICE STAYS, THE REST COMES BACK — {kind:"change", price, paid, label, currency}.',
      'Use it when a purchase is being acted out and what broke is the STORY, not the arithmetic: the whole',
      'payment handed back, or nothing returned at all. You state only the price and what was handed over.',
      'YOU DO NOT STATE THE CHANGE — the board separates it, and watching the price stay behind is what repairs',
      'the story. `paid` must be at least `price`. FORMAT example only: something costing 27 paid with 50.',
    ].join(' '),
  },
  {
    kind: 'table',
    guidance: [
      'PRICE AGAINST HOW MANY SAY YES — {kind:"table", options: 2-4 of {label, price, units}, label, currency}.',
      'Use it when only ONE of the two numbers in a business decision is being looked at — usually a high price',
      'with no thought about how many people would still buy at it. Each option pairs a price with the units sold',
      'AT that price; let them pick the units. You do not state what any option brings in: the board multiplies',
      'and sets them side by side, which is what makes a cheaper price winning visible instead of argued.',
      'FORMAT example only: 100 for two cups against 15 for forty.',
    ].join(' '),
  },
  {
    kind: 'receipt',
    guidance: [
      'THE BASKET, LINE BY LINE — {kind:"receipt", lines: 1-6 of {label, value}, label, currency}.',
      'Use it when items are going into a basket one at a time and each one was affordable on its own — the',
      'answers that are all individually correct and add up to too much. Each line is one item at its price, in',
      'the order it went in. YOU DO NOT STATE THE TOTAL: the board adds it, and a learner who has been tracking',
      'along is meant to test their own number against it rather than hear it first.',
      'FORMAT example only: three items at their prices.',
    ].join(' '),
  },
  /*
   * `ledger` was written here and then REMOVED the same hour, deliberately.
   * The only move it fit was `paying-for-the-work`, and reading that move's
   * body rather than its name showed the fit was weak: its lesson is that WORK
   * is sellable at all (it opens on a haircut — a sale with no object), not
   * what is left after money moves both ways. Wiring it anyway would have
   * pushed the catalogue past the "most turns pay nothing" budget rule below
   * on the strength of the weakest mapping in the batch, which is the wrong
   * thing to spend that budget on. It stays listed as deliberately unguided
   * until a move about takings against costs over time exists to earn it.
   */
  {
    kind: 'outcomes',
    guidance: [
      'THE TWO ENDINGS, SIDE BY SIDE — {kind:"outcomes", good:{label, detail}, bad:{label, detail}, label}.',
      'Use it when a choice is being made on the strength of the good ending alone, which is the only one they',
      'have imagined. Both endings get a short name and ONE concrete sentence of what actually happens — a',
      'consequence a child could picture, never a moral or a warning. Ask them for the good one in their own',
      'words first. Nothing numeric is computed; if the point is amounts, another board is the right one.',
      'FORMAT example only: what happens if it is spent now, and if it is not.',
    ].join(' '),
  },
  {
    kind: 'trade',
    guidance: [
      'WHAT EACH SIDE GIVES AND GETS — {kind:"trade", left:{who, gives, gets}, right:{who, gives, gets}, label}.',
      'Use it against the belief that every swap has a winner and a loser. Laying both sides out shows the thing',
      'that actually resolves it: the two sides wanted DIFFERENT things, so both can have gained. What one side',
      '`gives` is normally what the other `gets`. Nothing is computed — do not add values or declare a winner,',
      'which would restage the very idea being taken apart.',
      'FORMAT example only: one child swaps a snack for a toy with another.',
    ].join(' '),
  },
  {
    kind: 'open_number_line',
    guidance: [
      'FRIENDLY HOPS ALONG A LINE — {kind:"open_number_line", from, to, jumps: 1-5 of {value}, label, currency}.',
      'Use it when getting from one number to another should be done in easy hops rather than a column sum:',
      'counting up to make change, or rounding to a safe number and adjusting after. Each jump is how far to hop,',
      'in order. You do not state where the hops land or whether they arrive — the board marks every landing, and',
      'a set of jumps that MISSES `to` is meant to be seen missing rather than corrected in words.',
      'FORMAT example only: from 27 to 50 in two hops.',
    ].join(' '),
  },
  {
    kind: 'fraction_strip',
    guidance: [
      'THE SAME WHOLE, SPLIT BOTH WAYS — {kind:"fraction_strip", rows: 2-4 of {denominator, highlighted}, label}. No currency.',
      'Use it for "un cuarto es más que un medio porque cuatro es más que dos" — the count they are reading is',
      'real, so only seeing it fails. Every row is the SAME total length cut into a different number of pieces,',
      'with `highlighted` of them shaded, so more pieces visibly makes each piece smaller. You do not announce',
      'which is bigger: the strips are already the answer, and saying it removes the reason to look.',
      'FORMAT example only: one strip in halves against one in quarters.',
    ].join(' '),
  },
  /*
   * A SECOND PASS, same hour: these four cost nothing against the "most turns
   * pay nothing" budget rule, because each rides a move that was ALREADY
   * carrying one. That rule counts moves with no instrument at all, so widening
   * a move already in the set is free where wiring a new move is not — which is
   * also the honest reason `ledger` above is still waiting rather than being
   * squeezed in: there was no already-wired move it belonged to.
   */
  {
    kind: 'scale',
    guidance: [
      'WHICH SIDE IS ACTUALLY WORTH MORE — {kind:"scale", left:{label,value}, right:{label,value}, label, currency}.',
      'Use it when the comparison is being made on the wrong feature: the bigger pile, the shinier coin, the',
      'longer list. Both values are stated and the board tips. YOU DO NOT SAY WHICH SIDE WINS — the tip is the',
      'answer, and saying it first removes the reason to look. Reach for `compare` instead when the two are the',
      'same measure at two moments rather than two rival things.',
      'FORMAT example only: a handful of small coins against one larger one.',
    ].join(' '),
  },
  {
    kind: 'ranking',
    guidance: [
      'PUTTING THEM IN ORDER — {kind:"ranking", items: 2-5 of {label, value}, direction:"asc"|"desc", label, currency}.',
      'Use it when the decision is about ORDER rather than amount — what gets paid first, which option is best',
      'value, what to do before the money runs out. You give the items and their values and say which way to',
      'sort; the board arranges them. You do not announce the winner or read the sorted order back out: the',
      'arrangement IS the statement, and hearing it twice is what makes a turn too long.',
      'FORMAT example only: three options ordered by what each brings in.',
    ].join(' '),
  },
  {
    kind: 'chance',
    guidance: [
      'HOW LIKELY EACH ENDING IS — {kind:"chance", outcomes: 2-3 of {label, weight: 1-100}, label}. No currency.',
      'Use it only after both endings are already written down, when one of them is being treated as certain —',
      '"seguro me lo compran", "seguro gano". `weight` is RELATIVE, not a percentage you say out loud: the board',
      'turns weights into visible widths, and the widths are the whole argument. Keep it to real, honest',
      'uncertainty about a decision they control — never about something safe, which would only make a child',
      'anxious. FORMAT example only: two endings weighted unevenly.',
    ].join(' '),
  },
  {
    kind: 'fraction_circle',
    guidance: [
      'ONE WHOLE, CUT INTO EQUAL SLICES — {kind:"fraction_circle", denominator, highlighted, label}. No currency.',
      'Use it as the SECOND view of a fraction the learner has already seen as a strip, when the point is that a',
      'fraction is not a shape: the same third is a third whether it is a piece of a bar or a slice of a round',
      'thing. `highlighted` must not exceed `denominator`. You do not state the fraction as a decimal or a',
      'percentage — the slices are the statement.',
      'FORMAT example only: one of four slices shaded.',
    ].join(' '),
  },
  {
    kind: 'budget_plate',
    guidance: [
      'THE BUDGET, AND WHAT EACH CHOICE TAKES FROM IT — {kind:"budget_plate", budget, items: 2-5 of {label, value}, label, currency}.',
      'Use it when spending is happening down a list until the money runs out, or saving is only whatever happens',
      'to survive. The order is the lesson. This board deliberately ALLOWS the total to pass the budget rather',
      'than refusing it — an overspend is drawn taking its space from something already on the plate, which is',
      'the only way "no alcanza" stops being an abstraction. You do not state what is left over.',
      'FORMAT example only: a budget with three things claimed against it.',
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
