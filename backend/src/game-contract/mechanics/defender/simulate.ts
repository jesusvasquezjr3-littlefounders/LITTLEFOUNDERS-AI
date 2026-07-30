// `defender` — the PURE simulator (GAME_ENGINE.md §5, brief §4).
//
// No React, no DOM, no `Date.now()`, no `Math.random()`, no `%`, no transcendental
// function anywhere: Core re-runs this exact code over the player's input log to derive
// the reward, so every operation here is one the ECMAScript spec pins to the last bit
// (`+ - * /`, `Math.sqrt/abs/min/max/floor/ceil/round/trunc/sign`). Row and column are
// derived with `Math.floor(index / cols)` rather than `%` for exactly that reason.
//
// THIS MECHANIC IS FULLY SCRIPTED. Waves, stats and costs all come from the manifest,
// so the simulation needs no randomness at all; `init` still accepts and records the
// seed for contract uniformity, and two different seeds produce identical runs. The
// only seeded stream in the mechanic is the one `runBot` hands the `random` bot.
//
// The two v1 bugs the brief calls out are structurally excluded, and both earn a
// comment because both were expensive:
//
//  - PER-ENTITY TIMERS. Every tower carries its OWN `cooldownLeft`; every enemy carries
//    its own `slowLeft`, `dotLeft`, `healLeft`, `sapperLeft`, `shieldDelayLeft` and
//    `bornAt`. There is no shared accumulator that N entities each decrement, so N
//    bombs cannot make one clock run N times too fast.
//  - BATCHED REMOVALS. A tick resolves the WHOLE event batch, then all enemy status,
//    then all movement, then all tower fire, and only THEN rebuilds the enemy array in
//    ONE pass that removes the dead and the leaked together and appends every split
//    child. There is no per-event dispatch and no early return, so several simultaneous
//    removals cannot stall the motion of everything else on that tick.
//
// PATHFINDING (the spec's explicit requirement). `computeDistanceField` is a
// multi-source Dijkstra run backwards from every exit, over integer per-terrain entry
// costs, so `dist[c]` is the exact cost of the cheapest route from `c` to the nearest
// base. An enemy then only ever reads its four neighbours. TIE-BREAK, stated once and
// obeyed everywhere: candidates are scanned in a FIXED order and a later candidate
// replaces the current best ONLY on a strictly smaller value — for the frontier scan
// that means the lowest cell index wins, and for an enemy's step it means the fixed
// neighbour order NORTH, EAST, SOUTH, WEST wins. Both are total orders over integers,
// so there is never a coin to flip.
//
// SEALING IS REJECTED BEFORE IT IS APPLIED. `wouldSeal()` re-runs the field on the
// HYPOTHETICAL grid and refuses any placement that leaves an entry — or a live ground
// enemy — with no route to a base. It is called from `tryPlaceBlocker()`, the single
// funnel every wall and every blocking tower passes through, so the classic
// tower-defence rule cannot be bypassed by a second code path. Recomputes happen only
// when the grid actually changes (a build, a sell, a wall destroyed by a sapper), in
// input-log order, one build at a time — so the order of recomputes is as deterministic
// as the log itself.

import {
  accuracyScore,
  applyPenalty,
  clampScore,
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

import {
  DEFENDER_ARMORS,
  DEFENDER_DAMAGE_TYPES,
  DEFENDER_PRIORITIES,
  type DefenderArchetype,
  type DefenderConfig,
  type DefenderDamageType,
  type DefenderEnemyType,
  type DefenderPriority,
  type DefenderTowerType,
} from './schema.js'

/**
 * Every player intent. `build_tower`/`build_wall`/`sell`/`upgrade`/`priority` address a
 * cell through `x` (column) and `y` (row); `slot` names the tower type, the upgrade
 * branch, the priority, the ability or the heat modifier. Anything else is refused by
 * `replayGame()` before this simulator is even initialised.
 */
export const DEFENDER_ACTIONS = [
  'build_tower',
  'build_wall',
  'sell',
  'upgrade',
  'priority',
  'ability',
  'heat',
  'start_wave',
] as const
export type DefenderAction = (typeof DEFENDER_ACTIONS)[number]

// ---- Terrain -------------------------------------------------------------------

export const TERRAIN_OPEN = 0
export const TERRAIN_ROCK = 1
export const TERRAIN_ROAD = 2
export const TERRAIN_ENTRY = 3
export const TERRAIN_EXIT = 4

/** Milli-cell resolution: one whole cell of travel is 1000 units of progress. Integer
 *  positions mean tower range checks are exact integer comparisons. */
const CELL_MILLI = 1000
/** Cell centre offset, in milli-cells. */
const HALF_CELL = 500

/** Neighbour order — NORTH, EAST, SOUTH, WEST. The documented tie-break. */
const NEIGHBOUR_DX = [0, 1, 0, -1] as const
const NEIGHBOUR_DY = [-1, 0, 1, 0] as const

/** A split child may itself split once; beyond that a chain of splitters would be an
 *  unbounded spawn loop rather than a difficulty spike. */
const MAX_SPLIT_GENERATION = 2

/** Ceiling on cells an enemy may traverse in a single tick — a manifest with an absurd
 *  speed degrades to "very fast", never to a frozen main thread. */
const MAX_STEPS_PER_TICK = 8

/** Cells the bots' route walk will follow before giving up. */
const MAX_ROUTE_LENGTH = 400

// ---- State ----------------------------------------------------------------------

export interface DefenderEnemy {
  /** Unique for the whole run. The input log never addresses an enemy, but the HUD,
   *  the tie-breaks and the batched removals all need a stable identity. */
  uid: number
  typeIndex: number
  hp: number
  maxHp: number
  shield: number
  shieldMax: number
  /** Per-entity: ticks before the shield may start refilling again. */
  shieldDelayLeft: number
  /** Ground: the cell it currently occupies and the one it is entering. */
  cell: number
  nextCell: number
  /** Milli-progress into `nextCell`; a step costs `1000 * stepCost(nextCell)`. */
  progress: number
  flying: boolean
  /** Flying: milli coordinates, unit direction, and remaining straight-line distance. */
  fx: number
  fy: number
  fdx: number
  fdy: number
  flyLeft: number
  slowPct: number
  slowLeft: number
  /** How many slows have already landed — drives the diminishing-returns curve. */
  slowStacks: number
  frozenLeft: number
  dotDamage: number
  dotLeft: number
  healLeft: number
  sapperLeft: number
  phaseIndex: number
  bornAt: number
  bounty: number
  livesCost: number
  generation: number
  isBoss: boolean
}

export interface DefenderTower {
  uid: number
  typeIndex: number
  cell: number
  /** Live archetype — a tier-3 upgrade may TRANSFORM it away from the type's own. */
  archetype: DefenderArchetype
  range: number
  fireInterval: number
  damage: number
  damageType: DefenderDamageType
  splash: number
  splashPct: number
  slowPct: number
  slowTicks: number
  dotDamage: number
  dotTicks: number
  targetsAir: boolean
  targetsGround: boolean
  detectsStealth: boolean
  auraDamagePct: number
  auraRatePct: number
  income: number
  blocks: boolean
  priority: DefenderPriority
  /** PER-TOWER firing timer. Never a shared accumulator. */
  cooldownLeft: number
  /** Gold sunk into this tower so far — the base of the sell refund. */
  invested: number
  /** The branch this tower committed to; the others are refused from then on. */
  branchId: string | null
  branchTier: number
}

export type DefenderPhase = 'prep' | 'wave'

export interface DefenderState {
  config: DefenderConfig
  /** Recorded for contract uniformity; this mechanic is fully scripted (see header). */
  seed: number
  cols: number
  rows: number
  terrain: readonly number[]
  entryCells: readonly number[]
  exitCells: readonly number[]
  /** Tower uid occupying a cell, or 0. */
  towerAt: readonly number[]
  /** Remaining wall hp on a cell, or 0. */
  wallAt: readonly number[]
  /** Cost-to-nearest-base respecting blockers; -1 = no route. */
  dist: readonly number[]
  /** The same field IGNORING walls and blocking towers — what a sapper compares
   *  against to decide a wall is worth breaking. */
  ghostDist: readonly number[]
  /** damage type × armour → multiplier percent, flattened. */
  matrix: readonly number[]
  /** Compounding per-wave percents, precomputed once. */
  hpScale: readonly number[]
  goldScale: readonly number[]
  /** Every enemy the manifest will send (splits excluded) — the defence denominator. */
  totalEnemies: number

  towers: readonly DefenderTower[]
  enemies: readonly DefenderEnemy[]
  nextUid: number

  gold: number
  gems: number
  lives: number | null
  /** Index into `config.heat`, or -1 for the honest baseline. */
  heatIndex: number
  abilityCooldown: readonly number[]

  phase: DefenderPhase
  waveIndex: number
  waveTick: number
  prepLeft: number
  /** Enemies already spawned per group of the CURRENT wave. */
  spawned: readonly number[]
  wavesCleared: number
  wavesStarted: number

  tick: number
  killed: number
  leaked: number
  wallsBuilt: number
  towersBuilt: number
  goldSpent: number
  goldEarned: number
  /** Placements refused because they would have sealed the path (or were unaffordable
   *  / illegal). Surfaced so the view can teach the rule instead of ignoring the tap. */
  blockedBuilds: number
  abilitiesUsed: number
  finished: boolean
  defeated: boolean
}

// ---- Grid helpers ----------------------------------------------------------------

export function cellIndex(cols: number, col: number, row: number): number {
  return row * cols + col
}

export function cellCol(cols: number, cell: number): number {
  return cell - Math.floor(cell / cols) * cols
}

export function cellRow(cols: number, cell: number): number {
  return Math.floor(cell / cols)
}

/** Milli-cell centre of a cell — the anchor every range check uses. */
export function cellCentre(cols: number, cell: number): { x: number; y: number } {
  return {
    x: cellCol(cols, cell) * CELL_MILLI + HALF_CELL,
    y: cellRow(cols, cell) * CELL_MILLI + HALF_CELL,
  }
}

function terrainCode(char: string): number {
  if (char === '#') return TERRAIN_ROCK
  if (char === '=') return TERRAIN_ROAD
  if (char === 'S') return TERRAIN_ENTRY
  if (char === 'X') return TERRAIN_EXIT
  return TERRAIN_OPEN
}

/** Cost of ENTERING a cell — the pathfinder's edge weight AND the travel time, so the
 *  two can never disagree about which route is "slower". */
function stepCost(config: DefenderConfig, terrain: readonly number[], cell: number): number {
  const code = terrain[cell] ?? TERRAIN_ROCK
  return code === TERRAIN_OPEN ? config.step_costs.open : config.step_costs.road
}

/** Only genuinely open ground is buildable: rock is terrain, and the road, the entries
 *  and the base are the manifest's protected route. */
function isBuildable(terrain: readonly number[], cell: number): boolean {
  return (terrain[cell] ?? TERRAIN_ROCK) === TERRAIN_OPEN
}

/**
 * Multi-source Dijkstra from every exit, over integer entry costs. Returns the exact
 * cost from each cell to the nearest base, or -1 where no route exists.
 *
 * The frontier is chosen by an ascending index scan with a strict `<` comparison, so
 * ties resolve to the LOWEST CELL INDEX — a total order over integers, hence identical
 * in the browser and on the server. A binary heap would be asymptotically nicer and
 * would introduce a sibling-ordering question this cannot have; the grid is at most
 * 24 × 18 cells and the field is recomputed only when the grid changes.
 */
export function computeDistanceField(
  config: DefenderConfig,
  cols: number,
  rows: number,
  terrain: readonly number[],
  exits: readonly number[],
  blocked: readonly boolean[],
): number[] {
  const size = cols * rows
  const dist: number[] = new Array<number>(size).fill(-1)
  const settled: boolean[] = new Array<boolean>(size).fill(false)

  for (const exit of exits) {
    if (exit < 0 || exit >= size) continue
    if (blocked[exit] === true) continue
    dist[exit] = 0
  }

  for (;;) {
    let best = -1
    let bestDist = -1
    for (let i = 0; i < size; i += 1) {
      if (settled[i] === true) continue
      const d = dist[i]
      if (d === undefined || d < 0) continue
      if (best === -1 || d < bestDist) {
        best = i
        bestDist = d
      }
    }
    if (best === -1) break
    settled[best] = true

    const col = cellCol(cols, best)
    const row = cellRow(cols, best)
    const cost = stepCost(config, terrain, best)
    for (let n = 0; n < 4; n += 1) {
      const nx = col + (NEIGHBOUR_DX[n] ?? 0)
      const ny = row + (NEIGHBOUR_DY[n] ?? 0)
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      const neighbour = cellIndex(cols, nx, ny)
      if (blocked[neighbour] === true) continue
      if ((terrain[neighbour] ?? TERRAIN_ROCK) === TERRAIN_ROCK) continue
      const candidate = bestDist + cost
      const current = dist[neighbour] ?? -1
      if (current < 0 || candidate < current) dist[neighbour] = candidate
    }
  }

  return dist
}

/** Cells a ground enemy cannot enter: rock is terrain (handled separately), walls always
 *  block, towers block when the manifest says so and the tower type says so. */
function blockedFlags(
  config: DefenderConfig,
  towers: readonly DefenderTower[],
  towerAt: readonly number[],
  wallAt: readonly number[],
  size: number,
): boolean[] {
  const flags: boolean[] = new Array<boolean>(size).fill(false)
  for (let cell = 0; cell < size; cell += 1) {
    if ((wallAt[cell] ?? 0) > 0) {
      flags[cell] = true
      continue
    }
    const uid = towerAt[cell] ?? 0
    if (uid === 0) continue
    if (!config.build.towers_block_path) continue
    const tower = towers.find((candidate) => candidate.uid === uid)
    if (tower !== undefined && tower.blocks) flags[cell] = true
  }
  return flags
}

/** The walls-and-towers-ignored field. Sappers compare against it to decide whether a
 *  wall is worth the time it takes to break. */
function ghostFlags(size: number): boolean[] {
  return new Array<boolean>(size).fill(false)
}

/**
 * The step an enemy on `cell` takes: the neighbour minimising `dist + entry cost`,
 * scanned in the fixed NORTH/EAST/SOUTH/WEST order with a strict `<`, so the earliest
 * neighbour wins a tie. Returns -1 when nothing is reachable (which `wouldSeal` makes
 * unreachable in practice, and which the caller degrades to "stand still").
 */
export function chooseNextCell(
  config: DefenderConfig,
  cols: number,
  rows: number,
  terrain: readonly number[],
  dist: readonly number[],
  cell: number,
): number {
  const col = cellCol(cols, cell)
  const row = cellRow(cols, cell)
  let best = -1
  let bestValue = -1
  for (let n = 0; n < 4; n += 1) {
    const nx = col + (NEIGHBOUR_DX[n] ?? 0)
    const ny = row + (NEIGHBOUR_DY[n] ?? 0)
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
    const neighbour = cellIndex(cols, nx, ny)
    const d = dist[neighbour] ?? -1
    if (d < 0) continue
    const value = d + stepCost(config, terrain, neighbour)
    if (best === -1 || value < bestValue) {
      best = neighbour
      bestValue = value
    }
  }
  return best
}

// ---- Damage matrix ----------------------------------------------------------------

function matrixIndex(damage: DefenderDamageType, armorIndex: number): number {
  return DEFENDER_DAMAGE_TYPES.indexOf(damage) * DEFENDER_ARMORS.length + armorIndex
}

function buildMatrix(config: DefenderConfig): number[] {
  const size = DEFENDER_DAMAGE_TYPES.length * DEFENDER_ARMORS.length
  const matrix: number[] = new Array<number>(size).fill(config.default_multiplier_pct)
  for (const row of config.damage_matrix) {
    const armorIndex = DEFENDER_ARMORS.indexOf(row.armor)
    if (armorIndex < 0) continue
    matrix[matrixIndex(row.damage, armorIndex)] = row.multiplier_pct
  }
  return matrix
}

// ---- Positions ---------------------------------------------------------------------

/** Milli-cell position of an enemy — the single source both the range checks and the
 *  renderer read, so a tower never shoots something a child cannot see under it. */
export function enemyPosition(
  state: DefenderState,
  enemy: DefenderEnemy,
): { x: number; y: number } {
  if (enemy.flying) return { x: enemy.fx, y: enemy.fy }
  const from = cellCentre(state.cols, enemy.cell)
  if (enemy.nextCell === enemy.cell || enemy.progress <= 0) return from
  const to = cellCentre(state.cols, enemy.nextCell)
  const span = CELL_MILLI * stepCost(state.config, state.terrain, enemy.nextCell)
  const travelled = span <= 0 ? 0 : enemy.progress / span
  return {
    x: from.x + (to.x - from.x) * travelled,
    y: from.y + (to.y - from.y) * travelled,
  }
}

/** How far an enemy still has to go, in the same units the priorities compare. Ground
 *  enemies read the distance field; flyers read their remaining straight line. */
function remainingDistance(state: DefenderState, enemy: DefenderEnemy): number {
  if (enemy.flying) return enemy.flyLeft
  const d = state.dist[enemy.cell] ?? -1
  return d < 0 ? Number.MAX_SAFE_INTEGER : d * CELL_MILLI - enemy.progress
}

// ---- Enemy/tower type lookups -------------------------------------------------------

function enemyTypeAt(config: DefenderConfig, index: number): DefenderEnemyType | undefined {
  return config.enemies[index]
}

function towerTypeAt(config: DefenderConfig, index: number): DefenderTowerType | undefined {
  return config.towers[index]
}

function enemyTypeIndexOf(config: DefenderConfig, id: string): number {
  for (const [index, enemy] of config.enemies.entries()) {
    if (enemy.id === id) return index
  }
  return -1
}

function towerTypeIndexOf(config: DefenderConfig, id: string): number {
  for (const [index, tower] of config.towers.entries()) {
    if (tower.id === id) return index
  }
  return -1
}

// ---- init ---------------------------------------------------------------------------

/** Compounding percent ramp: `[100, g, g², …]`, floored at every step so the whole
 *  growth curve is integer arithmetic instead of a float power. */
function growthRamp(waves: number, percentPerWave: number): number[] {
  const ramp: number[] = []
  let value = 100
  for (let i = 0; i < waves; i += 1) {
    ramp.push(value)
    value = Math.floor((value * percentPerWave) / 100)
  }
  return ramp
}

function towerFromType(type: DefenderTowerType, typeIndex: number, uid: number, cell: number): DefenderTower {
  return {
    uid,
    typeIndex,
    cell,
    archetype: type.archetype,
    range: type.range_mcells,
    fireInterval: type.fire_interval_ticks,
    damage: type.damage,
    damageType: type.damage_type,
    splash: type.splash_mcells ?? 0,
    splashPct: type.splash_damage_pct ?? 0,
    slowPct: type.slow_pct ?? 0,
    slowTicks: type.slow_ticks ?? 0,
    dotDamage: type.dot_damage ?? 0,
    dotTicks: type.dot_ticks ?? 0,
    targetsAir: type.targets_air,
    targetsGround: type.targets_ground,
    detectsStealth: type.detects_stealth === true,
    auraDamagePct: type.aura?.damage_bonus_pct ?? 0,
    auraRatePct: type.aura?.rate_bonus_pct ?? 0,
    income: type.income_per_wave ?? 0,
    blocks: type.blocks_path,
    priority: type.default_priority,
    cooldownLeft: 0,
    invested: type.cost,
    branchId: null,
    branchTier: 0,
  }
}

function init(input: SimInit): DefenderState {
  const config = input.config as DefenderConfig
  const map = config.grid.map
  const firstRow = map[0] ?? ''
  const cols = firstRow.length
  const rows = map.length
  const size = cols * rows

  const terrain: number[] = new Array<number>(size).fill(TERRAIN_ROCK)
  const entryCells: number[] = []
  const exitCells: number[] = []
  for (const [row, line] of map.entries()) {
    for (let col = 0; col < cols; col += 1) {
      const char = line.charAt(col)
      const code = terrainCode(char)
      const cell = cellIndex(cols, col, row)
      terrain[cell] = code
      if (code === TERRAIN_ENTRY) entryCells.push(cell)
      if (code === TERRAIN_EXIT) exitCells.push(cell)
    }
  }

  const towerAt: number[] = new Array<number>(size).fill(0)
  const wallAt: number[] = new Array<number>(size).fill(0)
  const dist = computeDistanceField(
    config,
    cols,
    rows,
    terrain,
    exitCells,
    new Array<boolean>(size).fill(false),
  )

  let totalEnemies = 0
  for (const wave of config.waves) {
    for (const group of wave.groups) totalEnemies += group.count
  }

  return {
    config,
    seed: input.seed,
    cols,
    rows,
    terrain,
    entryCells,
    exitCells,
    towerAt,
    wallAt,
    dist,
    ghostDist: dist,
    matrix: buildMatrix(config),
    hpScale: growthRamp(config.waves.length, config.economy.hp_growth_pct_per_wave),
    goldScale: growthRamp(config.waves.length, config.economy.gold_growth_pct_per_wave),
    totalEnemies: Math.max(1, totalEnemies),

    towers: [],
    enemies: [],
    nextUid: 1,

    gold: config.economy.starting_gold,
    gems: config.economy.secondary?.starting ?? 0,
    lives: input.scoring.mode === 'cheer' ? null : (input.scoring.lives ?? null),
    heatIndex: -1,
    abilityCooldown: (config.economy.secondary?.abilities ?? []).map(() => 0),

    phase: 'prep',
    waveIndex: 0,
    waveTick: 0,
    prepLeft: config.prep_ticks,
    spawned: (config.waves[0]?.groups ?? []).map(() => 0),
    wavesCleared: 0,
    wavesStarted: 0,

    tick: 0,
    killed: 0,
    leaked: 0,
    wallsBuilt: 0,
    towersBuilt: 0,
    goldSpent: 0,
    goldEarned: 0,
    blockedBuilds: 0,
    abilitiesUsed: 0,
    finished: false,
    defeated: false,
  }
}

// ---- Seal check ----------------------------------------------------------------------

/**
 * THE tower-defence rule, enforced in ONE place. Re-runs the distance field over the
 * HYPOTHETICAL grid and refuses the placement when any entry, or any live ground enemy,
 * would be left with no route to a base. A rejected placement costs nothing: the gold is
 * never debited and the grid is never touched.
 */
export function wouldSeal(state: DefenderState, cell: number, towers: readonly DefenderTower[], towerAt: readonly number[], wallAt: readonly number[], enemies: readonly DefenderEnemy[]): boolean {
  const size = state.cols * state.rows
  const flags = blockedFlags(state.config, towers, towerAt, wallAt, size)
  flags[cell] = true
  const probe = computeDistanceField(
    state.config,
    state.cols,
    state.rows,
    state.terrain,
    state.exitCells,
    flags,
  )
  for (const entry of state.entryCells) {
    if ((probe[entry] ?? -1) < 0) return true
  }
  for (const enemy of enemies) {
    if (enemy.flying) continue
    if ((probe[enemy.cell] ?? -1) < 0) return true
    if ((probe[enemy.nextCell] ?? -1) < 0) return true
  }
  return false
}

// ---- step -----------------------------------------------------------------------------

interface Draft {
  towerAt: number[]
  wallAt: number[]
  dist: readonly number[]
  ghostDist: readonly number[]
  towers: DefenderTower[]
  enemies: DefenderEnemy[]
  abilityCooldown: number[]
  spawned: number[]
  nextUid: number
  gold: number
  gems: number
  lives: number | null
  heatIndex: number
  phase: DefenderPhase
  waveIndex: number
  waveTick: number
  prepLeft: number
  wavesCleared: number
  wavesStarted: number
  killed: number
  leaked: number
  wallsBuilt: number
  towersBuilt: number
  goldSpent: number
  goldEarned: number
  blockedBuilds: number
  abilitiesUsed: number
  defeated: boolean
}

function recomputeFields(state: DefenderState, draft: Draft): void {
  const size = state.cols * state.rows
  draft.dist = computeDistanceField(
    state.config,
    state.cols,
    state.rows,
    state.terrain,
    state.exitCells,
    blockedFlags(state.config, draft.towers, draft.towerAt, draft.wallAt, size),
  )
  draft.ghostDist = computeDistanceField(
    state.config,
    state.cols,
    state.rows,
    state.terrain,
    state.exitCells,
    ghostFlags(size),
  )
}

/** Cell addressed by an event, or -1 when the payload names no cell on this board. */
function eventCell(state: DefenderState, event: GameInputEvent): number {
  const col = event.x
  const row = event.y
  if (col === undefined || row === undefined) return -1
  if (!Number.isInteger(col) || !Number.isInteger(row)) return -1
  if (col < 0 || row < 0 || col >= state.cols || row >= state.rows) return -1
  return cellIndex(state.cols, col, row)
}

/**
 * The single funnel every path-blocking placement goes through — walls AND blocking
 * towers — so the seal rule has exactly one implementation and no second code path can
 * skip it. It probes the HYPOTHETICAL grid (`wouldSeal` sets the candidate cell blocked
 * on its own copy of the flags), so a refusal leaves no mark: no gold is debited and the
 * real grid is never touched.
 */
function canPlaceBlocker(state: DefenderState, draft: Draft, cell: number, blocks: boolean): boolean {
  if (!blocks) return true
  return !wouldSeal(state, cell, draft.towers, draft.towerAt, draft.wallAt, draft.enemies)
}

/** A cell an enemy currently occupies or is entering may not be built on: a blocker
 *  materialising under a walking enemy is the one case the seal check cannot see. */
function cellIsClearOfEnemies(draft: Draft, cell: number): boolean {
  for (const enemy of draft.enemies) {
    if (enemy.flying) continue
    if (enemy.cell === cell || enemy.nextCell === cell) return false
  }
  return true
}

function applyBuildTower(state: DefenderState, draft: Draft, event: GameInputEvent): void {
  const cell = eventCell(state, event)
  const slot = event.slot
  if (cell < 0 || slot === undefined) return
  const typeIndex = towerTypeIndexOf(state.config, slot)
  const type = towerTypeAt(state.config, typeIndex)
  if (type === undefined) return
  if (!isBuildable(state.terrain, cell) || (draft.towerAt[cell] ?? 0) !== 0 || (draft.wallAt[cell] ?? 0) > 0) {
    draft.blockedBuilds += 1
    return
  }
  if (draft.gold < type.cost) {
    draft.blockedBuilds += 1
    return
  }
  const blocks = state.config.build.towers_block_path && type.blocks_path
  if (blocks && !cellIsClearOfEnemies(draft, cell)) {
    draft.blockedBuilds += 1
    return
  }
  if (!canPlaceBlocker(state, draft, cell, blocks)) {
    draft.blockedBuilds += 1
    return
  }

  const uid = draft.nextUid
  draft.towerAt[cell] = uid
  draft.towers.push(towerFromType(type, typeIndex, uid, cell))
  draft.nextUid += 1
  draft.gold -= type.cost
  draft.goldSpent += type.cost
  draft.towersBuilt += 1
  if (blocks) recomputeFields(state, draft)
}

function applyBuildWall(state: DefenderState, draft: Draft, event: GameInputEvent): void {
  const cell = eventCell(state, event)
  if (cell < 0) return
  const { build } = state.config
  if (draft.wallsBuilt >= build.max_walls) {
    draft.blockedBuilds += 1
    return
  }
  if (!isBuildable(state.terrain, cell) || (draft.towerAt[cell] ?? 0) !== 0 || (draft.wallAt[cell] ?? 0) > 0) {
    draft.blockedBuilds += 1
    return
  }
  if (draft.gold < build.wall_cost) {
    draft.blockedBuilds += 1
    return
  }
  if (!cellIsClearOfEnemies(draft, cell)) {
    draft.blockedBuilds += 1
    return
  }
  if (!canPlaceBlocker(state, draft, cell, true)) {
    draft.blockedBuilds += 1
    return
  }

  draft.wallAt[cell] = build.wall_hp
  draft.gold -= build.wall_cost
  draft.goldSpent += build.wall_cost
  draft.wallsBuilt += 1
  recomputeFields(state, draft)
}

function applySell(state: DefenderState, draft: Draft, event: GameInputEvent): void {
  const cell = eventCell(state, event)
  if (cell < 0) return
  const refundPct = state.config.build.sell_refund_pct
  const uid = draft.towerAt[cell] ?? 0
  if (uid !== 0) {
    const index = draft.towers.findIndex((tower) => tower.uid === uid)
    const tower = draft.towers[index]
    if (index < 0 || tower === undefined) return
    draft.gold += Math.floor((tower.invested * refundPct) / 100)
    draft.towers.splice(index, 1)
    draft.towerAt[cell] = 0
    recomputeFields(state, draft)
    return
  }
  if ((draft.wallAt[cell] ?? 0) > 0) {
    draft.gold += Math.floor((state.config.build.wall_cost * refundPct) / 100)
    draft.wallAt[cell] = 0
    // A sold wall does not decrement `wallsBuilt`: the efficiency reward measures how
    // much wall a player NEEDED, and refunding the gold already pays for the mistake.
    recomputeFields(state, draft)
  }
}

function applyUpgrade(state: DefenderState, draft: Draft, event: GameInputEvent): void {
  const cell = eventCell(state, event)
  const branchId = event.slot
  if (cell < 0 || branchId === undefined) return
  const uid = draft.towerAt[cell] ?? 0
  if (uid === 0) return
  const tower = draft.towers.find((candidate) => candidate.uid === uid)
  if (tower === undefined) return
  const type = towerTypeAt(state.config, tower.typeIndex)
  const branches = type?.upgrades
  if (branches === undefined) return
  // MUTUALLY EXCLUSIVE: once a tower has bought into a branch, the others are closed.
  if (tower.branchId !== null && tower.branchId !== branchId) return
  const branch = branches.find((candidate) => candidate.id === branchId)
  if (branch === undefined) return
  const tier = branch.tiers[tower.branchTier]
  if (tier === undefined) return
  if (draft.gold < tier.cost) {
    draft.blockedBuilds += 1
    return
  }

  draft.gold -= tier.cost
  draft.goldSpent += tier.cost
  tower.invested += tier.cost
  tower.branchId = branchId
  tower.branchTier += 1
  tower.damage += tier.damage_add ?? 0
  tower.range += tier.range_add_mcells ?? 0
  tower.fireInterval = Math.max(1, tower.fireInterval + (tier.fire_interval_delta_ticks ?? 0))
  tower.slowPct = Math.min(90, tower.slowPct + (tier.slow_pct_add ?? 0))
  tower.dotDamage += tier.dot_damage_add ?? 0
  tower.splash += tier.splash_add_mcells ?? 0
  tower.income += tier.income_add ?? 0
  if (tier.detects_stealth === true) tower.detectsStealth = true
  if (tier.targets_air === true) tower.targetsAir = true
  // The tier-3 transform: the archetype the tower becomes, not merely a bigger number.
  if (tier.transforms_to !== undefined) tower.archetype = tier.transforms_to
}

function applyPriority(state: DefenderState, draft: Draft, event: GameInputEvent): void {
  const cell = eventCell(state, event)
  const slot = event.slot
  if (cell < 0 || slot === undefined) return
  if (!(DEFENDER_PRIORITIES as readonly string[]).includes(slot)) return
  const uid = draft.towerAt[cell] ?? 0
  if (uid === 0) return
  const tower = draft.towers.find((candidate) => candidate.uid === uid)
  if (tower === undefined) return
  tower.priority = slot as DefenderPriority
}

function applyAbility(state: DefenderState, draft: Draft, event: GameInputEvent): void {
  const secondary = state.config.economy.secondary
  if (secondary === undefined) return
  const slot = event.slot
  const cell = eventCell(state, event)
  if (slot === undefined || cell < 0) return
  const index = secondary.abilities.findIndex((ability) => ability.id === slot)
  const ability = secondary.abilities[index]
  if (ability === undefined) return
  if ((draft.abilityCooldown[index] ?? 0) > 0) return
  if (draft.gems < ability.cost) return

  draft.gems -= ability.cost
  draft.abilityCooldown[index] = ability.cooldown_ticks
  draft.abilitiesUsed += 1

  const centre = cellCentre(state.cols, cell)
  const radiusSq = ability.radius_mcells * ability.radius_mcells
  for (const enemy of draft.enemies) {
    const position = enemyPosition(state, enemy)
    const dx = position.x - centre.x
    const dy = position.y - centre.y
    if (dx * dx + dy * dy > radiusSq) continue
    if (ability.kind === 'freeze') {
      // Deliberately past `slow.max_slow_pct`: a one-shot resource is not a tower stat,
      // and the cap exists to stop slow TOWERS from stacking into a permanent stop.
      enemy.frozenLeft = Math.max(enemy.frozenLeft, ability.freeze_ticks ?? 0)
      continue
    }
    damageEnemy(state, enemy, ability.damage ?? 0, ability.damage_type ?? 'pure')
  }
}

function applyHeat(state: DefenderState, draft: Draft, event: GameInputEvent): void {
  const slot = event.slot
  const heats = state.config.heat
  if (slot === undefined || heats === undefined) return
  // Voluntary, and only BEFORE the first wave: a modifier chosen mid-run would let a
  // player bank an easy early game and claim the hard-mode multiplier for it.
  if (draft.wavesStarted > 0) return
  const index = heats.findIndex((heat) => heat.id === slot)
  if (index < 0) return
  draft.heatIndex = draft.heatIndex === index ? -1 : index
}

function applyStartWave(state: DefenderState, draft: Draft): void {
  if (draft.phase !== 'prep') return
  if (draft.waveIndex >= state.config.waves.length) return
  draft.prepLeft = 0
  draft.gold += state.config.economy.early_call_bonus_gold
  draft.goldEarned += state.config.economy.early_call_bonus_gold
}

// ---- Damage ---------------------------------------------------------------------------

/** Applies one hit: matrix multiplier, then the boss phase's reduction, then the shield,
 *  then hp. Every step is integer percent arithmetic. */
function damageEnemy(
  state: DefenderState,
  enemy: DefenderEnemy,
  amount: number,
  damageType: DefenderDamageType,
): void {
  if (amount <= 0) return
  const type = enemyTypeAt(state.config, enemy.typeIndex)
  if (type === undefined) return
  const armorIndex = DEFENDER_ARMORS.indexOf(type.armor)
  const multiplier = state.matrix[matrixIndex(damageType, armorIndex < 0 ? 0 : armorIndex)] ?? 100
  let dealt = Math.floor((amount * multiplier) / 100)

  const phase = (type.behavior?.boss_phases ?? [])[enemy.phaseIndex]
  if (phase !== undefined) {
    dealt = Math.floor((dealt * (100 - phase.damage_reduction_pct)) / 100)
  }
  if (dealt <= 0) return

  if (enemy.shield > 0) {
    const absorbed = Math.min(enemy.shield, dealt)
    enemy.shield -= absorbed
    dealt -= absorbed
  }
  enemy.shieldDelayLeft = type.behavior?.shield?.regen_delay_ticks ?? 0
  enemy.hp -= dealt
}

/** The slow curve: each additional slow on an already-slowed enemy is worth
 *  `diminishing_pct` of the previous one, and the total never passes `max_slow_pct`. */
function applySlow(state: DefenderState, enemy: DefenderEnemy, slowPct: number, ticks: number): void {
  if (slowPct <= 0 || ticks <= 0) return
  let effective = slowPct
  for (let i = 0; i < enemy.slowStacks; i += 1) {
    effective = Math.floor((effective * state.config.slow.diminishing_pct) / 100)
  }
  enemy.slowStacks += 1
  enemy.slowPct = Math.min(state.config.slow.max_slow_pct, enemy.slowPct + effective)
  enemy.slowLeft = Math.max(enemy.slowLeft, ticks)
}

// ---- Spawning ---------------------------------------------------------------------------

function spawnEnemy(
  state: DefenderState,
  draft: Draft,
  typeIndex: number,
  entryCell: number,
  waveIndex: number,
  isBoss: boolean,
  generation: number,
  tick: number,
): DefenderEnemy | null {
  const type = enemyTypeAt(state.config, typeIndex)
  if (type === undefined) return null
  const heat = state.config.heat?.[draft.heatIndex]
  const hpScale = state.hpScale[waveIndex] ?? 100
  const goldScale = state.goldScale[waveIndex] ?? 100

  let hp = Math.floor((type.hp * hpScale) / 100)
  hp = Math.max(1, Math.floor((hp * (heat?.hp_pct ?? 100)) / 100))
  let bounty = Math.floor((type.bounty * goldScale) / 100)
  bounty = Math.floor((bounty * (heat?.gold_pct ?? 100)) / 100)

  const flying = type.behavior?.flying === true
  const shield = type.behavior?.shield?.amount ?? 0
  const enemy: DefenderEnemy = {
    uid: draft.nextUid,
    typeIndex,
    hp,
    maxHp: hp,
    shield,
    shieldMax: shield,
    shieldDelayLeft: 0,
    cell: entryCell,
    nextCell: entryCell,
    progress: 0,
    flying,
    fx: 0,
    fy: 0,
    fdx: 0,
    fdy: 0,
    flyLeft: 0,
    slowPct: 0,
    slowLeft: 0,
    slowStacks: 0,
    frozenLeft: 0,
    dotDamage: 0,
    dotLeft: 0,
    healLeft: type.behavior?.healer?.interval_ticks ?? 0,
    sapperLeft: type.behavior?.sapper?.interval_ticks ?? 0,
    phaseIndex: -1,
    bornAt: tick,
    bounty,
    livesCost: type.lives_cost,
    generation,
    isBoss,
  }
  draft.nextUid += 1

  if (flying) {
    const from = cellCentre(state.cols, entryCell)
    // Nearest base by squared distance; ties resolve to the lowest cell index, which is
    // the same total order every other tie-break in this file uses.
    let target = from
    let bestSq = -1
    for (const exit of state.exitCells) {
      const centre = cellCentre(state.cols, exit)
      const dx = centre.x - from.x
      const dy = centre.y - from.y
      const sq = dx * dx + dy * dy
      if (bestSq < 0 || sq < bestSq) {
        bestSq = sq
        target = centre
      }
    }
    const dx = target.x - from.x
    const dy = target.y - from.y
    const length = Math.max(1, Math.sqrt(dx * dx + dy * dy))
    enemy.fx = from.x
    enemy.fy = from.y
    enemy.fdx = dx / length
    enemy.fdy = dy / length
    enemy.flyLeft = length
  }

  return enemy
}

function startWave(state: DefenderState, draft: Draft): void {
  draft.phase = 'wave'
  draft.waveTick = 0
  draft.wavesStarted += 1
  draft.spawned = (state.config.waves[draft.waveIndex]?.groups ?? []).map(() => 0)
}

function runSpawns(state: DefenderState, draft: Draft, tick: number): void {
  const wave = state.config.waves[draft.waveIndex]
  if (wave === undefined) return
  const heat = state.config.heat?.[draft.heatIndex]
  for (const [groupIndex, group] of wave.groups.entries()) {
    const doubled = heat?.double_bosses === true && group.boss === true
    const total = doubled ? group.count * 2 : group.count
    let spawned = draft.spawned[groupIndex] ?? 0
    const typeIndex = enemyTypeIndexOf(state.config, group.enemy)
    if (typeIndex < 0) continue
    const entryCell =
      state.entryCells[Math.min(group.entry, state.entryCells.length - 1)] ??
      state.entryCells[0] ??
      0
    while (
      spawned < total &&
      draft.waveTick >= group.start_tick + spawned * group.interval_ticks
    ) {
      const enemy = spawnEnemy(
        state,
        draft,
        typeIndex,
        entryCell,
        draft.waveIndex,
        group.boss === true,
        0,
        tick,
      )
      if (enemy === null) break
      draft.enemies.push(enemy)
      spawned += 1
    }
    draft.spawned[groupIndex] = spawned
  }
}

function waveFullySpawned(state: DefenderState, draft: Draft): boolean {
  const wave = state.config.waves[draft.waveIndex]
  if (wave === undefined) return true
  const heat = state.config.heat?.[draft.heatIndex]
  for (const [groupIndex, group] of wave.groups.entries()) {
    const doubled = heat?.double_bosses === true && group.boss === true
    const total = doubled ? group.count * 2 : group.count
    if ((draft.spawned[groupIndex] ?? 0) < total) return false
  }
  return true
}

// ---- Enemy status & movement ---------------------------------------------------------

function updateEnemyStatus(state: DefenderState, draft: Draft): void {
  for (const enemy of draft.enemies) {
    const type = enemyTypeAt(state.config, enemy.typeIndex)
    if (type === undefined) continue
    const behavior = type.behavior

    if (enemy.frozenLeft > 0) enemy.frozenLeft -= 1
    if (enemy.slowLeft > 0) {
      enemy.slowLeft -= 1
      if (enemy.slowLeft === 0) {
        enemy.slowPct = 0
        enemy.slowStacks = 0
      }
    }
    if (enemy.dotLeft > 0) {
      enemy.dotLeft -= 1
      // DoT is already type-resolved damage; re-applying the matrix would double-count.
      enemy.hp -= enemy.dotDamage
      enemy.shieldDelayLeft = behavior?.shield?.regen_delay_ticks ?? 0
    }
    if (enemy.shieldDelayLeft > 0) enemy.shieldDelayLeft -= 1
    else if (enemy.shield < enemy.shieldMax) {
      enemy.shield = Math.min(enemy.shieldMax, enemy.shield + (behavior?.shield?.regen_per_tick ?? 0))
    }
    const regen = behavior?.regen_per_tick ?? 0
    if (regen > 0 && enemy.hp > 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + regen)

    // The phased boss: the ACTIVE phase is the last authored entry whose threshold the
    // boss has dropped under, so a manifest lists thresholds from highest to lowest.
    const phases = behavior?.boss_phases ?? []
    if (phases.length > 0 && enemy.maxHp > 0) {
      const hpPct = Math.floor((Math.max(0, enemy.hp) * 100) / enemy.maxHp)
      let active = -1
      for (const [index, phase] of phases.entries()) {
        if (hpPct < phase.below_hp_pct) active = index
      }
      enemy.phaseIndex = active
    }
  }

  // Healers act on their OWN interval, over the array in order, after every enemy's own
  // status resolved — so a heal never races a regeneration on the same tick.
  for (const healer of draft.enemies) {
    const type = enemyTypeAt(state.config, healer.typeIndex)
    const heal = type?.behavior?.healer
    if (heal === undefined) continue
    if (healer.healLeft > 0) {
      healer.healLeft -= 1
      continue
    }
    healer.healLeft = heal.interval_ticks
    const centre = enemyPosition(state, healer)
    const radiusSq = heal.radius_mcells * heal.radius_mcells
    for (const ally of draft.enemies) {
      if (ally.uid === healer.uid) continue
      if (ally.hp <= 0 || ally.hp >= ally.maxHp) continue
      const position = enemyPosition(state, ally)
      const dx = position.x - centre.x
      const dy = position.y - centre.y
      if (dx * dx + dy * dy > radiusSq) continue
      ally.hp = Math.min(ally.maxHp, ally.hp + heal.amount)
    }
  }
}

/** Effective speed in milli-cells this tick: base, minus the slow, times the boss
 *  phase's own multiplier. Frozen is exactly zero. */
function effectiveSpeed(state: DefenderState, enemy: DefenderEnemy): number {
  if (enemy.frozenLeft > 0) return 0
  const type = enemyTypeAt(state.config, enemy.typeIndex)
  if (type === undefined) return 0
  let speed = Math.floor((type.speed_mcells * (100 - enemy.slowPct)) / 100)
  const phase = (type.behavior?.boss_phases ?? [])[enemy.phaseIndex]
  if (phase !== undefined) speed = Math.floor((speed * phase.speed_pct) / 100)
  return Math.max(0, speed)
}

/**
 * A sapper's decision, and the only reason `ghostDist` exists: if breaking the wall next
 * to it would put it on a strictly cheaper route than the one the labyrinth leaves open,
 * it stops and hits the wall instead of walking the long way round. Returns the wall cell
 * it is attacking, or -1 when it should just walk.
 */
function sapperTarget(state: DefenderState, draft: Draft, enemy: DefenderEnemy): number {
  const type = enemyTypeAt(state.config, enemy.typeIndex)
  const sapper = type?.behavior?.sapper
  if (sapper === undefined) return -1
  const current = draft.dist[enemy.cell] ?? -1
  const col = cellCol(state.cols, enemy.cell)
  const row = cellRow(state.cols, enemy.cell)
  let best = -1
  let bestValue = -1
  for (let n = 0; n < 4; n += 1) {
    const nx = col + (NEIGHBOUR_DX[n] ?? 0)
    const ny = row + (NEIGHBOUR_DY[n] ?? 0)
    if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) continue
    const neighbour = cellIndex(state.cols, nx, ny)
    if ((draft.wallAt[neighbour] ?? 0) <= 0) continue
    const ghost = draft.ghostDist[neighbour] ?? -1
    if (ghost < 0) continue
    const value = ghost + stepCost(state.config, state.terrain, neighbour)
    if (current >= 0 && value >= current) continue
    if (best === -1 || value < bestValue) {
      best = neighbour
      bestValue = value
    }
  }
  return best
}

interface MovementOutcome {
  leaked: number[]
}

function moveEnemies(state: DefenderState, draft: Draft): MovementOutcome {
  const leaked: number[] = []

  for (const enemy of draft.enemies) {
    if (enemy.hp <= 0) continue
    const speed = effectiveSpeed(state, enemy)

    if (enemy.flying) {
      // Flyers ignore the labyrinth entirely — that is the whole point of them, and the
      // reason a manifest with flyers must declare an anti-air tower (schema refine).
      enemy.fx += enemy.fdx * speed
      enemy.fy += enemy.fdy * speed
      enemy.flyLeft -= speed
      if (enemy.flyLeft <= 0) leaked.push(enemy.uid)
      continue
    }

    const type = enemyTypeAt(state.config, enemy.typeIndex)
    const sapper = type?.behavior?.sapper
    if (sapper !== undefined) {
      const wallCell = sapperTarget(state, draft, enemy)
      if (wallCell >= 0) {
        if (enemy.sapperLeft > 0) {
          enemy.sapperLeft -= 1
        } else {
          enemy.sapperLeft = sapper.interval_ticks
          const remaining = (draft.wallAt[wallCell] ?? 0) - sapper.damage
          draft.wallAt[wallCell] = Math.max(0, remaining)
          if (remaining <= 0) recomputeFields(state, draft)
        }
        // A sapper mid-demolition does not advance: the wall IS its objective.
        continue
      }
    }

    let remaining = speed
    let steps = 0
    while (remaining > 0 && steps < MAX_STEPS_PER_TICK) {
      steps += 1
      if (enemy.nextCell === enemy.cell) {
        const next = chooseNextCell(
          state.config,
          state.cols,
          state.rows,
          state.terrain,
          draft.dist,
          enemy.cell,
        )
        // Nothing reachable: stand still. `wouldSeal` makes this unreachable in practice,
        // and freezing beats teleporting through a wall on the reward path.
        if (next < 0) break
        enemy.nextCell = next
      }
      const span = CELL_MILLI * stepCost(state.config, state.terrain, enemy.nextCell)
      const need = span - enemy.progress
      if (remaining < need) {
        enemy.progress += remaining
        remaining = 0
        break
      }
      remaining -= need
      enemy.cell = enemy.nextCell
      enemy.progress = 0
      if ((state.terrain[enemy.cell] ?? TERRAIN_ROCK) === TERRAIN_EXIT) {
        leaked.push(enemy.uid)
        break
      }
      const next = chooseNextCell(
        state.config,
        state.cols,
        state.rows,
        state.terrain,
        draft.dist,
        enemy.cell,
      )
      if (next < 0) {
        enemy.nextCell = enemy.cell
        break
      }
      enemy.nextCell = next
    }
  }

  return { leaked }
}

// ---- Towers ----------------------------------------------------------------------------

/** Aura bonuses covering one tower — the report's support synergy, resolved fresh every
 *  shot so selling the aura takes its buff with it. */
function auraBonusFor(state: DefenderState, draft: Draft, tower: DefenderTower): {
  damagePct: number
  ratePct: number
} {
  let damagePct = 0
  let ratePct = 0
  const self = cellCentre(state.cols, tower.cell)
  for (const other of draft.towers) {
    if (other.uid === tower.uid) continue
    if (other.archetype !== 'aura') continue
    if (other.auraDamagePct === 0 && other.auraRatePct === 0) continue
    const centre = cellCentre(state.cols, other.cell)
    const dx = centre.x - self.x
    const dy = centre.y - self.y
    if (dx * dx + dy * dy > other.range * other.range) continue
    damagePct += other.auraDamagePct
    ratePct += other.auraRatePct
  }
  return { damagePct, ratePct }
}

function canTarget(state: DefenderState, tower: DefenderTower, enemy: DefenderEnemy): boolean {
  if (enemy.hp <= 0) return false
  if (enemy.flying ? !tower.targetsAir : !tower.targetsGround) return false
  const type = enemyTypeAt(state.config, enemy.typeIndex)
  if (type?.behavior?.stealth === true && !tower.detectsStealth) return false
  return true
}

/** Priority comparison. Every branch is a total order over integers with the enemy's
 *  uid as the final tie-break, so two engines can never disagree about who gets shot. */
function isBetterTarget(
  state: DefenderState,
  priority: DefenderPriority,
  candidate: DefenderEnemy,
  current: DefenderEnemy,
  candidateDistSq: number,
  currentDistSq: number,
): boolean {
  if (priority === 'nearest') {
    if (candidateDistSq !== currentDistSq) return candidateDistSq < currentDistSq
    return candidate.uid < current.uid
  }
  if (priority === 'strongest' || priority === 'weakest') {
    const a = candidate.hp + candidate.shield
    const b = current.hp + current.shield
    if (a !== b) return priority === 'strongest' ? a > b : a < b
    return candidate.uid < current.uid
  }
  const a = remainingDistance(state, candidate)
  const b = remainingDistance(state, current)
  if (a !== b) return priority === 'first' ? a < b : a > b
  return candidate.uid < current.uid
}

function fireTowers(state: DefenderState, draft: Draft): void {
  for (const tower of draft.towers) {
    if (tower.archetype === 'economy' || tower.archetype === 'aura') continue
    if (tower.cooldownLeft > 0) {
      // PER-TOWER timer: N towers decrement N counters, never one shared clock.
      tower.cooldownLeft -= 1
      continue
    }
    if (tower.damage <= 0 && tower.slowPct <= 0 && tower.dotDamage <= 0) continue

    const self = cellCentre(state.cols, tower.cell)
    const rangeSq = tower.range * tower.range
    let target: DefenderEnemy | null = null
    let targetDistSq = 0
    for (const enemy of draft.enemies) {
      if (!canTarget(state, tower, enemy)) continue
      const position = enemyPosition(state, enemy)
      const dx = position.x - self.x
      const dy = position.y - self.y
      const distSq = dx * dx + dy * dy
      if (distSq > rangeSq) continue
      if (target === null || isBetterTarget(state, tower.priority, enemy, target, distSq, targetDistSq)) {
        target = enemy
        targetDistSq = distSq
      }
    }
    // No target: stay ready, so the tower fires the instant one walks in.
    if (target === null) continue

    const bonus = auraBonusFor(state, draft, tower)
    const damage = Math.floor((tower.damage * (100 + bonus.damagePct)) / 100)
    const hit = (enemy: DefenderEnemy, scalePct: number): void => {
      damageEnemy(state, enemy, Math.floor((damage * scalePct) / 100), tower.damageType)
      applySlow(state, enemy, tower.slowPct, tower.slowTicks)
      if (tower.dotDamage > 0 && tower.dotTicks > 0) {
        enemy.dotDamage = Math.max(enemy.dotDamage, tower.dotDamage)
        enemy.dotLeft = Math.max(enemy.dotLeft, tower.dotTicks)
      }
    }

    hit(target, 100)
    if (tower.splash > 0 && tower.splashPct > 0) {
      const centre = enemyPosition(state, target)
      const splashSq = tower.splash * tower.splash
      for (const enemy of draft.enemies) {
        if (enemy.uid === target.uid) continue
        if (!canTarget(state, tower, enemy)) continue
        const position = enemyPosition(state, enemy)
        const dx = position.x - centre.x
        const dy = position.y - centre.y
        if (dx * dx + dy * dy > splashSq) continue
        hit(enemy, tower.splashPct)
      }
    }

    tower.cooldownLeft = Math.max(1, Math.floor((tower.fireInterval * 100) / (100 + bonus.ratePct)))
  }
}

// ---- Resolution -------------------------------------------------------------------------

/** ONE pass: the dead and the leaked leave together, split children arrive together, and
 *  nothing else on the board loses a tick to a simultaneous removal. */
function resolveRemovals(
  state: DefenderState,
  draft: Draft,
  leaked: readonly number[],
  tick: number,
): void {
  const survivors: DefenderEnemy[] = []
  const children: DefenderEnemy[] = []

  for (const enemy of draft.enemies) {
    if (leaked.includes(enemy.uid)) {
      draft.leaked += 1
      if (draft.lives !== null) draft.lives = Math.max(0, draft.lives - enemy.livesCost)
      continue
    }
    if (enemy.hp > 0) {
      survivors.push(enemy)
      continue
    }

    draft.killed += 1
    draft.gold += enemy.bounty
    draft.goldEarned += enemy.bounty
    draft.gems += state.config.economy.secondary?.per_kill ?? 0

    const type = enemyTypeAt(state.config, enemy.typeIndex)
    const split = type?.behavior?.split
    if (split === undefined || enemy.generation >= MAX_SPLIT_GENERATION) continue
    const childIndex = enemyTypeIndexOf(state.config, split.into)
    if (childIndex < 0) continue
    for (let i = 0; i < split.count; i += 1) {
      const child = spawnEnemy(
        state,
        draft,
        childIndex,
        enemy.cell,
        draft.waveIndex,
        false,
        enemy.generation + 1,
        tick,
      )
      if (child === null) break
      // Children inherit the parent's exact position, so a splitter dying mid-cell does
      // not teleport its offspring back to the cell centre.
      child.cell = enemy.cell
      child.nextCell = enemy.nextCell
      child.progress = enemy.progress
      children.push(child)
    }
  }

  draft.enemies = [...survivors, ...children]
}

function resolveWaveClear(state: DefenderState, draft: Draft): void {
  if (draft.phase !== 'wave') return
  if (!waveFullySpawned(state, draft)) return
  if (draft.enemies.length > 0) return

  const wave = state.config.waves[draft.waveIndex]
  const economy = state.config.economy
  const bonus = (wave?.bonus_gold ?? 0) + economy.wave_clear_bonus
  draft.gold += bonus
  draft.goldEarned += bonus

  // INTEREST on the gold still in hand — the mechanical reason a player who saves
  // deliberately ends ahead of one who spends everything the moment they have it.
  const interest = Math.min(economy.interest_cap, Math.floor((draft.gold * economy.interest_pct) / 100))
  draft.gold += interest
  draft.goldEarned += interest

  for (const tower of draft.towers) {
    if (tower.income <= 0) continue
    draft.gold += tower.income
    draft.goldEarned += tower.income
  }
  draft.gems += (economy.secondary?.per_wave ?? 0) + (wave?.bonus_gems ?? 0)

  draft.wavesCleared += 1
  draft.waveIndex += 1
  if (draft.waveIndex < state.config.waves.length) {
    draft.phase = 'prep'
    draft.prepLeft = state.config.prep_ticks
    draft.spawned = (state.config.waves[draft.waveIndex]?.groups ?? []).map(() => 0)
  }
}

// ---- The tick ---------------------------------------------------------------------------

function step(state: DefenderState, tick: number, events: readonly GameInputEvent[]): DefenderState {
  if (state.finished) return state

  const draft: Draft = {
    towerAt: state.towerAt.slice(),
    wallAt: state.wallAt.slice(),
    dist: state.dist,
    ghostDist: state.ghostDist,
    towers: state.towers.map((tower) => ({ ...tower })),
    enemies: state.enemies.map((enemy) => ({ ...enemy })),
    abilityCooldown: state.abilityCooldown.slice(),
    spawned: state.spawned.slice(),
    nextUid: state.nextUid,
    gold: state.gold,
    gems: state.gems,
    lives: state.lives,
    heatIndex: state.heatIndex,
    phase: state.phase,
    waveIndex: state.waveIndex,
    waveTick: state.waveTick,
    prepLeft: state.prepLeft,
    wavesCleared: state.wavesCleared,
    wavesStarted: state.wavesStarted,
    killed: state.killed,
    leaked: state.leaked,
    wallsBuilt: state.wallsBuilt,
    towersBuilt: state.towersBuilt,
    goldSpent: state.goldSpent,
    goldEarned: state.goldEarned,
    blockedBuilds: state.blockedBuilds,
    abilitiesUsed: state.abilitiesUsed,
    defeated: state.defeated,
  }

  // 1) Player intents, in log order. Each build is validated against the grid the
  //    PREVIOUS builds of this same tick produced, so two taps never both squeeze
  //    through one gap.
  for (const event of events) {
    if (event.action === 'build_tower') applyBuildTower(state, draft, event)
    else if (event.action === 'build_wall') applyBuildWall(state, draft, event)
    else if (event.action === 'sell') applySell(state, draft, event)
    else if (event.action === 'upgrade') applyUpgrade(state, draft, event)
    else if (event.action === 'priority') applyPriority(state, draft, event)
    else if (event.action === 'ability') applyAbility(state, draft, event)
    else if (event.action === 'heat') applyHeat(state, draft, event)
    else if (event.action === 'start_wave') applyStartWave(state, draft)
  }

  for (const [index, cooldown] of draft.abilityCooldown.entries()) {
    if (cooldown > 0) draft.abilityCooldown[index] = cooldown - 1
  }

  // 2) Wave clock.
  if (draft.phase === 'prep') {
    if (draft.waveIndex < state.config.waves.length) {
      if (draft.prepLeft > 0) draft.prepLeft -= 1
      if (draft.prepLeft <= 0) startWave(state, draft)
    }
  } else {
    draft.waveTick += 1
  }

  // 3) Spawns, 4) status, 5) movement, 6) tower fire — fixed order, every tick.
  if (draft.phase === 'wave') runSpawns(state, draft, tick)
  updateEnemyStatus(state, draft)
  const movement = moveEnemies(state, draft)
  fireTowers(state, draft)

  // 7) ONE removal pass. 8) wave bookkeeping.
  resolveRemovals(state, draft, movement.leaked, tick)
  resolveWaveClear(state, draft)

  const ticks = tick + 1
  const defeated = draft.lives !== null && draft.lives <= 0
  const finished =
    defeated ||
    ticks >= state.config.tick_budget ||
    draft.wavesCleared >= state.config.waves.length

  return {
    ...state,
    towerAt: draft.towerAt,
    wallAt: draft.wallAt,
    dist: draft.dist,
    ghostDist: draft.ghostDist,
    towers: draft.towers,
    enemies: draft.enemies,
    abilityCooldown: draft.abilityCooldown,
    spawned: draft.spawned,
    nextUid: draft.nextUid,
    gold: draft.gold,
    gems: draft.gems,
    lives: draft.lives,
    heatIndex: draft.heatIndex,
    phase: draft.phase,
    waveIndex: draft.waveIndex,
    waveTick: draft.waveTick,
    prepLeft: draft.prepLeft,
    wavesCleared: draft.wavesCleared,
    wavesStarted: draft.wavesStarted,
    tick: ticks,
    killed: draft.killed,
    leaked: draft.leaked,
    wallsBuilt: draft.wallsBuilt,
    towersBuilt: draft.towersBuilt,
    goldSpent: draft.goldSpent,
    goldEarned: draft.goldEarned,
    blockedBuilds: draft.blockedBuilds,
    abilitiesUsed: draft.abilitiesUsed,
    finished,
    defeated,
  }
}

// ---- Score ---------------------------------------------------------------------------------

/**
 * The blended 0..100 score, read by BOTH `snapshot` (the HUD a child watches) and
 * `result` (the number Core grants), so they can never diverge.
 *
 * Four signals, and the last two are the lesson: `economy` pays for the gold still in
 * hand at the end and `walls` pays for having needed few of them, so a player who
 * spends everything the moment they have it finishes below one who saved deliberately —
 * which is exactly what `results_md` says out loud.
 */
function scoreOf(state: DefenderState): number {
  const config = state.config
  const weights = config.score_weights
  const arrivals = state.killed + state.leaked
  const blend = weightedScore([
    { value: targetScore(state.killed, state.totalEnemies), weight: weights.defense },
    { value: accuracyScore(state.killed, arrivals), weight: weights.leak_free },
    {
      value: targetScore(state.gold, config.efficiency.gold_surplus_target),
      weight: weights.economy,
    },
    { value: efficiencyScore(state.wallsBuilt, config.efficiency.wall_budget), weight: weights.walls },
  ])
  const penalised = applyPenalty(blend, state.leaked, config.leak_penalty_pct)
  const heat = config.heat?.[state.heatIndex]
  return clampScore((penalised * (heat?.score_multiplier_pct ?? 100)) / 100)
}

function snapshot(state: DefenderState): SimSnapshot {
  return {
    finished: state.finished,
    score: scoreOf(state),
    lives: state.lives,
    round: Math.min(state.config.waves.length, state.waveIndex + 1),
  }
}

function result(state: DefenderState): SimResult {
  return {
    score: scoreOf(state),
    finished: state.finished,
    // Derived aggregates only — `game_attempts.stats` may hold exactly this and nothing
    // tick-resolution about a child's session (GAME_ENGINE.md §11).
    stats: {
      killed: state.killed,
      leaked: state.leaked,
      waves_cleared: state.wavesCleared,
      towers_built: state.towersBuilt,
      walls_built: state.wallsBuilt,
      gold_left: state.gold,
      gold_spent: state.goldSpent,
      gold_earned: state.goldEarned,
      gems_left: state.gems,
      abilities_used: state.abilitiesUsed,
      blocked_builds: state.blockedBuilds,
      defeated: state.defeated ? 1 : 0,
      ticks: state.tick,
    },
  }
}

// ---- Bots -----------------------------------------------------------------------------------

/** How many towers the competent bot is willing to own before it starts banking gold.
 *  Deliberately bounded: a bot that spends every coin the moment it has one would fail
 *  the very savings signal the mechanic scores. */
function botTowerCap(config: DefenderConfig): number {
  return Math.min(10, 2 + config.waves.length * 2)
}

/** The cells the current shortest route actually walks, from every entry. The bots score
 *  a candidate build site by how much of THIS they cover. */
function routeCells(state: DefenderState, dist: readonly number[]): number[] {
  const route: number[] = []
  for (const entry of state.entryCells) {
    let cell = entry
    let steps = 0
    while (steps < MAX_ROUTE_LENGTH) {
      steps += 1
      if (!route.includes(cell)) route.push(cell)
      if ((state.terrain[cell] ?? TERRAIN_ROCK) === TERRAIN_EXIT) break
      const next = chooseNextCell(
        state.config,
        state.cols,
        state.rows,
        state.terrain,
        dist,
        cell,
      )
      if (next < 0 || next === cell) break
      cell = next
    }
  }
  return route
}

interface BotChoice {
  type: DefenderTowerType
  cost: number
}

/**
 * What the competent bot buys next, in priority order:
 *  1. an ANSWER to a threat it has none for (air, then stealth) — a gap that no amount
 *     of extra damage fixes;
 *  2. one ECONOMY tower before the first wave, if it can still afford a weapon after —
 *     the lesson the mechanic teaches, played;
 *  3. otherwise the best damage per gold per tick.
 */
function pickTowerType(state: DefenderState): BotChoice | null {
  const config = state.config
  const flyers = config.enemies.some((enemy) => enemy.behavior?.flying === true)
  const stealth = config.enemies.some((enemy) => enemy.behavior?.stealth === true)
  const haveAir = state.towers.some((tower) => tower.targetsAir && tower.damage > 0)
  const haveStealth = state.towers.some((tower) => tower.detectsStealth && tower.damage > 0)
  const haveGround = state.towers.some((tower) => tower.targetsGround && tower.damage > 0)

  const cheapest = (predicate: (type: DefenderTowerType) => boolean): BotChoice | null => {
    let best: DefenderTowerType | null = null
    for (const type of config.towers) {
      if (!predicate(type)) continue
      if (best === null || type.cost < best.cost) best = type
    }
    return best === null ? null : { type: best, cost: best.cost }
  }

  if (!haveGround) {
    const pick = cheapest((type) => type.targets_ground && type.damage > 0)
    if (pick !== null) return pick
  }
  if (flyers && !haveAir) {
    const pick = cheapest((type) => type.targets_air && type.damage > 0)
    if (pick !== null) return pick
  }
  if (stealth && !haveStealth) {
    const pick = cheapest((type) => type.detects_stealth === true && type.damage > 0)
    if (pick !== null) return pick
  }
  if (state.wavesStarted <= 1 && !state.towers.some((tower) => tower.income > 0)) {
    const pick = cheapest((type) => (type.income_per_wave ?? 0) > 0)
    if (pick !== null) return pick
  }

  let best: DefenderTowerType | null = null
  let bestValue = -1
  for (const type of config.towers) {
    if (type.damage <= 0 || !type.targets_ground) continue
    const value = (type.damage * 1000) / (type.fire_interval_ticks * type.cost)
    if (best === null || value > bestValue) {
      best = type
      bestValue = value
    }
  }
  return best === null ? null : { type: best, cost: best.cost }
}

/**
 * The build site: the free, buildable cell covering the most route, ties resolved to the
 * lowest cell index, and the first such cell that does not seal the path.
 *
 * EVERY free cell is a candidate, including the ones covering nothing — an economy tower
 * has range 0 and covers no route at all, and a "best coverage" filter that dropped it
 * would leave the bot with an unaffordable pick it could never place and no fallback,
 * i.e. a run in which it never builds anything again.
 */
function pickBuildCell(state: DefenderState, range: number, blocks: boolean): number {
  const route = routeCells(state, state.dist)
  const rangeSq = range * range
  const candidates: { cell: number; cover: number }[] = []
  const size = state.cols * state.rows
  for (let cell = 0; cell < size; cell += 1) {
    if (!isBuildable(state.terrain, cell)) continue
    if ((state.towerAt[cell] ?? 0) !== 0 || (state.wallAt[cell] ?? 0) > 0) continue
    const centre = cellCentre(state.cols, cell)
    let cover = 0
    for (const routeCell of route) {
      const target = cellCentre(state.cols, routeCell)
      const dx = target.x - centre.x
      const dy = target.y - centre.y
      if (dx * dx + dy * dy <= rangeSq) cover += 1
    }
    candidates.push({ cell, cover })
  }
  candidates.sort((a, b) => (a.cover === b.cover ? a.cell - b.cell : b.cover - a.cover))

  let attempts = 0
  for (const candidate of candidates) {
    if (attempts >= 8) break
    if (!blocks) return candidate.cell
    attempts += 1
    if (!wouldSeal(state, candidate.cell, state.towers, state.towerAt, state.wallAt, state.enemies)) {
      return candidate.cell
    }
  }
  return -1
}

/**
 * The §9 winnability gate's competent player. It answers every threat class the manifest
 * declares, buys the economy tower the lesson is about, places for coverage, upgrades the
 * tower it already owns when a branch is cheaper than a new tower, and then BANKS the
 * rest — which is what the score's economy signal is measuring.
 *
 * One action per tick keeps the log small and its intent readable in a bot trace.
 */
function perfectBot(state: DefenderState, tick: number): GameInputEvent[] {
  if (state.finished) return []

  const cap = botTowerCap(state.config)
  if (state.towers.length < cap) {
    const choice = pickTowerType(state)
    if (choice !== null && state.gold >= choice.cost) {
      const blocks = state.config.build.towers_block_path && choice.type.blocks_path
      const cell = pickBuildCell(state, choice.type.range_mcells, blocks)
      if (cell >= 0) {
        return [
          {
            tick,
            action: 'build_tower',
            slot: choice.type.id,
            x: cellCol(state.cols, cell),
            y: cellRow(state.cols, cell),
          },
        ]
      }
    }
    return []
  }

  // The board is built. Upgrade the earliest tower with an affordable next rung, keeping
  // a reserve so the savings signal still has something to pay for.
  const reserve = state.config.efficiency.gold_surplus_target
  for (const tower of state.towers) {
    const type = towerTypeAt(state.config, tower.typeIndex)
    const branches = type?.upgrades
    if (branches === undefined) continue
    const branch =
      tower.branchId === null
        ? branches[0]
        : branches.find((candidate) => candidate.id === tower.branchId)
    if (branch === undefined) continue
    const tier = branch.tiers[tower.branchTier]
    if (tier === undefined) continue
    if (state.gold - tier.cost < reserve) continue
    return [
      {
        tick,
        action: 'upgrade',
        slot: branch.id,
        x: cellCol(state.cols, tower.cell),
        y: cellRow(state.cols, tower.cell),
      },
    ]
  }
  return []
}

/**
 * Arbitrary play: most ticks it does nothing, otherwise it taps a random cell with a
 * random purchase. It must NOT reach `pass_score` — if it does, the manifest is not
 * measuring anything and the pipeline rejects it.
 */
function randomBot(state: DefenderState, tick: number, rng: Rng): GameInputEvent[] {
  if (state.finished) return []
  if (rng.next() < 0.7) return []

  const size = state.cols * state.rows
  const cell = rng.int(size)
  const x = cellCol(state.cols, cell)
  const y = cellRow(state.cols, cell)
  const roll = rng.int(4)

  if (roll === 0) return [{ tick, action: 'build_wall', x, y }]
  if (roll === 1) return [{ tick, action: 'sell', x, y }]
  const type = state.config.towers[rng.int(state.config.towers.length)]
  if (type === undefined) return []
  return [{ tick, action: 'build_tower', slot: type.id, x, y }]
}

export const defenderSimulator: Simulator<DefenderState> = {
  mechanic: 'defender',
  actions: DEFENDER_ACTIONS,
  init,
  step,
  snapshot,
  result,
  bots: {
    perfect: (state, tick) => perfectBot(state, tick),
    random: (state, tick, rng) => randomBot(state, tick, rng),
  },
}
