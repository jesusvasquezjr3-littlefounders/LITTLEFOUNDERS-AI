// Runner — the slice (GAME_ENGINE.md §7).
//
// This is the ONLY module the registry's lazy `import()` reaches for, so it is also
// the only place in the slice that pulls the React view in. `schema.ts` and
// `simulate.ts` stay React-free on purpose: `backend/src/game-contract/` and
// `gamegen/src/contract/` build their SYNCHRONOUS `MechanicSimSlice` registry out of
// exactly those two files, and a React import there would break the parity copy.
//
// Zero cross-slice imports: everything below comes from `core/*` or from this
// directory.

import type { MechanicSlice, Simulator } from '@/game-engine/core/types'

import { RunnerView } from './components'
import { runnerFixtures } from './fixtures'
import { RUNNER_SPRITE_SLOTS, runnerConfigSchema, runnerContentSchema } from './schema'
import { runnerSimulator } from './simulate'

export const runnerSlice: MechanicSlice = {
  mechanic: 'runner',
  configSchema: runnerConfigSchema,
  contentSchema: runnerContentSchema,
  // State-erased at the slice boundary; `Simulator`'s method syntax is what makes the
  // concrete `Simulator<RunnerState>` assignable here (core/types.ts).
  simulator: runnerSimulator as Simulator<unknown>,
  View: RunnerView,
  fixtures: runnerFixtures,
  spriteSlots: RUNNER_SPRITE_SLOTS,
}
