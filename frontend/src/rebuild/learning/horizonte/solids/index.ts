import type { HorizontePack } from '../types.generated';
import { SOLIDS_CAPABILITIES } from './capabilities';
import { SOLIDS_AGE_SCOPE, SOLIDS_RUBRICS, SOLIDS_SEGMENTS } from './contract.generated';
import { SOLIDS_SCORERS } from './scorer.generated';

export const solids = {
  id: 'solids',
  segments: SOLIDS_SEGMENTS,
  capabilities: SOLIDS_CAPABILITIES,
  rubrics: SOLIDS_RUBRICS,
  ageScope: SOLIDS_AGE_SCOPE,
  scorers: SOLIDS_SCORERS,
} as const satisfies HorizontePack;
