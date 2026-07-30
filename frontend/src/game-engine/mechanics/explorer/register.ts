// `explorer` — the slice (GAME_ENGINE.md §7).
//
// The ONLY module the registry imports, and the reason each mechanic is its own lazy
// chunk: `MECHANIC_LOADERS.explorer` dynamic-imports this file, so loading the hub loads
// no mechanic code at all.
//
// It composes and adds nothing. Schema, simulator, view and fixtures each own their
// rules; a decision that lived here would be a decision the backend parity copy — which
// builds `MechanicSimSlice` from schema.ts + simulate.ts alone — could not see.

import type { MechanicSlice } from '@/game-engine/core/types'

import { ExplorerView } from './components'
import { explorerFixtures } from './fixtures'
import { EXPLORER_SPRITE_SLOTS, explorerConfigSchema, explorerContentSchema } from './schema'
import { explorerSimulator } from './simulate'

export const explorerSlice: MechanicSlice = {
  mechanic: 'explorer',
  configSchema: explorerConfigSchema,
  contentSchema: explorerContentSchema,
  simulator: explorerSimulator,
  View: ExplorerView,
  fixtures: explorerFixtures,
  spriteSlots: EXPLORER_SPRITE_SLOTS,
}
