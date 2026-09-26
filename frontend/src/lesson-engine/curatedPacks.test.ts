import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { segmentUnion } from './schema';

/*
 * C.6: every curated seed pack item must be renderable by the REAL Lesson
 * Engine the learner sees. Core's pack contract mirrors the five pack types'
 * payload schemas by hand (the packages share no types); this parses every
 * seed item with the frontend's own `segmentUnion`, so a drift between the
 * two fails here rather than as a blank activity in front of a child.
 */

const DIR = path.resolve(__dirname, '../../../database/seeds/tutor_packs');

describe('C.6 curated seed packs render in the Lesson Engine', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));

  it('finds the four seed pack files', () => {
    expect(files.sort()).toEqual([
      'biz.goods-vs-services.json',
      'biz.risk-and-reward.json',
      'money.fraction-of-amount.json',
      'money.percent-intro.json',
    ]);
  });

  it('parses all 84 seed items with the frontend segment schema', () => {
    let parsed = 0;
    for (const file of files) {
      const doc = JSON.parse(readFileSync(path.join(DIR, file), 'utf8')) as { packs: { tier: number; locale: string; segments: unknown[] }[] };
      for (const pack of doc.packs) {
        for (const segment of pack.segments) {
          const result = segmentUnion.safeParse(segment);
          expect(result.success, `${file} t${pack.tier} ${pack.locale} ${(segment as { id: string }).id}: ${result.success ? '' : JSON.stringify(result.error.issues)}`).toBe(true);
          parsed += 1;
        }
      }
    }
    expect(parsed).toBe(84);
  });
});
