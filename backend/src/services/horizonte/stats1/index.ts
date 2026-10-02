import type { HorizontePack } from '../types.js';
import { STATS1_CAPABILITIES } from './capabilities.js';
import { STATS1_AGE_SCOPE, STATS1_RUBRICS, STATS1_SEGMENTS } from './contract.js';
import { STATS1_SCORERS } from './scorer.js';

export const stats1 = {
  id: 'stats1',
  segments: STATS1_SEGMENTS,
  capabilities: STATS1_CAPABILITIES,
  rubrics: STATS1_RUBRICS,
  ageScope: STATS1_AGE_SCOPE,
  scorers: STATS1_SCORERS,
} as const satisfies HorizontePack;
