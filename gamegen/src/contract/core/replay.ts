// The single shared replay entry point — GAME_ENGINE.md §5, §6.
//
// THREE callers, ONE implementation: the dev lab, the Arcade pipeline's winnability
// gate, and Core's `POST /api/v1/games/:gameId/complete`. A player's reward is not the
// number the client reports — it is what this function DERIVES by re-running the
// mechanic's simulator over the player's input log. `replayGame` therefore takes no
// score argument at all: there is nothing for a forged client to inflate.
//
// This module is deliberately free of React, DOM, Node and Zod so that
// `backend/src/game-contract/` and `gamegen/src/contract/` can carry it verbatim; the
// only runtime import is core/rng.ts, which is part of the same parity copy.
// It is fully synchronous and pure: same inputs -> same outputs, always, forever.

import type {
  GameBot,
  GameDocument,
  GameInputEvent,
  SimInit,
  SimResult,
  Simulator,
} from './types.js'
import { createRng } from './rng.js'

/**
 * Every way a log can be refused. Stable strings: they are logged verbatim and are
 * safe to return in a `422 RESULT_REJECTED` body, because each one names a structural
 * property of the log and leaks nothing about the document's bounds or answers.
 */
export type ReplayRejectionReason =
  | 'invalid_max_ticks'
  | 'invalid_max_events'
  | 'log_too_long'
  | 'tick_not_integer'
  | 'tick_negative'
  | 'tick_after_max'
  | 'tick_out_of_order'
  | 'unknown_action'
  | 'non_finite_payload'

export type ReplayOutcome =
  | { ok: true; result: SimResult }
  | { ok: false; reason: ReplayRejectionReason }

/**
 * The default per-tick input budget, used only when the caller supplies no explicit
 * cap. The server ALWAYS passes `validation.max_events` (the sidecar bound authored by
 * the pipeline); this default exists so the lab and the bot gate — which have no
 * sidecar — still refuse an absurd log instead of stepping it. `maxTicks + 1` because
 * both tick 0 and tick `maxTicks` are playable.
 */
export const DEFAULT_MAX_EVENTS_PER_TICK = 4

/**
 * Decorrelates a bot's random stream from the simulator's own stream, which is seeded
 * from the same number. Golden-ratio odd constant; `>>> 0` keeps it an exact uint32,
 * so `runBot` stays reproducible across engines like everything else here.
 */
const BOT_SEED_OFFSET = 0x9e3779b9

export interface ReplayGameArgs {
  simulator: Simulator<unknown>
  /** The client-safe document is enough — only config/content/scoring are read. */
  document: GameDocument
  seed: number
  inputLog: readonly GameInputEvent[]
  maxTicks: number
  /**
   * Cap on the number of events in the log. Core passes `validation.max_events`; when
   * omitted the per-tick budget above applies.
   */
  maxEvents?: number
}

/**
 * Validates a player's input log and replays it. Never throws for a bad log and never
 * partially credits one: a violation short-circuits BEFORE the simulator is even
 * initialised, so a rejected attempt cannot have produced a state to score.
 */
export function replayGame(args: ReplayGameArgs): ReplayOutcome {
  const { simulator, document, seed, inputLog, maxTicks } = args

  if (!Number.isInteger(maxTicks) || maxTicks < 0) return { ok: false, reason: 'invalid_max_ticks' }

  const cap = args.maxEvents ?? (maxTicks + 1) * DEFAULT_MAX_EVENTS_PER_TICK
  if (!Number.isInteger(cap) || cap < 0) return { ok: false, reason: 'invalid_max_events' }
  if (inputLog.length > cap) return { ok: false, reason: 'log_too_long' }

  const validation = validateLog(inputLog, simulator.actions, maxTicks)
  if (validation !== null) return { ok: false, reason: validation }

  const state = stepThrough(simulator, document, seed, inputLog, maxTicks)
  return { ok: true, result: simulator.result(state) }
}

export interface RunBotArgs<S> {
  simulator: Simulator<S>
  document: GameDocument
  seed: number
  bot: GameBot<S>
  maxTicks: number
}

/**
 * Drives a headless bot to produce an input log and the result it reaches. This is the
 * §9 winnability gate (the `perfect` bot MUST reach `scoring.pass_score`, the `random`
 * bot MUST NOT) and the lab's "watch a bot play" button.
 *
 * Every emitted event is re-stamped with the tick it was produced on, so the returned
 * log is by construction a log `replayGame` accepts and replays to this same result.
 */
export function runBot<S>(args: RunBotArgs<S>): { result: SimResult; inputLog: GameInputEvent[] } {
  const { simulator, document, seed, bot, maxTicks } = args
  const rng = createRng((seed + BOT_SEED_OFFSET) >>> 0)
  const inputLog: GameInputEvent[] = []

  let state = simulator.init(simInit(document, seed))
  for (let tick = 0; tick <= maxTicks; tick += 1) {
    if (simulator.snapshot(state).finished) break
    const emitted = bot(state, tick, rng)
    const batch: GameInputEvent[] = []
    for (const event of emitted) {
      const stamped: GameInputEvent = { ...event, tick }
      batch.push(stamped)
      inputLog.push(stamped)
    }
    state = simulator.step(state, tick, batch)
  }

  return { result: simulator.result(state), inputLog }
}

// ---- internals ---------------------------------------------------------------

/** The only four things a simulator may read at init — no wall clock, no locale. */
function simInit(document: GameDocument, seed: number): SimInit {
  return {
    config: document.config,
    content: document.content,
    scoring: document.scoring,
    seed,
  }
}

/** Returns the first violation, or null when the whole log is well-formed. */
function validateLog(
  inputLog: readonly GameInputEvent[],
  actions: readonly string[],
  maxTicks: number,
): ReplayRejectionReason | null {
  let previousTick = 0
  for (const event of inputLog) {
    // Core's Zod layer already shapes these, but the pipeline and the lab call in
    // directly, and this is the reward path: re-check rather than assume.
    if (!Number.isInteger(event.tick)) return 'tick_not_integer'
    if (event.tick < 0) return 'tick_negative'
    if (event.tick > maxTicks) return 'tick_after_max'
    if (event.tick < previousTick) return 'tick_out_of_order'
    if (!actions.includes(event.action)) return 'unknown_action'
    if (!finitePayload(event)) return 'non_finite_payload'
    previousTick = event.tick
  }
  return null
}

/** A NaN or Infinity in a coordinate poisons every arithmetic op downstream of it. */
function finitePayload(event: GameInputEvent): boolean {
  for (const value of [event.x, event.y, event.n]) {
    if (value !== undefined && !Number.isFinite(value)) return false
  }
  return true
}

/**
 * Advances tick by tick from 0, handing each tick EXACTLY the events stamped with it.
 * The log is already known to be non-decreasing, so a single cursor walks it once —
 * no grouping map, hence no key-ordering question to get wrong (§5 rule 6).
 */
function stepThrough(
  simulator: Simulator<unknown>,
  document: GameDocument,
  seed: number,
  inputLog: readonly GameInputEvent[],
  maxTicks: number,
): unknown {
  let state = simulator.init(simInit(document, seed))
  let cursor = 0

  for (let tick = 0; tick <= maxTicks; tick += 1) {
    if (simulator.snapshot(state).finished) break

    const batch: GameInputEvent[] = []
    while (cursor < inputLog.length) {
      const event = inputLog[cursor]
      if (event === undefined || event.tick !== tick) break
      batch.push(event)
      cursor += 1
    }

    state = simulator.step(state, tick, batch)
  }

  return state
}
