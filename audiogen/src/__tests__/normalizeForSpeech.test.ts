import { describe, expect, it } from 'vitest';
import { normalizeForSpeech } from '../narrate/normalizeForSpeech.js';

describe('normalizeForSpeech — symbols → locale words', () => {
  it('speaks "+" and "=" in the target language, not English literals', () => {
    expect(normalizeForSpeech('5+5=10', 'es-MX')).toBe('5 más 5 igual a 10');
    expect(normalizeForSpeech('5+5=10', 'en-US')).toBe('5 plus 5 equals 10');
    expect(normalizeForSpeech('5+5=10', 'pt-BR')).toBe('5 mais 5 igual a 10');
  });

  it('localizes percent', () => {
    expect(normalizeForSpeech('crece 10%', 'es-MX')).toBe('crece 10 por ciento');
    expect(normalizeForSpeech('grows 10%', 'en-US')).toBe('grows 10 percent');
    expect(normalizeForSpeech('cresce 10%', 'pt-BR')).toBe('cresce 10 por cento');
  });

  it('reads a bare "$N" as an everyday amount in the locale currency', () => {
    expect(normalizeForSpeech('cuesta $5', 'es-MX')).toBe('cuesta 5 pesos');
    expect(normalizeForSpeech('costs $5', 'en-US')).toBe('costs 5 dollars');
    expect(normalizeForSpeech('custa R$5', 'pt-BR')).toBe('custa 5 reais');
  });

  it('handles × ÷ and digit-adjacent * /', () => {
    expect(normalizeForSpeech('4×5', 'es-MX')).toBe('4 por 5');
    expect(normalizeForSpeech('20÷4', 'es-MX')).toBe('20 entre 4');
    expect(normalizeForSpeech('4*5', 'es-MX')).toBe('4 por 5');
    expect(normalizeForSpeech('20/4', 'es-MX')).toBe('20 entre 4');
  });

  it('distinguishes subtraction from a range by spacing, and never touches word hyphens', () => {
    expect(normalizeForSpeech('8 - 3', 'es-MX')).toBe('8 menos 3'); // spaced → arithmetic
    expect(normalizeForSpeech('e-mail', 'es-MX')).toBe('e-mail'); // word hyphen untouched
    expect(normalizeForSpeech('bien-estar', 'es-MX')).toBe('bien-estar');
    // CHANGED 2026-07-24 (deliberate): a tight digit-hyphen-digit used to be left
    // alone, but qwen3-tts then read "5-10 pesos" as a dash or ran the numbers
    // together. A human reads it "5 a 10 pesos", so we spell the range joiner out.
    expect(normalizeForSpeech('5-10 pesos', 'es-MX')).toBe('5 a 10 pesos');
  });

  it('turns arrows into a natural pause, not the word "arrow"', () => {
    expect(normalizeForSpeech('ahorro→alcancía', 'es-MX')).toBe('ahorro, alcancía');
  });

  it('leaves ordinary prose (no symbols) untouched', () => {
    const prose = 'Dina guarda tres pesos en su alcancía.';
    expect(normalizeForSpeech(prose, 'es-MX')).toBe(prose);
  });
});

describe('normalizeForSpeech — stage-direction parentheticals', () => {
  it('drops a whole-parenthetical acting cue', () => {
    expect(normalizeForSpeech('¡Vamos! (con entusiasmo)', 'es-MX')).toBe('¡Vamos!');
    expect(normalizeForSpeech("Let's go! (smiles)", 'en-US')).toBe("Let's go!");
    expect(normalizeForSpeech('Vamos! (sorrindo)', 'pt-BR')).toBe('Vamos!');
  });

  it('KEEPS meaningful parentheticals — anything with a number or that is real content', () => {
    expect(normalizeForSpeech('El vaso cuesta cinco (5 pesos)', 'es-MX')).toBe('El vaso cuesta cinco (5 pesos)');
    expect(normalizeForSpeech('Cuenta las cosas (limones, vasos)', 'es-MX')).toBe('Cuenta las cosas (limones, vasos)');
    expect(normalizeForSpeech('la máquina duplicaba (si entraba 1, salían 2)', 'es-MX')).toBe('la máquina duplicaba (si entraba 1, salían 2)');
  });

  it('does not leave a dangling double space after dropping a cue', () => {
    expect(normalizeForSpeech('Hola (sonríe) socio', 'es-MX')).toBe('Hola socio');
  });
});

/*
 * Naturalness regressions reported by the owner after listening to real
 * narration (2026-07-24). Each `it` below is a defect a child actually heard.
 */
describe('normalizeForSpeech — abbreviations must never be spelled letter by letter', () => {
  it('expands "c/u" (was heard as "ce u")', () => {
    expect(normalizeForSpeech('Cada vaso cuesta 5 pesos c/u', 'es-MX')).toBe('Cada vaso cuesta 5 pesos cada uno');
    expect(normalizeForSpeech('5 reais c/u', 'pt-BR')).toBe('5 reais cada um');
    expect(normalizeForSpeech('5 dollars ea.', 'en-US')).toBe('5 dollars each');
  });

  it('expands courtesy titles and common abbreviations', () => {
    expect(normalizeForSpeech('El Sr. Beto y la Sra. Rosa', 'es-MX')).toBe('El señor Beto y la señora Rosa');
    expect(normalizeForSpeech('aprox. 10 pesos', 'es-MX')).toBe('aproximadamente 10 pesos');
    expect(normalizeForSpeech('limones, vasos, etc.', 'es-MX')).toBe('limones, vasos, etcétera');
    expect(normalizeForSpeech('Mr. Beto', 'en-US')).toBe('Mister Beto');
  });

  it('expands units only after a number, agreeing in number', () => {
    expect(normalizeForSpeech('250 ml de agua', 'es-MX')).toBe('250 mililitros de agua');
    expect(normalizeForSpeech('1 kg de limones', 'es-MX')).toBe('un kilo de limones');
    expect(normalizeForSpeech('espera 5 min', 'es-MX')).toBe('espera 5 minutos');
  });
});

describe('normalizeForSpeech — number agreement (es/pt)', () => {
  it('speaks "1" before a masculine noun as the apocopated article (the reported bug)', () => {
    // Reported verbatim: "Don Beto compró 1 vaso" was narrated "compró UNO vaso".
    expect(normalizeForSpeech('Don Beto compró 1 vaso', 'es-MX')).toBe('Don Beto compró un vaso');
    expect(normalizeForSpeech('Liruf vendió 1 limón', 'es-MX')).toBe('Liruf vendió un limón');
    expect(normalizeForSpeech('Beto comprou 1 copo', 'pt-BR')).toBe('Beto comprou um copo');
  });

  it('speaks "1" before a feminine noun as the feminine article', () => {
    expect(normalizeForSpeech('Dina tiene 1 moneda', 'es-MX')).toBe('Dina tiene una moneda');
    expect(normalizeForSpeech('falta 1 jarra', 'es-MX')).toBe('falta una jarra');
    expect(normalizeForSpeech('Dina tem 1 moeda', 'pt-BR')).toBe('Dina tem uma moeda');
  });

  it('agrees currency in number so "$1" is never "un pesos"', () => {
    expect(normalizeForSpeech('cuesta $1', 'es-MX')).toBe('cuesta un peso');
    expect(normalizeForSpeech('costs $1', 'en-US')).toBe('costs 1 dollar');
  });

  it('handles numbers ending in 1 above twenty', () => {
    expect(normalizeForSpeech('21 vasos', 'es-MX')).toBe('veintiún vasos');
    expect(normalizeForSpeech('21 monedas', 'es-MX')).toBe('veintiuna monedas');
    expect(normalizeForSpeech('31 copos', 'pt-BR')).toBe('trinta e um copos');
  });

  it('leaves other numbers as digits (a child follows "147 pesos" better than words)', () => {
    expect(normalizeForSpeech('147 pesos', 'es-MX')).toBe('147 pesos');
    expect(normalizeForSpeech('vendió 3 vasos', 'es-MX')).toBe('vendió 3 vasos');
  });

  it('does not corrupt arithmetic that happens to start with 1', () => {
    expect(normalizeForSpeech('1+1=2', 'es-MX')).toBe('1 más 1 igual a 2');
    expect(normalizeForSpeech('crece 1%', 'es-MX')).toBe('crece 1 por ciento');
  });

  it('leaves English alone (no grammatical gender)', () => {
    expect(normalizeForSpeech('Beto bought 1 glass', 'en-US')).toBe('Beto bought 1 glass');
  });
});

describe('normalizeForSpeech — ordinals and ranges', () => {
  it('speaks Spanish ordinal digit forms with the right apocope', () => {
    expect(normalizeForSpeech('el 1er día', 'es-MX')).toBe('el primer día');
    expect(normalizeForSpeech('la 1a venta', 'es-MX')).toBe('la primera venta');
    expect(normalizeForSpeech('el 2do vaso', 'es-MX')).toBe('el segundo vaso');
  });

  it('speaks English ordinals', () => {
    expect(normalizeForSpeech('the 1st day', 'en-US')).toBe('the first day');
    expect(normalizeForSpeech('the 3rd glass', 'en-US')).toBe('the third glass');
  });

  it('reads a numeric range with the locale joiner, not as a minus', () => {
    expect(normalizeForSpeech('entre 3-5 pesos', 'es-MX')).toBe('entre 3 a 5 pesos');
    expect(normalizeForSpeech('3-5 dollars', 'en-US')).toBe('3 to 5 dollars');
  });

  it('reads "2x5" as a product', () => {
    expect(normalizeForSpeech('2x5 pesos', 'es-MX')).toBe('2 por 5 pesos');
  });
});

describe('normalizeForSpeech — blank placeholders read as a pause', () => {
  it('turns underscore runs into an ellipsis (a fill-in sign is narrated with a pause)', () => {
    expect(normalizeForSpeech("Un letrero: '2 vasos por ___ pesos'", 'es-MX')).toBe("Un letrero: '2 vasos por … pesos'");
    expect(normalizeForSpeech('2 cups for ___ dollars', 'en-US')).toBe('2 cups for … dollars');
  });

  it('never leaves "__" for the speechGuard markdown-residue rule to refuse', async () => {
    const { auditSpeechText } = await import('../narrate/speechGuard.js');
    const spoken = normalizeForSpeech("Quiere un letrero: '2 vasos por ___ pesos'. Arma el letrero.", 'es-MX');
    expect(auditSpeechText(spoken, 'es-MX').filter((i) => i.severity === 'block')).toEqual([]);
  });
});

describe('normalizeForSpeech — emojis never reach the TTS', () => {
  it('strips a sentence-final decorative emoji (the sanctioned garnish position)', () => {
    expect(normalizeForSpeech('¡Lo lograste! 🎉', 'es-MX')).toBe('¡Lo lograste!');
    expect(normalizeForSpeech('You did it! 🎉', 'en-US')).toBe('You did it!');
    expect(normalizeForSpeech('Você conseguiu! 🎉', 'pt-BR')).toBe('Você conseguiu!');
  });

  it('strips a mid-sentence emoji without gluing words together', () => {
    expect(normalizeForSpeech('Dina 💰 guarda sus monedas', 'es-MX')).toBe('Dina guarda sus monedas');
  });

  it('strips ZWJ family sequences, skin tones, variation selectors and flag pairs', () => {
    expect(normalizeForSpeech('la familia 👨‍👩‍👧‍👦 ahorra', 'es-MX')).toBe('la familia ahorra');
    expect(normalizeForSpeech('bien 👍🏽 hecho', 'es-MX')).toBe('bien hecho');
    expect(normalizeForSpeech('listo ✔️ ya', 'es-MX')).toBe('listo ya');
    expect(normalizeForSpeech('México 🇲🇽 lindo', 'es-MX')).toBe('México lindo');
  });

  it('an emoji-only text normalizes to empty (extractNarratables then drops the unit)', () => {
    expect(normalizeForSpeech('🎉✨', 'es-MX')).toBe('');
  });

  it('emoji stripping does not break the arrow→pause conversion (➡ is itself pictographic)', () => {
    expect(normalizeForSpeech('ahorro➡alcancía', 'es-MX')).toBe('ahorro, alcancía');
  });

  it('EXPANDS emoji math operators instead of deleting them — "2➕3" must never become "2 3"', () => {
    expect(normalizeForSpeech('Dina gana 2➕3 pesos', 'es-MX')).toBe('Dina gana 2 más 3 pesos');
    expect(normalizeForSpeech('2✖3 vasos', 'es-MX')).toBe('2 por 3 vasos');
    expect(normalizeForSpeech('20➗4', 'es-MX')).toBe('20 entre 4');
    expect(normalizeForSpeech('8 ➖ 3', 'es-MX')).toBe('8 menos 3');
    expect(normalizeForSpeech('2➕3', 'en-US')).toBe('2 plus 3');
  });

  it('keeps symbol expansion working alongside emojis', () => {
    expect(normalizeForSpeech('ganó $5 🎉', 'es-MX')).toBe('ganó 5 pesos');
  });
});
