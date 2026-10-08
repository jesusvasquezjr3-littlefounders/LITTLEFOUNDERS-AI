import { describe, expect, it } from 'vitest';
import { v2PublicLessonSchema } from '../services/v2LessonDocument.js';
import { v2ScorerPayload } from '../services/v2ScorerPayload.js';
import { scoreV2Visual } from '../services/v2VisualScorer.js';
import { readFileSync } from 'node:fs';

describe('personal ledger presentation preserves the shared conservation scorer', () => {
  it('accepts local personal-money labels without changing what receives credit', () => {
    const rows = JSON.parse(readFileSync(new URL('../../../coursegen/src/v2/fixtures/emitted.json', import.meta.url), 'utf8')) as Array<{ document: { segments: Array<{ type: string; payload: Record<string, unknown> }> } }>;
    const document = structuredClone(rows.find(row => row.document.segments.some(segment => segment.type === 'money.running-ledger.v2'))!.document);
    const segment = document.segments.find(item => item.type === 'money.running-ledger.v2')!;
    segment.payload = { initial: 20, sale: 10, cost: 5, maxEntries: 4, personal: true, currency: 'local' };
    expect(v2PublicLessonSchema.safeParse(document).success).toBe(true);
    const payload = v2ScorerPayload(segment);
    expect(payload).toEqual({ initial: 20, sale: 10, cost: 5, maxEntries: 4 });
    expect(scoreV2Visual('money.running-ledger.v2', payload, { entries: ['sale', 'cost'], balance: '25' }, { target_balance: 25 })).toBe('met');
    expect(scoreV2Visual('money.running-ledger.v2', payload, { entries: ['sale', 'cost'], balance: '35' }, { target_balance: 25 })).toBe('review');
  });
});
