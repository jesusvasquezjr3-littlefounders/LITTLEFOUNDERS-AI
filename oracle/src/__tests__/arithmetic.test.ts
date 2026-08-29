import { describe, expect, it } from 'vitest';
import {
  answersItsOwnQuestion,
  checkAnswer,
  numberAnswered,
  questionAsked,
} from '../tutor/arithmetic.js';

/*
 * Correctness decided by computation, never by the model — the blueprint's
 * fourth differentiator. Every case here is either a sentence the tutor
 * actually produced in a scripted lesson, or a sentence that MUST return null
 * because guessing at it would contradict a correct tutor with confidence.
 */

describe('the question the tutor is asking', () => {
  it('reads the three locales and the symbol forms', () => {
    expect(questionAsked('¿Cuánto es 10 más 5?')?.answer).toBe(15);
    expect(questionAsked('¿Cuánto es 50 menos 25?')?.answer).toBe(25);
    expect(questionAsked('¿Cuánto es 3 por 4?')?.answer).toBe(12);
    expect(questionAsked('¿Cuánto es 12 entre 3?')?.answer).toBe(4);
    expect(questionAsked('What is 10 + 5?')?.answer).toBe(15);
    expect(questionAsked('Quanto é 10 mais 5?')?.answer).toBe(15);
  });

  it('ignores a turn that is EXPLAINING rather than asking', () => {
    // "10 más 5 es 15." is the tutor teaching. Treating it as a question would
    // grade the child's next sentence against a sum nobody asked them to do.
    expect(questionAsked('Mira: 10 más 5 es 15.')).toBeNull();
  });

  it('reads the LAST question when a turn corrects and then asks again', () => {
    // This exact shape appears in every scripted lesson: the correction to the
    // previous answer, then the next question. Grading against the first is
    // the confusion this function exists to prevent.
    const q = questionAsked('Casi, Robi. 10 más 3 es 13. ¿Y cuánto es 10 más 7?');
    expect(q?.answer).toBe(17);
  });

  it('stays silent when it cannot be sure', () => {
    // Two expressions after the question mark, a word problem, a fraction
    // result — each is a sentence a guess would get wrong.
    expect(questionAsked('¿Es 10 más 5 lo mismo que 8 más 7?')).toBeNull();
    expect(questionAsked('¿Cuánto te sobra si pagas con 50?')).toBeNull();
    expect(questionAsked('¿Cuánto es 10 entre 3?')).toBeNull();
    expect(questionAsked('¿Cuánto es 5 menos 8?')).toBeNull();
  });
});

describe('the number the learner gave', () => {
  it('reads a bare number and a short sentence around one', () => {
    expect(numberAnswered('15')).toBe(15);
    expect(numberAnswered('son 15')).toBe(15);
    expect(numberAnswered('creo que 15')).toBe(15);
  });

  it('refuses anything that is not a single number', () => {
    // "entre 15 y 20" is not an answer, and picking either end is a guess
    // about what a child meant.
    expect(numberAnswered('entre 15 y 20')).toBeNull();
    expect(numberAnswered('no sé')).toBeNull();
    expect(numberAnswered('')).toBeNull();
  });
});

describe('the verdict', () => {
  it('is right about the answer that shipped wrong', () => {
    /*
     * The exact exchange from 2026-08-29 that the model got wrong:
     *
     *   tutor    ¿Y si tuvieras 20 y te dieran 5, cuánto tendrías?
     *   learner  20
     *   tutor    ¡Muy bien, Robi! 20 más 5 son 25.
     */
    const verdict = checkAnswer('¿Cuánto es 20 más 5?', '20');
    expect(verdict).toEqual({ correct: false, expected: 25, given: 20 });
  });

  it('confirms a correct answer', () => {
    expect(checkAnswer('¿Cuánto es 20 más 5?', '25')).toEqual({
      correct: true,
      expected: 25,
      given: 25,
    });
  });

  it('returns null rather than guessing, so the model decides as before', () => {
    // No question, no single number, an unreadable expression — each returns
    // null, and null costs nothing because it is the behaviour we already had.
    expect(checkAnswer('Muy bien.', '25')).toBeNull();
    expect(checkAnswer('¿Cuánto es 20 más 5?', 'no sé')).toBeNull();
    expect(checkAnswer('¿Qué es un descuento?', '25')).toBeNull();
  });
});

describe('a turn that asks and answers itself', () => {
  /*
   * The blueprint's §9.4, stated as a hard rule with a number: never give the
   * final answer while asking. The shipped product did it — from the owner's
   * session of 2026-08-28:
   *
   *   "...si una flor cuesta 5 pesos, ¿cuánto cuestan dos?"
   *   "¡Diez pesos! Oye, Jason, ¿qué es lo que crees que cuesta diez pesos?"
   */
  it('catches the answer stated before the question', () => {
    expect(answersItsOwnQuestion('El total es 15. ¿Cuánto es 10 más 5?')).toBe(true);
  });

  it('leaves an honest question alone', () => {
    expect(answersItsOwnQuestion('¿Cuánto es 10 más 5?')).toBe(false);
    expect(answersItsOwnQuestion('Imagina 10 monedas y 5 más. ¿Cuántas tienes?')).toBe(false);
  });

  it('does not count an OPERAND as the answer', () => {
    // "15" appears in the lead-in and is also an operand. Seeing it says
    // nothing about whether the answer was given away.
    expect(answersItsOwnQuestion('Tenías 15 monedas. ¿Cuánto es 15 más 15?')).toBe(false);
  });

  it('judges only the FINAL question, because that is the shape lessons use', () => {
    // The correction to the previous answer is not a give-away for the new
    // question. Flagging this would fire on every good lesson.
    expect(answersItsOwnQuestion('Casi, 10 más 3 es 13. ¿Y cuánto es 10 más 7?')).toBe(false);
  });
});
