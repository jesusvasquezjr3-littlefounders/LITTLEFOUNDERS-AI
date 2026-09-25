/*
 * READING A WRONG IDEA OUT OF WHAT A CHILD ACTUALLY SAID.
 *
 * THE GAP THIS CLOSES. `selectSkill` fences every misconception-tagged move
 * out of the generic path, so 21 of the 36 moves — the entire repair
 * catalogue — are reachable only when the controller holds a
 * `misconceptionCode`. Until now that code could come from exactly one place:
 * a GRADED activity failure (or Core's own voice check). A child who states
 * the wrong idea in plain words set nothing, so the tutor's best teaching was
 * unreachable in conversation. Measured over 27 real conversations
 * (2026-09-04): `REMEDIATE` fired zero times.
 *
 * WHY DETERMINISTIC, NOT A MODEL CALL. Three reasons, in order of weight.
 * A model asked "what misconception is this" will always answer something —
 * it has no way to say "that was just a question" that costs it nothing — and
 * a confident wrong label is exactly the harm here. It would also add a paid
 * call and its latency to every learner turn, on the one surface where
 * latency IS the product. And it could not be tested: this file's behaviour
 * is pinned by unit tests that run in milliseconds and cost nothing.
 *
 * PRECISION OVER RECALL, DELIBERATELY. Every pattern below requires the
 * child to COMMIT to the belief, not merely to touch the topic. "¿un cuarto
 * es más que un medio?" is a question and matches nothing; "un cuarto es más
 * que un medio porque cuatro es más que dos" is a claim and matches. Missing
 * a real misconception costs one turn of ordinary teaching — the tutor
 * answers the child normally. Inventing one costs the child being argued out
 * of something they never believed, which is the failure this file exists to
 * avoid. When in doubt, return null.
 *
 * THE CODES ARE NOT FREE-FORM. Every code returned here is checked against
 * the KC graph seed by `instrumentSpecs.test.ts`, the same registry the moves
 * are checked against, so a code that no knowledge component declares cannot
 * silently become unreachable guidance.
 */

/** One belief, and the shapes a child states it in. */
interface StatedPattern {
  /** A misconception code that really exists in the KC graph. */
  code: string;
  /**
   * ALL of these must match for the code to fire. Splitting a claim into its
   * parts is what keeps a topic mention from reading as a belief: the
   * remainder pattern needs both a sharing context AND an explicit denial
   * that anything is left, because either alone is just arithmetic talk.
   */
  all: RegExp[];
  /** Any of these vetoes the match — a question, a hedge, or a correction. */
  none?: RegExp[];
  /**
   * A last check the patterns cannot make, run only once they all matched.
   * Returning false means "the words fit but the claim is true", which is the
   * difference between a child to repair and a child to agree with.
   */
  guard?: (text: string) => boolean;
}

/**
 * "Repartí 12 entre 3 y no sobra nada" is CORRECT. "14 entre 3 y ya" is not.
 * No pattern can tell those apart, because the difference is arithmetic — so
 * this does the division.
 *
 * Silent (returns false, meaning do not fire) whenever the numbers are absent
 * or the share really is exact. A child who divides evenly and says nothing
 * is left over has said something true, and the one thing this file must
 * never do is argue with that.
 */
function claimsAnExactShareThatIsNot(text: string): boolean {
  const m = /(\d{1,4})\s*(?:canicas?|galletas?|dulces?|pesos?|cosas?)?\s*(?:entre|para|y somos)\s*(\d{1,3})\b/i.exec(text);
  if (!m) return false;
  const total = Number(m[1]);
  const parts = Number(m[2]);
  if (!Number.isFinite(total) || !Number.isFinite(parts) || parts <= 1) return false;
  return total % parts !== 0;
}

/**
 * A hedge or a question mark turns a claim into an invitation, and the tutor
 * should answer an invitation rather than repair it. Applied to EVERY pattern.
 */
const NEVER_A_CLAIM = [
  /\?/,
  // `no s[ée]` must not swallow "no SE puede", which is a claim, not a hedge.
  /\b(no s[ée]\b(?!\s+(?:puede|puedo|pueden))|no estoy segur[oa]|creo que no|verdad\s*\?|es correcto|est[áa] bien(?:\s|$))/i,
  /\b(me equivoqu[ée]|estaba mal|ya entend[íi])\b/i,
  /*
   * C.18: the same hedges in English and Portuguese — the unsound-decision
   * patterns below now read all three product locales, and a hedge in any of
   * them is an invitation, not a belief.
   */
  /\b(i don'?t know|not sure|i think not|maybe not|i was wrong|i get it now)\b/i,
  /\b(n[ãa]o sei|n[ãa]o tenho certeza|acho que n[ãa]o|eu errei|agora entendi)\b/i,
];

const PATTERNS: StatedPattern[] = [
  {
    // "14 canicas entre 3, le toca 4 a cada quien y ya" / "no sobra nada"
    code: 'ignores-remainder',
    all: [
      /\b(reparto|repartir|reparti[mr]?|entre|cada quien|cada uno|toca)\b/i,
      /\b(y ya|no sobra|nada sobra|sin que sobre|no queda nada)\b/i,
    ],
    // "sobran 0" and "es exacto" are how a child states a CORRECT even share.
    none: [/\bsobran?\s*0\b/i, /\bes exact[oa]\b/i],
    guard: claimsAnExactShareThatIsNot,
  },
  {
    // "si cuesta 7 y pago con 20 me devuelven los 20"
    code: 'returns-payment',
    all: [
      /\b(pago|pagu[ée]|pagar|con)\b.*\b(\d+)\b/i,
      /\b(me (?:tienen que )?(?:devuelven|devolver|regresan|dan)|devuelven)\b.*\b(los|el|todo)\b/i,
    ],
  },
  {
    // "le pongo 100 pesos al vaso, así me hago rico"
    code: 'highest-price-wins',
    all: [
      /\b(le pongo|voy a poner|lo pongo|cobro|cobrar[ée]?|precio de)\b/i,
      /\b(me hago ric[oa]|gano m[áa]s|as[íi] gano|m[áa]s dinero|me conviene m[áa]s)\b/i,
    ],
  },
  {
    // "me alcanza para la pelota, y también para el cuaderno, y también para los colores"
    code: 'budget-is-per-item',
    all: [
      /\b(me alcanza|alcanza para|puedo comprar)\b/i,
      // Three or more things claimed affordable, each checked on its own.
      /\b(y tambi[ée]n|y para|y el|y la|y los|y las)\b.*\b(y tambi[ée]n|y para|y el|y la|y los|y las)\b/i,
    ],
  },
  {
    // "un cuarto es más que un medio porque cuatro es más que dos"
    code: 'bigger-denominator-bigger-part',
    all: [
      /\b(un cuarto|un tercio|un quinto|un octavo|1\/[3-9])\b/i,
      /\bes m[áa]s (?:grande )?que\b/i,
      /\b(un medio|la mitad|un tercio|1\/2|1\/3)\b/i,
    ],
  },
  {
    // "esta moneda es más grande, entonces vale más"
    code: 'bigger-coin-worth-more',
    all: [
      /\b(moneda|billete)\b/i,
      /\b(m[áa]s grande|grandota|m[áa]s pesad[oa]|se ve m[áa]s)\b/i,
      /\b(vale m[áa]s|es m[áa]s dinero|entonces vale)\b/i,
    ],
  },
  {
    // "tengo 5 monedas entonces tengo 5 pesos"
    code: 'counts-coins-not-value',
    all: [
      /\b(\d+)\s+monedas?\b/i,
      /\b(entonces|as[íi] que|o sea)\b/i,
      /\b(\d+)\s+pesos?\b/i,
    ],
  },
  {
    // "de 3 no puedo quitar 7"
    code: 'subtracts-smaller-from-larger-digitwise',
    all: [/\bde\s+\d+\b/i, /\bno (?:se )?puedo?\b/i, /\b(quitar|restar|sacar)\b/i],
  },
  {
    // "seguro me lo compran" / "seguro gano"
    code: 'ignores-downside',
    all: [/\b(segur[oa]|de fijo|obvio)\b/i, /\b(me lo compran|gano|se vende|voy a vender|funciona)\b/i],
  },
  /*
   * C.18 — THE UNSOUND MONEY DECISIONS, IN ENGLISH AND PORTUGUESE.
   *
   * The anti-sycophancy constraint's hard rule ("never affirm a financially
   * unsound in-scenario decision") is only enforceable where the decision is
   * DETECTED, and every pattern above is Spanish: an en-US or pt-BR learner
   * could announce "I'll charge 100 dollars, that way I get rich" and the
   * orchestrator's check never ran. Same codes (so the KC-registry gate still
   * holds), same precision-first shapes: a claim, never a topic mention.
   */
  {
    // "for sure they'll buy it" / "com certeza vão comprar"
    code: 'ignores-downside',
    all: [
      /\b(for sure|definitely|obviously)\b/i,
      /\b(they(?:'ll| will) buy (?:it|them|everything)|i(?:'ll| will) (?:win|sell (?:it|them|everything|a lot))|it(?:'ll| will) sell|it always works)\b/i,
    ],
  },
  {
    code: 'ignores-downside',
    all: [
      /\b(com certeza|certeza que|[óo]bvio que|claro que)\b/i,
      /\b(v[ãa]o comprar|vou ganhar|vou vender (?:tudo|muito)|vai vender|vai dar certo)\b/i,
    ],
  },
  {
    // "I'll charge 100 for the lemonade, that way I get rich"
    code: 'highest-price-wins',
    all: [
      /\b(i(?:'ll| will) (?:charge|put|set)|i charge|price it at)\b/i,
      /\b(get rich|make more money|earn more|so i win)\b/i,
    ],
  },
  {
    code: 'highest-price-wins',
    all: [
      /\b(vou cobrar|vou colocar|eu cobro|pre[çc]o de)\b/i,
      /\b(fico ric[oa]|ganho mais|mais dinheiro|assim eu ganho)\b/i,
    ],
  },
  {
    // "I can afford the ball, and also the notebook, and also the paints"
    code: 'budget-is-per-item',
    all: [
      /\b(i can afford|i have enough for|i can buy)\b/i,
      /\b(and also|and the)\b.*\b(and also|and the)\b/i,
    ],
  },
  {
    code: 'budget-is-per-item',
    all: [
      /\b(d[áa] pra comprar|consigo comprar|tenho o suficiente para)\b/i,
      /\b(e tamb[ée]m)\b.*\b(e tamb[ée]m)\b/i,
    ],
  },
  {
    // "if it costs 7 and I pay with 20, they give me back the 20"
    code: 'returns-payment',
    all: [/\b(pay|paid|with)\b.*\b(\d+)\b/i, /\b(give me back|have to give me back|i get back)\b.*\b(the|all)\b/i],
  },
  {
    code: 'returns-payment',
    all: [/\b(pago|paguei|pagar|com)\b.*\b(\d+)\b/i, /\b(me devolvem|tem que me devolver|devolvem)\b.*\b(os|o|tudo)\b/i],
  },
];

/**
 * The wrong idea this utterance COMMITS to, or null.
 *
 * Null is the overwhelmingly common answer and the safe one: it means the
 * turn is handled as ordinary teaching, which is what every conversation turn
 * did before this file existed.
 */
export function classifyStatedMisconception(utterance: string): string | null {
  const text = utterance.trim();
  // A very short line carries no committed claim, and a very long one is a
  // story rather than a belief — both are places a pattern matches by accident.
  if (text.length < 12 || text.length > 400) return null;
  if (NEVER_A_CLAIM.some((veto) => veto.test(text))) return null;

  for (const pattern of PATTERNS) {
    if (pattern.none?.some((veto) => veto.test(text))) continue;
    if (!pattern.all.every((re) => re.test(text))) continue;
    if (pattern.guard && !pattern.guard(text)) continue;
    return pattern.code;
  }
  return null;
}

/** Every code this classifier can produce — used by the KC-registry gate. */
export const CLASSIFIABLE_MISCONCEPTIONS: readonly string[] = [...new Set(PATTERNS.map((p) => p.code))];
