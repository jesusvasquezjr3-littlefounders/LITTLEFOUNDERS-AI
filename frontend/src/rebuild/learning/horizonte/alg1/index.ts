import type { HorizontePack } from '../types.generated';
import { ALG1_CAPABILITIES } from './capabilities';
import { ALG1_AGE_SCOPE, ALG1_RUBRICS, ALG1_SEGMENTS } from './contract.generated';
import { ALG1_SCORERS } from './scorer.generated';

export const alg1 = {
  id: 'alg1',
  segments: ALG1_SEGMENTS,
  capabilities: ALG1_CAPABILITIES,
  rubrics: ALG1_RUBRICS,
  ageScope: ALG1_AGE_SCOPE,
  scorers: ALG1_SCORERS,
} as const satisfies HorizontePack;
