import { describe, expect, it } from 'vitest';
import {
  GRADUATIONS, LEARNER_REGISTERS, LEXICONS, REGISTERS, UNIVERSAL_FORBIDDEN,
  exclamationCount, findLexicons, forbiddenLexicons, graduationInto, isGenericPraise,
  offersGuidedReview, parseAgeRange, registerForAge, registerForCopyBand, registersForAgeRange,
  type LexiconId,
} from './learnerRegisterPolicy.js';

/*
 * The single register policy (B.23) and its wellbeing lexicons (B.25, B.26,
 * B.27). The same bytes are read by the UI and by Forge gates 18 and 19.
 */

const ALL = Object.keys(LEXICONS) as LexiconId[];

/** Red-team samples: each must be caught by exactly the named lexicon, in three languages. */
const RED_TEAM: Array<[LexiconId, string]> = [
  ['self-global', "You're not a saver."],
  ['self-global', 'You are hopeless at math.'],
  ['self-global', 'Wrong again.'],
  ['self-global', 'No eres bueno para el dinero.'],
  ['self-global', 'Eres pésimo con los números.'],
  ['self-global', 'Qué vergüenza.'],
  ['self-global', 'Você não é bom com números.'],
  ['self-global', 'Você falhou.'],
  ['person-praise', "You're so smart!"],
  ['person-praise', '¡Eres muy inteligente!'],
  ['person-praise', 'Você é muito esperta!'],
  ['family-finance-moralizing', 'Poor families are lazy.'],
  ['family-finance-moralizing', 'Your parents waste money.'],
  ['family-finance-moralizing', 'Las familias pobres no ahorran.'],
  ['family-finance-moralizing', 'Tus papás malgastan todo.'],
  ['family-finance-moralizing', 'Pessoas pobres são preguiçosas.'],
  ['family-finance-moralizing', 'Seus pais desperdiçam dinheiro.'],
  ['loss-mechanic', '2 hearts left'],
  ['loss-mechanic', 'Te quedan 3 vidas.'],
  ['loss-mechanic', 'Sem vidas.'],
  ['time-pressure', 'Hurry, only 2 left!'],
  ['time-pressure', '¡Última oportunidad!'],
  ['time-pressure', 'Termina hoje.'],
  ['parasocial-pressure', 'Dina is sad when you leave.'],
  ['parasocial-pressure', 'No me dejes.'],
  ['parasocial-pressure', 'Sinto sua falta.'],
  ['purchase-lure', 'Upgrade to premium'],
  ['purchase-lure', 'Desbloquea ahora con monedas'],
  ['purchase-lure', 'Compre agora'],
  ['social-pressure', 'Everyone else is ahead.'],
  ['social-pressure', 'Te estás quedando atrás.'],
  ['social-pressure', 'Você está ficando para trás.'],
  ['childish-framing', 'Hey kiddo'],
  ['childish-framing', 'Pequeño campeón'],
  ['childish-framing', 'Campeãozinho'],
];

/** Honest teaching and product copy that must pass: topics are not verdicts. */
const CLEAN = [
  'Try again: count by 5s.',
  'This step missed the interest. Check the rate.',
  'Low-income families are more likely to face surprise costs.',
  'Some families save in coins, some in a bank.',
  'Real life has trade-offs.',
  'La vida real tiene decisiones.',
  'Guardar para después es una decisión.',
  'Dívida é um tema importante.',
  'You worked out: saving toward a goal.',
  'Your best stays.',
  'Every week has 2 rest days.',
  'Your Mentor can review this with you.',
  'Pequeño',
];

describe('the register table (B.23, OD-4)', () => {
  it('has four registers with contiguous ages and a distinct framing, presence and autonomy each', () => {
    expect(LEARNER_REGISTERS).toEqual(['young', 'transition', 'teen', 'adult']);
    expect(REGISTERS.young.ages).toEqual({ min: 0, max: 9 });
    expect(REGISTERS.transition.ages).toEqual({ min: 10, max: 12 });
    expect(REGISTERS.teen.ages).toEqual({ min: 13, max: 17 });
    expect(REGISTERS.adult.ages).toEqual({ min: 18, max: null });
    // Not a re-skin of one mechanic: framing, presence and autonomy all differ across the three minor bands.
    for (const field of ['framing', 'recognition'] as const) {
      expect(new Set(['young', 'transition', 'teen'].map((r) => REGISTERS[r as 'young'].reward[field])).size).toBe(3);
    }
    expect(new Set(['young', 'transition', 'teen'].map((r) => REGISTERS[r as 'young'].mentor.presence)).size).toBe(3);
    expect(new Set(['young', 'transition', 'teen'].map((r) => REGISTERS[r as 'young'].autonomy)).size).toBe(3);
    // Bible 08: the stage shrinks with age.
    expect(REGISTERS.young.mentor.stageBandPx).toBeGreaterThan(REGISTERS.transition.mentor.stageBandPx);
    expect(REGISTERS.transition.mentor.stageBandPx).toBeGreaterThan(REGISTERS.teen.mentor.stageBandPx);
  });

  it('keeps the invariants every band shares', () => {
    for (const register of LEARNER_REGISTERS) {
      const spec = REGISTERS[register];
      expect(spec.register).toBe(register);
      expect(spec.mentor.missReaction).toBe('encouraging');
      expect(spec.social).toEqual({ comparison: 'own-history', leaderboards: 'none', peerVisibleProgress: false });
      expect(forbiddenLexicons(register)).toEqual(expect.arrayContaining([...UNIVERSAL_FORBIDDEN]));
    }
    expect(forbiddenLexicons('teen')).toContain('childish-framing');
    expect(forbiddenLexicons('young')).not.toContain('childish-framing');
    expect(REGISTERS.young.tone.genericPraise).toBe(true);
    expect(REGISTERS.transition.tone.genericPraise).toBe(false);
  });

  it('maps ages, bands and Forge tier ranges', () => {
    expect([null, 5, 9, 10, 12, 13, 17, 18, 40].map(registerForAge)).toEqual(['young', 'young', 'young', 'transition', 'transition', 'teen', 'teen', 'adult', 'adult']);
    expect(registerForCopyBand('10-12')).toBe('transition');
    expect(registersForAgeRange(8, 10)).toEqual(['young', 'transition']);
    expect(registersForAgeRange(12, 18)).toEqual(['transition', 'teen', 'adult']);
    expect(parseAgeRange('6-7')).toEqual({ min: 6, max: 7 });
    expect(parseAgeRange('18+')).toEqual({ min: 18, max: null });
    expect(parseAgeRange('ten')).toBeNull();
  });

  it('owes a graduation only after a younger register, at 10 and at 13', () => {
    expect(GRADUATIONS.map((g) => g.atAge)).toEqual([10, 13]);
    expect(graduationInto(['young'], 'transition')).toEqual({ from: 'young', to: 'transition' });
    expect(graduationInto(['young'], 'teen')).toEqual({ from: 'young', to: 'teen' });
    expect(graduationInto(['transition'], 'transition')).toBeNull();
    expect(graduationInto([], 'teen')).toBeNull();
    expect(graduationInto(['teen'], 'adult')).toBeNull();
  });

  it('offers the guided review at 3, 6, 9 and 12 consecutive misses only', () => {
    expect(Array.from({ length: 16 }, (_, i) => i).filter(offersGuidedReview)).toEqual([3, 6, 9, 12]);
  });
});

describe('the wellbeing lexicons (B.25, B.26, B.27)', () => {
  it.each(RED_TEAM)('%s catches "%s"', (lexicon, text) => {
    expect(findLexicons(text, ALL).map((m) => m.lexicon)).toContain(lexicon);
  });

  it.each(CLEAN)('passes honest copy: "%s"', (text) => {
    expect(findLexicons(text, ALL)).toEqual([]);
  });

  it('reports the phrase itself, without the consumed edge', () => {
    expect(findLexicons('Oh no, 2 hearts left', ['loss-mechanic'])).toEqual([{ lexicon: 'loss-mechanic', match: '2 hearts' }]);
  });

  it('knows generic praise and counts exclamations once per pair', () => {
    expect(['Great job!', '¡Excelente!', 'Muito bem!', 'Well done.', 'Perfect'].every(isGenericPraise)).toBe(true);
    expect(['Great job saving 10 coins first!', 'You split 20 into 10 and 10.'].some(isGenericPraise)).toBe(false);
    expect(exclamationCount('¡Lección terminada!')).toBe(1);
    expect(exclamationCount('Done.')).toBe(0);
  });
});
