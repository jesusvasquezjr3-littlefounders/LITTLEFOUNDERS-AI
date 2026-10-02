import { describe, expect, it } from 'vitest';
import { readingCell, readingDate, readingDescription, readingPart, readingSpan, readingWord } from './readingWords';

/* Horizonte F1.0: the words of the model, said in the learner's language. */

const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format;

describe('reading chart words', () => {
  it('says a model word in each locale and leaves an author label alone', () => {
    expect(readingWord('en-US', '~median')).toBe('Median');
    expect(readingWord('es-MX', '~median')).toBe('Mediana');
    expect(readingWord('pt-BR', '~median')).toBe('Mediana');
    expect(readingWord('es-MX', '~q1')).toBe('Cuartil inferior');
    expect(readingWord('pt-BR', '~gini')).toBe('Índice de Gini');
    expect(readingWord('en-US', 'Median')).toBe('Median');
    expect(readingWord('es-MX', 'Saved')).toBe('Saved');
    expect(readingWord('en-US', '~unheard of')).toBe('unheard of');
  });

  it('says the low and high of a range with its level', () => {
    expect(readingWord('en-US', '~low 80%')).toBe('Low 80%');
    expect(readingWord('es-MX', '~high 95%')).toBe('Alto 95%');
    expect(readingWord('pt-BR', '~low 50%')).toBe('Baixo 50%');
  });

  it('writes a day in digits in the order the locale uses', () => {
    expect(readingDate('en-US', '2026-09-07')).toBe('09/07/2026');
    expect(readingDate('es-MX', '2026-09-07')).toBe('07/09/2026');
    expect(readingDate('pt-BR', '2026-09-07')).toBe('07/09/2026');
    expect(readingDate('en-US', '2028-02-29')).toBe('02/29/2028');
    expect(readingCell('es-MX', '2026-09-07')).toBe('07/09/2026');
    expect(readingCell('es-MX', '~end')).toBe('Fin');
    expect(readingCell('es-MX', 'Start')).toBe('Start');
    expect(readingSpan('es-MX', '2026-09-14 – 2026-10-05')).toBe('14/09/2026 – 05/10/2026');
    expect(readingSpan('en-US', '2026-09-07')).toBe('09/07/2026');
  });

  it('reads a share as a percent of something and any other part as name and value', () => {
    expect(readingPart('en-US', '~of first %', 60, format)).toBe('60% of first');
    expect(readingPart('es-MX', '~of previous %', 50, format)).toBe('50% del anterior');
    expect(readingPart('en-US', '~median', 3, format)).toBe('Median: 3');
    expect(readingPart('pt-BR', 'Price', 1234.5, format)).toBe('Price: 1,234.5');
  });

  it('describes every mark with its dates and numbers for a screen reader', () => {
    const text = readingDescription('en-US', [
      { label: 'Start', text: '2026-09-07', parts: [] },
      { label: 'Saving', text: '2026-09-14 – 2026-10-05', parts: [{ name: '~days', value: 21 }] },
      { label: 'Visit', parts: [{ name: '~value', value: 100 }, { name: '~of first %', value: 100 }] },
    ], format);
    expect(text).toBe('Start (09/07/2026); Saving (09/14/2026 – 10/05/2026): Days: 21; Visit: Value: 100, 100% of first');
  });

  it('has every word in every locale the app ships, translated outside en-US', () => {
    const tokens = ['value', 'change', 'of first %', 'of previous %', 'people %', 'total %', 'gini', 'n', 'min', 'q1', 'median', 'q3', 'max', 'date', 'end', 'x', 'y', 'fit', 'slope', 'r2', 'days'];
    for (const locale of LOCALES) {
      for (const token of tokens) {
        const word = readingWord(locale, `~${token}`);
        expect(word.length, `${locale} ${token}`).toBeGreaterThan(0);
        if (locale !== 'en-US' && !['x', 'y'].includes(token)) expect(word, `${locale} ${token} is translated`).not.toBe(readingWord('en-US', `~${token}`));
      }
    }
  });
});
