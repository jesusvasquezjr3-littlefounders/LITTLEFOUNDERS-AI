import type { HorizontePack } from '../types.generated';
import { NUM_B_CAPABILITIES } from './capabilities';
import { NUM_B_AGE_SCOPE, NUM_B_RUBRICS, NUM_B_SEGMENTS } from './contract.generated';
import { NUM_B_SCORERS } from './scorer.generated';

export const numB = {
  id: 'num-b',
  segments: NUM_B_SEGMENTS,
  capabilities: NUM_B_CAPABILITIES,
  rubrics: NUM_B_RUBRICS,
  ageScope: NUM_B_AGE_SCOPE,
  scorers: NUM_B_SCORERS,
} as const satisfies HorizontePack;
