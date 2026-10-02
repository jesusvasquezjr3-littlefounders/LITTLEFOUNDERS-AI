import type { ForgeHorizontePack } from './types.js';

export const PLANE1_CAPABILITIES = {
} as const;

export const plane1 = {
  id: 'plane1',
  capabilities: PLANE1_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
