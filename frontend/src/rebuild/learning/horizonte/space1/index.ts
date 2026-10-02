import type { HorizontePack } from '../types.generated';
import { SPACE1_CAPABILITIES } from './capabilities';
import { SPACE1_AGE_SCOPE, SPACE1_RUBRICS, SPACE1_SEGMENTS } from './contract.generated';
import { SPACE1_SCORERS } from './scorer.generated';

export const space1 = {
  id: 'space1',
  segments: SPACE1_SEGMENTS,
  capabilities: SPACE1_CAPABILITIES,
  rubrics: SPACE1_RUBRICS,
  ageScope: SPACE1_AGE_SCOPE,
  scorers: SPACE1_SCORERS,
} as const satisfies HorizontePack;
