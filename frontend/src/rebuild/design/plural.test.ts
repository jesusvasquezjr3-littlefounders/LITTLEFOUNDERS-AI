import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pluralAmount, pluralUnit } from './plural';
import { conceptMoney } from '../learning/conceptCopy';
import { learningRhythmCopy } from '../learning/LearningRhythmView';

/*
 * GAP-FIX-R4 (Appendix P Part 5; Bible 05 §5): plurals follow each locale's
 * CLDR categories through Intl.PluralRules, never `n === 1` concatenation.
 */

const coins = { 'en-US': { one: 'coin', other: 'coins' }, 'es-MX': { one: 'moneda', other: 'monedas' }, 'pt-BR': { one: 'moeda', other: 'moedas' } } as const;

describe('locale plurals', () => {
  it('puts pt-BR 0 (and 1.5) in the "one" form, and en-US / es-MX 0 in "other"', () => {
    expect(pluralUnit('pt-BR', 0, coins['pt-BR'])).toBe('moeda');
    expect(pluralUnit('pt-BR', 1.5, coins['pt-BR'])).toBe('moeda');
    expect(pluralUnit('pt-BR', 2, coins['pt-BR'])).toBe('moedas');
    expect(pluralUnit('en-US', 0, coins['en-US'])).toBe('coins');
    expect(pluralUnit('es-MX', 0, coins['es-MX'])).toBe('monedas');
    expect(pluralUnit('en-US', 1, coins['en-US'])).toBe('coin');
    // A negative amount (a balance below zero) takes the category of its magnitude.
    expect(pluralUnit('en-US', -1, coins['en-US'])).toBe('coin');
    expect(pluralAmount('pt-BR', 0, coins['pt-BR'])).toBe('0 moeda');
    expect(pluralAmount('en-US', 1250, coins['en-US'])).toBe('1,250 coins');
  });

  it('falls back to "other" for a category the copy does not carry (es-MX "many")', () => {
    expect(pluralUnit('es-MX', 1_000_000, coins['es-MX'])).toBe('monedas');
  });

  it('reaches the boards: concept money and the rhythm view', () => {
    expect(conceptMoney('pt-BR', 'coins')(0)).toBe('0 moeda');
    expect(conceptMoney('en-US', 'coins')(0)).toBe('0 coins');
    expect(learningRhythmCopy['pt-BR'].days(0)).toBe('dia');
    expect(learningRhythmCopy['en-US'].days(0)).toBe('days');
  });

  it('leaves no `=== 1 ?` unit choice on the learning boards', () => {
    const root = join(__dirname, '../learning');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && !/\.generated\./.test(name)) files.push(path);
      }
    };
    walk(root);
    const offenders = files.filter((file) => /=== 1 \? (?:t\.[a-z]\w* :|'[A-Za-zÀ-ú]+' :|coinWord)/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
