import type { HorizontePack } from '../types.js';
import { PROB_CAPABILITIES } from './capabilities.js';
import { PROB_AGE_SCOPE, PROB_RUBRICS, PROB_SEGMENTS } from './contract.js';
import { PROB_SCORERS } from './scorer.js';

export const prob = {
  id: 'prob',
  segments: PROB_SEGMENTS,
  capabilities: PROB_CAPABILITIES,
  rubrics: PROB_RUBRICS,
  ageScope: PROB_AGE_SCOPE,
  scorers: PROB_SCORERS,
} as const satisfies HorizontePack;
