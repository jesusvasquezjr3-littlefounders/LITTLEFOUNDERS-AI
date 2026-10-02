import type { ForgeHorizontePack } from './types.js';

export const COM_CAPABILITIES = {
} as const;

export const com = {
  id: 'com',
  capabilities: COM_CAPABILITIES,
  guidance: [],
  gates: () => [],
} as const satisfies ForgeHorizontePack;
