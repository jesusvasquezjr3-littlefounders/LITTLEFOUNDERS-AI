import type { HorizontePack } from '../types.generated';
import { GEOM2_CAPABILITIES } from './capabilities';
import { GEOM2_AGE_SCOPE, GEOM2_RUBRICS, GEOM2_SEGMENTS } from './contract.generated';
import { GEOM2_SCORERS } from './scorer.generated';

export const geom2 = {
  id: 'geom2',
  segments: GEOM2_SEGMENTS,
  capabilities: GEOM2_CAPABILITIES,
  rubrics: GEOM2_RUBRICS,
  ageScope: GEOM2_AGE_SCOPE,
  scorers: GEOM2_SCORERS,
} as const satisfies HorizontePack;
