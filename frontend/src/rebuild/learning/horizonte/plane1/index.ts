import type { HorizontePack } from '../types.generated';
import { PLANE1_CAPABILITIES } from './capabilities';
import { PLANE1_AGE_SCOPE, PLANE1_RUBRICS, PLANE1_SEGMENTS } from './contract.generated';
import { PLANE1_SCORERS } from './scorer.generated';

export const plane1 = {
  id: 'plane1',
  segments: PLANE1_SEGMENTS,
  capabilities: PLANE1_CAPABILITIES,
  rubrics: PLANE1_RUBRICS,
  ageScope: PLANE1_AGE_SCOPE,
  scorers: PLANE1_SCORERS,
} as const satisfies HorizontePack;
