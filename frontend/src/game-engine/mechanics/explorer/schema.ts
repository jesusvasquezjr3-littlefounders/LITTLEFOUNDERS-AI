// `explorer` — the config + content contract (GAME_ENGINE.md §4 row `explorer`, §7).
//
// THE POINT OF THIS FILE: every number that shapes this mechanic's difficulty,
// economy, physics-of-progression and scoring is a MANIFEST field. Connectivity
// ratios, the hard/soft/compound/temporal lock mix, ability tiers and their energy /
// cooldown costs, the fragment-upgrade depth, the hidden-content share, the soft
// currency lost on death and recovered at the death site, the exploration-percentage
// ending and every scoring weight live in `config`; every label, node, edge, lock,
// ability and micro-challenge lives in `content`. A new explorer game is a new JSON
// document, never new code.
//
// WHERE THE LINE BETWEEN config AND content FALLS, and why it is not arbitrary: the
// Arcade pipeline's `localize` stage skips the WHOLE `config` container (GAME_ENGINE.md
// §9), so anything carrying a user-visible string MUST live in `content`. That is why
// the world graph — whose nodes and locks carry `label_md` / `hint_md` — is content,
// while the ratios, bounds and costs that TUNE that graph are config. `simulate.ts`
// exports `solveExplorerWorld()`, which audits an authored graph against the config
// bounds and proves it completable; that is the gate the pipeline runs.
//
// Zod only, no React: `backend/src/game-contract/` and `gamegen/src/contract/` carry
// this module verbatim next to `simulate.ts`.

import { z } from 'zod'

import {
  gameCategorySchema,
  gameFeedbackSchema,
  gameInterludeSchema,
  gameItemSchema,
  idString,
  labelMd,
  noteMd,
  promptMd,
  sfxEnum,
} from '@/game-engine/core/schemaBase'

// ---- Sprite slots -------------------------------------------------------------

/**
 * The sprite slot ids an explorer document may bind (`skin.sprites` keys, and the
 * `image_slot` a node or item may point at). CLOSED: slot ids are the interface
 * between the generated manifest and Prism's illustrate stage, so they cannot be
 * per-document free text — an undeclared key would silently never render, which is why
 * core/schema.ts rejects it outright rather than warning.
 *
 * One slot per NODE KIND and one per LOCK KIND, because the signposting rule (§4) is
 * that a first encounter teaches without text: a lock must be recognisable by its art
 * as well as by its colour and shape. Eight ability and eight collectible slots cover
 * the catalogue an authored world can carry (an ability with no slot falls back to its
 * item's Material Symbols `icon`, which is always legible).
 */
export const EXPLORER_SPRITE_SLOTS = [
  'map',
  'avatar',
  'node',
  'node_visited',
  'node_current',
  'node_hidden',
  'node_tutorial',
  'node_boss',
  'node_shrine',
  'node_shop',
  'node_fragment',
  'node_goal',
  'node_checkpoint',
  'lock_hard',
  'lock_soft',
  'lock_compound',
  'lock_temporal',
  'cache',
  'ability_1',
  'ability_2',
  'ability_3',
  'ability_4',
  'ability_5',
  'ability_6',
  'ability_7',
  'ability_8',
  'collectible_1',
  'collectible_2',
  'collectible_3',
  'collectible_4',
  'collectible_5',
  'collectible_6',
  'collectible_7',
  'collectible_8',
] as const satisfies readonly string[]

export type ExplorerSpriteSlot = (typeof EXPLORER_SPRITE_SLOTS)[number]

// ---- Declared closed sets ------------------------------------------------------

/** The report's three ability families. In this mechanic they are the LEARNING axis:
 *  `movement` = a skill that lets you go somewhere new, `interaction` = a skill that
 *  changes something, `perception` = a skill that lets you SEE what was hidden. The
 *  map is literally a concept-dependency graph, so a family is a kind of knowledge. */
export const EXPLORER_ABILITY_FAMILIES = ['movement', 'interaction', 'perception'] as const
export type ExplorerAbilityFamily = (typeof EXPLORER_ABILITY_FAMILIES)[number]

/**
 * The FULL lock taxonomy from the report, all four implemented:
 *  - `hard`     one specific ability at one tier. No alternative, no shortcut.
 *  - `soft`     the ability OR enough demonstrated skill (`skill_required` solved
 *               micro-challenges) — this is the sequence-breaking dial.
 *  - `compound` A **and** B, or A at tier >= 2.
 *  - `temporal` a prior STATE: a node already visited, or an item already held.
 */
export const EXPLORER_LOCK_KINDS = ['hard', 'soft', 'compound', 'temporal'] as const
export type ExplorerLockKind = (typeof EXPLORER_LOCK_KINDS)[number]

/** Acquisition sites (report §4) plus the two structural nodes. `boss` sits on the
 *  main path, `shrine` is optional and usually hidden, `shop` is a purchase, and
 *  `fragment` is a partial upgrade toward the next tier. */
export const EXPLORER_NODE_KINDS = [
  'start',
  'tutorial',
  'plain',
  'boss',
  'shrine',
  'shop',
  'fragment',
  'goal',
] as const
export type ExplorerNodeKind = (typeof EXPLORER_NODE_KINDS)[number]

/** The SHAPE half of a lock's signposting code. Shapes, not emoji: an emoji renders
 *  differently on every platform and carries a tone the art direction cannot control. */
export const EXPLORER_SIGNPOST_SHAPES = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'hexagon',
  'cross',
] as const
export type ExplorerSignpostShape = (typeof EXPLORER_SIGNPOST_SHAPES)[number]

/** The COLOUR half, named as DESIGN.md semantic token families — never a raw hex, so
 *  a signpost stays legible when the child flips light/dark. */
export const EXPLORER_SIGNPOST_TONES = [
  'primary',
  'secondary',
  'accent',
  'success',
  'warning',
  'delight',
] as const
export type ExplorerSignpostTone = (typeof EXPLORER_SIGNPOST_TONES)[number]

const abilityFamilyEnum = z.enum(EXPLORER_ABILITY_FAMILIES)
const lockKindEnum = z.enum(EXPLORER_LOCK_KINDS)
const nodeKindEnum = z.enum(EXPLORER_NODE_KINDS)
const abilityTier = z.number().int().min(1).max(3)
const percent = z.number().int().min(0).max(100)

// ---- Config: the map, movement and the ability economy -------------------------

/** The map in DESIGN COORDINATES (core/stage.ts maps them onto the real viewport).
 *  Config rather than a constant because a 12-node world and a 40-node world want
 *  different canvases, and node positions are authored against this box. */
const explorerMapSchema = z.object({
  width: z.number().int().min(320).max(2000),
  height: z.number().int().min(240).max(1400),
  /** Rendered radius of a node marker, design px. Also the tap target's floor. */
  node_radius: z.number().int().min(12).max(120),
})

const explorerMovementSchema = z.object({
  /** Ticks one edge traversal takes (50ms each). Travel is a per-player countdown, so
   *  a slow world is a slow world, never a world that skips arrival. */
  ticks_per_edge: z.number().int().min(1).max(40),
  /** Energy a traversal costs. 0 makes movement free, which is the tier-1 posture. */
  energy_per_move: z.number().int().min(0).max(20),
})

/** The ability COST model (report: "each with a cost — energy or cooldown"). Energy is
 *  spent per `use`, regenerates on a fixed interval and is topped up by resting. */
const explorerEnergySchema = z
  .object({
    max: z.number().int().min(1).max(99),
    start: z.number().int().min(0).max(99),
    /** Ticks between regeneration steps. */
    regen_interval_ticks: z.number().int().min(1).max(400),
    regen_amount: z.number().int().min(0).max(20),
    /** What one `rest` at a checkpoint restores. */
    rest_restores: z.number().int().min(0).max(99),
  })
  .refine((energy) => energy.start <= energy.max, 'energy.start cannot exceed energy.max')

/** Tiering + the fragment-upgrade depth (report: "possible TIERS", "fragment upgrades"). */
const explorerAbilityRulesSchema = z
  .object({
    max_tier: abilityTier,
    /** Fragments that add up to one tier. */
    fragments_per_tier: z.number().int().min(1).max(6),
    /** How many tiers ABOVE 1 this world may hand out — the "upgrade depth" dial. */
    upgrade_depth: z.number().int().min(0).max(2),
    /** The report's safe tutorial room per family: the first ability of each family is
     *  granted with no challenge and no risk. Enforced against the content by
     *  `solveExplorerWorld()`, which reports a family with no tutorial site. */
    tutorial_room_per_family: z.boolean(),
  })
  .refine(
    (rules) => rules.upgrade_depth <= rules.max_tier - 1,
    'abilities.upgrade_depth cannot exceed max_tier - 1',
  )

// ---- Config: locks, connectivity and optional content ---------------------------

/**
 * The lock MIX — the report's central difficulty variable, because it is what decides
 * linearity: an all-`hard` world is a corridor, a `soft`-heavy one invites
 * sequence-breaking. The four shares are a target in percent; `mix_tolerance_pct` is
 * how far an authored graph may drift before `solveExplorerWorld()` flags it.
 */
const explorerLockRulesSchema = z
  .object({
    mix: z.object({
      hard_pct: percent,
      soft_pct: percent,
      compound_pct: percent,
      temporal_pct: percent,
    }),
    mix_tolerance_pct: percent,
    /** Fallback for a `soft` lock that declares no `skill_required` of its own. */
    soft_skill_default: z.number().int().min(1).max(20),
    /** Ceiling on the combinatorics: a lock demanding abilities in ORDER. */
    max_sequence_length: z.number().int().min(1).max(6),
  })
  .refine((locks) => {
    const { hard_pct, soft_pct, compound_pct, temporal_pct } = locks.mix
    return hard_pct + soft_pct + compound_pct + temporal_pct === 100
  }, 'locks.mix must sum to exactly 100')

/** Connectivity: node count, the share of edges that are locked, and the share that
 *  are one-way shortcuts. Bounds rather than a single number, because the authored
 *  graph is what the generator produces and this is the envelope it must land in. */
const explorerConnectivitySchema = z
  .object({
    min_nodes: z.number().int().min(3).max(64),
    max_nodes: z.number().int().min(3).max(64),
    locked_edge_pct_min: percent,
    locked_edge_pct_max: percent,
    shortcut_pct_min: percent,
    shortcut_pct_max: percent,
  })
  .refine((c) => c.min_nodes <= c.max_nodes, 'connectivity.min_nodes must be <= max_nodes')
  .refine(
    (c) => c.locked_edge_pct_min <= c.locked_edge_pct_max,
    'connectivity.locked_edge_pct_min must be <= locked_edge_pct_max',
  )
  .refine(
    (c) => c.shortcut_pct_min <= c.shortcut_pct_max,
    'connectivity.shortcut_pct_min must be <= shortcut_pct_max',
  )

/** Optional content: hidden shrines a child only finds with a perception ability. */
const explorerOptionalSchema = z
  .object({
    hidden_pct_min: percent,
    hidden_pct_max: percent,
    /** When true a hidden node is invisible on the map until a `perception` ability is
     *  held. When false it is drawn faintly from the start — the tier-1 posture, where
     *  "there is something over there" is itself the lesson. */
    reveal_requires_perception: z.boolean(),
  })
  .refine(
    (o) => o.hidden_pct_min <= o.hidden_pct_max,
    'optional.hidden_pct_min must be <= hidden_pct_max',
  )

/** The secondary collectible layer (report: "a secondary collectible layer"). */
const explorerCollectiblesSchema = z.object({
  enabled: z.boolean(),
  /** How many the score treats as a full sweep. */
  target: z.number().int().min(0).max(40),
})

// ---- Config: the money layer ----------------------------------------------------

/**
 * The soft currency. This is the mechanic's LEARNING BINDING on the money side: what a
 * child loses on death is money, the loss is partial, and it is RECOVERABLE by going
 * back for it — risk, and a loss you can still do something about. Abilities (what you
 * know) are never lost; only the currency (what you carry) is at stake.
 */
const explorerCurrencySchema = z.object({
  start: z.number().int().min(0).max(9999),
  /** The amount the score treats as "you managed your money well". */
  target: z.number().int().min(1).max(99999),
  /** Whether shop nodes may sell abilities in this world. */
  purchase_enabled: z.boolean(),
})

const explorerDeathSchema = z.object({
  /** Share of carried currency dropped on death. */
  currency_loss_pct: percent,
  /** Share of THAT drop which can be picked back up at the death site. 100 = a fully
   *  recoverable loss; below 100 the trip back is still worth making but costs. */
  cache_recoverable_pct: percent,
  /** Arcade only — ignored when `scoring.lives` is null, which is what makes a cheer
   *  document have no fail state at all. */
  costs_life: z.boolean(),
  /** Energy the player respawns with. */
  respawn_energy: z.number().int().min(0).max(99),
})

/** The per-node micro-challenge. There is no real-time platforming in this mechanic
 *  (see the header of simulate.ts); a node's "boss" is a question about the concept. */
const explorerChallengeRulesSchema = z.object({
  /** Wrong answers a node allows before the run dies there. Reset on respawn, so a
   *  child is never permanently locked out of a node. */
  attempts: z.number().int().min(1).max(5),
  /** Currency a wrong answer costs. */
  wrong_currency_cost: z.number().int().min(0).max(999),
  /** Skill credit one solve is worth — the currency of a `soft` lock. */
  mastery_per_solve: z.number().int().min(0).max(5),
})

const explorerCheckpointSchema = z.object({
  /** Whether the start node counts as an activated checkpoint at tick 0. */
  start_is_checkpoint: z.boolean(),
  /** When false, `rest` works anywhere (the gentlest tier-1 posture). */
  rest_only_at_checkpoint: z.boolean(),
})

/** The exploration-percentage ending (report). A world can be finished by reaching the
 *  goal, by exploring enough of the map, or by both. */
const explorerEndingSchema = z.object({
  exploration_pct_required: percent,
  require_goal_node: z.boolean(),
})

// ---- Config: signposting, scoring, budget ---------------------------------------

/** Colour + shape + sound — the report's triad, so a FIRST encounter teaches without
 *  text. The sound is a name from the closed manifest vocabulary; the audio layer
 *  resolves it to a file or to silence (no game audio binary ships yet). */
const explorerSignpostSchema = z.object({
  tone: z.enum(EXPLORER_SIGNPOST_TONES),
  shape: z.enum(EXPLORER_SIGNPOST_SHAPES),
  sfx: sfxEnum,
})

const explorerSignpostsSchema = z
  .object({
    hard: explorerSignpostSchema,
    soft: explorerSignpostSchema,
    compound: explorerSignpostSchema,
    temporal: explorerSignpostSchema,
  })
  .refine((signposts) => {
    const tones = [
      signposts.hard.tone,
      signposts.soft.tone,
      signposts.compound.tone,
      signposts.temporal.tone,
    ]
    return new Set(tones).size === tones.length
  }, 'signposts: each lock kind needs its OWN colour — a shared one teaches nothing')
  .refine((signposts) => {
    const shapes = [
      signposts.hard.shape,
      signposts.soft.shape,
      signposts.compound.shape,
      signposts.temporal.shape,
    ]
    return new Set(shapes).size === shapes.length
  }, 'signposts: each lock kind needs its OWN shape — colour alone fails colour-blind players')

/** Relative weights of the five 0..100 signals blended into the final score. */
const explorerScoreWeightsSchema = z.object({
  exploration: z.number().min(0).max(10),
  abilities: z.number().min(0).max(10),
  collectibles: z.number().min(0).max(10),
  currency: z.number().min(0).max(10),
  /**
   * The "you knew where to go" signal, measured in ACTIONS against `action_budget` —
   * never in ticks. Ticks are thinking time, and a game that scored thinking time would
   * pay a child for tapping fast and charge them for looking at the map. Actions are
   * decisions: a player who reads the signposts needs few, and a player mashing needs
   * hundreds. It is also the signal that keeps the §9 random bot honest, since flailing
   * for a whole session is precisely what it does.
   */
  efficiency: z.number().min(0).max(10),
})

const explorerPenaltiesSchema = z.object({
  /** Points of the 0..100 scale one death costs. */
  death_pct: z.number().min(0).max(50),
  /** Points one wrong micro-challenge answer costs. */
  wrong_answer_pct: z.number().min(0).max(50),
})

export const explorerConfigSchema = z
  .object({
    map: explorerMapSchema,
    movement: explorerMovementSchema,
    energy: explorerEnergySchema,
    abilities: explorerAbilityRulesSchema,
    locks: explorerLockRulesSchema,
    connectivity: explorerConnectivitySchema,
    optional: explorerOptionalSchema,
    collectibles: explorerCollectiblesSchema,
    currency: explorerCurrencySchema,
    death: explorerDeathSchema,
    challenge: explorerChallengeRulesSchema,
    checkpoints: explorerCheckpointSchema,
    ending: explorerEndingSchema,
    signposts: explorerSignpostsSchema,
    score_weights: explorerScoreWeightsSchema,
    penalties: explorerPenaltiesSchema,
    /** Hard end of the run, in 50ms ticks. Generous on purpose: it is a safety stop,
     *  not a timer a child races. */
    tick_budget: z.number().int().min(20).max(12000),
    /** Actions (`move` / `use` / `take` / `rest`) a confident run should need. Anything
     *  up to this scores a full efficiency signal; twice this scores zero. */
    action_budget: z.number().int().min(1).max(2000),
  })
  .refine((config) => {
    const w = config.score_weights
    return w.exploration + w.abilities + w.collectibles + w.currency + w.efficiency > 0
  }, 'score_weights: at least one signal must carry weight')
  .refine(
    (config) => !config.collectibles.enabled || config.collectibles.target > 0,
    'collectibles: an enabled layer needs a target above zero',
  )

export type ExplorerMap = z.infer<typeof explorerMapSchema>
export type ExplorerSignpost = z.infer<typeof explorerSignpostSchema>
export type ExplorerConfig = z.infer<typeof explorerConfigSchema>

// ---- Content: abilities, the graph, the micro-challenges -------------------------

/**
 * One ability. `id` references a `content.items` entry, which carries its label, icon
 * and sprite slot — so an ability is a first-class catalogue subject the illustrate
 * stage can draw, not a bare string.
 */
const explorerAbilitySchema = z.object({
  id: idString,
  family: abilityFamilyEnum,
  /** The highest tier this ability can reach in THIS world. */
  max_tier: abilityTier,
  /** Energy one `use` costs. */
  energy_cost: z.number().int().min(0).max(99),
  /** Ticks before it can be used again. A PER-ABILITY timer in the simulator, never a
   *  shared accumulator. */
  cooldown_ticks: z.number().int().min(0).max(400),
})

/** A node's micro-challenge: the concept question that guards its reward. */
const explorerChallengeSchema = z
  .object({
    prompt_md: promptMd,
    options: z
      .array(
        z.object({
          id: idString,
          label_md: labelMd,
          correct: z.boolean(),
          /** WHY this option is wrong. Required for every wrong option by the refine
           *  below — the misconception gate, so a trap always teaches. */
          rationale_md: noteMd.optional(),
        }),
      )
      .min(2)
      .max(4),
  })
  .refine(
    (challenge) => challenge.options.filter((option) => option.correct).length === 1,
    'challenge: exactly one option may be correct',
  )
  .refine(
    (challenge) =>
      challenge.options.every((option) => option.correct || option.rationale_md !== undefined),
    'challenge: a wrong option must carry rationale_md explaining why it is wrong',
  )

const explorerGrantSchema = z.object({ ability: idString, tier: abilityTier })

const explorerNodeSchema = z.object({
  id: idString,
  label_md: labelMd,
  description_md: noteMd.optional(),
  kind: nodeKindEnum,
  /** Position in map design coordinates. */
  x: z.number().int().min(0).max(2000),
  y: z.number().int().min(0).max(1400),
  /** Optional content: found only with perception (or drawn faintly — see
   *  `optional.reveal_requires_perception`). */
  hidden: z.boolean().default(false),
  /** A respawn point the player activates with `rest`. */
  checkpoint: z.boolean().default(false),
  /** `tutorial` only: the family whose FIRST ability this safe room teaches. */
  teaches_family: abilityFamilyEnum.optional(),
  /** An acquisition site: what standing here (and solving its challenge) grants. */
  grants: explorerGrantSchema.optional(),
  /** `fragment` only: the ability this site advances by one fragment. */
  fragment_for: idString.optional(),
  /** `shop` only: the currency price of `grants`. */
  price: z.number().int().min(0).max(9999).optional(),
  /** A secondary-layer pickup; references a `content.items` id. */
  collectible: idString.optional(),
  currency_reward: z.number().int().min(0).max(999).default(0),
  challenge: explorerChallengeSchema.optional(),
  image_slot: idString.optional(),
})

/**
 * A lock on an edge. All four kinds share this shape so the taxonomy is data, not four
 * code paths in the view.
 */
const explorerLockSchema = z.object({
  kind: lockKindEnum,
  /** The abilities (and the tier of each) this lock demands. */
  requires: z.array(explorerGrantSchema).max(6).default([]),
  /** COMBINATORICS: when true the abilities must be applied in the listed ORDER, one
   *  `use` per step; a wrong step resets the progress. */
  sequence: z.boolean().default(false),
  /** `soft` only: solved micro-challenges that substitute for the ability. */
  skill_required: z.number().int().min(1).max(20).optional(),
  /** `temporal` only: a node that must already have been visited. */
  requires_visited: idString.optional(),
  /** `temporal` only: an item that must already be held. */
  requires_item: idString.optional(),
  /** The one-line, kid-readable "what would open this". */
  hint_md: noteMd.optional(),
})

const explorerEdgeSchema = z.object({
  id: idString,
  from: idString,
  to: idString,
  /**
   * A SHORTCUT that only opens from the other side: traversal runs `from` → `to` only,
   * and its lock may be operated ONLY while standing at `to`. That is the metroidvania
   * semantics exactly — you reach the far side the long way, open the shortcut, and the
   * return trip is cheap — and it is why `solveExplorerWorld()` never lets a one-way
   * locked edge extend reachability: a shortcut is a convenience, never a gate.
   */
  one_way: z.boolean().default(false),
  lock: explorerLockSchema.nullable().default(null),
})

export type ExplorerAbility = z.infer<typeof explorerAbilitySchema>
export type ExplorerNode = z.infer<typeof explorerNodeSchema>
export type ExplorerEdge = z.infer<typeof explorerEdgeSchema>
export type ExplorerLock = z.infer<typeof explorerLockSchema>
export type ExplorerChallenge = z.infer<typeof explorerChallengeSchema>

export const explorerContentSchema = z
  .object({
    items: z.array(gameItemSchema).min(1).max(80),
    categories: z.array(gameCategorySchema).max(8).optional(),
    interludes: z.array(gameInterludeSchema).max(4).optional(),
    feedback: gameFeedbackSchema,
    abilities: z.array(explorerAbilitySchema).min(1).max(12),
    nodes: z.array(explorerNodeSchema).min(3).max(64),
    edges: z.array(explorerEdgeSchema).min(2).max(160),
    start_node: idString,
    goal_node: idString,
  })
  .superRefine((content, ctx) => {
    const itemIds = content.items.map((item) => item.id)
    const abilityIds = content.abilities.map((ability) => ability.id)
    const nodeIds = content.nodes.map((node) => node.id)

    const unique = (ids: readonly string[]) => new Set(ids).size === ids.length
    if (!unique(abilityIds)) {
      ctx.addIssue({ code: 'custom', path: ['abilities'], message: 'ability ids must be unique' })
    }
    if (!unique(nodeIds)) {
      ctx.addIssue({ code: 'custom', path: ['nodes'], message: 'node ids must be unique' })
    }
    const edgeIds = content.edges.map((edge) => edge.id)
    if (!unique(edgeIds)) {
      ctx.addIssue({ code: 'custom', path: ['edges'], message: 'edge ids must be unique' })
    }

    for (const [index, ability] of content.abilities.entries()) {
      if (!itemIds.includes(ability.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['abilities', index, 'id'],
          message: 'an ability must reference a declared item id (its label, icon and sprite)',
        })
      }
    }

    const requireAbility = (ref: { ability: string; tier: number }, path: (string | number)[]) => {
      const declared = content.abilities.find((candidate) => candidate.id === ref.ability)
      if (declared === undefined) {
        ctx.addIssue({ code: 'custom', path, message: `unknown ability "${ref.ability}"` })
        return
      }
      if (ref.tier > declared.max_tier) {
        ctx.addIssue({
          code: 'custom',
          path,
          message: `tier ${ref.tier} exceeds the ability's max_tier ${declared.max_tier}`,
        })
      }
    }

    for (const [index, node] of content.nodes.entries()) {
      const path = (field: string) => ['nodes', index, field]
      if (node.grants !== undefined) requireAbility(node.grants, path('grants'))
      if (node.fragment_for !== undefined && !abilityIds.includes(node.fragment_for)) {
        ctx.addIssue({ code: 'custom', path: path('fragment_for'), message: 'unknown ability' })
      }
      if (node.collectible !== undefined && !itemIds.includes(node.collectible)) {
        ctx.addIssue({ code: 'custom', path: path('collectible'), message: 'unknown item id' })
      }
      // Kind-specific obligations: an acquisition site that grants nothing is not a
      // harder site, it is a broken one.
      if (node.kind === 'shop') {
        if (node.price === undefined || node.grants === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: path('price'),
            message: 'a shop node needs both a price and the ability it grants',
          })
        }
      }
      if (node.kind === 'fragment' && node.fragment_for === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: path('fragment_for'),
          message: 'a fragment node must name the ability it advances',
        })
      }
      if (node.kind === 'tutorial') {
        if (node.teaches_family === undefined || node.grants === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: path('teaches_family'),
            message: 'a tutorial room must name its family and grant that ability',
          })
        }
        if (node.challenge !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: path('challenge'),
            message: 'a tutorial room is SAFE: it teaches, it does not test',
          })
        }
      }
      if (node.kind === 'boss' && node.challenge === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: path('challenge'),
          message: 'a boss node must ask something — it is the main-path acquisition site',
        })
      }
    }

    for (const [index, edge] of content.edges.entries()) {
      const path = (field: string) => ['edges', index, field]
      if (!nodeIds.includes(edge.from)) {
        ctx.addIssue({ code: 'custom', path: path('from'), message: 'unknown node id' })
      }
      if (!nodeIds.includes(edge.to)) {
        ctx.addIssue({ code: 'custom', path: path('to'), message: 'unknown node id' })
      }
      if (edge.from === edge.to) {
        ctx.addIssue({ code: 'custom', path: path('to'), message: 'an edge cannot loop on itself' })
      }

      const lock = edge.lock
      if (lock === null) continue
      for (const [refIndex, ref] of lock.requires.entries()) {
        requireAbility(ref, ['edges', index, 'lock', 'requires', refIndex])
      }
      const lockPath = ['edges', index, 'lock']
      if (lock.kind === 'hard') {
        if (lock.requires.length !== 1) {
          ctx.addIssue({
            code: 'custom',
            path: lockPath,
            message: 'a hard lock demands exactly ONE ability — no alternative is the point',
          })
        }
        if (lock.skill_required !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: lockPath,
            message: 'a hard lock cannot be skilled past; that is a soft lock',
          })
        }
      }
      if (lock.kind === 'soft' && lock.requires.length < 1) {
        ctx.addIssue({
          code: 'custom',
          path: lockPath,
          message: 'a soft lock still names the ability it prefers',
        })
      }
      if (lock.kind === 'compound') {
        const enough = lock.requires.length >= 2 || lock.requires.some((ref) => ref.tier >= 2)
        if (!enough) {
          ctx.addIssue({
            code: 'custom',
            path: lockPath,
            message: 'a compound lock is A and B, or A at tier >= 2',
          })
        }
      }
      if (lock.kind === 'temporal') {
        if (lock.requires_visited === undefined && lock.requires_item === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: lockPath,
            message: 'a temporal lock needs a prior state: requires_visited or requires_item',
          })
        }
      }
      if (lock.requires_visited !== undefined && !nodeIds.includes(lock.requires_visited)) {
        ctx.addIssue({ code: 'custom', path: lockPath, message: 'requires_visited: unknown node' })
      }
      if (lock.requires_item !== undefined && !itemIds.includes(lock.requires_item)) {
        ctx.addIssue({ code: 'custom', path: lockPath, message: 'requires_item: unknown item' })
      }
      if (lock.sequence && lock.requires.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: lockPath,
          message: 'a sequence lock needs at least two abilities to put in order',
        })
      }
    }

    if (!nodeIds.includes(content.start_node)) {
      ctx.addIssue({ code: 'custom', path: ['start_node'], message: 'unknown node id' })
    }
    if (!nodeIds.includes(content.goal_node)) {
      ctx.addIssue({ code: 'custom', path: ['goal_node'], message: 'unknown node id' })
    }
    if (content.start_node === content.goal_node) {
      ctx.addIssue({
        code: 'custom',
        path: ['goal_node'],
        message: 'the goal cannot be the start — there would be nothing to explore',
      })
    }
  })

export type ExplorerContent = z.infer<typeof explorerContentSchema>
