// PARITY COPY of `frontend/src/game-engine/core/schema.ts` — DO NOT EDIT BY HAND,
// except for the one documented divergence below.
//
// THE DIVERGENCE (the whole reason this file is not a verbatim copy):
// the frontend's `parseGameDocument` is ASYNC because the browser must not download
// eight mechanics to play one — it `await loadMechanic(id)`s exactly the chunk the
// document names. Arcade has no bundle and no code-splitting concern: it holds every
// mechanic eagerly in `contract/registry.ts`, and the `author → gate → simulate`
// stages validate documents inside a synchronous pipeline step. So this copy replaces
// that ONE function with `parseGameDocumentSync`, which differs by exactly three
// textual substitutions and nothing else:
//
//   export async function parseGameDocument(  ->  export function parseGameDocumentSync(
//   Promise<GameDocumentParse>                ->  GameDocumentParse
//   await loadMechanic(                       ->  getMechanic(
//
// `contract:check` APPLIES those three substitutions to the frontend original and then
// diffs the normalized bodies, so the composition logic (envelope parse -> per-mechanic
// config/content parse -> cross-field checks -> document assembly) cannot drift here
// even though the signature legitimately differs. Every other symbol in this file is
// diffed symbol-by-symbol against the frontend original, non-exported helpers included
// — `crossFieldIssues` in particular, which is where the sprite-slot, category and
// duplicate-id rules live.
//
// WHY THE GATE EXISTS AT ALL: Zod strips unknown keys by default, so a field the
// frontend adds and this copy lacks is not rejected on the way in — it is silently
// DELETED. The winnability gate would then bot-play a document missing exactly the
// field the mechanic needed, and Arcade would publish a game the real player cannot
// win. Nothing logs an error anywhere. (coursegen shipped lessons with no images to
// this exact class of drift; see coursegen/AGENTS.md.)
//
// Original header follows.
//
// The composed GameDocument contract — GAME_ENGINE.md §3 (document), §7 (registry).
//
// TWO LAYERS, on purpose. A single eagerly-composed discriminated union over all eight
// mechanics would import every mechanic the moment anything imported the schema, which
// defeats the per-mechanic code-splitting the registry exists to provide (§7). So:
//
//   LAYER 1  `gameDocumentEnvelopeSchema` — everything the core knows: meta, skin,
//            scoring, adaptive and content's SHARED fields. `config` stays `unknown`
//            here and per-mechanic content extras pass through unchecked, because core
//            carries zero mechanic knowledge by construction.
//   LAYER 2  `parseGameDocumentSync()` — registry-driven: it looks up the one mechanic
//            the document names, parses `config`/`content` with that slice's schemas,
//            then runs the cross-field checks that need both the document and the slice
//            (sprite slots, category references, id uniqueness).

import { z } from 'zod'

import { getMechanic } from '../registry.js'
import { CHARACTER_IDS } from './characters.js'

import {
  gameAdaptiveSchema,
  gameCategorySchema,
  gameFeedbackSchema,
  gameInterludeSchema,
  gameItemSchema,
  gameMetaSchema,
  gameScoringSchema,
  gameSkinSchema,
} from './schemaBase.js'
import type { GameContent, GameDocument, MechanicConfig } from './types.js'

// ---- Layer 1: the envelope -----------------------------------------------------

/**
 * The shared content shape. `looseObject` because per-mechanic extras (runner's
 * `roles`, for example) are declared and validated by the slice's `contentSchema` in
 * layer 2 — stripping them here would delete the very fields layer 2 needs to see.
 */
export const gameContentEnvelopeSchema = z.looseObject({
  items: z.array(gameItemSchema).min(1).max(80),
  categories: z.array(gameCategorySchema).max(8).optional(),
  interludes: z.array(gameInterludeSchema).max(4).optional(),
  feedback: gameFeedbackSchema,
})

/**
 * Everything except the mechanic-specific internals. `config` is `z.unknown()`: the
 * core cannot know its shape, and a document whose `config` is missing or malformed is
 * rejected by the slice's `configSchema` in layer 2 with a mechanic-accurate message
 * rather than a generic one here.
 */
export const gameDocumentEnvelopeSchema = z.object({
  schema_version: z.literal(1),
  meta: gameMetaSchema,
  skin: gameSkinSchema,
  config: z.unknown(),
  content: gameContentEnvelopeSchema,
  scoring: gameScoringSchema,
  adaptive: gameAdaptiveSchema.optional(),
})

export type GameDocumentEnvelope = z.infer<typeof gameDocumentEnvelopeSchema>

// ---- Issue formatting ----------------------------------------------------------

/** Matches the formatting already used across the repo (`coursegen/src/pipeline/
 *  correctiveRetry.ts`): `path.to.field: message`, `(root)` when the path is empty. */
interface FormattableIssue {
  readonly path: readonly PropertyKey[]
  readonly message: string
}

function formatIssues(issues: readonly FormattableIssue[], prefix?: string): string[] {
  const head = prefix === undefined ? [] : [prefix]
  return issues.map((issue) => {
    const path = [...head, ...issue.path.map(String)].join('.')
    return `${path || '(root)'}: ${issue.message}`
  })
}

// ---- Layer 2: the registry-driven parse ----------------------------------------

/**
 * The stable prefix of the "this client does not know this mechanic" issue. Callers
 * match on it to render the i18n unsupported-game card instead of a validation error
 * list — the two are different products: one is "your app is older than this content"
 * (friendly, no XP, no crash), the other is "this content is broken" (a content bug).
 */
export const UNSUPPORTED_MECHANIC = 'meta.mechanic: unsupported mechanic'

/** True when a failed parse failed ONLY because the mechanic is unknown to this build. */
export function isUnsupportedMechanic(issues: readonly string[]): boolean {
  return issues.length === 1 && (issues[0] ?? '').startsWith(UNSUPPORTED_MECHANIC)
}

export type GameDocumentParse =
  | { ok: true; document: GameDocument }
  | { ok: false; issues: string[] }

/** `meta.mechanic` read defensively from a not-yet-validated payload, so that an id
 *  this build has never heard of is reported as UNSUPPORTED rather than as an enum
 *  violation buried in a list of Zod issues. */
function peekMechanic(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { meta } = raw as { meta?: unknown }
  if (typeof meta !== 'object' || meta === null) return null
  const { mechanic } = meta as { mechanic?: unknown }
  return typeof mechanic === 'string' ? mechanic : null
}

/**
 * Validate a raw payload into a `GameDocument` against the one mechanic it names.
 *
 * The SYNCHRONOUS twin of the frontend's `parseGameDocument` (see the divergence note
 * at the top of this file): identical logic, `getMechanic` in place of the awaited
 * `loadMechanic`. Never throws — a document that fails validation is a content bug the
 * `gate` stage must report back to the author, and an unknown mechanic means this
 * release of Arcade cannot bot-play it, which is a refusal to publish rather than a
 * crash.
 */
export function parseGameDocumentSync(raw: unknown): GameDocumentParse {
  const mechanicId = peekMechanic(raw)
  const slice = mechanicId === null ? null : getMechanic(mechanicId)
  if (slice === null) {
    // Both "not a declared id" and "declared but not implemented in this build" land
    // here, and both mean the same thing to a player: show the unsupported card.
    return { ok: false, issues: [`${UNSUPPORTED_MECHANIC} "${mechanicId ?? ''}"`] }
  }

  const envelope = gameDocumentEnvelopeSchema.safeParse(raw)
  if (!envelope.success) return { ok: false, issues: formatIssues(envelope.error.issues) }
  const { meta, skin, scoring, adaptive, content } = envelope.data

  const issues: string[] = []
  const config = slice.configSchema.safeParse(envelope.data.config)
  if (!config.success) issues.push(...formatIssues(config.error.issues, 'config'))
  const mechanicContent = slice.contentSchema.safeParse(content)
  if (!mechanicContent.success) issues.push(...formatIssues(mechanicContent.error.issues, 'content'))

  issues.push(...crossFieldIssues(envelope.data, slice.spriteSlots))

  if (issues.length > 0 || !config.success || !mechanicContent.success) {
    return { ok: false, issues }
  }

  const document: GameDocument = {
    schema_version: 1,
    meta,
    skin,
    // The slice's schemas are the authority on these two, so the document carries
    // THEIR output (defaults applied, unknown keys stripped), not the envelope's.
    config: config.data as MechanicConfig,
    content: mechanicContent.data as GameContent,
    scoring,
    ...(adaptive === undefined ? {} : { adaptive }),
  }
  return { ok: true, document }
}

/**
 * The checks that need the document AND the mechanic together, so neither the shared
 * schema nor a slice schema can make them alone.
 *
 * On `image_slot`: it must name a slot the mechanic DECLARES. It is deliberately NOT
 * required to be bound in `skin.sprites` — sprite URLs are Prism artifacts written by
 * the `illustrate` stage, which runs AFTER `author`/`gate`/`simulate`, so an
 * un-illustrated document (every fixture, every document the winnability gate sees) is
 * a valid state that falls back to the item's Material Symbols `icon`. An UNDECLARED
 * slot, by contrast, can never be bound by anything and would silently never render —
 * that is the real defect, and it is rejected outright.
 */
function crossFieldIssues(
  document: GameDocumentEnvelope,
  spriteSlots: readonly string[],
): string[] {
  const issues: string[] = []
  const { content, skin, meta, scoring } = document

  const declaredCategories = new Set((content.categories ?? []).map((category) => category.id))
  const seenItemIds = new Set<string>()
  for (const [index, item] of content.items.entries()) {
    if (seenItemIds.has(item.id)) {
      // The input log references item ids, so a duplicate makes a replay ambiguous —
      // and the replay is where the XP comes from.
      issues.push(`content.items.${index}.id: duplicate item id "${item.id}"`)
    }
    seenItemIds.add(item.id)
    if (item.category !== undefined && !declaredCategories.has(item.category)) {
      issues.push(
        `content.items.${index}.category: "${item.category}" is not a declared category id`,
      )
    }
    if (item.image_slot !== undefined && !spriteSlots.includes(item.image_slot)) {
      issues.push(
        `content.items.${index}.image_slot: "${item.image_slot}" is not a declared sprite slot of ${meta.mechanic}`,
      )
    }
  }

  for (const [index, category] of (content.categories ?? []).entries()) {
    const slot = category.image_slot
    if (slot !== undefined && !spriteSlots.includes(slot)) {
      issues.push(
        `content.categories.${index}.image_slot: "${slot}" is not a declared sprite slot of ${meta.mechanic}`,
      )
    }
  }

  // Sorted so the issue list is deterministic for a given document (object key order
  // is insertion order, and a document arrives as parsed JSON).
  for (const key of Object.keys(skin.sprites).sort()) {
    if (!spriteSlots.includes(key)) {
      issues.push(`skin.sprites.${key}: not a declared sprite slot of ${meta.mechanic}`)
    }
  }

  // The last two mirror refinements that schemaBase already applies. They are cheap
  // defence in depth, in the same spirit as core/strip.ts: the parity copies in Core
  // and gamegen compose their own meta/scoring schemas, and the document layer is the
  // one place all three paths share.
  const canonCast: readonly string[] = CHARACTER_IDS
  for (const [index, id] of (meta.cast ?? []).entries()) {
    if (!canonCast.includes(id)) {
      issues.push(`meta.cast.${index}: "${id}" is not a canon character id`)
    }
  }
  if (scoring.mode === 'cheer' && scoring.lives !== null) {
    issues.push('scoring.lives: cheer mode has no fail state, lives must be null')
  }

  return issues
}
