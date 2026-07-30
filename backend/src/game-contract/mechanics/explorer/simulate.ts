// `explorer` — the PURE simulator + the world SOLVER (GAME_ENGINE.md §5, §13).
//
// THIS IS NOT A PLATFORMER, and nobody may later mistake it for one. The owner's report
// describes a metroidvania; what makes that mechanic a mechanic is the ABILITY-LOCK
// structure — explore, meet a lock, go find the ability elsewhere, come back, open it —
// and that structure is preserved here in full. Its incidental real-time platforming is
// deliberately dropped (GAME_ENGINE.md §13): a physics platformer needs a control scheme
// that only works with a keyboard (/CLAUDE.md §1.11 forbids that), and per-frame
// character physics widens the replay-divergence surface for zero pedagogical gain. So
// this mechanic is GRAPH TRAVERSAL plus per-node MICRO-CHALLENGES: deterministic,
// replayable, and honest on a touch device.
//
// THE LEARNING BINDING, which is why this mechanic exists at all:
//  - abilities and locks are KNOWLEDGE and PREREQUISITES. The map is literally a
//    concept-dependency graph the child walks: you cannot cross the "compare prices"
//    bridge until you have learned to compare prices, and the world SHOWS you the
//    dependency before it asks you to satisfy it.
//  - the soft currency lost on death is a MONEY concept: the loss is partial, it is
//    dropped where it happened, and it is RECOVERABLE if you go back for it. Risk with a
//    second chance. Abilities — what you KNOW — are never lost, only what you CARRY.
//
// DETERMINISM (§5). No React, no DOM, no `Date.now()`, no `Math.random()`, no `%`, no
// transcendental function (this mechanic needs none: a graph has no trigonometry).
// Randomness would come only from the injected seeded PRNG. Two v1 bugs are structurally
// excluded:
//  - PER-ENTITY TIMERS. Ability cooldowns live in a per-ability `readyAt` array and the
//    travel timer is the single travelling player's own countdown. There is no shared
//    accumulator that N things each decrement, so N things cannot make one clock run N
//    times too fast.
//  - BATCHED, ORDERED RESOLUTION. A tick copies the whole state into a draft, applies
//    the WHOLE event batch to that draft in log order, and rebuilds the state once. No
//    per-event early return can stall the rest of the tick.
//
// `solveExplorerWorld()` at the bottom is the mechanic's single most important gate: a
// reachability FIXPOINT that proves an authored world is completable. A beautiful
// unsolvable map is a total failure, so the Arcade pipeline runs this before publish and
// rejects the world outright.

import {
  applyPenalty,
  efficiencyScore,
  targetScore,
  weightedScore,
} from '../../core/scoring.js'
import type {
  GameInputEvent,
  Rng,
  SimInit,
  SimResult,
  SimSnapshot,
  Simulator,
} from '../../core/types.js'

import type {
  ExplorerAbility,
  ExplorerConfig,
  ExplorerContent,
  ExplorerEdge,
  ExplorerLock,
  ExplorerNode,
} from './schema.js'

/**
 * The four player intents, exactly as specified.
 *  `move` — slot = node id: walk one edge toward it (arrival costs `ticks_per_edge`).
 *  `use`  — slot = edge id, n = ability index: apply an ability at a lock.
 *  `take` — slot = node id (the current one), n = challenge option index when the node
 *           asks something: claim the ability / collectible / currency, or pick a
 *           dropped cache back up.
 *  `rest` — activate the checkpoint here and restore energy.
 * Anything else is refused by replayGame() before the simulator is initialised.
 */
export const EXPLORER_ACTIONS = ['move', 'use', 'take', 'rest'] as const
export type ExplorerAction = (typeof EXPLORER_ACTIONS)[number]

/** Sentinel for "not travelling". A number, never null, so the state stays a flat
 *  numeric record that structural equality can compare cheaply in a replay test. */
const NOT_TRAVELLING = -1

// ---- state ---------------------------------------------------------------------

export interface ExplorerState {
  config: ExplorerConfig
  /** The authored world, in DOCUMENT ORDER. Every loop below walks these arrays in
   *  order, which is what makes iteration deterministic (§5 rule 6). */
  nodes: readonly ExplorerNode[]
  edges: readonly ExplorerEdge[]
  abilities: readonly ExplorerAbility[]
  /** Index of `content.start_node`, resolved once at init. */
  start: number
  /** Index of `content.goal_node`, resolved once at init. */
  goal: number
  seed: number

  /** Current node index. */
  at: number
  /** Destination while walking an edge, or NOT_TRAVELLING. */
  travelTo: number
  /** Ticks left before arrival — the travelling player's OWN countdown. */
  travelLeft: number

  visited: readonly boolean[]
  /** Checkpoints the player has ACTIVATED. Permanent: a checkpoint you have lit stays
   *  lit, and `checkpoint` below is simply the last one of these you touched. Tracking
   *  activation separately is also what stops a planner from walking back and forth
   *  between two checkpoints forever, each one looking "not current". */
  activated: readonly boolean[]
  claimed: readonly boolean[]
  solved: readonly boolean[]
  /** Wrong answers a node still allows before the run dies there. Per NODE, so one
   *  hard question cannot drain another node's patience. */
  attemptsLeft: readonly number[]
  /** Currency dropped at a node by a death, waiting to be picked back up. */
  cache: readonly number[]

  /** Tier held per ability index; 0 = not held. Never decreases: knowledge is not lost. */
  tier: readonly number[]
  fragments: readonly number[]
  /** Cooldown expiry tick per ability index. */
  readyAt: readonly number[]

  open: readonly boolean[]
  /** How far into a sequence (combination) lock each edge has been walked. */
  seqAt: readonly number[]

  /** Item ids picked up, in pickup order — the state a `temporal` lock can require. */
  collectedItems: readonly string[]

  energy: number
  /** Ticks until the next regeneration step. */
  regenLeft: number
  currency: number
  /** Solved micro-challenges, weighted by config — what lets a `soft` lock be skilled past. */
  mastery: number
  checkpoint: number

  moves: number
  uses: number
  rests: number
  /** EVERY action the player took, whether or not it changed anything. This is the
   *  efficiency denominator: decisions spent, not seconds spent. */
  actions: number
  deaths: number
  wrong: number
  ticks: number
  lives: number | null
  finished: boolean
}

/** The mutable working copy one tick edits. The input state's arrays are never touched. */
interface ExplorerDraft {
  at: number
  travelTo: number
  travelLeft: number
  visited: boolean[]
  activated: boolean[]
  claimed: boolean[]
  solved: boolean[]
  attemptsLeft: number[]
  cache: number[]
  tier: number[]
  fragments: number[]
  readyAt: number[]
  open: boolean[]
  seqAt: number[]
  collectedItems: string[]
  energy: number
  regenLeft: number
  currency: number
  mastery: number
  checkpoint: number
  moves: number
  uses: number
  rests: number
  actions: number
  deaths: number
  wrong: number
  lives: number | null
}

// ---- shared lookups -------------------------------------------------------------

function indexOfNode(nodes: readonly ExplorerNode[], id: string | undefined): number {
  if (id === undefined) return -1
  for (let i = 0; i < nodes.length; i += 1) {
    if (nodes[i]?.id === id) return i
  }
  return -1
}

function indexOfEdge(edges: readonly ExplorerEdge[], id: string | undefined): number {
  if (id === undefined) return -1
  for (let i = 0; i < edges.length; i += 1) {
    if (edges[i]?.id === id) return i
  }
  return -1
}

export function indexOfAbility(
  abilities: readonly ExplorerAbility[],
  id: string | undefined,
): number {
  if (id === undefined) return -1
  for (let i = 0; i < abilities.length; i += 1) {
    if (abilities[i]?.id === id) return i
  }
  return -1
}

function countTrue(flags: readonly boolean[]): number {
  let total = 0
  for (const flag of flags) {
    if (flag) total += 1
  }
  return total
}

/** The highest tier this world may hand out for an ability: the ability's own ceiling,
 *  the world's ceiling, and the upgrade-depth dial, whichever is lowest. */
function tierCap(config: ExplorerConfig, ability: ExplorerAbility): number {
  return Math.min(
    ability.max_tier,
    config.abilities.max_tier,
    1 + config.abilities.upgrade_depth,
  )
}

/**
 * A one-way edge is a SHORTCUT: it is walked `from` → `to` only, and its lock may be
 * operated only from `to` — the far side you had to reach the long way.
 */
export function canOperateLockFrom(edge: ExplorerEdge, nodeId: string): boolean {
  if (edge.one_way) return edge.to === nodeId
  return edge.from === nodeId || edge.to === nodeId
}

export function canTraverse(edge: ExplorerEdge, fromId: string, toId: string): boolean {
  if (edge.from === fromId && edge.to === toId) return true
  if (!edge.one_way && edge.to === fromId && edge.from === toId) return true
  return false
}

/** Everything a lock check reads. Shared verbatim by the simulator, the bots, the view
 *  and the solver, so "can I open this" can never mean two different things. */
export interface ExplorerHoldings {
  tier: readonly number[]
  mastery: number
  hasVisited: (nodeId: string) => boolean
  hasItem: (itemId: string) => boolean
}

/** Does the player hold every ability the lock names, at the tier it names? */
function holdsAll(
  lock: ExplorerLock,
  abilities: readonly ExplorerAbility[],
  holdings: ExplorerHoldings,
): boolean {
  for (const requirement of lock.requires) {
    const index = indexOfAbility(abilities, requirement.ability)
    if (index < 0) return false
    if ((holdings.tier[index] ?? 0) < requirement.tier) return false
  }
  return true
}

/**
 * The FULL lock taxonomy, in one place:
 *  hard      — the ability, at that tier. No alternative.
 *  compound  — every listed ability (A and B), or the one listed at tier >= 2.
 *  soft      — the ability, OR enough demonstrated skill to go around it.
 *  temporal  — a prior STATE (a node already visited, an item already held), plus any
 *              abilities the lock also names.
 * Sequence (combination) locks are ORTHOGONAL: this predicate says the player COULD open
 * it; the sequence still has to be walked one `use` at a time.
 */
export function lockSatisfied(
  lock: ExplorerLock,
  abilities: readonly ExplorerAbility[],
  config: ExplorerConfig,
  holdings: ExplorerHoldings,
): boolean {
  const all = holdsAll(lock, abilities, holdings)
  if (lock.kind === 'hard' || lock.kind === 'compound') return all
  if (lock.kind === 'soft') {
    if (all) return true
    return holdings.mastery >= (lock.skill_required ?? config.locks.soft_skill_default)
  }
  const visitedOk =
    lock.requires_visited === undefined || holdings.hasVisited(lock.requires_visited)
  const itemOk = lock.requires_item === undefined || holdings.hasItem(lock.requires_item)
  return all && visitedOk && itemOk
}

/** An ability that costs more energy than the reserve can ever hold is a lock nobody can
 *  open. The solver reports it as a reason and the bot skips the edge, so a mis-tuned
 *  manifest fails the winnability gate loudly instead of stalling a child silently. */
function lockAffordable(
  lock: ExplorerLock,
  abilities: readonly ExplorerAbility[],
  config: ExplorerConfig,
): boolean {
  for (const requirement of lock.requires) {
    const ability = abilities[indexOfAbility(abilities, requirement.ability)]
    if (ability !== undefined && ability.energy_cost > config.energy.max) return false
  }
  return true
}

function holdingsOf(state: ExplorerState, draft: ExplorerDraft): ExplorerHoldings {
  return {
    tier: draft.tier,
    mastery: draft.mastery,
    hasVisited: (nodeId) => {
      const index = indexOfNode(state.nodes, nodeId)
      return index >= 0 && (draft.visited[index] ?? false)
    },
    hasItem: (itemId) => draft.collectedItems.includes(itemId),
  }
}

/** The same holdings view over a settled state — what the VIEW and the bots read. */
export function holdingsOfState(state: ExplorerState): ExplorerHoldings {
  return {
    tier: state.tier,
    mastery: state.mastery,
    hasVisited: (nodeId) => {
      const index = indexOfNode(state.nodes, nodeId)
      return index >= 0 && (state.visited[index] ?? false)
    },
    hasItem: (itemId) => state.collectedItems.includes(itemId),
  }
}

/** True when the node still has something worth a `take` right now. A shop the player
 *  cannot yet afford is NOT claimable yet — it becomes claimable when the money does. */
export function nodeIsClaimable(state: ExplorerState, index: number): boolean {
  const node = state.nodes[index]
  if (node === undefined) return false
  if (state.claimed[index] === true) return false
  const price = node.price
  if (price !== undefined) {
    if (!state.config.currency.purchase_enabled) return false
    if (state.currency < price) return false
  }
  return (
    node.grants !== undefined ||
    node.fragment_for !== undefined ||
    node.collectible !== undefined ||
    node.currency_reward > 0 ||
    node.challenge !== undefined
  )
}

/** A node the player may activate as a respawn point. `start_is_checkpoint` promotes the
 *  starting node without the content having to flag it — a world always has somewhere to
 *  come back to, and the run's respawn point begins there whatever this flag says. */
export function isCheckpointNode(state: ExplorerState, index: number): boolean {
  const node = state.nodes[index]
  if (node === undefined) return false
  if (node.checkpoint) return true
  return index === state.start && state.config.checkpoints.start_is_checkpoint
}

export function canRestAt(state: ExplorerState, index: number): boolean {
  const node = state.nodes[index]
  if (node === undefined) return false
  if (!state.config.checkpoints.rest_only_at_checkpoint) return true
  return isCheckpointNode(state, index)
}

/** A hidden node is only drawn once a perception ability is held — when the manifest
 *  says so. The tier-1 posture draws it faintly from the start, because "there is
 *  something over there" is itself the lesson. */
export function nodeIsRevealed(state: ExplorerState, index: number): boolean {
  const node = state.nodes[index]
  if (node === undefined) return false
  if (!node.hidden) return true
  if (!state.config.optional.reveal_requires_perception) return true
  if (state.visited[index] === true) return true
  for (let i = 0; i < state.abilities.length; i += 1) {
    const ability = state.abilities[i]
    if (ability?.family === 'perception' && (state.tier[i] ?? 0) > 0) return true
  }
  return false
}

// ---- init -----------------------------------------------------------------------

function init(input: SimInit): ExplorerState {
  const config = input.config as ExplorerConfig
  const content = input.content as unknown as ExplorerContent

  const nodes = content.nodes
  const edges = content.edges
  const abilities = content.abilities

  const start = Math.max(0, indexOfNode(nodes, content.start_node))
  const visited = nodes.map((_, index) => index === start)

  return {
    config,
    nodes,
    edges,
    abilities,
    start,
    goal: Math.max(0, indexOfNode(nodes, content.goal_node)),
    seed: input.seed,
    at: start,
    travelTo: NOT_TRAVELLING,
    travelLeft: 0,
    visited,
    activated: nodes.map(
      (_, index) => index === start && config.checkpoints.start_is_checkpoint,
    ),
    claimed: nodes.map(() => false),
    solved: nodes.map(() => false),
    attemptsLeft: nodes.map(() => config.challenge.attempts),
    cache: nodes.map(() => 0),
    tier: abilities.map(() => 0),
    fragments: abilities.map(() => 0),
    readyAt: abilities.map(() => 0),
    open: edges.map((edge) => edge.lock === null),
    seqAt: edges.map(() => 0),
    collectedItems: [],
    energy: Math.min(config.energy.max, config.energy.start),
    regenLeft: config.energy.regen_interval_ticks,
    currency: config.currency.start,
    mastery: 0,
    // The respawn point always begins at the start node: a run must have somewhere to
    // come back to before the child has activated anything.
    checkpoint: start,
    moves: 0,
    uses: 0,
    rests: 0,
    actions: 0,
    deaths: 0,
    wrong: 0,
    ticks: 0,
    lives: input.scoring.mode === 'cheer' ? null : (input.scoring.lives ?? null),
    finished: false,
  }
}

// ---- one tick --------------------------------------------------------------------

function draftOf(state: ExplorerState): ExplorerDraft {
  return {
    at: state.at,
    travelTo: state.travelTo,
    travelLeft: state.travelLeft,
    visited: state.visited.slice(),
    activated: state.activated.slice(),
    claimed: state.claimed.slice(),
    solved: state.solved.slice(),
    attemptsLeft: state.attemptsLeft.slice(),
    cache: state.cache.slice(),
    tier: state.tier.slice(),
    fragments: state.fragments.slice(),
    readyAt: state.readyAt.slice(),
    open: state.open.slice(),
    seqAt: state.seqAt.slice(),
    collectedItems: state.collectedItems.slice(),
    energy: state.energy,
    regenLeft: state.regenLeft,
    currency: state.currency,
    mastery: state.mastery,
    checkpoint: state.checkpoint,
    moves: state.moves,
    uses: state.uses,
    rests: state.rests,
    actions: state.actions,
    deaths: state.deaths,
    wrong: state.wrong,
    lives: state.lives,
  }
}

/**
 * Death. The ONLY thing lost is money, and only part of it: `currency_loss_pct` is
 * dropped here as a cache the player can walk back and collect. Abilities are never
 * lost — deliberately, and it is the point of the mechanic: what you know stays yours.
 * The node's attempts are refilled so a hard question can never permanently close a
 * path, and the player respawns at the last checkpoint they activated.
 */
function die(state: ExplorerState, draft: ExplorerDraft): void {
  const config = state.config
  draft.deaths += 1

  const lost = Math.floor((draft.currency * config.death.currency_loss_pct) / 100)
  draft.currency = Math.max(0, draft.currency - lost)
  const recoverable = Math.floor((lost * config.death.cache_recoverable_pct) / 100)
  draft.cache[draft.at] = (draft.cache[draft.at] ?? 0) + recoverable

  draft.attemptsLeft[draft.at] = config.challenge.attempts
  draft.at = draft.checkpoint
  draft.travelTo = NOT_TRAVELLING
  draft.travelLeft = 0
  draft.energy = Math.min(config.energy.max, config.death.respawn_energy)
  if (config.death.costs_life && draft.lives !== null) {
    draft.lives = Math.max(0, draft.lives - 1)
  }
}

/** Hand over whatever this node holds. Called only once a challenge (if any) is solved. */
function claimNode(state: ExplorerState, draft: ExplorerDraft, index: number): void {
  const config = state.config
  const node = state.nodes[index]
  if (node === undefined) return

  const price = node.price
  if (price !== undefined) {
    // A purchase the world disabled, or one the player cannot afford yet, is inert —
    // the node simply stays claimable rather than charging for nothing.
    if (!config.currency.purchase_enabled) return
    if (draft.currency < price) return
    draft.currency -= price
  }

  const grants = node.grants
  if (grants !== undefined) {
    const abilityIndex = indexOfAbility(state.abilities, grants.ability)
    const ability = state.abilities[abilityIndex]
    if (ability !== undefined) {
      const cap = tierCap(config, ability)
      draft.tier[abilityIndex] = Math.max(
        draft.tier[abilityIndex] ?? 0,
        Math.min(grants.tier, cap),
      )
    }
  }

  const fragmentFor = node.fragment_for
  if (fragmentFor !== undefined) {
    const abilityIndex = indexOfAbility(state.abilities, fragmentFor)
    const ability = state.abilities[abilityIndex]
    if (ability !== undefined) {
      const cap = tierCap(config, ability)
      let fragments = (draft.fragments[abilityIndex] ?? 0) + 1
      let held = draft.tier[abilityIndex] ?? 0
      // Fragments only upgrade an ability already held: a fragment is a piece of
      // something you have, not a way in through the back door.
      while (held >= 1 && held < cap && fragments >= config.abilities.fragments_per_tier) {
        fragments -= config.abilities.fragments_per_tier
        held += 1
      }
      draft.fragments[abilityIndex] = fragments
      draft.tier[abilityIndex] = held
    }
  }

  const collectible = node.collectible
  if (collectible !== undefined && !draft.collectedItems.includes(collectible)) {
    draft.collectedItems.push(collectible)
  }

  draft.currency += node.currency_reward
  draft.claimed[index] = true
}

function applyTake(
  state: ExplorerState,
  draft: ExplorerDraft,
  event: GameInputEvent,
): void {
  const config = state.config
  const node = state.nodes[draft.at]
  if (node === undefined) return
  // A `take` naming another node is a malformed log, not a child's mistake: ignore it
  // rather than scoring it.
  if (event.slot !== undefined && event.slot !== node.id) return

  // 1) Money you dropped here comes back first — the recoverable-loss lesson.
  const dropped = draft.cache[draft.at] ?? 0
  if (dropped > 0) {
    draft.currency += dropped
    draft.cache[draft.at] = 0
    return
  }

  if (draft.claimed[draft.at] === true) return

  // 2) The node's micro-challenge, when it has one and it is still open.
  const challenge = node.challenge
  if (challenge !== undefined && draft.solved[draft.at] !== true) {
    const pick = event.n
    if (pick === undefined || !Number.isInteger(pick)) return
    const option = challenge.options[pick]
    if (option === undefined) return
    if (!option.correct) {
      draft.wrong += 1
      draft.currency = Math.max(0, draft.currency - config.challenge.wrong_currency_cost)
      const left = Math.max(0, (draft.attemptsLeft[draft.at] ?? 0) - 1)
      draft.attemptsLeft[draft.at] = left
      if (left <= 0) die(state, draft)
      return
    }
    draft.solved[draft.at] = true
    draft.mastery += config.challenge.mastery_per_solve
  }

  // 3) The reward, in the same event: answering correctly IS claiming.
  claimNode(state, draft, draft.at)
}

function applyUse(
  state: ExplorerState,
  draft: ExplorerDraft,
  event: GameInputEvent,
  tick: number,
): void {
  const edgeIndex = indexOfEdge(state.edges, event.slot)
  const edge = state.edges[edgeIndex]
  if (edge === undefined) return
  if (draft.open[edgeIndex] === true) return
  const lock = edge.lock
  if (lock === null) return

  const here = state.nodes[draft.at]
  if (here === undefined) return
  if (!canOperateLockFrom(edge, here.id)) return
  if (!lockSatisfied(lock, state.abilities, state.config, holdingsOf(state, draft))) return

  // Which ability is being applied? A sequence lock demands the NEXT one in the listed
  // order; any other lock accepts the one the client named, defaulting to the first the
  // lock requires.
  let abilityIndex: number
  if (lock.sequence) {
    const step = draft.seqAt[edgeIndex] ?? 0
    const expected = lock.requires[step]
    if (expected === undefined) return
    const expectedIndex = indexOfAbility(state.abilities, expected.ability)
    const picked = event.n
    if (picked === undefined || !Number.isInteger(picked)) return
    if (picked !== expectedIndex) {
      // Wrong step: the combination resets. It costs the attempt and the tick, never
      // energy and never score — a combination lock is a puzzle, not a punishment.
      draft.seqAt[edgeIndex] = 0
      draft.uses += 1
      return
    }
    abilityIndex = expectedIndex
  } else {
    const picked = event.n
    abilityIndex =
      picked !== undefined && Number.isInteger(picked)
        ? picked
        : indexOfAbility(state.abilities, lock.requires[0]?.ability)
  }

  // The COST model: an ability the player actually holds charges energy and starts its
  // own cooldown. A `soft` lock walked past on skill alone costs neither — the skill IS
  // the price.
  const ability = state.abilities[abilityIndex]
  if (ability !== undefined && (draft.tier[abilityIndex] ?? 0) > 0) {
    if (tick < (draft.readyAt[abilityIndex] ?? 0)) return
    if (draft.energy < ability.energy_cost) return
    draft.energy -= ability.energy_cost
    draft.readyAt[abilityIndex] = tick + ability.cooldown_ticks
  }

  draft.uses += 1
  if (lock.sequence) {
    const next = (draft.seqAt[edgeIndex] ?? 0) + 1
    draft.seqAt[edgeIndex] = next
    if (next >= lock.requires.length) draft.open[edgeIndex] = true
    return
  }
  draft.open[edgeIndex] = true
}

function applyMove(state: ExplorerState, draft: ExplorerDraft, event: GameInputEvent): void {
  const config = state.config
  const target = indexOfNode(state.nodes, event.slot)
  if (target < 0 || target === draft.at) return
  const here = state.nodes[draft.at]
  const there = state.nodes[target]
  if (here === undefined || there === undefined) return

  let usable = -1
  for (let i = 0; i < state.edges.length; i += 1) {
    const edge = state.edges[i]
    if (edge === undefined) continue
    if (!canTraverse(edge, here.id, there.id)) continue
    if (edge.lock !== null && draft.open[i] !== true) continue
    usable = i
    break
  }
  if (usable < 0) return
  if (draft.energy < config.movement.energy_per_move) return

  draft.energy -= config.movement.energy_per_move
  draft.moves += 1
  draft.travelTo = target
  draft.travelLeft = config.movement.ticks_per_edge
}

function applyRest(state: ExplorerState, draft: ExplorerDraft): void {
  const config = state.config
  const node = state.nodes[draft.at]
  if (node === undefined) return
  if (config.checkpoints.rest_only_at_checkpoint && !isCheckpointNode(state, draft.at)) return
  draft.checkpoint = draft.at
  draft.activated[draft.at] = true
  draft.energy = Math.min(config.energy.max, draft.energy + config.energy.rest_restores)
  draft.rests += 1
}

function step(
  state: ExplorerState,
  tick: number,
  events: readonly GameInputEvent[],
): ExplorerState {
  if (state.finished) return state

  const config = state.config
  const draft = draftOf(state)

  // 1) Travel: the walking player's own countdown, resolved BEFORE the batch so an
  //    arrival and the first action at the new node can share a tick.
  if (draft.travelLeft > 0) {
    draft.travelLeft -= 1
    if (draft.travelLeft === 0 && draft.travelTo !== NOT_TRAVELLING) {
      draft.at = draft.travelTo
      draft.travelTo = NOT_TRAVELLING
      draft.visited[draft.at] = true
    }
  }

  // 2) Energy regeneration: one countdown for the one player, never a per-tick float.
  draft.regenLeft -= 1
  if (draft.regenLeft <= 0) {
    draft.energy = Math.min(config.energy.max, draft.energy + config.energy.regen_amount)
    draft.regenLeft = config.energy.regen_interval_ticks
  }

  // 3) The whole event batch, in log order.
  for (const event of events) {
    // Mid-walk there is nobody at a node to act, and a `move` issued this tick starts a
    // new walk — both mean the rest of the batch is not addressable.
    if (draft.travelLeft > 0) break
    if (event.action === 'move') applyMove(state, draft, event)
    else if (event.action === 'use') applyUse(state, draft, event, tick)
    else if (event.action === 'take') applyTake(state, draft, event)
    else if (event.action === 'rest') applyRest(state, draft)
    else continue
    // Counted whether or not it changed anything: a tap that did nothing was still a
    // decision, and pretending otherwise is what would let mashing score well.
    draft.actions += 1
  }

  const ticks = tick + 1
  const total = state.nodes.length
  const explorationPct = total > 0 ? (countTrue(draft.visited) * 100) / total : 0
  const goalDone = !config.ending.require_goal_node || draft.visited[state.goal] === true
  const finished =
    ticks >= config.tick_budget ||
    (draft.lives !== null && draft.lives <= 0) ||
    (goalDone && explorationPct >= config.ending.exploration_pct_required)

  return {
    ...state,
    at: draft.at,
    travelTo: draft.travelTo,
    travelLeft: draft.travelLeft,
    visited: draft.visited,
    activated: draft.activated,
    claimed: draft.claimed,
    solved: draft.solved,
    attemptsLeft: draft.attemptsLeft,
    cache: draft.cache,
    tier: draft.tier,
    fragments: draft.fragments,
    readyAt: draft.readyAt,
    open: draft.open,
    seqAt: draft.seqAt,
    collectedItems: draft.collectedItems,
    energy: draft.energy,
    regenLeft: draft.regenLeft,
    currency: draft.currency,
    mastery: draft.mastery,
    checkpoint: draft.checkpoint,
    moves: draft.moves,
    uses: draft.uses,
    rests: draft.rests,
    actions: draft.actions,
    deaths: draft.deaths,
    wrong: draft.wrong,
    ticks,
    lives: draft.lives,
    finished,
  }
}

// ---- scoring ---------------------------------------------------------------------

export function explorationPercent(state: ExplorerState): number {
  const total = state.nodes.length
  if (total <= 0) return 0
  return (countTrue(state.visited) * 100) / total
}

function abilitiesHeld(state: ExplorerState): number {
  let total = 0
  for (const tier of state.tier) {
    if (tier > 0) total += 1
  }
  return total
}

/** The blended 0..100 score, read by BOTH `snapshot` (the HUD) and `result` (the
 *  reward), so the number a child watches is the number Core grants. */
function scoreOf(state: ExplorerState): number {
  const weights = state.config.score_weights
  const blend = weightedScore([
    { value: targetScore(countTrue(state.visited), state.nodes.length), weight: weights.exploration },
    { value: targetScore(abilitiesHeld(state), state.abilities.length), weight: weights.abilities },
    {
      value: targetScore(state.collectedItems.length, state.config.collectibles.target),
      weight: state.config.collectibles.enabled ? weights.collectibles : 0,
    },
    { value: targetScore(state.currency, state.config.currency.target), weight: weights.currency },
    {
      // A grace budget, then a linear decay to zero at twice the budget: a run inside
      // `action_budget` scores a full 100, so a child who thinks for a while and then
      // walks straight to the answer loses nothing, while a run of hundreds of taps
      // scores zero. Measured in DECISIONS, never in ticks — see the schema comment.
      value: efficiencyScore(
        Math.max(0, state.actions - state.config.action_budget),
        state.config.action_budget,
      ),
      weight: weights.efficiency,
    },
  ])
  // Deaths and wrong answers are separate evidence: a death already cost currency (which
  // the currency signal sees), and a wrong answer already cost a tick, so each penalty
  // is the document's own "and this much on top" dial rather than a second count of the
  // same mistake.
  const afterDeaths = applyPenalty(blend, state.deaths, state.config.penalties.death_pct)
  return applyPenalty(afterDeaths, state.wrong, state.config.penalties.wrong_answer_pct)
}

function snapshot(state: ExplorerState): SimSnapshot {
  return {
    finished: state.finished,
    score: scoreOf(state),
    lives: state.lives,
    // There are no rounds in a metroidvania; what the HUD's "round" means here is how
    // far up the ability ladder the child has climbed, which is the real progression.
    round: abilitiesHeld(state) + 1,
  }
}

function result(state: ExplorerState): SimResult {
  return {
    score: scoreOf(state),
    finished: state.finished,
    // Derived aggregates only — `game_attempts.stats` may hold exactly this and nothing
    // tick-resolution about a child's session (§11).
    stats: {
      visited: countTrue(state.visited),
      nodes: state.nodes.length,
      exploration_pct: Math.round(explorationPercent(state)),
      abilities: abilitiesHeld(state),
      collectibles: state.collectedItems.length,
      locks_opened: countTrue(state.open),
      currency: state.currency,
      mastery: state.mastery,
      moves: state.moves,
      uses: state.uses,
      rests: state.rests,
      actions: state.actions,
      deaths: state.deaths,
      wrong: state.wrong,
      reached_goal: state.visited[state.goal] === true ? 1 : 0,
      ticks: state.ticks,
    },
  }
}

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

export const explorerSimulator: Simulator<ExplorerState> = {
  mechanic: 'explorer',
  actions: EXPLORER_ACTIONS,
  init,
  step,
  snapshot,
  result,
  bots: {
    perfect: (state, tick) => perfectBot(state, tick),
    random: (state, tick, rng) => randomBot(state, tick, rng),
  },
}

// ---- the world solver — THE gate for this mechanic ---------------------------------

/** The difficulty variables §4 makes config-driven, measured on the authored graph so
 *  the pipeline can check that the world it got is the world it asked for. */
export interface ExplorerWorldAudit {
  node_count: number
  edge_count: number
  locked_edge_pct: number
  shortcut_pct: number
  hidden_pct: number
  /** Share of LOCKED edges per kind — the linearity / sequence-breaking dial. */
  lock_mix: { hard: number; soft: number; compound: number; temporal: number }
  within_connectivity: boolean
  within_lock_mix: boolean
  tutorial_rooms_ok: boolean
}

export interface ExplorerWorldReport {
  /** Completable: the goal is reachable AND the ending's exploration threshold can be
   *  met. This is the flag the Arcade `gate`/`simulate` stages refuse a world on. */
  solvable: boolean
  reachable: string[]
  unreachable: string[]
  /** Ability ids a competent player can actually end up holding. */
  abilities: string[]
  goal_reachable: boolean
  exploration_pct: number
  /** Stable machine-readable strings, safe to feed back as corrective feedback. */
  reasons: string[]
  audit: ExplorerWorldAudit
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part * 100) / whole)
}

/**
 * REACHABILITY FIXPOINT — the single most important gate for this mechanic.
 *
 * Repeatedly: harvest every reachable-but-unharvested node (assuming a competent player
 * answers its micro-challenge, which is exactly what the perfect bot does), then expand
 * the reachable set across every edge whose lock the harvest has now satisfied. Repeat
 * until nothing new becomes reachable. Every quantity it tracks — the reachable set, the
 * tiers held, the money budget, the mastery — is monotone non-decreasing and bounded, so
 * the loop terminates, and what it terminates on is the true closure.
 *
 * A one-way LOCKED edge never extends reachability: its lock is operated from `to`, which
 * must already be reachable, so a shortcut is a convenience and never a progression gate.
 *
 * Pure: no state, no clock, no randomness. The pipeline, the tests and the dev lab all
 * call it and all get the same answer.
 */
export function solveExplorerWorld(
  config: ExplorerConfig,
  content: ExplorerContent,
): ExplorerWorldReport {
  const { nodes, edges, abilities } = content
  const reasons: string[] = []

  const reachable = nodes.map(() => false)
  const harvested = nodes.map(() => false)
  const tier = abilities.map(() => 0)
  const fragments = abilities.map(() => 0)
  const collected: string[] = []
  let budget = config.currency.start
  let mastery = 0

  const start = indexOfNode(nodes, content.start_node)
  if (start < 0) {
    reasons.push('start_node_missing')
  } else {
    reachable[start] = true
  }

  const holdings: ExplorerHoldings = {
    tier,
    get mastery() {
      return mastery
    },
    hasVisited: (nodeId) => {
      const index = indexOfNode(nodes, nodeId)
      return index >= 0 && (reachable[index] ?? false)
    },
    hasItem: (itemId) => collected.includes(itemId),
  }

  let changed = true
  while (changed) {
    changed = false

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      if (node === undefined) continue
      if (reachable[i] !== true || harvested[i] === true) continue

      const price = node.price
      if (price !== undefined) {
        if (!config.currency.purchase_enabled) {
          // A shop in a world that disabled purchases is dead content, not a blocker.
          harvested[i] = true
          changed = true
          reasons.push(`shop_inert:${node.id}`)
          continue
        }
        // Not affordable YET: leave it unharvested so a later, richer pass can buy it.
        if (budget < price) continue
        budget -= price
      }

      harvested[i] = true
      changed = true

      const grants = node.grants
      if (grants !== undefined) {
        const index = indexOfAbility(abilities, grants.ability)
        const ability = abilities[index]
        if (ability !== undefined) {
          tier[index] = Math.max(tier[index] ?? 0, Math.min(grants.tier, tierCap(config, ability)))
        }
      }

      const fragmentFor = node.fragment_for
      if (fragmentFor !== undefined) {
        const index = indexOfAbility(abilities, fragmentFor)
        const ability = abilities[index]
        if (ability !== undefined) {
          const cap = tierCap(config, ability)
          let pieces = (fragments[index] ?? 0) + 1
          let held = tier[index] ?? 0
          while (held >= 1 && held < cap && pieces >= config.abilities.fragments_per_tier) {
            pieces -= config.abilities.fragments_per_tier
            held += 1
          }
          fragments[index] = pieces
          tier[index] = held
        }
      }

      const collectible = node.collectible
      if (collectible !== undefined && !collected.includes(collectible)) collected.push(collectible)
      if (node.challenge !== undefined) mastery += config.challenge.mastery_per_solve
      budget += node.currency_reward
    }

    for (let e = 0; e < edges.length; e += 1) {
      const edge = edges[e]
      if (edge === undefined) continue
      const from = indexOfNode(nodes, edge.from)
      const to = indexOfNode(nodes, edge.to)
      if (from < 0 || to < 0) continue

      const lock = edge.lock
      if (lock !== null) {
        if (edge.one_way) continue
        if (!lockAffordable(lock, abilities, config)) continue
        if (!lockSatisfied(lock, abilities, config, holdings)) continue
      }

      if (reachable[from] === true && reachable[to] !== true) {
        reachable[to] = true
        changed = true
      }
      if (!edge.one_way && reachable[to] === true && reachable[from] !== true) {
        reachable[from] = true
        changed = true
      }
    }
  }

  const reachableIds: string[] = []
  const unreachableIds: string[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (node === undefined) continue
    if (reachable[i] === true) reachableIds.push(node.id)
    else unreachableIds.push(node.id)
  }
  if (unreachableIds.length > 0) reasons.push(`unreachable_nodes:${unreachableIds.join(',')}`)

  const heldAbilityIds: string[] = []
  for (let i = 0; i < abilities.length; i += 1) {
    const ability = abilities[i]
    if (ability === undefined) continue
    if ((tier[i] ?? 0) > 0) heldAbilityIds.push(ability.id)
    if (ability.energy_cost > config.energy.max) {
      reasons.push(`ability_cost_exceeds_energy:${ability.id}`)
    }
  }

  const goalIndex = indexOfNode(nodes, content.goal_node)
  const goalReachable = goalIndex >= 0 && reachable[goalIndex] === true
  if (!goalReachable) reasons.push('goal_unreachable')

  const explorationPct = pct(reachableIds.length, nodes.length)
  if (explorationPct < config.ending.exploration_pct_required) {
    reasons.push('exploration_below_required')
  }

  // ---- the difficulty-variable audit -------------------------------------------
  let locked = 0
  let shortcuts = 0
  let hidden = 0
  const kinds = { hard: 0, soft: 0, compound: 0, temporal: 0 }
  for (const edge of edges) {
    if (edge.one_way) shortcuts += 1
    const lock = edge.lock
    if (lock === null) continue
    locked += 1
    kinds[lock.kind] += 1
  }
  for (const node of nodes) {
    if (node.hidden) hidden += 1
  }

  const connectivity = config.connectivity
  const lockedPct = pct(locked, edges.length)
  const shortcutPct = pct(shortcuts, edges.length)
  const withinConnectivity =
    nodes.length >= connectivity.min_nodes &&
    nodes.length <= connectivity.max_nodes &&
    lockedPct >= connectivity.locked_edge_pct_min &&
    lockedPct <= connectivity.locked_edge_pct_max &&
    shortcutPct >= connectivity.shortcut_pct_min &&
    shortcutPct <= connectivity.shortcut_pct_max
  if (!withinConnectivity) reasons.push('connectivity_out_of_bounds')

  const mix = {
    hard: pct(kinds.hard, locked),
    soft: pct(kinds.soft, locked),
    compound: pct(kinds.compound, locked),
    temporal: pct(kinds.temporal, locked),
  }
  const tolerance = config.locks.mix_tolerance_pct
  const withinLockMix =
    locked === 0 ||
    (Math.abs(mix.hard - config.locks.mix.hard_pct) <= tolerance &&
      Math.abs(mix.soft - config.locks.mix.soft_pct) <= tolerance &&
      Math.abs(mix.compound - config.locks.mix.compound_pct) <= tolerance &&
      Math.abs(mix.temporal - config.locks.mix.temporal_pct) <= tolerance)
  if (!withinLockMix) reasons.push('lock_mix_out_of_bounds')

  const hiddenPct = pct(hidden, nodes.length)

  let tutorialRoomsOk = true
  if (config.abilities.tutorial_room_per_family) {
    for (const family of ['movement', 'interaction', 'perception'] as const) {
      const familyHasAbility = abilities.some((ability) => ability.family === family)
      if (!familyHasAbility) continue
      const taught = nodes.some(
        (node) => node.kind === 'tutorial' && node.teaches_family === family,
      )
      if (!taught) {
        tutorialRoomsOk = false
        reasons.push(`tutorial_room_missing:${family}`)
      }
    }
  }

  return {
    solvable: goalReachable && explorationPct >= config.ending.exploration_pct_required,
    reachable: reachableIds,
    unreachable: unreachableIds,
    abilities: heldAbilityIds,
    goal_reachable: goalReachable,
    exploration_pct: explorationPct,
    reasons,
    audit: {
      node_count: nodes.length,
      edge_count: edges.length,
      locked_edge_pct: lockedPct,
      shortcut_pct: shortcutPct,
      hidden_pct: hiddenPct,
      lock_mix: mix,
      within_connectivity: withinConnectivity,
      within_lock_mix: withinLockMix,
      tutorial_rooms_ok: tutorialRoomsOk,
    },
  }
}
