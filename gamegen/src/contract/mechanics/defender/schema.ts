// `defender` — the config + content contract (GAME_ENGINE.md §4 row `defender`, §7).
//
// THE POINT OF THIS FILE: v1's tower game (`hacker-defense`) hardcoded its grid, its
// wave table, its tower stats, its gold economy and its win condition inside the game
// component — a second instance would have been a second copy of the code, and nobody
// could re-skin or re-tune it without editing TypeScript. Here EVERY tunable number
// lives in `config`: the grid and its terrain, the enemy roster with its behaviours,
// the eight tower archetypes with their upgrade branches, the damage-type × armour
// matrix, the slow curve, the whole economy (gold, interest, secondary currency,
// abilities), the wave table with its exponential growth factors, the voluntary heat
// modifiers, the efficiency targets and the score weights. `simulate.ts` and
// `components.tsx` read all of them and hardcode none of them.
//
// Zod only, no React: `backend/src/game-contract/` and `gamegen/src/contract/` carry
// this module verbatim next to `simulate.ts` into their synchronous registry.

import { z } from 'zod'

import {
  gameCategorySchema,
  gameFeedbackSchema,
  gameInterludeSchema,
  gameItemSchema,
  idString,
} from '../../core/schemaBase.js'

// ---- Sprite slots ---------------------------------------------------------------

/**
 * The sprite slot ids a defender document may bind (`skin.sprites` keys, and the
 * `image_slot` an item may point at). CLOSED, and generic rather than per-document:
 * slot ids are the interface between a generated manifest and Prism's illustrate
 * stage, so an undeclared key is a schema error rather than a rectangle that silently
 * never renders.
 *
 * One slot per tower ARCHETYPE (not per tower type): the archetype is what a child
 * reads at a glance on a 375px grid, and it keeps the illustrate stage's slot count
 * bounded no matter how many tower variants a manifest declares. Ten enemy slots cover
 * the roster ceiling below; an enemy with no slot falls back to its Material Symbols
 * `icon`, which is always legible.
 */
export const DEFENDER_SPRITE_SLOTS = [
  'terrain_open',
  'terrain_rock',
  'terrain_road',
  'entry',
  'exit',
  'base',
  'wall',
  'tower_single',
  'tower_area',
  'tower_slow',
  'tower_dot',
  'tower_antiair',
  'tower_aura',
  'tower_economy',
  'tower_block',
  'enemy_1',
  'enemy_2',
  'enemy_3',
  'enemy_4',
  'enemy_5',
  'enemy_6',
  'enemy_7',
  'enemy_8',
  'enemy_9',
  'enemy_10',
  'ability_1',
  'ability_2',
  'ability_3',
  'coin',
  'gem',
] as const satisfies readonly string[]

export type DefenderSpriteSlot = (typeof DEFENDER_SPRITE_SLOTS)[number]

// ---- Closed sets ----------------------------------------------------------------

/**
 * The map alphabet. One character per cell, one string per row — compact enough that a
 * generated manifest stays readable, and total enough that terrain cannot be
 * half-specified.
 *
 *  `.` open  — walkable AND buildable. The labyrinth material.
 *  `#` rock  — neither walkable nor buildable. The report's "unbuildable terrain that
 *              forces the labyrinth to adapt", in its hardest form.
 *  `=` road  — walkable but NOT buildable. A fixed route a manifest can carve so a
 *              tier-1 document has a readable lane instead of an open field.
 *  `S` entry — where waves appear. Walkable, never buildable.
 *  `X` exit  — the base. Walkable, never buildable.
 */
export const DEFENDER_TERRAIN_CHARS = ['.', '#', '=', 'S', 'X'] as const

/** Armour classes. `ethereal` and `shielded` exist so the damage matrix has something
 *  to be interesting about: a resistance table with one armour class is a constant. */
export const DEFENDER_ARMORS = ['unarmored', 'light', 'heavy', 'shielded', 'ethereal'] as const
export type DefenderArmor = (typeof DEFENDER_ARMORS)[number]

/** Damage classes. `pure` is the escape hatch a manifest can price expensively: it
 *  reads the default multiplier against every armour, so it is never resisted. */
export const DEFENDER_DAMAGE_TYPES = ['impact', 'spark', 'frost', 'pure'] as const
export type DefenderDamageType = (typeof DEFENDER_DAMAGE_TYPES)[number]

/** The report's 8 archetypes, in its order. A `block` tower with `damage: 0` is a pure
 *  wall-with-a-hitbox; with damage it is the trap variant. */
export const DEFENDER_ARCHETYPES = [
  'single',
  'area',
  'slow',
  'dot',
  'antiair',
  'aura',
  'economy',
  'block',
] as const
export type DefenderArchetype = (typeof DEFENDER_ARCHETYPES)[number]

/** The switchable target priority. Changed in play by the `priority` action, so it is
 *  a decision a child makes, not a constant the author picked for them. */
export const DEFENDER_PRIORITIES = ['first', 'last', 'strongest', 'weakest', 'nearest'] as const
export type DefenderPriority = (typeof DEFENDER_PRIORITIES)[number]

/** Global abilities bought with the SECONDARY currency. Two kinds, because they are the
 *  two shapes a global intervention can take: burst damage, and time. */
export const DEFENDER_ABILITY_KINDS = ['bombard', 'freeze'] as const
export type DefenderAbilityKind = (typeof DEFENDER_ABILITY_KINDS)[number]

/** The damage-type × armour multipliers the report specifies, as INTEGER percents so
 *  the whole damage pipeline stays exact integer arithmetic (§5): 0.5 / 1 / 2. */
export const DEFENDER_MULTIPLIERS = [50, 100, 200] as const

// ---- Grid ------------------------------------------------------------------------

const gridSchema = z.object({
  /** Design px per cell — the stage scales from here, so this is layout, not difficulty. */
  cell_size: z.number().int().min(24).max(96),
  /** One string per row, `DEFENDER_TERRAIN_CHARS` only. Rows must all be the same
   *  length; the refine below enforces the rectangle so the simulator can index a flat
   *  array with `row * cols + col` and never bounds-check a ragged map. */
  map: z
    .array(
      z
        .string()
        .min(5)
        .max(24)
        .regex(/^[.#=SX]+$/),
    )
    .min(5)
    .max(18),
})
export type DefenderGrid = z.infer<typeof gridSchema>

/**
 * Cost of ENTERING a cell — both the pathfinder's edge weight and the travel time.
 * Integers, so the Dijkstra field runs on exactly-representable costs (§5 rule 3) and so
 * "the open field is slower than the road" is one number rather than two systems that
 * can disagree.
 */
const stepCostSchema = z.object({
  open: z.number().int().min(1).max(9),
  road: z.number().int().min(1).max(9),
})

// ---- Enemies ---------------------------------------------------------------------

/**
 * The behaviour block. Every special the report lists is an OPTIONAL sub-object, so an
 * enemy that is merely fast and light carries none of them and a manifest never has to
 * spell out the absence of seven behaviours.
 */
const enemyBehaviorSchema = z.object({
  /** Ignores the labyrinth entirely: flies the straight line from its entry to the
   *  nearest exit. The reason a manifest needs aerial coverage. */
  flying: z.boolean().optional(),
  /** Only targetable by a tower with `detects_stealth`. */
  stealth: z.boolean().optional(),
  /** Attacks the wall that stands between it and a shorter route, reopening the direct
   *  path — the answer to a player who thinks one labyrinth is forever. */
  sapper: z
    .object({
      damage: z.number().int().min(1).max(10000),
      interval_ticks: z.number().int().min(1).max(200),
    })
    .optional(),
  /** A regenerating shield: absorbs damage before hp, and refills after a quiet spell. */
  shield: z
    .object({
      amount: z.number().int().min(1).max(100000),
      regen_per_tick: z.number().int().min(0).max(1000),
      regen_delay_ticks: z.number().int().min(0).max(400),
    })
    .optional(),
  /** Flat hp regeneration per tick (the report's "regenerating" enemy). */
  regen_per_tick: z.number().int().min(0).max(1000).optional(),
  /** Heals nearby allies on its OWN timer. */
  healer: z
    .object({
      amount: z.number().int().min(1).max(10000),
      radius_mcells: z.number().int().min(100).max(8000),
      interval_ticks: z.number().int().min(1).max(400),
    })
    .optional(),
  /** On death, spawns `count` copies of another declared enemy type at the same spot. */
  split: z
    .object({
      into: idString,
      count: z.number().int().min(1).max(4),
    })
    .optional(),
  /** The phased boss. The ACTIVE phase is the last entry whose `below_hp_pct` the boss
   *  has dropped under, so entries are authored from the highest threshold down. */
  boss_phases: z
    .array(
      z.object({
        below_hp_pct: z.number().int().min(1).max(99),
        speed_pct: z.number().int().min(10).max(400),
        damage_reduction_pct: z.number().int().min(0).max(90),
      }),
    )
    .max(3)
    .optional(),
})
export type DefenderEnemyBehavior = z.infer<typeof enemyBehaviorSchema>

const enemyTypeSchema = z.object({
  id: idString,
  /** The catalog item that supplies this enemy's label, icon and sprite slot. Keeping
   *  the STRINGS in `content` and the NUMBERS here is what lets Arcade's localize stage
   *  translate an enemy's name without ever touching its stats. */
  item_id: idString,
  hp: z.number().int().min(1).max(1000000),
  armor: z.enum(DEFENDER_ARMORS),
  /** Milli-cells per 50ms tick. Integer, so movement integration never rounds. */
  speed_mcells: z.number().int().min(5).max(600),
  /** Gold paid to the player for the kill (before the wave's gold growth factor). */
  bounty: z.number().int().min(0).max(999),
  /** Lives this enemy costs when it reaches the base — the report's per-type cost. */
  lives_cost: z.number().int().min(0).max(9),
  behavior: enemyBehaviorSchema.optional(),
  /** Sprite slot for the canvas; falls back to the item's `icon`. */
  sprite_slot: idString.optional(),
})
export type DefenderEnemyType = z.infer<typeof enemyTypeSchema>

// ---- Towers ----------------------------------------------------------------------

/** One rung of ONE upgrade branch. Deltas rather than absolutes, so a branch reads as
 *  "what this choice adds" and two branches cannot silently disagree about a base. */
const upgradeTierSchema = z.object({
  cost: z.number().int().min(1).max(9999),
  damage_add: z.number().int().min(0).max(100000).optional(),
  range_add_mcells: z.number().int().min(0).max(8000).optional(),
  /** Negative = faster. Applied to the tower's own fire interval, floored at 1 tick. */
  fire_interval_delta_ticks: z.number().int().min(-200).max(200).optional(),
  slow_pct_add: z.number().int().min(0).max(90).optional(),
  dot_damage_add: z.number().int().min(0).max(10000).optional(),
  splash_add_mcells: z.number().int().min(0).max(8000).optional(),
  income_add: z.number().int().min(0).max(999).optional(),
  detects_stealth: z.boolean().optional(),
  targets_air: z.boolean().optional(),
  /** ONLY the last rung of a branch may carry this: tier 3 TRANSFORMS the archetype,
   *  which is what makes two branches a real fork rather than two number ramps. */
  transforms_to: z.enum(DEFENDER_ARCHETYPES).optional(),
  /** Catalog item supplying this rung's label/icon in the upgrade panel. */
  item_id: idString.optional(),
})
export type DefenderUpgradeTier = z.infer<typeof upgradeTierSchema>

const upgradeBranchSchema = z.object({
  id: idString,
  item_id: idString.optional(),
  tiers: z.array(upgradeTierSchema).min(1).max(3),
})
export type DefenderUpgradeBranch = z.infer<typeof upgradeBranchSchema>

const towerTypeSchema = z.object({
  id: idString,
  item_id: idString,
  archetype: z.enum(DEFENDER_ARCHETYPES),
  cost: z.number().int().min(1).max(9999),
  /** Milli-cells. Compared against squared distances, so no square root is ever taken
   *  on the reward path. */
  range_mcells: z.number().int().min(0).max(12000),
  fire_interval_ticks: z.number().int().min(1).max(400),
  damage: z.number().int().min(0).max(100000),
  damage_type: z.enum(DEFENDER_DAMAGE_TYPES),
  /** Area damage: every other enemy within this radius of the target takes
   *  `splash_damage_pct` of the hit. */
  splash_mcells: z.number().int().min(0).max(8000).optional(),
  splash_damage_pct: z.number().int().min(0).max(100).optional(),
  /** Slow applied on hit, and for how long. Subject to the diminishing-returns curve
   *  and the global cap in `config.slow`. */
  slow_pct: z.number().int().min(0).max(90).optional(),
  slow_ticks: z.number().int().min(0).max(400).optional(),
  /** Damage over time, per tick, for `dot_ticks`. Refreshed, never stacked. */
  dot_damage: z.number().int().min(0).max(10000).optional(),
  dot_ticks: z.number().int().min(0).max(400).optional(),
  targets_air: z.boolean(),
  targets_ground: z.boolean(),
  detects_stealth: z.boolean().optional(),
  /** Support aura: buffs every OTHER tower inside `range_mcells` of this one. The
   *  synergy dial (slow + area, aura + single-target). */
  aura: z
    .object({
      damage_bonus_pct: z.number().int().min(0).max(200),
      rate_bonus_pct: z.number().int().min(0).max(200),
    })
    .optional(),
  /** Economy archetype: gold generated at every wave clear. */
  income_per_wave: z.number().int().min(0).max(999).optional(),
  /** Whether this tower's cell blocks the ground path. `false` makes it a turret that
   *  sits beside the route; `true` makes it labyrinth material like a wall. */
  blocks_path: z.boolean(),
  default_priority: z.enum(DEFENDER_PRIORITIES),
  /** 2–3 MUTUALLY EXCLUSIVE branches (the simulator commits a tower to the first branch
   *  it buys into and refuses the others), up to tier 3. */
  upgrades: z.array(upgradeBranchSchema).min(2).max(3).optional(),
  sprite_slot: idString.optional(),
})
export type DefenderTowerType = z.infer<typeof towerTypeSchema>

// ---- Waves -----------------------------------------------------------------------

const waveGroupSchema = z.object({
  /** A declared `config.enemies[].id`. */
  enemy: idString,
  count: z.number().int().min(1).max(40),
  /** Ticks between two spawns of this group. */
  interval_ticks: z.number().int().min(1).max(400),
  /** Offset from the wave's own start, so groups can be layered. */
  start_tick: z.number().int().min(0).max(4000),
  /** Index into the map's entry cells (row-major order). Clamped by the simulator. */
  entry: z.number().int().min(0).max(7),
  /** Marks the group the `double_bosses` heat modifier duplicates. */
  boss: z.boolean().optional(),
})
export type DefenderWaveGroup = z.infer<typeof waveGroupSchema>

const waveSchema = z.object({
  id: idString,
  groups: z.array(waveGroupSchema).min(1).max(6),
  /** Paid on clear, on top of `economy.wave_clear_bonus`. */
  bonus_gold: z.number().int().min(0).max(9999),
  bonus_gems: z.number().int().min(0).max(99).optional(),
})
export type DefenderWave = z.infer<typeof waveSchema>

// ---- Economy ---------------------------------------------------------------------

const abilitySchema = z.object({
  id: idString,
  item_id: idString.optional(),
  kind: z.enum(DEFENDER_ABILITY_KINDS),
  /** Paid in the SECONDARY currency, never in gold — that separation is what stops a
   *  global ability from competing with the tower economy the lesson is about. */
  cost: z.number().int().min(1).max(999),
  radius_mcells: z.number().int().min(100).max(12000),
  damage: z.number().int().min(0).max(100000).optional(),
  damage_type: z.enum(DEFENDER_DAMAGE_TYPES).optional(),
  /** `freeze` only: ticks of total immobilisation. Deliberately allowed past the
   *  `config.slow.max_slow_pct` cap — it is a one-shot resource, not a tower stat. */
  freeze_ticks: z.number().int().min(1).max(200).optional(),
  cooldown_ticks: z.number().int().min(0).max(4000),
  sprite_slot: idString.optional(),
})
export type DefenderAbility = z.infer<typeof abilitySchema>

const economySchema = z.object({
  starting_gold: z.number().int().min(0).max(99999),
  /** Flat gold for clearing any wave. */
  wave_clear_bonus: z.number().int().min(0).max(9999),
  /** Interest on the gold STILL IN HAND at a wave clear — the mechanical reason saving
   *  beats spending everything immediately (the learning binding, GAME_ENGINE.md §4). */
  interest_pct: z.number().int().min(0).max(25),
  interest_cap: z.number().int().min(0).max(9999),
  /** Gold for calling the next wave early, with the prep timer still running. */
  early_call_bonus_gold: z.number().int().min(0).max(999),
  /** Compounding per-wave multipliers, in percent. HP normally grows FASTER than gold:
   *  that differential is what forces the player to spend better rather than more. */
  hp_growth_pct_per_wave: z.number().int().min(100).max(200),
  gold_growth_pct_per_wave: z.number().int().min(100).max(200),
  /** The secondary currency and what it buys. Omit it and abilities do not exist. */
  secondary: z
    .object({
      starting: z.number().int().min(0).max(999),
      per_wave: z.number().int().min(0).max(99),
      per_kill: z.number().int().min(0).max(9),
      abilities: z.array(abilitySchema).min(1).max(3),
    })
    .optional(),
})

// ---- Difficulty modifiers, scoring -------------------------------------------------

/** A voluntary "heat" modifier: harder terms in exchange for a score multiplier. Chosen
 *  with the `heat` action BEFORE the first wave, never imposed. */
const heatSchema = z.object({
  id: idString,
  item_id: idString.optional(),
  hp_pct: z.number().int().min(100).max(400),
  gold_pct: z.number().int().min(25).max(100),
  double_bosses: z.boolean(),
  score_multiplier_pct: z.number().int().min(100).max(200),
})
export type DefenderHeat = z.infer<typeof heatSchema>

const scoreWeightsSchema = z.object({
  /** Enemies stopped out of everything the manifest sends. */
  defense: z.number().min(0).max(10),
  /** Share of arrivals that never reached the base. */
  leak_free: z.number().min(0).max(10),
  /** Gold still in hand at the end, against `efficiency.gold_surplus_target`. */
  economy: z.number().min(0).max(10),
  /** Walls spent, against `efficiency.wall_budget` — fewer is better. */
  walls: z.number().min(0).max(10),
})

export const defenderConfigSchema = z
  .object({
    grid: gridSchema,
    step_costs: stepCostSchema,
    build: z.object({
      wall_cost: z.number().int().min(0).max(9999),
      wall_hp: z.number().int().min(1).max(100000),
      max_walls: z.number().int().min(0).max(60),
      /** Percentage of what was invested that a sell returns. */
      sell_refund_pct: z.number().int().min(0).max(100),
      /** Whether a TOWER also blocks the ground path (maze-building with turrets) or
       *  only walls do. Per-tower `blocks_path` still applies on top. */
      towers_block_path: z.boolean(),
    }),
    economy: economySchema,
    /** The report's damage-type × armour matrix. Any pair the manifest omits reads
     *  `default_multiplier_pct`, so a sparse matrix is legal and means "neutral". */
    damage_matrix: z
      .array(
        z.object({
          damage: z.enum(DEFENDER_DAMAGE_TYPES),
          armor: z.enum(DEFENDER_ARMORS),
          multiplier_pct: z.literal(DEFENDER_MULTIPLIERS),
        }),
      )
      .max(20),
    default_multiplier_pct: z.literal(DEFENDER_MULTIPLIERS),
    /** Diminishing returns and the hard ceiling on stacked slows. `diminishing_pct` is
     *  what each ADDITIONAL slow on an already-slowed enemy is worth. */
    slow: z.object({
      diminishing_pct: z.number().int().min(0).max(100),
      max_slow_pct: z.number().int().min(0).max(90),
    }),
    enemies: z.array(enemyTypeSchema).min(1).max(12),
    towers: z.array(towerTypeSchema).min(1).max(8),
    waves: z.array(waveSchema).min(1).max(12),
    /** Ticks of build time before a wave starts (and before the FIRST wave). */
    prep_ticks: z.number().int().min(0).max(1200),
    heat: z.array(heatSchema).max(4).optional(),
    efficiency: z.object({
      /** Walls the author considers a generous solution. Using fewer scores higher. */
      wall_budget: z.number().int().min(1).max(60),
      /** Gold in hand at the end that counts as a full savings score. */
      gold_surplus_target: z.number().int().min(1).max(99999),
    }),
    score_weights: scoreWeightsSchema,
    /** Points of the 0..100 scale each leaked enemy costs, flat and kid-legible. */
    leak_penalty_pct: z.number().min(0).max(50),
    /** Hard end of the run, in 50ms ticks. */
    tick_budget: z.number().int().min(60).max(12000),
  })
  .superRefine((config, ctx) => {
    // ---- the map is a rectangle with at least one entry and one exit ----
    const first = config.grid.map[0]
    const cols = first === undefined ? 0 : first.length
    let entries = 0
    let exits = 0
    for (const [rowIndex, row] of config.grid.map.entries()) {
      if (row.length !== cols) {
        ctx.addIssue({
          code: 'custom',
          path: ['grid', 'map', rowIndex],
          message: 'every map row must have the same length',
        })
      }
      for (const char of row) {
        if (char === 'S') entries += 1
        if (char === 'X') exits += 1
      }
    }
    if (entries < 1) {
      ctx.addIssue({ code: 'custom', path: ['grid', 'map'], message: 'the map needs an entry (S)' })
    }
    if (entries > 8) {
      ctx.addIssue({ code: 'custom', path: ['grid', 'map'], message: 'at most 8 entries' })
    }
    if (exits < 1) {
      ctx.addIssue({ code: 'custom', path: ['grid', 'map'], message: 'the map needs an exit (X)' })
    }

    // ---- unique ids everywhere the input log or another field references one ----
    const unique = (values: readonly string[]): boolean => new Set(values).size === values.length
    const enemyIds = config.enemies.map((enemy) => enemy.id)
    if (!unique(enemyIds)) {
      ctx.addIssue({ code: 'custom', path: ['enemies'], message: 'enemy ids must be unique' })
    }
    const towerIds = config.towers.map((tower) => tower.id)
    if (!unique(towerIds)) {
      ctx.addIssue({ code: 'custom', path: ['towers'], message: 'tower ids must be unique' })
    }
    if (!unique(config.waves.map((wave) => wave.id))) {
      ctx.addIssue({ code: 'custom', path: ['waves'], message: 'wave ids must be unique' })
    }

    // ---- every reference resolves ----
    for (const [waveIndex, wave] of config.waves.entries()) {
      for (const [groupIndex, group] of wave.groups.entries()) {
        if (!enemyIds.includes(group.enemy)) {
          ctx.addIssue({
            code: 'custom',
            path: ['waves', waveIndex, 'groups', groupIndex, 'enemy'],
            message: 'unknown enemy id',
          })
        }
        if (group.entry >= entries) {
          ctx.addIssue({
            code: 'custom',
            path: ['waves', waveIndex, 'groups', groupIndex, 'entry'],
            message: 'entry index beyond the entries the map declares',
          })
        }
      }
    }
    for (const [index, enemy] of config.enemies.entries()) {
      const split = enemy.behavior?.split
      if (split !== undefined && !enemyIds.includes(split.into)) {
        ctx.addIssue({
          code: 'custom',
          path: ['enemies', index, 'behavior', 'split', 'into'],
          message: 'unknown enemy id',
        })
      }
      if (split !== undefined && split.into === enemy.id) {
        ctx.addIssue({
          code: 'custom',
          path: ['enemies', index, 'behavior', 'split', 'into'],
          message: 'an enemy cannot split into itself: the run would never end',
        })
      }
    }

    // ---- fairness: a manifest may not send a threat nothing on the board can answer ----
    const flying = config.enemies.some((enemy) => enemy.behavior?.flying === true)
    if (flying && !config.towers.some((tower) => tower.targets_air)) {
      ctx.addIssue({
        code: 'custom',
        path: ['towers'],
        message: 'flying enemies need at least one tower that targets air',
      })
    }
    const stealth = config.enemies.some((enemy) => enemy.behavior?.stealth === true)
    if (stealth && !config.towers.some((tower) => tower.detects_stealth === true)) {
      ctx.addIssue({
        code: 'custom',
        path: ['towers'],
        message: 'stealthed enemies need at least one tower that detects stealth',
      })
    }
    const ground = config.enemies.some((enemy) => enemy.behavior?.flying !== true)
    if (ground && !config.towers.some((tower) => tower.targets_ground)) {
      ctx.addIssue({
        code: 'custom',
        path: ['towers'],
        message: 'ground enemies need at least one tower that targets ground',
      })
    }

    // ---- upgrade branches: mutually exclusive forks, transform only at the top ----
    for (const [towerIndex, tower] of config.towers.entries()) {
      const branches = tower.upgrades
      if (branches === undefined) continue
      if (!unique(branches.map((branch) => branch.id))) {
        ctx.addIssue({
          code: 'custom',
          path: ['towers', towerIndex, 'upgrades'],
          message: 'branch ids must be unique within a tower',
        })
      }
      for (const [branchIndex, branch] of branches.entries()) {
        for (const [tierIndex, tier] of branch.tiers.entries()) {
          if (tier.transforms_to !== undefined && tierIndex !== branch.tiers.length - 1) {
            ctx.addIssue({
              code: 'custom',
              path: ['towers', towerIndex, 'upgrades', branchIndex, 'tiers', tierIndex],
              message: 'only a branch’s final tier may transform the archetype',
            })
          }
        }
      }
    }

    // ---- the matrix declares each pair at most once ----
    const seen: string[] = []
    for (const [index, row] of config.damage_matrix.entries()) {
      const key = `${row.damage}/${row.armor}`
      if (seen.includes(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['damage_matrix', index],
          message: 'duplicate damage/armor pair',
        })
      }
      seen.push(key)
    }

    const weights = config.score_weights
    if (weights.defense + weights.leak_free + weights.economy + weights.walls <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['score_weights'],
        message: 'at least one scoring signal must carry weight',
      })
    }
  })

export type DefenderConfig = z.infer<typeof defenderConfigSchema>

// ---- Content ----------------------------------------------------------------------

/**
 * Defender content is the CATALOG the config points at: every enemy, tower, upgrade,
 * ability and heat modifier names an `item_id`, and the item supplies the label, the
 * icon, the sprite slot and — for a bad deal — the misconception that explains WHY it
 * is a bad deal.
 *
 * The misconception gate (GAME_ENGINE.md §9 `gate`) is expressed on `props.trap`: an
 * item a manifest marks as a trap purchase (`props: { trap: 1 }`) MUST carry
 * `misconception_md`. A defender trap is not a wrong bin, it is an expensive tower that
 * looks impressive and is a poor use of gold — and a child who buys it deserves to be
 * told why, not merely to lose the wave.
 */
export const defenderContentSchema = z
  .object({
    items: z.array(gameItemSchema).min(2).max(80),
    categories: z.array(gameCategorySchema).max(8).optional(),
    interludes: z.array(gameInterludeSchema).max(4).optional(),
    feedback: gameFeedbackSchema,
  })
  .superRefine((content, ctx) => {
    const ids = content.items.map((item) => item.id)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'item ids must be unique' })
    }
    for (const [index, item] of content.items.entries()) {
      if (item.props?.trap === 1 && item.misconception_md === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'misconception_md'],
          message: 'a trap purchase must explain why it is a bad deal',
        })
      }
    }
  })

export type DefenderContent = z.infer<typeof defenderContentSchema>
