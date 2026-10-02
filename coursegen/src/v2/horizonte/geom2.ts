import type { ForgeHorizontePack } from './types.js';

export const GEOM2_CAPABILITIES = {
} as const;

export const geom2 = {
  id: 'geom2',
  capabilities: GEOM2_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
