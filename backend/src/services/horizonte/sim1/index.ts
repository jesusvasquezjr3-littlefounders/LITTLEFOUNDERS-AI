import type { HorizontePack } from '../types.js';
import { SIM1_CAPABILITIES } from './capabilities.js';
import { SIM1_AGE_SCOPE, SIM1_RUBRICS, SIM1_SEGMENTS } from './contract.js';
import { SIM1_SCORERS } from './scorer.js';

export const sim1 = {
  id: 'sim1',
  segments: SIM1_SEGMENTS,
  capabilities: SIM1_CAPABILITIES,
  rubrics: SIM1_RUBRICS,
  ageScope: SIM1_AGE_SCOPE,
  scorers: SIM1_SCORERS,
} as const satisfies HorizontePack;
