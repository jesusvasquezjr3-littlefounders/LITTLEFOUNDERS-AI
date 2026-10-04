import type { V2Grade, V2VisualVerdict } from '../v2VisualScorer.js';
import { SAMPLE_ATTEMPT, isSeededCapabilitySet, type HorizonteAttempt } from './seed/protocol.js';
import { horizonteAgeScopeProblem } from './shared.js';
import type { HorizonteAgeScope, HorizonteScorer } from './types.js';
import { golden } from './golden/index.js';
import { numA } from './num-a/index.js';
import { numB } from './num-b/index.js';
import { balance } from './balance/index.js';
import { stats1 } from './stats1/index.js';
import { plane1 } from './plane1/index.js';
import { fin1 } from './fin1/index.js';
import { fin2 } from './fin2/index.js';
import { alg1 } from './alg1/index.js';
import { alg2 } from './alg2/index.js';
import { geom2 } from './geom2/index.js';
import { prob } from './prob/index.js';
import { com } from './com/index.js';
import { sim1 } from './sim1/index.js';
import { sim2 } from './sim2/index.js';
import { solids } from './solids/index.js';
import { space1 } from './space1/index.js';
import { space2 } from './space2/index.js';

/** Registered here once; a pack lane edits only its own folder. */
export const HORIZONTE_PACKS = [golden, numA, numB, balance, stats1, plane1, fin1, fin2, alg1, alg2, geom2, prob, com, sim1, sim2, solids, space1, space2] as const;
export const horizonteSegments = [...golden.segments, ...numA.segments, ...numB.segments, ...balance.segments, ...stats1.segments, ...plane1.segments, ...fin1.segments, ...fin2.segments, ...alg1.segments, ...alg2.segments, ...geom2.segments, ...prob.segments, ...com.segments, ...sim1.segments, ...sim2.segments, ...solids.segments, ...space1.segments, ...space2.segments] as const;
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
export const HORIZONTE_RUBRICS = {
  ...golden.rubrics,
  ...numA.rubrics,
  ...numB.rubrics,
  ...balance.rubrics,
  ...stats1.rubrics,
  ...plane1.rubrics,
  ...fin1.rubrics,
  ...fin2.rubrics,
  ...alg1.rubrics,
  ...alg2.rubrics,
  ...geom2.rubrics,
  ...prob.rubrics,
  ...com.rubrics,
  ...sim1.rubrics,
  ...sim2.rubrics,
  ...solids.rubrics,
  ...space1.rubrics,
  ...space2.rubrics,
} as const;

const SCORERS: Record<string, HorizonteScorer> = Object.assign({}, ...HORIZONTE_PACKS.map((pack) => pack.scorers));
const AGE_SCOPE: Record<string, HorizonteAgeScope> = Object.assign({}, ...HORIZONTE_PACKS.map((pack) => pack.ageScope));
const TYPES: ReadonlySet<string> = new Set(Object.keys(HORIZONTE_CAPABILITIES));

export function isHorizonteType(type: string): boolean { return TYPES.has(type); }

/** A kind whose capabilities declare the seeded run: Core issues it a seed beside the attempt token. */
export function isSeededHorizonteType(type: string): boolean {
  return TYPES.has(type) && isSeededCapabilitySet((HORIZONTE_CAPABILITIES as Record<string, readonly string[]>)[type] ?? []);
}

/** Why a Horizonte kind is not open to this document, or null; an undeclared scope is itself a problem. */
export function horizonteScopeProblem(segment: { type: string }, document: { age_band: string; eligibility: { minimum_age: number; maximum_age: number } }): string | null {
  return isHorizonteType(segment.type) ? horizonteAgeScopeProblem(AGE_SCOPE[segment.type], document) : null;
}

type Scorer = (segment: unknown, response: unknown, rubric: unknown, attempt?: HorizonteAttempt) => V2Grade;
type Sampler = (segment: unknown, rubric: unknown) => unknown;

/** The pack scorer's verdict on a well-formed sample response (publish-time key check); 'invalid' when no scorer is registered. */
export function horizonteSampleVerdict(segment: { type: string }, rubric: unknown): V2VisualVerdict {
  const scorer = SCORERS[segment.type];
  if (!scorer) return 'invalid';
  return (scorer.grade as Scorer)(segment, (scorer.sample as Sampler)(segment, rubric), rubric, SAMPLE_ATTEMPT).verdict;
}

/**
 * Server grading for a pack kind: only review and met are scores; invalid and valid are null, as for every other kind.
 * `attempt` carries the seed Core derived from the verified token; a seeded kind graded without one is never a score.
 */
export function horizonteGrade(segment: { type: string }, response: unknown, rubric: unknown, attempt?: HorizonteAttempt):
  { score: 0 | 100; correct: boolean; diagnostic: V2Grade['diagnostic']; detection?: V2Grade['detection']; cues?: V2Grade['cues']; pae?: number } | null {
  const scorer = SCORERS[segment.type];
  if (!scorer) return null;
  const graded = (scorer.grade as Scorer)(segment, response, rubric, attempt);
  if (graded.verdict === 'invalid' || graded.verdict === 'valid') return null;
  return { score: graded.verdict === 'met' ? 100 : 0, correct: graded.verdict === 'met', diagnostic: graded.diagnostic,
    ...(graded.detection ? { detection: graded.detection } : {}), ...(graded.cues ? { cues: graded.cues } : {}), ...(graded.pae !== undefined ? { pae: graded.pae } : {}) };
}
