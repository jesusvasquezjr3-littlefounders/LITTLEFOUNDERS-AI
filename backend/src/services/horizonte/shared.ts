import { z } from 'zod';
import { v2SegmentExtras } from '../v2SegmentFamilies.js';
import type { HorizonteAgeScope } from './types.js';

export const hzId = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/);
/** The fields every v2 segment carries; a pack spreads this and adds type, grading, visual and payload. */
export const hzBase = { id: hzId, prompt: z.string().trim().min(1).max(500), ...v2SegmentExtras };
export const hzServer = z.literal('server');
export const hzUngraded = z.literal('none');
export const hzVisual = <T extends string>(type: T) => z.object({ type: z.literal(type) }).strict();

const BAND_AGES: Readonly<Record<string, readonly [number, number]>> = { '6-9': [6, 9], '10-12': [10, 12], '13-17': [13, 17], adult: [18, 119] };

/** Same rule as v2AgeScopeProblem, for a pack-declared scope; an undeclared scope is a defect, never "open to all". */
export function horizonteAgeScopeProblem(
  scope: HorizonteAgeScope | undefined,
  document: { age_band: string; eligibility: { minimum_age: number; maximum_age: number } },
): string | null {
  if (!scope) return 'This kind declares no age scope';
  const band = BAND_AGES[document.age_band];
  const { minimum_age: low, maximum_age: high } = document.eligibility;
  if (!band || high < band[0] || low > band[1]) return 'The eligibility does not match the age band';
  if (document.age_band === 'adult') return scope.adult && low >= 18 ? null : 'This kind is not open to the adult pathway';
  return low >= scope.ages[0] && high <= scope.ages[1] ? null : `This kind is open to ages ${scope.ages[0]}-${scope.ages[1]} only`;
}
