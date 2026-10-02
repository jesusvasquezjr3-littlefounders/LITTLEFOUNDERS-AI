import type { HorizontePack } from '../types.generated';
import { FIN2_CAPABILITIES } from './capabilities';
import { FIN2_AGE_SCOPE, FIN2_RUBRICS, FIN2_SEGMENTS } from './contract.generated';
import { FIN2_SCORERS } from './scorer.generated';

export const fin2 = {
  id: 'fin2',
  segments: FIN2_SEGMENTS,
  capabilities: FIN2_CAPABILITIES,
  rubrics: FIN2_RUBRICS,
  ageScope: FIN2_AGE_SCOPE,
  scorers: FIN2_SCORERS,
} as const satisfies HorizontePack;
