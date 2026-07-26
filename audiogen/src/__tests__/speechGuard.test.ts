import { describe, expect, it } from 'vitest';
import { auditSpeechText, describeIssues, isBlocked } from '../narrate/speechGuard.js';
import { normalizeForSpeech } from '../narrate/normalizeForSpeech.js';

const codes = (text: string, locale: Parameters<typeof auditSpeechText>[1]) =>
  auditSpeechText(text, locale).map((i) => i.code);

describe('speechGuard — refuses text that reads badly aloud', () => {
  it('blocks a slash abbreviation (the "c/u" → "ce u" defect)', () => {
    const issues = auditSpeechText('5 pesos c/u', 'es-MX');
    expect(issues.map((i) => i.code)).toContain('slash-abbreviation');
    expect(isBlocked(issues)).toBe(true);
  });

  it('blocks residual currency and math symbols', () => {
    expect(codes('cuesta $5', 'es-MX')).toContain('residual-currency-symbol');
    expect(codes('5+5', 'es-MX')).toContain('residual-math-symbol');
    expect(codes('crece 10%', 'es-MX')).toContain('residual-math-symbol');
  });

  it('blocks a number glued to a word', () => {
    expect(codes('cuesta 5pesos', 'es-MX')).toContain('digit-glued-to-word');
  });

  it('blocks an unexpanded unit after a number', () => {
    expect(codes('250 ml de agua', 'es-MX')).toContain('unexpanded-unit');
    expect(codes('5 min', 'es-MX')).toContain('unexpanded-unit');
  });

  it('blocks unexpanded ordinals, per locale', () => {
    expect(codes('el 1er día', 'es-MX')).toContain('unexpanded-ordinal');
    expect(codes('the 1st day', 'en-US')).toContain('unexpanded-ordinal');
    // the es rule must not fire on English text and vice versa
    expect(codes('the 1st day', 'es-MX')).not.toContain('unexpanded-ordinal');
  });

  it('blocks a missing number agreement in es/pt but not in en', () => {
    expect(codes('compró 1 vaso', 'es-MX')).toContain('number-agreement-missing');
    expect(codes('comprou 1 copo', 'pt-BR')).toContain('number-agreement-missing');
    expect(codes('bought 1 glass', 'en-US')).not.toContain('number-agreement-missing');
  });

  it('blocks markdown residue and URLs', () => {
    expect(codes('**importante**', 'es-MX')).toContain('markdown-residue');
    expect(codes('mira [aquí](http://x.com)', 'es-MX')).toContain('markdown-residue');
    expect(codes('visita www.ejemplo.com', 'es-MX')).toContain('url-or-email');
  });

  it('warns (not blocks) on vowel-less acronyms, stray cues and repeated punctuation', () => {
    const acronym = auditSpeechText('manda un SMS hoy', 'es-MX');
    expect(acronym.map((i) => i.code)).toContain('letter-by-letter-acronym');
    expect(isBlocked(acronym)).toBe(false);
    expect(codes('Hola (sonriendo) amigo', 'es-MX')).toContain('stray-stage-direction');
    expect(codes('¡Bravo!!', 'es-MX')).toContain('repeated-punctuation');
  });

  it('allows XP and every all-caps EMPHASIS word (they contain vowels and read fine)', () => {
    expect(codes('ganaste 10 XP', 'es-MX')).not.toContain('letter-by-letter-acronym');
    // All of these came from the live corpus as false positives.
    expect(codes('la limonada NO le parece cara', 'es-MX')).not.toContain('letter-by-letter-acronym');
    expect(codes('mi ahorro CRECE cada día', 'es-MX')).not.toContain('letter-by-letter-acronym');
    expect(codes('she does NOT need it', 'en-US')).not.toContain('letter-by-letter-acronym');
    expect(codes('you count ALL the money', 'en-US')).not.toContain('letter-by-letter-acronym');
    expect(codes('o que NÃO precisa comprar', 'pt-BR')).not.toContain('letter-by-letter-acronym');
  });

  it('produces an actionable one-line description', () => {
    const text = describeIssues(auditSpeechText('5 pesos c/u', 'es-MX'));
    expect(text).toContain('slash-abbreviation');
  });
});

describe('speechGuard — the normalizer and the guard agree (no false positives)', () => {
  /*
   * The contract that matters at scale: anything normalizeForSpeech produces must
   * pass the guard. If one of these fails, either the normalizer has a gap or a
   * guard rule is too aggressive — both are bugs, and this is where they surface
   * instead of in a 1000-lesson run.
   */
  const CORPUS: Array<[string, Parameters<typeof auditSpeechText>[1]]> = [
    ['Cada vaso de limonada cuesta 5 pesos c/u. ¿Cuánto son 2 vasos?', 'es-MX'],
    ['Don Beto compró 1 vaso y 1 moneda de $1', 'es-MX'],
    ['Liruf juntó $15 el 1er día, aprox. 3 vasos', 'es-MX'],
    ['5+5=10, o sea 250 ml y 21 vasos', 'es-MX'],
    ['Dina vende 3-5 vasos y gana 10%', 'es-MX'],
    ['El Sr. Beto pidió 2x5 pesos, etc.', 'es-MX'],
    ['Beto bought 1 glass for $5 ea. on the 1st day, approx. 250 ml', 'en-US'],
    ['Lemonade costs $1 and grows 10% — 3-5 glasses, 21 cups', 'en-US'],
    ['Beto comprou 1 copo por R$5 c/u no 1º dia, aprox. 250 ml', 'pt-BR'],
    ['Dina tem 1 moeda e vende 3-5 copos, 10% a mais', 'pt-BR'],
    // Both of these came from the LIVE corpus and were false-positives until the
    // guard learned to skip injected symbol words and long emphasis caps.
    ['Recuerda: la galleta vale 3 monedas (1 + 2), el vaso chico 5', 'es-MX'],
    ["Zara dice: 'Si guardo 5 pesos de cada venta, mi ahorro CRECE cada día'", 'es-MX'],
  ];

  for (const [raw, locale] of CORPUS) {
    it(`normalized output is speakable: ${locale} "${raw.slice(0, 42)}…"`, () => {
      const spoken = normalizeForSpeech(raw, locale);
      const issues = auditSpeechText(spoken, locale);
      const blocking = issues.filter((i) => i.severity === 'block');
      expect(blocking, `blocked: ${describeIssues(blocking)} for "${spoken}"`).toEqual([]);
    });
  }

  it('emoji-decorated narration text normalizes to speakable output (the new garnish class)', () => {
    const spoken = normalizeForSpeech('¡Lo lograste! 🎉 Dina juntó $5 el 1er día', 'es-MX');
    const blocking = auditSpeechText(spoken, 'es-MX').filter((i) => i.severity === 'block');
    expect(blocking, describeIssues(blocking)).toEqual([]);
    expect(spoken).toBe('¡Lo lograste! Dina juntó 5 pesos el primer día');
  });
});

describe('speechGuard — residual emojis are a blocking defect', () => {
  it('blocks a raw emoji that somehow bypassed normalization', () => {
    const issues = auditSpeechText('¡Muy bien! 🎉', 'es-MX');
    expect(issues.some((i) => i.code === 'residual-emoji' && i.severity === 'block')).toBe(true);
  });

  it('does not flag plain punctuation-only prose', () => {
    const issues = auditSpeechText('¡Muy bien! Dina juntó 5 pesos.', 'es-MX');
    expect(issues.filter((i) => i.code === 'residual-emoji')).toEqual([]);
  });
});
