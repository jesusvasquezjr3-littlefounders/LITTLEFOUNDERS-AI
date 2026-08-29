/*
 * WHO DECIDES WHETHER THE CHILD WAS RIGHT.
 *
 * Until now: the model. It asked "¿cuánto es 10 más 5?", the learner said 20,
 * and the model decided whether that was correct — sometimes answering "¡Muy
 * bien, Robi! 20 más 5 son 25. Ya estás sumando con confianza", which affirms a
 * wrong answer, states a different one, and makes a false claim about the child
 * in a single breath. Three times in one day of scripted lessons, with a prompt
 * rule against it in place.
 *
 * The blueprint's fourth differentiator is exactly this: correctness is decided
 * by computation, never by the model. "Nunca dejes que el LLM sea la fuente de
 * verdad de si una respuesta matemática es correcta." Activities already work
 * this way — a real grader runs against the item's own key. Conversation did
 * not, and conversation is where most of a tutoring session actually happens.
 *
 * So this reads the question the tutor JUST ASKED, computes the answer itself,
 * and hands the orchestrator a verdict. The model's job becomes phrasing the
 * feedback, which is what it is good at, instead of deciding it, which it is
 * not.
 *
 * DELIBERATELY NARROW. It recognises one binary operation between two whole
 * numbers, in the three locales, and returns null for everything else — a word
 * problem, two operations, a fraction, anything ambiguous. A checker that
 * guesses is worse than no checker: it would contradict a correct tutor with
 * confidence. Silence here means "the model decides, as before", which is the
 * behaviour we already have rather than a new risk.
 */

export type Operation = 'add' | 'subtract' | 'multiply' | 'divide';

export interface ArithmeticQuestion {
  a: number;
  b: number;
  operation: Operation;
  answer: number;
}

/*
 * The words a tutor for six-to-twelve-year-olds actually uses, in the three
 * locales. Symbols are included because the tutor writes "10 + 5" as often as
 * it says "diez más cinco", and a child answering the symbol version deserves
 * the same verification.
 */
const OPERATORS: { pattern: string; operation: Operation }[] = [
  { pattern: 'más|mas|\\+|plus|mais', operation: 'add' },
  { pattern: 'menos|-|minus', operation: 'subtract' },
  { pattern: 'por|×|x|\\*|times|vezes', operation: 'multiply' },
  { pattern: 'entre|÷|/|dividido entre|dividido por|divided by', operation: 'divide' },
];

const OPERATOR_PATTERN = OPERATORS.map((o) => o.pattern).join('|');

/**
 * `10 más 5`, `50 menos 25`, `3 por 4`, `12 entre 3` — one operation, two whole
 * numbers, nothing else.
 */
const EXPRESSION = new RegExp(`(\\d{1,6})\\s*(${OPERATOR_PATTERN})\\s*(\\d{1,6})`, 'gi');

function operationOf(token: string): Operation | null {
  const lowered = token.toLowerCase();
  for (const { pattern, operation } of OPERATORS) {
    if (new RegExp(`^(?:${pattern})$`, 'i').test(lowered)) return operation;
  }
  return null;
}

function apply(a: number, b: number, operation: Operation): number | null {
  switch (operation) {
    case 'add':
      return a + b;
    case 'subtract':
      return a - b;
    case 'multiply':
      return a * b;
    case 'divide':
      // A tutor for this age band does not ask a question whose answer is a
      // fraction, so a non-integer result means we misread the sentence.
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

/**
 * The arithmetic question a turn is ASKING, or null.
 *
 * Only a turn that ends in a question counts. "10 más 5 es 15" is the tutor
 * EXPLAINING, and treating that as a question would have us grade the child's
 * next sentence against a sum they were never asked to do.
 *
 * More than one expression also returns null — "10 más 5 es 15, ¿y 10 más 3?"
 * is common, and picking the wrong one grades the wrong sum. The LAST
 * expression is the question only when it is the only one after the last
 * question mark, which is the case this handles by looking there first.
 */
export function questionAsked(say: string): ArithmeticQuestion | null {
  if (!say.includes('?') && !say.includes('¿')) return null;

  /*
   * Look only at the final question. A turn that corrects and then asks —
   * "Casi, 10 más 3 es 13. ¿Y cuánto es 10 más 7?" — contains the answer to the
   * PREVIOUS question and the text of the next one, and grading the child
   * against the first is exactly the confusion this exists to prevent.
   */
  const lastOpener = Math.max(say.lastIndexOf('¿'), 0);
  const tail = say.slice(lastOpener);

  const matches = [...tail.matchAll(EXPRESSION)];
  if (matches.length !== 1) return null;

  const [, rawA, rawOp, rawB] = matches[0]!;
  const operation = operationOf(rawOp!);
  if (operation === null) return null;

  const a = Number(rawA);
  const b = Number(rawB);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return null;

  const answer = apply(a, b, operation);
  if (answer === null || answer < 0) return null;

  return { a, b, operation, answer };
}

/**
 * The number a learner's reply asserts, or null.
 *
 * A bare number, or a number inside a short sentence — "15", "son 15",
 * "creo que 15". More than one number is null: "entre 15 y 20" is not an
 * answer, and picking either would be a guess about what a child meant.
 */
export function numberAnswered(text: string): number | null {
  const numbers = text.match(/\d{1,6}/g);
  if (numbers?.length !== 1) return null;
  const value = Number(numbers[0]);
  return Number.isSafeInteger(value) ? value : null;
}

export interface Verdict {
  correct: boolean;
  expected: number;
  given: number;
}

/**
 * Checks a learner's reply against the question the tutor just asked.
 *
 * Returns null when there is nothing to check — no question, no single number,
 * an expression we could not read. Null means the model decides, exactly as it
 * did before, so an unrecognised sentence costs nothing.
 */
export function checkAnswer(tutorSaid: string, learnerReplied: string): Verdict | null {
  const question = questionAsked(tutorSaid);
  if (question === null) return null;
  const given = numberAnswered(learnerReplied);
  if (given === null) return null;
  return { correct: given === question.answer, expected: question.answer, given };
}
