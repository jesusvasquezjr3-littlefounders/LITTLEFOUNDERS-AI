import type { ForgeHorizontePack } from './types.js';

export const FIN1_CAPABILITIES = {
} as const;

export const fin1 = {
  id: 'fin1',
  capabilities: FIN1_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
