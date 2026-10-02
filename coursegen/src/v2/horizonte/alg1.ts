import type { ForgeHorizontePack } from './types.js';

export const ALG1_CAPABILITIES = {
} as const;

export const alg1 = {
  id: 'alg1',
  capabilities: ALG1_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
