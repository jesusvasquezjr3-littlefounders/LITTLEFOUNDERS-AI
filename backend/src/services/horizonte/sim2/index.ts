import type { HorizontePack } from '../types.js';
import { SIM2_CAPABILITIES } from './capabilities.js';
import { SIM2_AGE_SCOPE, SIM2_RUBRICS, SIM2_SEGMENTS } from './contract.js';
import { SIM2_SCORERS } from './scorer.js';

export const sim2 = {
  id: 'sim2',
  segments: SIM2_SEGMENTS,
  capabilities: SIM2_CAPABILITIES,
  rubrics: SIM2_RUBRICS,
  ageScope: SIM2_AGE_SCOPE,
  scorers: SIM2_SCORERS,
} as const satisfies HorizontePack;
