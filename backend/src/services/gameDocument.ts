import { z } from 'zod';
import {
  gameAdaptiveSchema,
  gameCategorySchema,
  gameFeedbackSchema,
  gameInterludeSchema,
  gameItemSchema,
  gameMetaSchema,
  gameScoringSchema,
  gameSkinSchema,
  gameValidationSchema,
} from '../game-contract/core/schemaBase.js';
import { TICK_MS, type GameContent, type GameDocument, type GameValidation, type MechanicConfig } from '../game-contract/core/types.js';
import { DEFAULT_MAX_EVENTS_PER_TICK } from '../game-contract/core/replay.js';
import { getMechanic } from '../game-contract/registry.js';

/*
 * Pure helpers around a `game_documents` row — locale selection, the sidecar
 * stripper, the SYNCHRONOUS document parse and the tick budget. No I/O here
 * (routes/games.ts fetches rows via services/gameData.ts) so every rule below
 * stays unit-testable with plain fixtures, exactly like services/lessonDocument.ts.
 *
 * THE PARSE IS THE REWARD PATH. Core re-derives a game's score by replaying the
 * player's input log through the same simulator the browser ran, and a simulator
 * reads `config`/`content` — so the server must hand it BYTE-FOR-BYTE what the
 * client handed it, or the two replays diverge and an honest child's run is
 * refused. The frontend's `core/schema.ts` `parseGameDocument()` feeds the
 * simulator the SLICE SCHEMAS' OUTPUT (defaults applied, unknown keys stripped),
 * not the raw JSON, so `parseStoredGameDocument()` below reproduces that two-step
 * — envelope first, then the mechanic's own schemas — deliberately and verbatim.
 * The only differences are that this one is synchronous (Core has no code
 * splitting, GAME_ENGINE.md §7) and that it skips the client's cross-field
 * content-quality checks, which cannot change what the simulator computes.
 */

type Json = Record<string, unknown>;

/**
 * Caller's profile locale → es-MX (the authoring locale) → whatever's there.
 * The same precedence as `pickLessonLocale` (services/lessonDocument.ts) and
 * deliberately the same one-line rule; it is generic over `{ locale }` because
 * `pickLessonLocale` is typed to `LessonDocumentRow` and a game document row
 * carries no `lesson_id`/`answer_keys`/`audio`.
 */
export function pickGameLocale<T extends { locale: string }>(rows: readonly T[], callerLocale: string | null | undefined): T | null {
  if (rows.length === 0) return null;
  const byLocale = new Map(rows.map((r) => [r.locale, r]));
  if (callerLocale) {
    const exact = byLocale.get(callerLocale);
    if (exact) return exact;
  }
  const authoring = byLocale.get('es-MX');
  if (authoring) return authoring;
  return rows[0] ?? null;
}

/**
 * The single sanctioned sidecar stripper (GAME_ENGINE.md §3.2) — server mirror of
 * the frontend's `core/strip.ts`. `game_documents.document` is already stored
 * client-safe (the sidecar lives in its own `validation` column) and Core never
 * SELECTs that column into a client response, so this is the third layer of
 * defense, not the primary control: what leaks if the sidecar slips is the reward
 * ceiling and the anti-cheat envelope — precisely what forging a maximal run needs.
 */
export function stripValidation(document: Json): Json {
  if (!('validation' in document)) return document;
  const rest: Json = { ...document };
  delete rest.validation;
  return rest;
}

// ---- The synchronous document parse -------------------------------------------

/** Twin of the frontend's `gameContentEnvelopeSchema`. `looseObject` because the
 *  per-mechanic content extras are declared by the slice's `contentSchema` — this
 *  layer must not strip the very fields the next layer validates. */
const gameContentEnvelopeSchema = z.looseObject({
  items: z.array(gameItemSchema).min(1).max(80),
  categories: z.array(gameCategorySchema).max(8).optional(),
  interludes: z.array(gameInterludeSchema).max(4).optional(),
  feedback: gameFeedbackSchema,
});

/** Twin of the frontend's `gameDocumentEnvelopeSchema`. `config` stays unknown
 *  here: core carries zero mechanic knowledge by construction. */
const gameDocumentEnvelopeSchema = z.object({
  schema_version: z.literal(1),
  meta: gameMetaSchema,
  skin: gameSkinSchema,
  config: z.unknown(),
  content: gameContentEnvelopeSchema,
  scoring: gameScoringSchema,
  adaptive: gameAdaptiveSchema.optional(),
});

/**
 * Why a stored document cannot be replayed. Stable strings, logged verbatim and
 * safe to hand back in a `422 RESULT_REJECTED` body: each names a structural
 * property of the CONTENT and leaks nothing about the sidecar's bounds.
 */
export type DocumentRejectionReason = 'mechanic_unsupported' | 'mechanic_mismatch' | 'document_invalid';

export type StoredDocumentParse =
  | { ok: true; document: GameDocument }
  | { ok: false; reason: DocumentRejectionReason };

/**
 * Validate a stored `document` jsonb into the exact `GameDocument` the simulator
 * must see, given the mechanic recorded on the `games` row.
 *
 * `mechanic_unsupported` is NOT an error condition — it is the forward-compatible
 * refusal the registry documents: a document naming a mechanic this release cannot
 * replay grants no XP rather than trusting a number the server cannot re-derive.
 */
export function parseStoredGameDocument(raw: unknown, rowMechanic: string): StoredDocumentParse {
  const slice = getMechanic(rowMechanic);
  if (slice === null) return { ok: false, reason: 'mechanic_unsupported' };

  const envelope = gameDocumentEnvelopeSchema.safeParse(raw);
  if (!envelope.success) return { ok: false, reason: 'document_invalid' };
  const { meta, skin, scoring, adaptive, content } = envelope.data;

  // The `games.mechanic` column selects the simulator; `meta.mechanic` selects the
  // schemas the document was authored against. If publish ever let those diverge,
  // the server would validate one shape and simulate another — refuse instead.
  if (meta.mechanic !== rowMechanic) return { ok: false, reason: 'mechanic_mismatch' };

  const config = slice.configSchema.safeParse(envelope.data.config);
  if (!config.success) return { ok: false, reason: 'document_invalid' };
  const mechanicContent = slice.contentSchema.safeParse(content);
  if (!mechanicContent.success) return { ok: false, reason: 'document_invalid' };

  // The slice's schemas are the authority on these two, so the document carries
  // THEIR output — the same assertion the frontend's parseGameDocument() makes,
  // for the same reason (`z.ZodType` erases the output type to `unknown`; this is
  // a narrowing of `unknown`, never an `any`).
  const document: GameDocument = {
    schema_version: 1,
    meta,
    skin,
    config: config.data as MechanicConfig,
    content: mechanicContent.data as GameContent,
    scoring,
    ...(adaptive === undefined ? {} : { adaptive }),
  };
  return { ok: true, document };
}

// ---- The tick budget and the sidecar ------------------------------------------

const TICKS_PER_MINUTE = 60_000 / TICK_MS;

/**
 * How much longer than `estimated_minutes` a run may legitimately last before the
 * replay stops stepping. Generous ON PURPOSE: `maxTicks` is a runaway-log ceiling,
 * not a difficulty setting, and a child who plays a 3-minute game slowly must not
 * have the tail of their run silently truncated to a lower score.
 */
const MAX_TICKS_SLACK = 3;

/** 30 minutes of ticks. `estimated_minutes` is Zod-capped at 10, so this only ever
 *  binds if that cap moves. */
const MAX_TICKS_CEILING = 36_000;

/** The replay's tick ceiling for one document (GAME_ENGINE.md §5). */
export function maxTicksFor(document: GameDocument): number {
  const minutes = Math.max(1, Math.min(10, Math.round(document.meta.estimated_minutes)));
  return Math.min(MAX_TICKS_CEILING, minutes * TICKS_PER_MINUTE * MAX_TICKS_SLACK);
}

/** The sidecar's own cap, mirrored from `gameValidationSchema`. */
export const MAX_EVENTS_CEILING = 20_000;

/**
 * The server-only bounds for one document.
 *
 * A row whose `validation` is still the `'{}'` default (a game published before
 * the pipeline wrote a sidecar) falls back to the WIDEST honest envelope rather
 * than refusing the child's run: the score is derived by replay either way, and
 * every fallback below is a bound the simulator already enforces on its own
 * (`clampScore` caps at 100; `replayGame` applies its per-tick event budget). The
 * sidecar can only ever TIGHTEN this, so its absence weakens no reward, and
 * inventing a rejection here would punish a player for a content gap.
 */
export function parseValidationSidecar(raw: unknown, maxTicks: number): GameValidation {
  const parsed = gameValidationSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return {
    max_score: 100,
    min_duration_seconds: 0,
    max_events: Math.max(1, Math.min(MAX_EVENTS_CEILING, (maxTicks + 1) * DEFAULT_MAX_EVENTS_PER_TICK)),
  };
}
