// The `simulate` stage — THE BOT-PLAY WINNABILITY GATE (GAME_ENGINE.md §9,
// gamegen/AGENTS.md "Pipeline shape").
//
// This stage has no equivalent in Forge, and it is the strongest quality guarantee in
// this pipeline: before a generated manifest may be judged, localized, illustrated or
// published, Arcade PLAYS it. Two headless bots, the mechanic's own, drive the real
// simulator over the real document:
//
//   - the PERFECT bot must reach `scoring.pass_score` on EVERY seed. If it cannot, the
//     game is unwinnable and a child would fail content that is broken, not hard.
//   - the RANDOM bot must NOT reach it on any seed. If it can, mashing is a complete
//     strategy, the XP is free and the game teaches nothing.
//
// It is free, deterministic and involves no LLM, so it runs BEFORE the paid judge —
// the cheap-first ordering Forge's two-phase gate/judge split already paid for. On
// failure it returns a compact BOT TRACE (seed, ticks, score reached, where the perfect
// bot stopped making progress) which `author`'s corrective-retry loop appends to the
// prompt: a trace tells a model what to change, "unwinnable" does not.
//
// DETERMINISM OF THE GATE ITSELF. Every seed is derived from the document's slug via
// `seedFromString` (FNV-1a, integer ops only) — never `Math.random()`. The same manifest
// therefore produces the same verdict on every machine, in CI, and months later when a
// published game is re-verified. The per-tick work measurement is STRUCTURAL (array
// elements reachable in the simulator state), never a wall-clock timing, for the same
// reason: a timing-based bound would make the verdict depend on the host.
//
// This module reads ONLY `gamegen/src/contract/` — the parity copy of the frontend's
// pure simulation code. It never imports React, never touches the network and never
// spends money.

import { replayGame, runBot } from '../contract/core/replay.js'
import { seedFromString } from '../contract/core/rng.js'
import { TICK_MS } from '../contract/core/types.js'
import type {
  GameBot,
  GameBots,
  GameDocument,
  GameInputEvent,
  GameValidation,
  MechanicSimSlice,
  SimSnapshot,
  Simulator,
} from '../contract/core/types.js'
import { getMechanic, getMechanicBots } from '../contract/registry.js'
import {
  explorerConfigSchema,
  explorerContentSchema,
} from '../contract/mechanics/explorer/schema.js'
import { solveExplorerWorld, type ExplorerWorldReport } from '../contract/mechanics/explorer/simulate.js'

// ---- Tick budget --------------------------------------------------------------

const TICKS_PER_MINUTE = 60_000 / TICK_MS

/**
 * How much longer than `estimated_minutes` a run may legitimately last before the
 * replay stops stepping. Deliberately the SAME constant as
 * `backend/src/services/gameDocument.ts` `maxTicksFor()`, because the ceiling the gate
 * plays against must be the ceiling Core replays against: a perfect run that does not
 * fit inside Core's ceiling is a run Core can never pay for.
 */
const MAX_TICKS_SLACK = 3

/** 30 minutes of ticks — `estimated_minutes` is Zod-capped at 10, so this only binds
 *  if that cap ever moves. Mirrors Core's `MAX_TICKS_CEILING`. */
const MAX_TICKS_CEILING = 36_000

/** The replay's tick ceiling for one document. Mirrors Core's `maxTicksFor()`. */
export function maxTicksForDocument(document: GameDocument): number {
  const minutes = advertisedMinutes(document)
  return Math.min(MAX_TICKS_CEILING, minutes * TICKS_PER_MINUTE * MAX_TICKS_SLACK)
}

/** The playtime the manifest ADVERTISES to a child, clamped to the schema's range. */
function advertisedMinutes(document: GameDocument): number {
  const minutes = document.meta.estimated_minutes
  if (!Number.isFinite(minutes)) return 1
  return Math.max(1, Math.min(10, Math.round(minutes)))
}

/** Ticks are the only clock the simulation, the HUD and Core agree on. Mirrors the
 *  player's `durationSecondsFromTicks`, which is what the client submits. */
function durationSecondsFromTicks(ticks: number): number {
  if (!Number.isFinite(ticks) || ticks <= 0) return 1
  return Math.max(1, Math.round((ticks * TICK_MS) / 1000))
}

// ---- Thresholds ---------------------------------------------------------------

/**
 * PERFECT seeds. The perfect bot is deterministic given (manifest, seed), so these
 * seeds are not sampling luck — they sample the SEEDED CONTENT the simulator derives
 * from the document (deck shuffles, spawn draws, wave order). Four is enough to catch
 * "winnable only when the trap happens to come last"; more would multiply the cost of a
 * gate that runs on every slot of every run for no extra signal.
 */
export const DEFAULT_PERFECT_SEEDS = 4

/**
 * RANDOM seeds — deliberately 3x the perfect count, because this half estimates a TAIL
 * PROBABILITY rather than checking a deterministic property. With 12 independent seeds a
 * manifest that a mashing player beats 20% of the time is caught with probability
 * 1 - 0.8^12 = 93%, and one that is beaten half the time is caught essentially always.
 */
export const DEFAULT_RANDOM_SEEDS = 12

/**
 * How many random seeds may reach `pass_score` before the manifest is rejected. ZERO by
 * default: one pass in twelve means roughly one child in twelve is granted the XP for
 * mashing, and the whole point of the reward being replay-derived is that it cannot be
 * obtained without playing. Exposed as a knob only so a future mechanic with a genuinely
 * stochastic floor can raise it DELIBERATELY, in its own call site, with a reason.
 */
export const DEFAULT_MAX_RANDOM_PASSES = 0

/**
 * The documented PER-TICK WORK BOUND, as live array elements a simulation may ADD to its
 * opening state.
 *
 * Why growth over the opening state rather than an absolute count: the opening state
 * already holds everything the manifest authored (a sorter's whole deck, a defender's
 * flattened grid, an explorer's node/edge tables), all of it Zod-bounded and none of it
 * per-tick work. What stutters a phone is what the simulation SPAWNS — projectiles,
 * enemies, entities — and that is exactly what shows up as growth.
 *
 * The number: the densest schema-legal wave in `defender` is 6 groups x 40 enemies = 240
 * concurrent, plus a 60-wall budget and its towers; every other mechanic caps its live
 * entities far lower (`sorter.max_active` <= 12). 800 leaves that legitimate worst case
 * comfortable headroom while still failing a manifest whose numbers drive the simulator
 * into the thousands — which at a 50ms tick is a canvas no mid-range phone can draw.
 */
export const DEFAULT_MAX_ENTITY_GROWTH = 800

/**
 * Ticks between work samples. Sampling (rather than every tick) keeps the gate's cost
 * linear in the run length for the mechanics with the largest states, and it is
 * tick-indexed, so it stays perfectly reproducible.
 *
 * Sampled on BOTH bots, and the bound is checked against the peak across all of them.
 * Measuring optimal play alone would understate the load badly: the perfect bot clears
 * every element the tick it appears, so a manifest that piles up entities in front of a
 * real, slower child reads as a completely empty field.
 */
const ENTITY_SAMPLE_STRIDE = 10

/** Hard caps on the state walk itself, so a pathological state can never make the gate
 *  itself the thing that hangs. Exhausting the node budget is REPORTED as an overload,
 *  never silently swallowed — a truncated count that read as "no growth" would blind the
 *  gate to precisely the manifest it exists to catch. */
const STATE_NODE_BUDGET = 20_000
const STATE_MAX_DEPTH = 8

// ---- Verdict shape ------------------------------------------------------------

/** Stable machine-readable codes. They are logged verbatim, they key the corrective
 *  feedback the author stage appends, and they are safe to store in the checkpoint. */
export const SIMULATE_PROBLEM_CODES = [
  'mechanic_unsupported',
  'mechanic_mismatch',
  'explorer_world_unparseable',
  'explorer_world_unsolvable',
  'perfect_below_pass_score',
  'perfect_never_finishes',
  'perfect_exceeds_estimated_minutes',
  'random_reaches_pass_score',
  'entity_load_exceeded',
  'replay_rejected_perfect_log',
  'replay_score_mismatch',
  'sidecar_max_events_too_low',
  'sidecar_max_score_below_perfect',
  'sidecar_min_duration_above_perfect',
] as const
export type SimulateProblemCode = (typeof SIMULATE_PROBLEM_CODES)[number]

/**
 * One gate finding. The shape is deliberately (field, expected, observed): gamegen's
 * AGENTS.md requires every gate message to be actionable by a model, and "name the
 * field, the expected value, the observed value" is what makes a corrective retry aim
 * at the right number instead of rewriting the document.
 */
export interface SimulateProblem {
  code: SimulateProblemCode
  /** Dot-path into the manifest the author can actually change. */
  field: string
  expected: string
  observed: string
  message: string
  /** Present on every bot-derived failure — this is the trace, not a summary of it. */
  trace?: BotTrace
}

/** What one headless run did. Far more actionable than a pass/fail bit. */
export interface BotTrace {
  bot: 'perfect' | 'random'
  seed: number
  /** Ticks the run actually consumed (it may end early on `snapshot.finished`). */
  ticks_used: number
  score: number
  pass_score: number
  finished: boolean
  /** Last tick at which the score improved, or -1 if it never did. */
  last_progress_tick: number
  /** Last tick the bot emitted an input, or -1 if it never acted. */
  last_input_tick: number
  /** Ticks the run kept going after its last improvement — WHERE it stalled. */
  stalled_for_ticks: number
  /** Inputs the bot produced. Compared against `validation.max_events`. */
  events: number
  round: number
  lives: number | null
  /** Peak array elements this run added to its opening state — the per-tick work
   *  measure. Sampled every `ENTITY_SAMPLE_STRIDE` ticks on both bots. */
  peak_entity_growth: number
  stats: Record<string, number>
}

export interface SimulateGateOptions {
  /** The mechanic the blueprint asked for. Checked against `meta.mechanic`: a document
   *  that quietly changed mechanic would be gated as something it is not. */
  mechanic: string
  perfectSeeds?: number
  randomSeeds?: number
  maxRandomPasses?: number
  maxEntityGrowth?: number
}

export interface SimulateGateVerdict {
  ok: boolean
  mechanic: string
  max_ticks: number
  pass_score: number
  seeds: { perfect: number[]; random: number[] }
  perfect: BotTrace[]
  random: BotTrace[]
  /** How many random seeds reached `pass_score`. */
  random_passes: number
  problems: SimulateProblem[]
  /** One line per problem, ready to APPEND after the original author messages (the
   *  prefix-cache rule: retries append, they never splice). */
  feedback: string[]
  /** `explorer` only — the reachability fixpoint's full report. */
  explorer?: ExplorerWorldReport
}

// ---- The gate -----------------------------------------------------------------

/**
 * Bot-plays one authored manifest and returns a structured verdict.
 *
 * `sidecar` is the SERVER-ONLY `GameValidation` the author stage produced alongside the
 * document (`null` when there is none yet). It is not decoration here: Core refuses a
 * submitted run whose duration is below `min_duration_seconds`, whose log is longer than
 * `max_events`, or whose replayed score exceeds `max_score`. A sidecar that would refuse
 * the PERFECT bot's own run is a manifest that can never pay an honest child, so the
 * gate checks the perfect run against all three bounds and reports the number to fix.
 */
export function simulateGate(
  document: GameDocument,
  sidecar: GameValidation | null,
  options: SimulateGateOptions,
): SimulateGateVerdict {
  const passScore = document.scoring.pass_score
  const maxTicks = maxTicksForDocument(document)
  const problems: SimulateProblem[] = []

  const perfectCount = positiveCount(options.perfectSeeds, DEFAULT_PERFECT_SEEDS)
  const randomCount = positiveCount(options.randomSeeds, DEFAULT_RANDOM_SEEDS)
  const perfectSeeds = gateSeeds(document, 'perfect', perfectCount)
  const randomSeeds = gateSeeds(document, 'random', randomCount)

  const base = {
    mechanic: options.mechanic,
    max_ticks: maxTicks,
    pass_score: passScore,
    seeds: { perfect: perfectSeeds, random: randomSeeds },
  }

  // A document whose `meta.mechanic` disagrees with the blueprint would be gated with
  // the wrong simulator and pass for the wrong reason. Refuse before playing anything.
  if (document.meta.mechanic !== options.mechanic) {
    problems.push({
      code: 'mechanic_mismatch',
      field: 'meta.mechanic',
      expected: options.mechanic,
      observed: document.meta.mechanic,
      message:
        'the document names a different mechanic than the blueprint asked for; the winnability gate cannot verify it',
    })
    return finalize(base, [], [], 0, problems)
  }

  // `null` means this release cannot bot-play the mechanic. That is a slot failure, never
  // a pass: publishing an ungated game is the exact hole this stage exists to close.
  const slice = getMechanic(options.mechanic)
  // The bots live in their own table because `Simulator` carries none — they must never
  // reach a browser (core/types.ts). Arcade is the one caller entitled to them, and a
  // mechanic with a simulator but no bots is just as ungatable as one with neither.
  const bots = getMechanicBots(options.mechanic)
  if (slice === null || bots === null) {
    problems.push({
      code: 'mechanic_unsupported',
      field: 'meta.mechanic',
      expected: 'a mechanic this release implements',
      observed: options.mechanic,
      message: 'no simulator is registered for this mechanic, so the game cannot be bot-played',
    })
    return finalize(base, [], [], 0, problems)
  }

  // ---- explorer: the reachability fixpoint, before any bot runs ----------------
  //
  // `explorer` is a graph of ability locks, so "unwinnable" is a STRUCTURAL property the
  // solver decides exactly and instantly. Running bots on an unsolvable world would burn
  // sixteen full runs to rediscover, statistically, what the fixpoint proves — and would
  // report "the perfect bot stalled" instead of "the goal is unreachable, these nodes are
  // orphaned". So the solver runs first and, on failure, short-circuits.
  let explorer: ExplorerWorldReport | undefined
  if (options.mechanic === 'explorer') {
    const config = explorerConfigSchema.safeParse(document.config)
    const content = explorerContentSchema.safeParse(document.content)
    if (!config.success || !content.success) {
      const issues: string[] = []
      if (!config.success) issues.push(...config.error.issues.map(describeIssue))
      if (!content.success) issues.push(...content.error.issues.map(describeIssue))
      problems.push({
        code: 'explorer_world_unparseable',
        field: 'config/content',
        expected: 'a config and content that satisfy the explorer schemas',
        observed: issues.slice(0, 6).join('; '),
        message:
          'the world graph could not be parsed, so the reachability solver could not run — fix the schema errors first',
      })
      return finalize(base, [], [], 0, problems)
    }

    explorer = solveExplorerWorld(config.data, content.data)
    if (!explorer.solvable) {
      problems.push({
        code: 'explorer_world_unsolvable',
        field: 'content.nodes / content.edges',
        expected: `goal "${content.data.goal_node}" reachable and exploration >= ${config.data.ending.exploration_pct_required}%`,
        observed: `goal_reachable=${explorer.goal_reachable}, exploration_pct=${explorer.exploration_pct}, reasons=${explorer.reasons.join(',') || 'none'}`,
        message:
          'the reachability fixpoint proves this world cannot be completed: every lock on the path to the goal must be opened by an ability granted somewhere already reachable',
      })
      return finalize(base, [], [], 0, problems, explorer)
    }
  }

  // ---- the perfect bot: it MUST win, on every seed -----------------------------

  const maxEntityGrowth = positiveCount(options.maxEntityGrowth, DEFAULT_MAX_ENTITY_GROWTH)
  const advertisedTicks = advertisedMinutes(document) * TICKS_PER_MINUTE
  const perfect: BotTrace[] = []

  for (const seed of perfectSeeds) {
    const run = playSeed(slice, bots, document, seed, 'perfect', maxTicks)
    perfect.push(run.trace)

    if (run.trace.score < passScore) {
      problems.push({
        code: 'perfect_below_pass_score',
        field: 'scoring.pass_score',
        expected: `<= ${run.trace.score} (what optimal play actually reaches), or a config/content change that makes ${passScore} reachable`,
        observed: `${run.trace.score}`,
        message:
          'the PERFECT bot cannot pass this game: it is unwinnable as authored, so a child would fail content that is broken rather than hard',
        trace: run.trace,
      })
    }

    if (!run.trace.finished) {
      problems.push({
        code: 'perfect_never_finishes',
        field: 'config (the round/tick budget and the win target)',
        expected: `the run ends on its own before tick ${maxTicks}`,
        observed: `still running at tick ${run.trace.ticks_used}`,
        message:
          'optimal play never reaches an end state inside the replay ceiling, so the run would be truncated by the server rather than completed',
        trace: run.trace,
      })
    } else if (run.trace.ticks_used > advertisedTicks) {
      problems.push({
        code: 'perfect_exceeds_estimated_minutes',
        field: 'meta.estimated_minutes',
        expected: `>= ${Math.ceil(run.trace.ticks_used / TICKS_PER_MINUTE)}`,
        observed: `${document.meta.estimated_minutes} (optimal play needs ${durationSecondsFromTicks(run.trace.ticks_used)}s)`,
        message:
          'even optimal play overruns the playtime the manifest advertises; a child plays slower than the bot, so the estimate is wrong',
        trace: run.trace,
      })
    }

    // The gate and the REWARD PATH must agree. Replaying the bot's own log through the
    // shared `replayGame` — with the authored sidecar's cap, exactly as Core does —
    // proves the sidecar admits an honest optimal run and that the derived score matches.
    const replay = replayGame({
      simulator: slice.simulator,
      document,
      seed,
      inputLog: run.inputLog,
      maxTicks,
      ...(sidecar === null ? {} : { maxEvents: sidecar.max_events }),
    })
    if (!replay.ok) {
      problems.push({
        code:
          replay.reason === 'log_too_long' ? 'sidecar_max_events_too_low' : 'replay_rejected_perfect_log',
        field: replay.reason === 'log_too_long' ? 'validation.max_events' : 'config/content',
        expected:
          replay.reason === 'log_too_long'
            ? `>= ${run.trace.events} (the inputs optimal play needs)`
            : 'a log the shared replay accepts',
        observed:
          replay.reason === 'log_too_long'
            ? `${sidecar === null ? 'unset' : sidecar.max_events}`
            : replay.reason,
        message:
          'the server would refuse the PERFECT bot\'s own run, so it would refuse an honest child playing the same way — no reward could ever be granted',
        trace: run.trace,
      })
    } else if (replay.result.score !== run.trace.score) {
      problems.push({
        code: 'replay_score_mismatch',
        field: 'simulator determinism',
        expected: `${run.trace.score} (the live run)`,
        observed: `${replay.result.score} (the replay)`,
        message:
          'replaying the bot\'s own input log derived a different score: the simulation is not deterministic, and every reward derived from it would be a coin flip',
        trace: run.trace,
      })
    }

    if (sidecar !== null) {
      if (run.trace.score > sidecar.max_score) {
        problems.push({
          code: 'sidecar_max_score_below_perfect',
          field: 'validation.max_score',
          expected: `>= ${run.trace.score}`,
          observed: `${sidecar.max_score}`,
          message:
            'the sidecar caps the score below what optimal play reaches, so the server would reject a perfect run outright',
          trace: run.trace,
        })
      }
      const seconds = durationSecondsFromTicks(run.trace.ticks_used)
      if (seconds < sidecar.min_duration_seconds) {
        problems.push({
          code: 'sidecar_min_duration_above_perfect',
          field: 'validation.min_duration_seconds',
          expected: `<= ${seconds}`,
          observed: `${sidecar.min_duration_seconds}`,
          message:
            'the sidecar demands a longer session than an optimal run takes, so fast honest play would be rejected as impossible',
          trace: run.trace,
        })
      }
    }
  }

  // ---- the random bot: it must NOT win -----------------------------------------

  const maxRandomPasses = nonNegativeCount(options.maxRandomPasses, DEFAULT_MAX_RANDOM_PASSES)
  const random: BotTrace[] = []
  let randomPasses = 0
  let worstRandom: BotTrace | undefined

  for (const seed of randomSeeds) {
    const run = playSeed(slice, bots, document, seed, 'random', maxTicks)
    random.push(run.trace)
    if (run.trace.score >= passScore) {
      randomPasses += 1
      if (worstRandom === undefined || run.trace.score > worstRandom.score) worstRandom = run.trace
    }
  }

  // ---- the per-tick work bound, across every run --------------------------------

  let heaviest: BotTrace | undefined
  for (const trace of [...perfect, ...random]) {
    if (heaviest === undefined || trace.peak_entity_growth > heaviest.peak_entity_growth) {
      heaviest = trace
    }
  }
  if (heaviest !== undefined && heaviest.peak_entity_growth > maxEntityGrowth) {
    problems.push({
      code: 'entity_load_exceeded',
      field: 'config (spawn interval, max simultaneous elements, wave composition)',
      expected: `<= ${maxEntityGrowth} live elements added to the opening state`,
      observed: `${heaviest.peak_entity_growth}`,
      message:
        'the numbers in this manifest drive the simulation past the per-tick work bound: at a 50ms tick this is a canvas a phone cannot draw smoothly',
      trace: heaviest,
    })
  }

  if (randomPasses > maxRandomPasses) {
    problems.push({
      code: 'random_reaches_pass_score',
      field: 'scoring.pass_score (or the config difficulty ladder)',
      expected: `no more than ${maxRandomPasses} of ${randomSeeds.length} random runs at or above ${passScore}`,
      observed: `${randomPasses} of ${randomSeeds.length}, best ${worstRandom?.score ?? passScore}`,
      message:
        'mashing is a complete strategy for this game: raise pass_score, make wrong choices cost something, or make the decision impossible to get right without using the concept',
      ...(worstRandom === undefined ? {} : { trace: worstRandom }),
    })
  }

  return finalize(base, perfect, random, randomPasses, problems, explorer)
}

// ---- Seeds --------------------------------------------------------------------

/**
 * The gate's seeds, derived DETERMINISTICALLY from the document itself. Never
 * `Math.random()`: a gate whose verdict depends on when it ran could pass a manifest on
 * the run that publishes it and fail the same bytes in CI an hour later.
 *
 * The mechanic and the role are folded into the hash so that two documents never share a
 * seed sequence and so that the perfect and random halves explore different content
 * draws — one bot getting the easy shuffle while the other gets the hard one would make
 * the two halves incomparable.
 */
export function gateSeeds(document: GameDocument, role: 'perfect' | 'random', count: number): number[] {
  const seeds: number[] = []
  for (let index = 0; index < count; index += 1) {
    seeds.push(seedFromString(`${document.meta.mechanic}:${document.meta.slug}:${role}:${index}`))
  }
  return seeds
}

// ---- One headless run ---------------------------------------------------------

interface SeedRun {
  trace: BotTrace
  inputLog: GameInputEvent[]
}

/** Mutable observations collected by the bot wrapper. A plain object rather than a set
 *  of `let`s so that the values written inside the closure are visible to the compiler
 *  after `runBot` returns. */
interface RunProbe {
  lastTick: number
  lastProgressTick: number
  lastInputTick: number
  bestScore: number
  baseline: number
  peakGrowth: number
  overloaded: boolean
  snapshot: SimSnapshot | null
}

/**
 * Drives one bot over one seed through the shared `runBot`, instrumented.
 *
 * The instrumentation is a WRAPPER AROUND THE BOT rather than a re-implementation of the
 * run loop: `runBot` calls the bot once per tick with the pre-step state, so wrapping it
 * observes every tick of the real run without this module owning a second copy of the
 * stepping logic (which would be free to drift from the one Core replays with). The
 * wrapper forwards the state, tick and rng untouched, so it cannot perturb the run.
 */
function playSeed(
  slice: MechanicSimSlice,
  bots: GameBots<unknown>,
  document: GameDocument,
  seed: number,
  role: 'perfect' | 'random',
  maxTicks: number,
): SeedRun {
  const simulator: Simulator<unknown> = slice.simulator
  const bot: GameBot<unknown> = role === 'perfect' ? bots.perfect : bots.random

  const probe: RunProbe = {
    lastTick: -1,
    lastProgressTick: -1,
    lastInputTick: -1,
    bestScore: 0,
    baseline: -1,
    peakGrowth: 0,
    overloaded: false,
    snapshot: null,
  }

  const instrumented: GameBot<unknown> = (state, tick, rng) => {
    const snapshot = simulator.snapshot(state)
    probe.snapshot = snapshot
    probe.lastTick = tick
    if (snapshot.score > probe.bestScore) {
      probe.bestScore = snapshot.score
      probe.lastProgressTick = tick
    }

    if (tick % ENTITY_SAMPLE_STRIDE === 0) {
      const walk = countStateElements(state)
      if (walk.truncated) probe.overloaded = true
      if (probe.baseline < 0) probe.baseline = walk.elements
      const growth = walk.elements - probe.baseline
      if (growth > probe.peakGrowth) probe.peakGrowth = growth
    }

    const events = bot(state, tick, rng)
    if (events.length > 0) probe.lastInputTick = tick
    return events
  }

  const { result, inputLog } = runBot({
    simulator,
    document,
    seed,
    bot: instrumented,
    maxTicks,
  })

  const ticksUsed = probe.lastTick + 1
  const snapshot = probe.snapshot
  const trace: BotTrace = {
    bot: role,
    seed,
    ticks_used: ticksUsed,
    score: result.score,
    pass_score: document.scoring.pass_score,
    finished: result.finished,
    last_progress_tick: probe.lastProgressTick,
    last_input_tick: probe.lastInputTick,
    stalled_for_ticks: Math.max(0, ticksUsed - 1 - probe.lastProgressTick),
    events: inputLog.length,
    round: snapshot === null ? 0 : snapshot.round,
    lives: snapshot === null ? null : snapshot.lives,
    // An exhausted walk budget means the state is at least the budget large — report the
    // bound rather than a truncated count that would read as "nothing spawned".
    peak_entity_growth: probe.overloaded ? STATE_NODE_BUDGET : probe.peakGrowth,
    stats: { ...result.stats },
  }

  return { trace, inputLog }
}

// ---- The structural work measure ----------------------------------------------

/**
 * Counts the array elements reachable in a simulator state.
 *
 * Structural, never timed — the verdict has to be reproducible on any host (see this
 * file's header). The result is a SUM, so it does not depend on key iteration order; the
 * visited set makes structural sharing count once, which is what keeps consecutive ticks
 * comparable. Depth and node budgets bound the walk itself.
 */
function countStateElements(root: unknown): { elements: number; truncated: boolean } {
  const seen = new Set<object>()
  const stack: { value: unknown; depth: number }[] = [{ value: root, depth: 0 }]
  let elements = 0
  let visits = 0

  while (stack.length > 0) {
    const entry = stack.pop()
    if (entry === undefined) break
    const { value, depth } = entry
    if (value === null || typeof value !== 'object') continue
    if (depth > STATE_MAX_DEPTH) continue
    if (seen.has(value)) continue
    seen.add(value)

    visits += 1
    if (visits > STATE_NODE_BUDGET) return { elements, truncated: true }

    if (Array.isArray(value)) {
      elements += value.length
      for (const item of value) stack.push({ value: item, depth: depth + 1 })
      continue
    }

    const record: Record<string, unknown> = value as Record<string, unknown>
    for (const key of Object.keys(record)) {
      stack.push({ value: record[key], depth: depth + 1 })
    }
  }

  return { elements, truncated: false }
}

// ---- Assembly -----------------------------------------------------------------

/** One Zod issue as `path: message` — the shape the author stage already reads. */
function describeIssue(issue: { path: PropertyKey[]; message: string }): string {
  return `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`
}

function positiveCount(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(1, Math.floor(value))
}

function nonNegativeCount(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.floor(value))
}

interface VerdictBase {
  mechanic: string
  max_ticks: number
  pass_score: number
  seeds: { perfect: number[]; random: number[] }
}

function finalize(
  base: VerdictBase,
  perfect: BotTrace[],
  random: BotTrace[],
  randomPasses: number,
  problems: SimulateProblem[],
  explorer?: ExplorerWorldReport,
): SimulateGateVerdict {
  return {
    ok: problems.length === 0,
    ...base,
    perfect,
    random,
    random_passes: randomPasses,
    problems,
    feedback: problems.map(formatFeedback),
    ...(explorer === undefined ? {} : { explorer }),
  }
}

/**
 * One corrective-feedback line per problem, APPENDED after the original author messages
 * so attempts 2..N re-send an identical leading prompt and stay a prefix-cache hit.
 * Names the field, the expected value and the observed value, then the trace — which is
 * the difference between a model that fixes the number and a model that rewrites the
 * document hoping something changes.
 */
function formatFeedback(problem: SimulateProblem): string {
  const head = `[${problem.code}] ${problem.field}: expected ${problem.expected}, observed ${problem.observed}. ${problem.message}`
  const trace = problem.trace
  if (trace === undefined) return head
  return `${head} BOT TRACE — ${trace.bot} bot, seed ${trace.seed}: reached ${trace.score}/${trace.pass_score} in ${trace.ticks_used} ticks (finished=${trace.finished}, round ${trace.round}, ${trace.events} inputs); last score improvement at tick ${trace.last_progress_tick}, last input at tick ${trace.last_input_tick}, stalled for the final ${trace.stalled_for_ticks} ticks.`
}
