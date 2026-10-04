import type { HorizontePack } from '../types.generated';
import { COM_CAPABILITIES } from './capabilities';
import { COM_AGE_SCOPE, COM_RUBRICS, COM_SEGMENTS } from './contract.generated';
import { COM_SCORERS } from './scorer.generated';

export const com = {
  id: 'com',
  segments: COM_SEGMENTS,
  capabilities: COM_CAPABILITIES,
  rubrics: COM_RUBRICS,
  ageScope: COM_AGE_SCOPE,
  scorers: COM_SCORERS,
} as const satisfies HorizontePack;
