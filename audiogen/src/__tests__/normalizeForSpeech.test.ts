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

  it('speaks a spaced minus between digits but never touches hyphens/ranges/words', () => {
    expect(normalizeForSpeech('8 - 3', 'es-MX')).toBe('8 menos 3');
    expect(normalizeForSpeech('e-mail', 'es-MX')).toBe('e-mail'); // hyphen untouched
    expect(normalizeForSpeech('5-10 pesos', 'es-MX')).toBe('5-10 pesos'); // range untouched
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
