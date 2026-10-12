import { createHash } from 'node:crypto';
import { isIPv6 } from 'node:net';
import { Redis } from 'ioredis';
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes, type RateLimiterAbstract } from 'rate-limiter-flexible';
import type { Config } from '../config.js';
import { ApiError } from '../lib/http.js';
import { describeError, log, toError } from '../lib/log.js';

/*
 * Every counter that keeps sign-in from being abused. Numbers and reasons:
 * docs/security/RATE-LIMITING-AND-ABUSE.md.
 *
 * A one-time code has six digits, so what protects it is the number of guesses allowed, not its
 * length: five per code, and thirty a day per address, whoever is guessing and from wherever. The
 * counters are shared (Redis) in production so that several instances of Core count together.
 *
 * Two behaviors when the counter store cannot be reached: a limit that only protects capacity lets
 * the request through (`open`), a limit that protects an account refuses it (`closed`), because an
 * unmetered guess is worse than a failed sign-in.
 */
type Spec = { points: number; seconds: number; onStoreFailure: 'open' | 'closed' };

const SPECS = {
  // Per visitor address.
  ipGlobal: { points: 300, seconds: 15 * 60, onStoreFailure: 'open' },
  ipCodeRequest: { points: 10, seconds: 15 * 60, onStoreFailure: 'closed' },
  ipCodeVerify: { points: 30, seconds: 15 * 60, onStoreFailure: 'closed' },
  ipSession: { points: 120, seconds: 15 * 60, onStoreFailure: 'open' },
  ipAccount: { points: 30, seconds: 15 * 60, onStoreFailure: 'closed' },
  // Per account identifier (the address a code goes to), from any visitor address.
  codeCooldown: { points: 1, seconds: 60, onStoreFailure: 'closed' },
  codeHourly: { points: 5, seconds: 60 * 60, onStoreFailure: 'closed' },
  attemptsPerCode: { points: 5, seconds: 15 * 60, onStoreFailure: 'closed' },
  attemptsDaily: { points: 30, seconds: 24 * 60 * 60, onStoreFailure: 'closed' },
  // Per signed-in account. Reads of a person's own pages are counted by who they are and not by
  // their address: a classroom or a family shares one address, and must not share one allowance.
  accountRead: { points: 120, seconds: 15 * 60, onStoreFailure: 'open' },
  // For the whole service. Codes sent to addresses that have no account yet, in an hour: the
  // number comes from the configuration (it must stay under the authentication service's own
  // ceiling, so that people who already have an account can always get their code).
  newAddressHourly: { points: 300, seconds: 60 * 60, onStoreFailure: 'closed' },
  // Things that may happen once: a challenge is spent by the request that solves it, and the
  // authentication service's hook is acted on once per call id.
  challengeOnce: { points: 1, seconds: 3 * 60, onStoreFailure: 'closed' },
  hookOnce: { points: 1, seconds: 10 * 60, onStoreFailure: 'open' },
} as const satisfies Record<string, Spec>;

export type LimitName = keyof typeof SPECS;

/*
 * The limits that count how often something is asked for. In development, with RELAXED_LIMITS, they
 * are a hundred times wider (config.ts refuses the setting anywhere else). The ones left out guard
 * a code against guessing or let something happen once, and are never widened.
 */
const VOLUME: ReadonlySet<LimitName> = new Set<LimitName>(['ipGlobal', 'ipCodeRequest', 'ipCodeVerify', 'ipSession', 'ipAccount', 'codeCooldown', 'codeHourly', 'accountRead', 'newAddressHourly']);
const RELAXED_BY = 100;

/** Counter keys never hold an address or a username, only a digest of one. */
export function keyFor(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 32);
}

/*
 * What a visitor is counted by. An IPv4 address counts as itself. An IPv6 visitor is counted by
 * its /64 network: a home or a phone is handed a whole /64, so counting each of its addresses
 * apart would give one visitor billions of fresh counters.
 */
function networkOf(ip: string): string {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);

  if (mapped?.[1]) return mapped[1];

  const address = ip.split('%')[0] ?? ip;

  if (!isIPv6(address)) return ip;

  const [head = '', tail] = address.split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  const groups = tail === undefined ? left : [...left, ...Array.from({ length: Math.max(0, 8 - left.length - right.length) }, () => '0'), ...right];

  return `${groups.slice(0, 4).map((group) => parseInt(group, 16).toString(16)).join(':')}::/64`;
}

/** The counter key of the visitor behind a request. */
export function visitorKey(ip: string | undefined): string {
  return keyFor(networkOf(ip ?? 'unknown'));
}

export type Limits = Awaited<ReturnType<typeof createLimits>>;

export async function createLimits(config: Config) {
  let redis: Redis | undefined;

  if (config.redisUrl) {
    redis = new Redis(config.redisUrl, { enableOfflineQueue: false, maxRetriesPerRequest: 1, lazyConnect: true });
    redis.on('error', (error) => log.warn('redis.error', describeError(error)));

    try {
      await redis.connect();
    } catch (thrown) {
      // Keep going: ioredis reconnects on its own, and each limit decides what an unreachable store means.
      log.warn('redis.connect_failed', describeError(toError(thrown)));
    }
  }

  const limiters = new Map<LimitName, RateLimiterAbstract>();

  if (config.relaxedLimits) log.warn('limits.relaxed', { by: RELAXED_BY });

  for (const [name, spec] of Object.entries(SPECS)) {
    const usual = name === 'newAddressHourly' ? config.newAddressCodesPerHour : spec.points;
    // SAFETY: `name` is a key of SPECS, which is what LimitName is.
    const points = config.relaxedLimits && VOLUME.has(name as LimitName) ? usual * RELAXED_BY : usual;
    const options = { keyPrefix: `lf:core:${name}`, points, duration: spec.seconds };

    limiters.set(name as LimitName, redis ? new RateLimiterRedis({ ...options, storeClient: redis }) : new RateLimiterMemory(options));
  }

  const limiter = (name: LimitName): RateLimiterAbstract => {
    const found = limiters.get(name);

    if (!found) throw new Error(`unknown limit ${name}`);

    return found;
  };

  /** What a counter threw: a refusal carries the wait; anything else means the store failed. */
  function refusal(name: LimitName, thrown: unknown, code: 'RATE_LIMITED' | 'TOO_MANY_ATTEMPTS'): ApiError | null {
    if (thrown instanceof RateLimiterRes) return new ApiError(code, Math.max(1, Math.ceil(thrown.msBeforeNext / 1000)));

    log.error('limits.store_failed', { limit: name, ...describeError(toError(thrown)) });

    return SPECS[name].onStoreFailure === 'closed' ? new ApiError('UNAVAILABLE') : null;
  }

  return {
    /** Takes one point, or throws the error to answer with. */
    async consume(name: LimitName, key: string, code: 'RATE_LIMITED' | 'TOO_MANY_ATTEMPTS' = 'RATE_LIMITED'): Promise<void> {
      try {
        await limiter(name).consume(key);
      } catch (thrown) {
        const error = refusal(name, thrown, code);

        if (error) throw error;
      }
    },

    /** Takes one point and says whether it was allowed, for a limit the caller must not be told about. */
    async allow(name: LimitName, key: string): Promise<boolean> {
      try {
        await limiter(name).consume(key);

        return true;
      } catch (thrown) {
        return refusal(name, thrown, 'RATE_LIMITED') === null;
      }
    },

    /** Gives one point back (a correct code is not a failed attempt). Best effort. */
    async refund(name: LimitName, key: string): Promise<void> {
      try {
        await limiter(name).reward(key);
      } catch (thrown) {
        log.warn('limits.refund_failed', { limit: name, ...describeError(toError(thrown)) });
      }
    },

    /** Forgets a counter (a new code starts with a clean set of attempts). Best effort. */
    async reset(name: LimitName, key: string): Promise<void> {
      try {
        await limiter(name).delete(key);
      } catch (thrown) {
        log.warn('limits.reset_failed', { limit: name, ...describeError(toError(thrown)) });
      }
    },

    async close(): Promise<void> {
      if (redis) await redis.quit().catch(() => undefined);
    },
  };
}
