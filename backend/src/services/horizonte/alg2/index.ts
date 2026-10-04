import type { HorizontePack } from '../types.js';
import { ALG2_CAPABILITIES } from './capabilities.js';
import { ALG2_AGE_SCOPE, ALG2_RUBRICS, ALG2_SEGMENTS } from './contract.js';
import { ALG2_SCORERS } from './scorer.js';

export const alg2 = {
  id: 'alg2',
  segments: ALG2_SEGMENTS,
  capabilities: ALG2_CAPABILITIES,
  rubrics: ALG2_RUBRICS,
  ageScope: ALG2_AGE_SCOPE,
  scorers: ALG2_SCORERS,
} as const satisfies HorizontePack;
