import type { HorizontePack } from '../types.generated';
import { GOLDEN_CAPABILITIES } from './capabilities';
import { GOLDEN_AGE_SCOPE, GOLDEN_RUBRICS, GOLDEN_SEGMENTS } from './contract.generated';
import { GOLDEN_SCORERS } from './scorer.generated';

export const golden = {
  id: 'golden',
  segments: GOLDEN_SEGMENTS,
  capabilities: GOLDEN_CAPABILITIES,
  rubrics: GOLDEN_RUBRICS,
  ageScope: GOLDEN_AGE_SCOPE,
  scorers: GOLDEN_SCORERS,
} as const satisfies HorizontePack;
