import type { HorizontePack } from '../types.js';
import { ALG1_CAPABILITIES } from './capabilities.js';
import { ALG1_AGE_SCOPE, ALG1_RUBRICS, ALG1_SEGMENTS } from './contract.js';
import { ALG1_SCORERS } from './scorer.js';

export const alg1 = {
  id: 'alg1',
  segments: ALG1_SEGMENTS,
  capabilities: ALG1_CAPABILITIES,
  rubrics: ALG1_RUBRICS,
  ageScope: ALG1_AGE_SCOPE,
  scorers: ALG1_SCORERS,
} as const satisfies HorizontePack;
