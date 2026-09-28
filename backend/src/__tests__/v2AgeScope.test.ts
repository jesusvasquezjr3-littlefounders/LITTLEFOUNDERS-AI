import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { v2PublicLessonSchema } from '../services/v2LessonDocument.js';
import { V2_AGE_SCOPE, v2AgeScopeProblem, v2PayloadScopeProblem } from '../services/v2SegmentFamilies.js';

/*
 * GAP-FIX-R2 learning (B.7 part 3; Appendix P Part 1 age column and Part 8;
 * OD-16): the first-release representations take generic parameters inside
 * their Appendix P age range, and the adult pathway opens where the money use
 * applies to adults. Every widened range is red-teamed from the Forge
 * fixtures: each emitted document is moved one year outside its kinds'
 * ranges, and to the adult pathway, and Core must refuse what is closed.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const rows = JSON.parse(readFileSync(path.resolve(here, '../../../coursegen/src/v2/fixtures/emitted.json'), 'utf8')) as Array<{ document: Record<string, any> }>; // eslint-disable-line @typescript-eslint/no-explicit-any

const scopeKey = (segment: { type: string; visual: { type: string } }) =>
  segment.type === 'money.allocation.v2' && segment.visual.type !== 'stacked-bar' ? `${segment.type}:${segment.visual.type}` : segment.type;

describe('Appendix P age scope (GAP-FIX-R2)', () => {
  it('opens each representation across its whole Appendix P range and nothing outside it', () => {
    const band = (low: number, high: number) => (low >= 18 ? 'adult' : high <= 9 ? '6-9' : high <= 12 ? (low >= 10 ? '10-12' : '6-9') : low >= 13 ? '13-17' : '10-12');
    for (const [key, scope] of Object.entries(V2_AGE_SCOPE)) {
      const [low, high] = scope.ages;
      // Each child band the range touches, clipped to the range, is open.
      for (const [bandLow, bandHigh, name] of [[6, 9, '6-9'], [10, 12, '10-12'], [13, 17, '13-17']] as const) {
        const from = Math.max(low, bandLow); const to = Math.min(high, bandHigh);
        if (from > to) continue;
        expect(v2AgeScopeProblem(key, { age_band: name, eligibility: { minimum_age: from, maximum_age: to } }), `${key} ${from}-${to}`).toBeNull();
      }
      // One year below or above the range is refused.
      if (low > 6) expect(v2AgeScopeProblem(key, { age_band: band(low - 1, low - 1), eligibility: { minimum_age: low - 1, maximum_age: low - 1 } }), `${key} below`).not.toBeNull();
      if (high < 17) expect(v2AgeScopeProblem(key, { age_band: band(high + 1, high + 1), eligibility: { minimum_age: high + 1, maximum_age: high + 1 } }), `${key} above`).not.toBeNull();
      // The adult pathway opens only where the money use applies to adults, and never to a minor's eligibility.
      expect(v2AgeScopeProblem(key, { age_band: 'adult', eligibility: { minimum_age: 18, maximum_age: 119 } }) === null, `${key} adult`).toBe(scope.adult);
      expect(v2AgeScopeProblem(key, { age_band: 'adult', eligibility: { minimum_age: 17, maximum_age: 119 } }), `${key} adult minor`).not.toBeNull();
    }
    expect(Object.entries(V2_AGE_SCOPE).filter(([, scope]) => scope.adult).map(([key]) => key).sort()).toEqual([
      'logic.rule-builder.v2', 'math.ratio-table.v2', 'math.worked-example.v2', 'money.allocation.v2:donut', 'money.running-ledger.v2',
      'money.unit-price.v2', 'visual.growth-comparison.v2', 'visual.percent-grid.v2', 'visual.tax-bracket.v2',
    ]);
  });

  it('refuses an eligibility that does not match its age band', () => {
    expect(v2AgeScopeProblem('math.fraction-area.v2', { age_band: '10-12', eligibility: { minimum_age: 7, maximum_age: 9 } })).not.toBeNull();
  });

  it('keeps generic parameters bounded: waffle totals divide 100, donuts stay under 40 wedges, children count coins', () => {
    const waffle = (total: number, step = 1, currency = 'coins') => v2PayloadScopeProblem({ type: 'money.allocation.v2', visual: { type: 'waffle' }, payload: { total, step, currency } }, '6-9');
    expect([10, 20, 25, 50, 100].map((total) => waffle(total))).toEqual([null, null, null, null, null]);
    expect(waffle(12)).not.toBeNull();
    expect(waffle(200)).not.toBeNull();
    expect(waffle(20, 2)).not.toBeNull();
    expect(waffle(20, 1, 'local')).not.toBeNull();
    const donut = (total: number, step: number) => v2PayloadScopeProblem({ type: 'money.allocation.v2', visual: { type: 'donut' }, payload: { total, step, currency: 'coins' } }, '10-12');
    expect(donut(100, 10)).toBeNull();
    expect(donut(100, 2)).not.toBeNull();
    const ratio = (band: string) => v2PayloadScopeProblem({ type: 'math.ratio-table.v2', visual: { type: 'ratio-table' }, payload: { currency: 'local' } }, band);
    expect(ratio('10-12')).not.toBeNull();
    expect(ratio('adult')).toBeNull();
  });

  it('red-teams every Forge fixture: moved outside its kinds’ ranges, Core refuses the document', () => {
    let checked = 0;
    for (const { document } of rows) {
      const keys = (document.segments as Array<{ type: string; visual: { type: string } }>).map(scopeKey).filter((key) => V2_AGE_SCOPE[key]);
      if (keys.length === 0) continue;
      expect(v2PublicLessonSchema.safeParse(document).success, document.lesson_id).toBe(true);
      const lows = keys.map((key) => V2_AGE_SCOPE[key]!.ages[0]);
      const low = Math.max(...lows);
      if (low > 6) {
        const younger = { ...document, age_band: low - 1 <= 9 ? '6-9' : low - 1 <= 12 ? '10-12' : '13-17', eligibility: { minimum_age: low - 1, maximum_age: low - 1 } };
        expect(v2PublicLessonSchema.safeParse(younger).success, `${document.lesson_id} at ${low - 1}`).toBe(false);
        checked += 1;
      }
      if (keys.some((key) => !V2_AGE_SCOPE[key]!.adult)) {
        const adult = { ...document, age_band: 'adult', eligibility: { minimum_age: 18, maximum_age: 119 } };
        expect(v2PublicLessonSchema.safeParse(adult).success, `${document.lesson_id} as adult`).toBe(false);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});
