// `stacker` — the HEADLESS BOTS (GAME_ENGINE.md §9).
//
// A SEPARATE MODULE ON PURPOSE, and the separation is a security boundary, not tidiness.
// `perfect` plays this mechanic optimally and returns the exact `GameInputEvent[]` that
// Core replays to grant XP — and a maximal log is only a handful of events long. While
// the bots hung off `stackerSimulator`, `register.ts` pulled them into the mechanic's lazy
// chunk and the browser shipped a working cheat: lift the function out of the emitted
// JS, run it headless, POST the log, collect the XP without ever playing.
//
// The bots exist for the `simulate` winnability gate (gamegen) and for the test suites.
// Neither runs in a browser, so both import THIS module directly, and nothing on the
// client import graph — `register.ts`, `components.tsx`, `GamePlayer` — may reference
// it. `Simulator` has no `bots` member at all (core/types.ts), so a bot-less simulator
// is the NORMAL shape: that is what stops the leak from being re-opened by someone
// helpfully "completing" the simulator literal.
//
// Everything here is still bound by the §5 determinism contract. The bots drive the same
// `step()` the browser and Core run, so a bot reaching for `Math.random()` would make the
// gate measure a run nobody can reproduce.

import type { GameBots, GameInputEvent, Rng } from '../../core/types.js'

// `suggestPiece` deliberately stays in simulate.ts: it is the in-game ASSIST
// (`adaptive.assist_toggleable`), which the view renders, so it is client code by
// product design. What leaves is the bot's use of it — the placement loop, the ready
// call and the flailing counterpart.
import { suggestPiece } from './simulate.js'
import type { StackerState } from './simulate.js'

// ---- Bots -------------------------------------------------------------------------

interface Placement {
  itemId: string
  x: number
}

function nextPlacement(state: StackerState): Placement | null {
  if (state.maxHeight >= state.config.stability.target_height) return null
  const itemId = suggestPiece(state)
  if (itemId === null) return null
  return { itemId, x: state.config.field.base_x }
}

/**
 * The §9 winnability gate's competent player.
 *
 * It is not a script: it reads the manifest's own catalogue and economy and builds the
 * structure the physics rewards — a centred, monotonically narrowing stack of the
 * widest affordable pieces, which maximises the support span and keeps the centre of
 * mass over the base centre (so the symmetry bonus falls out of playing well rather
 * than being aimed at). It adds a piece only once everything already placed has come to
 * rest, so a `drop`-mode manifest is built as carefully as a `snap`-mode one, then
 * declares itself ready and lets the announced timeline run.
 */
function perfectBot(state: StackerState, tick: number): GameInputEvent[] {
  if (state.finished) return []
  if (state.phase !== 'build') return []
  for (const body of state.bodies) {
    if (!body.asleep) return []
  }
  const placement = nextPlacement(state)
  if (placement === null) return [{ tick, action: 'ready' }]
  return [{ tick, action: 'place', slot: placement.itemId, x: placement.x, n: 0 }]
}

/** Roll denominators for the `random` bot, one per branch. It builds carelessly — random
 *  pieces at random columns, the odd pointless move or removal, and a `ready` far too
 *  early. Mashing must NOT be a complete strategy (§9); this bot is the half of the gate
 *  that proves it. */
const RANDOM_BRANCHES = 12

function randomBot(state: StackerState, tick: number, rng: Rng): GameInputEvent[] {
  if (state.finished) return []
  if (state.phase !== 'build') return []
  const config = state.config
  const roll = rng.int(RANDOM_BRANCHES)

  if (roll === 0) return [{ tick, action: 'ready' }]
  if (roll <= 5) {
    const piece = config.catalog[rng.int(config.catalog.length)]
    if (piece === undefined) return []
    return [
      {
        tick,
        action: 'place',
        slot: piece.item_id,
        x: rng.int(config.field.width),
        n: rng.int(4),
      },
    ]
  }
  if (state.bodies.length === 0) return []
  const body = state.bodies[rng.int(state.bodies.length)]
  if (body === undefined) return []
  if (roll === 6) return [{ tick, action: 'move', n: body.uid, x: rng.int(config.field.width) }]
  if (roll === 7) return [{ tick, action: 'remove', n: body.uid }]
  return []
}

/** The pair the winnability gate drives. Method syntax matches `GameBots`, whose
 *  bivariant parameters are what lets a concrete `GameBots<StackerState>` be held as the
 *  erased `GameBots<unknown>` that gamegen's registry and `runBot` take. */
export const stackerBots: GameBots<StackerState> = {
  perfect(state, tick) {
    return perfectBot(state, tick)
  },
  random(state, tick, rng) {
    return randomBot(state, tick, rng)
  },
}
