import type { HorizontePack } from '../types.js';
import { SPACE1_CAPABILITIES } from './capabilities.js';
import { SPACE1_AGE_SCOPE, SPACE1_RUBRICS, SPACE1_SEGMENTS } from './contract.js';
import { SPACE1_SCORERS } from './scorer.js';

export const space1 = {
  id: 'space1',
  segments: SPACE1_SEGMENTS,
  capabilities: SPACE1_CAPABILITIES,
  rubrics: SPACE1_RUBRICS,
  ageScope: SPACE1_AGE_SCOPE,
  scorers: SPACE1_SCORERS,
} as const satisfies HorizontePack;
