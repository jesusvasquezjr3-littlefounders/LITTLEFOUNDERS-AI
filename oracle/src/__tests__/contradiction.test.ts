import { describe, expect, it } from 'vitest';
import { contradictsCorrectAnswer, praiseContradictsAnswer } from '../tutor/prompt.js';

/*
 * TWO MIRROR DEFECTS, BOTH FROM REAL SESSIONS.
 *
 * praiseContradictsAnswer: "¡Muy bien!" about a wrong answer, right one stated
 * in the same breath. contradictsCorrectAnswer: "¡Casi!" about a RIGHT answer,
 * with the tutor's own reasoning landing on the learner's number. The second
 * shipped on 2026-08-29 in the owner's session: the alcancía problem, learner
 * says "Veintidós" (correct), tutor says casi and then arrives at 22.
 *
 * Both live on word problems, where the deterministic verdict rightly stays
 * silent — so these shape checks are the only guard the model's judgment has.
 */

describe('marking a correct answer as almost', () => {
  it('catches the alcancía turn verbatim', () => {
    // STT delivers the learner's answer as digits, one number per short reply.
    expect(
      contradictsCorrectAnswer(
        '¡Casi! El segundo día tienes 11 pesos, y la alcancía te regala 1 por cada peso, así que te regala 11. ¡Y entonces tienes 22!',
        '22',
      ),
    ).toBe(true);
  });

  it('leaves a real correction alone', () => {
    // The learner was actually wrong: the reasoning lands on a DIFFERENT
    // number. This is the tutor doing its job.
    expect(contradictsCorrectAnswer('Casi, Robi. Si tienes 15 y quitas 3, te quedan 12.', '25')).toBe(false);
  });

  it('needs a corrective marker to fire at all', () => {
    expect(contradictsCorrectAnswer('¡Sí! Entonces tienes 22. ¿Y mañana?', '22')).toBe(false);
  });

  it('stays silent when the learner said more than one number', () => {
    expect(contradictsCorrectAnswer('Casi. Entonces tienes 22.', 'entre 20 y 22')).toBe(false);
  });

  it('judges the LAST assertion — the lead-in may restate the setup', () => {
    // "tienes 11 pesos" appears mid-reasoning; the verdict is where the chain
    // ENDS. A learner who said 11 here was wrong, and casi is fair.
    expect(
      contradictsCorrectAnswer('Casi. Tienes 11 pesos, te regala 11, y entonces tienes 22.', '11'),
    ).toBe(false);
  });
});

describe('the two mirrors never both fire', () => {
  it('a praised wrong answer is falsePraise, not falseCorrection', () => {
    const say = '¡Muy bien, Robi! 20 más 5 son 25. Ya estás sumando con confianza.';
    expect(praiseContradictsAnswer(say, '20')).toBe(true);
    expect(contradictsCorrectAnswer(say, '20')).toBe(false);
  });
});
