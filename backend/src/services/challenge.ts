import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Config } from '../config.js';

/*
 * A small piece of work a browser does before it may ask for a code by email.
 *
 * Asking for a code makes the product send an email to whatever address was typed, so a script
 * that asks thousands of times uses the product to mail strangers and can use up the hour's
 * allowance of emails for everybody. Core hands out a challenge; the caller must find a number
 * that, hashed with it, starts with enough zero bits. A browser does it in about a tenth of a
 * second, once per code; a script has to pay that for every single request, on top of the limits
 * per visitor and per address (services/limits.ts).
 *
 * It is not a wall: somebody who rents enough machines gets through. It needs no third party, no
 * cookie and no puzzle for the person, which is why it is the first defense and not a CAPTCHA.
 *
 * A challenge is the time it was made and a random value, signed by Core, so nothing is stored to
 * hand one out. It is good for two minutes and for one request (the caller records that it was
 * used). The key is derived from the session secret for this one purpose.
 */
export const DIFFICULTY_BITS = 15;
const LIFETIME_MS = 2 * 60 * 1000;

export type Challenges = ReturnType<typeof createChallenges>;

/** How many zero bits a digest starts with. */
function leadingZeroBits(digest: Buffer): number {
  let bits = 0;

  for (const byte of digest) {
    if (byte === 0) {
      bits += 8;
      continue;
    }

    return bits + Math.clz32(byte) - 24;
  }

  return bits;
}

export function createChallenges(config: Config) {
  const key = Buffer.from(hkdfSync('sha256', config.supabaseJwtSecret, 'littlefounders', 'code-request-challenge-v1', 32));
  const mac = (body: string): string => createHmac('sha256', key).update(body, 'ascii').digest('base64url');

  return {
    difficulty: DIFFICULTY_BITS,

    issue(): string {
      const body = `${Date.now().toString(36)}.${randomBytes(12).toString('base64url')}`;

      return `${body}.${mac(body)}`;
    },

    /** True when Core made this challenge less than two minutes ago and the solution does the work. */
    accepts(challenge: string, solution: string): boolean {
      const [time, nonce, signature, ...rest] = challenge.split('.');

      if (!time || !nonce || !signature || rest.length > 0 || !/^[0-9a-z]{1,12}$/.test(time)) return false;

      const expected = Buffer.from(mac(`${time}.${nonce}`), 'ascii');
      const given = Buffer.from(signature, 'ascii');

      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;

      const age = Date.now() - parseInt(time, 36);

      if (age < 0 || age > LIFETIME_MS) return false;

      return leadingZeroBits(createHash('sha256').update(`${challenge}.${solution}`, 'ascii').digest()) >= DIFFICULTY_BITS;
    },
  };
}
