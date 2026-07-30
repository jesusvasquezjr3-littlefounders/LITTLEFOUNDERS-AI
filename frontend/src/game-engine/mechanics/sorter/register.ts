// `sorter` — the slice (GAME_ENGINE.md §7).
//
// The ONLY module the registry imports, and the reason each mechanic is its own lazy
// chunk: `MECHANIC_LOADERS.sorter` dynamic-imports this file, so loading the hub
// loads no mechanic code at all.
//
// It composes and adds nothing. Schema, simulator, view and fixtures each own their
// rules; a decision that lives here would be a decision the backend parity copy —
// which builds `MechanicSimSlice` from schema.ts + simulate.ts alone — could not see.

import type { MechanicSlice } from '@/game-engine/core/types'

import { SorterView } from './components'
import { sorterFixtures } from './fixtures'
import { SORTER_SPRITE_SLOTS, sorterConfigSchema, sorterContentSchema } from './schema'
import { sorterSimulator } from './simulate'

export const sorterSlice: MechanicSlice = {
  mechanic: 'sorter',
  configSchema: sorterConfigSchema,
  contentSchema: sorterContentSchema,
  simulator: sorterSimulator,
  View: SorterView,
  fixtures: sorterFixtures,
  spriteSlots: SORTER_SPRITE_SLOTS,
}
