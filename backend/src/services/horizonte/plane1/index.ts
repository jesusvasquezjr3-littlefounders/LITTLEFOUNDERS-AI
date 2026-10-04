import type { HorizontePack } from '../types.js';
import { PLANE1_CAPABILITIES } from './capabilities.js';
import { PLANE1_AGE_SCOPE, PLANE1_RUBRICS, PLANE1_SEGMENTS } from './contract.js';
import { PLANE1_SCORERS } from './scorer.js';

export const plane1 = {
  id: 'plane1',
  segments: PLANE1_SEGMENTS,
  capabilities: PLANE1_CAPABILITIES,
  rubrics: PLANE1_RUBRICS,
  ageScope: PLANE1_AGE_SCOPE,
  scorers: PLANE1_SCORERS,
} as const satisfies HorizontePack;
