import { describe, expect, it } from 'vitest';
import {
  classifyCheckInReply,
  contentWords,
  countWords,
  foldText,
  isHedging,
  isOffTopic,
  isTerseReply,
  normalizeAnswer,
} from '../tutor/telemetryLexicon.js';

/*
 * C.9 / C.19: the lexical detectors of the Behavioral Telemetry Layer. These
 * are the per-function contracts; the paired dialect / ASR-artifact parity of
 * the same detectors is proven by the C.20 bias audit (`biasAudit.test.ts`).
 */

describe('folding and counting', () => {
  it('folds accents, case and curly apostrophes the way speech-to-text output arrives', () => {
    expect(foldText('  No SÉ,  ¿qué   es?  ')).toBe('no se, ¿que es?');
    expect(foldText('I don’t know')).toBe("i don't know");
    expect(foldText('Não sei')).toBe('nao sei');
  });

  it('counts words, not characters or punctuation', () => {
    expect(countWords("I'd save it for the bike.")).toBe(6);
    expect(countWords('...')).toBe(0);
    expect(countWords('veinticinco pesos')).toBe(2);
  });
});

describe('hedging and uncertainty language', () => {
  it.each([
    ['en-US', "I don't know"],
    ['en-US', 'idk'],
    ['en-US', 'i dunno man'],
    ['en-US', 'I guess it is 5?'],
    ['en-US', "that don't make no sense"],
    ['en-US', "I ain't sure"],
    ['en-US', 'this is so confusing'],
    ['es-MX', 'No sé'],
    ['es-MX', 'no se, creo que 20'],
    ['es-MX', 'ni idea'],
    ['es-MX', 'a lo mejor son 10'],
    ['es-MX', 'igual y son 10'],
    ['es-MX', 'no le entiendo'],
    ['es-MX', 'nose'],
    ['pt-BR', 'não sei'],
    ['pt-BR', 'nao sei'],
    ['pt-BR', 'sei lá'],
    ['pt-BR', 'acho que é 10'],
    ['pt-BR', 'tô meio confuso'],
  ] as const)('%s: "%s" hedges', (locale, text) => {
    expect(isHedging(text, locale)).toBe(true);
  });

  it.each([
    ['en-US', 'I would save ten dollars every week'],
    ['en-US', 'my nose is itchy'],
    ['es-MX', 'no se puede gastar todo'],
    ['es-MX', 'ahorro diez pesos cada semana'],
    ['pt-BR', 'eu guardo dez reais por semana'],
  ] as const)('%s: "%s" does not hedge', (locale, text) => {
    expect(isHedging(text, locale)).toBe(false);
  });

  it('reads "nose" as "no sé" only in a Spanish session', () => {
    expect(isHedging('nose', 'es-MX')).toBe(true);
    expect(isHedging('nose', 'en-US')).toBe(false);
  });
});

describe('terse replies', () => {
  it.each(['k', 'ok', 'Fine.', 'whatever', 'bet', 'aight', 'sale', 'va', 'equis', 'blz', 'tanto faz', '...', '?'])(
    '"%s" is minimal',
    (text) => expect(isTerseReply(text)).toBe(true),
  );

  it.each(['yes', 'no', '25', 'I would buy the bike', 'la bici', 'guardo o dinheiro', ''])('"%s" is not', (text) =>
    expect(isTerseReply(text)).toBe(false),
  );
});

describe('off-topic drift', () => {
  const topic = 'How much would you save each week for the bike? Saving money for a goal';

  it('flags a contentful message that shares nothing with the lesson', () => {
    expect(isOffTopic('I played fortnite with my cousin yesterday', topic)).toBe(true);
    expect(isOffTopic('ayer jugué futbol con mis primos en el parque', topic)).toBe(true);
  });

  it('never flags lesson vocabulary, regional money words, questions about the lesson or numbers', () => {
    expect(isOffTopic('I would put my bread in the piggy bank', topic)).toBe(false);
    expect(isOffTopic('yo juntaría la lana para la bici', topic)).toBe(false);
    expect(isOffTopic('eu juntaria a grana pra bicicleta', topic)).toBe(false);
    expect(isOffTopic('can you explain it again with another example', topic)).toBe(false);
    expect(isOffTopic('maybe 5 every single week', topic)).toBe(false);
  });

  it('does not judge short messages or an empty lesson context', () => {
    expect(isOffTopic('do you like minecraft', topic)).toBeNull();
    expect(isOffTopic('I played fortnite with my cousin yesterday', '')).toBeNull();
  });

  it('canonicalizes regional synonyms to one key', () => {
    const words = contentWords('lana feria varo dinero');
    expect([...words]).toEqual(['money']);
  });
});

describe('answer normalization (repeated identical answers)', () => {
  it.each([
    ['en-US', '25'],
    ['en-US', 'twenty five'],
    ['en-US', 'twenty-five dollars'],
    ['en-US', "I think it's 25"],
    ['es-MX', 'veinticinco'],
    ['es-MX', 'veinticinco pesos'],
    ['es-MX', 'son 25'],
    ['pt-BR', 'vinte e cinco reais'],
    ['pt-BR', 'é 25'],
  ] as const)('%s: "%s" → 25', (locale, text) => {
    expect(normalizeAnswer(text, locale)).toBe('25');
  });

  it('keeps different answers different', () => {
    expect(normalizeAnswer('una bici', 'es-MX')).not.toBe(normalizeAnswer('una pelota', 'es-MX'));
    expect(normalizeAnswer('five twenty', 'en-US')).toBe('5 20');
    expect(normalizeAnswer('ciento veinticinco', 'es-MX')).toBe('125');
    expect(normalizeAnswer('one hundred', 'en-US')).toBe('100');
  });
});

describe('the answer to the check-in (C.19)', () => {
  it.each([
    'not really',
    "I'm lost",
    "I still don't get it",
    'no',
    'nah',
    'nel',
    'la verdad no',
    'no le entiendo',
    'más o menos',
    'não',
    'não entendi',
    'tô perdido',
    'kinda',
  ])('"%s" asks for repair', (text) => expect(classifyCheckInReply(text)).toBe('misaligned'));

  it.each(['yes', 'yeah we good', 'got it', 'no problem', 'sí', 'simón', 'va', 'todo bien', 'sim', 'tudo certo', 'sussa', 'no, I get it'])(
    '"%s" continues',
    (text) => expect(classifyCheckInReply(text)).toBe('aligned'),
  );

  it.each(['25', 'I would save it', 'what is interest?', ''])('"%s" is unclear (answered as an ordinary turn)', (text) =>
    expect(classifyCheckInReply(text)).toBe('unclear'),
  );
});
