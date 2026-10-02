import type { ForgeHorizontePack } from './types.js';

export const SOLIDS_CAPABILITIES = {
} as const;

export const solids = {
  id: 'solids',
  capabilities: SOLIDS_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
