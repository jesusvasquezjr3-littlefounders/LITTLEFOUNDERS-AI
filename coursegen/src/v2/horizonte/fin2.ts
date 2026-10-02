import type { ForgeHorizontePack } from './types.js';

export const FIN2_CAPABILITIES = {
} as const;

export const fin2 = {
  id: 'fin2',
  capabilities: FIN2_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
