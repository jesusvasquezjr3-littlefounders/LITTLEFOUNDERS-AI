// publish stage — GAME_ENGINE.md §9, the twin of `coursegen/src/pipeline/publish.ts`.
// FREE (no model call, no image call): it resolves the blueprint's concept binding,
// splits each locale's manifest into the CLIENT-SAFE `document` and the SERVER-ONLY
// `validation` sidecar, and upserts `games` + `game_documents`×N by slug.
//
// TWO INVARIANTS, ENFORCED IN CODE RATHER THAN IN A COMMENT:
//
//  1. **The sidecar's only home is the `validation` column.** `splitGameDocument()`
//     removes a `validation` key from the manifest and then WALKS the result asserting
//     that no nested one survived. If the sidecar could ride inside `document`, then
//     stripping it client-side would be the only defense left — and `game_documents`
//     is served to the browser by Core, which strips the COLUMN, not a nested field.
//     What leaks if this slips is `max_score`, `min_duration_seconds`, `max_events`
//     and `item_values`: exactly the numbers needed to forge a maximal input log past
//     the server-side replay, i.e. the whole reward economy (migration 0027's header).
//  2. **status is ALWAYS 'review'.** There is no parameter, no branch and no override
//     for it anywhere in this file or in `vault/gamesRepo.ts` — the repository writes
//     the `GENERATED_GAME_STATUS` constant. Generated kid-facing content passes a
//     BLOCKING human gate (the admin content queue) before any child sees it
//     (/AGENTS.md §1.9, gamegen/AGENTS.md). Re-publishing a game that an operator had
//     already flipped to 'published' deliberately downgrades it back to 'review':
//     new content behind an old approval is unreviewed content.
//
// IDEMPOTENT BY CONSTRUCTION: `(topic_id, slug)` for the game row and
// `(game_id, locale)` for the documents (migration 0027). Re-publishing the same slot
// UPDATES; it never duplicates. That is what makes a resumed run, a retried slot and a
// full regeneration all safe to run over live content.

import { gameValidationSchema } from '../contract/core/schemaBase.js';
import type { GameDocument, GameLocale, GameTier, GameValidation, MechanicId } from '../contract/core/types.js';
import {
  GENERATED_GAME_STATUS,
  resolveTopicPath,
  upsertGame,
  upsertGameDocuments,
  type GameDocumentRowInput,
} from '../vault/gamesRepo.js';

/** The one key name the client document may never carry, at any depth. */
const SIDECAR_KEY = 'validation';

/** Depth cap for the sidecar walk. A manifest is parsed JSON a handful of levels
 *  deep; the cap exists so a pathological input cannot turn an integrity check into
 *  a hang, not because legitimate nesting ever reaches it. */
const MAX_WALK_DEPTH = 12;

export interface SplitGameDocumentResult {
  /** Goes into `game_documents.document` — safe to hand to a browser verbatim. */
  clientDocument: Record<string, unknown>;
  /** Goes into `game_documents.validation` — service role only, never served. */
  validation: Record<string, unknown>;
}

/** Throws when a key named `validation` survives anywhere inside the client document. */
function assertNoSidecar(value: unknown, path: string, depth: number): void {
  if (depth > MAX_WALK_DEPTH || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      assertNoSidecar(entry, `${path}[${index}]`, depth + 1);
    }
    return;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const child = path ? `${path}.${key}` : key;
    if (key === SIDECAR_KEY) {
      throw new Error(
        `publish: refusing to write a client document carrying a "${child}" key — the ` +
          'server-only sidecar belongs in the `validation` COLUMN alone (GAME_ENGINE.md §3)',
      );
    }
    assertNoSidecar(entry, child, depth + 1);
  }
}

/**
 * The Arcade-side twin of `stripValidation()` — the single sanctioned split.
 *
 * The sidecar is validated with the contract's own `gameValidationSchema` before it is
 * persisted: it is DERIVED data (bounds computed from the manifest and the bot run),
 * but Core reads these numbers back to accept or reject a child's reward, so an
 * out-of-contract `max_events` written here becomes a wrong 422 for an honest player
 * (/AGENTS.md §1.14 — never persist unvalidated output).
 */
export function splitGameDocument(document: GameDocument, validation: GameValidation): SplitGameDocumentResult {
  // Copy key-by-key rather than spread-and-delete: the sidecar key is not part of the
  // GameDocument type, so it can only ever arrive on an untyped/raw payload, and this
  // is the one place that has to cope with that possibility explicitly.
  const clientDocument: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document as unknown as Record<string, unknown>)) {
    if (key === SIDECAR_KEY) continue;
    clientDocument[key] = value;
  }
  assertNoSidecar(clientDocument, '', 0);

  const parsed = gameValidationSchema.safeParse(validation);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`publish: validation sidecar does not satisfy the contract — ${issues}`);
  }

  return { clientDocument, validation: parsed.data as Record<string, unknown> };
}

/** The blueprint facts publish needs. Named separately from the catalog type because
 *  `position` is REQUIRED here (`games.position` is NOT NULL and carries
 *  `UNIQUE (topic_id, position)`) while the catalog leaves it optional — resolving the
 *  default from declaration order is the caller's job, not this stage's. */
export interface PublishGameBlueprint {
  /** Idempotency key with the resolved topic. */
  slug: string;
  /** `"<adventure>/<saga>/<topic>"` — resolved to `games.topic_id` below. */
  topicPath: string;
  mechanic: MechanicId;
  tier: GameTier;
  position: number;
}

export interface PublishGameInput {
  /** The Forge course the blueprint's `topic_path` lives in. */
  courseSlug: string;
  blueprint: PublishGameBlueprint;
  /** One entry per locale generated for this slot — at least one required. */
  documents: Partial<Record<GameLocale, GameDocument>>;
  /**
   * ONE sidecar for the whole slot, not one per locale, and that is a contract not an
   * omission: `localize` freezes structure and skips every non-visible key, so the
   * bounds (max score, minimum duration, event cap, item values keyed by item id) are
   * identical in all three locales by construction. A per-locale sidecar would invite
   * three different reward ceilings for the same game.
   */
  validation: GameValidation;
}

export interface PublishGameResult {
  gameId: string;
  topicId: string;
  slug: string;
  /** Always 'review'. Restated in the result so a caller's summary/telemetry cannot
   *  claim a run "published" anything a human has not yet approved. */
  status: typeof GENERATED_GAME_STATUS;
  localesPublished: GameLocale[];
  xpMax: number;
  estimatedMinutes: number;
}

function titleMapFromDocuments(entries: readonly [GameLocale, GameDocument][]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [locale, document] of entries) out[locale] = document.meta.title;
  return out;
}

/**
 * Cross-check the manifest against the blueprint it was generated FOR.
 *
 * `games.slug`/`mechanic`/`tier` and the manifest's `meta` are two records of the same
 * fact, and publish is the last moment they can disagree cheaply. A mismatch means a
 * stage upstream rewrote a field it must not touch (a localize pass translating
 * `mechanic`, an author "improving" the slug) — and the consequence is a row whose
 * idempotency key no longer matches its own document, so the next run publishes a
 * SECOND game instead of updating this one.
 */
function assertDocumentMatchesBlueprint(
  locale: GameLocale,
  document: GameDocument,
  blueprint: PublishGameBlueprint,
): void {
  const mismatches: string[] = [];
  if (document.meta.locale !== locale) {
    mismatches.push(`meta.locale "${document.meta.locale}" != the map key "${locale}"`);
  }
  if (document.meta.slug !== blueprint.slug) {
    mismatches.push(`meta.slug "${document.meta.slug}" != blueprint slug "${blueprint.slug}"`);
  }
  if (document.meta.mechanic !== blueprint.mechanic) {
    mismatches.push(`meta.mechanic "${document.meta.mechanic}" != blueprint mechanic "${blueprint.mechanic}"`);
  }
  if (document.meta.tier !== blueprint.tier) {
    mismatches.push(`meta.tier ${document.meta.tier} != blueprint tier ${blueprint.tier}`);
  }
  if (document.meta.concept.topic_path !== blueprint.topicPath) {
    mismatches.push(
      `meta.concept.topic_path "${document.meta.concept.topic_path}" != blueprint topic_path "${blueprint.topicPath}"`,
    );
  }
  if (mismatches.length > 0) {
    throw new Error(`publish: ${locale} document disagrees with its blueprint — ${mismatches.join('; ')}`);
  }
}

/**
 * Publish one generated slot: resolve → upsert `games` → upsert `game_documents`×N.
 *
 * FREE and idempotent. Errors PROPAGATE (no swallow, no partial "best effort"): the
 * publish stage is the point at which a paid run either produced durable content or
 * did not, and a silently-failed write would report a game as shipped that no child
 * can open.
 */
export async function publishGameSlot(input: PublishGameInput): Promise<PublishGameResult> {
  const { blueprint } = input;

  const localeEntries = Object.entries(input.documents).filter(
    (entry): entry is [GameLocale, GameDocument] => entry[1] !== undefined,
  );
  if (localeEntries.length === 0) {
    throw new Error(`publish: slot "${blueprint.slug}" has no generated documents to publish`);
  }

  for (const [locale, document] of localeEntries) {
    assertDocumentMatchesBlueprint(locale, document, blueprint);
  }

  // The authoring locale is es-MX and every other locale is a string-frozen projection
  // of it, so it is authoritative for the numeric fields when present.
  const authoritative =
    localeEntries.find(([locale]) => locale === 'es-MX')?.[1] ?? localeEntries[0]?.[1];
  if (!authoritative) throw new Error(`publish: slot "${blueprint.slug}" has no authoritative document`);
  const xpMax = authoritative.scoring.xp_max;
  const estimatedMinutes = authoritative.meta.estimated_minutes;

  // A per-locale divergence here would mean the same game grants different XP
  // depending on the language a child reads it in — a localize bug, never a fix to
  // paper over by picking one value silently.
  for (const [locale, document] of localeEntries) {
    if (document.scoring.xp_max !== xpMax) {
      throw new Error(
        `publish: slot "${blueprint.slug}" has locale-dependent scoring.xp_max ` +
          `(${locale}: ${document.scoring.xp_max}, authoritative: ${xpMax})`,
      );
    }
    if (document.meta.estimated_minutes !== estimatedMinutes) {
      throw new Error(
        `publish: slot "${blueprint.slug}" has locale-dependent meta.estimated_minutes ` +
          `(${locale}: ${document.meta.estimated_minutes}, authoritative: ${estimatedMinutes})`,
      );
    }
  }

  // Split BEFORE any write: the sidecar assertion must be able to abort the whole
  // publish, not leave a games row pointing at documents that were never written.
  const documentRows: GameDocumentRowInput[] = [];
  const splits = localeEntries.map(
    ([locale, document]) => [locale, splitGameDocument(document, input.validation)] as const,
  );

  const { topicId } = await resolveTopicPath(input.courseSlug, blueprint.topicPath);

  const gameId = await upsertGame({
    topicId,
    slug: blueprint.slug,
    mechanic: blueprint.mechanic,
    title: titleMapFromDocuments(localeEntries),
    tier: blueprint.tier,
    xpMax,
    estimatedMinutes,
    position: blueprint.position,
  });

  for (const [locale, split] of splits) {
    documentRows.push({
      gameId,
      locale,
      document: split.clientDocument,
      validation: split.validation,
    });
  }
  await upsertGameDocuments(documentRows);

  return {
    gameId,
    topicId,
    slug: blueprint.slug,
    status: GENERATED_GAME_STATUS,
    localesPublished: localeEntries.map(([locale]) => locale),
    xpMax,
    estimatedMinutes,
  };
}
