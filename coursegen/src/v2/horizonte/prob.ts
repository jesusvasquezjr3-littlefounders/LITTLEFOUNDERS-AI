import type { ForgeHorizontePack } from './types.js';

export const PROB_CAPABILITIES = {
} as const;

export const prob = {
  id: 'prob',
  capabilities: PROB_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
