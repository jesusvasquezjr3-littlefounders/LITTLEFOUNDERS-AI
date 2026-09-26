/*
 * C.18 — DID THE MENTOR JUST SAY THE ANSWER? Checked against the REAL key.
 *
 * Appendix F §1.2's Answer-Reveal Rate is "% of Mentor turns, during a
 * collaborative-repair or hint-ladder sequence, that reveal a solution rather
 * than scaffold toward it — modeled on the MathDial methodology". Oracle
 * sends every tutor turn's honesty facts with the transcript row, but Oracle
 * never holds an answer key (Core strips it before a segment leaves this
 * service — the key is answer-adjacent and stays server-only). So the one
 * check only Core can make is made here, deterministically, when the row is
 * written: does this turn's text contain the open activity's own answer?
 *
 * PURE and conservative. It returns:
 *   true   the turn states the key (a number the learner still had to find,
 *          or the correct option's own words without reading every option);
 *   false  a key exists and the turn does not state it;
 *   null   NOT SCORABLE — no recoverable key for this type, or the answer is
 *          indistinguishable from something the learner was already shown
 *          (the expected number is one of the prompt's own givens; an option
 *          label too short to match honestly). An unscorable turn is left out
 *          of the key-based numerator AND denominator, never guessed.
 *
 * The calibrated-judge transcript score (C.21/C.23) remains the metric's
 * authoritative source per Appendix F; this is the deterministic floor under
 * it, and the only part of it that exists without spending on a model.
 */

type Json = Record<string, unknown>;

const obj = (v: unknown): Json | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : null);

const NUMBER_TOKEN = /(?<![\p{L}\d])\d{1,7}(?:[.,]\d{1,2})?(?![\p{L}\d])/gu;

function numbersIn(text: string): number[] {
  return [...text.matchAll(NUMBER_TOKEN)]
    .map((m) => Number(m[0].replace(',', '.')))
    .filter((n) => Number.isFinite(n));
}

const NOT_SHOWN_BEFORE_ANSWERING = new Set([
  'id',
  'difficulty',
  'xp',
  'seq',
  'answer',
  'answer_key',
  'answer_keys',
  'hidden_tests',
  'rubric',
  'rationale_md',
  'feedback_md',
]);

/** Every number the learner was already SHOWN: the whole public segment, walked. */
function givenNumbers(segment: Json): Set<number> {
  const out = new Set<number>();
  const walk = (value: unknown, depth: number): void => {
    if (depth > 6) return;
    if (typeof value === 'number' && Number.isFinite(value)) out.add(value);
    else if (typeof value === 'string') for (const n of numbersIn(value)) out.add(n);
    else if (Array.isArray(value)) for (const item of value) walk(item, depth + 1);
    else if (typeof value === 'object' && value !== null) {
      for (const [key, item] of Object.entries(value)) {
        // Structural fields are not something the learner reads, and the
        // key or post-answer feedback is exactly what they have NOT seen.
        if (NOT_SHOWN_BEFORE_ANSWERING.has(key)) continue;
        walk(item, depth + 1);
      }
    }
  };
  walk(segment, 0);
  return out;
}

/** The single numeric answer, where the type has one (the voice-checkable set's own sources). */
function expectedNumber(segment: Json, answer: Json | null): number | null {
  const payload = obj(segment.payload) ?? {};
  const fromKey = answer?.value ?? answer?.target;
  if (typeof fromKey === 'number' && Number.isFinite(fromKey)) return fromKey;
  // Self-contained money trays carry no key; the verdict is payload arithmetic.
  if (segment.type === 'coin_count' && typeof payload.target === 'number') return payload.target;
  if (segment.type === 'make_change' && typeof payload.price === 'number' && typeof payload.paid_with === 'number') {
    return payload.paid_with - payload.price;
  }
  return null;
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[*_`#>[\]()]/g, ' ')
    .replace(/[^\p{L}\d]+/gu, ' ')
    .trim();
}

function optionText(option: unknown): string | null {
  const o = obj(option);
  if (!o) return null;
  const text = o.label ?? o.text_md ?? o.text;
  return typeof text === 'string' ? fold(text) : null;
}

export function revealsAnswerKey(input: { segment: unknown; answer: unknown; text: string }): boolean | null {
  const segment = obj(input.segment);
  if (!segment) return null;
  const answer = obj(input.answer);

  // Numeric answers: the expected number stated while the learner still had
  // to find it — unless it was already one of the givens they were shown.
  const expected = expectedNumber(segment, answer);
  if (expected !== null) {
    const givens = givenNumbers(segment);
    if ([...givens].some((g) => Math.abs(g - expected) <= 0.005)) return null;
    return numbersIn(input.text).some((n) => Math.abs(n - expected) <= 0.005);
  }

  // Multiple choice: the correct option's own words, WITHOUT the others
  // (reading every option aloud is scaffolding, not a reveal).
  const correctId = answer?.correct_option_id;
  const options = obj(segment.payload)?.options;
  if (typeof correctId === 'string' && Array.isArray(options)) {
    const correct = options.find((o) => obj(o)?.id === correctId);
    const label = optionText(correct);
    if (label === null || label.length < 4) return null;
    const said = ` ${fold(input.text)} `;
    if (!said.includes(` ${label} `)) return false;
    const others = options
      .filter((o) => o !== correct)
      .map(optionText)
      .filter((t): t is string => t !== null && t.length >= 4);
    return !others.some((other) => said.includes(` ${other} `));
  }

  return null;
}
