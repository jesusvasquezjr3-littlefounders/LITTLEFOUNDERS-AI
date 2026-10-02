import type { ForgeHorizontePack } from './types.js';

export const SIM2_CAPABILITIES = {
} as const;

export const sim2 = {
  id: 'sim2',
  capabilities: SIM2_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
