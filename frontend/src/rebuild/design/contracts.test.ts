import { describe, expect, it } from 'vitest';
import { checkCopy, copyLimit, firstViewLimit, wordCount, type CopyContext } from './copyBudget';
import { isMilestone } from './milestones';

const context: CopyContext = { locale: 'en-US', ageBand: '6-9', surface: 'app' };
describe('binding copy and reward contracts', () => {
  it('counts accented words, possessives and numeric values without ASCII bias', () => {
    expect(wordCount("Sofía's 25% são 60 moedas")).toBe(5);
    expect(wordCount('¿Cuánto ahorrarás?')).toBe(2);
  });
  it('requires translations to fit the rounded locale allowance and young-child budget', () => {
    expect(copyLimit('action', { ...context, locale: 'pt-BR' })).toBe(4);
    expect(copyLimit('prompt', context)).toBe(12);
    expect(copyLimit('prompt', { ...context, ageBand: '13-17' })).toBe(20);
    expect(firstViewLimit({ ...context, locale: 'es-MX' })).toBe(32);
    expect(firstViewLimit({ ...context, ageBand: 'adult' })).toBe(40);
    expect(firstViewLimit({ ...context, surface: 'site' })).toBeNull();
  });
  it('reports overlong text without deleting or shortening legal disclosures', () => {
    const disclosure = 'word '.repeat(100);
    expect(checkCopy(disclosure, 'legal', context)).toEqual([]);
    expect(checkCopy(disclosure, 'body', context)).toContain('word-budget');
    expect(checkCopy('Try this. Then that. One more.', 'body', context)).toContain('sentence-budget');
    expect(checkCopy('Ask Dr. Rho.', 'action', context)).toEqual([]);
    expect(checkCopy('Save 2.5 coins. Try again.', 'body', context)).toEqual([]);
    expect(checkCopy('Try — again', 'body', context)).toContain('em-dash');
  });
  it('never grants celebration to routine feedback or arbitrary streak days', () => {
    for (const event of ['correct-answer', 'coin-split', 'signup', 'streak-1', 'streak-8', 'streak-101']) {
      expect(isMilestone(event)).toBe(false);
    }
    expect(isMilestone('lesson-complete')).toBe(true);
    expect(isMilestone('streak-30')).toBe(true);
  });
});
