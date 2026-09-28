import { describe, expect, it } from 'vitest';
import {
  contradictsCorrectAnswer,
  narratesUnshownGrowth,
  praiseContradictsAnswer,
  whiteboardCategoryMismatch,
  whiteboardComparisonMismatch,
  whiteboardDoubledPeriodSteps,
  whiteboardMarkedLineMismatch,
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

/*
 * THE SAME DEFECT, A DIFFERENT PHRASING. Found live by the owner, round 67
 * (2026-08-30, HIGH), the day after round 65 shipped: "what if i get 3
 * dollars every month" produced a turn narrating a bare comma list ending in
 * a bald "So 12 dollars" conclusion, which the ordinal-anchored patterns
 * above never fire on. See `PERIOD_COUNT_THEN_TOTAL_PAIRS`'s own doc comment
 * (prompt.ts) for the full characterization: ~95 real turns against the
 * real `TutorOrchestrator`, confirming both that this phrasing is common
 * (roughly 1 in 8 of the turns where a worked walkthrough was elicited) and
 * a second, independent live reproduction of the actual number disagreeing
 * (a THIRD phrasing this round found and deliberately left unaddressed —
 * see the "ambiguous phrasing" tests below).
 */
describe('the board\'s own numbers disagreeing with a "for N periods ... so $X" conclusion', () => {
  it('catches the exact live-observed turn: a bare list ending in "So 12 dollars", one period ahead of the story', () => {
    expect(
      whiteboardNumberMismatch(
        "Imagine you get 3 dollars every month. If you save for 4 months, how much would you have? Let's think: " +
          '3, then 6, then 9, then 12. So 12 dollars. Now, what if you spend 2 dollars each month? How much would ' +
          'you have after 3 months?',
        { start: 3, steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      ),
    ).toBe(true);
  });

  it('catches a genuinely wrong "so" total even with no list before it', () => {
    expect(
      whiteboardNumberMismatch(
        'Imagine you get 4 dollars every month. If you save for 3 months, how much would you have? So 20 dollars.',
        { start: 0, steps: [{ op: 'add', value: 4 }, { op: 'add', value: 4 }, { op: 'add', value: 4 }] },
      ),
    ).toBe(true);
  });

  it('catches the Spanish equivalent: "durante 4 meses ... Entonces tendrías 12 pesos"', () => {
    expect(
      whiteboardNumberMismatch(
        'Imagina que consigues 3 pesos cada mes. Si ahorras durante 4 meses, ¿cuánto tendrías? Vamos a pensarlo: ' +
          '3, luego 6, luego 9, luego 12. Entonces tendrías 12 pesos.',
        { start: 3, steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      ),
    ).toBe(true);
  });

  it('catches the Portuguese equivalent: "durante 4 meses ... Então 12 reais"', () => {
    expect(
      whiteboardNumberMismatch(
        'Imagine que você ganha 3 reais todo mês. Se você guardar durante 4 meses, quanto teria? Vamos pensar: 3, ' +
          'depois 6, depois 9, depois 12. Então 12 reais.',
        { start: 3, steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      ),
    ).toBe(true);
  });

  it('leaves a genuinely consistent bare-list-and-conclude turn alone (a real sample from this round\'s own characterization run)', () => {
    expect(
      whiteboardNumberMismatch(
        "Of course! Watch the board: you start with 8 dollars, and each month you add 3. After three months, it " +
          "shows 8, then 11, then 14, then 17. So you'd have 17 dollars. Now, what if you started with 5 dollars " +
          'and got 4 each month for two months? How much would you have?',
        { start: 8, steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      ),
    ).toBe(false);
  });

  it('leaves a consistent turn narrating a SECOND, unrelated scenario alone — the second scenario is never checked against the first board', () => {
    expect(
      whiteboardNumberMismatch(
        'Of course. Watch: month one you have 3, month two you add 3 more to make 6, month three makes 9, month ' +
          "four makes 12. So after 4 months you'd have 12 dollars. Now you try: what if you got 5 dollars every " +
          'month for 3 months? How many would you have?',
        { start: 0, steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      ),
    ).toBe(false);
  });

  // The exact false lead found WHILE characterizing this check, not assumed:
  // an earlier draft captured any number within 25 characters of "so", which
  // misread the "3" in "so after 3 weeks" (the start of a NEW question about
  // a period count) as if it were a concluding total.
  it('does not misread "so after 3 weeks, how many do you have?" as a concluding total', () => {
    expect(
      whiteboardNumberMismatch(
        'Watch the board: you start with 0, and each week adds 5. After week 1 you have 5, after week 2 you have ' +
          '10. So after 3 weeks, how many do you have?',
        { start: 0, steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }, { op: 'add', value: 5 }] },
      ),
    ).toBe(false);
  });

  it('leaves alone a "so" that only leads into a question, not a stated total', () => {
    expect(
      whiteboardNumberMismatch(
        "Of course. Watch the board — each month you add 3. After month 1 you have 3, after month 2 you have 6. " +
          "So after month 3, how many do you think you'll have?",
        { start: 0, steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      ),
    ).toBe(false);
  });

  it('never flags ordinary correct arithmetic narration with a comma list and no period-count anchor', () => {
    expect(
      whiteboardNumberMismatch(
        'Great! 3 plus 3 is 6, 6 plus 3 is 9, and 9 plus 3 is 12 — nice counting.',
        { start: 0, steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      ),
    ).toBe(false);
  });

  it('does not spuriously match inside a hyphenated identifier', () => {
    expect(
      whiteboardNumberMismatch(
        'PAYLOAD-FOR-4-MONTHS-SO-YOU-HAVE-999-TOKEN and a real board follows: imagine you save 8 pesos each month.',
        { start: 0, steps: [{ op: 'add', value: 8 }] },
      ),
    ).toBe(false);
  });

  // The contraction gap found while widening PERIOD_CLAIM_PATTERNS for this
  // round: "you'd have"/"you'll have"/"you've saved" now match the same
  // tight ordinal anchor the full forms already did.
  it('catches an ordinal-anchored mismatch stated with the "you\'d have" contraction', () => {
    expect(
      whiteboardNumberMismatch(
        "Imagine you save 5 pesos each week. After the first week you'd have 5, after the second you'd have 10.",
        { start: 5, steps: [{ op: 'add', value: 5 }] },
      ),
    ).toBe(true);
  });

  it('leaves a genuinely consistent "you\'d have" turn alone', () => {
    expect(
      whiteboardNumberMismatch(
        "Of course. Watch the board: you start with 0, and each month you add 3. After 4 months, you'd have 12 " +
          'dollars. Now, if you saved 3 dollars each month for 5 months, how many would you have?',
        { start: 0, steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      ),
    ).toBe(false);
  });

  /*
   * A THIRD phrasing this round found live — and deliberately left
   * unaddressed. "month one you have 3, month two you have 6, month three
   * you have 9, month four you have 12" against `start: 3` is the exact
   * round-65 shift, reproduced independently of the owner's own turn during
   * this round's own characterization run. It stays uncaught because the
   * IDENTICAL bare "unit N you have/add VALUE" surface shape is used by a
   * genuinely CORRECT turn from the same run to mean the OPPOSITE thing — a
   * stated starting balance, not a first-period result (the next test).
   * No wording distinguishes the two readings well enough to anchor on
   * safely, so per this file's own doctrine, silence beats a false alarm.
   */
  it('does NOT catch the ambiguous "month N you have X" shape — a documented, deliberate gap', () => {
    expect(
      whiteboardNumberMismatch(
        'Watch the board: month one you have 3, month two you have 6, month three you have 9, month four you ' +
          'have 12. So four months. Now you try: if you get 4 dollars each month, how many months to reach 20?',
        { start: 3, steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      ),
    ).toBe(false);
  });

  it('the SAME ambiguous shape, used correctly, from the same characterization run — why no anchor was added', () => {
    expect(
      whiteboardNumberMismatch(
        'Watch the jar grow: month 1 you have 3, month 2 you add 3 more, month 3 you add 3 again. What number ' +
          'do you see at the end?',
        { start: 3, steps: [{ op: 'add', value: 3 }, { op: 'add', value: 3 }, { op: 'add', value: 3 }] },
      ),
    ).toBe(false);
  });
});

/*
 * ITEM 1: A GROWTH STORY WITH BOTH AN INCOME AND AN EXPENSE PER PERIOD
 * DRAWING TWICE AS MANY WHITEBOARD STEPS AS REAL PERIODS.
 *
 * Found live, a real browser session as a real admin account, en-US: "what
 * if i get 3 dollars every month" then, a turn later, "idk maybe 6" in reply
 * to "how much would you have after 3 months?" spending 2/month, produced a
 * whiteboard of SIX steps (+3,-2,+3,-2,+3,-2) for a story both the spoken
 * narrative and the board's own label called THREE months. Confirmed real
 * and recurring against the real `TutorOrchestrator` and the real model — a
 * single fixed phrasing repeated six times fresh reproduced the doubling 5
 * of 6 times, and a varied-phrasing batch (different currency, different
 * period word, a different framing) reproduced it in es-MX and pt-BR too.
 * See `whiteboardDoubledPeriodSteps`'s own doc comment (prompt.ts) for the
 * full characterization and the false-positive analysis behind checking the
 * whiteboard OBJECT directly rather than re-parsing the spoken prose.
 */
describe('a whiteboard drawing two steps per period instead of one net step', () => {
  it('catches the exact live-observed shape: get 3, spend 2, six steps for three months', () => {
    expect(
      whiteboardDoubledPeriodSteps({
        label: 'Each month you get 3, spend 2',
        steps: [
          { op: 'add', value: 3 },
          { op: 'subtract', value: 2 },
          { op: 'add', value: 3 },
          { op: 'subtract', value: 2 },
          { op: 'add', value: 3 },
          { op: 'subtract', value: 2 },
        ],
      }),
    ).toBe(true);
  });

  it('catches the same shape reproduced live in en-US, a different amount and period word', () => {
    expect(
      whiteboardDoubledPeriodSteps({
        label: 'Each week: earn 5, spend 2',
        steps: [
          { op: 'add', value: 5 },
          { op: 'subtract', value: 2 },
          { op: 'add', value: 5 },
          { op: 'subtract', value: 2 },
          { op: 'add', value: 5 },
          { op: 'subtract', value: 2 },
          { op: 'add', value: 5 },
          { op: 'subtract', value: 2 },
        ],
      }),
    ).toBe(true);
  });

  it('catches the same shape reproduced live in pt-BR', () => {
    expect(
      whiteboardDoubledPeriodSteps({
        label: 'Ganha 6, gasta 2 a cada semana',
        steps: [
          { op: 'add', value: 6 },
          { op: 'subtract', value: 2 },
          { op: 'add', value: 6 },
          { op: 'subtract', value: 2 },
          { op: 'add', value: 6 },
          { op: 'subtract', value: 2 },
        ],
      }),
    ).toBe(true);
  });

  it('catches the same shape reproduced live in es-MX', () => {
    expect(
      whiteboardDoubledPeriodSteps({
        label: 'Ganas 4, gastas 1 cada mes',
        steps: [
          { op: 'add', value: 4 },
          { op: 'subtract', value: 1 },
          { op: 'add', value: 4 },
          { op: 'subtract', value: 1 },
        ],
      }),
    ).toBe(true);
  });

  it('leaves a correctly net-computed board alone — one add per period, no expense word in the label', () => {
    // The real, correct board this round also observed: the model computed
    // the net (10 - 4 = 6) itself and drew ONE step per week.
    expect(
      whiteboardDoubledPeriodSteps({
        label: 'Each week you keep 6',
        steps: [
          { op: 'add', value: 6 },
          { op: 'add', value: 6 },
          { op: 'add', value: 6 },
          { op: 'add', value: 6 },
          { op: 'add', value: 6 },
        ],
      }),
    ).toBe(false);
  });

  it('leaves alone a genuinely different two-op-per-period story: percent growth plus a flat fee', () => {
    // A valid, different use of the same "more than one op per period"
    // schema capability — restricted to add/subtract only, so this never
    // matches even though the label happens to name both an inflow and an
    // outflow word.
    expect(
      whiteboardDoubledPeriodSteps({
        label: 'You earn 10% growth, but pay a fee each month',
        steps: [
          { op: 'multiply_percent', value: 10 },
          { op: 'subtract', value: 2 },
          { op: 'multiply_percent', value: 10 },
          { op: 'subtract', value: 2 },
        ],
      }),
    ).toBe(false);
  });

  it('never fires when the label names no expense at all', () => {
    expect(
      whiteboardDoubledPeriodSteps({
        label: 'Each week you get 5 more',
        steps: [
          { op: 'add', value: 5 },
          { op: 'add', value: 5 },
          { op: 'add', value: 5 },
          { op: 'add', value: 5 },
        ],
      }),
    ).toBe(false);
  });

  it('never fires when there is no whiteboard at all', () => {
    expect(whiteboardDoubledPeriodSteps(null)).toBe(false);
    expect(whiteboardDoubledPeriodSteps(undefined)).toBe(false);
  });

  // A DELIBERATE, DOCUMENTED GAP (see the function's own doc comment): a
  // two-step board cannot be told apart from a genuinely different, valid
  // two-period story where period 1 is a plain gain and period 2 is a plain
  // loss. `steps.length >= 4` is what keeps this silent here.
  it('does NOT catch a two-step board — a documented, deliberate gap (relies on the prevention-side fix alone)', () => {
    expect(
      whiteboardDoubledPeriodSteps({
        label: 'Ganas 4, gastas 1 cada mes',
        steps: [
          { op: 'add', value: 4 },
          { op: 'subtract', value: 1 },
        ],
      }),
    ).toBe(false);
  });

  it('never fires on a repeating pair whose values change each cycle — not the same fixed rule repeated', () => {
    expect(
      whiteboardDoubledPeriodSteps({
        label: 'You earn some, then spend some, each week',
        steps: [
          { op: 'add', value: 5 },
          { op: 'subtract', value: 3 },
          { op: 'add', value: 7 },
          { op: 'subtract', value: 1 },
        ],
      }),
    ).toBe(false);
  });
});

/*
 * ITEM 2: whiteboardNumberMismatch's PORTUGUESE ANCHOR MISSED THE MODEL'S
 * OWN IDIOMATIC PHRASING.
 *
 * Found by re-running round 67's own adversarial-review workflow: a genuine,
 * correct pt-BR growth narration using "vira" (becomes) and a bare "fica"
 * (without "com") called directly against a wildly wrong whiteboard
 * returned `false` — no contradiction detected — because the verb list only
 * ever recognized "você tem/teria" and "fica(m) com". A parallel es-MX
 * sentence using the analogous "tienes" construction against an equally
 * wrong board already correctly returns `true`, proving this was a
 * pt-BR-specific coverage gap. Separately, `quarta` (Portuguese "fourth")
 * was never in `PERIOD_WORD` at all — Spanish's own fourth-ordinal key is
 * spelled `cuarta` (with a c), a different string.
 */
describe('whiteboardNumberMismatch — Portuguese "vira" and bare "fica"', () => {
  it('catches the exact real pt-BR sentence against a wildly wrong board (this used to return false)', () => {
    expect(
      whiteboardNumberMismatch(
        'Imagine que você guarda 10 reais, e a cada semana isso cresce 10%. Na primeira semana, vira 11. Na ' +
          'segunda, cresce 10% em cima de 11, e fica 12,10.',
        { start: 999, steps: [{ op: 'add', value: 1 }, { op: 'add', value: 1 }] },
      ),
    ).toBe(true);
  });

  it('the parallel es-MX "tienes" construction already works, confirming this was pt-BR-specific', () => {
    expect(
      whiteboardNumberMismatch(
        'Imagina que guardas 10 pesos, y cada semana crece 10%. Después de la primera semana, tienes 11. ' +
          'Después de la segunda semana, tienes 12.10.',
        { start: 999, steps: [{ op: 'add', value: 1 }, { op: 'add', value: 1 }] },
      ),
    ).toBe(true);
  });

  it('leaves a genuinely consistent pt-BR "vira" narration alone', () => {
    expect(
      whiteboardNumberMismatch(
        'Vamos ver: você começa com 10. Na primeira semana, vira 12. Na segunda, vira 14.',
        { start: 10, steps: [{ op: 'add', value: 2 }, { op: 'add', value: 2 }] },
      ),
    ).toBe(false);
  });

  it('leaves a genuinely consistent pt-BR bare "fica" narration alone', () => {
    expect(
      whiteboardNumberMismatch(
        'Vamos ver: você começa com 10. Na primeira semana, fica 12. Na segunda, fica 14.',
        { start: 10, steps: [{ op: 'add', value: 2 }, { op: 'add', value: 2 }] },
      ),
    ).toBe(false);
  });

  it('catches a period-4 claim now that "quarta" is a known ordinal word', () => {
    expect(
      whiteboardNumberMismatch('Na quarta semana, você tem 999.', {
        start: 0,
        steps: [
          { op: 'add', value: 5 },
          { op: 'add', value: 5 },
          { op: 'add', value: 5 },
          { op: 'add', value: 5 },
        ],
      }),
    ).toBe(true);
  });

  it('leaves a genuinely consistent "quarta" claim alone', () => {
    expect(
      whiteboardNumberMismatch('Na quarta semana, você tem 20.', {
        start: 0,
        steps: [
          { op: 'add', value: 5 },
          { op: 'add', value: 5 },
          { op: 'add', value: 5 },
          { op: 'add', value: 5 },
        ],
      }),
    ).toBe(false);
  });
});

/*
 * THE OTHER THREE BOARD KINDS (2026-09-01).
 *
 * `compare`, `marked_line` and `categories` had no drift detector until now,
 * deliberately — see the long note above `assertionClauses` in prompt.ts for
 * what changed and what did NOT (there is still no live transcript behind
 * these three; they are anchored on the boards' own labels instead).
 *
 * Every describe below tests BOTH directions, because half of what these
 * functions are for is refusing to fire: this product asks more questions than
 * it answers, and a check that reads a Socratic question as a claim would fail
 * the tutor for teaching. Each documented refusal gets its own test so that
 * removing a guard breaks something.
 *
 * The `compare` fixture uses 45/28 and the `marked_line` fixture 22/35/0/40 —
 * the numbers /ORACLE.md §20.5 already spends on these two kinds, so no new
 * arithmetic is introduced for a reader to have to hold.
 */
const HELADO_PALETA = {
  left: { label: 'Helado', value: 45 },
  right: { label: 'Paleta', value: 28 },
};

describe('a compare board contradicted by the words beside it', () => {
  it('catches a side quoted at an amount the board does not draw', () => {
    expect(whiteboardComparisonMismatch('El helado cuesta 50 pesos.', HELADO_PALETA)).toBe(true);
  });

  it('catches a stated difference that is not the computed one', () => {
    // 45 − 28 is 17, not 20.
    expect(whiteboardComparisonMismatch('La diferencia es 20 pesos.', HELADO_PALETA)).toBe(true);
  });

  it('catches the cheaper side being called the dearer one', () => {
    expect(whiteboardComparisonMismatch('La paleta cuesta más.', HELADO_PALETA)).toBe(true);
  });

  it('says nothing about a turn whose numbers all agree', () => {
    expect(
      whiteboardComparisonMismatch(
        'El helado cuesta 45 y la paleta cuesta 28. La diferencia es 17 pesos.',
        HELADO_PALETA,
      ),
    ).toBe(false);
  });

  it('never reads a QUESTION as a claim — the tutor asks for a living', () => {
    // The single most likely sentence on a compare turn, and it names the
    // side the board draws SHORTER. An assertion-blind check fails here.
    expect(whiteboardComparisonMismatch('¿La paleta cuesta más que el helado?', HELADO_PALETA)).toBe(
      false,
    );
  });

  it('refuses to judge a turn that says BOTH sides are the bigger one', () => {
    expect(
      whiteboardComparisonMismatch('El helado cuesta más hoy. La paleta cuesta más el martes.', HELADO_PALETA),
    ).toBe(false);
  });

  it('has no opinion about which is bigger when the two are equal', () => {
    expect(
      whiteboardComparisonMismatch('La paleta cuesta más.', {
        left: { label: 'Helado', value: 30 },
        right: { label: 'Paleta', value: 30 },
      }),
    ).toBe(false);
  });

  it('leaves a number that IS on the board alone, even beside the other label', () => {
    // Relating the two sides to each other is ordinary teaching, and 45 is
    // demonstrably a number this board contains.
    expect(whiteboardComparisonMismatch('La paleta es 45 pesos más barata... no, espera.', HELADO_PALETA)).toBe(
      false,
    );
  });

  it('works in en-US', () => {
    const board = { left: { label: 'Ice cream', value: 45 }, right: { label: 'Popsicle', value: 28 } };
    expect(whiteboardComparisonMismatch('The ice cream costs 50 dollars.', board)).toBe(true);
    expect(whiteboardComparisonMismatch('The difference is 20 dollars.', board)).toBe(true);
    expect(whiteboardComparisonMismatch('The ice cream costs 45 and the difference is 17.', board)).toBe(false);
  });

  it('works in pt-BR, accented label and all', () => {
    // `Sorvete` is plain, but `Picolé` ends in an accent — the exact shape a
    // `\b`-anchored pattern silently never matches (see WORD_END, prompt.ts).
    const board = { left: { label: 'Sorvete', value: 45 }, right: { label: 'Picolé', value: 28 } };
    expect(whiteboardComparisonMismatch('O picolé custa 50 reais.', board)).toBe(true);
    expect(whiteboardComparisonMismatch('A diferença é 20 reais.', board)).toBe(true);
    expect(whiteboardComparisonMismatch('O picolé custa 28 reais. A diferença é 17.', board)).toBe(false);
  });

  it('fails open on a null board', () => {
    expect(whiteboardComparisonMismatch('La diferencia es 999.', null)).toBe(false);
  });
});

describe('a marked_line board contradicted by the words beside it', () => {
  const TIENES_CUESTA = {
    min: 0,
    max: 40,
    marks: [
      { value: 22, label: 'Tienes' },
      { value: 35, label: 'Cuesta' },
    ],
  };

  it('catches a shortfall that is not the gap between the two marks', () => {
    // 35 − 22 is 13, not 15.
    expect(whiteboardMarkedLineMismatch('Te faltan 15 pesos.', TIENES_CUESTA)).toBe(true);
  });

  it('catches the same claim phrased as a difference', () => {
    expect(whiteboardMarkedLineMismatch('La diferencia es 15 pesos.', TIENES_CUESTA)).toBe(true);
  });

  it('says nothing when the spoken gap is the real one', () => {
    expect(whiteboardMarkedLineMismatch('Te faltan 13 pesos para llegar.', TIENES_CUESTA)).toBe(false);
  });

  it('never reads a QUESTION as a claim', () => {
    expect(whiteboardMarkedLineMismatch('¿Te faltan 15 pesos?', TIENES_CUESTA)).toBe(false);
  });

  it('refuses a board with more than two marks — "the gap" stops being one number', () => {
    expect(
      whiteboardMarkedLineMismatch('Te faltan 15 pesos.', {
        min: 0,
        max: 40,
        marks: [
          { value: 10, label: 'Lunes' },
          { value: 22, label: 'Martes' },
          { value: 35, label: 'Meta' },
        ],
      }),
    ).toBe(false);
  });

  it('refuses a one-mark board, which has no gap at all', () => {
    expect(
      whiteboardMarkedLineMismatch('Te faltan 15 pesos.', {
        min: 0,
        max: 40,
        marks: [{ value: 22, label: 'Tienes' }],
      }),
    ).toBe(false);
  });

  it('fails open on a board computeMarkedLine itself refuses', () => {
    // Inverted range: the board is dropped elsewhere, so this must not also
    // complain about the words next to a board nobody will ever see.
    expect(
      whiteboardMarkedLineMismatch('Te faltan 15 pesos.', {
        min: 50,
        max: 10,
        marks: [
          { value: 22, label: 'Tienes' },
          { value: 35, label: 'Cuesta' },
        ],
      }),
    ).toBe(false);
  });

  it('works in en-US and pt-BR', () => {
    expect(whiteboardMarkedLineMismatch('You need 15 more dollars.', TIENES_CUESTA)).toBe(true);
    expect(whiteboardMarkedLineMismatch('You need 13 more dollars.', TIENES_CUESTA)).toBe(false);
    expect(whiteboardMarkedLineMismatch('Faltam 15 reais.', TIENES_CUESTA)).toBe(true);
    expect(whiteboardMarkedLineMismatch('Faltam 13 reais.', TIENES_CUESTA)).toBe(false);
  });

  it('fails open on a null board', () => {
    expect(whiteboardMarkedLineMismatch('Te faltan 999.', null)).toBe(false);
  });
});

describe('a categories board contradicted by the words beside it', () => {
  // The lab's own es-MX fixture (labFixtures.ts): 40 / 35 / 25, summing to 100.
  const SPLIT = {
    categories: [
      { label: 'Necesito', value: 40 },
      { label: 'Quiero', value: 35 },
      { label: 'Ahorré', value: 25 },
    ],
  };

  it('catches a bar quoted at an amount the board does not draw', () => {
    expect(whiteboardCategoryMismatch('Necesito es 50 pesos.', SPLIT)).toBe(true);
  });

  it('catches it on an ACCENT-ENDING label, which is where `\\b` gave up', () => {
    expect(whiteboardCategoryMismatch('Ahorré es 60 pesos.', SPLIT)).toBe(true);
  });

  it('catches a stated total that is not the sum of the bars', () => {
    expect(whiteboardCategoryMismatch('En total son 120 pesos.', SPLIT)).toBe(true);
  });

  it('says nothing when every number matches its own bar', () => {
    expect(
      whiteboardCategoryMismatch(
        'Necesito es 40, Quiero es 35 y Ahorré es 25. En total son 100 pesos.',
        SPLIT,
      ),
    ).toBe(false);
  });

  it('never reads a QUESTION as a claim', () => {
    expect(whiteboardCategoryMismatch('¿Ahorré es 60 pesos?', SPLIT)).toBe(false);
  });

  it('needs a COPULA — a rate mentioned near a bar name is not a claim about the bar', () => {
    // "Ahorré 60 pesos cada semana" says how much moves each week; the bar is
    // the running amount. An adjacency-only anchor fires here, wrongly.
    expect(whiteboardCategoryMismatch('Ahorré 60 pesos cada semana.', SPLIT)).toBe(false);
  });

  it('leaves a number that IS on the board alone, even beside the wrong bar', () => {
    expect(whiteboardCategoryMismatch('Ahorré es 40... perdón, quise decir Necesito.', SPLIT)).toBe(false);
  });

  it('does not read a total of something that is not money', () => {
    // "total" must be followed straight away by a copula, or "el total de
    // semanas es 4" becomes a claim about 100 pesos.
    expect(whiteboardCategoryMismatch('El total de semanas es 4.', SPLIT)).toBe(false);
  });

  it('refuses a label that is contained in another label on the same board', () => {
    // Nothing distinguishes "a claim about Ahorro" from "the start of a claim
    // about Ahorro largo", so neither reading is taken.
    const overlapping = {
      categories: [
        { label: 'Ahorro', value: 10 },
        { label: 'Ahorro largo', value: 60 },
      ],
    };
    expect(whiteboardCategoryMismatch('Ahorro es 99 pesos.', overlapping)).toBe(false);
  });

  it('fails open on a board computeCategories itself refuses', () => {
    // Two bars sharing a label — the one cross-bar fault no per-bar schema can
    // see, and the board is dropped for it elsewhere.
    expect(
      whiteboardCategoryMismatch('Quiero es 99 pesos.', {
        categories: [
          { label: 'Quiero', value: 40 },
          { label: 'quiero', value: 35 },
        ],
      }),
    ).toBe(false);
  });

  it('works in en-US and pt-BR', () => {
    const en = {
      categories: [
        { label: 'Need', value: 40 },
        { label: 'Want', value: 35 },
        { label: 'Saved', value: 25 },
      ],
    };
    expect(whiteboardCategoryMismatch('Need: 50 dollars.', en)).toBe(true);
    expect(whiteboardCategoryMismatch('Need: 40 dollars. In total that is a total of 100.', en)).toBe(false);

    const pt = {
      categories: [
        { label: 'Preciso', value: 40 },
        { label: 'Quero', value: 35 },
        { label: 'Guardei', value: 25 },
      ],
    };
    expect(whiteboardCategoryMismatch('Guardei é 60 reais.', pt)).toBe(true);
    expect(whiteboardCategoryMismatch('O total é 120 reais.', pt)).toBe(true);
    expect(whiteboardCategoryMismatch('Guardei é 25 reais. O total é 100 reais.', pt)).toBe(false);
  });

  it('fails open on a null board', () => {
    expect(whiteboardCategoryMismatch('En total son 999.', null)).toBe(false);
  });

  it('survives a label full of regex metacharacters — it is MODEL-written text', () => {
    // The label is compiled into a pattern. An unescaped `(` or `{` would
    // throw out of the turn loop and destroy a turn with nothing else wrong
    // with it, so this asserts both halves: it does not throw, and it still
    // reads the claim correctly through the escaping.
    const board = {
      categories: [
        { label: 'Ahorro (largo)', value: 40 },
        { label: 'Gasto [semanal]', value: 35 },
      ],
    };
    expect(() => whiteboardCategoryMismatch('Ahorro (largo) es 40.', board)).not.toThrow();
    expect(whiteboardCategoryMismatch('Ahorro (largo) es 40.', board)).toBe(false);
    expect(whiteboardCategoryMismatch('Ahorro (largo) es 99.', board)).toBe(true);
  });
});

/*
 * THE PRODUCT'S OWN COPY, IN ALL THREE LOCALES, MUST NOT TRIP ANY OF THEM.
 *
 * Hand-written examples prove a check FIRES; only real content proves it stays
 * quiet. These are the `say`/board pairs from the legacy Tutor lab's fixtures (retired with the legacy
 * UI in S10L.1) — the fixtures its browser gate put on a real screen —
 * copied verbatim, because oracle and frontend are separate packages with no
 * shared fixture module. They are known-consistent by construction, so every
 * assertion here is `false`, and a `true` means a check has started firing on
 * ordinary correct teaching.
 *
 * They also cover the shape most likely to produce a false alarm and hardest
 * to think of unprompted: a bar's label and a form of the same word appearing
 * in the sentence for entirely different reasons ("Need" the bar versus "you
 * need" the verb; "Necesito" the bar versus "necesitas" the verb).
 */
describe("the lab's own fixture copy trips nothing", () => {
  it('compare, all three locales', () => {
    expect(
      whiteboardComparisonMismatch('A shirt at Store A costs $45, and the same shirt at Store B costs $28.', {
        left: { label: 'Store A', value: 45 },
        right: { label: 'Store B', value: 28 },
      }),
    ).toBe(false);
    expect(
      whiteboardComparisonMismatch(
        'Una playera en la Tienda A cuesta 45 pesos, y en la Tienda B cuesta 28 pesos.',
        { left: { label: 'Tienda A', value: 45 }, right: { label: 'Tienda B', value: 28 } },
      ),
    ).toBe(false);
    expect(
      whiteboardComparisonMismatch('Uma camiseta na Loja A custa 45 reais, e na Loja B custa 28 reais.', {
        left: { label: 'Loja A', value: 45 },
        right: { label: 'Loja B', value: 28 },
      }),
    ).toBe(false);
  });

  it('marked_line, all three locales', () => {
    const board = {
      min: 0,
      max: 40,
      marks: [
        { value: 22, label: 'What you have' },
        { value: 35, label: 'The headphones' },
      ],
    };
    expect(whiteboardMarkedLineMismatch('You have $22 saved, and headphones cost $35.', board)).toBe(false);
    expect(
      whiteboardMarkedLineMismatch('Tienes 22 pesos ahorrados, y unos audífonos cuestan 35 pesos.', board),
    ).toBe(false);
    expect(
      whiteboardMarkedLineMismatch('Você tem 22 reais guardados, e um fone de ouvido custa 35 reais.', board),
    ).toBe(false);
  });

  it('categories, all three locales — including a label that is also a verb in the sentence', () => {
    expect(
      whiteboardCategoryMismatch(
        'Imagine you got $100. You spend $40 on something you need, $35 on something you want, and save the rest.',
        {
          categories: [
            { label: 'Need', value: 40 },
            { label: 'Want', value: 35 },
            { label: 'Saved', value: 25 },
          ],
        },
      ),
    ).toBe(false);
    expect(
      whiteboardCategoryMismatch(
        'Imagina que te dieron 100 pesos. Gastas 40 en algo que necesitas, 35 en algo que quieres, y guardas el resto.',
        {
          categories: [
            { label: 'Necesito', value: 40 },
            { label: 'Quiero', value: 35 },
            { label: 'Ahorré', value: 25 },
          ],
        },
      ),
    ).toBe(false);
    expect(
      whiteboardCategoryMismatch(
        'Imagine que você ganhou 100 reais. Gasta 40 em algo que precisa, 35 em algo que quer, e guarda o resto.',
        {
          categories: [
            { label: 'Preciso', value: 40 },
            { label: 'Quero', value: 35 },
            { label: 'Guardei', value: 25 },
          ],
        },
      ),
    ).toBe(false);
  });
});
