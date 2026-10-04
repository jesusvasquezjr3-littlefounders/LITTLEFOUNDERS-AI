import type { HorizontePack } from '../types.generated';
import { SPACE2_CAPABILITIES } from './capabilities';
import { SPACE2_AGE_SCOPE, SPACE2_RUBRICS, SPACE2_SEGMENTS } from './contract.generated';
import { SPACE2_SCORERS } from './scorer.generated';

export const space2 = {
  id: 'space2',
  segments: SPACE2_SEGMENTS,
  capabilities: SPACE2_CAPABILITIES,
  rubrics: SPACE2_RUBRICS,
  ageScope: SPACE2_AGE_SCOPE,
  scorers: SPACE2_SCORERS,
} as const satisfies HorizontePack;
