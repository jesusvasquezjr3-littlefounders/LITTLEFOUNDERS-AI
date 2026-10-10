import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Config } from '../config.js';

/*
 * The link at the bottom of an email that stops the optional ones. It has to work for somebody who
 * is not signed in, from any mail program, months later. So the link carries a token that names the
 * account and proves Core wrote it: the account's id and a keyed hash of it. It grants one thing,
 * switching that account's optional emails off or on, and nothing about the account can be read
 * with it.
 *
 * The key is derived from the session secret for this one purpose, so a token can never be taken
 * for a session token or the other way around, and production needs no new secret.
 */
const Id = z.uuid();

export type Unsubscribe = ReturnType<typeof createUnsubscribe>;

export function createUnsubscribe(config: Config) {
  const key = Buffer.from(hkdfSync('sha256', config.supabaseJwtSecret, 'littlefounders', 'unsubscribe-link-v1', 32));
  const mac = (userId: string): Buffer => createHmac('sha256', key).update(userId, 'utf8').digest();

  function token(userId: string): string {
    return `${Buffer.from(userId.replaceAll('-', ''), 'hex').toString('base64url')}.${mac(userId).toString('base64url')}`;
  }

  return {
    /** The two addresses an email carries: the page a person opens, and the one a mail program posts to by itself. */
    links(userId: string): { page: string; oneClick: string } {
      const value = encodeURIComponent(token(userId));

      return {
        page: `${config.frontendOrigin}/unsubscribe?token=${value}`,
        oneClick: `${config.publicApiOrigin}/api/v1/email/unsubscribe/one-click?token=${value}`,
      };
    },

    /** The account a token names, or null when Core did not write it. */
    verify(value: string): string | null {
      const [idPart, macPart, ...rest] = value.split('.');

      if (!idPart || !macPart || rest.length > 0) return null;

      const hex = Buffer.from(idPart, 'base64url').toString('hex');

      if (hex.length !== 32) return null;

      const userId = Id.safeParse(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);

      if (!userId.success) return null;

      const given = Buffer.from(macPart, 'base64url');
      const expected = mac(userId.data);

      return given.length === expected.length && timingSafeEqual(given, expected) ? userId.data : null;
    },
  };
}
