// Zod building blocks for the game document — GAME_ENGINE.md §3.
// Mechanic slices compose their own config/content schemas from these; the composed
// document schema (envelope + registry-driven per-mechanic parse + the cross-field
// checks) lives in core/schema.ts.
//
// No React and no mechanic knowledge here, on purpose: the backend/gamegen parity
// copies import this module as-is.

import { z } from 'zod'
import { CHARACTER_IDS } from './characters.js'
import {
  GAME_BGM,
  GAME_INTERLUDE_KINDS,
  GAME_ITEM_TIERS,
  GAME_LOCALES,
  GAME_PALETTES,
  GAME_SCORING_MODES,
  GAME_SFX,
  GAME_TIERS,
  MECHANIC_IDS,
} from './types.js'

// ---- Primitives ---------------------------------------------------------------

/** Any id inside a document (items, categories, interludes, sprite slots). <=48
 *  because the input log references ids and Core replays them. */
export const idString = z.string().min(1).max(48)

/** kebab-case document slug — the idempotency key of a publish upsert. */
export const slugString = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(64)

export const titleText = z.string().min(1).max(120)

/** "<adventure>/<saga>/<topic>". The FK `games.topic_id` is the truth; this is the
 *  human-readable echo, so the SHAPE is validated, not the existence (which
 *  `catalog:check` proves against the course catalog). */
export const topicPath = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/)

/** MarkdownLite caps (§3). Short on purpose: these render inside a game canvas or a
 *  single kid-readable card, not a document. */
export const labelMd = z.string().min(1).max(80)
export const recapMd = z.string().min(1).max(400)
export const resultsMd = z.string().min(1).max(300)
export const feedbackMd = z.string().min(1).max(200)
export const promptMd = z.string().min(1).max(200)
/** Rationale / description / misconception — one explanatory sentence or two. */
export const noteMd = z.string().min(1).max(200)

/** Material Symbols icon name — the fallback when an item has no sprite. */
export const iconName = z.string().regex(/^[a-z0-9_]+$/)

/** A Prism → Depot media URL. */
export const imageUrl = z.string().url()

// ---- Closed-set enums ---------------------------------------------------------

export const localeEnum = z.enum(GAME_LOCALES)
export const mechanicEnum = z.enum(MECHANIC_IDS)
/** Numeric literals, so `z.enum` (strings only) does not apply. */
export const tierEnum = z.literal(GAME_TIERS)
export const itemTierEnum = z.literal(GAME_ITEM_TIERS)
export const paletteEnum = z.enum(GAME_PALETTES)
export const sfxEnum = z.enum(GAME_SFX)
export const bgmEnum = z.enum(GAME_BGM)
export const scoringModeEnum = z.enum(GAME_SCORING_MODES)
export const interludeKindEnum = z.enum(GAME_INTERLUDE_KINDS)
/** The canon four. Cast is validated against the character rig's own closed set. */
export const characterIdEnum = z.enum(CHARACTER_IDS)

// ---- Shared object schemas ----------------------------------------------------

export const gameItemSchema = z.object({
  id: idString,
  label_md: labelMd,
  /** Must reference a declared category id — checked at the document layer, where
   *  the category list is known. */
  category: idString.optional(),
  value: z.number().optional(),
  image_slot: idString.optional(),
  icon: iconName.optional(),
  misconception_md: noteMd.optional(),
  tier: itemTierEnum.optional(),
  /** Numeric only, so the deterministic gates can re-execute the arithmetic. */
  props: z.record(z.string(), z.number()).optional(),
})

export const gameCategorySchema = z.object({
  id: idString,
  label_md: labelMd,
  description_md: noteMd.optional(),
  image_slot: idString.optional(),
})

export const gameInterludeSchema = z.object({
  id: idString,
  after_round: z.number().int().min(1).max(20),
  kind: interludeKindEnum,
  prompt_md: promptMd,
  options: z
    .array(
      z.object({
        id: idString,
        label_md: labelMd,
        correct: z.boolean(),
        rationale_md: noteMd.optional(),
      }),
    )
    .min(2)
    .max(6),
})

export const gameFeedbackSchema = z.object({
  correct_md: z.array(feedbackMd).min(1).max(6),
  /** Outcome-neutral, never punishing — no red "WRONG" in a kid product. */
  incorrect_md: z.array(feedbackMd).min(1).max(6),
  results_md: resultsMd,
})

export const gameMetaSchema = z.object({
  slug: slugString,
  title: titleText,
  locale: localeEnum,
  mechanic: mechanicEnum,
  concept: z.object({ topic_path: topicPath, recap_md: recapMd }),
  tier: tierEnum,
  estimated_minutes: z.number().int().min(1).max(10),
  cast: z.array(characterIdEnum).min(1).max(4).optional(),
})

export const gameSkinSchema = z.object({
  palette: paletteEnum,
  background_url: imageUrl.optional(),
  /** Slot id → media URL. Only the SHAPE is validated here; that every key is a slot
   *  the mechanic actually declares is a per-mechanic check in core/schema.ts. */
  sprites: z.record(z.string(), imageUrl).default({}),
  /** Engine event name → closed sfx vocabulary name. */
  sfx: z.record(z.string(), sfxEnum).optional(),
  bgm: bgmEnum.optional(),
})

/** The cheer-mode rule lives HERE rather than in core/schema.ts so that every
 *  consumer of the scoring shape — the frontend document parse, the gamegen `gate`
 *  stage and the Core parity copy — enforces it from one place. */
export const gameScoringSchema = z
  .object({
    mode: scoringModeEnum,
    xp_max: z.number().int().min(5).max(50),
    /** The score the perfect bot must reach and the random bot must not. */
    pass_score: z.number().int().min(0).max(100),
    lives: z.number().int().min(1).max(9).nullable().default(null),
    target: z.number().min(0).optional(),
  })
  .refine(
    (scoring) => scoring.mode !== 'cheer' || scoring.lives === null,
    'cheer mode has no fail state: scoring.lives must be null',
  )

export const gameAdaptiveSchema = z.object({
  enabled: z.boolean(),
  ease_after_failures: z.number().int().min(1).max(5),
  ease_factor: z.number().min(0.5).max(1),
  /** Literal true: assistance is offered, never imposed. */
  assist_toggleable: z.literal(true),
})

/** SERVER-ONLY sidecar (`game_documents.validation`). Never parsed from, or emitted
 *  to, a client payload — core/strip.ts removes it before any serve. */
export const gameValidationSchema = z.object({
  max_score: z.number().min(0),
  min_duration_seconds: z.number().int().min(0),
  /** Cap on input-log length: the anti-cheat envelope replayGame() enforces. */
  max_events: z.number().int().min(1).max(20000),
  item_values: z.record(z.string(), z.number()).optional(),
  notes: z.string().max(600).optional(),
})
