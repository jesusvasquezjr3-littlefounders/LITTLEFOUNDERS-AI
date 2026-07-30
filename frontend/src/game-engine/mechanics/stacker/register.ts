// `stacker` — the slice (GAME_ENGINE.md §7).
//
// The ONLY module the registry imports, and the reason each mechanic is its own lazy
// chunk: `MECHANIC_LOADERS.stacker` dynamic-imports this file, so loading the hub loads
// no mechanic code at all.
//
// It composes and adds nothing. Schema, simulator, view and fixtures each own their
// rules; a decision that lived here would be a decision the backend parity copy — which
// builds `MechanicSimSlice` from schema.ts + simulate.ts alone — could not see.

import type { MechanicSlice } from '@/game-engine/core/types'

import { StackerView } from './components'
import { stackerFixtures } from './fixtures'
import { STACKER_SPRITE_SLOTS, stackerConfigSchema, stackerContentSchema } from './schema'
import { stackerSimulator } from './simulate'

export const stackerSlice: MechanicSlice = {
  mechanic: 'stacker',
  configSchema: stackerConfigSchema,
  contentSchema: stackerContentSchema,
  simulator: stackerSimulator,
  View: StackerView,
  fixtures: stackerFixtures,
  spriteSlots: STACKER_SPRITE_SLOTS,
}
