import type { ForgeHorizontePack } from './types.js';

export const SPACE1_CAPABILITIES = {
} as const;

export const space1 = {
  id: 'space1',
  capabilities: SPACE1_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
