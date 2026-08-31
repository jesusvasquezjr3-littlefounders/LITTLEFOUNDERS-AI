import { describe, expect, it } from 'vitest';
import {
  contradictsCorrectAnswer,
  narratesUnshownGrowth,
  praiseContradictsAnswer,
  whiteboardNumberMismatch,
  whiteboardUnitMismatch,
} from '../tutor/prompt.js';

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

describe('a growth story told in words with no board to show for it', () => {
  it('catches the exact production sentence that shipped with no board', () => {
    expect(
      narratesUnshownGrowth(
        'Imagina que guardas 10 pesos en una alcancía mágica. Cada día, la alcancía te regala 2 pesos. Al día siguiente, ¿cuántos tienes?',
        null,
      ),
    ).toBe(true);
  });

  it('never fires when a whiteboard is already present', () => {
    expect(
      narratesUnshownGrowth('Cada día te dan 2 pesos más.', {
        kind: 'sequence',
        start: 10,
        unit: 'day',
        steps: [{ op: 'add', value: 2 }],
        label: 'x',
        currency: null,
      }),
    ).toBe(false);
  });

  it('leaves a single static fact alone — nothing there moves', () => {
    expect(narratesUnshownGrowth('Un helado cuesta 12 pesos.', null)).toBe(false);
  });

  it('needs a repetition cue, not just two numbers', () => {
    expect(narratesUnshownGrowth('Tienes 10 pesos y tu amigo tiene 15.', null)).toBe(false);
  });

  it('catches the English and Portuguese equivalents', () => {
    expect(narratesUnshownGrowth('Imagine you save 10 dollars, and every week you get 2 more.', null)).toBe(true);
    expect(narratesUnshownGrowth('Imagine que você guarda 10 reais, e a cada semana ganha 2 a mais.', null)).toBe(true);
  });

  /*
   * Found by adversarial review, round 23 (2026-08-30, MEDIUM): the prior
   * test above only exercises the calqued "a cada semana," which a
   * Brazilian Portuguese speaker (or the model producing pt-BR output)
   * would not naturally say — "todo dia," "toda semana" is the ordinary
   * phrasing, and English "each day" is as natural as "every day." Neither
   * was recognized before this fix, so a naturally-phrased pt-BR or en-US
   * growth story silently skipped the repair that forces a whiteboard onto
   * screen — no warning logged, since the check itself never fired.
   */
  it('catches NATURAL Portuguese and English phrasing, not just the calqued forms', () => {
    expect(narratesUnshownGrowth('Todo dia o cofrinho te dá mais 2 reais. Você começa com 10.', null)).toBe(true);
    expect(narratesUnshownGrowth('Toda semana você ganha mais 5 reais. Você começa com 20.', null)).toBe(true);
    expect(narratesUnshownGrowth('Todos os meses você ganha mais 5 reais. Você começa com 20.', null)).toBe(true);
    expect(narratesUnshownGrowth('Todos os anos você ganha mais 5 reais. Você começa com 20.', null)).toBe(true);
    expect(narratesUnshownGrowth('Each day the piggy bank gives you 2 more pesos, starting from 10.', null)).toBe(
      true,
    );
  });
});

describe('a board labelled with the wrong unit of time', () => {
  it('catches the exact live-session mismatch: the story said "semana", the board said "day"', () => {
    // Verified against production 2026-08-29: before `unit` existed, every
    // board drew "Día 1/2/3" regardless of what the story said. This is the
    // regression guard for the SAME defect once the model can get it wrong.
    expect(
      whiteboardUnitMismatch(
        'Imagina que guardas 10 pesos en una caja, y cada semana te dan 2 más. ¿Cuántos tendrías al final de la tercera semana?',
        { unit: 'day' },
      ),
    ).toBe(true);
  });

  it('passes when the unit matches the story', () => {
    expect(
      whiteboardUnitMismatch('Cada semana te dan 2 pesos más.', { unit: 'week' }),
    ).toBe(false);
  });

  it('has nothing to check against a story naming no cadence word', () => {
    expect(whiteboardUnitMismatch('Cada vez que ahorras, ganas más.', { unit: 'month' })).toBe(false);
  });

  it('never fires when there is no whiteboard at all', () => {
    expect(whiteboardUnitMismatch('Cada semana te dan 2 pesos más.', null)).toBe(false);
  });

  it('catches every cadence word, not just "day" vs "week"', () => {
    expect(whiteboardUnitMismatch('Cada mes te dan 2 pesos más.', { unit: 'year' })).toBe(true);
    expect(whiteboardUnitMismatch('Cada año te dan 2 pesos más.', { unit: 'month' })).toBe(true);
  });

  // Found by adversarial review, round 23 (2026-08-30, MEDIUM) — the sibling
  // of the natural-phrasing gap above: a board mislabeled "Day 1/2/3" under
  // a story that said "toda semana" (natural Brazilian Portuguese, not the
  // calqued "a cada semana") went uncorrected because this check's own word
  // list did not recognize the phrase as a cadence word at all.
  it('catches a mismatch under NATURAL Portuguese phrasing, not just the calqued form', () => {
    expect(whiteboardUnitMismatch('Toda semana você ganha mais 5 reais.', { unit: 'day' })).toBe(true);
    expect(whiteboardUnitMismatch('Todo dia o cofrinho te dá mais 2 reais.', { unit: 'week' })).toBe(true);
  });
});

/*
 * THE BOARD'S OWN NUMBERS DISAGREEING WITH THE STORY IT JUST TOLD.
 *
 * Found live, testing as a real seeded account, round 65 (2026-08-30, HIGH):
 * a whiteboard and its own turn's `say` can each look correct in isolation
 * and still tell a child two different arithmetic stories. `start` absorbed
 * one period's worth of growth that the narration had already attributed to
 * "after the first period" — see `whiteboardNumberMismatch`'s own doc
 * comment (prompt.ts) for the full reproduction, including two more
 * instances caught live against the real model in the same investigation.
 */
describe("the board's own numbers disagreeing with the story it just told", () => {
  it('catches the exact live-observed turn: start absorbed the first week\'s deposit', () => {
    expect(
      whiteboardNumberMismatch(
        "That's a great idea, Explorer! Let's think about it together. Imagine you save 5 pesos each week. " +
          'After the first week you have 5, after the second you have 10, after the third you have 15. So ' +
          'after three weeks, how many pesos do you have saved?',
        { start: 5, steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }, { op: 'add', value: 5 }] },
      ),
    ).toBe(true);
  });

  it('catches the SAME defect reproduced live a second time, with a different amount', () => {
    expect(
      whiteboardNumberMismatch(
        'Great question, Explorer! Imagine you save 35 pesos each week. After one week you have 35, after ' +
          'two weeks 70, after three weeks 105. How much would you have after four weeks?',
        {
          start: 35,
          steps: [
            { op: 'add', value: 35 },
            { op: 'add', value: 35 },
            { op: 'add', value: 35 },
            { op: 'add', value: 35 },
          ],
        },
      ),
    ).toBe(true);
  });

  it('catches the SAME defect reproduced live a third time', () => {
    expect(
      whiteboardNumberMismatch(
        'A fine question, Explorer. Imagine you put away 5 coins each week. After one week you have 5, ' +
          'after two weeks 10, after three weeks 15. What would you have after four weeks?',
        {
          start: 5,
          steps: [
            { op: 'add', value: 5 },
            { op: 'add', value: 5 },
            { op: 'add', value: 5 },
            { op: 'add', value: 5 },
          ],
        },
      ),
    ).toBe(true);
  });

  it('leaves a genuinely consistent story alone — an explicit starting amount that matches', () => {
    expect(
      whiteboardNumberMismatch(
        "Let's watch it grow step by step. You start with 20, and each month you add 5. After the first " +
          'month, you have 25. After the second, 30. After the third, 35. Now, how much would you have ' +
          'after the fourth month?',
        { start: 20, steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }, { op: 'add', value: 5 }] },
      ),
    ).toBe(false);
  });

  it('leaves a consistent story alone under the digit-before-unit phrasing too', () => {
    expect(
      whiteboardNumberMismatch(
        'Imagine you save 5 coins each week. After 1 week you have 5, after 2 weeks you have 10. How many ' +
          'would you have after 3 weeks?',
        { start: 0, steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }, { op: 'add', value: 5 }] },
      ),
    ).toBe(false);
  });

  it('leaves a genuinely consistent es-MX explanation alone', () => {
    expect(
      whiteboardNumberMismatch(
        'Claro, vamos despacio. Mira en la pizarra: empiezas con 35. Después de una semana, sumamos 8 y ' +
          'tienes 43. Después de otra semana, sumamos 8 y tienes 51. Después de la tercera, sumamos 8 y ' +
          'tienes 59. ¿Ves cómo crece?',
        { start: 35, steps: [{ op: 'add', value: 8 }, { op: 'add', value: 8 }, { op: 'add', value: 8 }] },
      ),
    ).toBe(false);
  });

  // A regression guard for a mistake made and caught WHILE BUILDING this
  // check: an earlier draft anchored on "você coloca" (the RATE — how much
  // moves each step) as well as "fica com" (the TOTAL). "coloca 5" here
  // would have been misread as period 1's claimed total, contradicting the
  // board (whose real value at period 1 is 8) even though the turn is
  // actually correct. Only a cumulative-total verb may anchor a claim.
  it('leaves a genuinely consistent pt-BR explanation alone, and does not confuse the deposit RATE for the TOTAL', () => {
    expect(
      whiteboardNumberMismatch(
        'Claro, vamos devagar. Você começa com 3 reais. Na primeira semana, você coloca 5 reais, então fica ' +
          'com 8. Na segunda, mais 5, fica com 13. Na terceira, mais 5, fica com 18.',
        { start: 3, steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }, { op: 'add', value: 5 }] },
      ),
    ).toBe(false);
  });

  it('never fires when there is no whiteboard at all', () => {
    expect(
      whiteboardNumberMismatch('After the first week you have 5, after the second you have 10.', null),
    ).toBe(false);
  });

  it('stays silent when the story never states a per-period total, only asks a question', () => {
    expect(
      whiteboardNumberMismatch(
        'Imagine you save 5 pesos each week. How much would you have after 3 weeks?',
        { start: 0, steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }, { op: 'add', value: 5 }] },
      ),
    ).toBe(false);
  });

  it('forgives a spoken number that is a rounding of a percent-grown board, not a real contradiction', () => {
    // 35 growing 10% is 38.5 — nobody speaks a half-peso aloud to a child.
    expect(
      whiteboardNumberMismatch(
        'Imagine you save 35 pesos, growing 10% each week. After the first week you have 39 pesos.',
        { start: 35, steps: [{ op: 'multiply_percent', value: 10 }] },
      ),
    ).toBe(false);
  });

  it('still catches a genuinely wrong number on a percent-grown board', () => {
    expect(
      whiteboardNumberMismatch(
        'Imagine you save 35 pesos, growing 10% each week. After the first week you have 50 pesos.',
        { start: 35, steps: [{ op: 'multiply_percent', value: 10 }] },
      ),
    ).toBe(true);
  });

  it('never flags genuine prose that merely contains an ordinal and a number, with no total verb', () => {
    expect(
      whiteboardNumberMismatch(
        'The first time I visited the zoo I saw 5 elephants. Imagine you save 8 pesos each week — after ' +
          'three weeks, how much would you have?',
        { start: 0, steps: [{ op: 'add', value: 8 }, { op: 'add', value: 8 }, { op: 'add', value: 8 }] },
      ),
    ).toBe(false);
  });

  it('never flags genuine Spanish prose that merely contains "la primera" and a number', () => {
    expect(
      whiteboardNumberMismatch(
        'Ayer fue mi cumpleaños, la primera persona en llegar tenía 5 años. Imagina que ahorras 8 pesos ' +
          'cada semana.',
        { start: 0, steps: [{ op: 'add', value: 8 }] },
      ),
    ).toBe(false);
  });

  // Round 58's lesson, reapplied: a hyphen is a `\b` word boundary, so a
  // bare-boundary marker can match inside an unrelated hyphenated
  // identifier. This check requires LITERAL SPACES ("after the ", "you have
  // "), not just `\b`, so a hyphenated payload cannot satisfy it.
  it('does not spuriously match inside a hyphenated identifier', () => {
    expect(
      whiteboardNumberMismatch(
        'PAYLOAD-AFTER-THE-FIRST-YOU-HAVE-5-TOKEN and a real board follows: imagine you save 8 pesos each week.',
        { start: 0, steps: [{ op: 'add', value: 8 }] },
      ),
    ).toBe(false);
  });

  it('never fires when the board itself does not compute to a sane sequence', () => {
    expect(
      whiteboardNumberMismatch('After the first week you have 5, after the second you have 10.', {
        start: -1,
        steps: [{ op: 'add', value: 5 }],
      }),
    ).toBe(false);
  });
});
