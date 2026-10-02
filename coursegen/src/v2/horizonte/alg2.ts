import type { ForgeHorizontePack } from './types.js';

export const ALG2_CAPABILITIES = {
} as const;

export const alg2 = {
  id: 'alg2',
  capabilities: ALG2_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
