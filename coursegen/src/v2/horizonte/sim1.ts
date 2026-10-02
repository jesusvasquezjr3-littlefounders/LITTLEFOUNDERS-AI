import type { ForgeHorizontePack } from './types.js';

export const SIM1_CAPABILITIES = {
} as const;

export const sim1 = {
  id: 'sim1',
  capabilities: SIM1_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
