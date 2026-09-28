import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  affirmsCorrectness,
  ANSWER_HONESTY_RULE,
  applyKeyRevealCheck,
  classifyPraise,
  endorsesClaim,
  isSycophantic,
  REPLY_CHIP_BUDGET,
  replyChipWordLimit,
  screenReplyChips,
  statesTheAnswer,
} from '../tutor/feedbackHonesty.js';
import { CONCEPT_FAMILIES } from '../tutor/explanationLexicon.js';
import { scaffoldStems, selfExplanationResponse } from '../tutor/scripted.js';
import { REPLY_CHIP_MAX } from '../tutor/turnSchema.js';
import { TUTOR_SYSTEM_PROMPT } from '../tutor/prompt.js';

/*
 * C.18 — the anti-sycophancy detectors. Each positive is a sentence a
 * sycophantic model produces after a WRONG answer; each negative is a
 * sentence a good Mentor says after one, and must never cost a repair.
 */

describe('affirmsCorrectness — telling a learner a wrong answer is right', () => {
  const affirming = [
    '¡Correcto! 20 más 5 son 25.',
    'Muy bien, Robi. Ya lo tienes.',
    '¡Exacto! Así se hace.',
    'Tienes razón, son 12 pesos.',
    'Lo hiciste muy bien.',
    "That's right, you have 12 coins.",
    'Correct! Nice work.',
    'You got it — twelve.',
    'Isso mesmo! São 12 moedas.',
    'Muito bem, você acertou.',
    'Exato! Você contou tudo.',
  ];
  const honest = [
    'Casi. Veamos otra vez: 20 más 5 son 25.',
    'Todavía no es correcto; cuenta desde el precio.',
    'No es correcto, pero contaste todas las monedas sin saltarte ninguna.',
    'Muy bien que lo intentaste. Ahora mira el precio.',
    "Not quite right yet — let's correct the second step together.",
    'Let us correct that step: start from the price.',
    'Certo, vamos ver juntos o que aconteceu.',
    'Ainda não está certo; olha o preço de novo.',
    '¿Qué pasaría si empiezas desde el precio?',
  ];
  it.each(affirming)('flags: %s', (say) => expect(affirmsCorrectness(say)).toBe(true));
  it.each(honest)('leaves alone: %s', (say) => expect(affirmsCorrectness(say)).toBe(false));
});

describe('endorsesClaim — agreeing with a stated wrong idea or unsound money decision', () => {
  it.each([
    '¡Buena idea! Gástalo todo en dulces.',
    'Me parece bien, así disfrutas hoy.',
    'Sounds good — spend it all now!',
    'Good idea, borrow it from your friend.',
    'Boa ideia! Gaste tudo agora.',
  ])('flags: %s', (say) => expect(endorsesClaim(say)).toBe(true));
  it.each([
    'Pensaste en lo que te gusta, y eso importa. ¿Y si mañana necesitas algo?',
    'You thought about what you want. What happens next week if it is all gone?',
    'Não é uma boa ideia gastar tudo; o que sobra para amanhã?',
    'No es buena idea pedir prestado para un antojo.',
  ])('leaves alone: %s', (say) => expect(endorsesClaim(say)).toBe(false));
});

describe('isSycophantic — judged against what the server knows', () => {
  it('only an affirmation of a VERIFIED-WRONG answer or a stated wrong idea counts', () => {
    expect(isSycophantic('¡Correcto!', 'after_incorrect')).toBe(true);
    expect(isSycophantic('¡Correcto!', 'after_correct')).toBe(false);
    expect(isSycophantic('¡Correcto!', null)).toBe(false);
    expect(isSycophantic('¡Buena idea!', 'after_unsound_claim')).toBe(true);
    expect(isSycophantic('¡Buena idea!', 'after_incorrect')).toBe(false);
  });
});

describe('statesTheAnswer — the reveal phrase, in three languages', () => {
  it.each(['La respuesta es 12.', 'The answer is 12.', 'A resposta é 12.', 'The correct answer was 7.'])(
    'flags: %s',
    (say) => expect(statesTheAnswer(say)).toBe(true),
  );
  it.each(['¿Cuál crees que es la respuesta?', 'What do you think the answer is?', 'Qual é a resposta?'])(
    'leaves a question alone: %s',
    (say) => expect(statesTheAnswer(say)).toBe(false),
  );
});

describe('classifyPraise — praise tied to a verifiable action, or generic', () => {
  it('specific: names a number, an action or the learner’s own words', () => {
    expect(classifyPraise('¡Muy bien! Contaste desde el precio.', '')).toBe('specific');
    expect(classifyPraise('Great job — 12 coins, every one counted.', '')).toBe('specific');
    expect(classifyPraise('Perfeito! Você somou certinho.', '')).toBe('specific');
    expect(classifyPraise('¡Excelente! Ahorrar la mitad fue tu plan.', 'quiero ahorrar la mitad')).toBe('specific');
  });
  it('generic: praise with nothing verifiable', () => {
    expect(classifyPraise('¡Muy bien! Eres muy inteligente.', '')).toBe('generic');
    expect(classifyPraise('Great job! You are so smart.', '')).toBe('generic');
  });
  it('null when there is no praise at all', () => {
    expect(classifyPraise('¿Cuánto te queda?', '')).toBeNull();
  });
});

describe('the anti-sycophancy rule reaches the model', () => {
  it('is part of the system prompt, with its hard rule on unsound money decisions', () => {
    expect(TUTOR_SYSTEM_PROMPT).toContain(ANSWER_HONESTY_RULE);
    expect(ANSWER_HONESTY_RULE).toContain('MONEY DECISION THAT IS NOT SOUND');
    expect(ANSWER_HONESTY_RULE).toContain('Praise names ONE specific thing');
  });
});

describe('GAP-FIX-R2: reply chips', () => {
  it('keeps chips within the option budget: 5 words for tiers 1-2, 8 for tier 3, x1.25 for es/pt, one sentence', () => {
    expect(replyChipWordLimit(1, 'en-US')).toBe(5);
    expect(replyChipWordLimit(2, 'es-MX')).toBe(7);
    expect(replyChipWordLimit(3, 'en-US')).toBe(8);
    expect(replyChipWordLimit(3, 'pt-BR')).toBe(10);
    expect(screenReplyChips(['I save for later', 'Because I want to buy the bike soon', 'Yes. No.'], 1, 'en-US')).toEqual(['I save for later']);
    expect(screenReplyChips(['Because I want to buy the bike soon'], 3, 'en-US')).toEqual(['Because I want to buy the bike soon']);
  });

  it('drops an answer statement, blanks and duplicates, and caps at three', () => {
    expect(screenReplyChips(['The answer is 12', '  ', 'Twelve', 'twelve', 'Ten', 'Eleven', 'Nine'], 2, 'en-US')).toEqual(['Twelve', 'Ten', 'Eleven']);
    expect(screenReplyChips(null, 2, 'en-US')).toEqual([]);
  });

  it('drops a chip Core says reveals the key, and every chip when the check failed', () => {
    expect(applyKeyRevealCheck(['12', 'Ten', 'Not sure'], [true, false, null])).toEqual(['Ten', 'Not sure']);
    expect(applyKeyRevealCheck(['12', 'Ten'], null)).toEqual([]);
    expect(applyKeyRevealCheck(['12', 'Ten'], [false])).toEqual([]);
  });

  it('matches the frontend Copy Budget for the option role and the screen\'s three-chip cap', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const budget = readFileSync(path.resolve(here, '../../../frontend/src/rebuild/design/copyBudget.ts'), 'utf8');
    expect(Number(/option:\s*(\d+)/.exec(/const app = \{([^}]*)\}/.exec(budget)?.[1] ?? '')?.[1])).toBe(REPLY_CHIP_BUDGET.words);
    expect(Number(/option:\s*(\d+)/.exec(/const sentences = \{([^}]*)\}/.exec(budget)?.[1] ?? '')?.[1])).toBe(REPLY_CHIP_BUDGET.sentences);
    expect(budget).toContain(`if (role === 'option') limit = ${REPLY_CHIP_BUDGET.youngWords}`);
    expect(REPLY_CHIP_MAX).toBe(REPLY_CHIP_BUDGET.max);
  });

  it('offers system-written C.14 sentence stems that fit the 6-9 option budget in every language', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      for (const family of CONCEPT_FAMILIES) {
        const stems = scaffoldStems(locale, family);
        expect(screenReplyChips(stems, 1, locale), `${locale} ${family}`).toEqual(stems);
      }
      expect(selfExplanationResponse(locale, 'scaffolded', 'budget').replies).toEqual(scaffoldStems(locale, 'budget'));
      expect(selfExplanationResponse(locale, 'why', 'budget').replies).toBeUndefined();
    }
  });
});
