import type { HorizontePack } from '../types.generated';
import { PROB_CAPABILITIES } from './capabilities';
import { PROB_AGE_SCOPE, PROB_RUBRICS, PROB_SEGMENTS } from './contract.generated';
import { PROB_SCORERS } from './scorer.generated';

export const prob = {
  id: 'prob',
  segments: PROB_SEGMENTS,
  capabilities: PROB_CAPABILITIES,
  rubrics: PROB_RUBRICS,
  ageScope: PROB_AGE_SCOPE,
  scorers: PROB_SCORERS,
} as const satisfies HorizontePack;
