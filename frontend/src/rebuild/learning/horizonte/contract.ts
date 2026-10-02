import type { V2VisualVerdict } from '../v2VisualScorer.generated';
import { horizonteAgeScopeProblem } from './shared.generated';
import type { HorizonteAgeScope, HorizonteScorer } from './types.generated';
import { golden } from './golden/index';
import { numA } from './num-a/index';
import { numB } from './num-b/index';
import { balance } from './balance/index';
import { stats1 } from './stats1/index';
import { plane1 } from './plane1/index';
import { fin1 } from './fin1/index';
import { fin2 } from './fin2/index';
import { alg1 } from './alg1/index';
import { alg2 } from './alg2/index';
import { geom2 } from './geom2/index';
import { prob } from './prob/index';
import { com } from './com/index';
import { sim1 } from './sim1/index';
import { sim2 } from './sim2/index';
import { solids } from './solids/index';
import { space1 } from './space1/index';
import { space2 } from './space2/index';

/** Registered here once; a pack lane edits only its own folder. */
export const HORIZONTE_PACKS = [golden, numA, numB, balance, stats1, plane1, fin1, fin2, alg1, alg2, geom2, prob, com, sim1, sim2, solids, space1, space2] as const;
export const HORIZONTE_SEGMENTS = [...golden.segments, ...numA.segments, ...numB.segments, ...balance.segments, ...stats1.segments, ...plane1.segments, ...fin1.segments, ...fin2.segments, ...alg1.segments, ...alg2.segments, ...geom2.segments, ...prob.segments, ...com.segments, ...sim1.segments, ...sim2.segments, ...solids.segments, ...space1.segments, ...space2.segments] as const;
export const HORIZONTE_CAPABILITIES = {
  ...golden.capabilities,
  ...numA.capabilities,
  ...numB.capabilities,
  ...balance.capabilities,
  ...stats1.capabilities,
  ...plane1.capabilities,
  ...fin1.capabilities,
  ...fin2.capabilities,
  ...alg1.capabilities,
  ...alg2.capabilities,
  ...geom2.capabilities,
  ...prob.capabilities,
  ...com.capabilities,
  ...sim1.capabilities,
  ...sim2.capabilities,
  ...solids.capabilities,
  ...space1.capabilities,
  ...space2.capabilities,
} as const;
export type HorizonteSegment = import('zod').infer<(typeof HORIZONTE_SEGMENTS)[number]>;

const SCORERS: Record<string, HorizonteScorer> = Object.assign({}, ...HORIZONTE_PACKS.map((pack) => pack.scorers));
const AGE_SCOPE: Record<string, HorizonteAgeScope> = Object.assign({}, ...HORIZONTE_PACKS.map((pack) => pack.ageScope));
const TYPES: ReadonlySet<string> = new Set(Object.keys(HORIZONTE_CAPABILITIES));

export function isHorizonteType(type: string): boolean { return TYPES.has(type); }
export function isHorizonteSegment(segment: { type: string }): segment is HorizonteSegment { return TYPES.has(segment.type); }

export function horizonteScopeProblem(segment: { type: string }, document: { age_band: string; eligibility: { minimum_age: number; maximum_age: number } }): string | null {
  return isHorizonteType(segment.type) ? horizonteAgeScopeProblem(AGE_SCOPE[segment.type], document) : null;
}

/** Advisory instant feedback, never a grade: the browser has no rubric, so a pack scorer can only say invalid or valid. */
export function horizonteClientVerdict(segment: { type: string }, answer: unknown): 'valid' | 'invalid' | undefined {
  const scorer = SCORERS[segment.type];
  if (!scorer) return undefined;
  try {
    const verdict: V2VisualVerdict = (scorer.grade as unknown as (segment: unknown, response: unknown, rubric: undefined) => { verdict: V2VisualVerdict })(segment, answer, undefined).verdict;
    return verdict === 'invalid' ? 'invalid' : 'valid';
  } catch {
    return 'invalid';
  }
}
