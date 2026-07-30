// PARITY COPY of `frontend/src/game-engine/core/types.ts` — DO NOT EDIT BY HAND.
// Arcade's `simulate` stage is the WINNABILITY GATE: it runs the mechanic's real
// simulator headless (perfect bot must reach `scoring.pass_score`, random bot must
// not) before a generated document can be published. There are no npm workspaces
// (CLAUDE.md §1.2), so the pure simulation modules are copied here instead of
// imported. `npm run contract:check` diffs every copy against its frontend original;
// change the frontend file first, then re-copy (adjusting ONLY the import specifiers
// to NodeNext `.js` form).
//
// This file is a DELIBERATELY TRIMMED subset: the two React/rendering symbols
// `MechanicViewProps` and `MechanicSlice` are omitted, because React must never enter
// a generation service. The checker therefore compares core/types.ts SYMBOL BY SYMBOL
// (it derives the list from the frontend file and subtracts exactly those two, so a
// symbol added upstream and not copied here fails the gate). `CharacterId` comes from
// the local ./characters.js parity copy rather than the character rig.
//
// Original header follows.
//
// Game Engine contract types — GAME_ENGINE.md §3 (document), §5 (determinism &
// replay), §7 (slice anatomy). The per-mechanic `config`/`content` shapes live in
// mechanics/<m>/schema.ts (Zod-inferred): core carries ZERO mechanic knowledge, so
// nothing in this file ever grows a per-mechanic branch.

import type { z } from 'zod'
import type { CharacterId } from './characters.js'

/** The single fixed simulation tick, in milliseconds. Every simulator advances in
 *  whole integer ticks and never sees a delta-time float: rewards are DERIVED by
 *  replaying the player's input log on the server (§5), and a frame-rate-dependent
 *  simulation cannot be replayed at all — v1's delta-time loops were unreplayable
 *  by construction. An integer tick also makes pause exact rather than approximate. */
export const TICK_MS = 50

// ---- Closed sets -------------------------------------------------------------

/** The 8 hand-written mechanics. CLOSED — grows only through GAME_ENGINE.md §12. */
export const MECHANIC_IDS = [
  'sorter',
  'launcher',
  'runner',
  'stacker',
  'autobattler',
  'explorer',
  'defender',
  'flyer',
] as const
export type MechanicId = (typeof MECHANIC_IDS)[number]

export const GAME_LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const
export type GameLocale = (typeof GAME_LOCALES)[number]

/** Piaget bands: 1 = 6-7, 2 = 8-10, 3 = 10-12. */
export const GAME_TIERS = [1, 2, 3] as const
export type GameTier = (typeof GAME_TIERS)[number]

/** Per-ITEM difficulty tier used by spawn tables — a different, wider scale than
 *  the document's audience tier. */
export const GAME_ITEM_TIERS = [1, 2, 3, 4] as const
export type GameItemTier = (typeof GAME_ITEM_TIERS)[number]

/** `cheer` = no fail state (tier-1 default, lives === null); `arcade` = lives is a number. */
export const GAME_SCORING_MODES = ['cheer', 'arcade'] as const
export type GameScoringMode = (typeof GAME_SCORING_MODES)[number]

/** Skin palettes — CLOSED. Each maps to existing DESIGN.md tokens, never raw hex. */
export const GAME_PALETTES = [
  'navy-papaya',
  'forest-pear',
  'ocean-blue',
  'sunset-papaya',
  'violet-night',
  'sand-clay',
] as const
export type GamePaletteId = (typeof GAME_PALETTES)[number]

/** The 9 sound files that exist today in `frontend/public/sfx/`. */
export const EXISTING_SFX = [
  'celebration',
  'correct',
  'drop',
  'flip',
  'hint',
  'match',
  'perfect',
  'streak',
  'tryagain',
] as const

/** New game vocabulary. Manifest names only: NO audio binary exists for these yet,
 *  so core/audio.ts resolves each to the closest existing file or to silence. */
export const GAME_SFX_NEW = [
  'launch',
  'impact',
  'explode',
  'build',
  'collect',
  'powerup',
  'whoosh',
  'alarm',
  'engine',
] as const

/** The closed manifest vocabulary: a generated document may only name these sounds. */
export const GAME_SFX = [...EXISTING_SFX, ...GAME_SFX_NEW] as const
export type GameSfxName = (typeof GAME_SFX)[number]

/** Closed BGM loop ids. No loop asset ships in v1 — the manager stays inert. */
export const GAME_BGM = ['arcade-calm', 'arcade-drive', 'arcade-tense', 'arcade-triumph'] as const
export type GameBgmId = (typeof GAME_BGM)[number]

export const GAME_INTERLUDE_KINDS = ['pick_one', 'true_false', 'tap_all'] as const
export type GameInterludeKind = (typeof GAME_INTERLUDE_KINDS)[number]

// ---- The document ------------------------------------------------------------

export interface GameConcept {
  /** "<adventure>/<saga>/<topic>" — the human-readable echo of `games.topic_id`,
   *  which is the truth. Binding is DATA, never code. */
  topic_path: string
  /** <=400 MarkdownLite: "what you just learned", shown in the pre-play recap card. */
  recap_md: string
}

export interface GameMeta {
  /** kebab-case, <=64. Publish upserts by (topic_id, slug) — this is a re-run's idempotency key. */
  slug: string
  title: string
  /** Exactly one locale per document; Arcade emits three. */
  locale: GameLocale
  /** THE discriminator: it selects the mechanic slice that validates config/content. */
  mechanic: MechanicId
  concept: GameConcept
  tier: GameTier
  estimated_minutes: number
  /** Subset of the canon four. The rig's appearance is non-negotiable — games reuse
   *  CharacterActor and never re-draw. */
  cast?: CharacterId[]
}

export interface GameSkin {
  palette: GamePaletteId
  /** Prism → Depot URL. */
  background_url?: string
  /** Sprite SLOT id → Depot URL. Keys MUST be a subset of the mechanic's declared
   *  <M>_SPRITE_SLOTS: an undeclared key is a schema error, not a warning, because
   *  it would silently never render. */
  sprites: Record<string, string>
  /** Engine event name → closed sfx name. */
  sfx?: Record<string, GameSfxName>
  bgm?: GameBgmId
}

/** The per-mechanic config object. Deliberately opaque at the core layer: it is
 *  validated by the slice's `configSchema` and narrowed inside the slice with the
 *  schema's inferred type (`raw.config as SorterConfig`). Declare mechanic config
 *  and content types as `z.infer<>` aliases so that narrowing stays a plain cast. */
export type MechanicConfig = Record<string, unknown>

export interface GameItem {
  /** <=48, unique within the document — the input log references ids, so a duplicate
   *  makes a replay ambiguous. */
  id: string
  /** <=80 MarkdownLite — short, literal, TTS-safe. */
  label_md: string
  /** When present MUST reference a GameCategory.id. */
  category?: string
  /** Money/price/weight, per mechanic. */
  value?: number
  /** Key into skin.sprites. */
  image_slot?: string
  /** Material Symbols name — the fallback when no sprite is bound. */
  icon?: string
  /** WHY a trap/wrong item is wrong. A trap without a teaching reason is invalid output. */
  misconception_md?: string
  tier?: GameItemTier
  /** Numeric ONLY, so the deterministic gates can re-verify the arithmetic. */
  props?: Record<string, number>
}

export interface GameCategory {
  id: string
  label_md: string
  description_md?: string
  image_slot?: string
}

export interface GameInterludeOption {
  id: string
  label_md: string
  correct: boolean
  rationale_md?: string
}

export interface GameInterlude {
  id: string
  after_round: number
  kind: GameInterludeKind
  prompt_md: string
  options: GameInterludeOption[]
}

export interface GameFeedback {
  /** 1..6, rotating. */
  correct_md: string[]
  /** 1..6, rotating, outcome-neutral, NEVER punishing. */
  incorrect_md: string[]
  /** <=300. */
  results_md: string
}

/** The shared content shape. The index signature is the sanctioned escape hatch for
 *  per-mechanic content extras, which are declared and validated by the slice's
 *  `contentSchema` — core never inspects them. */
export interface GameContent {
  items: GameItem[]
  categories?: GameCategory[]
  interludes?: GameInterlude[]
  feedback: GameFeedback
  [key: string]: unknown
}

export interface GameScoring {
  mode: GameScoringMode
  xp_max: number
  /** The score the perfect bot MUST reach and the random bot MUST NOT. */
  pass_score: number
  /** null in cheer mode — enforced as a cross-field rule, not by this type alone. */
  lives?: number | null
  /** Mechanic-specific win target. */
  target?: number
}

export interface GameAdaptive {
  enabled: boolean
  ease_after_failures: number
  ease_factor: number
  /** Literal true: help is offered, never imposed — a child who declines keeps agency. */
  assist_toggleable: true
}

export interface GameDocument {
  schema_version: 1
  meta: GameMeta
  skin: GameSkin
  config: MechanicConfig
  content: GameContent
  scoring: GameScoring
  adaptive?: GameAdaptive
}

/** Server-only sidecar, stored in `game_documents.validation`. NEVER part of the
 *  client document — core/strip.ts `stripValidation()` is the only sanctioned
 *  stripper. It is bounds, not answers: what leaks if it slips is the reward ceiling
 *  and the anti-cheat envelope, i.e. exactly what forging a maximal log requires. */
export interface GameValidation {
  max_score: number
  min_duration_seconds: number
  /** Cap on input-log length. */
  max_events: number
  item_values?: Record<string, number>
  notes?: string
}

// ---- Determinism contract (GAME_ENGINE.md §5) --------------------------------
//
// Rewards are derived by REPLAYING the player's input log server-side, so every
// simulator must be bit-identical across the browser's V8 and Node. These rules are
// not style: they are the integrity of the XP economy. Read them before writing a
// `simulate.ts`.
//
// 1. PURE. No React, no DOM, no `Date.now()`, no `Math.random()`, no I/O, no mutation
//    of inputs. `step()` returns a NEW state (structural sharing is fine).
// 2. INTEGER TICKS. Fixed `TICK_MS = 50`. Never a delta-time float.
// 3. ALLOWED ARITHMETIC ONLY: `+ - * /`, `Math.sqrt`, `Math.abs`, `Math.min`,
//    `Math.max`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.trunc`, `Math.sign`.
//    These are exactly specified by IEEE-754 / ECMAScript, so every engine agrees on
//    the last bit.
// 4. BANNED: `Math.sin/cos/tan/atan/atan2/exp/log/pow/hypot/cbrt` and `**` with a
//    non-integer exponent — ECMAScript leaves the transcendentals
//    implementation-defined, and one wrong bit in a projectile arc is a rejected
//    reward for an honest child. Use core/mathd.ts: `dsin`, `dcos`, `datan2`, `dpow`.
// 5. RANDOMNESS comes only from the injected seeded PRNG (core/rng.ts, mulberry32),
//    seeded from a number derived from the run id. Never reach for global randomness.
// 6. DETERMINISTIC ITERATION ORDER. Arrays, always. Never `Set`/`Map` iteration whose
//    insertion order came from something nondeterministic, and never `Object.keys` on
//    a dynamically-keyed object without sorting.

/** One player input, stamped with the tick it landed on. The ONLY thing the server
 *  trusts; raw logs are replayed in memory and never persisted (§11). */
export interface GameInputEvent {
  tick: number
  action: string
  slot?: string
  x?: number
  y?: number
  n?: number
}

/** Cheap read for the HUD and the bots — never the reward source. */
export interface SimSnapshot {
  finished: boolean
  score: number
  lives: number | null
  round: number
}

export interface SimResult {
  /** Normalized 0..100 by the simulator. */
  score: number
  finished: boolean
  /** Derived aggregates only (counts, accuracy, rounds reached) — this is what
   *  `game_attempts.stats` may hold. */
  stats: Record<string, number>
}

/** Everything a simulator may read at init. No wall clock, no document metadata,
 *  no locale: a simulation that could branch on any of those would not replay. */
export interface SimInit {
  config: MechanicConfig
  content: GameContent
  scoring: GameScoring
  seed: number
}

/** The seeded PRNG contract (implemented by core/rng.ts, mulberry32). Deliberately
 *  minimal: two calls, both deterministic for a given seed. */
export type Rng = {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number
}

/** A headless player used by the §9 winnability gate: `perfect` MUST reach
 *  `scoring.pass_score`, `random` MUST NOT. */
export type GameBot<S> = (state: S, tick: number, rng: Rng) => GameInputEvent[]

/** Declared with METHOD syntax on purpose: it makes the state parameter bivariant,
 *  which is what lets a concrete `GameBots<SorterState>` be held as the erased
 *  `GameBots<unknown>` that gamegen's bot table and runBot() take. */
export interface GameBots<S> {
  perfect(state: S, tick: number, rng: Rng): GameInputEvent[]
  random(state: S, tick: number, rng: Rng): GameInputEvent[]
}

/**
 * A simulator is BOT-LESS, and that is the point rather than an omission.
 *
 * `bots.perfect` used to live here, so every consumer of a `Simulator` — including
 * `register.ts`, which is what the browser lazily imports to play — dragged an optimal
 * headless player into the mechanic's shipped chunk. A perfect log for these mechanics
 * is 4-61 events long: anyone could lift the function out of the emitted JS, run it
 * against the document the API already handed them, and POST a maximal input log
 * without playing a single tick. Rewards are replay-derived precisely so the client
 * cannot assert a score, and shipping the optimal player defeats that.
 *
 * The bots now live in each mechanic's `bots.ts`, imported ONLY by gamegen's `simulate`
 * winnability gate and by the test suites — never by anything on the client import
 * graph. Keeping them off this interface is what makes "no bots in the browser" the
 * default instead of a rule someone has to remember.
 */
export interface Simulator<S = unknown> {
  readonly mechanic: MechanicId
  /** Valid `action` values — replayGame() rejects a log naming anything else. */
  readonly actions: readonly string[]
  init(input: SimInit): S
  step(state: S, tick: number, events: readonly GameInputEvent[]): S
  snapshot(state: S): SimSnapshot
  result(state: S): SimResult
}

// ---- Slice composition (GAME_ENGINE.md §7) -----------------------------------
//
// `MechanicViewProps` and `MechanicSlice` are intentionally NOT copied: both are
// rendering contracts (the second holds a `ComponentType`), and Core never renders a
// game. See this file's header for how the parity gate handles the omission.

/** The React-free subset of a slice. Backend/gamegen parity copies build their
 *  SYNCHRONOUS registry over this, so simulate.ts and schema.ts must stay free of
 *  any React import. */
export interface MechanicSimSlice {
  configSchema: z.ZodType
  contentSchema: z.ZodType
  /** State-erased on purpose; the slice's own simulator is `Simulator<State>`. */
  simulator: Simulator<unknown>
  /** The sprite slot ids this mechanic declares — every skin.sprites key must be one. */
  spriteSlots: readonly string[]
}
