import type { ForgeHorizontePack } from './types.js';

export const BALANCE_CAPABILITIES = {
} as const;

export const balance = {
  id: 'balance',
  capabilities: BALANCE_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
