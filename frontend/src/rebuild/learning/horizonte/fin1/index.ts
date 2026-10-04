import type { HorizontePack } from '../types.generated';
import { FIN1_CAPABILITIES } from './capabilities';
import { FIN1_AGE_SCOPE, FIN1_RUBRICS, FIN1_SEGMENTS } from './contract.generated';
import { FIN1_SCORERS } from './scorer.generated';

export const fin1 = {
  id: 'fin1',
  segments: FIN1_SEGMENTS,
  capabilities: FIN1_CAPABILITIES,
  rubrics: FIN1_RUBRICS,
  ageScope: FIN1_AGE_SCOPE,
  scorers: FIN1_SCORERS,
} as const satisfies HorizontePack;
