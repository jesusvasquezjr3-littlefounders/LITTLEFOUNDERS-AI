import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Config } from '../config.js';
import type { Cookies } from './cookies.js';

/*
 * A browser that has signed in to an account before.
 *
 * The counters that protect a one-time code are kept per account, whoever is guessing, because a
 * six-digit code is only as strong as the number of guesses allowed. Alone, that lets a stranger
 * who knows a child's username spend the account's guesses and emails on purpose and lock the
 * child out. So a browser that has already signed in to the account gets counters of its own for
 * that account, which a stranger cannot spend: the person on their usual device is not affected
 * by what anybody else does.
 *
 * The proof is a cookie the page cannot read. It holds, for up to five accounts (a family computer),
 * a keyed hash of the account's address: it names nobody, and only Core can make one. It is not a
 * session: it grants no access, only a separate allowance of the same size as everybody else's.
 *
 * The key is derived from the session secret for this one purpose (as the unsubscribe link's is).
 */
const MAX_ACCOUNTS = 5;
const MARK = /^[0-9a-f]{32}$/;

export type KnownDevices = ReturnType<typeof createKnownDevices>;

export function createKnownDevices(config: Config, cookies: Cookies) {
  const key = Buffer.from(hkdfSync('sha256', config.supabaseJwtSecret, 'littlefounders', 'known-device-v1', 32));
  const markOf = (email: string): string => createHmac('sha256', key).update(email.trim().toLowerCase(), 'utf8').digest('hex').slice(0, 32);

  const marks = (req: Request): string[] => (cookies.knownDevice(req) ?? '').split('.').filter((mark) => MARK.test(mark)).slice(0, MAX_ACCOUNTS);

  const same = (a: string, b: string): boolean => timingSafeEqual(Buffer.from(a, 'ascii'), Buffer.from(b, 'ascii'));

  return {
    /** True when this browser has signed in to the account with this address before. */
    knows(req: Request, email: string): boolean {
      const expected = markOf(email);

      // Every mark is compared, so the answer takes the same time wherever the match is.
      return marks(req).map((mark) => same(mark, expected)).includes(true);
    },

    /** Called when a session starts: from now on this browser is one of the account's own. */
    remember(req: Request, res: Response, email: string): void {
      const mark = markOf(email);
      const next = [mark, ...marks(req).filter((other) => other !== mark)].slice(0, MAX_ACCOUNTS);

      cookies.setKnownDevice(res, next.join('.'));
    },
  };
}
