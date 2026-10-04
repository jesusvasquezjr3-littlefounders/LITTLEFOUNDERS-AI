import type { HorizontePack } from '../types.generated';
import { STATS1_CAPABILITIES } from './capabilities';
import { STATS1_AGE_SCOPE, STATS1_RUBRICS, STATS1_SEGMENTS } from './contract.generated';
import { STATS1_SCORERS } from './scorer.generated';

export const stats1 = {
  id: 'stats1',
  segments: STATS1_SEGMENTS,
  capabilities: STATS1_CAPABILITIES,
  rubrics: STATS1_RUBRICS,
  ageScope: STATS1_AGE_SCOPE,
  scorers: STATS1_SCORERS,
} as const satisfies HorizontePack;
