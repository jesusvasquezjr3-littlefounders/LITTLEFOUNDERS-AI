import type { HorizontePack } from '../types.generated';
import { SIM2_CAPABILITIES } from './capabilities';
import { SIM2_AGE_SCOPE, SIM2_RUBRICS, SIM2_SEGMENTS } from './contract.generated';
import { SIM2_SCORERS } from './scorer.generated';

export const sim2 = {
  id: 'sim2',
  segments: SIM2_SEGMENTS,
  capabilities: SIM2_CAPABILITIES,
  rubrics: SIM2_RUBRICS,
  ageScope: SIM2_AGE_SCOPE,
  scorers: SIM2_SCORERS,
} as const satisfies HorizontePack;
