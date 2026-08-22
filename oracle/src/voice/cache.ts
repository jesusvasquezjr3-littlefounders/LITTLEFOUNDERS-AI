import { getConfig } from '../env.js';
import { redisGet, redisSetEx } from '../lib/redis.js';

/*
 * The synthesis cache — the thing that sits BEFORE the paid call.
 *
 * ── WHAT IS STORED ──────────────────────────────────────────────────────────
 *
 * A content key → the Depot URL of the audio for that exact line in that exact
 * voice. Tiny immutable strings, a few dozen bytes each. The audio itself is
 * already in Depot and already deduplicated by content hash there, so this
 * cache is not storing audio; it is storing the ANSWER to "have we paid for
 * this sentence before", which is the only expensive part.
 *
 * ── WHY REDIS ───────────────────────────────────────────────────────────────
 *
 * Because it is already here. Oracle already runs a Redis client for the rate
 * limiter (`lib/redis.ts`), already has `REDIS_URL` in its validated config,
 * and already treats that connection as optional. That buys three things a new
 * dependency would have to earn:
 *
 *   1. SHARED ACROSS INSTANCES AND RESTARTS. A per-process map re-pays for
 *      every line on every other replica and again after every deploy, and
 *      Railway redeploys this service often. A cache that empties on deploy is
 *      a cache that never warms.
 *   2. NO NEW FAILURE MODE. The connection, the timeout discipline and the
 *      fail-open posture are the ones the limiter has been running on.
 *   3. NOTHING NEW TO OPERATE. No table, no migration, no bucket, no eviction
 *      job — Redis expires entries itself.
 *
 * Rejected: a database table (Oracle has no database credentials, by design
 * and by test — /ORACLE.md §3.1); Depot itself (content-addressed by the AUDIO
 * hash, which we only know AFTER paying for the audio, so it can dedupe
 * storage but can never prevent a synthesis); and an in-process map alone, for
 * reason 1.
 *
 * ── WHEN IT IS UNAVAILABLE ──────────────────────────────────────────────────
 *
 * A miss. Never a silence, never an error, never a wait: `lib/redis.ts` caps
 * every command at 250 ms and answers `null` on anything that is not a clean
 * hit, so an unreachable, hung or empty Redis degrades to exactly what this
 * service did before the cache existed — one paid synthesis, spoken normally.
 * The child hears the tutor; the invoice is the only thing that notices.
 *
 * A write failure is equally ignorable: the next session pays again, once.
 */

const NAMESPACE = 'oracle:tts:v1:';

/** The URL stored for this content key, or `null` on a miss of any kind. */
export async function cachedSpeechUrl(contentKey: string): Promise<string | null> {
  if (!getConfig().SPEECH_CACHE_ENABLED) return null;
  const value = await redisGet(NAMESPACE + contentKey);
  return value && value.startsWith('http') ? value : null;
}

/**
 * Remembers the URL for a line we just paid for.
 *
 * Only ever called with a URL Depot actually reported. Caching a `null` would
 * turn one failed upload into a permanently silent line, which is the single
 * worst thing a cache could do here.
 */
export async function rememberSpeechUrl(contentKey: string, url: string): Promise<void> {
  const config = getConfig();
  if (!config.SPEECH_CACHE_ENABLED) return;
  await redisSetEx(NAMESPACE + contentKey, url, config.SPEECH_CACHE_TTL_SECONDS);
}
