import type { ForgeHorizontePack } from './types.js';

export const SPACE2_CAPABILITIES = {
} as const;

export const space2 = {
  id: 'space2',
  capabilities: SPACE2_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
