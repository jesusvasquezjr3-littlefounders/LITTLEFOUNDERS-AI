// The SYNCHRONOUS server-side mechanic registry (GAME_ENGINE.md §7, brief §5).
//
// This is the one file in `backend/src/game-contract/` that is NOT a copy of a
// frontend module, and it exists because the two registries answer different
// questions. The frontend's `registry.ts` is asynchronous on purpose — eight
// mechanics must never become one bundle every player downloads to play one game, so
// each slice is a dynamic `import()` and its own lazy chunk. Core has no bundle and
// no code-splitting concern; what it needs is to look a simulator up by id inside a
// request handler, without an await and without a React component ever entering the
// process. So it holds the React-free half of the slice (`MechanicSimSlice`:
// configSchema + contentSchema + simulator + spriteSlots) eagerly.
//
// HOW TO PLUG A NEW MECHANIC IN — the only change this file needs (Phase 3/4):
//   1. copy that mechanic's `schema.ts` and `simulate.ts` from
//      `frontend/src/game-engine/mechanics/<id>/` into
//      `backend/src/game-contract/mechanics/<id>/`, rewriting ONLY the import
//      specifiers to NodeNext `.js` form;
//   2. add the pair to `PAIRS` in `backend/scripts/game-contract-check.ts`;
//   3. replace that mechanic's `null` below with the same object shape the two
//      implemented rows use.
// Nothing else in Core changes: the route reads `getMechanic(game.mechanic)`.
//
// FORWARD COMPATIBILITY (non-negotiable, mirrors the frontend's `loadMechanic`).
// A declared-but-unimplemented mechanic is `null`, never a throwing stub: importing
// this module must be free of side effects and must never fail, and a document naming
// a mechanic this release does not implement has to degrade to a refusal the caller
// can turn into an envelope error — not a 500. `getMechanic` therefore takes a plain
// `string` (a DB column, not a narrowed type) and answers `null` for both an unknown
// id and an unimplemented one.

import type { MechanicId, MechanicSimSlice } from './core/types.js'
import { MECHANIC_IDS } from './core/types.js'

import { sorterConfigSchema, sorterContentSchema, SORTER_SPRITE_SLOTS } from './mechanics/sorter/schema.js'
import { sorterSimulator } from './mechanics/sorter/simulate.js'
import { runnerConfigSchema, runnerContentSchema, RUNNER_SPRITE_SLOTS } from './mechanics/runner/schema.js'
import { runnerSimulator } from './mechanics/runner/simulate.js'

/**
 * Every declared mechanic, implemented or not. Typed over `MechanicId`, so adding a
 * 9th id to the closed set is a compile error here until its row exists — the same
 * property the frontend's `MECHANIC_LOADERS` table has.
 */
export const GAME_MECHANICS: Record<MechanicId, MechanicSimSlice | null> = {
  sorter: {
    configSchema: sorterConfigSchema,
    contentSchema: sorterContentSchema,
    // The concrete `Simulator<SorterState>` widens to the erased `Simulator<unknown>`
    // because `Simulator.step`/`init` are declared with METHOD syntax (bivariant) in
    // core/types.ts — see the comment on `GameBots` there. No cast, no `any`.
    simulator: sorterSimulator,
    spriteSlots: SORTER_SPRITE_SLOTS,
  },
  launcher: null,
  runner: {
    configSchema: runnerConfigSchema,
    contentSchema: runnerContentSchema,
    simulator: runnerSimulator,
    spriteSlots: RUNNER_SPRITE_SLOTS,
  },
  stacker: null,
  autobattler: null,
  explorer: null,
  defender: null,
  flyer: null,
}

/** Narrows an arbitrary string (a `games.mechanic` column value) to a declared id. */
export function isMechanicId(id: string): id is MechanicId {
  return (MECHANIC_IDS as readonly string[]).includes(id)
}

/**
 * The simulation slice for a mechanic id, or `null` when this release cannot play it
 * (unknown id, or declared with no implementation yet). NEVER throws: the caller —
 * `POST /api/v1/games/:gameId/complete` — turns `null` into a refusal that grants no
 * reward, which is the correct answer for a document Core cannot re-derive a score
 * for. Silently granting the client's claimed score instead would be the exact hole
 * the replay path exists to close.
 */
export function getMechanic(id: string): MechanicSimSlice | null {
  if (!isMechanicId(id)) return null
  return GAME_MECHANICS[id]
}
