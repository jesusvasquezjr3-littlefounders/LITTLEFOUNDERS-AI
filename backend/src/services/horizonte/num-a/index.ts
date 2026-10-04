import type { HorizontePack } from '../types.js';
import { NUM_A_CAPABILITIES } from './capabilities.js';
import { NUM_A_AGE_SCOPE, NUM_A_RUBRICS, NUM_A_SEGMENTS } from './contract.js';
import { NUM_A_SCORERS } from './scorer.js';

export const numA = {
  id: 'num-a',
  segments: NUM_A_SEGMENTS,
  capabilities: NUM_A_CAPABILITIES,
  rubrics: NUM_A_RUBRICS,
  ageScope: NUM_A_AGE_SCOPE,
  scorers: NUM_A_SCORERS,
} as const satisfies HorizontePack;
