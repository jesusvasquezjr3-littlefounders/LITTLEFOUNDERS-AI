import { jwtVerify } from 'jose';
import { z } from 'zod';
import type { Config } from '../config.js';

/*
 * Checks an access token signed by the authentication service. Every binding is pinned: the
 * algorithm (HS256 and nothing else, so a token cannot choose its own), the issuer, the audience,
 * the expiry and the role. A token for an anonymous or service account is not a person's session.
 *
 * The token says who is asking and which session it belongs to. It says nothing about what that
 * person may do: roles are read from the database on every request (middleware/auth.ts).
 */
const Claims = z.object({
  sub: z.uuid(),
  session_id: z.uuid(),
  role: z.literal('authenticated'),
  is_anonymous: z.boolean().optional(),
});

export type AccessClaims = Readonly<{ userId: string; sessionId: string }>;

export type TokenVerifier = (token: string) => Promise<AccessClaims | null>;

export function createTokenVerifier(config: Config): TokenVerifier {
  const key = new TextEncoder().encode(config.supabaseJwtSecret);

  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        issuer: config.supabaseJwtIssuer,
        audience: 'authenticated',
        clockTolerance: 5,
      });
      const claims = Claims.safeParse(payload);

      if (!claims.success || claims.data.is_anonymous === true) return null;

      return { userId: claims.data.sub, sessionId: claims.data.session_id };
    } catch {
      return null;
    }
  };
}
