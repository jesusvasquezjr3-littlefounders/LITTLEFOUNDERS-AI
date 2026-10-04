import type { HorizontePack } from '../types.js';
import { GOLDEN_CAPABILITIES } from './capabilities.js';
import { GOLDEN_AGE_SCOPE, GOLDEN_RUBRICS, GOLDEN_SEGMENTS } from './contract.js';
import { GOLDEN_SCORERS } from './scorer.js';

export const golden = {
  id: 'golden',
  segments: GOLDEN_SEGMENTS,
  capabilities: GOLDEN_CAPABILITIES,
  rubrics: GOLDEN_RUBRICS,
  ageScope: GOLDEN_AGE_SCOPE,
  scorers: GOLDEN_SCORERS,
} as const satisfies HorizontePack;
