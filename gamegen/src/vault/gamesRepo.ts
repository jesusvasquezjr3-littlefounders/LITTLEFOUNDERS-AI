// Vault repository for the Game Engine content tables (migration
// `database/migrations/0027_game_engine.sql`): `games` and `game_documents`.
//
// Two responsibilities, both deliberately narrow:
//
//  1. **Resolve a blueprint's `topic_path` to a real `topics.id`.** Every game binds
//     to a learn/ concept and the binding is DATA, not convention (gamegen/AGENTS.md):
//     `games.topic_id` is a NOT NULL FK. Arcade RESOLVES that chain, it never creates
//     it — the course → adventure → saga → topic hierarchy belongs to Forge
//     (`coursegen/src/pipeline/publish.ts` upserts it by slug at each level; this
//     module walks the identical (parent_id, slug) path in the read direction). A
//     path that does not resolve FAILS the slot: an "unbound" game must not exist.
//  2. **Upsert the two content rows idempotently**, keyed on the UNIQUE constraints
//     0027 declares: `(topic_id, slug)` for games, the `(game_id, locale)` primary key
//     for documents. Re-publishing a slot updates in place; it never duplicates.
//
// STATUS IS NOT A PARAMETER HERE. `upsertGame()` takes no status argument and writes
// the module constant `GENERATED_GAME_STATUS = 'review'`. That is the enforcement:
// there is no code path through this repository that can write 'published', so the
// human publish gate (the admin content queue) cannot be bypassed by a caller passing
// the wrong string. Flipping a game to 'published' is an operator action taken
// elsewhere, against a game a human has actually reviewed.

import { vaultSelect, vaultUpsert } from './client.js';
import type { GameLocale, GameTier, MechanicId } from '../contract/core/types.js';

/**
 * The ONLY status Arcade ever writes. Generated kid-facing content re-enters the
 * human review gate on every regeneration — including a game that was already
 * 'published', which is downgraded back to 'review' on purpose (the same deliberate
 * asymmetry `coursegen/src/vault/restClient.ts` documents for lessons: new content
 * behind an old approval is unreviewed content).
 */
export const GENERATED_GAME_STATUS = 'review';

interface RowWithId {
  id: string;
}

/** A blueprint's `topic_path` did not resolve to a live Vault hierarchy. FATAL for the
 *  slot and never degraded: publishing the game anyway is impossible (`topic_id` is NOT
 *  NULL), and inventing the missing level would fabricate curriculum Forge never wrote. */
export class TopicResolutionError extends Error {
  constructor(
    readonly courseSlug: string,
    readonly topicPath: string,
    readonly missingLevel: 'course' | 'adventure' | 'saga' | 'topic',
    readonly missingSlug: string,
  ) {
    super(
      `topic_path "${topicPath}" (course "${courseSlug}") does not resolve in Vault: ` +
        `no ${missingLevel} with slug "${missingSlug}". Publish the Forge course first — ` +
        `a game whose topic cannot be resolved is never published unbound.`,
    );
    this.name = 'TopicResolutionError';
  }
}

export interface ResolvedTopic {
  courseId: string;
  adventureId: string;
  sagaId: string;
  topicId: string;
}

/**
 * Resolved topics are cached for the lifetime of the process. A run publishes many
 * games under a handful of topics, the hierarchy is immutable for the duration of a
 * run, and each resolution costs four round-trips. `resetTopicResolutionCache()` is
 * the test-only escape hatch (twin of `resetConfigCache()`).
 */
const topicCache = new Map<string, ResolvedTopic>();

export function resetTopicResolutionCache(): void {
  topicCache.clear();
}

async function selectIdBySlug(
  table: 'courses' | 'adventures' | 'sagas' | 'topics',
  parentFilter: string | null,
  slug: string,
): Promise<string | null> {
  const filters = [parentFilter, `slug=eq.${encodeURIComponent(slug)}`].filter(
    (part): part is string => part !== null,
  );
  const rows = await vaultSelect<RowWithId>(`/${table}?select=id&${filters.join('&')}&limit=1`);
  // vaultSelect throws on a failed query, so [] here really means "no such row"
  // rather than "the upstream did not answer" (/AGENTS.md §1.14).
  return rows[0]?.id ?? null;
}

/**
 * `"<adventure>/<saga>/<topic>"` + the course slug → the resolved id chain.
 *
 * Walked level by level (rather than as one embedded PostgREST query) so the error
 * NAMES the level that is missing: "no saga with slug X" is a catalog fix an author
 * can act on; "0 rows" is a hunt. `catalog:check` already cross-validates the path
 * against `coursegen/curriculum/<course>/catalog.yaml`, so a failure here means the
 * catalog is right and Vault has not been published yet — a different, equally
 * actionable, message.
 */
export async function resolveTopicPath(courseSlug: string, topicPath: string): Promise<ResolvedTopic> {
  const cacheKey = `${courseSlug}/${topicPath}`;
  const cached = topicCache.get(cacheKey);
  if (cached) return cached;

  const segments = topicPath.split('/');
  const [adventureSlug, sagaSlug, topicSlug] = segments;
  if (segments.length !== 3 || !adventureSlug || !sagaSlug || !topicSlug) {
    throw new Error(
      `publish: topic_path "${topicPath}" is not "<adventure>/<saga>/<topic>" — ` +
        'the catalog schema enforces this shape, so reaching publish with anything else is a bug',
    );
  }

  const courseId = await selectIdBySlug('courses', null, courseSlug);
  if (!courseId) throw new TopicResolutionError(courseSlug, topicPath, 'course', courseSlug);

  const adventureId = await selectIdBySlug('adventures', `course_id=eq.${courseId}`, adventureSlug);
  if (!adventureId) throw new TopicResolutionError(courseSlug, topicPath, 'adventure', adventureSlug);

  const sagaId = await selectIdBySlug('sagas', `adventure_id=eq.${adventureId}`, sagaSlug);
  if (!sagaId) throw new TopicResolutionError(courseSlug, topicPath, 'saga', sagaSlug);

  const topicId = await selectIdBySlug('topics', `saga_id=eq.${sagaId}`, topicSlug);
  if (!topicId) throw new TopicResolutionError(courseSlug, topicPath, 'topic', topicSlug);

  const resolved: ResolvedTopic = { courseId, adventureId, sagaId, topicId };
  topicCache.set(cacheKey, resolved);
  return resolved;
}

export interface GameRowInput {
  topicId: string;
  /** Idempotency key with `topicId` — `games_topic_slug_unique` (0027). */
  slug: string;
  mechanic: MechanicId;
  /** locale → the document's `meta.title`. Stored as the `title` jsonb column. */
  title: Record<string, string>;
  tier: GameTier;
  /** From the manifest's `scoring.xp_max`. DB CHECK: 5..50. */
  xpMax: number;
  /** From the manifest's `meta.estimated_minutes`. */
  estimatedMinutes: number;
  /** `games_topic_position_unique` (0027) — the catalog owns ordering within a topic. */
  position: number;
}

/**
 * Upsert the `games` row and return its id.
 *
 * `status` is intentionally absent from `GameRowInput`: see this module's header.
 */
export async function upsertGame(input: GameRowInput): Promise<string> {
  const [row] = await vaultUpsert<RowWithId>(
    'games',
    [
      {
        topic_id: input.topicId,
        position: input.position,
        slug: input.slug,
        mechanic: input.mechanic,
        title: input.title,
        tier: input.tier,
        xp_max: input.xpMax,
        estimated_minutes: input.estimatedMinutes,
        status: GENERATED_GAME_STATUS,
      },
    ],
    'topic_id,slug',
  );
  if (!row) throw new Error(`publish: games upsert for "${input.slug}" returned no row`);
  return row.id;
}

export interface GameDocumentRowInput {
  gameId: string;
  locale: GameLocale;
  /** CLIENT-SAFE manifest. The caller is responsible for it carrying no sidecar —
   *  `splitGameDocument()` in `pipeline/publish.ts` is the one place that guarantees it. */
  document: Record<string, unknown>;
  /** SERVER-ONLY sidecar. Its ONLY home is this column (0027). */
  validation: Record<string, unknown>;
}

/**
 * Upsert one `game_documents` row per locale, keyed on the `(game_id, locale)`
 * primary key. Written in ONE request so the three locales of a slot land together:
 * a partially-written slot is a game that renders in es-MX and 404s in pt-BR.
 */
export async function upsertGameDocuments(rows: readonly GameDocumentRowInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  await vaultUpsert(
    'game_documents',
    rows.map((row) => ({
      game_id: row.gameId,
      locale: row.locale,
      schema_version: 1,
      document: row.document,
      validation: row.validation,
    })),
    'game_id,locale',
  );
  return rows.length;
}
