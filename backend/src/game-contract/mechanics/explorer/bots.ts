// `explorer` — the HEADLESS BOTS (GAME_ENGINE.md §9).
//
// A SEPARATE MODULE ON PURPOSE, and the separation is a security boundary, not tidiness.
// `perfect` plays this mechanic optimally and returns the exact `GameInputEvent[]` that
// Core replays to grant XP — and a maximal log is only a handful of events long. While
// the bots hung off `explorerSimulator`, `register.ts` pulled them into the mechanic's lazy
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

import {
  canOperateLockFrom,
  canRestAt,
  holdingsOfState,
  indexOfAbility,
  indexOfNode,
  isCheckpointNode,
  lockAffordable,
  lockSatisfied,
  nodeIsClaimable,
} from './simulate.js'
import type { ExplorerState } from './simulate.js'

// ---- bots --------------------------------------------------------------------------

/**
 * Work at this node OTHER than merely setting foot on it. Kept separate from "not yet
 * visited" so the bot can finish everything that PAYS before it sweeps the map: an
 * arrival can complete the ending, and a run that ends on arrival never gets to claim
 * what that node was holding.
 */
function needsWork(state: ExplorerState, index: number): boolean {
  if ((state.cache[index] ?? 0) > 0) return true
  if (nodeIsClaimable(state, index)) return true
  if (isCheckpointNode(state, index) && canRestAt(state, index) && state.activated[index] !== true) {
    return true
  }
  const node = state.nodes[index]
  if (node === undefined) return false
  const holdings = holdingsOfState(state)
  for (let e = 0; e < state.edges.length; e += 1) {
    const edge = state.edges[e]
    if (edge === undefined || state.open[e] === true) continue
    const lock = edge.lock
    if (lock === null) continue
    if (!canOperateLockFrom(edge, node.id)) continue
    if (!lockAffordable(lock, state.abilities, state.config)) continue
    if (lockSatisfied(lock, state.abilities, state.config, holdings)) return true
  }
  return false
}

/** Breadth-first walk over the edges that are passable RIGHT NOW. Returns the visit
 *  order (nearest first) and, for each node, the first hop of a shortest path to it.
 *  Arrays and document order throughout, so the walk is reproducible (§5 rule 6). */
function breadthFirst(state: ExplorerState): { order: number[]; firstStep: number[] } {
  const count = state.nodes.length
  const seen = state.nodes.map(() => false)
  const firstStep = state.nodes.map(() => -1)
  const order: number[] = [state.at]
  if (count > 0) seen[state.at] = true

  let head = 0
  while (head < order.length) {
    const current = order[head]
    head += 1
    if (current === undefined) continue
    const currentNode = state.nodes[current]
    if (currentNode === undefined) continue

    for (let e = 0; e < state.edges.length; e += 1) {
      const edge = state.edges[e]
      if (edge === undefined) continue
      if (edge.lock !== null && state.open[e] !== true) continue
      let neighbour = -1
      if (edge.from === currentNode.id) neighbour = indexOfNode(state.nodes, edge.to)
      else if (!edge.one_way && edge.to === currentNode.id) {
        neighbour = indexOfNode(state.nodes, edge.from)
      }
      if (neighbour < 0 || seen[neighbour] === true) continue
      seen[neighbour] = true
      firstStep[neighbour] = current === state.at ? neighbour : (firstStep[current] ?? neighbour)
      order.push(neighbour)
    }
  }

  return { order, firstStep }
}

/** The `use` the perfect bot would make standing here: an event, `'wait'` when the only
 *  thing missing is energy or a cooldown, or null when there is nothing to open. */
function nextUseHere(state: ExplorerState, tick: number): GameInputEvent | 'wait' | null {
  const here = state.nodes[state.at]
  if (here === undefined) return null
  const holdings = holdingsOfState(state)

  for (let e = 0; e < state.edges.length; e += 1) {
    const edge = state.edges[e]
    if (edge === undefined || state.open[e] === true) continue
    const lock = edge.lock
    if (lock === null) continue
    if (!canOperateLockFrom(edge, here.id)) continue
    if (!lockAffordable(lock, state.abilities, state.config)) continue
    if (!lockSatisfied(lock, state.abilities, state.config, holdings)) continue

    const step = lock.sequence ? (state.seqAt[e] ?? 0) : 0
    const requirement = lock.requires[step] ?? lock.requires[0]
    const abilityIndex = indexOfAbility(state.abilities, requirement?.ability)
    const ability = state.abilities[abilityIndex]
    if (ability !== undefined && (state.tier[abilityIndex] ?? 0) > 0) {
      if (tick < (state.readyAt[abilityIndex] ?? 0)) return 'wait'
      if (state.energy < ability.energy_cost) return 'wait'
    }
    return { tick, action: 'use', slot: edge.id, n: Math.max(0, abilityIndex) }
  }
  return null
}

/**
 * The §9 winnability gate's competent player. It is a real planner, not a stub:
 * it claims what it stands on, answers every micro-challenge correctly, activates the
 * checkpoints it passes, opens every lock it can satisfy from where it stands, and
 * otherwise walks the shortest currently-passable path to the nearest node that still
 * has something to do. Each of those actions strictly reduces the amount of remaining
 * work, which is why the walk terminates instead of oscillating.
 */
function perfectBot(state: ExplorerState, tick: number): GameInputEvent[] {
  if (state.finished || state.travelLeft > 0) return []
  const here = state.nodes[state.at]
  if (here === undefined) return []

  if ((state.cache[state.at] ?? 0) > 0) {
    return [{ tick, action: 'take', slot: here.id }]
  }

  if (nodeIsClaimable(state, state.at)) {
    const challenge = here.challenge
    if (challenge !== undefined && state.solved[state.at] !== true) {
      const correct = challenge.options.findIndex((option) => option.correct)
      if (correct >= 0) return [{ tick, action: 'take', slot: here.id, n: correct }]
    } else {
      return [{ tick, action: 'take', slot: here.id }]
    }
  }

  if (
    isCheckpointNode(state, state.at) &&
    canRestAt(state, state.at) &&
    state.activated[state.at] !== true
  ) {
    return [{ tick, action: 'rest' }]
  }

  const use = nextUseHere(state, tick)
  // 'wait' means the very best move is here and only needs a moment of regeneration —
  // walking away from it would be worse than standing still.
  if (use === 'wait') return []
  if (use !== null) return [use]

  // Walking has its own energy price in some worlds; standing still until it can be
  // paid is the correct play, and it is also what keeps the planner from emitting a
  // move the simulator would silently drop.
  if (state.energy < state.config.movement.energy_per_move) return []

  const { order, firstStep } = breadthFirst(state)
  const hopTo = (candidate: number): GameInputEvent[] | null => {
    const target = state.nodes[firstStep[candidate] ?? -1]
    if (target === undefined) return null
    return [{ tick, action: 'move', slot: target.id }]
  }

  // Pass 1 — everything that PAYS: caches, claims, checkpoints, openable locks.
  for (const candidate of order) {
    if (candidate === state.at || candidate === state.goal) continue
    if (!needsWork(state, candidate)) continue
    const move = hopTo(candidate)
    if (move !== null) return move
  }

  // Pass 2 — sweep the rest of the map for the exploration percentage.
  for (const candidate of order) {
    if (candidate === state.at || candidate === state.goal) continue
    if (state.visited[candidate] === true) continue
    const move = hopTo(candidate)
    if (move !== null) return move
  }

  // Pass 3 — the goal LAST, deliberately: reaching it can end the run, and a run that
  // ends early leaves earnable score on the map.
  if (state.visited[state.goal] !== true || needsWork(state, state.goal)) {
    const move = hopTo(state.goal)
    if (move !== null) return move
  }
  return []
}

/**
 * Arbitrary play: a random one of the four actions, aimed at a random node or edge. It
 * must NOT reach `pass_score` — if it does, the world is not measuring anything and the
 * pipeline rejects the manifest.
 */
function randomBot(state: ExplorerState, tick: number, rng: Rng): GameInputEvent[] {
  if (state.finished || state.travelLeft > 0) return []
  const roll = rng.int(4)

  if (roll === 0) {
    const node = state.nodes[rng.int(state.nodes.length)]
    if (node === undefined) return []
    return [{ tick, action: 'move', slot: node.id }]
  }
  if (roll === 1) {
    const edge = state.edges[rng.int(state.edges.length)]
    if (edge === undefined) return []
    return [
      { tick, action: 'use', slot: edge.id, n: rng.int(Math.max(1, state.abilities.length)) },
    ]
  }
  if (roll === 2) {
    const node = state.nodes[state.at]
    if (node === undefined) return []
    return [{ tick, action: 'take', slot: node.id, n: rng.int(4) }]
  }
  return [{ tick, action: 'rest' }]
}

/** The pair the winnability gate drives. Method syntax matches `GameBots`, whose
 *  bivariant parameters are what lets a concrete `GameBots<ExplorerState>` be held as the
 *  erased `GameBots<unknown>` that gamegen's registry and `runBot` take. */
export const explorerBots: GameBots<ExplorerState> = {
  perfect(state, tick) {
    return perfectBot(state, tick)
  },
  random(state, tick, rng) {
    return randomBot(state, tick, rng)
  },
}
