import type { HorizontePack } from '../types.generated';
import { BALANCE_CAPABILITIES } from './capabilities';
import { BALANCE_AGE_SCOPE, BALANCE_RUBRICS, BALANCE_SEGMENTS } from './contract.generated';
import { BALANCE_SCORERS } from './scorer.generated';

export const balance = {
  id: 'balance',
  segments: BALANCE_SEGMENTS,
  capabilities: BALANCE_CAPABILITIES,
  rubrics: BALANCE_RUBRICS,
  ageScope: BALANCE_AGE_SCOPE,
  scorers: BALANCE_SCORERS,
} as const satisfies HorizontePack;
