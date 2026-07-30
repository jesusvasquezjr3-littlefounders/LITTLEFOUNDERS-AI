// `sorter` — the HEADLESS BOTS (GAME_ENGINE.md §9).
//
// A SEPARATE MODULE ON PURPOSE, and the separation is a security boundary, not tidiness.
// `perfect` plays this mechanic optimally and returns the exact `GameInputEvent[]` that
// Core replays to grant XP — and a maximal log is only a handful of events long. While
// the bots hung off `sorterSimulator`, `register.ts` pulled them into the mechanic's lazy
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

import type { SorterState } from './simulate.js'

/**
 * The §9 winnability gate's competent player: it resolves EVERY element on screen on
 * the tick it can see it, so it never misses and never mis-sorts. Traps are discarded
 * when the manifest offers a discard target and otherwise left alone, which is the
 * report's other sanctioned answer to a trap.
 */
function perfectBot(state: SorterState, tick: number): GameInputEvent[] {
  if (state.finished) return []
  const events: GameInputEvent[] = []
  for (const entity of state.active) {
    if (entity.categoryId !== null) {
      events.push({ tick, action: 'place', slot: entity.categoryId, n: entity.uid })
    } else if (state.config.trash_zone) {
      events.push({ tick, action: 'discard', n: entity.uid })
    }
  }
  return events
}

/**
 * Arbitrary play: about half the ticks it does nothing, otherwise it drops one random
 * element into one random container. It must NOT reach `pass_score` — if it does, the
 * manifest is not measuring anything and the pipeline rejects it.
 */
function randomBot(state: SorterState, tick: number, rng: Rng): GameInputEvent[] {
  if (state.finished) return []
  if (state.active.length === 0) return []
  if (rng.next() < 0.5) return []
  const entity = state.active[rng.int(state.active.length)]
  if (entity === undefined) return []
  const slot = state.categories[rng.int(state.categories.length)]
  if (slot === undefined) return []
  return [{ tick, action: 'place', slot, n: entity.uid }]
}

/** The pair the winnability gate drives. Method syntax matches `GameBots`, whose
 *  bivariant parameters are what lets a concrete `GameBots<SorterState>` be held as the
 *  erased `GameBots<unknown>` that gamegen's registry and `runBot` take. */
export const sorterBots: GameBots<SorterState> = {
  perfect(state, tick) {
    return perfectBot(state, tick)
  },
  random(state, tick, rng) {
    return randomBot(state, tick, rng)
  },
}
