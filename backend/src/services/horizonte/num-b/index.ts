import type { HorizontePack } from '../types.js';
import { NUM_B_CAPABILITIES } from './capabilities.js';
import { NUM_B_AGE_SCOPE, NUM_B_RUBRICS, NUM_B_SEGMENTS } from './contract.js';
import { NUM_B_SCORERS } from './scorer.js';

export const numB = {
  id: 'num-b',
  segments: NUM_B_SEGMENTS,
  capabilities: NUM_B_CAPABILITIES,
  rubrics: NUM_B_RUBRICS,
  ageScope: NUM_B_AGE_SCOPE,
  scorers: NUM_B_SCORERS,
} as const satisfies HorizontePack;
