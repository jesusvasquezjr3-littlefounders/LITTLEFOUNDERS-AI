import { createClient } from 'redis';
import { getConfig, isTestOrDev } from '../env.js';
import { withTimeout } from './http.js';

/*
 * ONE Redis connection for the whole service.
 *
 * It was created inside `middleware/rateLimit.ts` when the limiter was the
 * only thing that wanted it. The speech cache (`voice/cache.ts`) wants the
 * same connection rather than a second one, so the client moved here and the
 * limiter imports it — a cache is not a reason to open another socket, another
 * reconnect loop and another thing that can be down.
 *
 * EVERY RULE THIS CLIENT LIVES BY IS §1.14's, and none of them is new:
 *
 *  - It is connected in the BACKGROUND by index.ts, after the listener opens.
 *    Awaiting a client that retries its initial connect forever — which
 *    node-redis does — means the listener never opens at all, leaving the
 *    process alive, unhealthy and never restarted.
 *  - Every command carries a hard timeout. A live Redis outage leaves `isOpen`
 *    true because node-redis retries in the background, so a hung command
 *    never rejects and the caller waits forever.
 *  - Nothing here throws. Both helpers answer "no" on any failure, and every
 *    caller must treat "no" as a MISS rather than as an error. For the speech
 *    cache that means a paid synthesis; it must never mean silence.
 */

const COMMAND_TIMEOUT_MS = 250;

export const redisClient = createClient({ url: getConfig().REDIS_URL });

if (!isTestOrDev) {
  redisClient.on('error', (err) => console.error('[oracle] redis error', err));
}

/** Reads a key. `null` covers "absent", "unreachable" and "too slow" alike. */
export async function redisGet(key: string): Promise<string | null> {
  if (!redisClient.isOpen) return null;
  try {
    return await withTimeout(redisClient.get(key), COMMAND_TIMEOUT_MS, 'redis get');
  } catch {
    return null;
  }
}

/** Writes a key with an expiry. Returns whether it landed; nobody has to care. */
export async function redisSetEx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  if (!redisClient.isOpen) return false;
  try {
    await withTimeout(redisClient.set(key, value, { EX: ttlSeconds }), COMMAND_TIMEOUT_MS, 'redis set');
    return true;
  } catch {
    return false;
  }
}
