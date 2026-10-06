import { describe, expect, it } from 'vitest';
import { v2TextBlocks } from '../v2/gates.js';
import { checkCopyBudget } from '../contentGates/copyBudget.js';

describe('visible story scenes use the actual player narrative budget', () => {
  it('blocks three visible sentences even below the old hidden-detail word budget', () => {
    const blocks = v2TextBlocks({ locale: 'en-US', segments: [{ id: 'story', type: 'story.branch.v2', payload: { scene: 'You have 20. Rent is due tomorrow. The next payment arrives Friday.' } }] });
    expect(blocks.find(block => block.path === 'payload.scene')?.role).toBe('narrative');
    expect(checkCopyBudget(blocks, 'en-US', { young: false, label: 'adult' })).toEqual([expect.objectContaining({ role: 'narrative', sentenceLimit: 2, sentences: 3 })]);
  });
});
