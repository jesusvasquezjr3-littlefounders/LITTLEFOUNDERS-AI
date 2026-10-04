import type { HorizontePack } from '../types.generated';
import { ALG2_CAPABILITIES } from './capabilities';
import { ALG2_AGE_SCOPE, ALG2_RUBRICS, ALG2_SEGMENTS } from './contract.generated';
import { ALG2_SCORERS } from './scorer.generated';

export const alg2 = {
  id: 'alg2',
  segments: ALG2_SEGMENTS,
  capabilities: ALG2_CAPABILITIES,
  rubrics: ALG2_RUBRICS,
  ageScope: ALG2_AGE_SCOPE,
  scorers: ALG2_SCORERS,
} as const satisfies HorizontePack;
