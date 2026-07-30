// `defender` — the slice (GAME_ENGINE.md §7).
//
// The ONLY module the registry imports, and the reason each mechanic is its own lazy
// chunk: `MECHANIC_LOADERS.defender` dynamic-imports this file, so loading the hub loads
// no mechanic code at all.
//
// It composes and adds nothing. Schema, simulator, view and fixtures each own their
// rules; a decision that lived here would be a decision the backend parity copy — which
// builds `MechanicSimSlice` from schema.ts + simulate.ts alone — could not see.

import type { MechanicSlice } from '@/game-engine/core/types'

import { DefenderView } from './components'
import { defenderFixtures } from './fixtures'
import { DEFENDER_SPRITE_SLOTS, defenderConfigSchema, defenderContentSchema } from './schema'
import { defenderSimulator } from './simulate'

export const defenderSlice: MechanicSlice = {
  mechanic: 'defender',
  configSchema: defenderConfigSchema,
  contentSchema: defenderContentSchema,
  simulator: defenderSimulator,
  View: DefenderView,
  fixtures: defenderFixtures,
  spriteSlots: DEFENDER_SPRITE_SLOTS,
}
