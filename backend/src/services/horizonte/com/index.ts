import type { HorizontePack } from '../types.js';
import { COM_CAPABILITIES } from './capabilities.js';
import { COM_AGE_SCOPE, COM_RUBRICS, COM_SEGMENTS } from './contract.js';
import { COM_SCORERS } from './scorer.js';

export const com = {
  id: 'com',
  segments: COM_SEGMENTS,
  capabilities: COM_CAPABILITIES,
  rubrics: COM_RUBRICS,
  ageScope: COM_AGE_SCOPE,
  scorers: COM_SCORERS,
} as const satisfies HorizontePack;
