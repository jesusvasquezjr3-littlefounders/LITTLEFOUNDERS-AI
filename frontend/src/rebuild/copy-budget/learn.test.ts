import { describe, it } from 'vitest';
import type { CopyRole } from '../design/copyBudget';
import { expectBudgetedGroups, expectFits, namespaceCopy } from './budget';

/* `rebuild-learn.json` (Lane 2): learner home, courses, placement, lessons and results. Youngest (6–9) budget. */

const flat: Record<string, CopyRole> = { lessonUnavailable: 'heading', lessonInvalid: 'heading', back: 'action' };

describe('rebuild-learn copy budget', () => {
  for (const [locale, strings] of namespaceCopy('learn')) {
    it(`fits the youngest copy budget in ${locale}`, () => {
      expectBudgetedGroups(strings, Object.keys(flat));
      for (const [key, role] of Object.entries(flat)) expectFits(strings[key] as string, role, locale, '6-9', key);
    });
  }
});
