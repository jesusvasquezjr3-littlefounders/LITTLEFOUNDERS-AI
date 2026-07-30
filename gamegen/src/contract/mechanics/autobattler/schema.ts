// `autobattler` — the config + content contract (GAME_ENGINE.md §4 row `autobattler`, §7).
//
// THE POINT OF THIS FILE: the owner's report specifies a shop, a draft, star merging,
// a synergy matrix, an adjacency rule, an inter-round economy with interest, a player
// health table, AI opponent personalities with a calibrated error rate, and PvE camps
// that drop combinable items. v1 would have hardcoded every one of those numbers inside
// one game component. Here they are ALL manifest fields: `simulate.ts` and
// `components.tsx` read every threshold, cost, multiplier and weight from `config`, and
// every label from `content`. A second auto-battler is a second JSON file.
//
// Zod only, no React: `backend/src/game-contract/` and `gamegen/src/contract/` carry
// this module verbatim next to `simulate.ts` into their synchronous registry.
//
// DEFERRED, NOT DROPPED (GAME_ENGINE.md §13): the report's CROSS-RUN meta-progression
// (unlockable units, cosmetics, voluntary handicaps that persist between runs) is
// deferred platform-wide, because it is an engagement economy spanning every game and
// needs a §1.9 dark-pattern review before it exists. No persistence layer is invented
// here. What IS real is the WITHIN-RUN item/upgrade layer: `items` below are dropped by
// PvE camps, equipped onto units, and combine into stronger items inside the same run.

import { z } from 'zod'

import {
  gameCategorySchema,
  gameFeedbackSchema,
  gameInterludeSchema,
  gameItemSchema,
  idString,
  noteMd,
} from '../../core/schemaBase.js'

// ---- Sprite slots ---------------------------------------------------------------

/**
 * The sprite slot ids an autobattler document may bind (`skin.sprites` keys, and the
 * `image_slot` an item/category may point at). CLOSED: slot ids are the interface
 * between the generated manifest and Prism's illustrate stage, so an undeclared key
 * would silently never render — core/schema.ts rejects it outright.
 *
 * 12 unit slots covers the roster ceiling, 6 trait banners the synergy ceiling, 8 item
 * slots the within-run item catalog, and 6 opponent portraits the round table.
 */
export const AUTOBATTLER_SPRITE_SLOTS = [
  'board',
  'bench',
  'shop',
  'coin',
  'heart',
  'unit_1',
  'unit_2',
  'unit_3',
  'unit_4',
  'unit_5',
  'unit_6',
  'unit_7',
  'unit_8',
  'unit_9',
  'unit_10',
  'unit_11',
  'unit_12',
  'trait_1',
  'trait_2',
  'trait_3',
  'trait_4',
  'trait_5',
  'trait_6',
  'item_1',
  'item_2',
  'item_3',
  'item_4',
  'item_5',
  'item_6',
  'item_7',
  'item_8',
  'opponent_1',
  'opponent_2',
  'opponent_3',
  'opponent_4',
  'opponent_5',
  'opponent_6',
] as const satisfies readonly string[]

export type AutobattlerSpriteSlot = (typeof AUTOBATTLER_SPRITE_SLOTS)[number]

// ---- Closed vocabularies ---------------------------------------------------------

/** The report's "targeting rule (closest, lowest health, etc.)". Closed, because each
 *  entry is a branch in the deterministic resolution order. */
export const AUTOBATTLER_TARGETING = [
  'closest',
  'farthest',
  'lowest_health',
  'highest_damage',
  'lowest_armour',
] as const
export type AutobattlerTargeting = (typeof AUTOBATTLER_TARGETING)[number]

/** The ability a unit fires when its mana bar fills. `none` means the unit never casts
 *  (a plain attacker) — representable rather than requiring a fake ability. */
export const AUTOBATTLER_ABILITIES = [
  'none',
  'burst',
  'splash',
  'heal',
  'shield',
  'empower',
] as const
export type AutobattlerAbilityKind = (typeof AUTOBATTLER_ABILITIES)[number]

/** The report's five named AI personalities. What each one DOES is config (see
 *  `opponentProfileSchema`) — the name only selects which dial block applies. */
export const AUTOBATTLER_PROFILES = ['saver', 'rush', 'synergy', 'mirror', 'adaptive'] as const
export type AutobattlerProfile = (typeof AUTOBATTLER_PROFILES)[number]

/** `team` = a global aura over the whole side; `trait` = only the units carrying it. */
export const AUTOBATTLER_TRAIT_SCOPES = ['team', 'trait'] as const
export type AutobattlerTraitScope = (typeof AUTOBATTLER_TRAIT_SCOPES)[number]

/** `pvp` fights an authored opponent; `pve` fights a camp that DROPS items on a win. */
export const AUTOBATTLER_ROUND_KINDS = ['pvp', 'pve'] as const
export type AutobattlerRoundKind = (typeof AUTOBATTLER_ROUND_KINDS)[number]

/** Who wins a battle that ran out of combat ticks. Explicit, because "nobody died" is a
 *  real outcome and silently defaulting it would make a stall feel like a bug. */
export const AUTOBATTLER_TIMEOUT_RESULTS = ['player', 'enemy', 'most_units'] as const
export type AutobattlerTimeoutResult = (typeof AUTOBATTLER_TIMEOUT_RESULTS)[number]

// ---- Units ------------------------------------------------------------------------

/**
 * Every stat is an INTEGER and every distance is in MILLI-CELLS (1000 = one board
 * cell), so the whole combat integration stays exact integer arithmetic — the strongest
 * form of the §5 determinism rule, since there is then no rounding for two engines to
 * disagree about.
 *
 * `attack_interval` and `move_speed` are per COMBAT tick. The report specifies a 0.5s
 * combat tick and our engine tick is 50ms, so one combat tick is exactly 10 engine
 * ticks — see `combat.engine_ticks_per_combat_tick`.
 */
const unitStatsSchema = z.object({
  hp: z.number().int().min(10).max(5000),
  damage: z.number().int().min(1).max(500),
  /** FLAT reduction subtracted from incoming damage, floored by `combat.min_damage`. */
  armour: z.number().int().min(0).max(200),
  attack_interval: z.number().int().min(1).max(20),
  range: z.number().int().min(400).max(12000),
  move_speed: z.number().int().min(0).max(4000),
  /** 0 disables the mana bar entirely: the unit simply never casts. */
  mana_max: z.number().int().min(0).max(300),
  mana_per_attack: z.number().int().min(0).max(100),
  mana_on_damaged: z.number().int().min(0).max(100),
})
export type AutobattlerUnitStats = z.infer<typeof unitStatsSchema>

const abilitySchema = z.object({
  kind: z.enum(AUTOBATTLER_ABILITIES),
  /** Damage, healing, shield points or bonus PERCENT, depending on `kind`. */
  power: z.number().int().min(0).max(3000),
  /** `splash` only: milli-cell radius around the target. */
  radius: z.number().int().min(0).max(12000),
})
export type AutobattlerAbility = z.infer<typeof abilitySchema>

export const autobattlerUnitSchema = z.object({
  id: idString,
  /** The catalog item that names and illustrates this unit. Binding the roster to
   *  `content.items` is what makes the units CONCEPT tokens rather than generic pawns. */
  item_id: idString,
  /** 1..4 — the shop's rarity ladder, weighted per player level. */
  rarity: z.number().int().min(1).max(4),
  cost: z.number().int().min(1).max(10),
  /** One or two traits, exactly as the report specifies. */
  traits: z.array(idString).min(1).max(2),
  stats: unitStatsSchema,
  ability: abilitySchema,
  /** Overrides `combat.targeting` for this unit only. */
  targeting: z.enum(AUTOBATTLER_TARGETING).optional(),
  sprite_slot: idString.optional(),
})
export type AutobattlerUnit = z.infer<typeof autobattlerUnitSchema>

// ---- Traits (the synergy matrix) ---------------------------------------------------

/** One rung of a trait. Effects CASCADE: every rung whose `count` is met adds its
 *  bonuses, so 2/4/6 is genuinely three steps and not three replacements. */
const traitThresholdSchema = z.object({
  count: z.number().int().min(1).max(9),
  damage_pct: z.number().int().min(0).max(300),
  hp_pct: z.number().int().min(0).max(300),
  armour: z.number().int().min(0).max(200),
  attack_speed_pct: z.number().int().min(0).max(300),
})

export const autobattlerTraitSchema = z.object({
  id: idString,
  /** Optional catalog item, so a trait banner can carry a label and an icon. */
  item_id: idString.optional(),
  scope: z.enum(AUTOBATTLER_TRAIT_SCOPES),
  thresholds: z.array(traitThresholdSchema).min(1).max(4),
})
export type AutobattlerTrait = z.infer<typeof autobattlerTraitSchema>

// ---- The within-run item layer ------------------------------------------------------

/**
 * An item a PvE camp drops, equipped onto a unit inside the SAME run. Two items combine
 * when the held one names the incoming one in `combines_with`, producing `combines_into`.
 * This is the report's "combinable items" requirement, kept entirely inside the run —
 * cross-run persistence is the deferred layer named at the top of this file.
 */
export const autobattlerItemSchema = z.object({
  id: idString,
  item_id: idString.optional(),
  damage: z.number().int().min(0).max(300),
  hp: z.number().int().min(0).max(2000),
  armour: z.number().int().min(0).max(200),
  attack_speed_pct: z.number().int().min(0).max(200),
  combines_with: idString.optional(),
  combines_into: idString.optional(),
})
export type AutobattlerItem = z.infer<typeof autobattlerItemSchema>

// ---- Opponents, camps and the round table ---------------------------------------------

const rosterUnitSchema = z.object({
  unit_id: idString,
  star: z.number().int().min(1).max(3),
  col: z.number().int().min(0).max(7),
  row: z.number().int().min(0).max(3),
})

export const autobattlerOpponentSchema = z.object({
  id: idString,
  item_id: idString.optional(),
  profile: z.enum(AUTOBATTLER_PROFILES),
  /** The power curve: every stat of this roster is scaled by this percentage before the
   *  profile's own round modulation is applied. */
  power_pct: z.number().int().min(10).max(400),
  /** The report's "calibrated error rate": the chance, per unit, that this AI simply
   *  failed to field it. Seeded, so it replays exactly. */
  error_rate_pct: z.number().int().min(0).max(100),
  units: z.array(rosterUnitSchema).max(12),
  sprite_slot: idString.optional(),
})
export type AutobattlerOpponent = z.infer<typeof autobattlerOpponentSchema>

export const autobattlerCampSchema = z.object({
  id: idString,
  item_id: idString.optional(),
  power_pct: z.number().int().min(10).max(400),
  units: z.array(rosterUnitSchema).min(1).max(12),
  /** Item ids handed to the player's bag on a WIN — the fixed drop schedule is the
   *  round table itself (which rounds are `pve`). */
  drops: z.array(idString).max(3),
  sprite_slot: idString.optional(),
})
export type AutobattlerCamp = z.infer<typeof autobattlerCampSchema>

const roundSchema = z.object({
  kind: z.enum(AUTOBATTLER_ROUND_KINDS),
  opponent_id: idString.optional(),
  camp_id: idString.optional(),
})
export type AutobattlerRound = z.infer<typeof roundSchema>

/**
 * What a named personality actually DOES. Keeping the behaviour here rather than in
 * `simulate.ts` is the difference between a re-skinnable mechanic and v1: an author can
 * make `rush` gentle for a tier-1 document and vicious for a tier-3 one without a code
 * change.
 */
const opponentProfileSchema = z.object({
  /** Applied while `round < late_from_round` (1-based rounds). */
  early_power_pct: z.number().int().min(10).max(300),
  late_power_pct: z.number().int().min(10).max(300),
  late_from_round: z.number().int().min(1).max(20),
  /** Extra percent per point of the PLAYER's current win streak — the `adaptive` dial. */
  adaptive_per_win_pct: z.number().int().min(0).max(50),
  /** A flat percent the whole enemy side gets, as if its synergies were always on —
   *  the `synergy` dial. */
  team_bonus_pct: z.number().int().min(0).max(200),
  /** Fight a mirrored copy of the PLAYER's own board instead of the authored roster —
   *  the `mirror` dial. */
  mirror: z.boolean(),
})
export type AutobattlerOpponentProfile = z.infer<typeof opponentProfileSchema>

// ---- Board, shop, economy, combat ------------------------------------------------------

const boardSchema = z.object({
  cols: z.number().int().min(2).max(8),
  rows: z.number().int().min(1).max(4),
  /** Design px per cell — core/stage.ts maps design coordinates onto the real viewport. */
  cell_size: z.number().int().min(24).max(200),
  /** Hard ceiling on units on the board; the player LEVEL raises the working cap. */
  team_size: z.number().int().min(1).max(12),
  bench_size: z.number().int().min(1).max(12),
})

const levelSchema = z.object({
  max: z.number().int().min(1).max(10),
  /** Gold per XP purchase. */
  xp_cost: z.number().int().min(0).max(20),
  xp_per_purchase: z.number().int().min(0).max(10),
  /** Free XP for buying a unit — the "play the shop and you grow" dial. */
  xp_per_buy: z.number().int().min(0).max(5),
  /** XP needed to leave level i (index i-1). Length must equal `max`. */
  xp_needed: z.array(z.number().int().min(1).max(200)).min(1).max(10),
  /** How many units level i may field (index i-1). Length must equal `max`. */
  units_by_level: z.array(z.number().int().min(1).max(12)).min(1).max(10),
})

const shopSchema = z.object({
  offers: z.number().int().min(1).max(8),
  refresh_cost: z.number().int().min(0).max(20),
  /** Rarity weights [r1, r2, r3, r4] per player level (index level-1). Length == level.max. */
  rarity_by_level: z
    .array(z.tuple([
      z.number().int().min(0).max(100),
      z.number().int().min(0).max(100),
      z.number().int().min(0).max(100),
      z.number().int().min(0).max(100),
    ]))
    .min(1)
    .max(10),
  level: levelSchema,
})

const interestSchema = z.object({
  /** Gold saved per interest step — "every 10 you keep pays 1". */
  gold_per_step: z.number().int().min(1).max(50),
  amount_per_step: z.number().int().min(1).max(20),
  /** The CAP. Saving past it pays nothing, which is exactly the trade-off the lesson is
   *  about: bank up to the cap, spend the rest on a stronger board. */
  max_steps: z.number().int().min(0).max(10),
})

const economySchema = z.object({
  start_gold: z.number().int().min(0).max(100),
  base_income: z.number().int().min(0).max(20),
  income_growth_per_round: z.number().int().min(0).max(10),
  income_cap: z.number().int().min(0).max(60),
  interest: interestSchema,
  streak: z.object({
    /** Bonus for a win streak of length i+1; the last entry applies to longer streaks. */
    win_bonus: z.array(z.number().int().min(0).max(20)).max(6),
    loss_bonus: z.array(z.number().int().min(0).max(20)).max(6),
  }),
  sell_refund_pct: z.number().int().min(0).max(100),
})

const adjacencySchema = z.object({
  enabled: z.boolean(),
  per_neighbour_damage_pct: z.number().int().min(0).max(50),
  per_neighbour_armour: z.number().int().min(0).max(30),
  /** Only count neighbours that share a trait — the "planned formation" tuning. */
  same_trait_only: z.boolean(),
})

const combatSchema = z.object({
  /**
   * THE TICK MAPPING. The report specifies a 0.5s combat tick; the engine's fixed tick
   * is 50ms (`TICK_MS`), so one combat tick is exactly 10 engine ticks. It is an
   * INTEGER counter in `simulate.ts`, never a float accumulator.
   */
  engine_ticks_per_combat_tick: z.number().int().min(1).max(40),
  max_combat_ticks: z.number().int().min(5).max(400),
  timeout_result: z.enum(AUTOBATTLER_TIMEOUT_RESULTS),
  /** The default targeting rule; a unit type may override it. */
  targeting: z.enum(AUTOBATTLER_TARGETING),
  /** Floor under post-armour damage, so a high-armour wall can never be unkillable. */
  min_damage: z.number().int().min(0).max(50),
  crit_chance_pct: z.number().int().min(0).max(100),
  crit_multiplier_pct: z.number().int().min(100).max(400),
  adjacency: adjacencySchema,
})

const healthSchema = z.object({
  start: z.number().int().min(1).max(100),
  /** Losing a round costs `base + per_round * roundIndex + per_survivor * survivors`. */
  base_damage: z.number().int().min(0).max(20),
  per_round: z.number().int().min(0).max(10),
  per_survivor: z.number().int().min(0).max(10),
})

const mergeSchema = z.object({
  copies_needed: z.number().int().min(2).max(5),
  max_star: z.number().int().min(1).max(3),
  /** Stat multiplier per star (index star-1). Entry 0 must be exactly 1. */
  star_multipliers: z.array(z.number().min(1).max(10)).min(1).max(3),
})

const scoreWeightsSchema = z.object({
  rounds: z.number().min(0).max(1),
  health: z.number().min(0).max(1),
  /** The LESSON's weight: how much of the score comes from interest actually earned. */
  interest: z.number().min(0).max(1),
})

// ---- The config -----------------------------------------------------------------------

export const autobattlerConfigSchema = z
  .object({
    board: boardSchema,
    shop: shopSchema,
    merge: mergeSchema,
    economy: economySchema,
    combat: combatSchema,
    health: healthSchema,
    prep: z.object({
      /** Engine ticks the preparation phase may last before it auto-starts the battle.
       *  A player who stops deciding must never stall the run forever. */
      max_ticks: z.number().int().min(20).max(2000),
      /** Merge the moment a third copy is bought, instead of requiring the action. */
      auto_merge: z.boolean(),
    }),
    units: z.array(autobattlerUnitSchema).min(2).max(16),
    traits: z.array(autobattlerTraitSchema).max(8),
    items: z.array(autobattlerItemSchema).max(10),
    opponents: z.array(autobattlerOpponentSchema).max(8),
    camps: z.array(autobattlerCampSchema).max(6),
    opponent_profiles: z.object({
      saver: opponentProfileSchema,
      rush: opponentProfileSchema,
      synergy: opponentProfileSchema,
      mirror: opponentProfileSchema,
      adaptive: opponentProfileSchema,
    }),
    rounds: z.array(roundSchema).min(1).max(12),
    score_weights: scoreWeightsSchema,
    targets: z.object({
      rounds_won: z.number().int().min(1).max(12),
      interest: z.number().int().min(1).max(500),
    }),
    /** Points of the 0..100 scale a lost round costs — flat and kid-legible. */
    loss_penalty_pct: z.number().min(0).max(50),
    /** Hard tick budget for the whole run. */
    max_ticks: z.number().int().min(100).max(12000),
  })
  .superRefine((config, ctx) => {
    const unitIds = config.units.map((unit) => unit.id)
    const traitIds = config.traits.map((trait) => trait.id)
    const itemIds = config.items.map((item) => item.id)
    const opponentIds = config.opponents.map((opponent) => opponent.id)
    const campIds = config.camps.map((camp) => camp.id)

    if (new Set(unitIds).size !== unitIds.length) {
      ctx.addIssue({ code: 'custom', path: ['units'], message: 'unit ids must be unique' })
    }
    if (new Set(traitIds).size !== traitIds.length) {
      ctx.addIssue({ code: 'custom', path: ['traits'], message: 'trait ids must be unique' })
    }
    if (new Set(itemIds).size !== itemIds.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'item ids must be unique' })
    }

    for (const [index, unit] of config.units.entries()) {
      for (const [traitIndex, trait] of unit.traits.entries()) {
        if (!traitIds.includes(trait)) {
          ctx.addIssue({
            code: 'custom',
            path: ['units', index, 'traits', traitIndex],
            message: `"${trait}" is not a declared trait id`,
          })
        }
      }
      if (unit.ability.kind === 'splash' && unit.ability.radius <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['units', index, 'ability', 'radius'],
          message: 'a splash ability needs a radius',
        })
      }
      if (unit.ability.kind !== 'none' && unit.stats.mana_max <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['units', index, 'stats', 'mana_max'],
          message: 'a unit with an ability needs a mana bar it can fill',
        })
      }
    }

    for (const [index, item] of config.items.entries()) {
      if (item.combines_with !== undefined && !itemIds.includes(item.combines_with)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'combines_with'],
          message: 'unknown item id',
        })
      }
      if (item.combines_into !== undefined && !itemIds.includes(item.combines_into)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'combines_into'],
          message: 'unknown item id',
        })
      }
      // Half a recipe is a dead end the player can walk into and never leave.
      if ((item.combines_with === undefined) !== (item.combines_into === undefined)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index],
          message: 'combines_with and combines_into must be declared together',
        })
      }
    }

    const cells = config.board.cols * config.board.rows
    if (config.board.team_size > cells) {
      ctx.addIssue({
        code: 'custom',
        path: ['board', 'team_size'],
        message: 'team_size cannot exceed the number of board cells',
      })
    }

    const checkRoster = (
      units: readonly z.infer<typeof rosterUnitSchema>[],
      path: (string | number)[],
    ) => {
      for (const [index, entry] of units.entries()) {
        if (!unitIds.includes(entry.unit_id)) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, index, 'unit_id'],
            message: 'unknown unit id',
          })
        }
        if (entry.col >= config.board.cols || entry.row >= config.board.rows) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, index],
            message: 'roster position falls outside the board',
          })
        }
        if (entry.star > config.merge.max_star) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, index, 'star'],
            message: 'star exceeds merge.max_star',
          })
        }
      }
    }

    for (const [index, opponent] of config.opponents.entries()) {
      checkRoster(opponent.units, ['opponents', index, 'units'])
      // `mirror` fights a copy of the player's board, so an empty roster is legal there
      // and nowhere else — an empty non-mirror opponent is a free round, not a battle.
      if (opponent.units.length === 0 && !config.opponent_profiles[opponent.profile].mirror) {
        ctx.addIssue({
          code: 'custom',
          path: ['opponents', index, 'units'],
          message: 'only a mirror profile may field an empty roster',
        })
      }
    }
    for (const [index, camp] of config.camps.entries()) {
      checkRoster(camp.units, ['camps', index, 'units'])
      for (const [dropIndex, drop] of camp.drops.entries()) {
        if (!itemIds.includes(drop)) {
          ctx.addIssue({
            code: 'custom',
            path: ['camps', index, 'drops', dropIndex],
            message: 'unknown item id',
          })
        }
      }
    }

    for (const [index, round] of config.rounds.entries()) {
      if (round.kind === 'pvp') {
        if (round.opponent_id === undefined || !opponentIds.includes(round.opponent_id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['rounds', index, 'opponent_id'],
            message: 'a pvp round must name a declared opponent',
          })
        }
      } else if (round.camp_id === undefined || !campIds.includes(round.camp_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rounds', index, 'camp_id'],
          message: 'a pve round must name a declared camp',
        })
      }
    }

    if (config.merge.star_multipliers.length !== config.merge.max_star) {
      ctx.addIssue({
        code: 'custom',
        path: ['merge', 'star_multipliers'],
        message: 'one multiplier per star is required',
      })
    }
    if (config.merge.star_multipliers[0] !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['merge', 'star_multipliers', 0],
        message: 'a 1-star unit is the baseline: the first multiplier must be exactly 1',
      })
    }

    if (config.shop.rarity_by_level.length !== config.shop.level.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['shop', 'rarity_by_level'],
        message: 'one rarity row per player level is required',
      })
    }
    for (const [index, row] of config.shop.rarity_by_level.entries()) {
      let total = 0
      for (const weight of row) total += weight
      if (total <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['shop', 'rarity_by_level', index],
          message: 'a rarity row with no weight would make the shop unable to offer anything',
        })
      }
    }
    if (config.shop.level.xp_needed.length !== config.shop.level.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['shop', 'level', 'xp_needed'],
        message: 'one xp threshold per player level is required',
      })
    }
    if (config.shop.level.units_by_level.length !== config.shop.level.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['shop', 'level', 'units_by_level'],
        message: 'one unit cap per player level is required',
      })
    }

    if (config.targets.rounds_won > config.rounds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['targets', 'rounds_won'],
        message: 'the win target cannot exceed the number of rounds',
      })
    }

    const weights =
      config.score_weights.rounds + config.score_weights.health + config.score_weights.interest
    if (weights <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['score_weights'],
        message: 'at least one scoring signal must carry weight',
      })
    }
    // The interest rule is the concept this mechanic teaches (GAME_ENGINE.md §4). A
    // manifest that pays nothing for saving is a different game wearing this one's name.
    if (config.score_weights.interest <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['score_weights', 'interest'],
        message: 'interest is the concept: it must carry weight in the score',
      })
    }
  })

export type AutobattlerConfig = z.infer<typeof autobattlerConfigSchema>

// ---- The content -----------------------------------------------------------------------

/**
 * Autobattler content. `tips` is REQUIRED and is not decoration: the interest rule has
 * to be legible ON SCREEN, in the child's own language, because it is the thing the game
 * exists to teach. Leaving it to a generic chrome string would make every autobattler
 * explain saving in the same words regardless of what its lesson actually said.
 */
export const autobattlerContentSchema = z
  .object({
    items: z.array(gameItemSchema).min(2).max(80),
    categories: z.array(gameCategorySchema).max(8).optional(),
    interludes: z.array(gameInterludeSchema).max(4).optional(),
    feedback: gameFeedbackSchema,
    tips: z.object({
      /** "Cada 10 monedas que guardas te pagan 1 más, hasta 3." */
      interest_md: noteMd,
      /** Why banking beats spending everything right now. */
      saving_md: noteMd,
    }),
  })
  .superRefine((content, ctx) => {
    const ids = content.items.map((item) => item.id)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'item ids must be unique' })
    }
    const declared = new Set((content.categories ?? []).map((category) => category.id))
    for (const [index, item] of content.items.entries()) {
      if (item.category !== undefined && !declared.has(item.category)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'category'],
          message: 'category must reference a declared category id',
        })
      }
    }
  })

export type AutobattlerContent = z.infer<typeof autobattlerContentSchema>
