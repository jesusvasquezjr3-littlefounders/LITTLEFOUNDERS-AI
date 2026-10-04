import type { HorizontePack } from '../types.js';
import { GEOM2_CAPABILITIES } from './capabilities.js';
import { GEOM2_AGE_SCOPE, GEOM2_RUBRICS, GEOM2_SEGMENTS } from './contract.js';
import { GEOM2_SCORERS } from './scorer.js';

export const geom2 = {
  id: 'geom2',
  segments: GEOM2_SEGMENTS,
  capabilities: GEOM2_CAPABILITIES,
  rubrics: GEOM2_RUBRICS,
  ageScope: GEOM2_AGE_SCOPE,
  scorers: GEOM2_SCORERS,
} as const satisfies HorizontePack;
